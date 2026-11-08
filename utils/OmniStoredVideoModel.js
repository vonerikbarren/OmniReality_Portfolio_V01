/**
 * utils/OmniStoredVideoModel.js (V277) — the data of a StoredVideoNode: ONE library video drawn on a flat plane, with chroma-key settings so a green (or blue) backdrop disappears.
 * Pure: no DOM, no three.js. keyAlpha() is the JS reference of the shader in utils/OmniStoredVideoNodeMesh.js; tests hold the two to the same maths.
 *
 * data.storedVideo = { source:{type:'video', id}|null, key:{ enabled, color:'#00ff00', similarity, smoothness, spill }, width, loop, muted, volume, autoplay, flip }
 *   similarity  0..1  how far from the key colour still counts as backdrop (bigger = more removed)
 *   smoothness  0..1  the soft edge beyond similarity
 *   spill       0..1  how much of the key colour's tint is pulled out of the pixels that stay
 */
export const KEY_PRESETS = Object.freeze({
  green: '#00ff00',
  blue: '#0000ff',
  magenta: '#ff00ff'
})
export const LIMITS = Object.freeze({ width: [0.5, 40], similarity: [0, 1], smoothness: [0, 1], spill: [0, 1], volume: [0, 1] })

const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const HEX = /^#[0-9a-fA-F]{6}$/

export function defaultStoredVideo () {
  return { source: null, key: { enabled: true, color: KEY_PRESETS.green, similarity: 0.4, smoothness: 0.08, spill: 0.1 }, width: 6, loop: true, muted: true, volume: 0.8, autoplay: true, flip: false }
}

export function sanitizeStoredVideo (raw) {
  const d = defaultStoredVideo()
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const k = r.key && typeof r.key === 'object' && !Array.isArray(r.key) ? r.key : {}
  const s = r.source && typeof r.source === 'object' && !Array.isArray(r.source) ? r.source : null
  const id = s && typeof s.id === 'string' ? s.id.replace(/[^\w.:-]/g, '').slice(0, 96) : ''
  const color = typeof k.color === 'string' && HEX.test(k.color) ? k.color.toLowerCase() : (typeof k.color === 'string' && KEY_PRESETS[k.color]) || d.key.color
  return {
    source: id ? { type: 'video', id } : null,
    key: {
      enabled: typeof k.enabled === 'boolean' ? k.enabled : d.key.enabled,
      color,
      similarity: clamp(k.similarity, ...LIMITS.similarity, d.key.similarity),
      smoothness: clamp(k.smoothness, ...LIMITS.smoothness, d.key.smoothness),
      spill: clamp(k.spill, ...LIMITS.spill, d.key.spill)
    },
    width: clamp(r.width, ...LIMITS.width, d.width),
    loop: typeof r.loop === 'boolean' ? r.loop : d.loop,
    muted: typeof r.muted === 'boolean' ? r.muted : d.muted,
    volume: clamp(r.volume, ...LIMITS.volume, d.volume),
    autoplay: typeof r.autoplay === 'boolean' ? r.autoplay : d.autoplay,
    flip: typeof r.flip === 'boolean' ? r.flip : d.flip
  }
}

export function hexToRgb (hex) {
  const h = HEX.test(hex) ? hex : '#00ff00'
  return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
}
/** BT.601 chroma (Cb, Cr) of an rgb triple in 0..1 */
export function chromaOf ([r, g, b]) { return [-0.168736 * r - 0.331264 * g + 0.5 * b, 0.5 * r - 0.418688 * g - 0.081312 * b] }
const smoothstep = (a, b, x) => { if (b <= a) return x < a ? 0 : 1; const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Reference of the shader: { alpha 0..1, rgb } for one pixel. Chroma distance only, so a shadow on the backdrop (darker green) is still removed. */
export function keyAlpha (rgb, key) {
  const k = sanitizeStoredVideo({ key }).key
  if (!k.enabled) return { alpha: 1, rgb: rgb.slice(0, 3) }
  const kc = chromaOf(hexToRgb(k.color)), pc = chromaOf(rgb)
  const dist = Math.hypot(pc[0] - kc[0], pc[1] - kc[1])
  // chroma distance runs 0..~0.7; similarity 1 = everything
  const alpha = smoothstep(k.similarity * 0.7, k.similarity * 0.7 + Math.max(0.0001, k.smoothness * 0.7), dist)
  // spill: take the key tint out of what stays (pull the key's dominant channel down toward the other two)
  const out = rgb.slice(0, 3)
  if (k.spill > 0) {
    const kr = hexToRgb(k.color); const ch = kr.indexOf(Math.max(...kr))
    const others = [0, 1, 2].filter(i => i !== ch); const lim = (out[others[0]] + out[others[1]]) / 2
    if (out[ch] > lim) out[ch] = out[ch] - (out[ch] - lim) * k.spill
  }
  return { alpha, rgb: out }
}

/** The plane's height from the video's own size (never stretched). */
export function planeSize (width, vw, vh) {
  const w = clamp(width, ...LIMITS.width, 6); const a = Number(vw) > 0 && Number(vh) > 0 ? Number(vh) / Number(vw) : 9 / 16
  return { w, h: w * Math.min(8, Math.max(0.125, a)) }
}
