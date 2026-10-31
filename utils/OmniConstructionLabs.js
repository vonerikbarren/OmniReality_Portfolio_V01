/**
 * utils/OmniConstructionLabs.js (V256) — brush "labs": named brush setups you can switch to in one go. Pure.
 *   BUILTIN_LABS · sanitizeLab(raw) -> lab|null · sanitizeLabs(raw) -> user labs (max 24) · allLabs(user) · findLab(user, nameOrId)
 *   labBrush(lab, base) -> the full brush after applying the lab to `base` (never changes hand, sound or volume: those are yours)
 * A lab is { id, name, brush: { shape, color, size, radius, density, spacing, jitterColor, mode, height, distance, rainbow, paint, dab, soft } }.
 * The built-in labs can be used and copied but not overwritten or deleted (saving under their name makes your own copy under a new id).
 */
import { normalise, DEFAULTS } from './OmniConstructionModel.js'

export const MAX_LABS = 24
const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const KEEP = new Set(['hand', 'sound', 'volume'])    // never part of a lab
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

export const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)

export const BUILTIN_LABS = Object.freeze([
  { id: 'confetti', name: 'Confetti', brush: { shape: 'BoxGeometry', size: 0.25, radius: 3, density: 6, spacing: 0.5, jitterColor: 0.4, mode: 'air', rainbow: true, paint: 'spray' } },
  { id: 'stars', name: 'Stars', brush: { shape: 'OctahedronGeometry', color: '#ffe27a', size: 0.35, radius: 4, density: 4, spacing: 0.8, jitterColor: 0.1, mode: 'air', rainbow: false, paint: 'spray' } },
  { id: 'moss', name: 'Moss', brush: { shape: 'SphereGeometry', color: '#5aa84a', size: 0.3, radius: 1.2, density: 5, spacing: 0.35, jitterColor: 0.25, mode: 'ground', rainbow: false, paint: 'spray' } },
  { id: 'pebbles', name: 'Pebbles', brush: { shape: 'IcosahedronGeometry', color: '#9a9a9a', size: 0.6, radius: 2.5, density: 2, spacing: 1.2, jitterColor: 0.12, mode: 'ground', rainbow: false, paint: 'spray' } },
  { id: 'crayon', name: 'Crayon', brush: { paint: 'surface', color: '#ff7a59', dab: 22, soft: 0.1, rainbow: false } },
  { id: 'airbrush', name: 'Airbrush', brush: { paint: 'surface', color: '#7fd6ff', dab: 56, soft: 1, rainbow: false } },
].map(l => Object.freeze({ ...l, builtin: true })))

export function sanitizeLab (raw) {
  if (!isObj(raw)) return null
  const name = String(raw.name ?? '').trim().slice(0, 40); const id = typeof raw.id === 'string' && ID.test(raw.id) && !BAD.has(raw.id) ? raw.id : slug(name)
  if (!name || !ID.test(id) || BAD.has(id)) return null
  const src = isObj(raw.brush) ? raw.brush : {}; const clean = {}
  for (const k of Object.keys(src)) { if (!(k in DEFAULTS) || KEEP.has(k) || BAD.has(k)) continue; try { const n = normalise({ [k]: src[k] }, DEFAULTS); clean[k] = n[k] } catch (_) { /* a bad value is left out */ } }
  return { id, name, brush: clean }
}
export function sanitizeLabs (raw) {
  const out = []; const seen = new Set(BUILTIN_LABS.map(l => l.id))
  for (const r of (Array.isArray(raw) ? raw : []).slice(0, 200)) { const l = sanitizeLab(r); if (!l || seen.has(l.id) || out.length >= MAX_LABS) continue; seen.add(l.id); out.push(l) }
  return out
}
export const allLabs = (user = []) => [...BUILTIN_LABS, ...sanitizeLabs(user)]
export function findLab (user, key) {
  const k = String(key ?? '').trim().toLowerCase(); if (!k) return null
  return allLabs(user).find(l => l.id === k || l.name.toLowerCase() === k || slug(k) === l.id) ?? null
}
/** The brush after applying a lab to `base`. */
export function labBrush (lab, base = DEFAULTS) { return normalise(lab?.brush ?? {}, base) }
/** The lab that saving the given brush under `name` would make (hand / sound / volume left out). */
export function labFromBrush (name, brush) {
  const b = {}; for (const k of Object.keys(DEFAULTS)) if (!KEEP.has(k) && k in (brush ?? {})) b[k] = brush[k]
  return sanitizeLab({ name, brush: b })
}
