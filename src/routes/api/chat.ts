/** POST /api/chat {session, message} → {ok, reply, source}. History is kept server-side per session. */
import { createFileRoute } from '@tanstack/react-router'
import { aiComplete, kbSearchAnswer, type ChatTurn } from '~/server/ai.server'
import { ago, all, insert, now, T, val } from '~/server/db.server'
import { clientIp, json } from '~/server/request.server'
import { getSettings, on, str } from '~/server/settings.server'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const S = await getSettings()
        if (!on(S, 'ai_enabled')) return json({ ok: false, error: 'The assistant is currently offline.' }, 503)
        let input: Record<string, unknown> = {}
        try { input = (await request.json()) as Record<string, unknown> } catch { /* empty */ }
        const session = String(input.session ?? '')
        const msg = String(input.message ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
        if (!/^[a-f0-9]{16,64}$/.test(session)) return json({ ok: false, error: 'Invalid session.' }, 400)
        if (!msg) return json({ ok: false, error: 'Please type a question.' }, 422)
        if (Array.from(msg).length > 600) return json({ ok: false, error: 'Please keep your question under 600 characters.' }, 422)

        const ip = clientIp(request)
        const limit = Math.max(5, Number(str(S, 'ai_rate_limit', '30')) || 30)
        const used = Number(await val(`SELECT COUNT(*) FROM ${T.chat} WHERE ip = ? AND role = 'user' AND created_at > ?`, [ip, ago(3600)]))
        if (used >= limit) return json({ ok: false, error: 'You have asked a lot of questions in the last hour. Please try again a little later, or contact us on WhatsApp.' }, 429)
        const inSession = Number(await val(`SELECT COUNT(*) FROM ${T.chat} WHERE session_id = ? AND role = 'user'`, [session]))
        if (inSession >= 60) return json({ ok: false, error: 'This chat is very long. Please refresh the page to start a new one.' }, 429)

        // last 10 turns of this conversation, oldest first
        const rows = (await all(`SELECT role, content FROM ${T.chat} WHERE session_id = ? ORDER BY id DESC LIMIT 10`, [session])).reverse()
        const history: ChatTurn[] = []
        for (const r of rows) {
          const role = r.role === 'assistant' ? 'assistant' : 'user'
          const last = history[history.length - 1]
          if (last && last.role === role) { last.content += '\n' + r.content; continue }
          history.push({ role, content: String(r.content) })
        }
        if (history[0]?.role === 'assistant') history.shift()
        if (history[history.length - 1]?.role === 'user') history.pop() // unanswered earlier question
        history.push({ role: 'user', content: msg })

        await insert(T.chat, { session_id: session, role: 'user', content: msg, source: null, ip, created_at: now() })
        let source = 'ai'
        let reply: string
        const res = await aiComplete(S, history)
        if (res.ok) reply = res.text
        else {
          if (str(S, 'ai_api_key')) console.error('NiftyMeter AI: ' + res.error)
          source = 'kb'
          reply = await kbSearchAnswer(S, msg)
        }
        await insert(T.chat, { session_id: session, role: 'assistant', content: reply, source, ip, created_at: now() })
        return json({ ok: true, reply, source })
      },
    },
  },
})
