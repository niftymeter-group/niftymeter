/** First-run setup — creates the owner account (replaces install.php). Locked once any admin exists. */
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { AuthCard } from '~/components/admin/AuthCard'
import { createOwner, getAuthState } from '~/fns/auth'

export const Route = createFileRoute('/admin/setup')({
  beforeLoad: async () => {
    const st = await getAuthState()
    if (st.hasAdmins) throw redirect({ to: st.admin ? '/admin' : '/admin/login' })
    return { st }
  },
  loader: ({ context }) => ({ ...context.st, bodyClass: 'auth-body' }),
  head: () => ({ meta: [{ title: 'Set up NiftyMeter' }] }),
  component: Setup,
})

function Setup() {
  const d = Route.useLoaderData()
  const create = useServerFn(createOwner)
  const navigate = useNavigate()
  const [f, setF] = useState({ name: '', email: '', password: '', password2: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <AuthCard logo={d.logo} siteName={d.siteName} onSubmit={async () => {
      setBusy(true); setError('')
      try { const r = await create({ data: f }); if (r.ok) navigate({ to: '/admin' }); else setError(r.error) } catch (e: any) { setError(e?.message || 'Setup failed.') } finally { setBusy(false) }
    }}>
      <h1>Welcome — create your owner account</h1>
      <p className="muted">The database is ready. Create the first admin (owner) account to start managing your website. This page locks itself once an account exists.</p>
      {error && <div className="alert alert-err">{error}</div>}
      <div className="field"><label>Your name</label><input className="input" value={f.name} onChange={set('name')} required /></div>
      <div className="field"><label>Email (used to log in)</label><input className="input" type="email" value={f.email} onChange={set('email')} required autoComplete="username" /></div>
      <div className="field"><label>Password (min 8 chars)</label><input className="input" type="password" minLength={8} value={f.password} onChange={set('password')} required autoComplete="new-password" /></div>
      <div className="field"><label>Confirm password</label><input className="input" type="password" minLength={8} value={f.password2} onChange={set('password2')} required autoComplete="new-password" /></div>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create owner account →'}</button>
    </AuthCard>
  )
}
