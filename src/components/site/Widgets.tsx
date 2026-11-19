/** Countdown banner + social-proof popup (ports of site.js). */
import { useEffect, useRef, useState } from 'react'
import type { Settings } from '~/lib/defaults'
import { s } from '~/lib/site'
import { initials, safeUrl } from '~/lib/util'
import { Rich } from './bits'

const pad = (n: number) => (n < 10 ? '0' + n : '' + n)

export function OfferBanner({ S, endMs, ended }: { S: Settings; endMs: number; ended: boolean }) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!endMs) return
    const tick = () => setLeft(endMs - Date.now())
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [endMs])
  const expired = ended || (endMs > 0 && left !== null && left <= 0)
  const expiredMsg = s(S, 'banner_expired')
  if (expired && !expiredMsg) return null
  if (expired) {
    return (
      <div className="timer-banner" id="timer-banner">
        <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>{expiredMsg}</span>
      </div>
    )
  }
  const diff = Math.max(0, left ?? 0)
  const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), m = Math.floor((diff % 36e5) / 6e4), sec = Math.floor((diff % 6e4) / 1e3)
  return (
    <div className="timer-banner" id="timer-banner">
      <span className="timer-fire">🔥</span>
      <div className="timer-msg">{s(S, 'banner_msg')}</div>
      {endMs > 0 && (
        <div className="timer-boxes">
          <div className="tbox"><span className="tbox-num">{left === null ? '00' : pad(d)}</span><span className="tbox-label">Days</span></div>
          <span className="tsep">:</span>
          <div className="tbox"><span className="tbox-num">{left === null ? '00' : pad(h)}</span><span className="tbox-label">Hrs</span></div>
          <span className="tsep">:</span>
          <div className="tbox"><span className="tbox-num">{left === null ? '00' : pad(m)}</span><span className="tbox-label">Min</span></div>
          <span className="tsep">:</span>
          <div className="tbox"><span className="tbox-num">{left === null ? '00' : pad(sec)}</span><span className="tbox-label">Sec</span></div>
        </div>
      )}
      <Rich as="div" className="timer-offer" text={s(S, 'banner_sub')} />
      <a href={safeUrl(s(S, 'banner_btn_href'))} className="timer-pill">{s(S, 'banner_btn')}</a>
    </div>
  )
}

function timeAgo(iso: string): string {
  if (!iso) return 'recently'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 120) return '1 minute ago'
  if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago'
  if (diff < 7200) return '1 hour ago'
  if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago'
  if (diff < 172800) return 'yesterday'
  return Math.floor(diff / 86400) + ' days ago'
}

/** Shows REAL recent sign-ups only. */
export function SocialPopup({ S, siteName }: { S: Settings; siteName: string }) {
  const [entry, setEntry] = useState<{ name: string; at: string } | null>(null)
  const [cls, setCls] = useState('')
  const barRef = useRef<HTMLDivElement>(null)
  const closed = useRef(false)
  const hideT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const delay = Math.max(1, Number(s(S, 'popup_delay', '6')) || 6)
    const interval = Math.max(8, Number(s(S, 'popup_interval', '25')) || 25)
    let entries: { name: string; at: string }[] = []
    let idx = 0
    let visible = false
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const hide = () => { setCls('sp-hide'); timers.push(setTimeout(() => { visible = false }, 600)) }
    const show = () => {
      if (!alive || visible || closed.current || !entries.length) return
      const e = entries[idx++ % entries.length]!
      visible = true
      setEntry(e)
      setCls('sp-show')
      const bar = barRef.current
      if (bar) {
        bar.style.transition = 'none'; bar.style.width = '100%'
        timers.push(setTimeout(() => { bar.style.transition = 'width 5s linear'; bar.style.width = '0%' }, 50))
      }
      hideT.current = setTimeout(hide, 5000)
    }
    fetch('/api/recent', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.items?.length) return
        entries = d.items
        const loop = () => { show(); if (idx < entries.length * 2) timers.push(setTimeout(loop, interval * 1000)) }
        timers.push(setTimeout(loop, delay * 1000))
      })
      .catch(() => {})
    return () => { alive = false; timers.forEach(clearTimeout); clearTimeout(hideT.current) }
  }, [S])

  return (
    <div id="sp-popup" role="status" aria-live="polite" className={cls || undefined}>
      <div className="sp-avatar" id="sp-avatar">{entry ? initials(entry.name || 'NM') : 'NM'}</div>
      <div className="sp-content">
        <div className="sp-top"><div className="sp-dot"></div><span className="sp-live">Recent</span></div>
        <div className="sp-name" id="sp-name">{entry?.name}</div>
        <div className="sp-action">{s(S, 'popup_action')} <strong>{siteName}</strong> 🚀</div>
        <div className="sp-time" id="sp-time">{entry ? timeAgo(entry.at) : ''}</div>
      </div>
      <button className="sp-close" title="Close" aria-label="Close" onClick={() => { clearTimeout(hideT.current); closed.current = true; setCls('sp-hide') }}>✕</button>
      <div className="sp-bar" id="sp-bar" ref={barRef}></div>
    </div>
  )
}
