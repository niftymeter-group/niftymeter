/** <head> tags for the public page (port of seo_head() in includes/frontend.php). */
import type { SiteData } from '~/fns/public'
import { L, isOn, s } from '~/lib/site'
import { assetUrl } from '~/lib/util'
import siteCss from '~/styles/site.css?url'

export function siteHead(d: SiteData | undefined, opts: { title?: string; description?: string; noindex?: boolean } = {}) {
  if (!d) return { links: [{ rel: 'stylesheet', href: siteCss }] }
  const S = d.S
  const title = opts.title ?? (s(S, 'seo_title') || s(S, 'site_name'))
  const desc = opts.description ?? s(S, 'seo_description')
  const ogT = opts.title ?? (s(S, 'og_title') || title)
  const ogD = opts.description ?? (s(S, 'og_description') || desc)
  const meta: Record<string, string>[] = [
    { title },
    { name: 'description', content: desc },
    { name: 'robots', content: opts.noindex || isOn(S, 'seo_noindex') ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' },
    { name: 'theme-color', content: s(S, 'color_bg') },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: s(S, 'site_name') },
    { property: 'og:title', content: ogT },
    { property: 'og:description', content: ogD },
    { property: 'og:url', content: d.canonical },
    { property: 'og:locale', content: 'en_IN' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: ogT },
    { name: 'twitter:description', content: ogD },
  ]
  if (s(S, 'seo_keywords')) meta.push({ name: 'keywords', content: s(S, 'seo_keywords') })
  if (d.ogImage) {
    meta.push({ property: 'og:image', content: d.ogImage }, { property: 'og:image:width', content: '1200' }, { property: 'og:image:height', content: '630' }, { name: 'twitter:image', content: d.ogImage })
  }
  if (s(S, 'twitter_handle')) meta.push({ name: 'twitter:site', content: '@' + s(S, 'twitter_handle').replace(/^@/, '') })
  if (s(S, 'verify_google')) meta.push({ name: 'google-site-verification', content: s(S, 'verify_google') })
  if (s(S, 'verify_meta')) meta.push({ name: 'facebook-domain-verification', content: s(S, 'verify_meta') })
  if (s(S, 'verify_bing')) meta.push({ name: 'msvalidate.01', content: s(S, 'verify_bing') })

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org', '@type': 'Organization', name: s(S, 'site_name'), url: d.siteUrl,
    logo: d.siteUrl.replace(/\/$/, '') + assetUrl(s(S, 'logo') || 'assets/img/logo.png'),
  }
  const same = ['social_youtube', 'social_instagram', 'social_twitter', 'social_linkedin', 'social_facebook', 'social_telegram'].map((k) => s(S, k)).filter(Boolean)
  if (same.length) ld.sameAs = same
  const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c')
  const scripts: { type?: string; src?: string; async?: boolean; children?: string }[] = [{ type: 'application/ld+json', children: jsonLd(ld) }]
  const faqs = L(S, 'faqs')
  if (faqs.length && isOn(S, 'show_faq') && !opts.title) {
    scripts.push({
      type: 'application/ld+json',
      children: jsonLd({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q ?? '', acceptedAnswer: { '@type': 'Answer', text: f.a ?? '' } })) }),
    })
  }
  scripts.push(...d.scripts)
  scripts.push({ children: `window.NM=${jsonLd({ gadsSendTo: d.gadsSendTo, linkedinConversionId: d.liConv })};` })

  return {
    meta,
    links: [
      { rel: 'stylesheet', href: siteCss },
      { rel: 'canonical', href: d.canonical },
      { rel: 'icon', href: assetUrl(s(S, 'favicon') || 'assets/img/favicon.png') },
      { rel: 'apple-touch-icon', href: '/assets/img/apple-touch-icon.png' },
    ],
    styles: [{ children: d.themeCss }],
    scripts,
  }
}
