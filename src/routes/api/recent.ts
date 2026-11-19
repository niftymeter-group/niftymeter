/** GET /api/recent — real recent sign-ups for the social-proof popup (first name + last initial only). */
import { createFileRoute } from '@tanstack/react-router'
import { ago, all, T } from '~/server/db.server'
import { json } from '~/server/request.server'
import { getSettings, on, str } from '~/server/settings.server'

export const Route = createFileRoute('/api/recent')({
  server: {
    handlers: {
      GET: async () => {
        const S = await getSettings()
        const h = { 'Cache-Control': 'public, max-age=60' }
        if (!on(S, 'popup_enabled')) return json({ items: [] }, 200, h)
        const days = Math.max(1, Math.min(90, Number(str(S, 'popup_days', '14')) || 14))
        const rows = await all(`SELECT first_name, last_name, created_at FROM ${T.leads} WHERE status <> 'rejected' AND created_at > ? ORDER BY created_at DESC LIMIT 12`, [ago(days * 86400)])
        const items = rows.map((r) => {
          const fn = Array.from(String(r.first_name).trim()).slice(0, 20).join('').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
          const last = String(r.last_name ?? '').trim()
          return { name: fn + (last ? ' ' + Array.from(last)[0]!.toUpperCase() + '.' : ''), at: new Date(String(r.created_at).replace(' ', 'T')).toISOString() }
        })
        return json({ items }, 200, h)
      },
    },
  },
})
