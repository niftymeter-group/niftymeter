/** Default content & settings. Anything saved in Admin overrides these. (port of includes/defaults.php) */
import json from './data/defaults.json'

export type SettingValue = string | Record<string, string>[]
export type Settings = Record<string, SettingValue>

export const DEFAULTS: Settings = {
  ...(json as unknown as Settings),
  // Node version: PHP mail() is replaced by Resend / SMTP
  mail_driver: 'resend',
  smtp_host: '',
  smtp_port: '465',
  smtp_user: '',
  smtp_secure: '1',
}

/** Settings that must never be sent to a browser. */
export const SECRET_KEYS = ['ai_api_key', 'resend_api_key', 'smtp_pass'] as const

/** Settings the public website never needs (kept out of page data). */
export const PRIVATE_KEYS = new Set<string>([
  ...SECRET_KEYS,
  'notify_emails', 'notify_enabled', 'autoreply_enabled', 'autoreply_subject', 'autoreply_body',
  'mail_driver', 'mail_from', 'mail_from_name', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_secure',
  'webhook_enabled', 'webhook_url', 'pw_min_length', 'pw_require_mix', 'reset_ttl', 'lead_statuses',
  'ai_provider', 'ai_model', 'ai_base_url', 'ai_max_tokens', 'ai_rate_limit', 'ai_extra', 'robots_extra',
  'schema_version', 'price_confirmed',
])

export function isListKey(key: string): boolean {
  return Array.isArray(DEFAULTS[key])
}
