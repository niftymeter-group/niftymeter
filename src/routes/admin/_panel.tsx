/** Signed-in admin area: guards every page and renders the sidebar shell. */
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AdminShell } from '~/components/admin/ui'
import { getShell } from '~/fns/admin'
import { getAuthState } from '~/fns/auth'
import { assetUrl } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel')({
  beforeLoad: async ({ location }) => {
    const st = await getAuthState()
    if (!st.hasAdmins) throw redirect({ to: '/admin/setup' })
    if (!st.admin) throw redirect({ to: '/admin/login', search: { next: location.href } })
  },
  loader: async () => ({ ...(await getShell()), bodyClass: 'admin' }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.siteName ?? ''} Admin` }], links: [{ rel: 'icon', href: assetUrl(loaderData?.favicon ?? 'assets/img/favicon.png') }] }),
  component: Panel,
})

function Panel() {
  const shell = Route.useLoaderData()
  return (
    <AdminShell shell={shell}>
      <Outlet />
    </AdminShell>
  )
}
