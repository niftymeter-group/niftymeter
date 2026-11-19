/** NiftyMeter — public landing page. All text, links, images, colours and tracking come from Admin. */
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ChatWidget } from '~/components/site/ChatWidget'
import { Icon, Rich, tagClass, ucfirst } from '~/components/site/bits'
import { LeadForm } from '~/components/site/LeadForm'
import { siteHead } from '~/components/site/seo'
import { Strategy } from '~/components/site/Strategy'
import { OfferBanner, SocialPopup } from '~/components/site/Widgets'
import { getLandingData, type SiteData } from '~/fns/public'
import { L, isOn, s } from '~/lib/site'
import { assetUrl, initials, lines, safeUrl } from '~/lib/util'
import { captureAttribution, nmTrack } from '~/lib/track'

export const Route = createFileRoute('/')({
  loader: async () => {
    const d = await getLandingData()
    return { ...d, bodyClass: isOn(d.S, 'ai_enabled') && !d.maintenance ? 'has-chat' : '' }
  },
  head: ({ loaderData }) => siteHead(loaderData),
  component: Landing,
})

const clamp = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || lo))

function Landing() {
  const d = Route.useLoaderData()
  const S = d.S
  const site = s(S, 'site_name')
  const show = (k: string) => s(S, 'show_' + k, '1') === '1'
  const logo = assetUrl(s(S, 'logo') || 'assets/img/logo.png')
  const logoH = clamp(s(S, 'logo_height'), 20, 90)
  const footLogoH = clamp(s(S, 'footer_logo_height'), 20, 90)
  const socials = d.socials
  const ai = isOn(S, 'ai_enabled')

  useEffect(() => {
    if (d.maintenance) return
    captureAttribution()
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a')
      if (!a) return
      if (a.hasAttribute('data-broker')) nmTrack('broker_click', { placement: a.getAttribute('data-broker') })
      else if (a.classList.contains('buy-now-btn')) nmTrack('purchase_click', { plan: a.getAttribute('data-plan') || '' })
      else if (a.classList.contains('btn-gold') || a.classList.contains('nav-cta') || a.classList.contains('timer-pill')) nmTrack('cta_click', { label: (a.textContent || '').trim().slice(0, 60) })
      else if (a.classList.contains('wa-float')) nmTrack('whatsapp_click', {})
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [d.maintenance])

  if (d.maintenance) {
    return (
      <main className="maint-wrap">
        <img src={logo} alt={site} className="logo-img" style={{ height: logoH + 8 }} />
        <Rich as="h1" text={s(S, 'maintenance_title')} />
        <Rich as="p" text={s(S, 'maintenance_msg')} />
        <Socials socials={socials} center />
      </main>
    )
  }

  const anchorShow: Record<string, string> = { '#features': 'features', '#charts': 'charts', '#pricing': 'pricing', '#faq': 'faq', '#strategy': 'strategy', '#markets': 'markets', '#testimonials': 'testi', '#lead-form': 'leadform' }
  const isBroker = s(S, 'offer_model') === 'broker'
  const brokerLogo = assetUrl(s(S, 'broker_logo'))

  return (
    <>
      <CustomHtml html={s(S, 'custom_head')} />
      {d.gtm && <noscript dangerouslySetInnerHTML={{ __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${d.gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe>` }} />}
      {d.isAdmin && d.maintenanceOn && (
        <div className="admin-preview-bar">🔧 Maintenance mode is ON — visitors see the maintenance page. <Link to="/admin/settings">Turn off</Link></div>
      )}

      {/* NAV */}
      <nav>
        <a href="#" id="nav-logo-link" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }} aria-label={`${site} home`}>
          <img src={logo} alt={site} className="logo-img" style={{ height: logoH }} />
        </a>
        <ul>
          {L(S, 'nav_links').map((l, i) => {
            const h = l.href || '#'
            if (anchorShow[h] && !show(anchorShow[h]!)) return null
            return <li key={i}><a href={safeUrl(h)}>{l.label}</a></li>
          })}
        </ul>
        <a href={safeUrl(s(S, 'nav_cta_href'))} className="nav-cta">{s(S, 'nav_cta_text')}</a>
      </nav>

      {d.bannerVisible && <OfferBanner S={S} endMs={d.bannerEndMs} ended={d.bannerEnded} />}

      {/* HERO */}
      <section className="hero" style={{ paddingTop: 40 }}>
        {s(S, 'hero_badge') && <div className="hero-badge"><span className="dot"></span>{s(S, 'hero_badge')}</div>}
        <Rich as="h1" text={s(S, 'hero_title')} />
        <Rich as="p" className="hero-desc" text={s(S, 'hero_desc')} />
        <div className="cta-group">
          {s(S, 'hero_cta1_text') && <a href={safeUrl(s(S, 'hero_cta1_href'))} className="btn-gold">{s(S, 'hero_cta1_text')}</a>}
          {s(S, 'hero_cta2_text') && <a href={safeUrl(s(S, 'hero_cta2_href'))} className="btn-outline">{s(S, 'hero_cta2_text')}</a>}
        </div>
        {s(S, 'hero_note') && <Rich as="p" className="free-note" text={s(S, 'hero_note')} />}
        <br /><br />
        <div className="stat-row">
          {L(S, 'hero_stats').map((st, i) => (
            <Frag key={i}>
              {i > 0 && <div className="stat-sep"></div>}
              <div className="stat"><span className="stat-num">{st.num}</span><span className="stat-label">{st.label}</span></div>
            </Frag>
          ))}
        </div>
      </section>

      {show('marquee') && L(S, 'marquee').length > 0 && (
        <div className="marquee-wrap" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].flatMap((r) => L(S, 'marquee').map((m, i) => (
              <div key={`${r}-${i}`} className="marquee-item">{m.icon} <em>{m.em}</em> · {m.text}</div>
            )))}
          </div>
        </div>
      )}

      {s(S, 'show_broker_strip') === '1' && (
        <div className="broker-strip">
          <span className="bs-label">In partnership with</span>
          <img src={brokerLogo} alt={s(S, 'broker_name')} style={{ height: clamp(String(Number(s(S, 'broker_logo_height')) - 6), 18, 48) }} />
          <span className="bs-text">{s(S, 'broker_strip_text')}</span>
          <BrokerLink S={S} src="strip" className="bs-btn" fallback="#pricing">{s(S, 'broker_btn')}</BrokerLink>
        </div>
      )}

      {show('charts') && L(S, 'charts').length > 0 && <Charts S={S} />}

      {show('trial') && (
        <section className="trial-section" id="trial">
          <div className="trial-inner">
            <div className="trial-left">
              <span className="sec-label">{s(S, 'trial_label')}</span>
              <Rich as="h2" text={s(S, 'trial_title')} />
              <Rich as="p" text={s(S, 'trial_desc')} />
              <ul className="trial-items">
                {L(S, 'trial_items').map((it, i) => (
                  <li key={i}>
                    <div className={`icon ${i % 2 ? 'icon-teal' : 'icon-gold'}`}>{it.icon}</div>
                    <div><strong style={{ color: 'var(--white)', display: 'block', marginBottom: '0.15rem' }}>{it.title}</strong>{it.text}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="trial-card">
              <div className="trial-price-wrap">
                <div className="trial-free">{s(S, 'trial_card_big')}</div>
                <div className="trial-days">{s(S, 'trial_card_sub')}</div>
              </div>
              <ul className="trial-card-list">
                {lines(s(S, 'trial_card_list')).map((ln, i) => <li key={i}><span className="ck">✦</span> {ln}</li>)}
              </ul>
              <a href="#lead-form" className="btn-full">{s(S, 'trial_card_btn')}</a>
              <p className="card-note">{s(S, 'trial_card_note')}</p>
            </div>
          </div>
        </section>
      )}

      {show('markets') && (
        <section className="markets-sec" id="markets">
          <div className="container">
            <span className="sec-label" style={{ textAlign: 'center' }}>{s(S, 'markets_label')}</span>
            <Rich as="h2" className="sec-title" style={{ textAlign: 'center' }} text={s(S, 'markets_title')} />
            <Rich as="p" className="sec-sub" style={{ textAlign: 'center', margin: '0 auto 0.5rem' }} text={s(S, 'markets_sub')} />
            <div className="markets-grid">
              {L(S, 'markets').map((m, i) => (
                <div key={i} className="mkt-pill"><span className="mkt-icon">{m.icon}</span><div className="mkt-info"><div className="mkt-name">{m.name}</div><div className="mkt-sub">{m.sub}</div></div></div>
              ))}
            </div>
            {lines(s(S, 'timeframes')).length > 0 && (
              <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <span className="sec-label" style={{ display: 'inline-block', marginBottom: '0.8rem' }}>Supported Timeframes</span>
                <div className="tf-row">{lines(s(S, 'timeframes')).map((tf, i) => <span key={i} className="tf-chip highlight">{tf}</span>)}</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.8rem' }}>{s(S, 'timeframes_note')}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {show('strategy') && (
        <section className="strategy-sec" id="strategy">
          <div className="container">
            <span className="sec-label">{s(S, 'strategy_label')}</span>
            <Rich as="h2" className="sec-title" text={s(S, 'strategy_title')} />
            <Rich as="p" className="sec-sub" text={s(S, 'strategy_sub')} />
            <Strategy siteName={site} />
          </div>
        </section>
      )}

      {show('features') && (
        <section className="features" id="features">
          <div className="container">
            <span className="sec-label">{s(S, 'features_label')}</span>
            <Rich as="h2" className="sec-title" text={s(S, 'features_title')} />
            <Rich as="p" className="sec-sub" text={s(S, 'features_sub')} />
            <div className="feat-grid">
              {L(S, 'features').map((f, i) => (
                <div key={i} className="feat-card">
                  <div className={`feat-icon-wrap ${i % 2 ? 'fi-teal' : 'fi-gold'}`}>{f.icon}</div>
                  <div className="feat-title">{f.title}</div>
                  <p className="feat-desc">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {show('steps') && (
        <section className="how" id="how">
          <div className="container">
            <span className="sec-label">{s(S, 'steps_label')}</span>
            <Rich as="h2" className="sec-title" text={s(S, 'steps_title')} />
            <div className="steps-row">
              {L(S, 'steps').map((st, i) => (
                <div key={i} className="step">
                  <div className="step-n">{String(i + 1).padStart(2, '0')}</div>
                  <div className="step-t">{st.title}</div>
                  <p className="step-d">{st.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {show('trust') && L(S, 'trust').length > 0 && (
        <section className="trust">
          <div className="trust-inner">
            {L(S, 'trust').map((tr, i) => (
              <Frag key={i}>
                {i > 0 && <div className="t-sep"></div>}
                <div className="trust-item"><div className="t-num">{tr.num}</div><div className="t-lbl">{tr.label}</div></div>
              </Frag>
            ))}
          </div>
        </section>
      )}

      {show('pricing') && (
        <section className="pricing" id="pricing">
          <div className="container">
            {isBroker ? (
              <>
                <span className="sec-label" style={{ textAlign: 'center' }}>{s(S, 'broker_label')}</span>
                <Rich as="h2" className="sec-title" style={{ textAlign: 'center' }} text={s(S, 'broker_title')} />
                <Rich as="p" className="sec-sub" style={{ textAlign: 'center', margin: '0 auto 2.5rem' }} text={s(S, 'broker_sub')} />
                <div className="offer-wrap">
                  <div className="price-card featured broker-card">
                    <div className="broker-head">
                      <img src={brokerLogo} alt={s(S, 'broker_name')} style={{ height: clamp(s(S, 'broker_logo_height'), 20, 80) }} />
                      {s(S, 'broker_badge') && <span className="price-badge pb-featured">{s(S, 'broker_badge')}</span>}
                    </div>
                    <div className="broker-offer">{s(S, 'broker_offer')}</div>
                    <div className="price-period">{s(S, 'broker_offer_note')}</div>
                    <ul className="price-feats">{lines(s(S, 'broker_benefits')).map((ln, i) => <li key={i}><span className="ck">✦</span> {ln}</li>)}</ul>
                    {lines(s(S, 'broker_steps')).length > 0 && <ol className="broker-steps">{lines(s(S, 'broker_steps')).map((ln, i) => <li key={i}>{ln}</li>)}</ol>}
                    <BrokerLink S={S} src="pricing" className="btn-full buy-now-btn broker-btn" fallback="#lead-form" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}>{s(S, 'broker_btn')}</BrokerLink>
                    <p className="broker-disc">{d.brokerDisc}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="sec-label" style={{ textAlign: 'center' }}>{s(S, 'pricing_label')}</span>
                <Rich as="h2" className="sec-title" style={{ textAlign: 'center' }} text={s(S, 'pricing_title')} />
                <Rich as="p" className="sec-sub" style={{ textAlign: 'center', margin: '0 auto 2.5rem' }} text={s(S, 'pricing_sub')} />
                <div className="offer-wrap">
                  <div className="price-card featured">
                    {s(S, 'price_badge') && <span className="price-badge pb-featured">{s(S, 'price_badge')}</span>}
                    <div className="price-name" style={{ border: 'none', padding: 0, marginBottom: '.6rem' }}>{s(S, 'price_name')}</div>
                    <div className="price-amount">{s(S, 'price_mrp') && <><s className="price-mrp">{s(S, 'price_mrp')}</s> </>}{s(S, 'price_amount')}<span> {s(S, 'price_unit')}</span></div>
                    <div className="price-period">{s(S, 'price_note')}</div>
                    <ul className="price-feats">{lines(s(S, 'price_features')).map((ln, i) => <li key={i}><span className="ck">✦</span> {ln}</li>)}</ul>
                    {safeUrl(s(S, 'price_link'), '') ? (
                      <a href="/go?to=buy&src=pricing" target="_blank" rel="noopener" data-plan={s(S, 'price_name')} className="btn-full buy-now-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}>{s(S, 'price_btn')}</a>
                    ) : (
                      <a href="#lead-form" data-plan={s(S, 'price_name')} className="btn-full buy-now-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}>{s(S, 'price_btn')}</a>
                    )}
                    <p className="card-note" style={{ textAlign: 'center' }}>🔒 Secure payment · Access within 24 hours</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {show('testi') && L(S, 'testimonials').length > 0 && (
        <section className="testi" id="testimonials">
          <div className="container">
            <span className="sec-label">{s(S, 'testi_label')}</span>
            <Rich as="h2" className="sec-title" text={s(S, 'testi_title')} />
            <div className="testi-grid">
              {L(S, 'testimonials').map((tm, i) => {
                const stars = Math.max(1, Math.min(5, Number(tm.stars) || 5))
                return (
                  <div key={i} className="testi-card">
                    <div className="testi-stars" aria-label={`${stars} out of 5`}>{Array.from({ length: stars }, (_, k) => <span key={k} className="star">★</span>)}</div>
                    <p className="testi-quote">{tm.quote}</p>
                    <div className="testi-author">
                      <div className="av">{initials(tm.name ?? '')}</div>
                      <div><div className="av-name">{tm.name}</div><div className="av-role">{tm.role}</div></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {show('leadform') && <LeadForm S={S} options={d.enquiry} />}

      {show('faq') && L(S, 'faqs').length > 0 && <Faq S={S} ai={ai} />}

      <SiteFooter d={d} logo={logo} footLogoH={footLogoH} show={show} />

      {s(S, 'popup_enabled') === '1' && <SocialPopup S={S} siteName={site} />}

      {s(S, 'whatsapp_float') === '1' && socials.whatsapp && (
        <a className="wa-float" href={socials.whatsapp + (s(S, 'whatsapp_msg') ? '?text=' + encodeURIComponent(s(S, 'whatsapp_msg')) : '')} target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><Icon name="whatsapp" /></a>
      )}

      {ai && <ChatWidget title={s(S, 'ai_title')} greeting={s(S, 'ai_greeting')} suggestions={s(S, 'ai_suggestions')} />}

      {d.isAdmin && <Link to="/admin" className="admin-fab" title="Open admin">⚙️ Admin</Link>}

      <CustomHtml html={s(S, 'custom_body')} />
    </>
  )
}

function Frag({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/**
 * Owner-provided custom code (other ad platforms, chat widgets…). It is part of the
 * server-rendered HTML, so any <script> in it runs on page load exactly like in the PHP version.
 */
function CustomHtml({ html }: { html: string }) {
  if (!html) return null
  return <div style={{ display: 'contents' }} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
}

function BrokerLink({ S, src, className, fallback, style, children }: { S: SiteData['S']; src: string; className: string; fallback: string; style?: CSSProperties; children: ReactNode }) {
  const has = !!s(S, 'broker_link')
  return has ? (
    <a className={className} style={style} href={`/go?to=broker&src=${src}`} target="_blank" rel="noopener sponsored" data-broker={src}>{children}</a>
  ) : (
    <a className={className} style={style} href={fallback} data-broker={src}>{children}</a>
  )
}

function Charts({ S }: { S: SiteData['S'] }) {
  const [idx, setIdx] = useState(0)
  const charts = L(S, 'charts')
  return (
    <section className="charts-section" id="charts">
      <div className="container">
        <span className="sec-label">{s(S, 'charts_label')}</span>
        <Rich as="h2" className="sec-title" text={s(S, 'charts_title')} />
        <Rich as="p" className="sec-sub" text={s(S, 'charts_sub')} />
        <div className="chart-tabs">
          {charts.map((c, i) => <button key={i} className={`tab-btn${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)}>{c.tab}</button>)}
        </div>
        {charts.map((c, i) => (
          <div key={i} className="chart-display" data-idx={i} style={{ display: i === idx ? 'block' : 'none' }}>
            <img src={assetUrl(c.image)} alt={c.name} loading={i ? 'lazy' : 'eager'} width={1814} height={1100} style={{ width: '100%', height: 'auto', display: 'block' }} />
            <div className="chart-overlay">
              <div>
                <div className="chart-name">{c.name}</div>
                <div className="chart-sub">{c.sub}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[1, 2].map((n) => c['tag' + n] ? <span key={n} className={tagClass(c[`tag${n}_type`] || 'neu')}>{c['tag' + n]}</span> : null)}
              </div>
            </div>
          </div>
        ))}
        {L(S, 'signal_cards').length > 0 && (
          <div className="signal-guide-grid">
            {L(S, 'signal_cards').map((sc, i) => (
              <div key={i} className={`sig-card sig-${sc.type || 'neu'}`}>
                <div className="sig-title">{sc.title}</div>
                <div className="sig-text">{sc.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Faq({ S, ai }: { S: SiteData['S']; ai: boolean }) {
  const [open, setOpen] = useState(-1)
  return (
    <section className="faq" id="faq">
      <div className="container">
        <span className="sec-label" style={{ display: 'block', textAlign: 'center' }}>{s(S, 'faq_label')}</span>
        <Rich as="h2" className="sec-title" style={{ textAlign: 'center' }} text={s(S, 'faq_title')} />
        <div className="faq-wrap">
          {L(S, 'faqs').map((f, i) => (
            <div key={i} className={`faq-item${open === i ? ' open' : ''}`}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>{f.q} <span className="faq-arr">▼</span></button>
              <Rich as="div" className="faq-a" text={f.a ?? ''} />
            </div>
          ))}
        </div>
        {ai && <p className="faq-more">Still have a question? <a href="#ask">Ask NiftyMeter AI</a> or <a href="#lead-form">send us an enquiry</a>.</p>}
      </div>
    </section>
  )
}

function Socials({ socials, center }: { socials: Record<string, string>; center?: boolean }) {
  const keys = Object.keys(socials)
  if (!keys.length) return null
  return (
    <div className="social-row" style={center ? { justifyContent: 'center' } : undefined}>
      {keys.map((k) => <a key={k} href={socials[k]} target="_blank" rel="noopener" className="soc" title={ucfirst(k)} aria-label={ucfirst(k)}><Icon name={k} /></a>)}
    </div>
  )
}

function SiteFooter({ d, logo, footLogoH, show }: { d: SiteData; logo: string; footLogoH: number; show: (k: string) => boolean }) {
  const S = d.S
  const site = s(S, 'site_name')
  const socials = d.socials
  return (
    <footer>
      <div className="footer-top">
        <div className="footer-brand">
          <a href="#" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginBottom: '.8rem' }}><img src={logo} alt={site} className="logo-img" style={{ height: footLogoH }} loading="lazy" /></a>
          <p>{s(S, 'footer_desc')}</p>
        </div>
        <div className="footer-links-col">
          <h4>Product</h4>
          {show('features') && <a href="#features">Features</a>}
          {socials.youtube && <a href={socials.youtube} target="_blank" rel="noopener">▶ YouTube Channel</a>}
          {show('pricing') && <a href="#pricing">Pricing</a>}
          <a href="#lead-form">Enquire Now</a>
        </div>
        <div className="footer-links-col">
          <h4>Resources</h4>
          {show('charts') && <a href="#charts">Live Charts</a>}
          {show('strategy') && <a href="#strategy">How it Works?</a>}
          {show('faq') && <a href="#faq">FAQ</a>}
          {isOn(S, 'ai_enabled') && <a href="#ask">💬 Ask NiftyMeter AI</a>}
          {L(S, 'footer_links').map((fl, i) => (fl.href ? <a key={i} href={safeUrl(fl.href)}>{fl.label}</a> : null))}
          {s(S, 'contact_email') && <a href={`mailto:${s(S, 'contact_email')}`}>{s(S, 'contact_email')}</a>}
        </div>
        {Object.keys(socials).length > 0 && (
          <div>
            <h4 className="footer-h4">Follow Us</h4>
            <Socials socials={socials} />
          </div>
        )}
      </div>
      {(s(S, 'offer_model') === 'broker' || s(S, 'show_broker_strip') === '1') && (
        <div className="footer-partner">
          <span>Partner broker</span>
          <img src={assetUrl(s(S, 'broker_logo'))} alt={s(S, 'broker_name')} loading="lazy" />
          <p>{d.brokerDisc}</p>
        </div>
      )}
      <div className="footer-bottom">
        <div className="footer-copy">{s(S, 'footer_copyright').split('{year}').join(String(d.year))}</div>
        <div className="footer-disc">{s(S, 'footer_disclaimer')}</div>
      </div>
    </footer>
  )
}
