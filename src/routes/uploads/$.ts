/** Serves images uploaded from the admin (stored in the database). */
import { createFileRoute } from '@tanstack/react-router'
import { readImage } from '~/server/media.server'

export const Route = createFileRoute('/uploads/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = 'uploads/' + String(params._splat ?? '')
        if (!/^uploads\/[0-9]{4}\/[0-9]{2}\/[a-z0-9-]+\.(png|jpg|webp|gif|ico)$/.test(path)) return new Response('Not found', { status: 404 })
        const img = await readImage(path)
        if (!img) return new Response('Not found', { status: 404 })
        return new Response(img.data as unknown as BodyInit, {
          headers: { 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=2592000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" },
        })
      },
    },
  },
})
