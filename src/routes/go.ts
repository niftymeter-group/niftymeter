/**
 * Tracked outbound links: /go?to=broker&src=pricing
 * Counts the click and redirects to the configured link only (never an arbitrary URL).
 */
import { createFileRoute } from '@tanstack/react-router'
import { insert, now, T } from '~/server/db.server'
import { clientIp } from '~/server/request.server'
import { getSettings, str } from '~/server/settings.server'

const TARGETS: Record<string, string> = { broker: 'broker_link', buy: 'price_link' }

export const Route = createFileRoute('/go')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url)
        const to = u.searchParams.get('to') ?? ''
        const S = await getSettings()
        const url = TARGETS[to] ? str(S, TARGETS[to]).trim() : ''
        if (!url || !/^https?:\/\//i.test(url)) return new Response(null, { status: 302, headers: { Location: '/#pricing' } })
        const src = (u.searchParams.get('src') ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40)
        let utm: Record<string, unknown> = {}
        const m = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)nm_utm=([^;]+)/)
        if (m) { try { utm = JSON.parse(decodeURIComponent(m[1]!)) } catch { /* ignore */ } }
        try {
          await insert(T.clicks, {
            target: to, source: src || null,
            utm_source: typeof utm.utm_source === 'string' ? utm.utm_source.slice(0, 190) : null,
            utm_campaign: typeof utm.utm_campaign === 'string' ? utm.utm_campaign.slice(0, 190) : null,
            ip: clientIp(request), created_at: now(),
          })
        } catch { /* never block the redirect */ }
        return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer-when-downgrade' } })
      },
    },
  },
})
