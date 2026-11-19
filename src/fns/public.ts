import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader, setResponseStatus } from '@tanstack/react-start/server'
import type { Settings } from '~/lib/defaults'
import { bannerState, brokerDisclaimer, enquiryOptions, socialLinks, themeStyle, trackingIds, trackingScripts } from '~/lib/site'
import { kbDocsActive } from '~/server/ai.server'
import { currentAdmin } from '~/server/auth.server'
import { siteUrl } from '~/server/request.server'
import { getSettings, on, publicSettings, str } from '~/server/settings.server'

export interface SiteData {
  S: Settings
  isAdmin: boolean
  maintenance: boolean
  maintenanceOn: boolean
  bannerVisible: boolean
  bannerEndMs: number
  bannerEnded: boolean
  themeCss: string
  scripts: { src?: string; async?: boolean; children?: string }[]
  gtm: string
  gadsSendTo: string
  liConv: string
  socials: Record<string, string>
  brokerDisc: string
  enquiry: string[]
  year: number
  siteUrl: string
  ogImage: string
  canonical: string
}

async function buildSiteData(): Promise<SiteData> {
  const S = await getSettings()
  const admin = await currentAdmin()
  const nowMs = Date.now()
  const maintenance = on(S, 'maintenance') && !admin
  const ids = trackingIds(S)
  const banner = bannerState(S, nowMs)
  const og = str(S, 'og_image')
  return {
    S: publicSettings(S),
    isAdmin: !!admin,
    maintenance,
    maintenanceOn: on(S, 'maintenance'),
    bannerVisible: banner.visible,
    bannerEndMs: banner.end,
    bannerEnded: banner.state === 'ended_msg',
    themeCss: themeStyle(S),
    scripts: maintenance ? [] : trackingScripts(S),
    gtm: ids.gtm,
    gadsSendTo: ids.gads && ids.gadsLbl ? `${ids.gads}/${ids.gadsLbl}` : '',
    liConv: ids.liConv,
    socials: socialLinks(S),
    brokerDisc: brokerDisclaimer(S),
    enquiry: enquiryOptions(S),
    year: new Date().getFullYear(),
    siteUrl: siteUrl('/'),
    ogImage: og ? (/^https?:\/\//.test(og) ? og : siteUrl(og)) : '',
    canonical: str(S, 'seo_canonical') || siteUrl('/'),
  }
}

export const getLandingData = createServerFn({ method: 'GET' }).handler(async () => {
  const d = await buildSiteData()
  if (d.maintenance) {
    setResponseStatus(503)
    setResponseHeader('Retry-After', '3600')
  }
  return d
})

/** Strategy guide — admins only; visitors get a 404. */
export const getGuideData = createServerFn({ method: 'GET' }).handler(async () => {
  const admin = await currentAdmin()
  if (!admin) {
    setResponseHeader('X-Robots-Tag', 'noindex, nofollow')
    throw notFound()
  }
  setResponseHeader('X-Robots-Tag', 'noindex, nofollow')
  const d = await buildSiteData()
  const docs = (await kbDocsActive()).map((r) => ({ slug: String(r.slug), title: String(r.title), content: String(r.content ?? '') }))
  return { ...d, scripts: [], docs }
})
