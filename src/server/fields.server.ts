/** Validate & save schema-driven settings forms (port of admin/inc/forms.php clean_value / save_fields). */
import type { Settings } from '~/lib/defaults'
import type { Field } from '~/lib/schemas'
import { hexValid, parseDt, safeUrl, strLimit } from '~/lib/util'
import { saveSettings, str } from './settings.server'

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export function cleanValue(f: Field, raw: unknown, errors: string[], S: Settings): unknown {
  const type = f.type ?? 'text'
  const label = f.label ?? f.key
  if (type === 'repeater') {
    const out: Record<string, unknown>[] = []
    for (const row of Array.isArray(raw) ? raw : []) {
      if (!row || typeof row !== 'object') continue
      const clean: Record<string, unknown> = {}
      let empty = true
      for (const sub of f.fields ?? []) {
        clean[sub.key] = cleanValue(sub, (row as any)[sub.key] ?? '', errors, S)
        if ((sub.type ?? 'text') !== 'toggle' && sub.type !== 'select' && clean[sub.key] !== '') empty = false
      }
      if (!empty) out.push(clean)
      if (f.max && out.length >= f.max) break
    }
    return out
  }
  let v = typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
  v = v.replace(/\r\n/g, '\n')
  if (type !== 'code') v = v.trim()
  switch (type) {
    case 'toggle':
      return v === '1' || v === 'true' ? '1' : '0'
    case 'number': {
      if (v === '') return ''
      let n = parseInt(v, 10)
      if (Number.isNaN(n)) n = 0
      if (f.min !== undefined) n = Math.max(f.min, n)
      if (f.max !== undefined) n = Math.min(f.max, n)
      return String(n)
    }
    case 'color':
      if (v !== '' && !hexValid(v)) { errors.push(`${label}: use a colour like #0FFFA1`); return str(S, f.key) }
      return v.toUpperCase()
    case 'email':
      if (v !== '' && !isEmail(v)) { errors.push(`${label}: invalid email`); return '' }
      return v
    case 'url':
      if (v !== '' && safeUrl(v, '') === '') { errors.push(`${label}: "${strLimit(v, 40)}" is not a valid link (use https://… or #section)`); return '' }
      return v === '' ? '' : safeUrl(v)
    case 'datetime':
      if (v !== '' && !parseDt(v)) { errors.push(`${label}: invalid date`); return '' }
      return v
    case 'image':
      if (v !== '' && !/^(assets\/|uploads\/|https?:\/\/)/.test(v)) { errors.push(`${label}: image path must start with uploads/, assets/ or https://`); return '' }
      return v
    case 'select': {
      const opts = f.options ?? []
      return opts.some(([k]) => k === v) ? v : (opts[0]?.[0] ?? '')
    }
    default: {
      const max = f.maxlen ?? (type === 'code' ? 50000 : 5000)
      return Array.from(v).slice(0, max).join('')
    }
  }
}

/** Save the fields present in `values`. Returns error messages. */
export async function saveFields(fields: Field[], values: Record<string, unknown>, S: Settings): Promise<string[]> {
  const errors: string[] = []
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.type === 'heading') continue
    if (!(f.key in values)) continue
    out[f.key] = cleanValue(f, values[f.key], errors, S)
  }
  if (Object.keys(out).length) await saveSettings(out)
  return errors
}
