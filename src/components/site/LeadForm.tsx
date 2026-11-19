/** Enquiry form → /api/lead (port of the lead section + handleSubmit in site.js). */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Settings } from '~/lib/defaults'
import { s } from '~/lib/site'
import { assetUrl, esc, lines } from '~/lib/util'
import { attribution, nmTrack } from '~/lib/track'
import { Rich } from './bits'

const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LeadForm({ S, options }: { S: Settings; options: string[] }) {
  const tvOpts = lines(s(S, 'enquiry_tv_options'))
  const [f, setF] = useState({ fname: '', lname: '', email: '', phone: '', interest: options[0] ?? '', tvuser: '', message: '', website: '' })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState('')
  const selRef = useRef<HTMLSelectElement>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const tvShown = tvOpts.includes(f.interest)

  // Buttons that lead to the form preselect a matching enquiry type
  useEffect(() => {
    const pick = (word: string) => {
      const o = options.find((x) => x.toLowerCase().includes(word))
      if (o) setF((x) => ({ ...x, interest: o }))
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href="#lead-form"]')
      if (!a) return
      const t = (a.textContent || '').toLowerCase()
      if (t.includes('trial')) pick('trial')
      else if (t.includes('account') || t.includes('broker')) pick('broker')
      else if (t.includes('access') || t.includes('buy') || t.includes('lifetime')) pick('lifetime')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [options])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const data: Record<string, string> = {
      first_name: f.fname.trim(), last_name: f.lname.trim(), email: f.email.trim(), phone: f.phone.trim(),
      interest: f.interest, message: f.message.trim(), tv_email: tvShown ? f.tvuser.trim() : '', website: f.website,
    }
    if (!data.first_name || !data.email || !data.phone) return setError('Please enter your first name, email address and WhatsApp number.')
    if (!re.test(data.email)) return setError('Please enter a valid email address.')
    if (data.tv_email && !re.test(data.tv_email)) return setError('Please enter a valid TradingView email, or leave it empty.')
    Object.assign(data, attribution())
    setSending(true)
    try {
      const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'same-origin' })
      const res = await r.json().catch(() => ({ ok: false, error: 'Unexpected server response.' }))
      if (!res?.ok) return setError(res?.error || 'Something went wrong. Please try again.')
      nmTrack('lead_submit', { interest: data.interest })
      setDone(data.email)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  const successHtml = esc(s(S, 'success_text')).split('{email}').join('<strong id="confirmed-email" style="color:var(--white)">' + esc(done) + '</strong>')
  const showBroker = s(S, 'offer_model') === 'broker' && s(S, 'broker_in_success') === '1' && !!s(S, 'broker_link')

  return (
    <section className="lead-section" id="lead-form">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="sec-label">{s(S, 'lead_label')}</span>
          <Rich as="h2" className="sec-title" text={s(S, 'lead_title')} />
          <Rich as="p" style={{ color: 'var(--text2)', maxWidth: 460, margin: '0 auto', fontSize: '1rem', lineHeight: 1.7 }} text={s(S, 'lead_sub')} />
        </div>
        <div className="lead-form-wrap">
          <div className="lf-head">{s(S, 'form_head')}</div>
          <p className="lf-sub">{s(S, 'form_sub')}</p>
          {!done && (
            <form id="the-form" onSubmit={submit} noValidate>
              <div className="form-err" id="form-err" role="alert" style={{ display: error ? 'block' : undefined }}>{error}</div>
              <div className="fg-row">
                <div className="fg"><label htmlFor="fname">First Name</label><input type="text" id="fname" autoComplete="given-name" placeholder="Rahul" maxLength={100} required value={f.fname} onChange={set('fname')} /></div>
                <div className="fg"><label htmlFor="lname">Last Name</label><input type="text" id="lname" autoComplete="family-name" placeholder="Sharma" maxLength={100} value={f.lname} onChange={set('lname')} /></div>
              </div>
              <div className="fg"><label htmlFor="email">Email Address</label><input type="email" id="email" autoComplete="email" placeholder="you@gmail.com" maxLength={190} required value={f.email} onChange={set('email')} /></div>
              <div className="fg"><label htmlFor="phone">WhatsApp Number</label><input type="tel" id="phone" autoComplete="tel" placeholder="+91 98765 43210" maxLength={40} required value={f.phone} onChange={set('phone')} /></div>
              <div className="fg"><label htmlFor="interest">I'm interested in</label>
                <select id="interest" ref={selRef} value={f.interest} onChange={set('interest')}>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select></div>
              <div className="fg" id="tv-wrap" style={{ display: tvShown ? undefined : 'none' }}>
                <label htmlFor="tvuser">TradingView Email ID <span className="opt">(for indicator access)</span></label>
                <input type="email" id="tvuser" placeholder="your@email.com (TradingView login email)" maxLength={190} value={f.tvuser} onChange={set('tvuser')} />
              </div>
              <div className="fg"><label htmlFor="message">{s(S, 'enquiry_msg_label')}</label><textarea id="message" rows={3} maxLength={1000} placeholder="Tell us a little about what you need…" value={f.message} onChange={set('message')} /></div>
              <div className="hp-field" aria-hidden="true"><label htmlFor="website">Website</label><input type="text" id="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></div>
              <button type="submit" className="submit-btn" disabled={sending}>{sending ? 'Sending…' : s(S, 'form_btn')}</button>
              <p className="priv">{s(S, 'form_privacy')}</p>
            </form>
          )}
          <div className="success" id="success" style={{ display: done ? 'block' : undefined }}>
            <div className="big">🎉</div>
            <h3>{s(S, 'success_title')}</h3>
            <p><span dangerouslySetInnerHTML={{ __html: successHtml }} /><br /><br />{s(S, 'success_sign')}</p>
            {showBroker && (
              <div className="success-broker">
                <img src={assetUrl(s(S, 'broker_logo'))} alt={s(S, 'broker_name')} style={{ height: 28 }} />
                <p><strong>{s(S, 'broker_offer')}</strong><br />{s(S, 'broker_offer_note')}</p>
                <a className="btn-gold" href="/go?to=broker&src=success" target="_blank" rel="noopener sponsored" data-broker="success">{s(S, 'broker_btn')}</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
