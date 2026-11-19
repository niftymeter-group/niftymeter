import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ask, useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { chatAction, listChats } from '~/fns/admin'
import { strLimit, timeAgo } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/chats/')({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' && s.q ? s.q : undefined }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listChats({ data: deps }),
  component: Chats,
})

function Chats() {
  const d = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const run = useAction()
  const act = useServerFn(chatAction)
  const [q, setQ] = useState(search.q ?? '')
  return (
    <Page title="Chat Logs" sub="What visitors ask your assistant. Use this to improve the knowledge base and your FAQ.">
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>Most asked (30 days)</h2></div>
          {!d.top.length ? <p className="muted">No questions yet.</p> : (
            <table className="table compact"><tbody>{d.top.map((t, i) => <tr key={i}><td>{strLimit(String(t.content), 90)}</td><td className="num">{Number(t.n)}×</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Tips</h2></div>
          <ul className="checklist">
            <li><span className="ck">💡</span><span>If many answers come from <em>guide search</em>, add an API key in <Link to="/admin/ai">Chat Assistant</Link>.</span></li>
            <li><span className="ck">📚</span><span>If the assistant says it is not sure, add that topic to the <Link to="/admin/kb">Knowledge Base</Link>.</span></li>
            <li><span className="ck">❓</span><span>Turn the most-asked questions into <Link to="/admin/content" search={{ tab: 'faq' }}>FAQ</Link> items.</span></li>
          </ul>
          <button className="btn btn-sm" onClick={() => { if (ask('Delete chat messages older than 90 days?')) run(() => act({ data: { action: 'purge' } })) }}>Clear messages older than 90 days</button>
        </div>
      </div>
      <form className="card filters" onSubmit={(e) => { e.preventDefault(); navigate({ to: '/admin/chats', search: { q: q || undefined } }) }}>
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" />
        <button className="btn">Search</button>
        <Link className="btn btn-ghost" to="/admin/chats" onClick={() => setQ('')}>Reset</Link>
      </form>
      <div className="card table-card"><div className="table-wrap"><table className="table">
        <thead><tr><th>Latest question</th><th className="num">Questions</th><th>Answered by</th><th>Last message</th></tr></thead>
        <tbody>
          {!d.sessions.length && <tr><td colSpan={4} className="empty">No conversations yet.</td></tr>}
          {d.sessions.map((s) => {
            const sid = String(s.session_id)
            return (
              <tr key={sid} className="clickable" onClick={() => navigate({ to: '/admin/chats/$sid', params: { sid } })}>
                <td><Link to="/admin/chats/$sid" params={{ sid }}>{strLimit(d.firstQ[sid] ?? '—', 90)}</Link></td>
                <td className="num">{Number(s.questions)}</td>
                <td>{Number(s.fallback) ? <span className="badge st-contacted">guide search</span> : <span className="badge st-converted">AI</span>}</td>
                <td className="small nowrap">{timeAgo(String(s.last_at), d.now)}</td>
              </tr>
            )
          })}
        </tbody>
      </table></div></div>
    </Page>
  )
}
