import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ask, useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { listUsers, userAction } from '~/fns/admin'
import { timeAgo } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/users')({
  loader: () => listUsers(),
  component: Users,
})

function Users() {
  const d = Route.useLoaderData()
  const run = useAction()
  const act = useServerFn(userAction)
  const owner = d.me.role === 'owner'
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'admin' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const doAct = (action: 'toggle' | 'role' | 'reset' | 'link' | 'delete', id: number, password?: string) => run(() => act({ data: { action, id, password } }))
  return (
    <Page title="Admin Users" sub={<>Give team members their own login. <strong>Owners</strong> can manage users &amp; custom code; <strong>admins</strong> can manage everything else.</>}>
      <div className="card table-card"><div className="table-wrap"><table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th>{owner && <th>Actions</th>}</tr></thead>
        <tbody>
          {d.users.map((u) => {
            const id = Number(u.id)
            const me = id === d.me.id
            return (
              <tr key={id}>
                <td><strong>{u.name}</strong>{me && <span className="muted small"> (you)</span>}</td>
                <td>{u.email}</td>
                <td><span className={`badge${u.role === 'owner' ? ' st-converted' : ''}`}>{u.role}</span></td>
                <td>{Number(u.is_active) ? <span className="badge st-invited">active</span> : <span className="badge st-rejected">disabled</span>}</td>
                <td className="small">{u.last_login ? timeAgo(u.last_login, d.now) : <span className="muted">never</span>}</td>
                {owner && (
                  <td className="actions">
                    {me ? <Link className="btn btn-sm btn-ghost" to="/admin/account">My account</Link> : (
                      <>
                        <button className="btn btn-sm" onClick={() => doAct('toggle', id)}>{Number(u.is_active) ? 'Disable' : 'Enable'}</button>
                        <button className="btn btn-sm" onClick={() => doAct('role', id)}>Make {u.role === 'owner' ? 'admin' : 'owner'}</button>
                        <button className="btn btn-sm" onClick={() => { const p = window.prompt(`New password for ${u.email} (follow the password policy):`); if (p) doAct('reset', id, p) }}>Set password</button>
                        <button className="btn btn-sm" onClick={() => doAct('link', id)}>✉ Email reset link</button>
                        <button className="btn btn-sm btn-danger" onClick={() => { if (ask('Remove this admin?')) doAct('delete', id) }}>Remove</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table></div></div>
      {owner && (
        <form className="card settings-form" autoComplete="off" onSubmit={async (e) => {
          e.preventDefault()
          const r = await run(() => act({ data: { action: 'add', ...f } }))
          if (r && r.msgs?.every((m) => m.type === 'ok')) setF({ name: '', email: '', password: '', role: 'admin' })
        }}>
          <div className="card-head"><h2>Add admin</h2></div>
          <div className="form-grid">
            <div className="field"><label>Name</label><input className="input" value={f.name} onChange={set('name')} required /></div>
            <div className="field"><label>Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
            <div className="field"><label>Temporary password</label><input className="input" type="text" minLength={d.pwMin} value={f.password} onChange={set('password')} required autoComplete="new-password" />
              <div className="help">They can change it in Password &amp; Security, or you can email them a reset link after adding.</div></div>
            <div className="field"><label>Role</label><select className="input" value={f.role} onChange={set('role')}><option value="admin">Admin</option><option value="owner">Owner</option></select></div>
          </div>
          <div className="form-actions"><button className="btn btn-primary">+ Add admin</button></div>
        </form>
      )}
    </Page>
  )
}
