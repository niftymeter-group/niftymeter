import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ask, useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { kbAction, listKb, restoreKbDefaults } from '~/fns/admin'
import { numberFormat, timeAgo } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/kb/')({
  loader: () => listKb(),
  component: KbList,
})

function KbList() {
  const d = Route.useLoaderData()
  const run = useAction()
  const act = useServerFn(kbAction)
  const restore = useServerFn(restoreKbDefaults)
  const total = d.docs.reduce((a, x) => a + (Number(x.is_active) ? Number(x.len) : 0), 0)
  return (
    <Page title="Knowledge Base" sub="The NiftyMeter guide your AI assistant answers from. Keep it accurate — the assistant will not answer beyond it.">
      <div className="card">
        <div className="card-head"><h2>Sections</h2>
          <div className="quick" style={{ margin: 0 }}><Link className="btn btn-primary btn-sm" to="/admin/kb/$id" params={{ id: 'new' }}>+ Add section</Link><a className="btn btn-sm" href="/guide" target="_blank" rel="noopener">🔒 Preview guide (admins only) ↗</a></div></div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>#</th><th>Section</th><th>Status</th><th className="num">Size</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {!d.docs.length && <tr><td colSpan={6} className="empty">No sections yet. Add one, or restore the default guide below.</td></tr>}
            {d.docs.map((x, i) => {
              const id = Number(x.id)
              return (
                <tr key={id}>
                  <td className="muted">{i + 1}</td>
                  <td><Link to="/admin/kb/$id" params={{ id: String(id) }}><strong>{x.title}</strong></Link><br /><span className="muted small mono">#{x.slug}</span></td>
                  <td>{Number(x.is_active) ? <span className="badge st-converted">active</span> : <span className="badge">hidden</span>}</td>
                  <td className="num small">{numberFormat(Number(x.len))}</td>
                  <td className="small">{timeAgo(x.updated_at, d.now)}</td>
                  <td className="actions">
                    <Link className="btn btn-sm" to="/admin/kb/$id" params={{ id: String(id) }}>Edit</Link>
                    <span><button className="icon-btn" title="Move up" onClick={() => run(() => act({ data: { id, action: 'up' } }))}>↑</button><button className="icon-btn" title="Move down" onClick={() => run(() => act({ data: { id, action: 'down' } }))}>↓</button></span>
                    <button className="btn btn-sm" onClick={() => run(() => act({ data: { id, action: 'toggle' } }))}>{Number(x.is_active) ? 'Hide' : 'Show'}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => { if (ask('Delete this section?')) run(() => act({ data: { id, action: 'delete' } })) }}>Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        <p className="help">Active content: {numberFormat(total)} characters (≈ {numberFormat(Math.round(total / 4))} tokens sent with each AI question, cached by the provider). Keep it under ~100,000 characters.</p>
      </div>
      <div className="reset-form">
        <button className="btn btn-sm btn-ghost" onClick={() => { if (ask('Replace ALL sections with the default NiftyMeter guide? Your edits will be lost.')) run(() => restore()) }}>↺ Restore the default NiftyMeter guide (owners)</button>
      </div>
    </Page>
  )
}
