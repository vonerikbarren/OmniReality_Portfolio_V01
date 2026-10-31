/**
 * utils/OmniObjectPaintModel.js (V256) — pure maths of OmniObjectPainter (colour painted onto a node's own surface).
 *   TEX = 256 (the paint texture is 256 x 256 per painted node)
 *   dabPlan(uv, dab, soft) -> { x, y, r, inner }   the centre in texture pixels, the radius, and where the full-colour core ends (0..1 of r)
 *   uvOk(uv) -> boolean       strokeKey(id) · MAX_LAYERS · MAX_UNDO
 * A dab is a round soft brush: solid colour out to r * inner, fading to nothing at r. `dab` is the brush width in pixels at 256 (4..96).
 */
export const TEX = 256
export const MAX_LAYERS = 40      // painted nodes at once (each is a 256 x 256 canvas, 256 KB)
export const MAX_UNDO = 20        // strokes that can be taken back
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const fin = (v) => typeof v === 'number' && Number.isFinite(v)

export const uvOk = (uv) => !!uv && fin(uv.x) && fin(uv.y)

export function dabPlan (uv, dab = 28, soft = 0.5) {
  if (!uvOk(uv)) return null
  const u = ((uv.x % 1) + 1) % 1 || (uv.x === 1 ? 1 : 0); const v = clamp(uv.y, 0, 1)   // u wraps (a sphere's seam), v does not
  const r = clamp(fin(dab) ? dab : 28, 4, 96) / 2
  return { x: +(u * TEX).toFixed(2), y: +((1 - v) * TEX).toFixed(2), r: +r.toFixed(2), inner: +clamp(1 - (fin(soft) ? soft : 0.5), 0, 1).toFixed(3) }
}
