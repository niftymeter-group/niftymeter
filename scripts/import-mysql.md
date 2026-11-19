# Moving data from the PHP / MySQL version

The new app uses the **same table names and columns** (`nm_admins`, `nm_settings`, `nm_leads`, `nm_kb_docs`, `nm_chat_logs`, `nm_clicks`, `nm_activity`, …).

**Easiest path — settings & knowledge base:** in the old admin open *Backup & Restore › Download settings backup*, then in the new admin *Backup & Restore › Restore from file*. Leads can be exported from the old *Leads › Export CSV*.

**Everything (including leads and admin logins):**

1. In phpMyAdmin export each `nm_*` table as **SQL → data only** (INSERT statements).
2. Start the new app once (`npm run dev`) so it creates the SQLite database, then stop it.
3. Run the INSERTs against `data/niftymeter.db`, e.g. with the `sqlite3` CLI: `sqlite3 data/niftymeter.db < leads.sql`
   (remove MySQL-only bits such as backticks around names if sqlite complains, or use a converter like `mysql2sqlite`).
4. Old admin passwords keep working — PHP `$2y$` bcrypt hashes are accepted and upgraded on the next sign-in.

Uploaded images from the old `uploads/` folder are not in MySQL: re-upload them in the admin (or put them in `public/uploads/…` with the same paths).
