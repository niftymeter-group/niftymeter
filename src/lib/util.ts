/** Shared helpers (safe on both server and client). Ported from includes/helpers.php */

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * Lightweight "rich text" used in admin content fields:
 *   *text*   → accent-coloured text
 *   **text** → bold
 *   new line → line break
 * Everything else is escaped. Returns an HTML string.
 */
export function rich(s: unknown): string {
  let h = esc(s)
  h = h.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
  h = h.replace(/\*(.+?)\*/gs, '<span class="hl">$1</span>')
  return h.replace(/\r?\n/g, '<br>\n')
}

/** Split a textarea into non-empty trimmed lines. */
export function lines(s: unknown): string[] {
  return String(s ?? '')
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

export function strLimit(s: string, n: number): string {
  const a = Array.from(s ?? '')
  return a.length > n ? a.slice(0, n - 1).join('') + '…' : s ?? ''
}

export function safeUrl(url: unknown, fallback = '#'): string {
  const u = String(url ?? '').trim()
  if (u === '') return fallback
  if (u[0] === '#' || u[0] === '/' || /^(https?:\/\/|mailto:|tel:)/i.test(u)) return u
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(u)) return 'https://' + u
  return fallback
}

/** Turn a stored asset path (assets/…, uploads/…, https://…) into a URL. */
export function assetUrl(path: unknown): string {
  const p = String(path ?? '')
  if (p === '') return ''
  if (/^(https?:)?\/\//i.test(p) || p.startsWith('data:')) return p
  return '/' + p.replace(/^\/+/, '')
}

export function hexValid(hex: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(hex)
}
export function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
/** Mix a hex colour with white (amt>0) or black (amt<0). amt in -1..1 */
export function hexShade(hex: string, amt: number): string {
  const [r, g, b] = hex2rgb(hex)
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  const f = (c: number) => Math.round((t - c) * p + c)
  return '#' + [f(r), f(g), f(b)].map((n) => n.toString(16).padStart(2, '0').toUpperCase()).join('')
}
export function luminance(hex: string): number {
  const [r, g, b] = hex2rgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Parse "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM" (server local time) into epoch ms. */
export function parseDt(v: unknown): number {
  const s = String(v ?? '').trim()
  if (!s) return 0
  const t = new Date(s.replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? 0 : t
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')

/** Format a stored DB timestamp string. Works on the raw string so server/client agree (no TZ shifts). */
export function fmtDate(dt: unknown, style: 'dMY_hm' | 'dM_hm' | 'dMY' | 'Dd_M' | 'd' = 'dMY_hm'): string {
  const m = String(dt ?? '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/) || String(dt ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(dt ?? '')
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const H = m[4] !== undefined ? +m[4] : 0
  const Mi = m[5] !== undefined ? +m[5] : 0
  const h12 = H % 12 || 12
  const ap = H < 12 ? 'AM' : 'PM'
  const hm = `${pad(h12)}:${pad(Mi)} ${ap}`
  switch (style) {
    case 'dM_hm':
      return `${pad(d)} ${MON[mo - 1]}, ${hm}`
    case 'dMY':
      return `${pad(d)} ${MON[mo - 1]} ${y}`
    case 'Dd_M':
      return `${DAY[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]} ${pad(d)} ${MON[mo - 1]}`
    case 'd':
      return pad(d)
    default:
      return `${pad(d)} ${MON[mo - 1]} ${y}, ${hm}`
  }
}

/** "time ago" relative to a server-provided "now" string, so SSR and hydration match. */
export function timeAgo(dt: string, nowStr: string): string {
  const d = Math.floor((parseDt(nowStr) - parseDt(dt)) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return Math.floor(d / 60) + ' min ago'
  if (d < 86400) return Math.floor(d / 3600) + ' h ago'
  if (d < 604800) return Math.floor(d / 86400) + ' d ago'
  return fmtDate(dt, 'dMY')
}

export function numberFormat(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function slugify(s: string): string {
  const out = s.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return out || 'section'
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0]!.toUpperCase())
    .join('')
}

export function ucfirst(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}
