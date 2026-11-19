import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { getCampaigns } from '~/fns/admin'

export const Route = createFileRoute('/admin/_panel/campaigns')({
  validateSearch: (s: Record<string, unknown>) => ({ range: ['7', '30', '90', 'all'].includes(String(s.range)) ? String(s.range) : '30' }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getCampaigns({ data: deps }),
  component: Campaigns,
})

const clean = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '_')

function Campaigns() {
  const d = Route.useLoaderData()
  const [u, setU] = useState({ url: d.siteUrl, source: '', medium: '', campaign: '', content: '', term: '', hash: '' })
  const out = useMemo(() => {
    let base = u.url.trim()
    if (!base) return ''
    const p: string[] = []
    for (const [k, v] of [['utm_source', u.source], ['utm_medium', u.medium], ['utm_campaign', u.campaign], ['utm_content', u.content], ['utm_term', u.term]] as const) {
      const c = clean(v)
      if (c) p.push(`${k}=${encodeURIComponent(c)}`)
    }
    base = base.split('#')[0]!
    return base + (p.length ? (base.includes('?') ? '&' : '?') + p.join('&') : '') + u.hash
  }, [u])
  const set = (k: keyof typeof u) => (e: { target: { value: string } }) => setU((x) => ({ ...x, [k]: e.target.value }))
  const tot = d.rows.reduce((a, r) => a + Number(r.n), 0)
  return (
    <Page title="Campaigns & UTM" sub="Build tracked links for your ads and posts, then see which campaigns bring leads and sales.">
      <div className="card">
        <div className="card-head"><h2>🎯 Campaign link builder</h2></div>
        <div className="form-grid" id="utm">
          <div className="field wide"><label>Landing page URL</label><input className="input mono" value={u.url} onChange={set('url')} /></div>
          <div className="field"><label>Platform (utm_source)</label><input className="input" list="srcs" placeholder="facebook" value={u.source} onChange={set('source')} />
            <datalist id="srcs">{['facebook', 'instagram', 'google', 'youtube', 'whatsapp', 'telegram', 'twitter', 'linkedin', 'email', 'influencer'].map((x) => <option key={x}>{x}</option>)}</datalist></div>
          <div className="field"><label>Type (utm_medium)</label><input className="input" list="meds" placeholder="paid_social" value={u.medium} onChange={set('medium')} />
            <datalist id="meds">{['paid_social', 'cpc', 'organic_social', 'video', 'email', 'referral', 'story', 'reel'].map((x) => <option key={x}>{x}</option>)}</datalist></div>
          <div className="field"><label>Campaign name (utm_campaign)</label><input className="input" placeholder="diwali_offer_2026" value={u.campaign} onChange={set('campaign')} /></div>
          <div className="field"><label>Ad / creative (utm_content)</label><input className="input" placeholder="video_a" value={u.content} onChange={set('content')} /></div>
          <div className="field"><label>Keyword / audience (utm_term)</label><input className="input" placeholder="nifty indicator" value={u.term} onChange={set('term')} /></div>
          <div className="field"><label>Jump to section</label><select className="input" value={u.hash} onChange={set('hash')}><option value="">Top of page</option><option value="#lead-form">Enquiry form</option><option value="#pricing">Pricing</option><option value="#charts">Live charts</option><option value="#features">Features</option></select></div>
          <div className="field wide"><label>Your tracked link</label>
            <div className="copy-row"><input className="input mono" readOnly value={out} /><button type="button" className="btn btn-primary" onClick={() => navigator.clipboard?.writeText(out).then(() => toast('Link copied!'), () => toast('Copy failed', true))}>Copy</button></div>
            <div className="help">Meta Ads: you can paste <code>{'utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}'}</code> into the ad's "URL parameters" field instead. Google Ads adds <code>gclid</code> automatically when auto-tagging is on.</div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Campaign performance</h2>
          <div className="seg">{([['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time']] as const).map(([k, l]) => <Link key={k} to="/admin/campaigns" search={{ range: k }} className={d.range === k ? 'active' : ''}>{l}</Link>)}</div>
        </div>
        {!d.rows.length ? <p className="muted">No leads in this period yet.</p> : (
          <>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Source</th><th>Medium</th><th>Campaign</th><th className="num">Leads</th><th className="num">Share</th><th className="num">Converted</th><th className="num">Conv. rate</th><th className="num">Google clicks</th><th className="num">Meta clicks</th></tr></thead>
              <tbody>
                {d.rows.map((r, i) => {
                  const n = Number(r.n), conv = Number(r.conv)
                  return (
                    <tr key={i}>
                      <td><Link to="/admin/leads" search={{ source: String(r.src) }}>{String(r.src)}</Link></td><td>{String(r.med)}</td><td>{String(r.camp)}</td>
                      <td className="num"><strong>{n}</strong></td>
                      <td className="num"><div className="mini-bar"><span style={{ width: `${tot ? Math.round((n / tot) * 100) : 0}%` }}></span></div></td>
                      <td className="num">{conv}</td>
                      <td className="num">{n ? Math.round((conv / n) * 1000) / 10 : 0}%</td>
                      <td className="num">{Number(r.g)}</td><td className="num">{Number(r.f)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
            <p className="help">Mark leads as <span className="badge st-converted">converted</span> in <Link to="/admin/leads">Leads</Link> when they buy, to see real conversion rates per campaign.</p>
          </>
        )}
      </div>
    </Page>
  )
}
