/** Pure helpers for the public page and admin (port of includes/frontend.php + banner_state). */
import type { Settings } from './defaults'
import { fmtDate, hex2rgb, hexShade, hexValid, lines, luminance, parseDt, safeUrl } from './util'

export const s = (S: Settings, k: string, fb = ''): string => (typeof S[k] === 'string' ? (S[k] as string) : fb)
export const L = (S: Settings, k: string): Record<string, string>[] => (Array.isArray(S[k]) ? (S[k] as Record<string, string>[]) : [])
export const isOn = (S: Settings, k: string) => s(S, k, '0') === '1'

export function themeStyle(S: Settings): string {
  const acc = hexValid(s(S, 'color_accent')) ? s(S, 'color_accent') : '#0FFFA1'
  const bg = hexValid(s(S, 'color_bg')) ? s(S, 'color_bg') : '#061C19'
  const s2 = hexValid(s(S, 'color_surface')) ? s(S, 'color_surface') : hexShade(bg, 0.06)
  const cd = hexValid(s(S, 'color_card')) ? s(S, 'color_card') : hexShade(bg, 0.08)
  const vars: Record<string, string> = {
    '--accent': acc,
    '--accent-rgb': hex2rgb(acc).join(','),
    '--accent-bright': hexShade(acc, 0.4),
    '--accent-dim': hexShade(acc, -0.38),
    '--on-accent': luminance(acc) > 0.55 ? hexShade(bg, -0.25) : '#FFFFFF',
    '--bg': bg,
    '--bg-rgb': hex2rgb(bg).join(','),
    '--bg2': s2,
    '--bg3': hexShade(s2, 0.05),
    '--card': cd,
  }
  return ':root{' + Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('') + '}'
}

const valid = (v: string, re: RegExp) => (re.test(v.trim()) ? v.trim() : '')

/** Tracking IDs, validated so nothing unexpected can be injected through them. */
export function trackingIds(S: Settings) {
  return {
    ga4: valid(s(S, 'ga4_id'), /^G-[A-Z0-9]{4,20}$/i),
    gtm: valid(s(S, 'gtm_id'), /^GTM-[A-Z0-9]{4,12}$/i),
    gads: valid(s(S, 'gads_id'), /^AW-[0-9]{6,15}$/i),
    gadsLbl: valid(s(S, 'gads_label'), /^[A-Za-z0-9_-]{4,40}$/),
    pixel: valid(s(S, 'meta_pixel_id'), /^[0-9]{6,20}$/),
    linkedin: valid(s(S, 'linkedin_partner_id'), /^[0-9]{3,12}$/),
    liConv: valid(s(S, 'linkedin_conversion_id'), /^[0-9]{3,15}$/),
    clarity: valid(s(S, 'clarity_id'), /^[a-z0-9]{6,20}$/i),
  }
}

/** Head scripts for the tracking tags (inline code + external src). */
export function trackingScripts(S: Settings): { src?: string; async?: boolean; children?: string }[] {
  const id = trackingIds(S)
  const out: { src?: string; async?: boolean; children?: string }[] = []
  if (id.gtm) {
    out.push({ children: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id.gtm}');` })
  }
  const first = id.ga4 || id.gads
  if (first) {
    out.push({ src: `https://www.googletagmanager.com/gtag/js?id=${first}`, async: true })
    out.push({ children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${id.ga4 ? `gtag('config','${id.ga4}');` : ''}${id.gads ? `gtag('config','${id.gads}');` : ''}` })
  }
  if (id.pixel) {
    out.push({ children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id.pixel}');fbq('track','PageView');` })
  }
  if (id.clarity) {
    out.push({ children: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,'clarity','script','${id.clarity}');` })
  }
  if (id.linkedin) {
    out.push({ children: `_linkedin_partner_id="${id.linkedin}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName('script')[0];var b=document.createElement('script');b.type='text/javascript';b.async=true;b.src='https://snap.licdn.com/li.lms-analytics/insight.min.js';s.parentNode.insertBefore(b,s);})(window.lintrk);` })
  }
  return out
}

export function socialLinks(S: Settings): Record<string, string> {
  const wa = s(S, 'whatsapp_number').replace(/\D/g, '')
  const list: Record<string, string> = {
    whatsapp: wa ? 'https://wa.me/' + wa : '',
    telegram: s(S, 'social_telegram'),
    instagram: s(S, 'social_instagram'),
    twitter: s(S, 'social_twitter'),
    linkedin: s(S, 'social_linkedin'),
    facebook: s(S, 'social_facebook'),
    youtube: s(S, 'social_youtube'),
  }
  const out: Record<string, string> = {}
  for (const [k, u] of Object.entries(list)) {
    const v = u ? safeUrl(u, '') : ''
    if (v) out[k] = v
  }
  return out
}

/** AP disclosure with the broker name and AP registration number filled in. */
export function brokerDisclaimer(S: Settings): string {
  const ap = s(S, 'broker_ap_id').trim()
  return s(S, 'broker_disclaimer')
    .split('{broker}').join(s(S, 'broker_name'))
    .split('{ap}').join(ap !== '' ? ` (AP Registration No. ${ap})` : '')
}

/** Enquiry types for the form, matched to the active offer. */
export function enquiryOptions(S: Settings): string[] {
  const broker = s(S, 'offer_model') === 'broker'
  const out: string[] = []
  for (const o of lines(s(S, 'enquiry_options'))) {
    if (!broker && /broker/i.test(o)) continue
    if (broker && /lifetime/i.test(o)) continue
    out.push(Array.from(o).slice(0, 80).join(''))
  }
  return out.length ? out : ['General enquiry']
}

export type BannerStateName = 'off' | 'scheduled' | 'live' | 'ended_msg' | 'ended'

/** Launch-offer banner status, shared by the website and the admin. */
export function bannerState(S: Settings, nowMs: number): { state: BannerStateName; visible: boolean; start: number; end: number; label: string } {
  const start = parseDt(s(S, 'banner_start'))
  const end = parseDt(s(S, 'banner_end'))
  const fmt = (v: string) => fmtDate(v.replace('T', ' '), 'dMY_hm')
  if (!isOn(S, 'show_banner')) return { state: 'off', visible: false, start, end, label: 'Switched off — not shown on the website' }
  if (start && start > nowMs) return { state: 'scheduled', visible: false, start, end, label: 'Scheduled — appears on ' + fmt(s(S, 'banner_start')) }
  if (end && end <= nowMs) {
    if (s(S, 'banner_expired').trim() !== '') return { state: 'ended_msg', visible: true, start, end, label: 'Offer ended ' + fmt(s(S, 'banner_end')) + ' — showing the "after offer" message' }
    return { state: 'ended', visible: false, start, end, label: 'Offer ended ' + fmt(s(S, 'banner_end')) + ' — hidden automatically' }
  }
  return { state: 'live', visible: true, start, end, label: 'Live on the website' + (end ? ' · countdown to ' + fmt(s(S, 'banner_end')) : ' · no countdown') }
}
