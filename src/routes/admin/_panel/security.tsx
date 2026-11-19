import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ask, useAction } from '~/components/admin/flash'
import { PasswordChange } from '~/components/admin/PasswordChange'
import { Page, SettingsForm } from '~/components/admin/ui'
import { getAdminSettings, getSecurity, securityAction } from '~/fns/admin'
import { POLICY_FIELDS } from '~/lib/schemas'
import { parseDt, timeAgo } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/security')({
  loader: async () => ({ sec: await getSecurity(), cfg: await getAdminSettings() }),
  component: Security,
})

function Security() {
  const { sec: d, cfg } = Route.useLoaderData()
  const run = useAction()
  const act = useServerFn(securityAction)
  const nowMs = parseDt(d.now)
  return (
    <Page title="Password & Security" sub="Change passwords, send reset links and control sign-in security.">
      {(!d.mailReady || d.driver !== 'resend') && (
        <div className="alert alert-warn">✉ Password-reset emails use <strong>{d.driver === 'resend' ? 'Resend (no API key yet)' : d.driver === 'none' ? 'nothing (email is switched off)' : 'SMTP'}</strong>. For reliable delivery add a Resend API key in <Link to="/admin/integrations">Email &amp; Integrations</Link>.</div>
      )}
      <div className="grid-2">
        <PasswordChange email={d.me.email} pwMin={d.pwMin} pwMix={d.pwMix} />
        {d.isOwner && (
          <div>
            <SettingsForm group="policy" fields={POLICY_FIELDS} S={cfg.S} submit="Save policy" viewSite={false}
              before={<div className="card-head"><h2>📏 Password policy</h2></div>} />
            <p className="help">Applies to new passwords, resets and new admins. Sign-in locks for {d.lockMinutes} minutes after {d.maxAttempts} wrong attempts from the same IP.</p>
          </div>
        )}
      </div>
      {d.isOwner && (
        <>
          <div className="card table-card">
            <div className="card-head" style={{ padding: '16px 18px 0' }}><h2>👥 Admin passwords</h2><Link className="small" to="/admin/users">Manage admins →</Link></div>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Admin</th><th>Role</th><th>Last sign-in</th><th>Reset</th></tr></thead>
              <tbody>{d.admins.map((u) => (
                <tr key={u.id}><td><strong>{u.name}</strong><br /><span className="muted small">{u.email}</span></td>
                  <td><span className={`badge${u.role === 'owner' ? ' st-converted' : ''}`}>{u.role}</span>{!Number(u.is_active) && <> <span className="badge st-rejected">disabled</span></>}</td>
                  <td className="small">{u.last_login ? timeAgo(u.last_login, d.now) : <span className="muted">never</span>}</td>
                  <td>{Number(u.is_active) ? <button className="btn btn-sm" onClick={() => { if (ask(`Email a password-reset link to ${u.email}?`)) run(() => act({ data: { action: 'send_link', id: Number(u.id) } })) }}>✉ Send reset link</button> : null}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-head"><h2>Failed sign-ins</h2>
                <button className="btn btn-sm" onClick={() => { if (ask('Clear all failed sign-in attempts and lockouts?')) run(() => act({ data: { action: 'unlock' } })) }}>Unlock sign-in</button></div>
              {!d.fails.length ? <p className="muted">No failed attempts in the last 24 hours.</p> : (
                <table className="table compact"><thead><tr><th>When</th><th>Email tried</th><th>IP</th></tr></thead><tbody>
                  {d.fails.map((f, i) => <tr key={i}><td className="small nowrap">{timeAgo(f.attempted_at, d.now)}</td><td className="small">{f.email}</td><td className="small muted">{f.ip}</td></tr>)}
                </tbody></table>
              )}
            </div>
            <div className="card">
              <div className="card-head"><h2>Reset links</h2>
                <button className="btn btn-sm" onClick={() => { if (ask('Revoke all unused reset links?')) run(() => act({ data: { action: 'revoke' } })) }}>Revoke unused</button></div>
              {!d.resets.length ? <p className="muted">No reset links requested yet.</p> : (
                <table className="table compact"><thead><tr><th>Requested</th><th>Admin</th><th>By</th><th>Status</th></tr></thead><tbody>
                  {d.resets.map((r, i) => {
                    const stt = r.used_at ? (parseDt(r.used_at) <= parseDt(r.expires_at) ? 'used / revoked' : 'used') : parseDt(r.expires_at) < nowMs ? 'expired' : 'active'
                    return <tr key={i}><td className="small nowrap">{timeAgo(r.created_at, d.now)}</td><td className="small">{r.email}</td><td className="small">{r.requested_by}</td><td><span className={`badge${stt === 'active' ? ' st-contacted' : ''}`}>{stt}</span></td></tr>
                  })}
                </tbody></table>
              )}
            </div>
          </div>
        </>
      )}
    </Page>
  )
}
