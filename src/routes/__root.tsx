/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap' },
    ],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
})

/** Routes can return `bodyClass` from their loader (e.g. "has-chat", "admin", "auth-body"). */
function useBodyClass(): string {
  return useRouterState({
    select: (s) =>
      s.matches
        .map((m) => (m.loaderData as { bodyClass?: string } | undefined)?.bodyClass)
        .filter(Boolean)
        .pop() ?? '',
  })
}

function RootDocument({ children }: { children: ReactNode }) {
  const bodyClass = useBodyClass()
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className={bodyClass || undefined}>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
