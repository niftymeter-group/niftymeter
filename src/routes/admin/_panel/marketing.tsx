import { createFileRoute } from '@tanstack/react-router'
import { Page, SettingsForm, StatusItem } from '~/components/admin/ui'
import { getAdminSettings } from '~/fns/admin'
import { MARKETING_CODE_FIELDS, MARKETING_FIELDS } from '~/lib/schemas'
import { trackingIds } from '~/lib/site'

export const Route = createFileRoute('/admin/_panel/marketing')({
  loader: () => getAdminSettings(),
  component: Marketing,
})

function Marketing() {
  const d = Route.useLoaderData()
  const ids = trackingIds(d.S)
  const status: [string, string][] = [
    ['Google Analytics 4', ids.ga4], ['Google Tag Manager', ids.gtm], ['Google Ads conversions', ids.gads && ids.gadsLbl ? ids.gads : ''],
    ['Meta Pixel', ids.pixel], ['LinkedIn Insight', ids.linkedin], ['Microsoft Clarity', ids.clarity],
  ]
  return (
    <Page title="Ads & Tracking" sub="Connect analytics and ad pixels so you can measure and optimise your Meta, Google and LinkedIn campaigns.">
      <div className="card">
        <div className="card-head"><h2>Status</h2></div>
        <div className="status-grid">{status.map(([n, v]) => <StatusItem key={n} on={!!v} name={n}>{v || 'Not connected'}</StatusItem>)}</div>
      </div>
      <SettingsForm group="marketing" fields={d.isOwner ? [...MARKETING_FIELDS, ...MARKETING_CODE_FIELDS] : MARKETING_FIELDS} S={d.S} submit="Save tracking" viewSite={false}>
        {!d.isOwner && <div className="form-heading wide"><h3>Custom code</h3><div className="help">Only the owner account can add custom scripts.</div></div>}
      </SettingsForm>
      <div className="card">
        <div className="card-head"><h2>Events sent from your site</h2></div>
        <table className="table compact">
          <thead><tr><th>When</th><th>GA4 / gtag</th><th>Meta Pixel</th><th>GTM dataLayer</th></tr></thead>
          <tbody>
            <tr><td>Page load</td><td>page_view</td><td>PageView</td><td>gtm.js</td></tr>
            <tr><td>Trial form submitted</td><td>generate_lead + Ads conversion</td><td>Lead</td><td>lead_submit</td></tr>
            <tr><td>"Buy Now" clicked</td><td>begin_checkout</td><td>InitiateCheckout</td><td>purchase_click</td></tr>
            <tr><td>Hero / menu CTA clicked</td><td>select_content</td><td>ViewContent</td><td>cta_click</td></tr>
            <tr><td>WhatsApp button clicked</td><td>—</td><td>—</td><td>whatsapp_click</td></tr>
          </tbody>
        </table>
        <p className="help">Tip: in Meta Ads Manager optimise campaigns for the <strong>Lead</strong> event; in Google Ads import the lead conversion. Every lead also stores its UTM source, campaign and click IDs — see <a href="/admin/campaigns">Campaigns</a>.</p>
      </div>
    </Page>
  )
}
