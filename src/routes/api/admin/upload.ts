/** POST /api/admin/upload — image upload used by image fields across the admin. Returns {ok, path, url}. */
import { createFileRoute } from '@tanstack/react-router'
import { currentAdmin, logActivity } from '~/server/auth.server'
import { storeImage } from '~/server/media.server'
import { json } from '~/server/request.server'

export const Route = createFileRoute('/api/admin/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get('origin')
        if (origin && new URL(origin).host !== new URL(request.url).host && origin !== new URL(request.url).origin) {
          return json({ ok: false, error: 'Cross-site request blocked.' }, 403)
        }
        const admin = await currentAdmin()
        if (!admin) return json({ ok: false, error: 'Not logged in' }, 401)
        try {
          const fd = await request.formData()
          const file = fd.get('file')
          if (!(file instanceof File)) throw new Error('No file selected.')
          const path = await storeImage(file, String(fd.get('prefix') ?? 'img'))
          await logActivity(admin, 'media.upload', path)
          return json({ ok: true, path, url: '/' + path })
        } catch (e: any) {
          return json({ ok: false, error: e?.message || 'Upload failed' }, 422)
        }
      },
    },
  },
})
