/**
 * utils/OmniTimePadModel.js (V259) — the OmniTimePad as plain data: a sound board for events. A pad is a grid of buttons; pressing one runs its
 * ACTIONS, each aimed at a TimeCube (a node id) and delayed by `at` ms from the press:  activate · halt · resume · reset · replay · loop-on · loop-off.
 * Pure (no DOM, no timers): planPress() says what should happen when; the runtime schedules it. Hostile-input safe, idempotent, immutable edits.
 */
export const PAD_VERSION = 1
export const OPS = Object.freeze(['activate', 'halt', 'resume', 'reset', 'replay', 'loop-on', 'loop-off'])
export const LIMITS = Object.freeze({ pads: 20, buttons: 64, actions: 64, label: 24, name: 40, maxDelay: 30 * 86400000 })
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const own = (o, k) => (isObj(o) && !BAD.has(k) && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const line = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n) : '')
const cleanId = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) && !BAD.has(v) ? v : '')
const HEX = /^#[0-9a-fA-F]{6}$/
let _n = 0
export const makeId = (p) => p + Date.now().toString(36) + (_n++).toString(36) + Math.floor(Math.random() * 1296).toString(36)
export function sanitizeAction (raw) { const r = isObj(raw) ? raw : {}; const op = OPS.includes(own(r, 'op')) ? r.op : null; const target = cleanId(own(r, 'target')); return op && target ? { op, target, at: clamp(Math.round(num(own(r, 'at'), 0)), 0, LIMITS.maxDelay) } : null }
export function sanitizeButton (raw) {
  const r = isObj(raw) ? raw : {}; const actions = []
  for (const a of (Array.isArray(r.actions) ? r.actions : []).slice(0, LIMITS.actions + 20)) { const s = sanitizeAction(a); if (s && actions.length < LIMITS.actions) actions.push(s) }
  actions.sort((a, b) => a.at - b.at)
  const col = own(r, 'color')
  return { id: cleanId(own(r, 'id')) || makeId('b'), label: line(own(r, 'label'), LIMITS.label) || 'Button', color: typeof col === 'string' && HEX.test(col) ? col.toLowerCase() : '#4aa3ff', actions }
}
export function sanitizePad (raw) {
  const r = isObj(raw) ? raw : {}; const seen = new Set(); const buttons = []
  for (const b of (Array.isArray(r.buttons) ? r.buttons : []).slice(0, LIMITS.buttons + 20)) { if (buttons.length >= LIMITS.buttons) break; const s = sanitizeButton(b); if (seen.has(s.id)) continue; seen.add(s.id); buttons.push(s) }
  return { version: PAD_VERSION, id: cleanId(own(r, 'id')) || makeId('pad'), name: line(own(r, 'name'), LIMITS.name) || 'TimePad', columns: clamp(Math.round(num(own(r, 'columns'), 4)), 1, 8), buttons }
}
export const newPad = (name = 'TimePad') => sanitizePad({ name })
export function addButton (pad, { label, color, actions = [] } = {}) { const p = sanitizePad(pad); if (p.buttons.length >= LIMITS.buttons) throw new Error('a pad holds ' + LIMITS.buttons + ' buttons'); return sanitizePad({ ...p, buttons: [...p.buttons, { label, color, actions, id: makeId('b') }] }) }
export function removeButton (pad, id) { const p = sanitizePad(pad); return { ...p, buttons: p.buttons.filter(b => b.id !== id) } }
export function addAction (pad, buttonId, action) { const p = sanitizePad(pad); const s = sanitizeAction(action); if (!s) throw new Error('an action needs an op (' + OPS.join(', ') + ') and a target cube'); if (!p.buttons.some(b => b.id === buttonId)) throw new Error('no button ' + buttonId); return sanitizePad({ ...p, buttons: p.buttons.map(b => (b.id === buttonId ? { ...b, actions: [...b.actions, s] } : b)) }) }
export function removeAction (pad, buttonId, index) { const p = sanitizePad(pad); return { ...p, buttons: p.buttons.map(b => (b.id === buttonId ? { ...b, actions: b.actions.filter((_, i) => i !== index) } : b)) } }
/** What pressing a button should do: [{ op, target, at, when }] with `when` = press time + delay, sorted. null if there is no such button. */
export function planPress (pad, buttonId, now = 0) { const b = sanitizePad(pad).buttons.find(x => x.id === buttonId); return b ? b.actions.map(a => ({ ...a, when: now + a.at })) : null }
/** Drop actions aimed at cubes that no longer exist. */
export function pruneTargets (pad, exists) { const p = sanitizePad(pad); return { ...p, buttons: p.buttons.map(b => ({ ...b, actions: b.actions.filter(a => exists(a.target)) })) } }
export function sanitizePads (raw) { const o = []; const ids = new Set(); for (const r of (Array.isArray(raw) ? raw : []).slice(0, LIMITS.pads + 5)) { if (o.length >= LIMITS.pads) break; const p = sanitizePad(r); if (!ids.has(p.id)) { ids.add(p.id); o.push(p) } } return o }
