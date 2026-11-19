import { getRequest, getRequestIP } from '@tanstack/react-start/server'

function req(r?: Request): Request | null {
  if (r) return r
  try { return getRequest() } catch { return null }
}

/** Visitor IP. Proxy headers are trusted only when TRUST_PROXY=1 (they are trivially spoofed otherwise). */
export function clientIp(r?: Request): string {
  const q = req(r)
  if (!q) return '0.0.0.0'
  const h = q.headers
  let ip = ''
  if (process.env.TRUST_PROXY === '1') {
    ip = h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0]!.trim() || h.get('x-real-ip') || ''
  }
  if (!ip) {
    try { ip = getRequestIP() || '' } catch { ip = '' }
  }
  if (!ip) {
    const anyReq = q as any
    ip = anyReq.context?.clientAddress || anyReq.ip || ''
  }
  return (ip || '0.0.0.0').slice(0, 45)
}

export function userAgent(r?: Request): string {
  return (req(r)?.headers.get('user-agent') || '').slice(0, 255)
}

/** Absolute site URL (no trailing slash). Uses SITE_URL when set. */
export function siteUrl(path = '', r?: Request): string {
  let base = (process.env.SITE_URL || '').replace(/\/+$/, '')
  if (!base) {
    const q = req(r)
    if (q) {
      const u = new URL(q.url)
      const proto = q.headers.get('x-forwarded-proto') || u.protocol.replace(':', '')
      const host = q.headers.get('x-forwarded-host') || q.headers.get('host') || u.host
      base = `${proto}://${host}`
    } else base = 'http://localhost:3000'
  }
  return base + (path !== '' ? '/' + path.replace(/^\/+/, '') : '')
}

export function isHttps(r?: Request): boolean {
  return siteUrl('', r).startsWith('https://')
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
