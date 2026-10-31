/**
 * utils/OmniSequenceBadgeModel.js (V255) — pure: which nodes get a sequence-number badge, and what it says.
 *   badgesFor(lineupState, { showTotal }) -> [{ nodeId, lineupId, n, total, text }]   (one per node; the first lineup that lists a node wins)
 *   sanitizePrefs(raw) -> { on, showTotal }            badgeScale(distance, size) -> world size so a badge keeps a steady size on screen
 *   Never throws on hostile input.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
export const DEFAULT_PREFS = Object.freeze({ on: true, showTotal: false })

export function sanitizePrefs (raw) {
  const r = isObj(raw) ? raw : {}
  return { on: typeof r.on === 'boolean' ? r.on : DEFAULT_PREFS.on, showTotal: typeof r.showTotal === 'boolean' ? r.showTotal : DEFAULT_PREFS.showTotal }
}

export function badgesFor (state, { showTotal = false } = {}) {
  const out = []; const seen = new Set()
  const L = isObj(state) && isObj(state.lineups) ? state.lineups : {}
  for (const lineupId of Object.keys(L)) {
    const order = Array.isArray(L[lineupId]?.order) ? L[lineupId].order : []
    order.forEach((nodeId, i) => {
      if (typeof nodeId !== 'string' || seen.has(nodeId)) return
      seen.add(nodeId)
      out.push({ nodeId, lineupId, n: i + 1, total: order.length, text: showTotal ? `${i + 1}/${order.length}` : String(i + 1) })
    })
  }
  return out
}

/** World size of a badge that should look about `size` (0..1 of the view height, default 5%) at `distance` for a camera with vertical fov (degrees). */
export function badgeScale (distance, size = 0.05, fov = 60) {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : 0
  const f = Number.isFinite(fov) ? Math.min(150, Math.max(10, fov)) : 60
  const s = Math.min(0.3, Math.max(0.01, Number.isFinite(size) ? size : 0.05))
  return Math.max(0.3, 2 * d * Math.tan((f * Math.PI) / 360) * s)
}
