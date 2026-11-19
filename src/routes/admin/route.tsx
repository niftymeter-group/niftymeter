import { createFileRoute, Outlet } from '@tanstack/react-router'
import adminCss from '~/styles/admin.css?url'

export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [{ title: 'Admin' }, { name: 'robots', content: 'noindex,nofollow' }],
    links: [
      { rel: 'stylesheet', href: adminCss },
      { rel: 'icon', href: '/assets/img/favicon.png' },
    ],
  }),
  component: () => <Outlet />,
})
