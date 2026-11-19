import { createFileRoute } from '@tanstack/react-router'
import { Page, SettingsForm } from '~/components/admin/ui'
import { getAdminSettings } from '~/fns/admin'
import { SEO_FIELDS } from '~/lib/schemas'
import { assetUrl, strLimit } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/seo')({
  loader: () => getAdminSettings(),
  component: Seo,
})

function Seo() {
  const d = Route.useLoaderData()
  const S = d.S as Record<string, string>
  const url = S.seo_canonical || d.siteUrl
  let host = ''
  try { host = new URL(url).host } catch { /* ignore */ }
  const base = d.siteUrl.replace(/\/$/, '')
  return (
    <Page title="SEO & Meta" sub="How your site appears on Google and when shared on WhatsApp / social media.">
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Google preview</h2></div>
          <div className="serp"><div className="serp-url">{url.replace(/^https?:\/\//, '')}</div><div className="serp-title">{strLimit(S.seo_title ?? '', 62)}</div><div className="serp-desc">{strLimit(S.seo_description ?? '', 160)}</div></div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Share preview</h2></div>
          <div className="og-card">{S.og_image && <img src={assetUrl(S.og_image)} alt="" />}
            <div className="og-body"><small>{host}</small><strong>{S.og_title || S.seo_title}</strong><span>{strLimit(S.og_description || S.seo_description || '', 110)}</span></div></div>
        </div>
      </div>
      <SettingsForm group="seo" fields={SEO_FIELDS} S={d.S} submit="Save SEO" />
      <div className="card"><p className="help">Your sitemap: <a href="/sitemap.xml" target="_blank" rel="noopener">{base}/sitemap.xml</a> · robots: <a href="/robots.txt" target="_blank" rel="noopener">{base}/robots.txt</a> — submit the sitemap in Google Search Console.</p></div>
    </Page>
  )
}
