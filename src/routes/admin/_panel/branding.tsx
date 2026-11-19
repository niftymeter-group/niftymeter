import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { CSSProperties } from 'react'
import { ask, useAction } from '~/components/admin/flash'
import { Page, SettingsForm } from '~/components/admin/ui'
import { getAdminSettings, resetGroup } from '~/fns/admin'
import { BRANDING_FIELDS } from '~/lib/schemas'
import { assetUrl } from '~/lib/util'

export const Route = createFileRoute('/admin/_panel/branding')({
  loader: () => getAdminSettings(),
  component: Branding,
})

function Branding() {
  const d = Route.useLoaderData()
  const S = d.S as Record<string, string>
  const run = useAction()
  const reset = useServerFn(resetGroup)
  return (
    <Page title="Branding & Theme" sub="Logo, favicon and colours.">
      <div className="card brand-preview" style={{ '--p-acc': S.color_accent, '--p-bg': S.color_bg, '--p-card': S.color_card } as CSSProperties}>
        <img src={assetUrl(S.logo)} alt="" style={{ height: Number(S.logo_height) || 40 }} />
        <div className="bp-row"><span className="bp-btn">🎁 Start Free Trial</span><span className="bp-text">Read the Market <b>Like Smart Money.</b></span></div>
      </div>
      <SettingsForm group="branding" fields={BRANDING_FIELDS} S={d.S} submit="Save branding" />
      <div className="reset-form">
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => { if (ask('Reset logo, favicon and colours to the NiftyMeter defaults?')) run(() => reset({ data: { group: 'branding' } })) }}>↺ Reset to NiftyMeter defaults</button>
      </div>
    </Page>
  )
}
