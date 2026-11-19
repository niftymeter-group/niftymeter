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
    styles: [{ children: PROGRESS_CSS }],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
})

/** Thin bar at the top while a page is loading, so every click gives instant feedback. */
const PROGRESS_CSS =
  '#nav-progress{position:fixed;top:0;left:0;height:3px;width:0;z-index:10000;background:#0FFFA1;box-shadow:0 0 8px #0FFFA1;opacity:0;transition:opacity .3s}' +
  '#nav-progress.on{opacity:1;animation:nmprog 8s cubic-bezier(.1,.7,.3,1) forwards}' +
  '@keyframes nmprog{0%{width:0}15%{width:45%}100%{width:92%}}'

function NavProgress() {
  const loading = useRouterState({ select: (s) => s.status === 'pending' })
  return <div id="nav-progress" className={loading ? 'on' : undefined} aria-hidden="true" />
}

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
        <NavProgress />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
