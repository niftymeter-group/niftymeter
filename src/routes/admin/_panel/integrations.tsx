import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useAction } from '~/components/admin/flash'
import { Page, SecretForm, SettingsForm, StatusItem } from '~/components/admin/ui'
import { getAdminSettings, saveSecret, testEmail, testWebhook } from '~/fns/admin'
import { INTEGRATIONS_FIELDS } from '~/lib/schemas'

export const Route = createFileRoute('/admin/_panel/integrations')({
  loader: () => getAdminSettings(),
  component: Integrations,
})

function Integrations() {
  const d = Route.useLoaderData()
  const S = d.S as Record<string, string>
  const run = useAction()
  const secret = useServerFn(saveSecret)
  const tEmail = useServerFn(testEmail)
  const tHook = useServerFn(testWebhook)
  const driver = S.mail_driver === 'php' ? 'smtp' : S.mail_driver
  return (
    <Page title="Email & Integrations" sub="Email delivery (Resend or SMTP), lead notifications, auto-replies and sending leads to other tools.">
      <div className="card">
        <div className="card-head"><h2>✉ Email delivery status</h2></div>
        <div className="status-grid">
          <StatusItem on={driver === 'resend' && !!d.keys.resend} name="Resend API">{d.keys.resend ? d.keys.resend + (driver === 'resend' ? ' · active' : ' · saved, not active') : 'No key'}</StatusItem>
          <StatusItem on={driver === 'smtp' && !!S.smtp_host} name="SMTP">{S.smtp_host ? S.smtp_host + (driver === 'smtp' ? ' · active' : ' · not active') : 'not set'}</StatusItem>
          <StatusItem on={!!S.mail_from} name="From address">{S.mail_from || 'not set'}</StatusItem>
        </div>
      </div>
      {d.isOwner && (
        <SecretForm title="🔑 Resend API key" masked={d.keys.resend} placeholder="re_…" clearConfirm="Remove the Resend API key?" saveText="Save Resend key"
          onSave={(v, clear) => run(() => secret({ data: { which: 'resend', value: v, clear } }))}
          help={<>1. Sign up at <a href="https://resend.com" target="_blank" rel="noopener">resend.com</a> → 2. Domains: add and verify your domain (DNS records) → 3. API Keys: create a key with <em>Sending access</em> → 4. paste it here and set the From email below. The key is stored on the server, visible only to owners, and excluded from settings backups.</>} />
      )}
      {d.isOwner && (
        <SecretForm title="🔑 SMTP password" masked={d.keys.smtp} placeholder="App password" label="New SMTP password" clearConfirm="Remove the SMTP password?" saveText="Save SMTP password"
          onSave={(v, clear) => run(() => secret({ data: { which: 'smtp', value: v, clear } }))}
          help={<>Only needed when "Send emails with" is SMTP. For Gmail use an <em>App password</em> (Google Account › Security › 2-Step Verification › App passwords).</>} />
      )}
      <SettingsForm group="integrations" fields={INTEGRATIONS_FIELDS} S={d.S} submit="Save" viewSite={false} />
      <div className="card">
        <div className="card-head"><h2>Test</h2></div>
        <div className="quick">
          <button className="btn" type="button" onClick={() => run(() => tEmail(), { invalidate: false })}>✉ Send test email to {d.me.email}</button>
          <button className="btn" type="button" onClick={() => run(() => tHook(), { invalidate: false })}>🔗 Send test lead to webhook</button>
        </div>
      </div>
    </Page>
  )
}
