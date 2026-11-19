import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Page, Pager } from '~/components/admin/ui'
import { listActivity } from '~/fns/admin'
import { fmtDate } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/activity')({
  validateSearch: (s: Record<string, unknown>) => ({ page: Number(s.page) > 1 ? Number(s.page) : undefined }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listActivity({ data: { page: deps.page ?? 1 } }),
  component: Activity,
})

function Activity() {
  const d = Route.useLoaderData()
  const navigate = useNavigate()
  return (
    <Page title="Activity Log" sub="Who changed what, and when.">
      <div className="card table-card"><div className="table-wrap"><table className="table">
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
        <tbody>
          {!d.rows.length && <tr><td colSpan={5} className="empty">No activity yet.</td></tr>}
          {d.rows.map((r) => (
            <tr key={r.id}><td className="nowrap small" title={r.created_at}>{fmtDate(r.created_at, 'dM_hm')}</td>
              <td>{r.admin_name}</td><td><code>{r.action}</code></td><td className="small">{r.details}</td><td className="small muted">{r.ip}</td></tr>
          ))}
        </tbody>
      </table></div></div>
      <Pager page={d.page} pages={d.pages} prev="← Newer" next="Older →" onGo={(p) => navigate({ to: '/admin/activity', search: { page: p > 1 ? p : undefined } })} />
    </Page>
  )
}
