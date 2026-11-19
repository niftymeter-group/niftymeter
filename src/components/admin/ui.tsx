/** Admin UI pieces: layout shell, settings form, banner card, small helpers. */
import { Link, getRouteApi, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { logout } from '~/fns/auth'
import { saveGroup, setBanner } from '~/fns/admin'
import type { Settings } from '~/lib/defaults'
import type { Field } from '~/lib/schemas'
import { assetUrl } from '~/lib/util'
import { FieldList, stripKeys, useFieldState } from './Fields'
import { Alerts, Toast, useAction } from './flash'

export const NAV: [string, [string, string, string][]][] = [
  ['Overview', [['/admin', '📊', 'Dashboard'], ['/admin/leads', '👥', 'Leads']]],
  ['Website', [['/admin/content', '📝', 'Content'], ['/admin/offer', '💳', 'Pricing & Broker'], ['/admin/links', '🔗', 'Links & Social'], ['/admin/branding', '🎨', 'Branding & Theme'], ['/admin/sections', '🧩', 'Sections & Popup']]],
  ['Growth', [['/admin/marketing', '📣', 'Ads & Tracking'], ['/admin/campaigns', '🎯', 'Campaigns & UTM'], ['/admin/seo', '🔍', 'SEO & Meta'], ['/admin/integrations', '✉️', 'Email & Integrations']]],
  ['AI Assistant', [['/admin/ai', '🤖', 'Chat Assistant'], ['/admin/kb', '📚', 'Knowledge Base'], ['/admin/chats', '💬', 'Chat Logs']]],
  ['Platform', [['/admin/settings', '⚙️', 'Site Settings'], ['/admin/users', '👥', 'Admin Users'], ['/admin/security', '🔐', 'Password & Security'], ['/admin/activity', '🕘', 'Activity Log'], ['/admin/backup', '💾', 'Backup & Restore']]],
]

export interface ShellData {
  admin: { id: number; name: string; email: string; role: string }
  newLeads: number
  siteName: string
  logo: string
  maintenance: boolean
}

export function AdminShell({ shell, children }: { shell: ShellData; children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/+$/, '') || '/' })
  const navigate = useNavigate()
  const router = useRouter()
  const doLogout = useServerFn(logout)
  const [open, setOpen] = useState(false)
  useEffect(() => { document.body.classList.toggle('sb-open', open) }, [open])
  useEffect(() => setOpen(false), [path])
  const isActive = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'))
  return (
    <>
      <aside className="sidebar" id="sidebar">
        <Link className="sb-logo" to="/admin"><img src={assetUrl(shell.logo)} alt={shell.siteName} /></Link>
        <nav className="sb-nav">
          {NAV.map(([group, items]) => (
            <div key={group}>
              <div className="sb-group">{group}</div>
              {items.map(([href, ic, lbl]) => (
                <Link key={href} to={href} className={isActive(href) ? 'active' : ''}>
                  <span className="ic">{ic}</span>{lbl}
                  {href === '/admin/leads' && shell.newLeads > 0 && <span className="pill">{shell.newLeads}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sb-foot">
          <Link to="/admin/account" className="sb-user">
            <span className="avatar">{Array.from(shell.admin.name)[0]?.toUpperCase()}</span>
            <span><strong>{shell.admin.name}</strong><small>{shell.admin.role[0]!.toUpperCase() + shell.admin.role.slice(1)}</small></span>
          </Link>
          <button className="btn btn-sm btn-ghost btn-block" type="button" onClick={async () => { await doLogout(); router.clearCache(); navigate({ to: '/admin/login' }) }}>Log out</button>
        </div>
      </aside>
      <div className="sb-backdrop" onClick={() => setOpen(false)}></div>
      <main className="main">{children}
        <footer className="admin-foot">{shell.siteName} Admin · v2.0.0</footer>
      </main>
      <Toast />
    </>
  )
}

/** Page header (title, subtitle, view-site) + global alerts. */
const panelApi = getRouteApi('/admin/_panel')

export function Page({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  const maintenance = panelApi.useLoaderData({ select: (d) => d.maintenance })
  useEffect(() => { document.title = `${title} · Admin` }, [title])
  return (
    <>
      <header className="topbar">
        <button className="burger" onClick={() => document.body.classList.toggle('sb-open')} aria-label="Menu">☰</button>
        <div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
        <a className="btn btn-sm btn-ghost view-site" href="/" target="_blank" rel="noopener">View site ↗</a>
      </header>
      {maintenance && <div className="alert alert-warn">🔧 Maintenance mode is <strong>ON</strong> — visitors see the maintenance page. <Link to="/admin/settings">Change</Link></div>}
      <Alerts />
      {children}
    </>
  )
}

/** Standard settings page form. */
export function SettingsForm({ group, fields, S, submit = 'Save changes', viewSite = '/', children, before }: {
  group: string; fields: Field[]; S: Settings; submit?: string; viewSite?: string | false; children?: ReactNode; before?: ReactNode
}) {
  const st = useFieldState(fields, S)
  const save = useServerFn(saveGroup)
  const run = useAction()
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!st.dirty) st.reset(S) }, [S]) // eslint-disable-line react-hooks/exhaustive-deps
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await run(() => save({ data: { group, values: stripKeys(st.values) } }))
    setBusy(false)
    if (r) st.setDirty(false)
  }
  return (
    <form className="card settings-form" onSubmit={onSubmit}>
      {before}
      <div className="form-grid">
        <FieldList fields={fields} values={st.values} set={st.set} />
        {children}
      </div>
      <div className="form-actions sticky-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : '💾 ' + submit}</button>
        {viewSite && <a className="btn btn-ghost" href={viewSite} target="_blank" rel="noopener">View site ↗</a>}
        {st.dirty && <span className="muted small">Unsaved changes</span>}
      </div>
    </form>
  )
}

const BANNER_CLS: Record<string, string> = { live: 'st-converted', ended_msg: 'st-contacted', scheduled: 'st-contacted', ended: 'st-rejected', off: 'st-rejected' }
const BANNER_TXT: Record<string, string> = { live: 'Live', ended_msg: 'Ended (message shown)', scheduled: 'Scheduled', ended: 'Ended (hidden)', off: 'Off' }

/** Launch offer banner status + on/off switch. */
export function BannerCard({ banner, isOn, msg, editLink = true }: { banner: { state: string; label: string }; isOn: boolean; msg: string; editLink?: boolean }) {
  const run = useAction()
  const toggle = useServerFn(setBanner)
  return (
    <div className="card banner-card">
      <div className="banner-card-row">
        <div className="banner-card-info">
          <div className="card-head" style={{ margin: '0 0 4px' }}><h2>🔥 Launch offer banner</h2> <span className={`badge ${BANNER_CLS[banner.state]}`}>{BANNER_TXT[banner.state]}</span></div>
          <div className="muted small">{banner.label}</div>
          {(isOn || banner.state !== 'off') && <div className="small" style={{ marginTop: 6 }}>“{msg}”</div>}
        </div>
        <div className="banner-card-actions">
          <button type="button" className={`btn ${isOn ? 'btn-danger' : 'btn-primary'}`} onClick={() => run(() => toggle({ data: { on: !isOn } }))}>{isOn ? '⏸ Turn banner off' : '▶ Turn banner on'}</button>
          {editLink && <Link className="btn btn-ghost" to="/admin/content" search={{ tab: 'banner' }}>Edit text &amp; dates</Link>}
        </div>
      </div>
    </div>
  )
}

export function Pager({ page, pages, onGo, prev = '← Prev', next = 'Next →' }: { page: number; pages: number; onGo: (p: number) => void; prev?: string; next?: string }) {
  if (pages <= 1) return null
  return (
    <div className="pager">
      {page > 1 && <button className="btn btn-sm" onClick={() => onGo(page - 1)}>{prev}</button>}
      <span className="muted small">Page {page} of {pages}</span>
      {page < pages && <button className="btn btn-sm" onClick={() => onGo(page + 1)}>{next}</button>}
    </div>
  )
}

export function StatusItem({ on, name, children }: { on: boolean; name: string; children: ReactNode }) {
  return <div className={`status-item${on ? ' on' : ''}`}><span className="dot"></span><div><strong>{name}</strong><small>{children}</small></div></div>
}

/** Owner-only secret (API key) form. */
export function SecretForm({ title, masked, placeholder, help, onSave, label = 'New API key', saveText = 'Save key', clearConfirm }: {
  title: string; masked: string; placeholder: string; help: ReactNode; onSave: (v: string, clear: boolean) => Promise<unknown>; label?: string; saveText?: string; clearConfirm: string
}) {
  const [v, setV] = useState('')
  return (
    <form className="card settings-form" autoComplete="off" onSubmit={async (e) => { e.preventDefault(); await onSave(v, false); setV('') }}>
      <div className="card-head"><h2>{title}</h2>{masked && <code>{masked}</code>}</div>
      <div className="form-grid">
        <div className="field wide"><label>{label}</label>
          <input className="input mono" type="password" value={v} onChange={(e) => setV(e.target.value)} placeholder={masked ? 'Leave blank to keep the current key' : placeholder} autoComplete="new-password" />
          <div className="help">{help}</div></div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit">{saveText}</button>
        {masked && <button className="btn btn-danger" type="button" onClick={() => { if (window.confirm(clearConfirm)) onSave('', true) }}>Remove key</button>}
      </div>
    </form>
  )
}

/** Definition list from [label, value] pairs. */
export function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="dl">
      {items.map(([k, v], i) => (
        <Fragment key={i}><dt>{k}</dt><dd>{v === '' || v == null ? <span className="muted">—</span> : v}</dd></Fragment>
      ))}
    </dl>
  )
}
