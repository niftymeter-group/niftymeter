/** Strategy guide (ADMIN-ONLY preview) — renders the active knowledge-base documents. Visitors get a 404. */
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChatWidget } from '~/components/site/ChatWidget'
import { siteHead } from '~/components/site/seo'
import { getGuideData } from '~/fns/public'
import { mdToHtml } from '~/lib/markdown'
import { isOn, s } from '~/lib/site'
import { assetUrl } from '~/lib/util'

export const Route = createFileRoute('/guide')({
  loader: async () => {
    const d = await getGuideData()
    return { ...d, bodyClass: isOn(d.S, 'ai_enabled') ? 'has-chat' : '' }
  },
  head: ({ loaderData }) => {
    const site = loaderData ? s(loaderData.S, 'site_name') : 'NiftyMeter'
    return siteHead(loaderData, {
      title: `${site} Strategy Guide — Band Colours, Setups & Risk`,
      description: `How to read the ${site} indicator: the five band colours, tradeable zones, bullish and bearish setups, timeframes, stop loss and exits. Written for beginners.`,
      noindex: true,
    })
  },
  component: Guide,
})

function Guide() {
  const d = Route.useLoaderData()
  const S = d.S
  const site = s(S, 'site_name')
  const ai = isOn(S, 'ai_enabled')
  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 999, background: '#FFB020', color: '#1b1300', font: '600 13px/1.4 sans-serif', padding: '8px 14px', textAlign: 'center' }}>
        🔒 Admin preview — this guide is private. Visitors cannot open this page; the AI chat answers from it. <Link to="/admin/kb" style={{ color: '#1b1300', textDecoration: 'underline' }}>Back to Knowledge Base</Link>
      </div>
      <nav>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }} aria-label={`${site} home`}>
          <img src={assetUrl(s(S, 'logo') || 'assets/img/logo.png')} alt={site} className="logo-img" style={{ height: Math.max(20, Math.min(90, Number(s(S, 'logo_height')) || 40)) }} />
        </a>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/#charts">Live Charts</a></li>
          <li><a href="/#pricing">Pricing</a></li>
        </ul>
        <a href="/#lead-form" className="nav-cta">{s(S, 'nav_cta_text')}</a>
      </nav>
      <header className="guide-hero">
        <span className="sec-label">Guidance &amp; Strategy</span>
        <h1>{site} <span className="hl">Strategy Guide</span></h1>
        <p>Everything you need to read the indicator: the five band colours, when the market is tradeable, the bullish and bearish setups, timeframes, stop loss and exits — in simple words.</p>
        <div className="guide-cta">
          <a className="btn-gold" href="/#lead-form">🎁 Start 7-Day Free Trial</a>
          {ai && <a className="btn-outline" href="#ask">💬 Ask a question</a>}
        </div>
      </header>
      <div className="guide-wrap">
        <aside className="guide-toc" aria-label="Contents">
          <h4>Contents</h4>
          {d.docs.map((doc) => <a key={doc.slug} href={`#${doc.slug}`}>{doc.title}</a>)}
        </aside>
        <main className="guide-body">
          {d.docs.map((doc) => <section key={doc.slug} id={doc.slug} dangerouslySetInnerHTML={{ __html: mdToHtml(doc.content, 1) }} />)}
          {!d.docs.length && <p>The guide is being updated. Please check back soon.</p>}
        </main>
      </div>
      <footer>
        <div className="footer-bottom">
          <div className="footer-copy">{s(S, 'footer_copyright').split('{year}').join(String(d.year))}</div>
          <div className="footer-disc">{s(S, 'footer_disclaimer')}</div>
        </div>
      </footer>
      {ai && <ChatWidget title={s(S, 'ai_title')} greeting={s(S, 'ai_greeting')} suggestions={s(S, 'ai_suggestions')} />}
    </>
  )
}
