import { createFileRoute } from '@tanstack/react-router'
import { esc } from '~/lib/util'
import { now, T, val } from '~/server/db.server'
import { siteUrl } from '~/server/request.server'
import { getSettings, str } from '~/server/settings.server'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const S = await getSettings()
        const last = String((await val(`SELECT MAX(updated_at) FROM ${T.settings}`)) ?? now()).slice(0, 10)
        const loc = str(S, 'seo_canonical') || siteUrl('/', request)
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(loc)}</loc><lastmod>${last}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`
        return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
      },
    },
  },
})
