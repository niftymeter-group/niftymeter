/** POST /api/lead — enquiry form. Saves the lead, then emails/auto-replies/webhook. */
import { createFileRoute } from '@tanstack/react-router'
import { ago, exec, insert, now, one, T, val } from '~/server/db.server'
import { httpPostJson, sendMail } from '~/server/mail.server'
import { clientIp, json, siteUrl, userAgent } from '~/server/request.server'
import { getSettings, on, str } from '~/server/settings.server'

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export const Route = createFileRoute('/api/lead')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let input: Record<string, unknown> = {}
        try { input = (await request.json()) as Record<string, unknown> } catch { /* empty */ }
        const f = (k: string, max = 190) => {
          const v = input[k]
          const s = typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''
          return Array.from(s.replace(/[\x00-\x1F\x7F]/g, '')).slice(0, max).join('')
        }
        // Honeypot: real users never fill the hidden "website" field
        if (f('website') !== '') return json({ ok: true })
        const lead = {
          first_name: f('first_name', 100), last_name: f('last_name', 100), email: f('email').toLowerCase(), phone: f('phone', 40),
          tv_email: f('tv_email').toLowerCase(), interest: f('interest', 80),
          message: Array.from(String(input.message ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()).slice(0, 1000).join(''),
        }
        if (!lead.first_name) return json({ ok: false, error: 'Please enter your first name.' }, 422)
        if (!isEmail(lead.email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 422)
        if (lead.tv_email && !isEmail(lead.tv_email)) return json({ ok: false, error: 'Please enter a valid TradingView email ID, or leave it empty.' }, 422)
        if (!/^[0-9+()\-\s.]{6,40}$/.test(lead.phone)) return json({ ok: false, error: 'Please enter a valid WhatsApp number.' }, 422)
        if (!lead.interest) lead.interest = 'General enquiry'

        const ip = clientIp(request)
        const attr: Record<string, string | null> = {}
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) attr[k] = f(k) || null
        attr.referrer = f('referrer', 255) || null
        attr.landing_page = f('landing_page', 255) || null
        let id = 0
        try {
          // Throttle: max 5 submissions per IP per hour
          const recent = Number(await val(`SELECT COUNT(*) FROM ${T.leads} WHERE ip = ? AND created_at > ?`, [ip, ago(3600)]))
          if (recent >= 5) return json({ ok: false, error: 'Too many requests. Please try again later.' }, 429)
          // Same email within 24 h → update the existing lead instead of duplicating it
          const dupe = await one(`SELECT id, message FROM ${T.leads} WHERE email = ? AND created_at > ?`, [lead.email, ago(86400)])
          if (dupe) {
            const msg = (String(dupe.message ?? '') + (lead.message ? '\n---\n' + lead.message : '')).trim().slice(0, 5000)
            await exec(`UPDATE ${T.leads} SET first_name=?, last_name=?, phone=?, tv_email=COALESCE(NULLIF(?, ''), tv_email), interest=?, message=?, status='new', updated_at=? WHERE id=?`,
              [lead.first_name, lead.last_name, lead.phone, lead.tv_email, lead.interest, msg, now(), dupe.id])
            return json({ ok: true })
          }
          id = await insert(T.leads, { ...lead, ...attr, status: 'new', ip, user_agent: userAgent(request), created_at: now(), updated_at: now() })
        } catch (e) {
          console.error('NiftyMeter lead save failed', e)
          return json({ ok: false, error: 'Could not save your request. Please try again shortly.' }, 500)
        }

        // Side-effects (alerts, auto-reply, webhook) — capped so the visitor never waits long
        const S = await getSettings()
        const site = str(S, 'site_name')
        const vars: Record<string, string> = {
          '{first_name}': lead.first_name, '{last_name}': lead.last_name, '{email}': lead.email, '{phone}': lead.phone,
          '{tv_email}': lead.tv_email, '{interest}': lead.interest, '{message}': lead.message, '{site_name}': site,
        }
        const fill = (t: string) => Object.entries(vars).reduce((acc, [k, v]) => acc.split(k).join(v), t)
        const jobs: Promise<unknown>[] = []
        if (on(S, 'notify_enabled') && str(S, 'notify_emails')) {
          const body = `New enquiry on ${site}\n\nInterested in: ${lead.interest}\nName:        ${lead.first_name} ${lead.last_name}\nEmail:       ${lead.email}\nWhatsApp:    ${lead.phone}\nTradingView: ${lead.tv_email || '—'}\n`
            + (lead.message ? `Message:\n${lead.message}\n\n` : '')
            + `Source:      ${attr.utm_source || 'direct'}${attr.utm_campaign ? ' / ' + attr.utm_campaign : ''}\n\nManage leads: ${siteUrl('admin/leads/' + id, request)}\n`
          for (const to of str(S, 'notify_emails').split(',').map((x) => x.trim()).filter(isEmail)) {
            jobs.push(sendMail(S, to, `New enquiry (${lead.interest}): ${lead.first_name} ${lead.last_name}`, body, lead.email))
          }
        }
        if (on(S, 'autoreply_enabled')) jobs.push(sendMail(S, lead.email, fill(str(S, 'autoreply_subject')), fill(str(S, 'autoreply_body')), str(S, 'contact_email')))
        if (on(S, 'webhook_enabled') && /^https?:\/\//.test(str(S, 'webhook_url'))) {
          jobs.push(httpPostJson(str(S, 'webhook_url'), {
            timestamp: now() + ' IST', firstName: lead.first_name, lastName: lead.last_name, email: lead.email, phone: lead.phone,
            tvUsername: lead.tv_email, interest: lead.interest, message: lead.message, utmSource: attr.utm_source, utmCampaign: attr.utm_campaign, leadId: id,
          }))
        }
        if (jobs.length) await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 8000))])
        return json({ ok: true })
      },
    },
  },
})
