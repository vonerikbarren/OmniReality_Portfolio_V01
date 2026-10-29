/**
 * utils/OmniDocPageLayouts.js (V242) — pure: where N pages of a document go in space.
 *   layoutPages({ layout, count, width, aspect, center }) -> { layout, count, radius, pages: [{ page, position:[x,y,z], rotation:[rx,ry,rz], normal:[x,y,z] }] }
 * A page's FRONT faces +z in the sheet mesh, so `normal` is where the front looks and `rotation` (Euler, order 'YXZ') turns +z to that normal with no roll.
 * Layouts:  row (side by side) · grid · tunnel (a vertical square tunnel, 4 walls per ring, rings stacked up) · helix (a spiral staircase of pages, facing the axis)
 *           sphereIn (pages on the inside of a sphere, facing the middle) · sphereOut (pages on the outside, facing away)
 * Counts are 1, 2, 4, 6, 8, 10 or 25: anything else snaps to the nearest. Never throws; bad numbers fall back to defaults.
 */
export const LAYOUTS = Object.freeze(['row', 'grid', 'tunnel', 'helix', 'sphereIn', 'sphereOut'])
export const COUNTS = Object.freeze([1, 2, 4, 6, 8, 10, 25])
export const ALIASES = Object.freeze({ spiral: 'helix', sphere: 'sphereIn', 'sphere-in': 'sphereIn', sphereinternal: 'sphereIn', 'sphere-out': 'sphereOut', sphereexternal: 'sphereOut', external: 'sphereOut', internal: 'sphereIn', line: 'row' })
const GAP = 1.04
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function pickLayout (name) {
  const k = String(name ?? '').trim(); const lc = k.toLowerCase()
  const hit = LAYOUTS.find(l => l.toLowerCase() === lc)
  return hit ?? ALIASES[lc] ?? null
}
export function snapCount (n) {
  const v = Number(n); if (!Number.isFinite(v)) return 4
  return COUNTS.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), COUNTS[0])
}
/** Euler (YXZ) that turns +z to the unit vector n, with no roll. */
export function eulerFacing (n) {
  const [x, y, z] = n; const yaw = Math.atan2(x, z); const pitch = -Math.asin(Math.min(1, Math.max(-1, y)))
  return [pitch, yaw, 0]
}
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map(c => c / l) }

export function layoutPages (opts = {}) {
  const layout = pickLayout(opts.layout) ?? 'row'
  const count = opts.exact ? Math.round(num(opts.count, 1, 1, 60)) : snapCount(opts.count ?? 4)   // exact: any count 1-60 (the lineups use this)
  const w = num(opts.width, 4, 0.5, 60); const a = num(opts.aspect, 1.414, 0.2, 5); const h = w * a
  const c = Array.isArray(opts.center) && opts.center.length >= 3 && opts.center.slice(0, 3).every(Number.isFinite) ? opts.center : [0, 0, 0]
  const out = []; let radius = 0
  const put = (i, p, n) => out.push({ page: i + 1, position: [c[0] + p[0], c[1] + p[1], c[2] + p[2]], rotation: eulerFacing(n), normal: n })
  if (layout === 'row') {
    for (let i = 0; i < count; i++) put(i, [(i - (count - 1) / 2) * w * GAP, 0, 0], [0, 0, 1])
  } else if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(count)); const rows = Math.ceil(count / cols)
    for (let i = 0; i < count; i++) { const r = Math.floor(i / cols); const k = i % cols; put(i, [(k - (cols - 1) / 2) * w * GAP, ((rows - 1) / 2 - r) * h * GAP, 0], [0, 0, 1]) }
  } else if (layout === 'tunnel') {
    radius = w / 2                                                   // a square tunnel: the wall is one page wide, so the middle of each wall is w/2 from the axis
    const rings = Math.ceil(count / 4)
    for (let i = 0; i < count; i++) {
      const ring = Math.floor(i / 4); const side = i % 4; const th = side * Math.PI / 2
      const p = [Math.sin(th) * radius, (ring - (rings - 1) / 2) * h * GAP, Math.cos(th) * radius]
      put(i, p, unit([-p[0], 0, -p[2]]))                            // facing the axis: you read them from inside
    }
  } else if (layout === 'helix') {
    const per = 6; radius = w / (2 * Math.sin(Math.PI / per)); const rise = h * GAP                   // 6 pages a turn; one turn rises one page height
    for (let i = 0; i < count; i++) {
      const th = (i / per) * Math.PI * 2; const p = [Math.sin(th) * radius, (i / per) * rise - ((count - 1) / per) * rise / 2, Math.cos(th) * radius]
      put(i, p, unit([-p[0], 0, -p[2]]))
    }
  } else {                                                           // sphereIn / sphereOut: a Fibonacci spread, radius from the page area
    radius = Math.max(w, Math.sqrt(count * w * h * 2 / (4 * Math.PI)))
    const inward = layout === 'sphereIn'; const ga = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const yy = count === 1 ? 0 : 1 - (2 * (i + 0.5)) / count; const r = Math.sqrt(Math.max(0, 1 - yy * yy)); const th = ga * i
      const d = [Math.sin(th) * r, yy, Math.cos(th) * r]
      put(i, d.map(v => v * radius), inward ? d.map(v => -v) : d)
    }
  }
  return { layout, count, radius: Math.round(radius * 1000) / 1000, width: w, height: h, pages: out }
}

export function describe () {
  return 'layouts: ' + LAYOUTS.join(', ') + ' (also: spiral = helix, sphere = sphereIn, external = sphereOut)\ncounts: ' + COUNTS.join(', ')
}
export default { LAYOUTS, COUNTS, layoutPages, pickLayout, snapCount, eulerFacing, describe }
