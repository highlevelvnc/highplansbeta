/**
 * Service Worker for HIGHPLANS — callback notification reliability.
 *
 * What it does:
 *   - Registers a service worker that stays alive across browser restarts (limited).
 *   - Receives messages from the app with scheduled callback details.
 *   - Stores pending callbacks in IndexedDB so they survive page reloads.
 *   - Periodically checks (every 60s while alive) for callbacks coming due
 *     and fires persistent notifications (visible in OS notification center).
 *   - On notification click, focuses an existing tab or opens /prospeccao.
 *
 * Limitation: a service worker is not a true background process. The browser
 * may shut it down when the tab has been closed for a while. For TRUE background
 * delivery you'd need server-side push (VAPID + push send). This implementation
 * is best-effort — covers the common case where the user keeps the tab open or
 * comes back occasionally during the day.
 */

const DB_NAME = 'highplans-sw'
const STORE = 'callbacks'

// ── IndexedDB helpers ──────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putCallback(cb) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(cb)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

async function deleteCallback(id) {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

async function getAllCallbacks() {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => resolve([])
  })
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ── Message handler — page → SW ─────────────────────────────────────────────
self.addEventListener('message', async (event) => {
  const data = event.data || {}
  if (data.type === 'SCHEDULE_CALLBACK') {
    // { id, leadName, agendadoPara (ISO), mensagem }
    const cb = {
      id: data.id,
      leadName: data.leadName,
      agendadoPara: data.agendadoPara,
      mensagem: data.mensagem || 'Callback agendado',
      notified: false,
    }
    await putCallback(cb)
  } else if (data.type === 'CANCEL_CALLBACK') {
    await deleteCallback(data.id)
  } else if (data.type === 'CHECK_NOW') {
    await checkPendingCallbacks()
  }
})

// ── Periodic check ──────────────────────────────────────────────────────────
async function checkPendingCallbacks() {
  const all = await getAllCallbacks()
  const now = Date.now()
  for (const cb of all) {
    const due = new Date(cb.agendadoPara).getTime()
    const delta = due - now
    // Already notified or way in future
    if (cb.notified) {
      // Cleanup: if event was >1h ago, remove
      if (delta < -60 * 60 * 1000) await deleteCallback(cb.id)
      continue
    }
    // Within 15 minutes → fire notification
    if (delta <= 15 * 60 * 1000 && delta > -5 * 60 * 1000) {
      const minsUntil = Math.max(0, Math.round(delta / 60000))
      const title = minsUntil > 0
        ? `📞 Callback em ${minsUntil}min: ${cb.leadName}`
        : `📞 Callback AGORA: ${cb.leadName}`
      try {
        await self.registration.showNotification(title, {
          body: cb.mensagem,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `callback-${cb.id}`,
          requireInteraction: true,  // stays until user dismisses
          data: { url: '/prospeccao', callbackId: cb.id },
          actions: [
            { action: 'done', title: '✓ Feito' },
            { action: 'snooze1h', title: '⏰ +1h' },
          ],
        })
        cb.notified = true
        await putCallback(cb)
      } catch (e) { /* ignore */ }
    }
  }
}

// Run check every 60s while SW is alive
setInterval(() => { checkPendingCallbacks().catch(() => {}) }, 60_000)
// Also run once on activation (catches missed ones)
checkPendingCallbacks().catch(() => {})

// ── Payment due alerts — checks /api/financeiro/due-payments periodically ────
// Notifies for overdue + due-today payments. Throttled to 1×/30min per item via
// IndexedDB tracking to avoid spamming.
const PAYMENT_NOTIF_TTL = 30 * 60 * 1000  // 30min between repeats
async function checkDuePayments() {
  try {
    const res = await fetch('/api/financeiro/due-payments', { cache: 'no-store' })
    if (!res.ok) return
    const d = await res.json()

    const all = await getAllCallbacks()  // reuse same store for simplicity
    // Use prefixes to distinguish from callbacks: 'pay-overdue-{id}', 'pay-today-{id}'
    const notifiedMap = new Map(all.filter(c => c.id.startsWith('pay-')).map(c => [c.id, c.notified || 0]))

    const fmtVal = (v, m) => m === 'BRL' ? `R$ ${v.toFixed(0)}` : `${v.toFixed(0)} €`

    for (const p of (d.overdue?.items || [])) {
      const key = `pay-overdue-${p.id}`
      const last = notifiedMap.get(key) || 0
      if (Date.now() - last < PAYMENT_NOTIF_TTL) continue
      const name = p.client?.empresa || p.client?.nome || 'Cliente'
      const val = fmtVal(p.valor, p.moeda)
      try {
        await self.registration.showNotification(`💸 Pagamento atrasado: ${val}`, {
          body: `${name}${p.periodoRef ? ' · ' + p.periodoRef : ''}`,
          icon: '/favicon.ico',
          tag: key,
          requireInteraction: true,
          data: { url: '/financeiro' },
          actions: [{ action: 'open-financeiro', title: 'Ver' }],
        })
        await putCallback({ id: key, leadName: name, agendadoPara: new Date().toISOString(), notified: Date.now(), mensagem: 'overdue' })
      } catch {}
    }

    for (const p of (d.dueToday?.items || [])) {
      const key = `pay-today-${p.id}`
      const last = notifiedMap.get(key) || 0
      if (Date.now() - last < PAYMENT_NOTIF_TTL) continue
      const name = p.client?.empresa || p.client?.nome || 'Cliente'
      const val = fmtVal(p.valor, p.moeda)
      try {
        await self.registration.showNotification(`📅 Pagamento vence hoje: ${val}`, {
          body: `${name}${p.periodoRef ? ' · ' + p.periodoRef : ''}`,
          icon: '/favicon.ico',
          tag: key,
          requireInteraction: true,
          data: { url: '/financeiro' },
          actions: [{ action: 'open-financeiro', title: 'Ver' }],
        })
        await putCallback({ id: key, leadName: name, agendadoPara: new Date().toISOString(), notified: Date.now(), mensagem: 'today' })
      } catch {}
    }
  } catch {}
}

// Check every 15min (low-frequency since these don't need second-precision)
setInterval(() => { checkDuePayments().catch(() => {}) }, 15 * 60_000)
// Also on activation
checkDuePayments().catch(() => {})

// ── Notification click handler ──────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const action = event.action
  const callbackId = event.notification.data?.callbackId
  const url = event.notification.data?.url || '/prospeccao'

  // Action: mark callback as done (PUT /api/followups/[id])
  if (action === 'done' && callbackId) {
    event.waitUntil(
      fetch(`/api/followups/${callbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enviado: true, enviadoEm: new Date().toISOString() }),
      }).then(() => deleteCallback(callbackId)).catch(() => {})
    )
    return
  }

  // Action: snooze +1h (PUT /api/followups/[id] with new agendadoPara)
  if (action === 'snooze1h' && callbackId) {
    const newWhen = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    event.waitUntil(
      fetch(`/api/followups/${callbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendadoPara: newWhen }),
      }).then(async () => {
        // Update SW store: reset notified flag, push new time
        const all = await getAllCallbacks()
        const existing = all.find(c => c.id === callbackId)
        if (existing) {
          existing.agendadoPara = newWhen
          existing.notified = false
          await putCallback(existing)
        }
      }).catch(() => {})
    )
    return
  }

  // Action: open finance page (from payment notification)
  if (action === 'open-financeiro') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) { client.navigate('/financeiro').catch(() => {}); return client.focus() }
        }
        if (self.clients.openWindow) return self.clients.openWindow('/financeiro')
      })
    )
    return
  }

  // Default click: focus or open prospect tab
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
