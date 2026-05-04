import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Generate an .ics file for a single follow-up so the user can add it
 * to Apple Calendar / Google Calendar / Outlook.
 *
 * GET /api/followups/[id]/ics → returns text/calendar file download.
 */

function pad(n: number) { return n.toString().padStart(2, '0') }

function formatICSDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  )
}

function escapeICS(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const fu = await prisma.followUp.findUnique({
      where: { id },
      include: {
        lead: { select: { nome: true, empresa: true, whatsapp: true, telefone: true, cidade: true } },
      },
    })
    if (!fu) return NextResponse.json({ error: 'Follow-up não encontrado' }, { status: 404 })

    const start = new Date(fu.agendadoPara)
    const end = new Date(start.getTime() + 30 * 60 * 1000) // 30min default duration
    const now = new Date()

    const leadName = fu.lead?.empresa || fu.lead?.nome || 'Lead'
    const summary = `📞 ${fu.tipo === 'CHAMADA' ? 'Callback' : fu.tipo} — ${leadName}`
    const phone = fu.lead?.whatsapp || fu.lead?.telefone || ''
    const descParts = [
      fu.mensagem || 'Follow-up agendado',
      '',
      `Lead: ${leadName}`,
      fu.lead?.cidade ? `Cidade: ${fu.lead.cidade}` : '',
      phone ? `Telefone: ${phone}` : '',
      '',
      `Aberto via HIGHPLANS · ${typeof window === 'undefined' ? '' : window.location.origin}`,
    ].filter(Boolean).join('\\n')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HIGHPLANS//Callback//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:highplans-followup-${fu.id}@highplans.app`,
      `DTSTAMP:${formatICSDate(now)}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${descParts}`,
      phone ? `LOCATION:${escapeICS(phone)}` : '',
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(summary)} em 15min`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    const safeName = leadName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
    const filename = `callback-${safeName}-${start.toISOString().slice(0, 10)}.ics`

    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
