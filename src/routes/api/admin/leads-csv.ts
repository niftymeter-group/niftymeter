/** GET /api/admin/leads-csv?… — CSV export of leads (respects the list filters). */
import { createFileRoute } from '@tanstack/react-router'
import { currentAdmin, logActivity } from '~/server/auth.server'
import { all, T } from '~/server/db.server'
import { leadStatuses, leadWhere } from '~/server/leads.server'
import { getSettings } from '~/server/settings.server'

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export const Route = createFileRoute('/api/admin/leads-csv')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = await currentAdmin()
        if (!admin) return new Response('Not logged in', { status: 401 })
        const q = Object.fromEntries(new URL(request.url).searchParams)
        const { W, p } = leadWhere(q, leadStatuses(await getSettings()))
        const rows = await all(`SELECT id, created_at, first_name, last_name, email, phone, interest, message, tv_email, status, notes, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, referrer, landing_page FROM ${T.leads} WHERE ${W} ORDER BY id DESC`, p)
        await logActivity(admin, 'lead.export', `${rows.length} leads exported`)
        const head = ['ID', 'Created', 'First name', 'Last name', 'Email', 'WhatsApp', 'Interested in', 'Message', 'TradingView email', 'Status', 'Notes', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM term', 'UTM content', 'gclid', 'fbclid', 'Referrer', 'Landing page']
        const csv = '﻿' + [head.map(cell).join(','), ...rows.map((r) => Object.values(r).map(cell).join(','))].join('\r\n') + '\r\n'
        const date = new Date().toISOString().slice(0, 10)
        return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="niftymeter-enquiries-${date}.csv"`, 'Cache-Control': 'no-store' } })
      },
    },
  },
})
