import { createFileRoute, Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef } from 'react'
import { ask, flash, useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { getSecurity, restoreBackup } from '~/fns/admin'

export const Route = createFileRoute('/admin/_panel/backup')({
  loader: () => getSecurity(),
  component: Backup,
})

function Backup() {
  const d = Route.useLoaderData()
  const run = useAction()
  const restore = useServerFn(restoreBackup)
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <Page title="Backup & Restore" sub="Download all your website content & settings as one file, or restore from a previous backup.">
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2>💾 Download backup</h2></div>
          <p className="muted">Includes all content, links, branding, SEO, tracking, assistant and integration settings, plus the AI knowledge base. Does not include API keys (AI, Resend, SMTP), leads (export those from <Link to="/admin/leads">Leads</Link>) or uploaded images (those live in the database — back it up for a full copy).</p>
          <a className="btn btn-primary" href="/api/admin/backup">⬇ Download settings backup (.json)</a>
        </div>
        <div className="card">
          <div className="card-head"><h2>♻ Restore</h2></div>
          {d.isOwner ? (
            <form onSubmit={async (e) => {
              e.preventDefault()
              const file = fileRef.current?.files?.[0]
              if (!file) { flash({ type: 'err', text: 'Choose a backup .json file.' }); return }
              if (!ask('Restore settings from this file? Current settings will be overwritten.')) return
              const json = await file.text()
              await run(() => restore({ data: { json } }))
              if (fileRef.current) fileRef.current.value = ''
            }}>
              <div className="field"><input ref={fileRef} className="input" type="file" accept="application/json,.json" required /></div>
              <button className="btn">Restore from file</button>
            </form>
          ) : <p className="muted">Only owners can restore backups.</p>}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Full server backup</h2></div>
        <p className="help">For a complete backup copy the database: the <code>data/niftymeter.db</code> file (SQLite), or use your Turso dashboard's backups. Do this before major changes.</p>
      </div>
    </Page>
  )
}
