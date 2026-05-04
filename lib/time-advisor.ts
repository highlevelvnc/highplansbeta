/**
 * Time-aware advisor for prospecting hours.
 *
 * Returns a categorical "moment" with messaging — used for the warning banner
 * and to inform the prospect when to slow down / wait.
 *
 * Categories (most-impactful first):
 *   'lunch'    — 12:30-14:00 weekday: answer rate ~60% lower
 *   'late'     — after 19:00 weekday: people offline, answer rate <10%
 *   'early'    — before 08:00 weekday: too early, low engagement
 *   'weekend'  — Saturday/Sunday before 11h or after 18h: dead zones
 *   'sunday'   — all of Sunday: people don't want work talk
 *   'good'     — typical productive hours
 */

export type TimeMoment = 'lunch' | 'late' | 'early' | 'weekend' | 'sunday' | 'good'

export type TimeAdvice = {
  moment: TimeMoment
  message: string
  severity: 'high' | 'medium' | 'low'
  waitUntil?: { hour: number; minute: number; label: string }
}

export function getTimeAdvice(now = new Date()): TimeAdvice {
  const dow = now.getDay() // 0 = Sun, 6 = Sat
  const h = now.getHours()
  const m = now.getMinutes()
  const totalMin = h * 60 + m

  // Sunday — full day off-limits
  if (dow === 0) {
    return {
      moment: 'sunday',
      severity: 'high',
      message: '🛌 Domingo — taxa de resposta cai 80%. Considera adiar para amanhã.',
      waitUntil: { hour: 9, minute: 0, label: 'segunda 9h' },
    }
  }

  // Saturday — only morning 11h-18h is OK-ish
  if (dow === 6) {
    if (totalMin < 11 * 60 || totalMin >= 18 * 60) {
      return {
        moment: 'weekend',
        severity: 'high',
        message: '🏖️ Sábado fora-do-horário — quase ninguém atende.',
      }
    }
    return {
      moment: 'good',
      severity: 'low',
      message: 'Sábado — taxa de resposta mais baixa que dias úteis, mas viável.',
    }
  }

  // Weekday
  if (totalMin < 8 * 60) {
    return {
      moment: 'early',
      severity: 'medium',
      message: '🌅 Muito cedo — espera até às 9h para taxa de resposta normal.',
      waitUntil: { hour: 9, minute: 0, label: '9h' },
    }
  }

  // Lunch zone 12:30-14:00
  if (totalMin >= 12 * 60 + 30 && totalMin < 14 * 60) {
    return {
      moment: 'lunch',
      severity: 'high',
      message: '🍽️ Hora de almoço (12h30-14h) — taxa cai ~60%. Espera até 14h.',
      waitUntil: { hour: 14, minute: 0, label: '14h' },
    }
  }

  // After 19h
  if (totalMin >= 19 * 60) {
    return {
      moment: 'late',
      severity: 'high',
      message: '🌙 Depois das 19h — pessoas offline. Considera parar e retomar amanhã.',
      waitUntil: { hour: 9, minute: 0, label: 'amanhã 9h' },
    }
  }

  // Good zones
  return {
    moment: 'good',
    severity: 'low',
    message: 'Horário produtivo — bom momento para enviar.',
  }
}
