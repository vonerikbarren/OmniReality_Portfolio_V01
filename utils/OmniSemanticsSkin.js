/**
 * utils/OmniSemanticsSkin.js (V243) — pure: the SKIN of an OmniSemanticsVoxelNode (see docs/architecture/OMNISEMANTICS_DESIGN.md).
 * A skin is six faces, one per axiom (Identity, Information, Space, Time, Power, Expression). It is drawn by a PolyNode cube, so every face already has a colour, a label, tags, a click event and content.
 *   skinToPoly(skin) -> a poly (utils/OmniPolyModel.js shape) with face i = axiom i; tags = ['semantics', axiomId]; event = 'semantics:<axiomId>'
 *   sanitizeSkin(raw) -> { version, name, faces: { <axiomId>: { label, icon, event, tooltip } } }   (never throws; unknown keys dropped; text capped)
 *   SKINS: default (symbol + name, axiom colours) · plain (names only) · contrast (black on white, big symbols) · blank (every face undefined: the alphabet's honest failure)
 * Face content: an icon (a symbol or emoji, drawn as large text), or (V257) an IMAGE or a VIDEO from the document library (`image` / `video` = a library id).
 * A face with a video shows a still picture with a play badge; a tap offers Play. At most two videos play at once (utils/OmniVideoFace.js).
 * Reskin (V257): a voxel-room node keeps its skeleton; `skinNodeId(voxelId)` names the cube that wears the skin, `reskinPlan(...)` says what to do for each voxel.
 */
import { AXIOMS } from '../data/OmniAxiomData.js'
import { sanitizePoly } from './OmniPolyModel.js'

export const SKIN_VERSION = 1
export const AXIOM_ORDER = Object.freeze(AXIOMS.map(a => a.id))
export const SKIN_NAMES = Object.freeze(['default', 'plain', 'contrast', 'blank'])
const LIM = { label: 40, icon: 8, event: 48, tooltip: 120, media: 64 }
const cleanMedia = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : '')
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const own = (o, k) => (isObj(o) && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
const clean = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '')
const cleanEvent = (v) => (typeof v === 'string' ? v.replace(/[^A-Za-z0-9:_.-]/g, '').slice(0, LIM.event) : '')

export function presetSkin (name = 'default') {
  const n = SKIN_NAMES.includes(name) ? name : 'default'
  const faces = {}
  for (const a of AXIOMS) {
    faces[a.id] = n === 'blank' ? { label: '', icon: '', event: '', tooltip: '' }
      : { label: a.name, icon: n === 'plain' ? '' : a.symbol, event: `semantics:${a.id}`, tooltip: a.view }
    faces[a.id].image = ''; faces[a.id].video = ''
  }
  return { version: SKIN_VERSION, name: n, faces }
}

export function sanitizeSkin (raw) {
  const r = isObj(raw) ? raw : {}
  const name = typeof own(r, 'name') === 'string' && SKIN_NAMES.includes(r.name) ? r.name : 'default'
  const base = presetSkin(name); const rf = own(r, 'faces')
  const faces = {}
  for (const id of AXIOM_ORDER) {
    const f = own(rf, id)
    faces[id] = isObj(f)
      ? { label: own(f, 'label') === undefined ? base.faces[id].label : clean(f.label, LIM.label), icon: own(f, 'icon') === undefined ? base.faces[id].icon : clean(f.icon, LIM.icon),
          event: own(f, 'event') === undefined ? base.faces[id].event : cleanEvent(f.event), tooltip: own(f, 'tooltip') === undefined ? base.faces[id].tooltip : clean(f.tooltip, LIM.tooltip),
          image: cleanMedia(own(f, 'image')), video: cleanMedia(own(f, 'video')) }
      : base.faces[id]
  }
  return { version: SKIN_VERSION, name, faces }
}

/** Set one face of a skin (immutable). `axiom` is an axiom id. Returns the new skin, or the same skin when the axiom is unknown. */
export function setSkinFace (skin, axiom, patch) {
  const s = sanitizeSkin(skin); if (!AXIOM_ORDER.includes(axiom) || !isObj(patch)) return s
  return sanitizeSkin({ ...s, faces: { ...s.faces, [axiom]: { ...s.faces[axiom], ...patch } } })
}

export function skinToPoly (skin) {
  const s = sanitizeSkin(skin); const contrast = s.name === 'contrast'
  const faces = AXIOMS.map(a => {
    const f = s.faces[a.id]
    const defined = !!(f.label || f.icon || f.image || f.video)
    const text = f.icon ? `# ${f.icon}\n${f.label}` : f.label
    const content = f.video ? { type: 'video', source: { type: 'video', id: f.video }, page: 1 } : f.image ? { type: 'image', source: { type: 'image', id: f.image }, page: 1 }
      : text ? { type: 'text', text } : { type: 'pattern', pattern: { kind: 'stripes', a: '#444444', b: '#777777' } }
    return {
      color: contrast ? '#ffffff' : defined ? a.color : '#777777',
      label: f.label || '(not defined)',
      tags: ['semantics', a.id],
      event: f.event,
      content,
    }
  })
  return sanitizePoly({ shape: 'cube', faces })
}

/** The id of the cube that wears a voxel node's skin: skin_<voxelId>, kept to 64 valid characters. */
export function skinNodeId (voxelId) {
  const base = String(voxelId ?? '').replace(/[^\w-]/g, '_').slice(0, 59)
  return base ? 'skin_' + base : ''
}
/** What to do for each voxel: create its skin cube, or swap the skin on the cube it already has. existing = ids of nodes that exist. */
export function reskinPlan (voxelIds, existing = []) {
  const have = new Set(Array.isArray(existing) ? existing : []); const seen = new Set(); const out = []
  for (const v of Array.isArray(voxelIds) ? voxelIds : []) {
    if (typeof v !== 'string' || !v) continue
    const skinId = skinNodeId(v); if (!skinId || seen.has(skinId)) continue
    seen.add(skinId); out.push({ voxelId: v, skinId, action: have.has(skinId) ? 'swap' : 'create' })
  }
  return out
}

/** Which axiom a face index belongs to (face i = axiom i). */
export const axiomOfFace = (i) => AXIOM_ORDER[i] ?? null

export function describe () {
  return AXIOMS.map((a, i) => `face ${i + 1}  ${a.symbol} ${a.name} (${a.id})`).join('\n') + '\nskins: ' + SKIN_NAMES.join(', ')
}
export default { presetSkin, sanitizeSkin, setSkinFace, skinToPoly, skinNodeId, reskinPlan, axiomOfFace, AXIOM_ORDER, SKIN_NAMES, describe }
