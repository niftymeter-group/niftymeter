/** Field definitions for every schema-driven admin form (port of admin/inc/schemas.php + per-page $fields). */
import contentJson from './data/content_schemas.json'
import pageJson from './data/page_schemas.json'

export type FieldType =
  | 'text' | 'textarea' | 'rich' | 'lines' | 'code' | 'url' | 'email' | 'number'
  | 'toggle' | 'color' | 'datetime' | 'image' | 'select' | 'repeater' | 'heading'

export interface Field {
  key: string
  label?: string
  type?: FieldType
  help?: string
  placeholder?: string
  rows?: number
  wide?: boolean
  min?: number
  max?: number
  maxlen?: number
  options?: [string, string][]
  item?: string
  title_field?: string
  fields?: Field[]
  default?: string
}

const fixHelp = (s: string) =>
  s
    .replace(/go\.php\?to=broker/g, '/go?to=broker')
    .replace(/href="([a-z]+)\.php(\?[^"]*)?"/g, (_m, p: string, q?: string) => `href="/admin/${p === 'index' ? '' : p}${q ? q.replace('?tab=', '?tab=') : ''}"`)
    .replace(/<code>assets\/img\//g, '<code>assets/img/')
    .replace(/Shared-host PHP mail often lands in spam or is blocked\./g, 'SMTP works with Gmail, Zoho, Hostinger mail and most providers.')

function fix(fields: Field[]): Field[] {
  return fields.map((f) => ({
    ...f,
    help: f.help ? fixHelp(f.help) : f.help,
    fields: f.fields ? fix(f.fields) : undefined,
  }))
}

export const CONTENT_TABS: Record<string, [string, Field[]]> = Object.fromEntries(
  Object.entries(contentJson as unknown as Record<string, [string, Field[]]>).map(([k, [t, f]]) => [k, [t, fix(f)]]),
)

const P = pageJson as unknown as Record<string, Record<string, Field[]>>

export const OFFER_GENERAL = fix(P.offer!.general!)
export const OFFER_PRICING = fix(P.offer!.pricing!)
export const OFFER_BROKER = fix(P.offer!.broker!)
export const LINKS_FIELDS = fix(P.links!.fields!)
export const BRANDING_FIELDS = fix(P.branding!.fields!)
export const SECTIONS_FIELDS = fix(P.sections!.fields!)
export const MARKETING_FIELDS = fix(P.marketing!.fields!)
export const MARKETING_CODE_FIELDS = fix(P.marketing!.codeFields!)
export const SEO_FIELDS = fix(P.seo!.fields!)
export const AI_FIELDS = fix(P.ai!.fields!)
export const SETTINGS_FIELDS = fix(P.settings!.fields!)
export const POLICY_FIELDS = fix(P.security!.policy!)

/** Email delivery: PHP mail() is replaced by SMTP in the Node version. */
export const INTEGRATIONS_FIELDS: Field[] = fix(P.integrations!.fields!).flatMap((f): Field[] => {
  if (f.key === 'mail_driver') {
    return [
      { ...f, options: [['resend', 'Resend API (recommended)'], ['smtp', 'SMTP server (Gmail, Zoho, Hostinger…)'], ['none', 'Do not send emails']] },
    ]
  }
  if (f.key === 'mail_from_name') {
    return [
      f,
      { key: 'h3b', label: 'SMTP (only if "Send emails with" is SMTP)', type: 'heading', help: 'The SMTP password is set separately below (owners only).' },
      { key: 'smtp_host', label: 'SMTP host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'smtp_port', label: 'SMTP port', type: 'number', min: 1, max: 65535, help: '465 (SSL) or 587 (STARTTLS).' },
      { key: 'smtp_user', label: 'SMTP username', type: 'text' },
      { key: 'smtp_secure', label: 'Use SSL/TLS from the start (port 465)', type: 'toggle' },
    ]
  }
  return [f]
})

/** Every group the client may save. The server only accepts keys listed here. */
export function groupFields(group: string, isOwner: boolean): Field[] | null {
  if (group.startsWith('content:')) {
    const t = CONTENT_TABS[group.slice(8)]
    return t ? t[1] : null
  }
  switch (group) {
    case 'offer': return [...OFFER_GENERAL, ...OFFER_PRICING, ...OFFER_BROKER]
    case 'links': return LINKS_FIELDS
    case 'branding': return BRANDING_FIELDS
    case 'sections': return SECTIONS_FIELDS
    case 'marketing': return isOwner ? [...MARKETING_FIELDS, ...MARKETING_CODE_FIELDS] : MARKETING_FIELDS
    case 'seo': return SEO_FIELDS
    case 'integrations': return INTEGRATIONS_FIELDS
    case 'ai': return AI_FIELDS
    case 'settings': return SETTINGS_FIELDS
    case 'policy': return isOwner ? POLICY_FIELDS : null
  }
  return null
}

/** Flatten keys (excluding headings) for a list of fields. */
export function fieldKeys(fields: Field[]): string[] {
  return fields.filter((f) => f.type !== 'heading').map((f) => f.key)
}
