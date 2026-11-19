import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ask, useAction } from '~/components/admin/flash'
import { Dl, Page, SettingsForm } from '~/components/admin/ui'
import { getAdminSettings, getSystemInfo, housekeeping } from '~/fns/admin'
import { SETTINGS_FIELDS } from '~/lib/schemas'

export const Route = createFileRoute('/admin/_panel/settings')({
  loader: async () => { const [s, sys] = await Promise.all([getAdminSettings(), getSystemInfo()]); return { ...s, sys } },
  component: SettingsPage,
})

function SettingsPage() {
  const d = Route.useLoaderData()
  const run = useAction()
  const hk = useServerFn(housekeeping)
  const [days, setDays] = useState(365)
  return (
    <Page title="Site Settings" sub="Maintenance mode, lead pipeline and housekeeping.">
      <SettingsForm group="settings" fields={SETTINGS_FIELDS} S={d.S} submit="Save settings" />
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>System info</h2></div>
          <Dl items={d.sys.info} />
        </div>
        <div className="card">
          <div className="card-head"><h2>Housekeeping</h2></div>
          <div className="inline-form">
            <span>Delete leads older than</span>
            <select className="input input-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={180}>6 months</option><option value={365}>1 year</option><option value={730}>2 years</option></select>
            <button className="btn btn-sm btn-danger" type="button" onClick={() => { if (ask('Permanently delete old leads? Export them first if you need them.')) run(() => hk({ data: { action: 'purge_leads', days } })) }}>Delete</button>
          </div>
          <div className="inline-form"><span>Clear activity log entries older than 90 days</span><button className="btn btn-sm" type="button" onClick={() => run(() => hk({ data: { action: 'purge_log' } }))}>Clear</button></div>
          <p className="help">Keeping personal data only as long as you need it is good practice under India's DPDP Act.</p>
        </div>
      </div>
    </Page>
  )
}
