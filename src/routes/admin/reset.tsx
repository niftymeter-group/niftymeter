import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { AuthCard } from '~/components/admin/AuthCard'
import { flash } from '~/components/admin/flash'
import { doReset, getAuthState, getResetInfo } from '~/fns/auth'

export const Route = createFileRoute('/admin/reset')({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === 'string' ? s.token : '' }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    const [st, info] = await Promise.all([getAuthState(), getResetInfo({ data: { token: deps.token } })])
    return { ...st, info, bodyClass: 'auth-body' }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `Set a new password · ${loaderData?.siteName ?? ''}` }, { name: 'referrer', content: 'no-referrer' }] }),
  component: Reset,
})

function Reset() {
  const d = Route.useLoaderData()
  const { token } = Route.useSearch()
  const save = useServerFn(doReset)
  const navigate = useNavigate()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState('')
  if (!d.info.valid) {
    return (
      <AuthCard logo={d.logo} siteName={d.siteName}>
        <h1>Link expired</h1>
        <p className="muted">This reset link is invalid, already used or expired. Request a new one.</p>
        <Link className="btn btn-primary btn-block" to="/admin/forgot">Request a new link</Link>
        <Link className="btn btn-ghost btn-block" to="/admin/login">← Back to sign in</Link>
      </AuthCard>
    )
  }
  return (
    <AuthCard logo={d.logo} siteName={d.siteName} onSubmit={async () => {
      setError('')
      const r = await save({ data: { token, password: p1, password2: p2 } })
      if (!r.ok) { setError(r.error); return }
      flash({ type: 'ok', text: 'Password updated. Sign in with your new password.' })
      navigate({ to: '/admin/login' })
    }}>
      <h1>Set a new password</h1>
      <p className="muted">For <strong>{d.info.email}</strong></p>
      {error && <div className="alert alert-err">{error}</div>}
      <div className="field"><label htmlFor="password">New password</label>
        <input className="input" type="password" id="password" minLength={d.pwMin} required autoComplete="new-password" autoFocus value={p1} onChange={(e) => setP1(e.target.value)} />
        <div className="help">At least {d.pwMin} characters{d.pwMix ? ', with letters and numbers' : ''}.</div></div>
      <div className="field"><label htmlFor="password2">Confirm new password</label>
        <input className="input" type="password" id="password2" minLength={d.pwMin} required autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
      <button className="btn btn-primary btn-block" type="submit">Save new password</button>
    </AuthCard>
  )
}
