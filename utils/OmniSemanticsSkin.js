/**
 * utils/OmniSemanticsSkin.js (V243) — pure: the SKIN of an OmniSemanticsVoxelNode (see docs/architecture/OMNISEMANTICS_DESIGN.md).
 * A skin is six faces, one per axiom (Identity, Information, Space, Time, Power, Expression). It is drawn by a PolyNode cube, so every face already has a colour, a label, tags, a click event and content.
 *   skinToPoly(skin) -> a poly (utils/OmniPolyModel.js shape) with face i = axiom i; tags = ['semantics', axiomId]; event = 'semantics:<axiomId>'
 *   sanitizeSkin(raw) -> { version, name, faces: { <axiomId>: { label, icon, event, tooltip } } }   (never throws; unknown keys dropped; text capped)
 *   SKINS: default (symbol + name, axiom colours) · plain (names only) · contrast (black on white, big symbols) · blank (every face undefined: the alphabet's honest failure)
 * Face content in v1: an icon (a symbol or emoji, drawn as large text). Image and video faces are NOT here yet (see the design doc, section 4).
 */
import { AXIOMS } from '../data/OmniAxiomData.js'
import { sanitizePoly } from './OmniPolyModel.js'

export const SKIN_VERSION = 1
export const AXIOM_ORDER = Object.freeze(AXIOMS.map(a => a.id))
export const SKIN_NAMES = Object.freeze(['default', 'plain', 'contrast', 'blank'])
const LIM = { label: 40, icon: 8, event: 48, tooltip: 120 }
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
          event: own(f, 'event') === undefined ? base.faces[id].event : cleanEvent(f.event), tooltip: own(f, 'tooltip') === undefined ? base.faces[id].tooltip : clean(f.tooltip, LIM.tooltip) }
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
    const defined = !!(f.label || f.icon)
    const text = f.icon ? `# ${f.icon}\n${f.label}` : f.label
    return {
      color: contrast ? '#ffffff' : defined ? a.color : '#777777',
      label: f.label || '(not defined)',
      tags: ['semantics', a.id],
      event: f.event,
      content: text ? { type: 'text', text } : { type: 'pattern', pattern: { kind: 'stripes', a: '#444444', b: '#777777' } },
    }
  })
  return sanitizePoly({ shape: 'cube', faces })
}

/** Which axiom a face index belongs to (face i = axiom i). */
export const axiomOfFace = (i) => AXIOM_ORDER[i] ?? null

export function describe () {
  return AXIOMS.map((a, i) => `face ${i + 1}  ${a.symbol} ${a.name} (${a.id})`).join('\n') + '\nskins: ' + SKIN_NAMES.join(', ')
}
export default { presetSkin, sanitizeSkin, setSkinFace, skinToPoly, axiomOfFace, AXIOM_ORDER, SKIN_NAMES, describe }
