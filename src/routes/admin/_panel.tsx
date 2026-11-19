/** Signed-in admin area: guards every page and renders the sidebar shell. */
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AdminShell } from '~/components/admin/ui'
import { getShell } from '~/fns/admin'
import { assetUrl } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel')({
  // One server call checks the session and loads the sidebar. It is reused for 30 s while
  // clicking around the admin (actions call router.invalidate(), which refreshes it).
  loader: async ({ location }) => {
    const shell = await getShell()
    if (!shell.admin) {
      if (!shell.hasAdmins) throw redirect({ to: '/admin/setup' })
      throw redirect({ to: '/admin/login', search: { next: location.href } })
    }
    return { ...shell, admin: shell.admin, bodyClass: 'admin' }
  },
  staleTime: 30_000,
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
