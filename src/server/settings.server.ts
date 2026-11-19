/**
 * Settings store — every admin-editable value lives in nm_settings.
 * Missing keys fall back to defaults. List-type values are stored as JSON.
 */
import { DEFAULTS, PRIVATE_KEYS, SECRET_KEYS, isListKey, type Settings } from '~/lib/defaults'
import { all, batch, exec, inList, now, T } from './db.server'

export async function getSettings(): Promise<Settings> {
  const out: Settings = { ...DEFAULTS }
  try {
    for (const r of await all(`SELECT skey, svalue FROM ${T.settings}`)) {
      const k = String(r.skey)
      if (isListKey(k)) {
        try {
          const v = JSON.parse(String(r.svalue ?? ''))
          out[k] = Array.isArray(v) ? v : DEFAULTS[k]!
        } catch { out[k] = DEFAULTS[k]! }
      } else {
        out[k] = r.svalue == null ? '' : String(r.svalue)
      }
    }
  } catch (e) {
    console.error('settings load failed', e)
  }
  return out
}

/** Typed accessors */
export const str = (S: Settings, k: string, fb = ''): string => {
  const v = S[k]
  return typeof v === 'string' ? v : fb
}
export const list = (S: Settings, k: string): Record<string, string>[] => {
  const v = S[k]
  return Array.isArray(v) ? v : []
}
export const on = (S: Settings, k: string) => str(S, k, '0') === '1'

export async function saveSettings(values: Record<string, unknown>): Promise<void> {
  const ts = now()
  await batch(
    Object.entries(values).map(([k, v]) => ({
      sql: `REPLACE INTO ${T.settings} (skey, svalue, updated_at) VALUES (?, ?, ?)`,
      args: [k.slice(0, 100), Array.isArray(v) ? JSON.stringify(v) : String(v ?? ''), ts],
    })),
  )
}

export async function resetSettings(keys: string[]): Promise<void> {
  if (!keys.length) return
  await exec(`DELETE FROM ${T.settings} WHERE skey IN (${inList(keys.length)})`, keys)
}

/** Settings safe to ship to the public page. */
export function publicSettings(S: Settings): Settings {
  const out: Settings = {}
  for (const [k, v] of Object.entries(S)) if (!PRIVATE_KEYS.has(k)) out[k] = v
  return out
}

/** Settings for admin screens: everything except secrets. */
export function adminSettings(S: Settings): Settings {
  const out: Settings = { ...S }
  for (const k of SECRET_KEYS) delete out[k]
  return out
}

export function mask(key: string, keep = 6): string {
  return key === '' ? '' : key.slice(0, keep) + '•'.repeat(12) + key.slice(-4)
}
