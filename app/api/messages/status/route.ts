// GET /api/messages/status — Verifica estado das integrações
import { NextResponse } from 'next/server'

export async function GET() {
  const whatsapp = {
    configured: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE),
    provider: 'Evolution API',
    url: process.env.EVOLUTION_API_URL ? '✓ Configurado' : '✗ Em falta',
    key: process.env.EVOLUTION_API_KEY ? '✓ Configurado' : '✗ Em falta',
    instance: process.env.EVOLUTION_INSTANCE ? '✓ Configurado' : '✗ Em falta',
  }

  const email = {
    configured: !!process.env.RESEND_API_KEY,
    provider: 'Resend',
    key: process.env.RESEND_API_KEY ? '✓ Configurado' : '✗ Em falta',
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev (default)',
  }

  return NextResponse.json({ whatsapp, email })
}
