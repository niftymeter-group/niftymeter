#!/usr/bin/env node
/**
 * EMERGENCY PASSWORD RESET (replaces tools/reset-admin-password.php)
 *   npm run reset-password -- you@example.com "NewPassword123"
 * Re-enables the account, sets the password and clears sign-in lockouts.
 */
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'

const [email, pw] = process.argv.slice(2)
if (!email || !pw || pw.length < 8) {
  console.error('Usage: npm run reset-password -- <admin email> <new password (min 8 chars)>')
  process.exit(1)
}
const db = createClient({ url: process.env.DATABASE_URL || 'file:./data/niftymeter.db', authToken: process.env.DATABASE_AUTH_TOKEN || undefined })
const hash = await bcrypt.hash(pw, 10)
const r = await db.execute({ sql: 'UPDATE nm_admins SET password_hash = ?, is_active = 1 WHERE email = ?', args: [hash, email.trim().toLowerCase()] })
await db.execute('DELETE FROM nm_login_attempts')
if (!r.rowsAffected) { console.error('No admin found with that email.'); process.exit(1) }
await db.execute({ sql: 'DELETE FROM nm_sessions WHERE admin_id IN (SELECT id FROM nm_admins WHERE email = ?)', args: [email.trim().toLowerCase()] })
console.log('Password updated for ' + email + '. You can sign in at /admin/login')
