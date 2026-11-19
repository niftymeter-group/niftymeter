/** Server functions for the admin console. Every function requires a signed-in admin (adminMw). */
import { createServerFn } from '@tanstack/react-start'
import { DEFAULTS, isListKey } from '~/lib/defaults'
import { CONTENT_TABS, fieldKeys, groupFields } from '~/lib/schemas'
import { bannerState, trackingIds } from '~/lib/site'
import { lines } from '~/lib/util'
import { aiComplete, kbSearchAnswer } from '~/server/ai.server'
import { currentAdmin, endOtherSessions, hashPassword, logActivity, passwordProblem, resetCreate, resetSendEmail, verifyPassword, LOCK_MINUTES, MAX_ATTEMPTS } from '~/server/auth.server'
import { ago, all, dayStart, exec, inList, insert, now, one, restoreKb, T, val } from '~/server/db.server'
import { saveFields } from '~/server/fields.server'
import { httpPostJson, sendMail } from '~/server/mail.server'
import { siteUrl } from '~/server/request.server'
import { adminSettings, getSettings, mask, on, resetSettings, saveSettings, str } from '~/server/settings.server'
import { leadStatuses, leadWhere, type LeadFilters } from '~/server/leads.server'
import { adminMw, ownerMw } from './middleware'

type Msg = { type: 'ok' | 'warn' | 'err'; text: string }
const ok = (text: string): Msg => ({ type: 'ok', text })
const err = (text: string): Msg => ({ type: 'err', text })
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
const cut = (s: unknown, n: number) => Array.from(String(s ?? '').trim()).slice(0, n).join('')

/* ───────────────────────── shell & settings ───────────────────────── */

/** Sidebar data + auth state in ONE round trip (the layout used to make two). */
export const getShell = createServerFn({ method: 'GET' }).handler(async () => {
  const [admin, S] = await Promise.all([currentAdmin(), getSettings()])
  if (!admin) {
    return { admin: null, hasAdmins: Number(await val(`SELECT COUNT(*) FROM ${T.admins}`)) > 0, newLeads: 0, siteName: '', logo: '', favicon: '', maintenance: false }
  }
  return {
    admin,
    hasAdmins: true,
    newLeads: Number(await val(`SELECT COUNT(*) FROM ${T.leads} WHERE status = 'new'`)),
    siteName: str(S, 'site_name'),
    logo: str(S, 'logo') || 'assets/img/logo.png',
    favicon: str(S, 'favicon') || 'assets/img/favicon.png',
    maintenance: on(S, 'maintenance'),
  }
})

export const getAdminSettings = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async ({ context }) => {
  const S = await getSettings()
  const b = bannerState(S, Date.now())
  return {
    S: adminSettings(S),
    isOwner: context.admin.role === 'owner',
    me: context.admin,
    banner: { state: b.state, label: b.label },
    keys: {
      ai: mask(str(S, 'ai_api_key'), 7),
      resend: mask(str(S, 'resend_api_key'), 6),
      smtp: str(S, 'smtp_pass') ? '••••••••' : '',
    },
    siteUrl: siteUrl('/'),
    now: now(),
  }
})

const GROUP_TITLES: Record<string, string> = {
  offer: 'Pricing & Broker', links: 'Links & Social', branding: 'Branding & Theme', sections: 'Sections & Popup',
  marketing: 'Ads & Tracking', seo: 'SEO & Meta', integrations: 'Email & Integrations', ai: 'Chat Assistant',
  settings: 'Site Settings', policy: 'Password policy',
}

export const saveGroup = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { group: string; values: Record<string, unknown> }) => ({ group: String(d?.group ?? ''), values: (d?.values ?? {}) as Record<string, unknown> }))
  .handler(async ({ data, context }) => {
    const isOwner = context.admin.role === 'owner'
    const fields = groupFields(data.group, isOwner)
    if (!fields) throw new Error('Unknown settings group.')
    const v = { ...data.values }
    const S = await getSettings()
    // per-page pre-processing (same rules as the PHP pages)
    if (data.group === 'links' && 'whatsapp_number' in v) v.whatsapp_number = String(v.whatsapp_number ?? '').replace(/\D/g, '')
    if (data.group === 'marketing') {
      for (const k of ['ga4_id', 'gtm_id', 'gads_id', 'gads_label', 'meta_pixel_id', 'linkedin_partner_id', 'linkedin_conversion_id', 'clarity_id']) {
        if (k in v) v[k] = String(v[k] ?? '').replace(/\s+/g, '')
      }
    }
    if (data.group === 'seo') {
      for (const k of ['verify_google', 'verify_meta', 'verify_bing']) {
        const m = String(v[k] ?? '').match(/content=["']([^"']+)["']/i)
        if (m) v[k] = m[1]
      }
    }
    if (data.group === 'settings' && 'lead_statuses' in v) {
      v.lead_statuses = [...new Set(lines(v.lead_statuses).map((s) => s.replace(/[^a-z0-9_-]/gi, '').toLowerCase()).filter(Boolean))].join('\n')
    }
    const errors = await saveFields(fields, v, S)
    const S2 = await getSettings()
    const msgs: Msg[] = []
    let title = GROUP_TITLES[data.group] ?? data.group
    if (data.group.startsWith('content:')) {
      title = CONTENT_TABS[data.group.slice(8)]![0]
      await logActivity(context.admin, 'content.save', title)
    } else {
      await logActivity(context.admin, data.group + '.save', title)
    }
    if (data.group === 'offer') {
      await saveSettings({ price_confirmed: '1' })
    }
    if (data.group === 'marketing') {
      const ids = trackingIds(S2)
      const checks: [string, keyof typeof ids, string][] = [
        ['ga4_id', 'ga4', 'GA4 ID should look like G-XXXXXXX'], ['gtm_id', 'gtm', 'GTM ID should look like GTM-XXXXXX'],
        ['gads_id', 'gads', 'Google Ads ID should look like AW-123456789'], ['meta_pixel_id', 'pixel', 'Meta Pixel ID should be 6–20 digits'],
        ['linkedin_partner_id', 'linkedin', 'LinkedIn Partner ID should be digits'], ['clarity_id', 'clarity', 'Clarity ID looks invalid'],
      ]
      for (const [k, idk, m] of checks) if (str(S2, k) !== '' && ids[idk] === '') errors.push(m + ' — it will not be loaded until fixed.')
    }
    if (data.group === 'integrations') {
      for (const em of str(S2, 'notify_emails').split(',').map((x) => x.trim()).filter(Boolean)) if (!isEmail(em)) errors.push(`"${em}" is not a valid email`)
    }
    for (const e of errors) msgs.push({ type: data.group === 'marketing' ? 'warn' : 'err', text: e })
    let text = errors.length ? 'Saved, but some fields need attention.' : `"${title}" saved — live on your site now.`
    if (data.group === 'offer') text = 'Saved — your website now shows the ' + (str(S2, 'offer_model') === 'broker' ? 'partner broker' : 'one-time price') + ' card' + (on(S2, 'show_pricing') ? '.' : ' (Pricing section is hidden).')
    msgs.push({ type: errors.length ? 'warn' : 'ok', text })
    return { msgs }
  })

/** Restore defaults for a content tab or the branding/theme. */
export const resetGroup = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { group: string }) => ({ group: String(d?.group ?? '') }))
  .handler(async ({ data, context }) => {
    if (data.group === 'branding') {
      await resetSettings(['color_accent', 'color_bg', 'color_surface', 'color_card', 'logo', 'favicon', 'logo_height', 'footer_logo_height'])
      await logActivity(context.admin, 'branding.reset', 'Theme & logo reset to NiftyMeter defaults')
      return { msgs: [ok('Branding reset to the NiftyMeter defaults.')] }
    }
    const tab = CONTENT_TABS[data.group.replace(/^content:/, '')]
    if (!tab) throw new Error('Unknown tab.')
    await resetSettings(fieldKeys(tab[1]).filter((k) => !k.startsWith('show_')))
    await logActivity(context.admin, 'content.reset', tab[0])
    return { msgs: [ok(`"${tab[0]}" restored to default content.`)] }
  })

export const setBanner = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { on: boolean }) => ({ on: !!d?.on }))
  .handler(async ({ data, context }) => {
    await saveSettings({ show_banner: data.on ? '1' : '0' })
    await logActivity(context.admin, 'banner.' + (data.on ? 'on' : 'off'), 'Launch offer banner switched ' + (data.on ? 'on' : 'off'))
    const st = bannerState(await getSettings(), Date.now())
    return {
      msgs: [ok(data.on ? (st.visible ? 'Launch offer banner is now live on your website.' : `Banner switched on. ${st.label}.`) : 'Launch offer banner hidden from your website. Your text and dates are kept.')],
    }
  })

/* ───────────────────────── dashboard ───────────────────────── */

export const getDashboard = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async () => {
  const L = T.leads
  const cnt = async (where = '1=1', p: (string | number)[] = []) => Number(await val(`SELECT COUNT(*) FROM ${L} WHERE ${where}`, p))
  // all queries in parallel: one network round trip instead of ~12
  const [S, total, today, d7, d30, fresh, converted, rows, sources, recent] = await Promise.all([
    getSettings(),
    cnt(),
    cnt('created_at >= ?', [dayStart(0)]),
    cnt('created_at >= ?', [dayStart(6)]),
    cnt('created_at >= ?', [dayStart(29)]),
    cnt("status = 'new'"),
    cnt("status = 'converted'"),
    all(`SELECT SUBSTR(created_at,1,10) d, COUNT(*) n FROM ${L} WHERE created_at >= ? GROUP BY SUBSTR(created_at,1,10)`, [dayStart(13)]),
    all(`SELECT COALESCE(NULLIF(utm_source,''),'(direct / organic)') src, COUNT(*) n, SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) conv
     FROM ${L} WHERE created_at >= ? GROUP BY COALESCE(NULLIF(utm_source,''),'(direct / organic)') ORDER BY n DESC LIMIT 6`, [dayStart(29)]),
    all(`SELECT id, first_name, last_name, email, status, utm_source, created_at FROM ${L} ORDER BY id DESC LIMIT 8`),
  ])
  const stats: [string, number][] = [['Today', today], ['Last 7 days', d7], ['Last 30 days', d30], ['All time', total]]
  const byDay = Object.fromEntries(rows.map((r) => [String(r.d), Number(r.n)]))
  const series: { d: string; n: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = dayStart(i).slice(0, 10)
    series.push({ d, n: byDay[d] ?? 0 })
  }
  const check: [string, boolean, string][] = [
    str(S, 'offer_model') === 'broker'
      ? ['Add your broker AP link, logo and AP number', !!(str(S, 'broker_link') && str(S, 'broker_ap_id') && !str(S, 'broker_logo').includes('placeholder')), '/admin/offer']
      : ['Confirm your one-time price and add the payment link', on(S, 'price_confirmed') && !!str(S, 'price_link'), '/admin/offer'],
    ['Connect Google Analytics / Tag Manager', !!(str(S, 'ga4_id') || str(S, 'gtm_id')), '/admin/marketing'],
    ['Connect Meta (Facebook) Pixel', !!str(S, 'meta_pixel_id'), '/admin/marketing'],
    ['Turn on new-lead email alerts', on(S, 'notify_enabled') && !!str(S, 'notify_emails'), '/admin/integrations'],
    ['Add your social media links', !![str(S, 'social_instagram'), str(S, 'social_youtube'), str(S, 'social_telegram'), str(S, 'whatsapp_number')].some(Boolean), '/admin/links'],
    ['Verify your site in Google Search Console', !!str(S, 'verify_google'), '/admin/seo'],
  ]
  const b = bannerState(S, Date.now())
  return {
    stats, fresh, converted, convRate: total ? Math.round((converted / total) * 1000) / 10 : 0,
    series, sources, recent, check, now: now(),
    banner: { state: b.state, label: b.label, on: on(S, 'show_banner'), msg: str(S, 'banner_msg') },
  }
})

/* ───────────────────────── leads ───────────────────────── */

export const listLeads = createServerFn({ method: 'GET' })
  .middleware([adminMw])
  .validator((d: LeadFilters) => d ?? {})
  .handler(async ({ data }) => {
    const S = await getSettings()
    const statuses = leadStatuses(S)
    const { W, p } = leadWhere(data, statuses)
    const per = 25
    const want = Math.max(1, Number(data.page) || 1)
    const [total, rowsWanted, intRows, srcRows, cntRows] = await Promise.all([
      val(`SELECT COUNT(*) FROM ${T.leads} WHERE ${W}`, p).then(Number),
      all(`SELECT id, first_name, last_name, email, phone, interest, message, notes, utm_source, utm_campaign, status, created_at FROM ${T.leads} WHERE ${W} ORDER BY id DESC LIMIT ${per} OFFSET ${(want - 1) * per}`, p),
      all(`SELECT DISTINCT interest FROM ${T.leads} WHERE interest IS NOT NULL AND interest <> '' ORDER BY interest`),
      all(`SELECT DISTINCT utm_source FROM ${T.leads} WHERE utm_source IS NOT NULL AND utm_source <> '' ORDER BY utm_source`),
      all(`SELECT status, COUNT(*) n FROM ${T.leads} GROUP BY status`),
    ])
    const pages = Math.max(1, Math.ceil(total / per))
    const page = Math.min(pages, want)
    const rows = page === want ? rowsWanted : await all(`SELECT id, first_name, last_name, email, phone, interest, message, notes, utm_source, utm_campaign, status, created_at FROM ${T.leads} WHERE ${W} ORDER BY id DESC LIMIT ${per} OFFSET ${(page - 1) * per}`, p)
    const interests = intRows.map((r) => String(r.interest))
    const sources = srcRows.map((r) => String(r.utm_source))
    const counts = Object.fromEntries(cntRows.map((r) => [String(r.status), Number(r.n)]))
    return { rows, total, page, pages, statuses, interests, sources, counts }
  })

export const getLead = createServerFn({ method: 'GET' })
  .middleware([adminMw])
  .validator((d: { id: number }) => ({ id: Number(d?.id) || 0 }))
  .handler(async ({ data }) => {
    const S = await getSettings()
    const lead = await one(`SELECT * FROM ${T.leads} WHERE id = ?`, [data.id])
    return { lead, statuses: leadStatuses(S), siteName: str(S, 'site_name') }
  })

export const updateLead = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { id: number; status: string; notes: string; first_name: string; last_name: string; phone: string; tv_email: string }) => d)
  .handler(async ({ data, context }) => {
    const statuses = leadStatuses(await getSettings())
    const id = Number(data.id) || 0
    const st = statuses.includes(data.status) ? data.status : 'new'
    await exec(`UPDATE ${T.leads} SET status=?, notes=?, first_name=?, last_name=?, phone=?, tv_email=?, updated_at=? WHERE id=?`, [
      st, cut(data.notes, 5000), cut(data.first_name, 100), cut(data.last_name, 100), cut(data.phone, 40), cut(data.tv_email, 190), now(), id,
    ])
    await logActivity(context.admin, 'lead.update', `Lead #${id} → ${st}`)
    return { msgs: [ok('Lead updated.')] }
  })

export const deleteLead = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { id: number }) => ({ id: Number(d?.id) || 0 }))
  .handler(async ({ data, context }) => {
    await exec(`DELETE FROM ${T.leads} WHERE id=?`, [data.id])
    await logActivity(context.admin, 'lead.delete', `Lead #${data.id}`)
    return { msgs: [ok('Lead deleted.')] }
  })

export const bulkLeads = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { ids: number[]; action: 'status' | 'delete'; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const ids = (data.ids ?? []).map(Number).filter((n) => n > 0)
    if (!ids.length) return { msgs: [err('Select at least one lead.')] }
    if (data.action === 'status') {
      const statuses = leadStatuses(await getSettings())
      if (!statuses.includes(String(data.status))) return { msgs: [err('Unknown status.')] }
      await exec(`UPDATE ${T.leads} SET status=?, updated_at=? WHERE id IN (${inList(ids.length)})`, [String(data.status), now(), ...ids])
      await logActivity(context.admin, 'lead.bulk_status', `${ids.length} leads → ${data.status}`)
      return { msgs: [ok(`${ids.length} lead(s) updated.`)] }
    }
    await exec(`DELETE FROM ${T.leads} WHERE id IN (${inList(ids.length)})`, ids)
    await logActivity(context.admin, 'lead.bulk_delete', `${ids.length} leads deleted`)
    return { msgs: [ok(`${ids.length} lead(s) deleted.`)] }
  })

/* ───────────────────────── pricing & broker stats ───────────────────────── */

export const getOfferStats = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async () => {
  const cnt = async (target: string, days: number) => Number(await val(`SELECT COUNT(*) FROM ${T.clicks} WHERE target = ? AND created_at > ?`, [target, ago(days * 86400)]))
  return {
    broker7: await cnt('broker', 7), broker30: await cnt('broker', 30), brokerAll: await cnt('broker', 3650), buy30: await cnt('buy', 30),
    bySrc: await all(`SELECT COALESCE(source,'—') s, COUNT(*) n FROM ${T.clicks} WHERE target='broker' AND created_at > ? GROUP BY COALESCE(source,'—') ORDER BY n DESC`, [ago(30 * 86400)]),
    byUtm: await all(`SELECT COALESCE(NULLIF(utm_source,''),'(direct)') s, COUNT(*) n FROM ${T.clicks} WHERE target='broker' AND created_at > ? GROUP BY COALESCE(NULLIF(utm_source,''),'(direct)') ORDER BY n DESC LIMIT 6`, [ago(30 * 86400)]),
  }
})

/* ───────────────────────── campaigns ───────────────────────── */

export const getCampaigns = createServerFn({ method: 'GET' })
  .middleware([adminMw])
  .validator((d: { range: string }) => ({ range: ['7', '30', '90', 'all'].includes(d?.range) ? d.range : '30' }))
  .handler(async ({ data }) => {
    const S = await getSettings()
    const where = data.range === 'all' ? '1=1' : 'created_at >= ?'
    const p = data.range === 'all' ? [] : [dayStart(Number(data.range) - 1)]
    const rows = await all(
      `SELECT COALESCE(NULLIF(utm_source,''),'(direct)') src, COALESCE(NULLIF(utm_medium,''),'—') med, COALESCE(NULLIF(utm_campaign,''),'—') camp, COUNT(*) n,
        SUM(CASE WHEN status='converted' THEN 1 ELSE 0 END) conv,
        SUM(CASE WHEN gclid IS NOT NULL AND gclid<>'' THEN 1 ELSE 0 END) g,
        SUM(CASE WHEN fbclid IS NOT NULL AND fbclid<>'' THEN 1 ELSE 0 END) f
       FROM ${T.leads} WHERE ${where}
       GROUP BY COALESCE(NULLIF(utm_source,''),'(direct)'), COALESCE(NULLIF(utm_medium,''),'—'), COALESCE(NULLIF(utm_campaign,''),'—')
       ORDER BY n DESC LIMIT 100`, p)
    return { range: data.range, rows, siteUrl: str(S, 'seo_canonical') || siteUrl('/') }
  })

/* ───────────────────────── AI assistant ───────────────────────── */

export const getAiStats = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async () => {
  const since = ago(30 * 86400)
  const L = T.chat
  return {
    stats: [
      ['Questions (30 days)', Number(await val(`SELECT COUNT(*) FROM ${L} WHERE role='user' AND created_at > ?`, [since]))],
      ['Conversations (30 days)', Number(await val(`SELECT COUNT(DISTINCT session_id) FROM ${L} WHERE created_at > ?`, [since]))],
      ['Answered by AI', Number(await val(`SELECT COUNT(*) FROM ${L} WHERE role='assistant' AND source='ai' AND created_at > ?`, [since]))],
      ['Answered by guide search', Number(await val(`SELECT COUNT(*) FROM ${L} WHERE role='assistant' AND source='kb' AND created_at > ?`, [since]))],
    ] as [string, number][],
    kbCount: Number(await val(`SELECT COUNT(*) FROM ${T.kb} WHERE is_active = 1`)),
  }
})

/** Owner-only secrets: AI key, Resend key, SMTP password. */
export const saveSecret = createServerFn({ method: 'POST' })
  .middleware([ownerMw])
  .validator((d: { which: 'ai' | 'resend' | 'smtp'; value: string; clear?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const k = data.clear ? '' : String(data.value ?? '').trim()
    if (data.which === 'ai') {
      if (k !== '' && !/^[\x21-\x7E]{20,300}$/.test(k)) return { msgs: [err('That does not look like a valid API key.')] }
      await saveSettings({ ai_api_key: k })
      await logActivity(context.admin, 'ai.key', k === '' ? 'API key removed' : 'API key updated')
      return { msgs: [ok(k === '' ? 'API key removed — the chat now uses knowledge-base search.' : 'API key saved.')] }
    }
    if (data.which === 'resend') {
      if (k !== '' && !/^re_[A-Za-z0-9_-]{10,200}$/.test(k)) return { msgs: [err('That does not look like a Resend API key (it starts with re_).')] }
      const vals: Record<string, string> = { resend_api_key: k }
      if (k !== '') vals.mail_driver = 'resend'
      await saveSettings(vals)
      await logActivity(context.admin, 'mail.resend_key', k === '' ? 'Resend key removed' : 'Resend key updated')
      return { msgs: [ok(k === '' ? 'Resend API key removed.' : 'Resend API key saved — emails are now sent through Resend. Send a test email below.')] }
    }
    await saveSettings({ smtp_pass: k })
    await logActivity(context.admin, 'mail.smtp_pass', k === '' ? 'SMTP password removed' : 'SMTP password updated')
    return { msgs: [ok(k === '' ? 'SMTP password removed.' : 'SMTP password saved.')] }
  })

export const testEmail = createServerFn({ method: 'POST' }).middleware([adminMw]).handler(async ({ context }) => {
  const S = await getSettings()
  const to = context.admin.email
  const r = await sendMail(S, to, `${str(S, 'site_name')} — test email`, `This is a test email from your ${str(S, 'site_name')} admin.\nIf you can read this, email delivery works.\n\n${siteUrl('admin')}`)
  await logActivity(context.admin, 'integrations.test_email', r.ok ? 'sent' : 'failed')
  return { msgs: [r.ok ? ok(`Test email sent via ${r.via} to ${to}. Check your inbox (and spam).`) : err(`Sending failed via ${r.via}: ${r.error}`)] }
})

export const testWebhook = createServerFn({ method: 'POST' }).middleware([adminMw]).handler(async ({ context }) => {
  const S = await getSettings()
  const url = str(S, 'webhook_url')
  const good = /^https?:\/\//.test(url) && (await httpPostJson(url, { test: true, timestamp: now() + ' IST', firstName: 'Test', lastName: 'Lead', email: 'test@example.com', phone: '', tvUsername: 'test@example.com' }))
  await logActivity(context.admin, 'integrations.test_webhook', good ? 'ok' : 'failed')
  return { msgs: [good ? ok('Webhook responded OK.') : err('Webhook test failed — check the URL (and that the Apps Script is deployed for "Anyone").')] }
})

/* ───────────────────────── knowledge base ───────────────────────── */

export const listKb = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async () => {
  const docs = await all(`SELECT id, title, slug, is_active, updated_at, LENGTH(content) len FROM ${T.kb} ORDER BY sort_order, id`)
  return { docs, now: now() }
})

export const getKb = createServerFn({ method: 'GET' })
  .middleware([adminMw])
  .validator((d: { id: number }) => ({ id: Number(d?.id) || 0 }))
  .handler(async ({ data }) => {
    if (!data.id) return { doc: { id: 0, title: '', slug: '', content: '# New section\n\nWrite in simple language.', is_active: 1 } }
    return { doc: await one(`SELECT * FROM ${T.kb} WHERE id=?`, [data.id]) }
  })

export const saveKb = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { id: number; title: string; slug: string; content: string; is_active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const title = String(data.title ?? '').trim()
    const content = String(data.content ?? '').replace(/\r\n/g, '\n')
    const slug = (String(data.slug ?? '') || title).trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'section'
    if (!title || !content.trim()) return { id: data.id, msgs: [err('Title and content are required.')] }
    if (content.length > 60000) return { id: data.id, msgs: [err('This section is too long — split it into smaller sections (max 60,000 characters).')] }
    const active = data.is_active ? 1 : 0
    let id = Number(data.id) || 0
    if (id) {
      await exec(`UPDATE ${T.kb} SET title=?, slug=?, content=?, is_active=?, updated_at=? WHERE id=?`, [cut(title, 190), slug, content, active, now(), id])
      await logActivity(context.admin, 'kb.update', title)
    } else {
      const max = Number(await val(`SELECT MAX(sort_order) FROM ${T.kb}`)) || 0
      id = await insert(T.kb, { slug, title: cut(title, 190), content, is_active: active, sort_order: max + 10, updated_at: now() })
      await logActivity(context.admin, 'kb.add', title)
    }
    return { id, msgs: [ok('Section saved. The assistant uses it from the next question.')] }
  })

export const kbAction = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { id: number; action: 'delete' | 'toggle' | 'up' | 'down' }) => d)
  .handler(async ({ data, context }) => {
    const id = Number(data.id) || 0
    if (data.action === 'delete') {
      const t = await val(`SELECT title FROM ${T.kb} WHERE id=?`, [id])
      await exec(`DELETE FROM ${T.kb} WHERE id=?`, [id])
      await logActivity(context.admin, 'kb.delete', String(t ?? ''))
      return { msgs: [ok('Section deleted.')] }
    }
    if (data.action === 'toggle') {
      await exec(`UPDATE ${T.kb} SET is_active = 1 - is_active, updated_at=? WHERE id=?`, [now(), id])
      return { msgs: [ok('Updated.')] }
    }
    const ids = (await all(`SELECT id FROM ${T.kb} ORDER BY sort_order, id`)).map((r) => Number(r.id))
    const pos = ids.indexOf(id)
    const swap = data.action === 'up' ? pos - 1 : pos + 1
    if (pos >= 0 && swap >= 0 && swap < ids.length) [ids[pos], ids[swap]] = [ids[swap]!, ids[pos]!]
    for (let i = 0; i < ids.length; i++) await exec(`UPDATE ${T.kb} SET sort_order=? WHERE id=?`, [(i + 1) * 10, ids[i]!])
    return { msgs: [] as Msg[] }
  })

export const restoreKbDefaults = createServerFn({ method: 'POST' }).middleware([ownerMw]).handler(async ({ context }) => {
  const n = await restoreKb()
  await logActivity(context.admin, 'kb.restore', `${n} default sections`)
  return { msgs: [ok(`Knowledge base restored to the default NiftyMeter guide (${n} sections).`)] }
})

/* ───────────────────────── chat logs ───────────────────────── */

export const listChats = createServerFn({ method: 'GET' })
  .middleware([adminMw])
  .validator((d: { q?: string }) => ({ q: String(d?.q ?? '').trim() }))
  .handler(async ({ data }) => {
    const L = T.chat
    const where = data.q ? `WHERE session_id IN (SELECT session_id FROM ${L} WHERE content LIKE ?)` : ''
    const p = data.q ? [`%${data.q}%`] : []
    const sessions = await all(
      `SELECT session_id, MIN(created_at) started, MAX(created_at) last_at, COUNT(*) n,
        SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) questions, SUM(CASE WHEN source='kb' THEN 1 ELSE 0 END) fallback
       FROM ${L} ${where} GROUP BY session_id ORDER BY MAX(id) DESC LIMIT 100`, p)
    const firstQ: Record<string, string> = {}
    if (sessions.length) {
      const ids = sessions.map((s) => String(s.session_id))
      for (const r of await all(`SELECT session_id, content FROM ${L} WHERE role='user' AND session_id IN (${inList(ids.length)}) ORDER BY id DESC`, ids)) {
        firstQ[String(r.session_id)] = String(r.content)
      }
    }
    const top = await all(`SELECT content, COUNT(*) n FROM ${L} WHERE role='user' AND created_at > ? GROUP BY content ORDER BY n DESC LIMIT 8`, [ago(30 * 86400)])
    return { sessions, firstQ, top, now: now() }
  })

export const getChat = createServerFn({ method: 'GET' })
  .middleware([adminMw])
  .validator((d: { sid: string }) => ({ sid: /^[a-f0-9]{16,64}$/.test(String(d?.sid)) ? String(d.sid) : '' }))
  .handler(async ({ data }) => ({
    msgs: data.sid ? await all(`SELECT role, content, source, created_at FROM ${T.chat} WHERE session_id = ? ORDER BY id`, [data.sid]) : [],
  }))

export const chatAction = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { action: 'delete' | 'purge'; sid?: string }) => d)
  .handler(async ({ data, context }) => {
    if (data.action === 'delete' && /^[a-f0-9]{16,64}$/.test(String(data.sid))) {
      await exec(`DELETE FROM ${T.chat} WHERE session_id = ?`, [String(data.sid)])
      await logActivity(context.admin, 'chat.delete', 'Conversation deleted')
      return { msgs: [ok('Conversation deleted.')] }
    }
    const n = await exec(`DELETE FROM ${T.chat} WHERE created_at < ?`, [ago(90 * 86400)])
    await logActivity(context.admin, 'chat.purge', `${n} messages older than 90 days`)
    return { msgs: [ok(`${n} old messages deleted.`)] }
  })

/** Admin test chat (same answer logic as the public widget, but no rate limit). */
export const adminTestChat = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { message: string }) => ({ message: String(d?.message ?? '').trim().slice(0, 600) }))
  .handler(async ({ data }) => {
    const S = await getSettings()
    if (!data.message) return { ok: false, reply: '', source: '', error: 'Please type a question.' }
    const r = await aiComplete(S, [{ role: 'user', content: data.message }])
    if (r.ok) return { ok: true, reply: r.text, source: 'ai', error: '' }
    return { ok: true, reply: await kbSearchAnswer(S, data.message), source: 'kb', error: str(S, 'ai_api_key') ? r.error : '' }
  })

/* ───────────────────────── site settings / housekeeping ───────────────────────── */

export const getSystemInfo = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async () => {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/niftymeter.db'
  return {
    info: [
      ['Version', '2.0.0 (TanStack Start)'],
      ['Node.js', process.version],
      ['Database', dbUrl.startsWith('file:') ? 'SQLite file (libSQL)' : 'libSQL / Turso (remote)'],
      ['Server time', new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + (process.env.TZ || '')],
      ['Upload limit', '5 MB per image'],
      ['HTTPS', siteUrl('/').startsWith('https://') ? 'Yes ✓' : 'No — put the site behind HTTPS'],
      ['Leads stored', Number(await val(`SELECT COUNT(*) FROM ${T.leads}`)).toLocaleString('en-US')],
    ] as [string, string][],
  }
})

export const housekeeping = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { action: 'purge_leads' | 'purge_log'; days?: number }) => d)
  .handler(async ({ data, context }) => {
    if (data.action === 'purge_leads') {
      const days = Math.max(30, Number(data.days) || 365)
      const n = await exec(`DELETE FROM ${T.leads} WHERE created_at < ?`, [ago(days * 86400)])
      await logActivity(context.admin, 'leads.purge', `${n} leads older than ${days} days`)
      return { msgs: [ok(`${n} old lead(s) deleted.`)] }
    }
    const n = await exec(`DELETE FROM ${T.activity} WHERE created_at < ?`, [ago(90 * 86400)])
    return { msgs: [ok(`${n} old log entries deleted.`)] }
  })

/* ───────────────────────── users ───────────────────────── */

export const listUsers = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async ({ context }) => {
  const S = await getSettings()
  return {
    users: await all(`SELECT id, name, email, role, is_active, last_login, created_at FROM ${T.admins} ORDER BY id`),
    me: context.admin, now: now(), pwMin: Math.max(8, Number(str(S, 'pw_min_length', '10')) || 10),
  }
})

export const userAction = createServerFn({ method: 'POST' })
  .middleware([ownerMw])
  .validator((d: { action: 'add' | 'toggle' | 'role' | 'reset' | 'link' | 'delete'; id?: number; name?: string; email?: string; password?: string; role?: string }) => d)
  .handler(async ({ data, context }) => {
    const S = await getSettings()
    const A = T.admins
    if (data.action === 'add') {
      const name = String(data.name ?? '').trim()
      const email = String(data.email ?? '').trim().toLowerCase()
      const pw = String(data.password ?? '')
      const role = data.role === 'owner' ? 'owner' : 'admin'
      if (!name || !isEmail(email)) return { msgs: [err('Enter a name and a valid email.')] }
      const pe = passwordProblem(S, pw)
      if (pe) return { msgs: [err(pe)] }
      if (Number(await val(`SELECT COUNT(*) FROM ${A} WHERE email = ?`, [email]))) return { msgs: [err('An admin with that email already exists.')] }
      await insert(A, { name: cut(name, 100), email, password_hash: await hashPassword(pw), role, is_active: 1, created_at: now() })
      await logActivity(context.admin, 'user.add', `${email} (${role})`)
      return { msgs: [ok(`Admin ${email} added. Share the password with them securely.`)] }
    }
    const id = Number(data.id) || 0
    if (!id || id === context.admin.id) return { msgs: [err('You cannot change your own account here — use My Account.')] }
    const u = await one(`SELECT * FROM ${A} WHERE id = ?`, [id])
    if (!u) return { msgs: [err('User not found.')] }
    const owners = Number(await val(`SELECT COUNT(*) FROM ${A} WHERE role='owner' AND is_active=1`))
    switch (data.action) {
      case 'toggle':
        if (u.role === 'owner' && Number(u.is_active) === 1 && owners <= 1) return { msgs: [err('You cannot disable the last owner.')] }
        await exec(`UPDATE ${A} SET is_active = ? WHERE id = ?`, [Number(u.is_active) ? 0 : 1, id])
        if (Number(u.is_active)) await endOtherSessions(id, false)
        await logActivity(context.admin, 'user.toggle', String(u.email))
        return { msgs: [ok('Updated.')] }
      case 'role': {
        const role = u.role === 'owner' ? 'admin' : 'owner'
        if (role === 'admin' && owners <= 1) return { msgs: [err('You cannot demote the last owner.')] }
        await exec(`UPDATE ${A} SET role = ? WHERE id = ?`, [role, id])
        await logActivity(context.admin, 'user.role', `${u.email} → ${role}`)
        return { msgs: [ok('Role changed.')] }
      }
      case 'reset': {
        const pw = String(data.password ?? '')
        const pe = passwordProblem(S, pw)
        if (pe) return { msgs: [err(pe)] }
        await exec(`UPDATE ${A} SET password_hash = ? WHERE id = ?`, [await hashPassword(pw), id])
        await endOtherSessions(id, false)
        await logActivity(context.admin, 'user.reset_password', String(u.email))
        return { msgs: [ok(`Password reset for ${u.email}.`)] }
      }
      case 'link': {
        const r = await resetSendEmail({ name: String(u.name), email: String(u.email) }, await resetCreate(S, id, 'owner'), S)
        await logActivity(context.admin, 'password.link_sent', u.email + (r.ok ? '' : ' · FAILED'))
        return { msgs: [r.ok ? ok(`Reset link emailed to ${u.email}.`) : err('Could not send: ' + r.error)] }
      }
      case 'delete':
        if (u.role === 'owner' && owners <= 1) return { msgs: [err('You cannot delete the last owner.')] }
        await exec(`DELETE FROM ${A} WHERE id = ?`, [id])
        await endOtherSessions(id, false)
        await logActivity(context.admin, 'user.delete', String(u.email))
        return { msgs: [ok('Admin removed.')] }
    }
    return { msgs: [] as Msg[] }
  })

/* ───────────────────────── password & security ───────────────────────── */

export const getSecurity = createServerFn({ method: 'GET' }).middleware([adminMw]).handler(async ({ context }) => {
  const S = await getSettings()
  const driver = str(S, 'mail_driver')
  const mailReady = driver === 'resend' ? !!str(S, 'resend_api_key') : driver === 'none' ? false : !!str(S, 'smtp_host')
  return {
    me: context.admin,
    isOwner: context.admin.role === 'owner',
    mailReady, driver,
    admins: await all(`SELECT id, name, email, role, is_active, last_login FROM ${T.admins} ORDER BY id`),
    fails: await all(`SELECT ip, email, attempted_at FROM ${T.attempts} ORDER BY id DESC LIMIT 15`),
    resets: await all(`SELECT r.created_at, r.expires_at, r.used_at, r.requested_by, r.ip, a.email FROM ${T.resets} r LEFT JOIN ${T.admins} a ON a.id = r.admin_id WHERE r.admin_id > 0 ORDER BY r.id DESC LIMIT 15`),
    pwMin: Math.max(8, Number(str(S, 'pw_min_length', '10')) || 10),
    pwMix: on(S, 'pw_require_mix'),
    lockMinutes: LOCK_MINUTES, maxAttempts: MAX_ATTEMPTS,
    now: now(),
  }
})

export const changeMyPassword = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { current: string; next: string; next2: string }) => d)
  .handler(async ({ data, context }) => {
    const S = await getSettings()
    const me = await one(`SELECT * FROM ${T.admins} WHERE id = ?`, [context.admin.id])
    if (!me || !(await verifyPassword(String(data.current ?? ''), String(me.password_hash)))) return { msgs: [err('Your current password is incorrect.')] }
    const n1 = String(data.next ?? '')
    const pe = passwordProblem(S, n1)
    if (pe) return { msgs: [err(pe)] }
    if (n1 !== String(data.next2 ?? '')) return { msgs: [err('The new passwords do not match.')] }
    if (await verifyPassword(n1, String(me.password_hash))) return { msgs: [err('Choose a password different from the current one.')] }
    await exec(`UPDATE ${T.admins} SET password_hash = ? WHERE id = ?`, [await hashPassword(n1), me.id])
    await endOtherSessions(context.admin.id, true)
    await logActivity(context.admin, 'password.changed', 'Own password changed')
    return { msgs: [ok('Your password has been changed.')] }
  })

export const securityAction = createServerFn({ method: 'POST' })
  .middleware([ownerMw])
  .validator((d: { action: 'send_link' | 'unlock' | 'revoke'; id?: number }) => d)
  .handler(async ({ data, context }) => {
    if (data.action === 'send_link') {
      const S = await getSettings()
      const u = await one(`SELECT id, name, email FROM ${T.admins} WHERE id = ? AND is_active = 1`, [Number(data.id) || 0])
      if (!u) return { msgs: [err('Admin not found or disabled.')] }
      const r = await resetSendEmail({ name: String(u.name), email: String(u.email) }, await resetCreate(S, Number(u.id), 'owner'), S)
      await logActivity(context.admin, 'password.link_sent', u.email + (r.ok ? '' : ' · FAILED'))
      return { msgs: [r.ok ? ok(`Reset link sent to ${u.email}.`) : err(`Could not send the email: ${r.error} — check Email & Integrations.`)] }
    }
    if (data.action === 'unlock') {
      const n = await exec(`DELETE FROM ${T.attempts}`)
      await logActivity(context.admin, 'security.unlock', `${n} failed attempts cleared`)
      return { msgs: [ok('Sign-in lockouts cleared.')] }
    }
    const n = await exec(`UPDATE ${T.resets} SET used_at = ? WHERE used_at IS NULL`, [now()])
    await logActivity(context.admin, 'security.revoke', `${n} reset links revoked`)
    return { msgs: [ok(`${n} unused reset link(s) revoked.`)] }
  })

/* ───────────────────────── my account ───────────────────────── */

export const updateProfile = createServerFn({ method: 'POST' })
  .middleware([adminMw])
  .validator((d: { name: string; email: string; current: string }) => d)
  .handler(async ({ data, context }) => {
    const me = await one(`SELECT * FROM ${T.admins} WHERE id = ?`, [context.admin.id])
    if (!me || !(await verifyPassword(String(data.current ?? ''), String(me.password_hash)))) return { msgs: [err('Your current password is incorrect.')] }
    const name = String(data.name ?? '').trim()
    const email = String(data.email ?? '').trim().toLowerCase()
    if (!name || !isEmail(email)) return { msgs: [err('Enter a name and a valid email.')] }
    if (Number(await val(`SELECT COUNT(*) FROM ${T.admins} WHERE email = ? AND id <> ?`, [email, me.id]))) return { msgs: [err('That email is used by another admin.')] }
    await exec(`UPDATE ${T.admins} SET name = ?, email = ? WHERE id = ?`, [cut(name, 100), email, me.id])
    await logActivity(context.admin, 'account.profile', email)
    return { msgs: [ok('Profile updated.')] }
  })

/* ───────────────────────── activity ───────────────────────── */

export const listActivity = createServerFn({ method: 'GET' })
  .middleware([adminMw])
  .validator((d: { page?: number }) => ({ page: Number(d?.page) || 1 }))
  .handler(async ({ data }) => {
    const per = 50
    const total = Number(await val(`SELECT COUNT(*) FROM ${T.activity}`))
    const pages = Math.max(1, Math.ceil(total / per))
    const page = Math.max(1, Math.min(pages, data.page))
    const rows = await all(`SELECT * FROM ${T.activity} ORDER BY id DESC LIMIT ${per} OFFSET ${(page - 1) * per}`)
    return { rows, page, pages }
  })

/* ───────────────────────── backup restore ───────────────────────── */

export const restoreBackup = createServerFn({ method: 'POST' })
  .middleware([ownerMw])
  .validator((d: { json: string }) => ({ json: String(d?.json ?? '') }))
  .handler(async ({ data, context }) => {
    if (data.json.length > 5 * 1024 * 1024) return { msgs: [err('File too large.')] }
    let parsed: any
    try { parsed = JSON.parse(data.json) } catch { return { msgs: [err('This is not a NiftyMeter settings backup.')] } }
    if (!parsed || parsed.app !== 'niftymeter' || typeof parsed.settings !== 'object' || !parsed.settings) return { msgs: [err('This is not a NiftyMeter settings backup.')] }
    const skip = new Set(['ai_api_key', 'resend_api_key', 'smtp_pass', 'schema_version'])
    const vals: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.settings as Record<string, unknown>)) {
      if (!(k in DEFAULTS) || skip.has(k)) continue
      vals[k] = isListKey(k) ? (Array.isArray(v) ? v : []) : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
    }
    await saveSettings(vals)
    let kbn = 0
    if (Array.isArray(parsed.knowledge_base) && parsed.knowledge_base.length) {
      await exec(`DELETE FROM ${T.kb}`)
      for (const [i, d] of (parsed.knowledge_base as any[]).entries()) {
        if (!d || typeof d !== 'object' || !d.title || d.content === undefined) continue
        await insert(T.kb, {
          slug: String(d.slug ?? 'section').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100) || 'section',
          title: cut(d.title, 190), content: String(d.content), is_active: d.is_active ? 1 : 0,
          sort_order: Number(d.sort_order ?? (i + 1) * 10) || 0, updated_at: now(),
        })
        kbn++
      }
    }
    await logActivity(context.admin, 'backup.restore', `${Object.keys(vals).length} settings, ${kbn} knowledge-base sections restored`)
    return { msgs: [ok(`${Object.keys(vals).length} settings${kbn ? ` and ${kbn} knowledge-base sections` : ''} restored from backup.`)] }
  })
