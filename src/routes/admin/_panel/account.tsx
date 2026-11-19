import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { getSecurity, updateProfile } from '~/fns/admin'
import { PasswordChange } from '~/components/admin/PasswordChange'

export const Route = createFileRoute('/admin/_panel/account')({
  loader: () => getSecurity(),
  component: Account,
})

function Account() {
  const d = Route.useLoaderData()
  const run = useAction()
  const save = useServerFn(updateProfile)
  const [f, setF] = useState({ name: d.me.name, email: d.me.email, current: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Page title="My Account" sub="Your profile and password.">
      <div className="grid-2">
        <form className="card settings-form" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => save({ data: f })); if (r) setF((x) => ({ ...x, current: '' })) }}>
          <div className="card-head"><h2>Profile</h2></div>
          <div className="field"><label>Name</label><input className="input" value={f.name} onChange={set('name')} required /></div>
          <div className="field"><label>Login email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
          <div className="field"><label>Current password (to confirm)</label><input className="input" type="password" value={f.current} onChange={set('current')} required autoComplete="current-password" /></div>
          <div className="form-actions"><button className="btn btn-primary">Save profile</button></div>
        </form>
        <PasswordChange email={d.me.email} pwMin={d.pwMin} pwMix={d.pwMix} />
      </div>
    </Page>
  )
}
