import { createMiddleware } from '@tanstack/react-start'
import { currentAdmin } from '~/server/auth.server'

/** Every admin server function requires a signed-in, active admin. */
export const adminMw = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const admin = await currentAdmin()
  if (!admin) throw new Error('Your session has expired. Please sign in again.')
  return next({ context: { admin } })
})

/** Owner-only actions (users, custom code, API keys, restore). */
export const ownerMw = createMiddleware({ type: 'function' })
  .middleware([adminMw])
  .server(async ({ next, context }) => {
    if (context.admin.role !== 'owner') throw new Error('Only the owner account can do this.')
    return next()
  })
