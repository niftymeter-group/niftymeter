/**
 * Minimal, safe Markdown → HTML (everything is escaped first). Port of includes/markdown.php.
 * Supports: # ## ### headings, paragraphs, - / * lists, 1. lists, | tables |, **bold**, _italic_, `code`, [text](https://link).
 */
import { esc, slugify } from './util'

export function mdInline(s: string): string {
  let h = esc(s)
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
  h = h.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
  h = h.replace(/(?<![\w*])_(.+?)_(?![\w])/gs, '<em>$1</em>')
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|#[\w-]+)\)/g, (_m, text, href) => {
    const ext = href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
    return `<a href="${href}"${ext}>${text}</a>`
  })
  return h
}

export function mdToHtml(md: string, headingShift = 0, ids = false): string {
  const src = md.replace(/\t/g, '    ').split(/\r\n|\r|\n/)
  const out: string[] = []
  let para: string[] = []
  let list: 'ul' | 'ol' | null = null
  let table: string[] = []
  const flushPara = () => {
    if (para.length) {
      out.push('<p>' + mdInline(para.join(' ')) + '</p>')
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      out.push('</' + list + '>')
      list = null
    }
  }
  const flushTable = () => {
    if (!table.length) return
    const rows = table.filter((r) => !/^\|?\s*:?-{2,}/.test(r))
    let html = '<div class="md-table"><table>'
    rows.forEach((r, i) => {
      const cells = r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const tag = i === 0 ? 'th' : 'td'
      html += (i === 0 ? '<thead>' : i === 1 ? '<tbody>' : '') + '<tr>'
      for (const c of cells) html += `<${tag}>${mdInline(c)}</${tag}>`
      html += '</tr>' + (i === 0 ? '</thead>' : '')
    })
    out.push(html + (rows.length > 1 ? '</tbody>' : '') + '</table></div>')
    table = []
  }
  for (const line of src) {
    const t = line.trim()
    if (t === '') {
      flushPara(); flushList(); flushTable()
      continue
    }
    if (t[0] === '|') {
      flushPara(); flushList()
      table.push(t)
      continue
    }
    flushTable()
    let m = t.match(/^(#{1,4})\s+(.+)$/)
    if (m) {
      flushPara(); flushList()
      const lvl = Math.min(6, m[1]!.length + headingShift)
      const id = ids ? ` id="${slugify(m[2]!)}"` : ''
      out.push(`<h${lvl}${id}>${mdInline(m[2]!)}</h${lvl}>`)
      continue
    }
    const ul = t.match(/^[-*]\s+(.+)$/)
    const ol = ul ? null : t.match(/^\d+[.)]\s+(.+)$/)
    if (ul || ol) {
      flushPara()
      const type = ul ? 'ul' : 'ol'
      if (list !== type) {
        flushList()
        out.push('<' + type + '>')
        list = type
      }
      out.push('<li>' + mdInline((ul ?? ol)![1]!) + '</li>')
      continue
    }
    flushList()
    para.push(t)
  }
  flushPara(); flushList(); flushTable()
  return out.join('\n')
}

/** Chat-bubble markdown (port of assets/js/chat.js md()). */
function chatInline(s: string): string {
  let h = esc(s)
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/(^|[\s(])_(.+?)_(?=[\s.,)!?]|$)/g, '$1<em>$2</em>')
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>')
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
  return h
}
export function chatMd(text: string): string {
  let html = ''
  let list: string | null = null
  for (const l of String(text).split(/\r?\n/)) {
    const t = l.trim()
    let m: RegExpMatchArray | null
    if ((m = t.match(/^[-*•]\s+(.*)$/))) {
      if (list !== 'ul') { if (list) html += '</' + list + '>'; html += '<ul>'; list = 'ul' }
      html += '<li>' + chatInline(m[1]!) + '</li>'
      continue
    }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') { if (list) html += '</' + list + '>'; html += '<ol>'; list = 'ol' }
      html += '<li>' + chatInline(m[1]!) + '</li>'
      continue
    }
    if (list) { html += '</' + list + '>'; list = null }
    if (!t) continue
    if ((m = t.match(/^#{1,4}\s+(.*)$/))) { html += '<p><strong>' + chatInline(m[1]!) + '</strong></p>'; continue }
    html += '<p>' + chatInline(t) + '</p>'
  }
  if (list) html += '</' + list + '>'
  return html
}
