/** Schema-driven settings forms (port of admin/inc/forms.php + the repeater/upload parts of admin.js). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Settings } from '~/lib/defaults'
import type { Field } from '~/lib/schemas'
import { assetUrl, hexValid, strLimit } from '~/lib/util'
import { toast } from './flash'

type Vals = Record<string, any>
type Row = Record<string, string> & { __k?: string }

let rowSeq = 0
const withKeys = (rows: unknown): Row[] => (Array.isArray(rows) ? rows : []).map((r) => ({ ...(r as Row), __k: 'r' + ++rowSeq }))

export function initialValues(fields: Field[], S: Settings): Vals {
  const v: Vals = {}
  for (const f of fields) {
    if (f.type === 'heading') continue
    v[f.key] = f.type === 'repeater' ? withKeys(S[f.key]) : typeof S[f.key] === 'string' ? S[f.key] : ''
  }
  return v
}

export function stripKeys(v: Vals): Vals {
  const out: Vals = {}
  for (const [k, x] of Object.entries(v)) out[k] = Array.isArray(x) ? x.map(({ __k, ...rest }: Row) => rest) : x
  return out
}

/** Unsaved-changes guard */
export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
}

const fid = (name: string) => 'f_' + name.replace(/[^a-z0-9_]/gi, '_')

function Help({ html }: { html?: string }) {
  if (!html) return null
  return <div className="help" dangerouslySetInnerHTML={{ __html: html.replace(/<span class="counter"[^>]*><\/span>/g, '') }} />
}

function Counter({ f, value }: { f: Field; value: string }) {
  const m = f.help?.match(/class="counter"[^>]*data-max="(\d+)"/)
  if (!m) return null
  const max = Number(m[1])
  return <div className="help"><span className={`counter${value.length > max ? ' over' : ''}`}>{value.length}/{max}</span></div>
}

export function FieldInput({ f, value, onChange, name }: { f: Field; value: any; onChange: (v: any) => void; name: string }) {
  const type = f.type ?? 'text'
  const id = fid(name)
  const wide = f.wide || ['textarea', 'rich', 'lines', 'code', 'repeater', 'heading'].includes(type)
  if (type === 'heading') {
    return <div className="form-heading wide"><h3>{f.label}</h3><Help html={f.help} /></div>
  }
  const label = <label htmlFor={id}>{f.label ?? f.key}</label>
  let body: ReactNode
  switch (type) {
    case 'toggle':
      body = (
        <>
          <label className="switch">
            <input type="checkbox" id={id} checked={String(value) === '1'} onChange={(e) => onChange(e.target.checked ? '1' : '0')} />
            <span className="slider"></span><span className="switch-label">{f.label}</span>
          </label>
          <Help html={f.help} />
        </>
      )
      break
    case 'textarea': case 'rich': case 'lines': case 'code': {
      const rows = f.rows ?? (type === 'code' ? 8 : type === 'lines' ? 5 : 3)
      let help = f.help
      if (type === 'rich' && !help) help = 'Use <code>*text*</code> for accent colour, <code>**text**</code> for bold. New line = line break.'
      if (type === 'lines' && !help) help = 'One item per line.'
      body = (
        <>
          {label}
          <textarea className={'input' + (type === 'code' ? ' mono' : '')} id={id} rows={rows} placeholder={f.placeholder} spellCheck={type !== 'code'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
          <Help html={help} />
          <Counter f={f} value={String(value ?? '')} />
        </>
      )
      break
    }
    case 'color': {
      const v = hexValid(String(value)) ? String(value) : '#000000'
      body = (
        <>
          {label}
          <div className="color-row">
            <input type="color" value={v.toLowerCase()} onChange={(e) => onChange(e.target.value.toUpperCase())} />
            <input className="input mono" id={id} value={value ?? ''} pattern="#[0-9A-Fa-f]{6}" onChange={(e) => onChange(e.target.value)} />
          </div>
          <Help html={f.help} />
        </>
      )
      break
    }
    case 'select':
      body = (
        <>
          {label}
          <select className="input" id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            {(f.options ?? []).map(([ov, ol]) => <option key={ov} value={ov}>{ol}</option>)}
          </select>
          <Help html={f.help} />
        </>
      )
      break
    case 'image':
      body = <>{label}<ImageField id={id} name={name} value={String(value ?? '')} onChange={onChange} /><Help html={f.help} /></>
      break
    case 'repeater':
      body = <Repeater f={f} rows={Array.isArray(value) ? value : []} onChange={onChange} name={name} />
      break
    default: {
      const inType = ({ url: 'text', email: 'email', number: 'number', datetime: 'datetime-local' } as Record<string, string>)[type] ?? 'text'
      body = (
        <>
          {label}
          <input className={'input' + (type === 'url' ? ' mono' : '')} type={inType} id={id} value={value ?? ''} placeholder={f.placeholder} min={f.min} max={f.max} onChange={(e) => onChange(e.target.value)} />
          <Help html={f.help} />
          <Counter f={f} value={String(value ?? '')} />
        </>
      )
    }
  }
  return <div className={`field${wide ? ' wide' : ''} ft-${type}`}>{body}</div>
}

function ImageField({ id, name, value, onChange }: { id: string; name: string; value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [path, setPath] = useState(value)
  useEffect(() => setPath(value), [value])
  async function upload(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('prefix', name.replace(/[^a-z]/gi, '').slice(0, 20) || 'img')
    setBusy(true)
    try {
      const r = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || 'Upload failed')
      onChange(d.path)
      toast('Image uploaded — remember to Save.')
    } catch (e: any) {
      toast(e.message, true)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  return (
    <div className="image-field">
      <div className="img-prev">{value ? <img src={assetUrl(value)} alt="" /> : <span>No image</span>}</div>
      <div className="img-ctrl">
        <input className="input mono img-path" id={id} value={path} placeholder="uploads/… or https://…" onChange={(e) => setPath(e.target.value)} onBlur={() => onChange(path.trim())} />
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : '⬆ Upload image'}</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
      </div>
    </div>
  )
}

function Repeater({ f, rows, onChange, name }: { f: Field; rows: Row[]; onChange: (rows: Row[]) => void; name: string }) {
  const item = f.item ?? 'item'
  const startCollapsed = useMemo(() => rows.length > 3, []) // eslint-disable-line react-hooks/exhaustive-deps
  const update = (i: number, key: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }
  const add = () => {
    const blank: Row = { __k: 'r' + ++rowSeq }
    for (const sub of f.fields ?? []) blank[sub.key] = sub.default ?? (sub.type === 'select' ? (sub.options?.[0]?.[0] ?? '') : '')
    onChange([...rows, blank])
  }
  const atMax = !!f.max && rows.length >= f.max
  return (
    <div className="repeater">
      <div className="rep-head"><strong>{f.label}</strong> <span className="muted rep-count">{rows.length} {item}(s)</span></div>
      <Help html={f.help} />
      <div className="rep-rows">
        {rows.map((row, i) => (
          <RepRow key={row.__k} f={f} row={row} num={i + 1} name={`${name}[${i}]`} collapsedInit={startCollapsed}
            onField={(k, v) => update(i, k, v)} onUp={() => move(i, -1)} onDown={() => move(i, 1)}
            onDel={() => { if (window.confirm('Remove this item?')) onChange(rows.filter((_, j) => j !== i)) }} />
        ))}
      </div>
      <button type="button" className="btn btn-sm btn-ghost" onClick={add} disabled={atMax} title={atMax ? `Maximum ${f.max}` : undefined}>+ Add {item}</button>
    </div>
  )
}

function RepRow({ f, row, num, name, collapsedInit, onField, onUp, onDown, onDel }: {
  f: Field; row: Row; num: number; name: string; collapsedInit: boolean
  onField: (k: string, v: string) => void; onUp: () => void; onDown: () => void; onDel: () => void
}) {
  const [collapsed, setCollapsed] = useState(collapsedInit)
  const title = f.title_field ? strLimit(String(row[f.title_field] ?? ''), 60) : ''
  return (
    <div className={`rep-row${collapsed ? ' collapsed' : ''}`}>
      <div className="rep-bar">
        <span className="rep-num">#{num}</span><span className="rep-title">{title}</span>
        <span className="rep-actions">
          <button type="button" className="icon-btn" title="Move up" onClick={onUp}>↑</button>
          <button type="button" className="icon-btn" title="Move down" onClick={onDown}>↓</button>
          <button type="button" className="icon-btn" title="Collapse" onClick={() => setCollapsed((c) => !c)}>▾</button>
          <button type="button" className="icon-btn danger" title="Remove" onClick={onDel}>✕</button>
        </span>
      </div>
      <div className="rep-body form-grid">
        {(f.fields ?? []).map((sub) => (
          <FieldInput key={sub.key} f={sub} name={`${name}[${sub.key}]`} value={row[sub.key] ?? sub.default ?? ''} onChange={(v) => onField(sub.key, v)} />
        ))}
      </div>
    </div>
  )
}

/** Renders a list of fields bound to a values object. */
export function FieldList({ fields, values, set }: { fields: Field[]; values: Vals; set: (k: string, v: any) => void }) {
  return <>{fields.map((f) => <FieldInput key={f.key} f={f} name={f.key} value={values[f.key]} onChange={(v) => set(f.key, v)} />)}</>
}

/** State for a settings form: values, dirty flag, setter. */
export function useFieldState(fields: Field[], S: Settings) {
  const [values, setValues] = useState<Vals>(() => initialValues(fields, S))
  const [dirty, setDirty] = useState(false)
  useDirtyGuard(dirty)
  const set = (k: string, v: any) => { setValues((x) => ({ ...x, [k]: v })); setDirty(true) }
  const reset = (S2: Settings) => { setValues(initialValues(fields, S2)); setDirty(false) }
  return { values, set, dirty, setDirty, reset }
}
