/** Flash messages (replaces the PHP session flash) + toast + an action runner. */
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Msg = { type: 'ok' | 'warn' | 'err'; text: string }
type Item = Msg & { at: number; id: number }

let items: Item[] = []
let seq = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function flash(msgs: Msg[] | Msg) {
  const list = Array.isArray(msgs) ? msgs : [msgs]
  items = [...items, ...list.map((m) => ({ ...m, at: Date.now(), id: ++seq }))]
  emit()
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}
function clearOld() {
  const cutoff = Date.now() - 1500
  const next = items.filter((i) => i.at > cutoff)
  if (next.length !== items.length) { items = next; emit() }
}
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f) }
const snap = () => items
const empty: Item[] = []

export function Alerts() {
  const list = useSyncExternalStore(subscribe, snap, () => empty)
  const path = useRouterState({ select: (s) => s.location.pathname + s.location.searchStr })
  useEffect(() => { clearOld() }, [path])
  return (
    <>
      {list.map((m) => (
        <div key={m.id} className={`alert alert-${m.type}`}>
          {m.text}
          <button type="button" className="alert-x" aria-label="Dismiss" onClick={() => { items = items.filter((x) => x.id !== m.id); emit() }}>✕</button>
        </div>
      ))}
    </>
  )
}

/* toast */
let toastMsg: { text: string; bad: boolean; id: number } | null = null
const tsubs = new Set<() => void>()
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(text: string, bad = false) {
  toastMsg = { text, bad, id: ++seq }
  tsubs.forEach((f) => f())
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg = null; tsubs.forEach((f) => f()) }, 3200)
}
export function Toast() {
  const t = useSyncExternalStore((f) => { tsubs.add(f); return () => tsubs.delete(f) }, () => toastMsg, () => null)
  return <div className={`toast${t ? ' show' : ''}${t?.bad ? ' bad' : ''}`} id="toast">{t?.text}</div>
}

/** Run a server action: shows its messages, refreshes route data, reports thrown errors. */
export function useAction() {
  const router = useRouter()
  return useCallback(
    async <R extends { msgs?: Msg[] } | void>(fn: () => Promise<R>, opts: { invalidate?: boolean } = {}): Promise<R | null> => {
      try {
        const r = await fn()
        if (r && (r as { msgs?: Msg[] }).msgs?.length) flash((r as { msgs: Msg[] }).msgs)
        if (opts.invalidate !== false) await router.invalidate()
        return r
      } catch (e: any) {
        const text = e?.message || 'Something went wrong.'
        flash({ type: 'err', text })
        if (/session has expired/i.test(text)) router.navigate({ to: '/admin/login', search: { next: location.pathname } })
        return null
      }
    },
    [router],
  )
}

/** Simple confirm wrapper so it can be swapped later. */
export const ask = (q: string) => (typeof window === 'undefined' ? false : window.confirm(q))
