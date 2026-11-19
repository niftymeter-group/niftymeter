import { createFileRoute } from '@tanstack/react-router'
import { Page, SettingsForm } from '~/components/admin/ui'
import { getAdminSettings } from '~/fns/admin'
import { LINKS_FIELDS } from '~/lib/schemas'

export const Route = createFileRoute('/admin/_panel/links')({
  loader: () => getAdminSettings(),
  component: () => {
    const d = Route.useLoaderData()
    return (
      <Page title="Links & Social" sub="Payment and broker links, social profiles and WhatsApp.">
        <SettingsForm group="links" fields={LINKS_FIELDS} S={d.S} submit="Save links" viewSite={false} />
      </Page>
    )
  },
})
