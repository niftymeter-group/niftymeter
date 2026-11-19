import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { AuthCard } from '~/components/admin/AuthCard'
import { Alerts } from '~/components/admin/flash'
import { getAuthState, login } from '~/fns/auth'

const safeNext = (n: unknown) => (typeof n === 'string' && /^\/admin(\/[a-z0-9/_-]*)?(\?[^\r\n]*)?$/i.test(n) && !n.includes('//') ? n : '/admin')

export const Route = createFileRoute('/admin/login')({
  validateSearch: (s: Record<string, unknown>) => ({ next: typeof s.next === 'string' ? s.next : undefined }),
  beforeLoad: async () => {
    const st = await getAuthState()
    if (st.admin) throw redirect({ to: '/admin' })
    if (!st.hasAdmins) throw redirect({ to: '/admin/setup' })
    return { st }
  },
  loader: ({ context }) => ({ ...context.st, bodyClass: 'auth-body' }),
  head: ({ loaderData }) => ({ meta: [{ title: `Admin login · ${loaderData?.siteName ?? ''}` }] }),
  component: Login,
})

function Login() {
  const d = Route.useLoaderData()
  const { next } = Route.useSearch()
  const doLogin = useServerFn(login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <AuthCard logo={d.logo} siteName={d.siteName} onSubmit={async () => {
      setBusy(true); setError('')
      try {
        const r = await doLogin({ data: { email, password } })
        if (r.ok) { navigate({ href: safeNext(next) }); return }
        setError(r.error)
      } catch (e: any) { setError(e?.message || 'Sign-in failed.') } finally { setBusy(false) }
    }}>
      <h1>Admin sign in</h1>
      <p className="muted">Manage your website, leads and campaigns.</p>
      <Alerts />
      {error && <div className="alert alert-err">{error}</div>}
      <div className="field"><label htmlFor="email">Email</label><input className="input" type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="username" /></div>
      <div className="field"><label htmlFor="password" className="pw-label">Password <Link to="/admin/forgot" className="forgot-link">Forgot password?</Link></label>
        <input className="input" type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button>
    </AuthCard>
  )
}
