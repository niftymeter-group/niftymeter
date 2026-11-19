import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { useDirtyGuard } from '~/components/admin/Fields'
import { flash, useAction } from '~/components/admin/flash'
import { Page } from '~/components/admin/ui'
import { getKb, saveKb } from '~/fns/admin'
import { mdToHtml } from '~/lib/markdown'

export const Route = createFileRoute('/admin/_panel/kb/$id')({
  loader: ({ params }) => getKb({ data: { id: params.id === 'new' ? 0 : Number(params.id) } }),
  component: KbEdit,
})

function KbEdit() {
  const { doc } = Route.useLoaderData()
  const navigate = useNavigate()
  const run = useAction()
  const save = useServerFn(saveKb)
  const [f, setF] = useState({ title: '', slug: '', content: '', is_active: true })
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState('')
  useDirtyGuard(dirty)
  useEffect(() => {
    if (!doc) { flash({ type: 'err', text: 'Section not found.' }); navigate({ to: '/admin/kb' }); return }
    setF({ title: doc.title ?? '', slug: doc.slug ?? '', content: doc.content ?? '', is_active: !!Number(doc.is_active) })
    setDirty(false)
  }, [doc, navigate])
  useEffect(() => { const t = setTimeout(() => setPreview(mdToHtml(f.content, 1)), 200); return () => clearTimeout(t) }, [f.content])
  if (!doc) return null
  const id = Number(doc.id) || 0
  const set = (k: 'title' | 'slug' | 'content') => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setDirty(true) }
  return (
    <Page title={id ? 'Edit section' : 'New section'} sub={<Link to="/admin/kb">← Knowledge base</Link>}>
      <div className="grid-2 kb-edit">
        <form className="card settings-form" onSubmit={async (e) => {
          e.preventDefault()
          const r = await run(() => save({ data: { id, ...f } }))
          if (r && r.msgs?.every((m) => m.type !== 'err')) { setDirty(false); if (!id) navigate({ to: '/admin/kb/$id', params: { id: String((r as { id: number }).id) } }) }
        }}>
          <div className="field"><label htmlFor="kb-title">Section title</label><input className="input" id="kb-title" value={f.title} onChange={set('title')} required /></div>
          <div className="field"><label htmlFor="kb-slug">Link name (slug)</label><input className="input mono" id="kb-slug" value={f.slug} onChange={set('slug')} placeholder="auto from title" /></div>
          <div className="field"><label htmlFor="kb-content">Content (Markdown)</label>
            <textarea className="input mono" id="kb-content" rows={26} spellCheck value={f.content} onChange={set('content')} />
            <div className="help"><code># Heading</code> <code>## Sub-heading</code> <code>**bold**</code> <code>- list</code> <code>1. steps</code> <code>| table | row |</code> — <span>{f.content.length.toLocaleString()} characters</span></div></div>
          <label className="switch"><input type="checkbox" checked={f.is_active} onChange={(e) => { setF((x) => ({ ...x, is_active: e.target.checked })); setDirty(true) }} /><span className="slider"></span><span className="switch-label">Active (used by the assistant and the guide page)</span></label>
          <div className="form-actions sticky-actions"><button className="btn btn-primary" type="submit">💾 Save section</button><Link className="btn btn-ghost" to="/admin/kb">Cancel</Link></div>
        </form>
        <div className="card kb-preview-card">
          <div className="card-head"><h2>Preview</h2><span className="muted small">updates as you type</span></div>
          <div className="kb-preview" dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      </div>
    </Page>
  )
}
