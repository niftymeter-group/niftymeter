import { createFileRoute } from '@tanstack/react-router'
import { Page, SettingsForm } from '~/components/admin/ui'
import { getAdminSettings } from '~/fns/admin'
import { SECTIONS_FIELDS } from '~/lib/schemas'

export const Route = createFileRoute('/admin/_panel/sections')({
  loader: () => getAdminSettings(),
  component: () => {
    const d = Route.useLoaderData()
    return (
      <Page title="Sections & Popup" sub="Turn page sections on or off and configure the social-proof popup.">
        <SettingsForm group="sections" fields={SECTIONS_FIELDS} S={d.S} submit="Save" />
      </Page>
    )
  },
})
