/** GET /api/admin/backup — download all content & settings (no secrets, no leads) as JSON. */
import { createFileRoute } from '@tanstack/react-router'
import { isListKey } from '~/lib/defaults'
import { currentAdmin, logActivity } from '~/server/auth.server'
import { all, T } from '~/server/db.server'

export const Route = createFileRoute('/api/admin/backup')({
  server: {
    handlers: {
      GET: async () => {
        const admin = await currentAdmin()
        if (!admin) return new Response('Not logged in', { status: 401 })
        const rows = await all(`SELECT skey, svalue FROM ${T.settings} WHERE skey NOT IN ('ai_api_key', 'resend_api_key', 'smtp_pass', 'schema_version') ORDER BY skey`)
        const settings: Record<string, unknown> = {}
        for (const r of rows) {
          const k = String(r.skey)
          if (isListKey(k)) { try { settings[k] = JSON.parse(String(r.svalue)) } catch { settings[k] = [] } } else settings[k] = r.svalue
        }
        const kb = await all(`SELECT slug, title, content, is_active, sort_order FROM ${T.kb} ORDER BY sort_order, id`)
        await logActivity(admin, 'backup.export', `${rows.length} settings, ${kb.length} knowledge-base sections`)
        const data = { app: 'niftymeter', version: '2.0.0', exported_at: new Date().toISOString(), settings, knowledge_base: kb }
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
        return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="niftymeter-settings-${stamp}.json"`, 'Cache-Control': 'no-store' } })
      },
    },
  },
})
