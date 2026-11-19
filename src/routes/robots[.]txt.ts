import { createFileRoute } from '@tanstack/react-router'
import { siteUrl } from '~/server/request.server'
import { getSettings, on, str } from '~/server/settings.server'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const S = await getSettings()
        const h = { 'Content-Type': 'text/plain; charset=utf-8' }
        if (on(S, 'seo_noindex') || on(S, 'maintenance')) return new Response('User-agent: *\nDisallow: /\n', { headers: h })
        let out = 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /guide\n'
        const extra = str(S, 'robots_extra').trim()
        if (extra) out += extra + '\n'
        out += `\nSitemap: ${siteUrl('sitemap.xml', request)}\n`
        return new Response(out, { headers: h })
      },
    },
  },
})
