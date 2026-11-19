import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { ask, flash, useAction } from '~/components/admin/flash'
import { Dl, Page } from '~/components/admin/ui'
import { deleteLead, getLead, updateLead } from '~/fns/admin'
import { fmtDate } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/leads/$id')({
  loader: ({ params }) => getLead({ data: { id: Number(params.id) } }),
  component: LeadView,
})

const ATTR: [string, string][] = [['utm_source', 'Source'], ['utm_medium', 'Medium'], ['utm_campaign', 'Campaign'], ['utm_term', 'Term'], ['utm_content', 'Ad / content'], ['gclid', 'Google click ID'], ['fbclid', 'Meta click ID'], ['referrer', 'Referrer'], ['landing_page', 'Landing page']]

function LeadView() {
  const { lead, statuses, siteName } = Route.useLoaderData()
  const navigate = useNavigate()
  const run = useAction()
  const save = useServerFn(updateLead)
  const del = useServerFn(deleteLead)
  const [f, setF] = useState(() => ({ first_name: '', last_name: '', phone: '', tv_email: '', status: 'new', notes: '' }))
  useEffect(() => {
    if (lead) setF({ first_name: lead.first_name ?? '', last_name: lead.last_name ?? '', phone: lead.phone ?? '', tv_email: lead.tv_email ?? '', status: lead.status ?? 'new', notes: lead.notes ?? '' })
  }, [lead])
  useEffect(() => { if (!lead) { flash({ type: 'err', text: 'Lead not found.' }); navigate({ to: '/admin/leads' }) } }, [lead, navigate])
  if (!lead) return null
  let wa = String(lead.phone ?? '').replace(/\D/g, '')
  if (wa.length === 10) wa = '91' + wa
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const waText = `Hi ${lead.first_name}, thanks for your ${siteName} enquiry${lead.interest ? ' about ' + lead.interest : ''}.`
  return (
    <Page title={`Lead #${lead.id}`} sub={<Link to="/admin/leads">← All leads</Link>}>
      <div className="grid-2">
        <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => save({ data: { id: Number(lead.id), ...f } })) }}>
          <div className="card-head"><h2>{lead.first_name} {lead.last_name}</h2><span className={`badge st-${lead.status}`}>{lead.status}</span></div>
          <div className="form-grid">
            <div className="field"><label>First name</label><input className="input" value={f.first_name} onChange={set('first_name')} /></div>
            <div className="field"><label>Last name</label><input className="input" value={f.last_name} onChange={set('last_name')} /></div>
            <div className="field"><label>Email</label><input className="input" value={lead.email} readOnly /></div>
            <div className="field"><label>WhatsApp</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
            <div className="field"><label>Interested in</label><input className="input" value={lead.interest || '—'} readOnly /></div>
            <div className="field"><label>TradingView email</label><input className="input" value={f.tv_email} onChange={set('tv_email')} /></div>
            {lead.message && <div className="field wide"><label>Their message</label><div className="enquiry-msg" style={{ whiteSpace: 'pre-line' }}>{lead.message}</div></div>}
            <div className="field"><label>Status</label><select className="input" value={f.status} onChange={set('status')}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field wide"><label>Internal notes</label><textarea className="input" rows={5} value={f.notes} onChange={set('notes')} placeholder="e.g. Invite sent on TradingView 12 Oct, follow up on day 6" /></div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary">💾 Save lead</button>
            <a className="btn" href={`mailto:${lead.email}`}>✉ Email</a>
            {wa && <a className="btn" target="_blank" rel="noopener" href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`}>💬 WhatsApp</a>}
          </div>
        </form>
        <div>
          <div className="card">
            <div className="card-head"><h2>Attribution</h2></div>
            <Dl items={ATTR.map(([k, l]) => [l, lead[k] ?? ''])} />
          </div>
          <div className="card">
            <div className="card-head"><h2>Technical</h2></div>
            <Dl items={[['Submitted', fmtDate(lead.created_at)], ['Updated', fmtDate(lead.updated_at)], ['IP', lead.ip ?? ''], ['Device', <span className="small">{lead.user_agent}</span>]]} />
            <button className="btn btn-sm btn-danger" type="button" onClick={async () => {
              if (!ask('Delete this lead permanently?')) return
              const r = await run(() => del({ data: { id: Number(lead.id) } }), { invalidate: false })
              if (r) navigate({ to: '/admin/leads' })
            }}>Delete lead</button>
          </div>
        </div>
      </div>
    </Page>
  )
}
