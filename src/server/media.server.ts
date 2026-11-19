/** Image uploads, stored in the database so they survive serverless deploys. SVG is refused (it can carry scripts). */
import { randomBytes } from 'node:crypto'
import { insert, now, one, T } from './db.server'

const MAX = 5 * 1024 * 1024

function sniff(b: Uint8Array): { mime: string; ext: string } | null {
  const h = (i: number) => b[i]
  if (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47) return { mime: 'image/png', ext: 'png' }
  if (h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (h(0) === 0x47 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x38) return { mime: 'image/gif', ext: 'gif' }
  if (h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46 && h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50) return { mime: 'image/webp', ext: 'webp' }
  if (h(0) === 0x00 && h(1) === 0x00 && h(2) === 0x01 && h(3) === 0x00) return { mime: 'image/x-icon', ext: 'ico' }
  return null
}

export async function storeImage(file: File, prefix = 'img'): Promise<string> {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('No file selected.')
  if (file.size > MAX) throw new Error('Max file size is 5 MB.')
  const buf = new Uint8Array(await file.arrayBuffer())
  const kind = sniff(buf)
  if (!kind) throw new Error('Only PNG, JPG, WEBP, GIF or ICO images are allowed.')
  const d = new Date()
  const ym = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
  const name = (prefix.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'img') + '-' + randomBytes(6).toString('hex') + '.' + kind.ext
  const path = `uploads/${ym}/${name}`
  await insert(T.media, { path, mime: kind.mime, size: buf.byteLength, data: buf, created_at: now() })
  return path
}

export async function readImage(path: string): Promise<{ mime: string; data: Uint8Array } | null> {
  const r = await one(`SELECT mime, data FROM ${T.media} WHERE path = ?`, [path])
  if (!r) return null
  const raw = r.data
  const data = raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw as ArrayLike<number>)
  return { mime: String(r.mime), data }
}
