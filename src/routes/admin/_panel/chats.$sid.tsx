import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ask, useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { chatAction, getChat } from '~/fns/admin'
import { mdToHtml } from '~/lib/markdown'
import { fmtDate } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/chats/$sid')({
  loader: ({ params }) => getChat({ data: { sid: params.sid } }),
  component: ChatView,
})

function ChatView() {
  const { msgs } = Route.useLoaderData()
  const { sid } = Route.useParams()
  const navigate = useNavigate()
  const run = useAction()
  const act = useServerFn(chatAction)
  return (
    <Page title="Conversation" sub={<Link to="/admin/chats">← All conversations</Link>}>
      <div className="card chat-view">
        {msgs.map((m, i) => (
          <div key={i} className={`cv-msg cv-${m.role === 'user' ? 'user' : 'bot'}`}>
            <div className="cv-meta">{m.role === 'user' ? 'Visitor' : 'Assistant' + (m.source === 'kb' ? ' · guide search' : ' · AI')} · {fmtDate(m.created_at, 'dM_hm')}</div>
            {m.role === 'user'
              ? <div className="cv-body" style={{ whiteSpace: 'pre-line' }}>{m.content}</div>
              : <div className="cv-body" dangerouslySetInnerHTML={{ __html: mdToHtml(String(m.content), 2) }} />}
          </div>
        ))}
        {!msgs.length && <p className="muted">Conversation not found.</p>}
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-sm btn-danger" onClick={async () => {
            if (!ask('Delete this conversation?')) return
            const r = await run(() => act({ data: { action: 'delete', sid } }), { invalidate: false })
            if (r) navigate({ to: '/admin/chats' })
          }}>Delete conversation</button>
        </div>
      </div>
    </Page>
  )
}
