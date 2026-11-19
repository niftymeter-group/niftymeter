import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { BannerCard, Page } from '~/components/admin/ui'
import { getDashboard } from '~/fns/admin'
import { fmtDate, numberFormat, timeAgo } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/')({
  loader: () => getDashboard(),
  component: Dashboard,
})

function Dashboard() {
  const d = Route.useLoaderData()
  const navigate = useNavigate()
  const max = Math.max(1, ...d.series.map((x) => x.n))
  const done = d.check.filter((c) => c[1]).length
  return (
    <Page title="Dashboard" sub="Welcome back.">
      <div className="stat-grid">
        {d.stats.map(([lbl, n]) => <div key={lbl} className="card stat"><div className="stat-lbl">{lbl}</div><div className="stat-num">{numberFormat(n)}</div><div className="stat-hint">enquiries</div></div>)}
        <Link className="card stat stat-link" to="/admin/leads" search={{ status: 'new' }}><div className="stat-lbl">Awaiting action</div><div className="stat-num accent">{numberFormat(d.fresh)}</div><div className="stat-hint">new leads →</div></Link>
        <div className="card stat"><div className="stat-lbl">Conversion</div><div className="stat-num">{d.convRate}%</div><div className="stat-hint">{d.converted} converted</div></div>
      </div>

      <BannerCard banner={d.banner} isOn={d.banner.on} msg={d.banner.msg} />

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Leads — last 14 days</h2></div>
          <div className="bars" role="img" aria-label="Leads per day for the last 14 days">
            {d.series.map((x) => (
              <div key={x.d} className="bar-col" title={`${fmtDate(x.d, 'Dd_M')}: ${x.n}`}>
                <span className="bar-val">{x.n || ''}</span>
                <div className="bar" style={{ height: `${Math.max(2, Math.round((x.n / max) * 100))}%` }}></div>
                <span className="bar-lbl">{fmtDate(x.d, 'd')}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Top sources (30 days)</h2><Link to="/admin/campaigns" className="small">Campaigns →</Link></div>
          {!d.sources.length ? <p className="muted">No leads yet. Share your site link or start a campaign.</p> : (
            <table className="table compact"><thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Converted</th></tr></thead><tbody>
              {d.sources.map((s, i) => <tr key={i}><td>{String(s.src)}</td><td className="num">{Number(s.n)}</td><td className="num">{Number(s.conv)}</td></tr>)}
            </tbody></table>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Recent leads</h2><Link to="/admin/leads" className="small">All leads →</Link></div>
          {!d.recent.length ? <p className="muted">Enquiries from the website form will appear here.</p> : (
            <table className="table compact"><tbody>
              {d.recent.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => navigate({ to: '/admin/leads/$id', params: { id: String(r.id) } })}>
                  <td><strong>{r.first_name} {r.last_name}</strong><br /><span className="muted small">{r.email}</span></td>
                  <td><span className={`badge st-${r.status}`}>{r.status}</span></td>
                  <td className="muted small nowrap">{timeAgo(r.created_at, d.now)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Setup checklist</h2><span className="muted small">{done}/{d.check.length} done</span></div>
          <div className="progress"><div style={{ width: `${Math.round((done / d.check.length) * 100)}%` }}></div></div>
          <ul className="checklist">
            {d.check.map(([lbl, ok, href]) => <li key={lbl} className={ok ? 'done' : ''}><span className="ck">{ok ? '✓' : '○'}</span><Link to={href}>{lbl}</Link></li>)}
          </ul>
          <div className="quick">
            <Link className="btn btn-sm" to="/admin/content">📝 Edit content</Link>
            <Link className="btn btn-sm" to="/admin/campaigns">🎯 Build a campaign link</Link>
            <a className="btn btn-sm" href="/api/admin/leads-csv">⬇ Export leads</a>
          </div>
        </div>
      </div>
    </Page>
  )
}
