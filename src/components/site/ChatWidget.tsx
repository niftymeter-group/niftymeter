/** NiftyMeter AI chat widget — talks to /api/chat (port of assets/js/chat.js). */
import { useCallback, useEffect, useRef, useState } from 'react'
import { chatMd } from '~/lib/markdown'
import { esc, lines } from '~/lib/util'
import { nmTrack } from '~/lib/track'

type Msg = { role: 'user' | 'bot'; text: string; extra?: 'nm-err' | 'nm-typing'; id: number }

function newId(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function ChatWidget({ title, greeting, suggestions }: { title: string; greeting: string; suggestions: string }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [showSugg, setShowSugg] = useState(true)
  const greeted = useRef(false)
  const session = useRef('')
  const seq = useRef(0)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const sugg = lines(suggestions).slice(0, 6)

  useEffect(() => {
    let s = ''
    try { s = sessionStorage.getItem('nm_chat_sid') || '' } catch { /* ignore */ }
    if (!/^[a-f0-9]{32}$/.test(s)) {
      s = newId()
      try { sessionStorage.setItem('nm_chat_sid', s) } catch { /* ignore */ }
    }
    session.current = s
  }, [])

  const add = useCallback((m: Omit<Msg, 'id'>) => {
    const id = ++seq.current
    setMsgs((x) => [...x, { ...m, id }])
    return id
  }, [])

  const doOpen = useCallback(() => {
    setOpen(true)
    if (!greeted.current) {
      greeted.current = true
      add({ role: 'bot', text: greeting || 'Hi! How can I help?' })
    }
    setTimeout(() => inputRef.current?.focus(), 60)
    nmTrack('chat_open', {})
  }, [add, greeting])
  const doClose = useCallback(() => {
    setOpen(false)
    btnRef.current?.focus()
  }, [])

  // #ask deep link + any link to #ask opens the chat; Escape closes it
  useEffect(() => {
    if (location.hash === '#ask') doOpen()
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href="#ask"]')
      if (a) { e.preventDefault(); doOpen() }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen((o) => { if (o) btnRef.current?.focus(); return false }) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey) }
  }, [doOpen])

  // show the start of a new answer, not its end
  useEffect(() => {
    const log = logRef.current
    const last = msgs[msgs.length - 1]
    if (!log || !last) return
    const el = log.lastElementChild as HTMLElement | null
    log.scrollTop = last.role === 'bot' && !last.extra && el ? Math.max(0, el.offsetTop - 12) : log.scrollHeight
  }, [msgs])

  const autosize = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 110) + 'px'
  }
  useEffect(autosize, [input])

  async function ask(qRaw: string) {
    const q = qRaw.trim()
    if (!q || busy) return
    setBusy(true)
    setInput('')
    setShowSugg(false)
    add({ role: 'user', text: q })
    const typingId = add({ role: 'bot', text: '', extra: 'nm-typing' })
    const drop = () => setMsgs((x) => x.filter((m) => m.id !== typingId))
    nmTrack('chat_question', {})
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ session: session.current, message: q }) })
      const d = await r.json().catch(() => ({ ok: false, error: 'Unexpected server response.' }))
      drop()
      if (d.ok) add({ role: 'bot', text: d.reply })
      else add({ role: 'bot', text: d.error || 'Something went wrong. Please try again.', extra: 'nm-err' })
    } catch {
      drop()
      add({ role: 'bot', text: 'Network error. Please check your connection and try again.', extra: 'nm-err' })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div id="nm-chat" className={open ? 'open' : undefined}>
      <button type="button" id="nm-chat-btn" ref={btnRef} aria-expanded={open} aria-controls="nm-chat-panel" onClick={() => (open ? doClose() : doOpen())}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6.1L4.6 21l4.3-2.2c1 .3 2 .4 3.1.4 5.5 0 10-3.6 10-8.1S17.5 3 12 3zm-4 9.3a1.3 1.3 0 110-2.6 1.3 1.3 0 010 2.6zm4 0a1.3 1.3 0 110-2.6 1.3 1.3 0 010 2.6zm4 0a1.3 1.3 0 110-2.6 1.3 1.3 0 010 2.6z" /></svg>
        <span>Ask NiftyMeter AI</span>
      </button>
      <div id="nm-chat-panel" role="dialog" aria-label={title} hidden={!open}>
        <div className="nm-chat-head">
          <img src="/assets/img/favicon.png" alt="" />
          <div><strong>{title}</strong><small>Your NiftyMeter learning assistant</small></div>
          <button type="button" id="nm-chat-close" aria-label="Close chat" onClick={doClose}>✕</button>
        </div>
        <div id="nm-chat-log" aria-live="polite" ref={logRef}>
          {msgs.map((m) =>
            m.extra === 'nm-typing' ? (
              <div key={m.id} className="nm-msg nm-bot nm-typing"><span></span><span></span><span></span></div>
            ) : (
              <div key={m.id} className={`nm-msg nm-${m.role}${m.extra ? ' ' + m.extra : ''}`} dangerouslySetInnerHTML={{ __html: m.role === 'user' ? '<p>' + esc(m.text) + '</p>' : chatMd(m.text) }} />
            ),
          )}
        </div>
        {sugg.length > 0 && (
          <div id="nm-chat-sugg" hidden={!showSugg}>
            {sugg.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}
          </div>
        )}
        <form id="nm-chat-form" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
          <label htmlFor="nm-chat-input" className="hp-field">Your question</label>
          <textarea id="nm-chat-input" ref={inputRef} rows={1} maxLength={600} placeholder="Ask about band colours, setups, stop loss…" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }} />
          <button type="submit" id="nm-chat-send" aria-label="Send" disabled={busy}>➤</button>
        </form>
        <div className="nm-chat-note">Educational only — not investment advice.</div>
      </div>
    </div>
  )
}
