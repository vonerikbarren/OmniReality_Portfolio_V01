/**
 * utils/WallpaperRect.js — pure layout math for the Rectangle wallpaper shape (V191). No DOM, no THREE, no storage.
 *
 * The "Rectangle" wallpaper is a box room around the user (modules/WallpaperSphere.js builds it):
 *   - the FRONT and BACK walls are width x height panels (16:9 by default) that carry the media at its true aspect ratio;
 *   - the LEFT and RIGHT walls are depth x height panels (square by default: depth = height);
 *   - the TOP (ceiling) and BOTTOM (floor) are width x depth panels (also 16:9 by default).
 * A 1080p video or image therefore looks the way it was shot on the walls in front of and behind you, with square walls to
 * your left and right.
 *
 * Settings (all optional, stored flat inside the existing `omni:wallpaper:settings` object; old saves simply lack them):
 *   rectWidth  200..8000  world units, the front/back width           (default 2489 = 1400 x 16/9)
 *   rectHeight 200..4000  world units, the wall height = room depth   (default 1400)
 *   rectAspectLock bool   changing width or height moves the other one so the ratio is kept (default true)
 *   rectFit    'contain' | 'cover'   contain = whole picture visible, bars (rectBarColor) where it does not fill the panel;
 *                                    cover = fills the panel, the overflow is cropped                  (default 'contain')
 *   rectSides  'square' | 'mirror' | 'solid'   left/right walls: centred square crop | contained, edges mirrored | flat colour
 *   rectCaps   'media' | 'solid' | 'none'      top/bottom: widescreen media | flat colour | not drawn
 *   rectBarColor '#rrggbb'  letterbox bars and every "solid" wall
 */

export const RECT_SHAPE = 'RectangleRoom'
export const RECT_ASPECT = 16 / 9
export const RECT_DEFAULT_HEIGHT = 1400
export const RECT_DEFAULT_WIDTH = Math.round(RECT_DEFAULT_HEIGHT * RECT_ASPECT)   // 2489
export const RECT_MIN = 200
export const RECT_MAX_W = 8000
export const RECT_MAX_H = 4000
export const RECT_FITS = Object.freeze(['contain', 'cover'])
export const RECT_SIDES = Object.freeze(['square', 'mirror', 'solid'])
export const RECT_CAPS = Object.freeze(['media', 'solid', 'none'])
export const RECT_DEFAULTS = Object.freeze({
  rectWidth: RECT_DEFAULT_WIDTH, rectHeight: RECT_DEFAULT_HEIGHT, rectAspectLock: true,
  rectFit: 'contain', rectSides: 'square', rectCaps: 'media', rectBarColor: '#0b0b10',
})
export const RECT_KEYS = Object.freeze(Object.keys(RECT_DEFAULTS))

/** BoxGeometry material/face order. */
export const FACE_NAMES = Object.freeze(['right', 'left', 'top', 'bottom', 'front', 'back'])

const num = (v, lo, hi, fallback) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, n))
}
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback)
const hex = (v, fallback) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback)

/** Validation + migration: anything (undefined, an old save without these keys, junk) -> a complete, clamped rect settings object. */
export function normalizeRectSettings (raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  return {
    rectWidth: Math.round(num(r.rectWidth, RECT_MIN, RECT_MAX_W, RECT_DEFAULTS.rectWidth)),
    rectHeight: Math.round(num(r.rectHeight, RECT_MIN, RECT_MAX_H, RECT_DEFAULTS.rectHeight)),
    rectAspectLock: typeof r.rectAspectLock === 'boolean' ? r.rectAspectLock : RECT_DEFAULTS.rectAspectLock,
    rectFit: oneOf(r.rectFit, RECT_FITS, RECT_DEFAULTS.rectFit),
    rectSides: oneOf(r.rectSides, RECT_SIDES, RECT_DEFAULTS.rectSides),
    rectCaps: oneOf(r.rectCaps, RECT_CAPS, RECT_DEFAULTS.rectCaps),
    rectBarColor: hex(r.rectBarColor, RECT_DEFAULTS.rectBarColor),
  }
}

/** Only the rect keys of a patch (what the panel dispatches / the module merges). */
export function pickRectPatch (patch) {
  const out = {}
  if (patch && typeof patch === 'object') for (const k of RECT_KEYS) if (patch[k] !== undefined) out[k] = patch[k]
  return out
}

/**
 * The user changed width OR height. With the aspect lock the other one follows, keeping the current ratio.
 * @param {object} state  normalized rect settings (the values BEFORE the change)
 * @param {{rectWidth?:number, rectHeight?:number}} change
 * @returns {object} normalized settings after the change (both dims clamped)
 */
export function applyDimChange (state, change) {
  const s = normalizeRectSettings(state)
  const ratio = s.rectWidth / s.rectHeight
  let w = s.rectWidth, h = s.rectHeight
  if (change?.rectWidth !== undefined) {
    w = num(change.rectWidth, RECT_MIN, RECT_MAX_W, w)
    if (s.rectAspectLock) h = w / ratio
  } else if (change?.rectHeight !== undefined) {
    h = num(change.rectHeight, RECT_MIN, RECT_MAX_H, h)
    if (s.rectAspectLock) w = h * ratio
  }
  // clamp the follower; if that moved it, bring the leader back in line so the ratio survives
  if (s.rectAspectLock) {
    if (w > RECT_MAX_W) { w = RECT_MAX_W; h = w / ratio }
    if (h > RECT_MAX_H) { h = RECT_MAX_H; w = h * ratio }
    if (w < RECT_MIN) { w = RECT_MIN; h = w / ratio }
    if (h < RECT_MIN) { h = RECT_MIN; w = h * ratio }
  }
  return normalizeRectSettings({ ...s, rectWidth: w, rectHeight: h })
}

/** Reset to the 16:9 shape at the current height. */
export function resetTo169 (state) {
  const s = normalizeRectSettings(state)
  return normalizeRectSettings({ ...s, rectWidth: s.rectHeight * RECT_ASPECT })
}

/** Box dimensions (x = width, y = height, z = depth). The left/right walls are square: depth = height. */
export function boxSize (settings) {
  const s = normalizeRectSettings(settings)
  return { w: s.rectWidth, h: s.rectHeight, d: s.rectHeight }
}

/** Panel width/height in world units, per face name. */
export function panelSizes (settings) {
  const { w, h, d } = boxSize(settings)
  return {
    front: { w, h }, back: { w, h },
    left: { w: d, h }, right: { w: d, h },
    top: { w, h: d }, bottom: { w, h: d },
  }
}

/**
 * Which part of the texture (in 0..1 uv space, may exceed it for 'contain') a panel shows.
 * contain: the whole media is visible, uv overshoots 0..1 on the short axis (those pixels are the bars);
 * cover: the panel is filled, uv stays inside 0..1 (the overflow is cropped, centred).
 * @param {number} panelAspect width / height of the panel
 * @param {number} mediaAspect width / height of the media
 * @returns {{u0:number,u1:number,v0:number,v1:number}}
 */
export function fitUV (panelAspect, mediaAspect, fit = 'contain') {
  const P = Number.isFinite(panelAspect) && panelAspect > 0 ? panelAspect : 1
  const M = Number.isFinite(mediaAspect) && mediaAspect > 0 ? mediaAspect : P
  const r = M / P
  const wide = r >= 1   // media wider than the panel
  if (fit === 'cover') {
    return wide ? { u0: 0.5 - 0.5 / r, u1: 0.5 + 0.5 / r, v0: 0, v1: 1 } : { u0: 0, u1: 1, v0: 0.5 - 0.5 * r, v1: 0.5 + 0.5 * r }
  }
  return wide ? { u0: 0, u1: 1, v0: 0.5 - 0.5 * r, v1: 0.5 + 0.5 * r } : { u0: 0.5 - 0.5 / r, u1: 0.5 + 0.5 / r, v0: 0, v1: 1 }
}

/**
 * Per-face plan, in BoxGeometry material order (right, left, top, bottom, front, back).
 * @param {object} settings  rect settings (any shape, normalized here)
 * @param {number} mediaAspect  width/height of the current media (image or video); falls back to 16:9
 * @returns {Array<{name:string, panel:{w:number,h:number}, mode:'media'|'solid'|'none', uv:object|null, bars:boolean}>}
 *   bars = pixels outside uv 0..1 are painted rectBarColor (letterbox); false = the texture's mirrored wrap fills them.
 */
export function layoutFaces (settings, mediaAspect) {
  const s = normalizeRectSettings(settings)
  const M = Number.isFinite(mediaAspect) && mediaAspect > 0 ? mediaAspect : RECT_ASPECT
  const sizes = panelSizes(s)
  return FACE_NAMES.map((name) => {
    const panel = sizes[name]
    const P = panel.w / panel.h
    if (name === 'front' || name === 'back') return { name, panel, mode: 'media', uv: fitUV(P, M, s.rectFit), bars: s.rectFit === 'contain' }
    if (name === 'left' || name === 'right') {
      if (s.rectSides === 'solid') return { name, panel, mode: 'solid', uv: null, bars: false }
      if (s.rectSides === 'mirror') return { name, panel, mode: 'media', uv: fitUV(P, M, 'contain'), bars: false }
      return { name, panel, mode: 'media', uv: fitUV(P, M, 'cover'), bars: false }   // square crop
    }
    if (s.rectCaps === 'none') return { name, panel, mode: 'none', uv: null, bars: false }
    if (s.rectCaps === 'solid') return { name, panel, mode: 'solid', uv: null, bars: false }
    return { name, panel, mode: 'media', uv: fitUV(P, M, s.rectFit), bars: s.rectFit === 'contain' }
  })
}

/**
 * The 8 uv floats of ONE box face in BoxGeometry vertex order ((ix0,iy0) (ix1,iy0) (ix0,iy1) (ix1,iy1) = top-left, top-right,
 * bottom-left, bottom-right). Seen from INSIDE (BackSide) every box face is mirrored, so flipX (default true) swaps u0 and u1.
 */
export function faceUVArray (uv, flipX = true) {
  const { u0, u1, v0, v1 } = uv || { u0: 0, u1: 1, v0: 0, v1: 1 }
  const l = flipX ? u1 : u0
  const r = flipX ? u0 : u1
  return [l, v1, r, v1, l, v0, r, v0]
}
