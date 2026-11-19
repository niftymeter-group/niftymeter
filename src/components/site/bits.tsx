import type { ElementType, HTMLAttributes } from 'react'
import icons from '~/lib/data/icons.json'
import { rich } from '~/lib/util'

/** Admin "rich text": *accent*, **bold**, new line = <br>. Content is escaped first. */
export function Rich({ as, text, ...rest }: { as?: ElementType; text: unknown } & HTMLAttributes<HTMLElement>) {
  const Tag = (as ?? 'span') as ElementType
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: rich(text) }} />
}

export function Icon({ name }: { name: string }) {
  const d = (icons as Record<string, string>)[name]
  if (!d) return null
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export const tagClass = (type: string) => (type === 'pos' ? 'tag tag-pos' : type === 'neg' ? 'tag tag-neg' : 'tag tag-neu')
export const ucfirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
