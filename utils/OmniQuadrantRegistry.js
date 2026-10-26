/**
 * utils/OmniQuadrantRegistry.js (V195) — what can be shown in a quadrant of the OmniExpression panel (maximized: 4 quadrants like the Start HUD).
 * Pure registry (no DOM at registration). Contents register themselves; the panel header dropdown of each quadrant lists them.
 *
 *   registerQuadrantContent(id, { label, order=100, mount(host, ctx) -> { destroy(), onResize?() }, accepts?: ['tl','tr','bl','br'] })
 *     ctx = { quadrant: 'tl'|'tr'|'bl'|'br', maximized: bool, hand?: 'L'|'R' }
 *   unregisterQuadrantContent(id)  listQuadrantContents(quadrant?)  getQuadrantContent(id)  subscribeQuadrantRegistry(fn)->unsub
 * Standard ids: 'dj' (OmniDJ, 6 circles), 'beatpad' (OmniBeatPad 4x4), 'mixer', 'keysL', 'keysR', 'sequencer', 'viewer'.
 */
export const QUADRANTS = Object.freeze(['tl', 'tr', 'bl', 'br'])
export const DEFAULT_LAYOUT = Object.freeze({ tl: 'dj', tr: 'beatpad', bl: 'keysL', br: 'keysR' })
const reg = new Map(); const subs = new Set()
const poke = () => { for (const f of [...subs]) { try { f() } catch (_) { /* ignore */ } } }
export function registerQuadrantContent (id, def) {
  if (typeof id !== 'string' || !id || !def || typeof def.mount !== 'function') return false
  reg.set(id, { id, label: String(def.label || id), order: Number.isFinite(def.order) ? def.order : 100, mount: def.mount, accepts: Array.isArray(def.accepts) ? def.accepts.filter(q => QUADRANTS.includes(q)) : null })
  poke(); return true
}
export function unregisterQuadrantContent (id) { const r = reg.delete(id); if (r) poke(); return r }
export function getQuadrantContent (id) { return reg.get(id) || null }
export function listQuadrantContents (quadrant) { return [...reg.values()].filter(c => !quadrant || !c.accepts || c.accepts.includes(quadrant)).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)) }
export function subscribeQuadrantRegistry (fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn) }
export function _reset () { reg.clear(); subs.clear() }
export default { QUADRANTS, DEFAULT_LAYOUT, registerQuadrantContent, unregisterQuadrantContent, getQuadrantContent, listQuadrantContents, subscribeQuadrantRegistry }
