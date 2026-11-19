import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ask, useAction } from '~/components/admin/flash'
import { BannerCard, Page, SettingsForm } from '~/components/admin/ui'
import { getAdminSettings, resetGroup } from '~/fns/admin'
import { CONTENT_TABS } from '~/lib/schemas'

export const Route = createFileRoute('/admin/_panel/content')({
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === 'string' && CONTENT_TABS[s.tab] ? s.tab : 'hero' }),
  loader: () => getAdminSettings(),
  component: Content,
})

function Content() {
  const d = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const [title, fields] = CONTENT_TABS[tab]!
  const run = useAction()
  const reset = useServerFn(resetGroup)
  return (
    <Page title="Content" sub="Edit every section of your landing page. Changes go live as soon as you save.">
      <div className="tabs">
        {Object.entries(CONTENT_TABS).map(([k, [label]]) => (
          <Link key={k} className={`tab${k === tab ? ' active' : ''}`} to="/admin/content" search={{ tab: k }}>{label}</Link>
        ))}
      </div>
      {tab === 'banner' && <BannerCard banner={d.banner} isOn={d.S.show_banner === '1'} msg={String(d.S.banner_msg ?? '')} editLink={false} />}
      <SettingsForm key={tab} group={`content:${tab}`} fields={fields} S={d.S} submit={`Save ${title}`} />
      <div className="reset-form">
        <button className="btn btn-sm btn-ghost" type="button" onClick={() => {
          if (ask('Restore the default content for this tab? Your edits in this tab will be lost.')) run(() => reset({ data: { group: `content:${tab}` } }))
        }}>↺ Restore default content for this tab</button>
      </div>
    </Page>
  )
}
