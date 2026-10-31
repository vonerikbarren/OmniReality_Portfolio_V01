/**
 * utils/OmniPolyModel.js (V204) — pure model of a PolyNode: a solid or folded strip of regular faces (utils/OmniPolyGeom.js) where EVERY FACE has its own colour, tags, content and click event.
 * No DOM, no WebGL. sanitize never throws, is idempotent, is hostile-input and __proto__ safe, with caps; edit ops are immutable (the pattern of the mix / doc models).
 *
 * data.poly = { version, shape, sides, count, fold, edge, faces:[ face ... ] }   (faces has exactly as many entries as the shape has faces; extra are dropped, missing are added)
 * face = { color:'' | '#rrggbb' (a tint of the node colour), label, tags:[...], hidden (a hole in the solid), event (a name sent with omni:poly-face-action), content }
 * content = { type:'none'|'pattern'|'text'|'image'|'video'|'doc'|'sound', pattern:{kind,a,b}, text, source:{type,id}, page }
 *   pattern  a drawn texture (checker, stripes, dots, grid, gradient) in two colours
 *   text     markdown text drawn on the face
 *   image    an image from the document library            source.type 'image'
 *   doc      a document: a guide page, PDF, markdown or text   source.type 'guide' | 'pdf' | 'markdown' | 'text', with a page
 *   sound    a sound that plays when the face is clicked: source.type 'soundNode' (a node in the scene) or 'audio' (a clip of the audio library)
 * Semantic queries: facesByTag, allTags; bulk edits: applyToTag, applyAll.
 */

import { SHAPES, SHAPE_INFO, GEOM_LIMITS, sanitizeShapeParams } from './OmniPolyGeom.js'

export const POLY_VERSION = 1
export const KIND_POLY = 'polyNode'
export const PATTERNS = Object.freeze(['checker', 'stripes', 'dots', 'grid', 'gradient'])
export const CONTENT_TYPES = Object.freeze(['none', 'pattern', 'text', 'image', 'doc', 'sound', 'video'])   // V257: video (appended so older saved order is unchanged)
export const DOC_SOURCES = Object.freeze(['guide', 'pdf', 'markdown', 'text'])
export const SOUND_SOURCES = Object.freeze(['soundNode', 'audio'])
export const POLY_LIMITS = Object.freeze({ faces: 64, labelMax: 40, textMax: 2000, tagsMax: 8, tagMax: 24, eventMax: 48, pageMax: 5000 })
const L = POLY_LIMITS

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const HEX = /^#[0-9a-fA-F]{6}$/
const hex = (v, def = '') => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : def)
const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').slice(0, max) : '')
const cleanLine = (v, max) => cleanText(v, max).replace(/[\n\t]/g, ' ').trim()
const cleanId = (v) => (typeof v === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(v) && v !== '__proto__' && v !== 'constructor' && v !== 'prototype' ? v : '')
export const cleanTag = (v) => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, L.tagMax) : '')
const cleanEvent = (v) => (typeof v === 'string' ? v.replace(/[^A-Za-z0-9:_.-]/g, '').slice(0, L.eventMax) : '')
const pickOf = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def)

/** How many faces the shape params make. */
export function faceCountOf (p) {
  const q = sanitizeShapeParams(p)
  if (q.shape === 'plane') return 1
  if (q.shape === 'strip') return q.count
  if (q.shape === 'ring') return q.count < 3 ? 3 : q.count
  return SHAPE_INFO[q.shape].faces
}

export function defaultContent () { return { type: 'none', pattern: { kind: 'checker', a: '#ffffff', b: '#9ad0ff' }, text: '', source: { type: 'none', id: '' }, page: 1 } }
export function defaultFace () { return { color: '', label: '', tags: [], hidden: false, event: '', content: defaultContent() } }

export function sanitizeContent (raw) {
  const r = isObj(raw) ? raw : {}
  const d = defaultContent()
  const type = pickOf(get(r, 'type'), CONTENT_TYPES, 'none')
  const pat = get(r, 'pattern')
  const pattern = { kind: pickOf(get(pat, 'kind'), PATTERNS, 'checker'), a: hex(get(pat, 'a'), d.pattern.a), b: hex(get(pat, 'b'), d.pattern.b) }
  const text = type === 'text' ? cleanText(get(r, 'text'), L.textMax) : cleanText(get(r, 'text'), L.textMax)
  const src = get(r, 'source')
  let sType = typeof get(src, 'type') === 'string' ? get(src, 'type') : 'none'
  const allowed = type === 'image' ? ['image'] : type === 'video' ? ['video'] : type === 'doc' ? DOC_SOURCES : type === 'sound' ? SOUND_SOURCES : []
  if (!allowed.includes(sType)) sType = 'none'
  const id = cleanId(get(src, 'id'))
  const source = sType !== 'none' && id ? { type: sType, id } : { type: 'none', id: '' }
  const pg = get(r, 'page'); const page = isNum(pg) ? clamp(Math.round(pg), 1, L.pageMax) : 1
  // the chosen type is kept even when its source is not chosen yet (the panel shows the picker); `hasContent` says whether there is anything to draw
  return { type, pattern, text, source, page }
}

export function sanitizeFace (raw) {
  const r = isObj(raw) ? raw : {}
  const tags = []
  const rt = get(r, 'tags')
  if (Array.isArray(rt)) for (const t of rt.slice(0, 64)) { const c = cleanTag(t); if (c && !tags.includes(c)) tags.push(c); if (tags.length >= L.tagsMax) break }
  return { color: hex(get(r, 'color'), ''), label: cleanLine(get(r, 'label'), L.labelMax), tags, hidden: get(r, 'hidden') === true, event: cleanEvent(get(r, 'event')), content: sanitizeContent(get(r, 'content')) }
}

export function defaultPoly () { return sanitizePoly({ version: POLY_VERSION }) }

export function sanitizePoly (raw) {
  const r = isObj(raw) ? raw : {}
  const params = sanitizeShapeParams(r)
  const n = Math.min(L.faces, faceCountOf(params))
  const rf = get(r, 'faces')
  const faces = []
  for (let i = 0; i < n; i++) faces.push(sanitizeFace(Array.isArray(rf) ? rf[i] : undefined))
  return { version: POLY_VERSION, ...params, faces }
}

// ── edit ops (immutable) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const edit = (poly, fn) => { const p = sanitizePoly(poly); const c = { ...p, faces: p.faces.map(f => ({ ...f, tags: f.tags.slice(), content: { ...f.content, pattern: { ...f.content.pattern }, source: { ...f.content.source } } })) }; let r; try { r = fn(c) } catch (_) { return p } return r === false ? p : sanitizePoly(c) }
const idxOf = (p, ref) => (typeof ref === 'number' ? ref : typeof ref === 'string' && /^f\d+$/.test(ref) ? Number(ref.slice(1)) : -1)

/** Change the shape: patch may hold shape, sides, count, fold, edge. Face data is kept by position. */
export function setShape (poly, patch) {
  return edit(poly, (p) => {
    const o = isObj(patch) ? patch : {}
    for (const k of ['shape', 'sides', 'count', 'fold', 'edge']) if (has(o, k)) p[k] = o[k]
    if (has(o, 'shape') && o.shape !== undefined) { const info = SHAPE_INFO[o.shape]; if (info && !has(o, 'count')) p.count = info.faces; if (info && !has(o, 'sides')) p.sides = info.sides; if (o.shape === 'strip' && !has(o, 'fold')) p.fold = 60 }
  })
}
/** Change one face: patch may hold color, label, tags, hidden, event, content. `ref` = index or 'f3'. */
export function setFace (poly, ref, patch) {
  return edit(poly, (p) => { const i = idxOf(p, ref); if (i < 0 || i >= p.faces.length || !isObj(patch)) return false; for (const k of ['color', 'label', 'tags', 'hidden', 'event']) if (has(patch, k)) p.faces[i][k] = patch[k]; if (has(patch, 'content')) p.faces[i].content = patch.content })
}
export function setContent (poly, ref, content) { return setFace(poly, ref, { content }) }
export function setTags (poly, ref, tags) { return setFace(poly, ref, { tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,\s]+/) : [] }) }
/** Next / previous page of a doc face (stops at page 1). */
export function turnFace (poly, ref, dir) { return edit(poly, (p) => { const i = idxOf(p, ref); const f = p.faces[i]; if (!f || f.content.type !== 'doc') return false; f.content.page = Math.max(1, f.content.page + (dir < 0 ? -1 : 1)) }) }
/** A hole where a face was (closed solids and planes) or the face leaves the strip / ring. */
export function removeFace (poly, ref) {
  return edit(poly, (p) => {
    const i = idxOf(p, ref); if (i < 0 || i >= p.faces.length) return false
    if (p.shape === 'strip' || p.shape === 'ring') { if (p.faces.length <= 1 || (p.shape === 'ring' && p.faces.length <= 3)) { p.faces[i].hidden = true; return }; p.faces.splice(i, 1); p.count = p.faces.length }
    else p.faces[i].hidden = true
  })
}
/** Bring back the first hole, or add one more face to a strip / ring. */
export function addFace (poly) {
  return edit(poly, (p) => {
    if (p.shape === 'strip' || p.shape === 'ring') { const hole = p.faces.findIndex(f => f.hidden); if (hole >= 0) { p.faces[hole].hidden = false; return } if (p.faces.length >= GEOM_LIMITS.countMax) return false; p.count = p.faces.length + 1; p.faces.push(defaultFace()); return }
    const hole = p.faces.findIndex(f => f.hidden); if (hole < 0) return false; p.faces[hole].hidden = false
  })
}

// ── semantic queries and bulk edits ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const allTags = (poly) => { const s = new Set(); for (const f of sanitizePoly(poly).faces) for (const t of f.tags) s.add(t); return [...s].sort() }
/** Ids ('f0' ...) of the faces with a tag (any of several tags when an array). */
export function facesByTag (poly, tag) {
  const want = (Array.isArray(tag) ? tag : [tag]).map(cleanTag).filter(Boolean)
  if (!want.length) return []
  return sanitizePoly(poly).faces.map((f, i) => (want.some(t => f.tags.includes(t)) ? 'f' + i : null)).filter(Boolean)
}
/** Apply a face patch (color, label, tags, hidden, event, content) to every face with the tag. */
export function applyToTag (poly, tag, patch) {
  const ids = facesByTag(poly, tag); let p = sanitizePoly(poly)
  for (const id of ids) p = setFace(p, id, patch)
  return p
}
export function applyAll (poly, patch) { let p = sanitizePoly(poly); for (let i = 0; i < p.faces.length; i++) p = setFace(p, i, patch); return p }

// ── what a click on a face offers (the tooltip) ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Options for the tooltip: [{ id, label }]. Always Select face and Open settings; the others depend on what the face holds. */
export function menuOptions (poly, ref, opts = {}) {
  const p = sanitizePoly(poly); const i = idxOf(p, ref); const f = p.faces[i]
  if (!f) return []
  const o = [{ id: 'select', label: 'Select this face' }, { id: 'settings', label: 'Open face settings' }]
  if (f.content.type === 'sound' && hasContent(f.content)) o.push({ id: 'play', label: 'Play the sound' })
  if (f.content.type === 'video' && hasContent(f.content)) o.push({ id: 'play', label: opts.playing ? 'Pause the video' : 'Play the video' })
  if (f.content.type === 'doc' && hasContent(f.content)) {
    const pages = Number(opts.pages) > 0 ? Number(opts.pages) : 0
    if (f.content.page > 1) o.push({ id: 'prev', label: 'Previous page' })
    if (!pages || f.content.page < pages) o.push({ id: 'next', label: 'Next page' })
  }
  if (f.event) o.push({ id: 'fire', label: 'Fire "' + f.event + '"' })
  if (f.tags.length) o.push({ id: 'tag', label: 'Select all tagged ' + f.tags[0] })
  o.push({ id: 'hide', label: 'Remove this face (open a hole)' })
  return o
}

/** Is there anything to draw for this content? (image / doc / sound need a source, text needs text) */
export function hasContent (c) {
  if (!c) return false
  if (c.type === 'pattern') return true
  if (c.type === 'text') return c.text.trim().length > 0
  if (c.type === 'image' || c.type === 'video' || c.type === 'doc' || c.type === 'sound') return c.source.type !== 'none'
  return false
}

/** A short key of what a face looks like; changes when its picture must be redrawn. */
export function contentKey (c) {
  if (!hasContent(c)) return 'none'
  if (c.type === 'pattern') return `p:${c.pattern.kind}:${c.pattern.a}:${c.pattern.b}`
  if (c.type === 'text') return `t:${c.text.length}:${c.text.slice(0, 40)}:${c.text.slice(-40)}`
  if (c.type === 'sound') return `s:${c.source.type}:${c.source.id}`
  return `${c.type}:${c.source.type}:${c.source.id}:${c.page}`
}

export function describePoly (p) {
  const q = sanitizePoly(p); const info = SHAPE_INFO[q.shape]
  const holes = q.faces.filter(f => f.hidden).length; const withContent = q.faces.filter(f => hasContent(f.content)).length
  return `${info.name}, ${q.faces.length - holes} of ${q.faces.length} faces shown, ${withContent} with content.`
}

export default { POLY_VERSION, KIND_POLY, SHAPES, PATTERNS, CONTENT_TYPES, POLY_LIMITS, faceCountOf, sanitizePoly, sanitizeFace, sanitizeContent, defaultPoly, defaultFace, setShape, setFace, setContent, setTags, turnFace, removeFace, addFace, allTags, facesByTag, applyToTag, applyAll, menuOptions, contentKey, hasContent, describePoly }
