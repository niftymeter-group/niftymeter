/**
 * Database layer — libSQL (SQLite file locally, or Turso for serverless).
 * Same tables as the PHP version (nm_ prefix), plus sessions & media.
 */
import { createClient, type Client, type InValue } from '@libsql/client'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import kbSeed from '~/lib/data/kb_seed.json'

// Vercel reserves TZ (and runs in UTC), so the site's time zone comes from APP_TZ
process.env.TZ = process.env.APP_TZ || 'Asia/Kolkata'

const P = 'nm_'
export const T = {
  admins: P + 'admins', settings: P + 'settings', leads: P + 'leads', attempts: P + 'login_attempts',
  activity: P + 'activity', kb: P + 'kb_docs', chat: P + 'chat_logs', clicks: P + 'clicks',
  resets: P + 'password_resets', sessions: P + 'sessions', media: P + 'media',
} as const

export type Row = Record<string, any>

let client: Client | null = null
let ready: Promise<void> | null = null

function getClient(): Client {
  if (client) return client
  const url = process.env.DATABASE_URL || 'file:./data/niftymeter.db'
  if (url.startsWith('file:')) {
    try { mkdirSync(dirname(url.slice(5)), { recursive: true }) } catch { /* exists */ }
  }
  client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined })
  return client
}

async function db(): Promise<Client> {
  const c = getClient()
  if (!ready) ready = migrate(c).catch((e) => { ready = null; throw e })
  await ready
  return c
}

const toRows = (rs: { columns: string[]; rows: ArrayLike<unknown>[] }): Row[] =>
  rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, normalize(r[i])])))
const normalize = (v: unknown) => (typeof v === 'bigint' ? Number(v) : v instanceof ArrayBuffer ? new Uint8Array(v) : v)

export async function all(sql: string, args: InValue[] = []): Promise<Row[]> {
  return toRows(await (await db()).execute({ sql, args }) as any)
}
export async function one(sql: string, args: InValue[] = []): Promise<Row | null> {
  return (await all(sql, args))[0] ?? null
}
export async function val<V = any>(sql: string, args: InValue[] = []): Promise<V | null> {
  const r = await one(sql, args)
  if (!r) return null
  const v = Object.values(r)[0]
  return (v ?? null) as V | null
}
export async function exec(sql: string, args: InValue[] = []): Promise<number> {
  return (await (await db()).execute({ sql, args })).rowsAffected
}
export async function insert(table: string, row: Record<string, InValue | undefined>): Promise<number> {
  const cols = Object.keys(row)
  const rs = await (await db()).execute({
    sql: `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    args: cols.map((c) => (row[c] === undefined ? null : row[c]!)),
  })
  return Number(rs.lastInsertRowid ?? 0)
}
export async function batch(stmts: { sql: string; args?: InValue[] }[]): Promise<void> {
  if (!stmts.length) return
  await (await db()).batch(stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })), 'write')
}
export const inList = (n: number) => Array(n).fill('?').join(',')

/* ─── time helpers (server local time, like PHP date()) ─── */
const pad = (n: number) => String(n).padStart(2, '0')
export function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
export const now = () => fmtLocal(new Date())
export const ago = (seconds: number) => fmtLocal(new Date(Date.now() - seconds * 1000))
export const ahead = (seconds: number) => fmtLocal(new Date(Date.now() + seconds * 1000))
export const dayStart = (daysBack: number) => {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`
}

/* ─── schema ─── */
const SCHEMA_VERSION = 8
const ID = 'INTEGER PRIMARY KEY AUTOINCREMENT'
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ${T.admins} (id ${ID}, name VARCHAR(100) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'admin', is_active TINYINT NOT NULL DEFAULT 1,
    last_login DATETIME NULL, created_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.settings} (skey VARCHAR(100) NOT NULL PRIMARY KEY, svalue TEXT NULL, updated_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.leads} (id ${ID}, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NULL,
    email VARCHAR(190) NOT NULL, phone VARCHAR(40) NULL, tv_email VARCHAR(190) NULL, interest VARCHAR(80) NULL, message TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new', notes TEXT NULL, utm_source VARCHAR(190) NULL, utm_medium VARCHAR(190) NULL,
    utm_campaign VARCHAR(190) NULL, utm_term VARCHAR(190) NULL, utm_content VARCHAR(190) NULL, gclid VARCHAR(190) NULL,
    fbclid VARCHAR(190) NULL, referrer VARCHAR(255) NULL, landing_page VARCHAR(255) NULL, ip VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.attempts} (id ${ID}, ip VARCHAR(45) NOT NULL, email VARCHAR(190) NULL, attempted_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.activity} (id ${ID}, admin_id INT NULL, admin_name VARCHAR(100) NULL, action VARCHAR(100) NOT NULL,
    details TEXT NULL, ip VARCHAR(45) NULL, created_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.kb} (id ${ID}, slug VARCHAR(100) NOT NULL, title VARCHAR(190) NOT NULL, content TEXT NULL,
    is_active TINYINT NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0, updated_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.chat} (id ${ID}, session_id VARCHAR(64) NOT NULL, role VARCHAR(12) NOT NULL, content TEXT NOT NULL,
    source VARCHAR(12) NULL, ip VARCHAR(45) NULL, created_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.clicks} (id ${ID}, target VARCHAR(40) NOT NULL, source VARCHAR(40) NULL, utm_source VARCHAR(190) NULL,
    utm_campaign VARCHAR(190) NULL, ip VARCHAR(45) NULL, created_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.resets} (id ${ID}, admin_id INT NOT NULL, token_hash VARCHAR(64) NOT NULL,
    requested_by VARCHAR(20) NOT NULL DEFAULT 'self', ip VARCHAR(45) NULL, expires_at DATETIME NOT NULL, used_at DATETIME NULL, created_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.sessions} (id ${ID}, token_hash VARCHAR(64) NOT NULL UNIQUE, admin_id INT NOT NULL,
    last_seen INT NOT NULL, ip VARCHAR(45) NULL, created_at DATETIME NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${T.media} (id ${ID}, path VARCHAR(190) NOT NULL UNIQUE, mime VARCHAR(60) NOT NULL, size INT NOT NULL,
    data BLOB NOT NULL, created_at DATETIME NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_leads_created ON ${T.leads} (created_at)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_leads_status ON ${T.leads} (status)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_leads_email ON ${T.leads} (email)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_attempts_ip ON ${T.attempts} (ip, attempted_at)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_activity_created ON ${T.activity} (created_at)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_chat_session ON ${T.chat} (session_id, id)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_chat_created ON ${T.chat} (ip, created_at)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_clicks ON ${T.clicks} (target, created_at)`,
  `CREATE INDEX IF NOT EXISTS ${P}idx_resets_token ON ${T.resets} (token_hash)`,
]

async function migrate(c: Client): Promise<void> {
  let current = 0
  try {
    const rs = await c.execute({ sql: `SELECT svalue FROM ${T.settings} WHERE skey = 'schema_version'`, args: [] })
    current = Number(rs.rows[0]?.[0] ?? 0)
  } catch { /* fresh database */ }
  if (current >= SCHEMA_VERSION) return
  await c.batch(SCHEMA.map((sql) => ({ sql, args: [] })), 'write')
  // older imports from the PHP version may lack the enquiry columns
  for (const col of ['interest VARCHAR(80) NULL', 'message TEXT NULL']) {
    try { await c.execute(`ALTER TABLE ${T.leads} ADD COLUMN ${col}`) } catch { /* already there */ }
  }
  await seedKb(c, false)
  const ts = now()
  if (current === 0) {
    // fresh install: offer ends 7 days from now (change any time in Admin › Content)
    const d = new Date(Date.now() + 7 * 86400e3)
    const end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T23:59`
    await c.execute({ sql: `INSERT OR IGNORE INTO ${T.settings} (skey, svalue, updated_at) VALUES ('banner_end', ?, ?)`, args: [end, ts] })
  }
  await c.execute({ sql: `REPLACE INTO ${T.settings} (skey, svalue, updated_at) VALUES ('schema_version', ?, ?)`, args: [String(SCHEMA_VERSION), ts] })
}

async function seedKb(c: Client, force: boolean): Promise<number> {
  if (!force) {
    const rs = await c.execute(`SELECT COUNT(*) FROM ${T.kb}`)
    if (Number(rs.rows[0]?.[0] ?? 0) > 0) return 0
  }
  const ts = now()
  const seed = kbSeed as [string, string, string][]
  await c.batch(
    seed.map(([slug, title, content], i) => ({
      sql: `INSERT INTO ${T.kb} (slug, title, content, is_active, sort_order, updated_at) VALUES (?,?,?,1,?,?)`,
      args: [slug, title, content, (i + 1) * 10, ts],
    })),
    'write',
  )
  return seed.length
}

/** Replace the knowledge base with the default NiftyMeter guide. */
export async function restoreKb(): Promise<number> {
  const c = await db()
  await c.execute(`DELETE FROM ${T.kb}`)
  return seedKb(c, true)
}
