import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { changeMyPassword } from '~/fns/admin'
import { useAction } from './flash'

export function PasswordChange({ email, pwMin, pwMix }: { email: string; pwMin: number; pwMix: boolean }) {
  const run = useAction()
  const change = useServerFn(changeMyPassword)
  const [f, setF] = useState({ current: '', next: '', next2: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <form className="card settings-form" onSubmit={async (e) => {
      e.preventDefault()
      const r = await run(() => change({ data: f }), { invalidate: false })
      if (r && r.msgs?.every((m) => m.type === 'ok')) setF({ current: '', next: '', next2: '' })
    }}>
      <div className="card-head"><h2>🔐 Change my password</h2><span className="muted small">{email}</span></div>
      <div className="field"><label>Current password</label><input className="input" type="password" value={f.current} onChange={set('current')} required autoComplete="current-password" /></div>
      <div className="field"><label>New password</label><input className="input" type="password" minLength={pwMin} value={f.next} onChange={set('next')} required autoComplete="new-password" />
        <div className="help">At least {pwMin} characters{pwMix ? ', letters and numbers' : ''}. A long passphrase is best.</div></div>
      <div className="field"><label>Confirm new password</label><input className="input" type="password" minLength={pwMin} value={f.next2} onChange={set('next2')} required autoComplete="new-password" /></div>
      <div className="form-actions"><button className="btn btn-primary">Change password</button></div>
    </form>
  )
}

