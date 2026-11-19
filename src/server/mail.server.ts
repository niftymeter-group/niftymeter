/** Email: Resend API (recommended) or SMTP. Returns {ok, error}. */
import type { Settings } from '~/lib/defaults'
import { str, on } from './settings.server'
import { siteUrl } from './request.server'

export interface MailResult { ok: boolean; error: string; via: string }

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export async function sendMail(S: Settings, to: string, subject: string, text: string, replyTo = '', html = ''): Promise<MailResult> {
  let host = ''
  try { host = new URL(siteUrl('/')).hostname.replace(/^www\./, '') } catch { /* ignore */ }
  const from = str(S, 'mail_from') || `no-reply@${host || 'localhost'}`
  const fromName = str(S, 'mail_from_name') || str(S, 'site_name')
  const reply = isEmail(replyTo) ? replyTo : ''
  const driver = str(S, 'mail_driver') === 'php' ? 'smtp' : str(S, 'mail_driver')

  if (driver === 'none') return { ok: false, error: 'Email sending is switched off (Email & Integrations).', via: 'none' }

  if (driver === 'resend') {
    const key = str(S, 'resend_api_key').trim()
    if (!key) return { ok: false, error: 'No Resend API key. Add one in Admin › Email & Integrations.', via: 'Resend' }
    const payload: Record<string, unknown> = { from: `${fromName} <${from}>`, to: [to], subject, text }
    if (html) payload.html = html
    if (reply) payload.reply_to = reply
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })
      if (r.ok) return { ok: true, error: '', via: 'Resend' }
      const j: any = await r.json().catch(() => ({}))
      const err = 'Resend: ' + (j?.message || j?.error?.message || `HTTP ${r.status}`)
      console.error('NiftyMeter mail failed — ' + err)
      return { ok: false, error: err, via: 'Resend' }
    } catch (e: any) {
      return { ok: false, error: 'Resend: ' + (e?.message || 'connection failed'), via: 'Resend' }
    }
  }

  // SMTP
  const smtpHost = str(S, 'smtp_host').trim()
  if (!smtpHost) return { ok: false, error: 'SMTP host is not set (Email & Integrations).', via: 'SMTP' }
  try {
    const nodemailer = await import('nodemailer')
    const port = Number(str(S, 'smtp_port', '465')) || 465
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: on(S, 'smtp_secure'),
      auth: str(S, 'smtp_user') ? { user: str(S, 'smtp_user'), pass: str(S, 'smtp_pass') } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    })
    await transport.sendMail({ from: { name: fromName, address: from }, to, subject, text, html: html || undefined, replyTo: reply || undefined })
    return { ok: true, error: '', via: 'SMTP' }
  } catch (e: any) {
    const err = 'SMTP: ' + (e?.message || 'send failed')
    console.error('NiftyMeter mail failed — ' + err)
    return { ok: false, error: err, via: 'SMTP' }
  }
}

/** POST JSON to a URL (Google Sheets / webhook forward). */
export async function httpPostJson(url: string, data: unknown, timeoutMs = 5000): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    return r.status >= 200 && r.status < 400
  } catch {
    return false
  }
}
