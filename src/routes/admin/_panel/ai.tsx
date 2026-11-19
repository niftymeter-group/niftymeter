import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { useAction } from '~/components/admin/flash'
import { Page, SecretForm, SettingsForm, StatusItem } from '~/components/admin/ui'
import { adminTestChat, getAdminSettings, getAiStats, saveSecret } from '~/fns/admin'
import { AI_FIELDS } from '~/lib/schemas'
import { esc, numberFormat } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/ai')({
  loader: async () => ({ ...(await getAdminSettings()), ai: await getAiStats() }),
  component: Ai,
})

function Ai() {
  const d = Route.useLoaderData()
  const S = d.S as Record<string, string>
  const run = useAction()
  const secret = useServerFn(saveSecret)
  return (
    <Page title="Chat Assistant" sub="An AI chat on your website that answers visitors from your NiftyMeter guide.">
      <div className="stat-grid">
        {d.ai.stats.map(([l, n]) => <div key={l} className="card stat"><div className="stat-lbl">{l}</div><div className="stat-num">{numberFormat(n)}</div></div>)}
        <Link className="card stat stat-link" to="/admin/kb"><div className="stat-lbl">Knowledge base</div><div className="stat-num accent">{d.ai.kbCount}</div><div className="stat-hint">active sections →</div></Link>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Status</h2></div>
          <div className="status-grid">
            <StatusItem on={S.ai_enabled === '1'} name="Chat widget">{S.ai_enabled === '1' ? 'Live on website' : 'Hidden'}</StatusItem>
            <StatusItem on={!!d.keys.ai} name="AI answers">{d.keys.ai ? `${S.ai_provider} · ${S.ai_model}` : 'Guide search only (no key)'}</StatusItem>
            <StatusItem on name="Strategy Guide">Private · <a href="/guide" target="_blank" rel="noopener">admin preview ↗</a></StatusItem>
          </div>
        </div>
        <TestChat />
      </div>
      {d.isOwner && (
        <SecretForm title="🔑 API key" masked={d.keys.ai} placeholder="sk-ant-… (Anthropic) or sk-… (OpenAI)" clearConfirm="Remove the API key? The chat will fall back to guide search."
          onSave={(v, clear) => run(() => secret({ data: { which: 'ai', value: v, clear } }))}
          help={<>Get a Claude key at <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> and set a monthly spend limit there. The key is stored on the server only, is never sent to visitors' browsers, and is excluded from settings backups.</>} />
      )}
      <SettingsForm group="ai" fields={AI_FIELDS} S={d.S} submit="Save assistant settings" />
    </Page>
  )
}

function TestChat() {
  const ask = useServerFn(adminTestChat)
  const [q, setQ] = useState('')
  const [log, setLog] = useState<{ cls: string; html: string }[]>([{ cls: 'tc-bot', html: 'Ask a question the way a visitor would.' }])
  const logRef = useRef<HTMLDivElement>(null)
  const push = (m: { cls: string; html: string }) => { setLog((x) => [...x, m]); setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 0) }
  return (
    <div className="card">
      <div className="card-head"><h2>🧪 Test the assistant</h2></div>
      <div className="test-chat">
        <div className="tc-log" ref={logRef}>{log.map((m, i) => <div key={i} className={`tc-msg ${m.cls}`} dangerouslySetInnerHTML={{ __html: m.html }} />)}</div>
        <form className="copy-row" onSubmit={async (e) => {
          e.preventDefault()
          const text = q.trim(); if (!text) return
          setQ(''); push({ cls: 'tc-user', html: esc(text) })
          try {
            const r = await ask({ data: { message: text } })
            push({ cls: 'tc-bot', html: r.ok
              ? esc(r.reply).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + `<div class="tc-src">${r.source === 'ai' ? '🤖 AI answer' : '📚 Guide search (no API key or API error)'}${r.error ? ' — ' + esc(r.error) : ''}</div>`
              : `<span style="color:#FF8A8A">${esc(r.error || 'Error')}</span>` })
          } catch { push({ cls: 'tc-bot', html: 'Network error' }) }
        }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What does dark green mean?" maxLength={600} />
          <button className="btn btn-primary" type="submit">Ask</button>
        </form>
      </div>
    </div>
  )
}
