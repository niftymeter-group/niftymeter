/** Sessions, admin authentication, lockouts, password policy and reset links. */
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import type { Settings } from '~/lib/defaults'
import { esc } from '~/lib/util'
import { ago, ahead, exec, fmtLocal, insert, now, one, T, val } from './db.server'
import { sendMail, type MailResult } from './mail.server'
import { clientIp, isHttps, siteUrl } from './request.server'
import { getSettings, on, str } from './settings.server'

export const SESSION_IDLE = 7200 // log out after 2 h of inactivity
export const MAX_ATTEMPTS = 5 // failed logins allowed…
export const LOCK_MINUTES = 15 // …per IP within this window
const COOKIE = 'nm_session'

export interface Admin { id: number; name: string; email: string; role: 'owner' | 'admin'; is_active: number }

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const randomHex = (n: number) => randomBytes(n).toString('hex')
const token = () => randomHex(32)

/* ─── passwords (bcrypt; hashes from the PHP version ($2y$) work too) ─── */
export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10)
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  if (!hash) return false
  try { return await bcrypt.compare(pw, hash.replace(/^\$2y\$/, '$2b$')) } catch { return false }
}
const DUMMY_HASH = '$2b$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG'

/** Validate a new admin password against the policy. Returns '' when OK. */
export function passwordProblem(S: Settings, pw: string): string {
  const min = Math.max(8, Math.min(64, Number(str(S, 'pw_min_length', '10')) || 10))
  const len = Array.from(pw).length
  if (len < min) return `Password must be at least ${min} characters.`
  if (len > 200) return 'Password is too long.'
  if (on(S, 'pw_require_mix') && (!/[A-Za-z]/.test(pw) || !/\d/.test(pw))) return 'Password must contain both letters and numbers.'
  if (['password123', 'admin12345', 'niftymeter1', '1234567890', 'qwerty12345'].includes(pw.toLowerCase())) return 'That password is too common.'
  return ''
}

/* ─── sessions ─── */
function cookieOpts() {
  return { httpOnly: true, secure: isHttps(), sameSite: 'lax' as const, path: '/' }
}

export async function startSession(adminId: number): Promise<void> {
  const t = token()
  await insert(T.sessions, { token_hash: sha256(t), admin_id: adminId, last_seen: Math.floor(Date.now() / 1000), ip: clientIp(), created_at: now() })
  setCookie(COOKIE, t, cookieOpts())
}

export async function endSession(): Promise<void> {
  const t = getCookie(COOKIE)
  if (t) await exec(`DELETE FROM ${T.sessions} WHERE token_hash = ?`, [sha256(t)])
  deleteCookie(COOKIE, cookieOpts())
}

/** End every session of an admin (after a password change), optionally keeping the current one. */
export async function endOtherSessions(adminId: number, keepCurrent: boolean): Promise<void> {
  const t = getCookie(COOKIE)
  if (keepCurrent && t) await exec(`DELETE FROM ${T.sessions} WHERE admin_id = ? AND token_hash <> ?`, [adminId, sha256(t)])
  else await exec(`DELETE FROM ${T.sessions} WHERE admin_id = ?`, [adminId])
}

export async function currentAdmin(): Promise<Admin | null> {
  let t: string | undefined
  try { t = getCookie(COOKIE) } catch { return null }
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null
  // one round trip: session + its admin
  const a = await one(
    `SELECT s.id sid, s.last_seen, a.id, a.name, a.email, a.role, a.is_active
     FROM ${T.sessions} s LEFT JOIN ${T.admins} a ON a.id = s.admin_id WHERE s.token_hash = ?`,
    [sha256(t)],
  )
  if (!a) return null
  const nowS = Math.floor(Date.now() / 1000)
  if (nowS - Number(a.last_seen) > SESSION_IDLE || a.id == null || Number(a.is_active) !== 1) {
    await exec(`DELETE FROM ${T.sessions} WHERE id = ?`, [a.sid])
    return null
  }
  if (nowS - Number(a.last_seen) > 300) await exec(`UPDATE ${T.sessions} SET last_seen = ? WHERE id = ?`, [nowS, a.sid])
  return { id: Number(a.id), name: String(a.name), email: String(a.email), role: a.role === 'owner' ? 'owner' : 'admin', is_active: 1 }
}

/* ─── login ─── */
export async function loginLocked(): Promise<boolean> {
  const n = Number(await val(`SELECT COUNT(*) FROM ${T.attempts} WHERE ip = ? AND attempted_at > ?`, [clientIp(), ago(LOCK_MINUTES * 60)]))
  return n >= MAX_ATTEMPTS
}

export async function adminLogin(email: string, password: string): Promise<boolean> {
  const row = await one(`SELECT * FROM ${T.admins} WHERE email = ? AND is_active = 1`, [email.trim().toLowerCase()])
  // Always run the hash check to keep timing similar for unknown emails
  const okHash = await verifyPassword(password, row ? String(row.password_hash) : DUMMY_HASH)
  if (!row || !okHash) {
    await insert(T.attempts, { ip: clientIp(), email: email.slice(0, 190), attempted_at: now() })
    return false
  }
  if (String(row.password_hash).startsWith('$2y$')) {
    await exec(`UPDATE ${T.admins} SET password_hash = ? WHERE id = ?`, [await hashPassword(password), row.id])
  }
  await startSession(Number(row.id))
  await exec(`UPDATE ${T.admins} SET last_login = ? WHERE id = ?`, [now(), row.id])
  await exec(`DELETE FROM ${T.attempts} WHERE ip = ?`, [clientIp()])
  await exec(`DELETE FROM ${T.attempts} WHERE attempted_at < ?`, [ago(86400)])
  await exec(`DELETE FROM ${T.sessions} WHERE last_seen < ?`, [Math.floor(Date.now() / 1000) - SESSION_IDLE])
  return true
}

/* ─── activity log ─── */
export async function logActivity(admin: Pick<Admin, 'id' | 'name'> | null, action: string, details = ''): Promise<void> {
  try {
    await insert(T.activity, {
      admin_id: admin?.id ?? null, admin_name: admin?.name ?? 'system', action: action.slice(0, 100),
      details: details.slice(0, 2000), ip: clientIp(), created_at: now(),
    })
  } catch { /* never break a request because of logging */ }
}

/* ─── password reset ─── */
export async function resetCreate(S: Settings, adminId: number, by = 'self'): Promise<string> {
  const t = token()
  const ttl = Math.max(10, Math.min(1440, Number(str(S, 'reset_ttl', '60')) || 60))
  await exec(`UPDATE ${T.resets} SET used_at = ? WHERE admin_id = ? AND used_at IS NULL`, [now(), adminId])
  await insert(T.resets, { admin_id: adminId, token_hash: sha256(t), requested_by: by.slice(0, 20), ip: clientIp(), expires_at: ahead(ttl * 60), created_at: now() })
  return t
}

export async function resetFind(t: string) {
  if (!/^[a-f0-9]{64}$/.test(t)) return null
  const r = await one(
    `SELECT r.id rid, r.expires_at, r.used_at, a.id, a.name, a.email, a.is_active FROM ${T.resets} r JOIN ${T.admins} a ON a.id = r.admin_id WHERE r.token_hash = ?`,
    [sha256(t)],
  )
  if (!r || r.used_at || String(r.expires_at) < fmtLocal(new Date()) || Number(r.is_active) !== 1) return null
  return { rid: Number(r.rid), id: Number(r.id), name: String(r.name), email: String(r.email) }
}

export async function resetSendEmail(admin: { name: string; email: string }, t: string, S?: Settings): Promise<MailResult> {
  S ??= await getSettings()
  const site = str(S, 'site_name')
  const link = siteUrl('admin/reset?token=' + t)
  const ttl = Math.max(10, Math.min(1440, Number(str(S, 'reset_ttl', '60')) || 60))
  const text = `Hi ${admin.name},\n\nWe received a request to reset the password for your ${site} admin account (${admin.email}).\n\n`
    + `Set a new password here (valid for ${ttl} minutes, one use only):\n${link}\n\n`
    + `If you didn't request this, you can ignore this email — your password won't change.\n\n— ${site}`
  const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1b2b28">'
    + `<div style="background:#0C322D;padding:18px 22px;border-radius:10px 10px 0 0"><strong style="color:#0FFFA1;font-size:18px">${esc(site)}</strong><span style="color:#cfe;font-size:13px"> · Admin</span></div>`
    + '<div style="border:1px solid #d5e2de;border-top:none;padding:22px;border-radius:0 0 10px 10px">'
    + `<p>Hi ${esc(admin.name)},</p><p>We received a request to reset the password for your admin account (<b>${esc(admin.email)}</b>).</p>`
    + `<p style="margin:26px 0"><a href="${esc(link)}" style="background:#0FFFA1;color:#05221E;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Set a new password</a></p>`
    + `<p style="font-size:13px;color:#5f6f6b">This link works once and expires in ${ttl} minutes. If you didn't request it, ignore this email — your password stays the same.</p>`
    + `<p style="font-size:12px;color:#8a9a96;word-break:break-all">${esc(link)}</p></div></div>`
  return sendMail(S, admin.email, `Reset your ${site} admin password`, text, '', html)
}
