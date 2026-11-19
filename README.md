# NiftyMeter — TanStack Start edition

The NiftyMeter landing page + admin console, rebuilt from the PHP version on **TanStack Start** (React 19, Vite, server functions) with a **libSQL / SQLite** database.
Same pages, same look (the original CSS is reused as-is), same admin features.

## Quick start

```bash
npm install
cp .env.example .env        # optional — defaults work for local use
npm run dev                 # http://localhost:3000
```

Open **http://localhost:3000/admin** — on first run you'll be asked to create the **owner account** (this replaces `install.php` and locks itself afterwards). The database (`data/niftymeter.db`) and default knowledge base are created automatically.

Production:

```bash
npm run build
npm start                   # node .output/server/index.mjs (reads .env)
```

Requires **Node.js 22.9+**.

## Hosting

| Host | Database setting |
|---|---|
| VPS / Docker / Railway / Render / Fly (persistent disk) | `DATABASE_URL=file:./data/niftymeter.db` (default) |
| Vercel / Netlify / Cloudflare (serverless, no disk) | Create a free [Turso](https://turso.tech) DB → `DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN=…`. For non-Node targets set the Nitro preset (see TanStack Start "Hosting" docs). |

Uploaded images are stored **in the database**, so they survive redeploys on any host.
Plain cPanel shared hosting (PHP-only) can't run this version — it needs a Node host.

Other env vars: `SITE_URL` (public address, used in emails/sitemap), `TZ` (default `Asia/Kolkata`), `TRUST_PROXY=1` behind Cloudflare / a reverse proxy.

## What maps to what

| PHP | TanStack Start |
|---|---|
| `index.php` | `src/routes/index.tsx` (+ `src/components/site/*`) |
| `guide.php` (admins only) | `src/routes/guide.tsx` → `/guide` |
| `api/lead.php`, `api/chat.php`, `api/recent.php` | `src/routes/api/*.ts` → `/api/lead`, `/api/chat`, `/api/recent` |
| `go.php?to=broker` | `/go?to=broker` (`src/routes/go.ts`) |
| `robots.php`, `sitemap.php` | `/robots.txt`, `/sitemap.xml` |
| `admin/*.php` | `src/routes/admin/_panel/*.tsx` → `/admin/…` |
| `admin/login.php`, `forgot.php`, `reset.php` | `/admin/login`, `/admin/forgot`, `/admin/reset` |
| `install.php` | `/admin/setup` (first run only) |
| `admin/upload.php`, leads CSV, backup download | `/api/admin/upload`, `/api/admin/leads-csv`, `/api/admin/backup` |
| `includes/*.php` | `src/server/*.server.ts` (server-only) + `src/lib/*` (shared) |
| `admin/inc/schemas.php` + per-page fields | `src/lib/schemas.ts` (+ `src/lib/data/*.json`) |
| `tools/reset-admin-password.php` | `npm run reset-password -- you@example.com "NewPass123"` |
| `PHP mail()` | **SMTP** (or Resend, as before) — Admin › Email & Integrations |

## Security (same rules as before)

- bcrypt passwords; old PHP `$2y$` hashes keep working and are upgraded on sign-in.
- Sessions in the database, HttpOnly + SameSite=Lax cookie, 2 h idle timeout; all sessions of a user end on password change.
- Server functions are protected by TanStack Start's built-in CSRF (same-origin) check; uploads also check `Origin`.
- 5 failed sign-ins per IP → 15-minute lock. Reset links are single-use, hashed, time-limited, rate-limited.
- Lead form: honeypot + 5 per IP per hour. Chat: per-IP hourly limit, 600-char messages, server-side history.
- API keys (AI, Resend, SMTP password) are never sent to the browser and are excluded from backups.
- `/go` only redirects to the configured links (no open redirect). SVG uploads are refused.

## Notes

- **Custom code** (Ads & Tracking › custom head/body) is rendered into the server HTML, so its `<script>` tags run on page load. It is placed at the start/end of `<body>` rather than inside `<head>`; verification meta tags have their own fields in SEO & Meta.
- Moving data from the PHP/MySQL site: see `scripts/import-mysql.md`.
