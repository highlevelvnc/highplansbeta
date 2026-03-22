// app/api/imports/start/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { detectarFormato, normalizarLead } from '@/lib/importNormalize'
import { parse } from 'papaparse'

export const maxDuration = 300 // 5 min

function normalizeHeaderKey(k: string) {
  return (k || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function inferTermoFromFilename(filename: string) {
  const base = (filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(leads?|lista|export|final|pt|br|csv)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!base) return 'Geral'

  return (
    base
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .slice(0, 4)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Geral'
  )
}

function isFormatoMinimo(headers: string[]) {
  const norm = headers.map(k => normalizeHeaderKey(k).replace(/[_\s-]/g, ''))
  const hasNome = norm.some(n => n === 'nome' || n === 'name')
  const hasCidade = norm.some(n => n === 'cidade' || n === 'city')
  const hasTelefone = norm.some(n => ['telefone', 'telefonenorm', 'phone', 'tel'].includes(n))
  const hasSite = norm.some(n => ['site', 'website', 'url'].includes(n))
  return hasNome && (hasCidade || hasTelefone || hasSite)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })

    // Validação de segurança: tamanho máximo 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx 10MB)' }, { status: 400 })
    }

    // Validação de tipo: apenas CSV/texto
    const validTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv']
    const ext = file.name?.toLowerCase().endsWith('.csv')
    if (!ext && file.type && !validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato inválido. Apenas ficheiros .csv são aceites.' }, { status: 400 })
    }

    const text = await file.text()
    const parsed = parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length && parsed.data.length === 0) {
      return NextResponse.json({ error: 'CSV inválido ou vazio' }, { status: 400 })
    }

    const headers = parsed.meta.fields ?? []
    const formato = detectarFormato(headers)
    const okMinimo = isFormatoMinimo(headers)

    if (formato === 'desconhecido' && !okMinimo) {
      return NextResponse.json(
        {
          error: `Formato não reconhecido. Colunas encontradas: ${headers.join(
            ', '
          )}. Esperado: Nome, Cidade e (Telefone ou Site). Termo é opcional e será inferido pelo nome do ficheiro.`,
        },
        { status: 400 }
      )
    }

    const rows = parsed.data
    const totalRows = rows.length
    const defaultTermo = inferTermoFromFilename(file.name)

    const job = await prisma.importJob.create({
      data: { filename: file.name, status: 'running', totalRows },
    })

    // desacopla do request (melhor no dev)
    setTimeout(() => {
      processarLeads(job.id, rows, defaultTermo).catch(async (err) => {
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            logJson: JSON.stringify([err instanceof Error ? err.message : String(err)]),
          },
        })
      })
    }, 0)

    return NextResponse.json({ jobId: job.id, totalRows, defaultTermo })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const BATCH_SIZE = 200
const UPDATE_EVERY = 500

async function processarLeads(jobId: string, rows: Record<string, string>[], defaultTermo: string) {
  let imported = 0
  let duplicated = 0
  let invalid = 0
  const erros: string[] = []

  // ✅ Dedup simples com sets (telefone/email)
  const existingPhones = new Set<string>()
  const existingEmails = new Set<string>()

  // Carrega só campos que existem no schema atual
  const allLeads = await prisma.lead.findMany({
    select: { id: true, telefone: true, email: true, nome: true, cidade: true },
  })

  for (const l of allLeads) {
    if (l.telefone) existingPhones.add(l.telefone)
    if (l.email) existingEmails.add(l.email)
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    const toCreate: Record<string, unknown>[] = []
    const toUpdate: { id: string; data: Record<string, unknown> }[] = []

    for (const row of batch) {
      try {
        const rowWithTermo: Record<string, string> = {
          ...row,
          Termo: row.Termo || row.termo || defaultTermo,
        }

        const norm = normalizarLead(rowWithTermo)

        if (!norm.nome || norm.nome.length < 2) {
          invalid++
          continue
        }

        const phone = (norm.telefoneRaw || '').trim() || undefined
        const email = (norm.email || '').trim() || undefined

        // Dedup por telefone ou email (mais forte do que nome+cidade)
        let existingId: string | null = null

        if (phone && existingPhones.has(phone)) {
          existingId = allLeads.find((l) => l.telefone === phone)?.id ?? null
        }

        if (!existingId && email && existingEmails.has(email)) {
          existingId = allLeads.find((l) => (l.email || '').toLowerCase() === email.toLowerCase())?.id ?? null
        }

        if (existingId) {
          // Merge leve: preencher campos vazios do existente
          const existing = allLeads.find((l) => l.id === existingId)!
          const updateData: Record<string, unknown> = {}

          // Se você quiser, pode enriquecer aqui (empresa, whatsapp, etc)
          if (!existing.cidade && norm.cidade) updateData.cidade = norm.cidade
          if (norm.nicho) updateData.nicho = norm.nicho
          if (norm.opportunityScore != null) updateData.opportunityScore = norm.opportunityScore
          if (norm.score) updateData.score = norm.score

          if (Object.keys(updateData).length) {
            toUpdate.push({ id: existingId, data: updateData })
          }

          duplicated++
          continue
        }

        // Create
        const leadData = {
          nome: norm.nome,
          empresa: norm.empresa,
          nicho: norm.nicho || defaultTermo,
          cidade: norm.cidade,
          telefone: phone ?? null,
          whatsapp: norm.whatsapp,
          email: email ?? null,
          temSite: norm.temSite,
          siteFraco: norm.siteFraco,
          instagramAtivo: false,
          gmbOtimizado: false,
          anunciosAtivos: false,
          opportunityScore: norm.opportunityScore,
          score: norm.score || 'COLD',
          motivoScore: null as string | null,
          verbaAnuncios: null as number | null,
          origem: null as string | null,
          decisionProfile: null as string | null,
          observacaoPerfil: null as string | null,
          pipelineStatus: 'NEW',
        }

        toCreate.push(leadData)

        // atualiza sets para dedup intra-import
        if (phone) existingPhones.add(phone)
        if (email) existingEmails.add(email.toLowerCase())
      } catch (e: unknown) {
        invalid++
        if (erros.length < 50) erros.push(e instanceof Error ? e.message : String(e))
      }
    }

    if (toCreate.length) {
      await prisma.lead.createMany({ data: toCreate as any, skipDuplicates: true })
      imported += toCreate.length
    }

    // updates (limitado; para 30k, depois otimizamos)
    for (const u of toUpdate.slice(0, 50)) {
      await prisma.lead.update({ where: { id: u.id }, data: u.data as any })
    }

    if ((i + BATCH_SIZE) % UPDATE_EVERY < BATCH_SIZE || i + BATCH_SIZE >= rows.length) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          processedRows: Math.min(i + BATCH_SIZE, rows.length),
          imported,
          duplicated,
          invalid,
        },
      })
    }
  }

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: 'done',
      processedRows: rows.length,
      imported,
      duplicated,
      invalid,
      finishedAt: new Date(),
      logJson: erros.length ? JSON.stringify(erros) : null,
    },
  })
}