import type { Settings } from '~/lib/defaults'
import { lines } from '~/lib/util'
import { str } from './settings.server'

export function leadStatuses(S: Settings): string[] {
  const l = lines(str(S, 'lead_statuses'))
  const base = l.length ? l : ['new', 'contacted', 'invited', 'converted', 'rejected']
  return [...new Set(base.map((s) => s.replace(/[^a-z0-9_-]/gi, '').toLowerCase()))]
}

export interface LeadFilters { q?: string; status?: string; source?: string; interest?: string; from?: string; to?: string; page?: number }

export function leadWhere(f: LeadFilters, statuses: string[]): { W: string; p: string[] } {
  const where = ['1=1']
  const p: string[] = []
  const q = String(f.q ?? '').trim()
  if (q) {
    where.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR tv_email LIKE ? OR notes LIKE ? OR message LIKE ?)')
    for (let i = 0; i < 7; i++) p.push(`%${q}%`)
  }
  if (f.status && statuses.includes(f.status)) { where.push('status = ?'); p.push(f.status) }
  if (f.source) {
    if (f.source === '(direct)') where.push("(utm_source IS NULL OR utm_source = '')")
    else { where.push('utm_source = ?'); p.push(f.source) }
  }
  if (f.interest) { where.push('interest = ?'); p.push(f.interest) }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) { where.push('created_at >= ?'); p.push(f.from + ' 00:00:00') }
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) { where.push('created_at <= ?'); p.push(f.to + ' 23:59:59') }
  return { W: where.join(' AND '), p }
}

