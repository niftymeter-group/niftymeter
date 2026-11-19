/** Browser tracking helpers (no-ops if a tag is not configured). Port of site.js nmTrack + attribution. */
declare global {
  interface Window { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; lintrk?: (...a: unknown[]) => void; __nmAttr?: Record<string, string>; NM?: { gadsSendTo?: string; linkedinConversionId?: string } }
}

export function nmTrack(event: string, data: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  const NM = window.NM || {}
  try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event, ...data }) } catch { /* ignore */ }
  try {
    if (event === 'lead_submit') {
      window.fbq?.('track', 'Lead')
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'generate_lead', { method: 'enquiry_form', interest: data.interest || '' })
        if (NM.gadsSendTo) window.gtag('event', 'conversion', { send_to: NM.gadsSendTo })
      }
      if (typeof window.lintrk === 'function' && NM.linkedinConversionId) window.lintrk('track', { conversion_id: NM.linkedinConversionId })
    } else if (event === 'broker_click') {
      window.fbq?.('trackCustom', 'BrokerClick', data)
      window.gtag?.('event', 'broker_click', data)
    } else if (event === 'cta_click' || event === 'purchase_click') {
      window.fbq?.('track', event === 'purchase_click' ? 'InitiateCheckout' : 'ViewContent', data)
      window.gtag?.('event', event === 'purchase_click' ? 'begin_checkout' : 'select_content', data)
    }
  } catch { /* ignore */ }
}

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']

/** First-touch attribution: UTM / click IDs kept for 30 days. */
export function captureAttribution(): void {
  const p = new URLSearchParams(location.search)
  const found: Record<string, string> = {}
  let any = false
  for (const k of KEYS) { const v = p.get(k); if (v) { found[k] = v.slice(0, 190); any = true } }
  try {
    const stored = JSON.parse(localStorage.getItem('nm_attr') || 'null')
    if (any && (!stored || Date.now() - stored.t > 30 * 864e5)) {
      found.landing_page = location.pathname + location.search
      found.referrer = document.referrer || ''
      localStorage.setItem('nm_attr', JSON.stringify({ t: Date.now(), d: found }))
    } else if (!stored) {
      localStorage.setItem('nm_attr', JSON.stringify({ t: Date.now(), d: { referrer: document.referrer || '', landing_page: location.pathname + location.search } }))
    }
  } catch { window.__nmAttr = found }
  try {
    const a = JSON.parse(localStorage.getItem('nm_attr') || 'null')
    if (a?.d && (a.d.utm_source || a.d.utm_campaign)) {
      document.cookie = 'nm_utm=' + encodeURIComponent(JSON.stringify({ utm_source: a.d.utm_source || '', utm_campaign: a.d.utm_campaign || '' })) + ';path=/;max-age=2592000;SameSite=Lax'
    }
  } catch { /* ignore */ }
}

export function attribution(): Record<string, string> {
  try { const s = JSON.parse(localStorage.getItem('nm_attr') || 'null'); if (s?.d) return s.d } catch { /* ignore */ }
  return window.__nmAttr || {}
}
