import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { ask, useAction } from '~/components/admin/flash'
import { Page, Pager } from '~/components/admin/ui'
import { bulkLeads, listLeads } from '~/fns/admin'
import { fmtDate, numberFormat, strLimit, ucfirst } from '~/lib/util'

type Search = { q?: string; status?: string; source?: string; interest?: string; from?: string; to?: string; page?: number }
const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined)

export const Route = createFileRoute('/admin/_panel/leads/')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: str(s.q), status: str(s.status), source: str(s.source), interest: str(s.interest), from: str(s.from), to: str(s.to),
    page: Number(s.page) > 1 ? Number(s.page) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listLeads({ data: deps }),
  component: Leads,
})

function Leads() {
  const d = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const run = useAction()
  const bulk = useServerFn(bulkLeads)
  const [f, setF] = useState({ q: search.q ?? '', source: search.source ?? '', interest: search.interest ?? '', from: search.from ?? '', to: search.to ?? '' })
  const [sel, setSel] = useState<number[]>([])
  const [bulkStatus, setBulkStatus] = useState(d.statuses[0] ?? 'new')
  useEffect(() => setSel([]), [d])
  const go = (over: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...over }) })
  const csvQs = new URLSearchParams(Object.entries({ q: search.q, status: search.status, source: search.source, interest: search.interest, from: search.from, to: search.to }).filter(([, v]) => v) as [string, string][]).toString()
  const allCount = Object.values(d.counts as Record<string, number>).reduce((a, b) => a + b, 0)
  return (
    <Page title="Leads" sub={`${numberFormat(d.total)} matching · enquiries from your website`}>
      <div className="status-chips">
        <Link to="/admin/leads" search={{ ...search, status: undefined, page: undefined }} className={`chip${!search.status ? ' active' : ''}`}>All <b>{allCount}</b></Link>
        {d.statuses.map((s) => (
          <Link key={s} to="/admin/leads" search={{ ...search, status: s, page: undefined }} className={`chip st-${s}${search.status === s ? ' active' : ''}`}>{ucfirst(s)} <b>{d.counts[s] ?? 0}</b></Link>
        ))}
      </div>

      <form className="card filters" onSubmit={(e) => { e.preventDefault(); go({ q: str(f.q), source: str(f.source), interest: str(f.interest), from: str(f.from), to: str(f.to), page: undefined }) }}>
        <input className="input" type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search name, email, phone, notes…" />
        <select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
          <option value="">All sources</option><option value="(direct)">(direct / organic)</option>
          {d.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })}>
          <option value="">All enquiry types</option>
          {d.interests.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title="From" />
        <input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title="To" />
        <button className="btn" type="submit">Filter</button>
        <Link className="btn btn-ghost" to="/admin/leads" onClick={() => setF({ q: '', source: '', interest: '', from: '', to: '' })}>Reset</Link>
        <a className="btn btn-primary" href={`/api/admin/leads-csv${csvQs ? '?' + csvQs : ''}`}>⬇ Export CSV</a>
      </form>

      <div className="card table-card">
        <div className={`bulk-bar${sel.length ? ' active' : ''}`}>
          <span className="muted small"><span id="sel-count">{sel.length}</span> selected</span>
          <select className="input input-sm" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>{d.statuses.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="btn btn-sm" type="button" onClick={() => run(() => bulk({ data: { ids: sel, action: 'status', status: bulkStatus } }))}>Set status</button>
          <button className="btn btn-sm btn-danger" type="button" onClick={() => { if (sel.length && ask('Delete the selected leads permanently?')) run(() => bulk({ data: { ids: sel, action: 'delete' } })) }}>Delete</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th className="cb"><input type="checkbox" checked={!!d.rows.length && sel.length === d.rows.length} onChange={(e) => setSel(e.target.checked ? d.rows.map((r) => Number(r.id)) : [])} /></th>
              <th>Name</th><th>Contact</th><th>Enquiry</th><th>Source</th><th>Status</th><th>Date</th>
            </tr></thead>
            <tbody>
              {!d.rows.length && <tr><td colSpan={7} className="empty">No leads found.</td></tr>}
              {d.rows.map((r) => {
                const id = Number(r.id)
                return (
                  <tr key={id}>
                    <td className="cb"><input type="checkbox" checked={sel.includes(id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, id] : x.filter((y) => y !== id)))} /></td>
                    <td><Link to="/admin/leads/$id" params={{ id: String(id) }}><strong>{r.first_name} {r.last_name}</strong></Link>{r.notes && <span title={strLimit(String(r.notes), 200)}> 📝</span>}</td>
                    <td>{r.email}<br /><span className="muted small">{r.phone}</span></td>
                    <td className="small"><strong>{r.interest || '—'}</strong>{r.message && <><br /><span className="muted">{strLimit(String(r.message), 70)}</span></>}</td>
                    <td className="small">{r.utm_source ? <>{r.utm_source}{r.utm_campaign && <><br /><span className="muted">{r.utm_campaign}</span></>}</> : <span className="muted">direct</span>}</td>
                    <td><span className={`badge st-${r.status}`}>{r.status}</span></td>
                    <td className="small nowrap" title={r.created_at}>{fmtDate(r.created_at, 'dM_hm')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={d.page} pages={d.pages} onGo={(p) => go({ page: p > 1 ? p : undefined })} />
    </Page>
  )
}
