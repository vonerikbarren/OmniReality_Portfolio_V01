/**
 * utils/OmniTooltipCull.js (V264) — pure rules for the header tooltips above nodes (ui/ToolTipMenu.js).
 * Two jobs: keep the work small (only the nearest few headers are positioned, off-screen ones cost nothing) and stop labels showing through things.
 *   sanitizeCullPrefs(raw) -> { occlusion: 'hide'|'dim'|'show', max: 5..400, dimOpacity: 0.1..0.9 }       never throws, idempotent
 *   chooseHeaders(items, max, keep) -> Set of ids to show: the nearest `max` on-screen items, plus every id in `keep` (selected, hovered, menu open)
 *   isBlocked(hitDistance, targetDistance, eps) -> true when something other than the node itself is nearer to the camera than the node
 *   stateFor(occluded, occlusion) -> 'visible' | 'dim' | 'hidden'
 */
export const OCCLUSION = Object.freeze(['hide', 'dim', 'show'])
export const DEFAULT_CULL = Object.freeze({ occlusion: 'hide', max: 60, dimOpacity: 0.28 })
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function sanitizeCullPrefs (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const occ = typeof r.occlusion === 'string' && OCCLUSION.includes(r.occlusion) ? r.occlusion : DEFAULT_CULL.occlusion
  return { occlusion: occ, max: Math.round(num(r.max, DEFAULT_CULL.max, 5, 400)), dimOpacity: num(r.dimOpacity, DEFAULT_CULL.dimOpacity, 0.1, 0.9) }
}

export function chooseHeaders (items, max = DEFAULT_CULL.max, keep = null) {
  const out = new Set(); const list = Array.isArray(items) ? items : []
  const cap = Math.round(num(max, DEFAULT_CULL.max, 1, 100000))
  const near = list.filter(i => i && i.onScreen && Number.isFinite(i.dist)).sort((a, b) => a.dist - b.dist)
  for (let i = 0; i < near.length && out.size < cap; i++) out.add(near[i].id)
  if (keep) for (const k of keep) out.add(k)
  return out
}

export function isBlocked (hitDistance, targetDistance, eps = 0.05) {
  if (!Number.isFinite(hitDistance) || !Number.isFinite(targetDistance)) return false
  return hitDistance < targetDistance - Math.max(0, eps)
}

export function stateFor (occluded, occlusion = 'hide') {
  if (!occluded || occlusion === 'show') return 'visible'
  return occlusion === 'dim' ? 'dim' : 'hidden'
}
export default { OCCLUSION, DEFAULT_CULL, sanitizeCullPrefs, chooseHeaders, isBlocked, stateFor }
