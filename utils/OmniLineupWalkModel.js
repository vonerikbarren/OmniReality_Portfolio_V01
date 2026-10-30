/**
 * utils/OmniLineupWalkModel.js (V247) — pure: where the camera stands to look at each stop of a lineup (utils/OmniLineupModel.js).
 *   stopPose(layout, center, nodePos, distance) -> { cam:[x,y,z], look:[x,y,z] }
 *   Inward shapes (tunnel, helix, sphereIn): the camera stands on the INSIDE, on the line from the node toward the middle, and looks out at the node (you walk through the structure).
 *   Outward shapes (sphereOut): the camera stands outside the node on the line from the middle, looking back at it.
 *   Flat shapes (row, grid): the camera stands in front (+z) of the node, slightly raised, looking at it.
 *   walkPlan(order, positions, { layout, center, distance, from, loop }) -> [{ id, index, number, cam, look }] in sequence order starting at `from` (1-based). Missing nodes are skipped; the numbers stay the sequence numbers.
 *   readout(i, n, label) -> '2 / 5 · label'
 * Never throws; bad numbers fall back to defaults (distance 8, 2 .. 60).
 */
export const DIST = { def: 8, min: 2, max: 60 }
const INWARD = new Set(['tunnel', 'helix', 'sphereIn'])
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const v3 = (a, d = [0, 0, 0]) => (Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every(Number.isFinite) ? a.slice(0, 3) : d)

export function stopPose (layout, center, nodePos, distance = DIST.def) {
  const c = v3(center); const p = v3(nodePos); const d = num(distance, DIST.def, DIST.min, DIST.max)
  if (layout === 'row' || layout === 'grid') return { cam: [p[0], p[1] + d * 0.15, p[2] + d], look: p.slice() }
  let n = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
  // helix and tunnel are vertical: ignore height in the horizontal direction so the camera stays level with the node
  if (layout === 'helix' || layout === 'tunnel') n[1] = 0
  const len = Math.hypot(...n) || 1; n = n.map(x => x / len)
  if (len === 1 && n[0] === 0 && n[1] === 0 && n[2] === 0) n = [0, 0, 1]
  const s = INWARD.has(layout) ? -1 : 1
  return { cam: [p[0] + s * n[0] * d, p[1] + s * n[1] * d + (INWARD.has(layout) ? 0 : d * 0.1), p[2] + s * n[2] * d], look: p.slice() }
}

export function walkPlan (order, positions, { layout = 'row', center = [0, 0, 0], distance = DIST.def, from = 1, loop = false } = {}) {
  const ids = Array.isArray(order) ? order : []; const out = []
  const start = Math.max(1, Math.min(ids.length || 1, Math.round(num(from, 1, 1, 9999))))
  const idx = []; for (let i = start - 1; i < ids.length; i++) idx.push(i)
  if (loop) for (let i = 0; i < start - 1; i++) idx.push(i)
  for (const i of idx) { const id = ids[i]; const pos = positions?.[id]; if (!pos) continue; out.push({ id, index: i, number: i + 1, ...stopPose(layout, center, pos, distance) }) }
  return out
}
export const readout = (i, n, label = '') => `${i} / ${n}${label ? ' · ' + String(label).slice(0, 40) : ''}`
export default { stopPose, walkPlan, readout, DIST }
