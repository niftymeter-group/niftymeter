import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { AuthCard } from '~/components/admin/AuthCard'
import { forgotPassword, getAuthState } from '~/fns/auth'

export const Route = createFileRoute('/admin/forgot')({
  beforeLoad: async () => {
    const st = await getAuthState()
    if (st.admin) throw redirect({ to: '/admin' })
    return { st }
  },
  loader: ({ context }) => ({ ...context.st, bodyClass: 'auth-body' }),
  head: ({ loaderData }) => ({ meta: [{ title: `Forgot password · ${loaderData?.siteName ?? ''}` }] }),
  component: Forgot,
})

function Forgot() {
  const d = Route.useLoaderData()
  const send = useServerFn(forgotPassword)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (sent) {
    return (
      <AuthCard logo={d.logo} siteName={d.siteName}>
        <h1>Check your email</h1>
        <p className="muted">If an admin account exists for that address, we've sent a link to reset the password. It expires in {d.resetTtl} minutes. Check your spam folder too.</p>
        <Link className="btn btn-primary btn-block" to="/admin/login">← Back to sign in</Link>
      </AuthCard>
    )
  }
  return (
    <AuthCard logo={d.logo} siteName={d.siteName} onSubmit={async () => {
      setBusy(true); setError('')
      try { const r = await send({ data: { email } }); if (r.ok) setSent(true); else setError(r.error) } catch (e: any) { setError(e?.message || 'Failed.') } finally { setBusy(false) }
    }}>
      <h1>Forgot your password?</h1>
      <p className="muted">Enter your admin email and we'll send you a link to set a new password.</p>
      {error && <div className="alert alert-err">{error}</div>}
      <div className="field"><label htmlFor="email">Admin email</label><input className="input" type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" /></div>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>Send reset link</button>
      <Link className="btn btn-ghost btn-block" to="/admin/login">← Back to sign in</Link>
    </AuthCard>
  )
}
