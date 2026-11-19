import { createServerFn } from '@tanstack/react-start'
import {
  LOCK_MINUTES, adminLogin, currentAdmin, endOtherSessions, endSession, hashPassword, logActivity, loginLocked,
  passwordProblem, randomHex, resetCreate, resetFind, resetSendEmail, sha256, startSession,
} from '~/server/auth.server'
import { ago, exec, insert, now, one, T, val } from '~/server/db.server'
import { sendMail } from '~/server/mail.server'
import { clientIp } from '~/server/request.server'
import { getSettings, on, str } from '~/server/settings.server'

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

/** Branding + session state for the auth screens and the admin shell. */
export const getAuthState = createServerFn({ method: 'GET' }).handler(async () => {
  const S = await getSettings()
  const admin = await currentAdmin()
  const hasAdmins = Number(await val(`SELECT COUNT(*) FROM ${T.admins}`)) > 0
  const min = Math.max(8, Number(str(S, 'pw_min_length', '10')) || 10)
  return {
    admin,
    hasAdmins,
    siteName: str(S, 'site_name'),
    logo: str(S, 'logo') || 'assets/img/logo.png',
    favicon: str(S, 'favicon') || 'assets/img/favicon.png',
    pwMin: min,
    pwMix: on(S, 'pw_require_mix'),
    resetTtl: Number(str(S, 'reset_ttl', '60')) || 60,
  }
})

export const login = createServerFn({ method: 'POST' })
  .validator((d: { email: string; password: string }) => ({ email: String(d?.email ?? ''), password: String(d?.password ?? '') }))
  .handler(async ({ data }) => {
    if (await loginLocked()) return { ok: false, error: `Too many failed attempts. Please wait ${LOCK_MINUTES} minutes and try again.` }
    if (await adminLogin(data.email, data.password)) {
      const a = await one(`SELECT id, name FROM ${T.admins} WHERE email = ?`, [data.email.trim().toLowerCase()])
      await logActivity(a ? { id: Number(a.id), name: String(a.name) } : null, 'login', 'Signed in')
      return { ok: true, error: '' }
    }
    return { ok: false, error: 'Incorrect email or password.' }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const a = await currentAdmin()
  if (a) await logActivity(a, 'logout', 'Signed out')
  await endSession()
  return { ok: true }
})

/** First-run setup: create the owner account (only while no admin exists). Replaces install.php. */
export const createOwner = createServerFn({ method: 'POST' })
  .validator((d: { name: string; email: string; password: string; password2: string }) => d)
  .handler(async ({ data }) => {
    if (Number(await val(`SELECT COUNT(*) FROM ${T.admins}`)) > 0) return { ok: false, error: 'Setup is already complete. Please sign in.' }
    const name = String(data.name ?? '').trim()
    const email = String(data.email ?? '').trim().toLowerCase()
    const pw = String(data.password ?? '')
    if (!name) return { ok: false, error: 'Your name is required.' }
    if (!isEmail(email)) return { ok: false, error: 'Enter a valid email.' }
    if (pw.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
    if (pw !== String(data.password2 ?? '')) return { ok: false, error: 'Passwords do not match.' }
    const id = await insert(T.admins, { name: name.slice(0, 100), email, password_hash: await hashPassword(pw), role: 'owner', is_active: 1, created_at: now() })
    await startSession(id)
    await exec(`UPDATE ${T.admins} SET last_login = ? WHERE id = ?`, [now(), id])
    await logActivity({ id, name }, 'setup', 'Owner account created')
    return { ok: true, error: '' }
  })

export const forgotPassword = createServerFn({ method: 'POST' })
  .validator((d: { email: string }) => ({ email: String(d?.email ?? '').trim().toLowerCase() }))
  .handler(async ({ data }) => {
    if (!isEmail(data.email)) return { ok: false, error: 'Please enter a valid email address.' }
    const since = ago(900)
    const byIp = Number(await val(`SELECT COUNT(*) FROM ${T.resets} WHERE ip = ? AND created_at > ?`, [clientIp(), since]))
    if (byIp >= 5) return { ok: false, error: 'Too many reset requests. Please wait 15 minutes and try again.' }
    const S = await getSettings()
    const admin = await one(`SELECT id, name, email FROM ${T.admins} WHERE email = ? AND is_active = 1`, [data.email])
    if (admin) {
      const recent = Number(await val(`SELECT COUNT(*) FROM ${T.resets} WHERE admin_id = ? AND created_at > ?`, [admin.id, since]))
      if (recent < 3) {
        const t = await resetCreate(S, Number(admin.id), 'self')
        const r = await resetSendEmail({ name: String(admin.name), email: String(admin.email) }, t, S)
        await logActivity({ id: Number(admin.id), name: String(admin.name) }, 'password.reset_requested', admin.email + (r.ok ? ' · email sent' : ' · email FAILED: ' + r.error))
      }
    } else {
      // record the attempt for rate-limiting without revealing whether the account exists
      await insert(T.resets, { admin_id: 0, token_hash: sha256(randomHex(16)), requested_by: 'unknown', ip: clientIp(), expires_at: now(), used_at: now(), created_at: now() })
    }
    return { ok: true, error: '' } // same message either way (no account enumeration)
  })

export const getResetInfo = createServerFn({ method: 'GET' })
  .validator((d: { token: string }) => ({ token: String(d?.token ?? '') }))
  .handler(async ({ data }) => {
    const r = await resetFind(data.token)
    return r ? { valid: true, email: r.email } : { valid: false, email: '' }
  })

export const doReset = createServerFn({ method: 'POST' })
  .validator((d: { token: string; password: string; password2: string }) => d)
  .handler(async ({ data }) => {
    const reset = await resetFind(String(data.token ?? ''))
    if (!reset) return { ok: false, error: 'This reset link is invalid, already used or expired.' }
    const S = await getSettings()
    const p1 = String(data.password ?? '')
    const err = passwordProblem(S, p1)
    if (err) return { ok: false, error: err }
    if (p1 !== String(data.password2 ?? '')) return { ok: false, error: 'The passwords do not match.' }
    await exec(`UPDATE ${T.admins} SET password_hash = ? WHERE id = ?`, [await hashPassword(p1), reset.id])
    await exec(`UPDATE ${T.resets} SET used_at = ? WHERE admin_id = ? AND used_at IS NULL`, [now(), reset.id])
    await exec(`DELETE FROM ${T.attempts} WHERE email = ?`, [reset.email])
    await endOtherSessions(reset.id, false)
    await logActivity({ id: reset.id, name: reset.name }, 'password.reset_done', 'Password changed with reset link')
    await sendMail(S, reset.email, `Your ${str(S, 'site_name')} admin password was changed`,
      `Hi ${reset.name},\n\nThe password for your ${str(S, 'site_name')} admin account was just changed.\nIf this wasn't you, contact the site owner immediately.\n`)
    return { ok: true, error: '' }
  })
