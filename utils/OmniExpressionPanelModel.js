/**
 * utils/OmniExpressionPanelModel.js (V195) — the pure rules of the OmniExpression panel (no DOM, no window needed): the key layout of the
 * two on-screen keyboards, note names, touch velocity, hit testing, and the saved panel state `omni:expression-panel-v1`.
 * Contract: docs/architecture/OMNIEXPRESSION_CONTRACT.md. Design: docs/architecture/OMNIEXPRESSION_PANEL_DESIGN.md.
 *
 * KEY LAYOUT — this file keeps its OWN copy of the layout table of the contract (agent 1 owns the real, user-editable key map in
 * utils/OmniExpressionKeys.js). The copy is only used to LABEL the on-screen keys and to give them a pitch; if the real module exists and
 * exports a map of the shape { L: { KeyA: 0, ... }, R: { ... } } (semitone offsets inside the octave block) it overrides the offsets, see
 * applyKeyMap() / loadKeyMap(). Anything else (missing module, other shape, hostile values) is ignored and the built-in table stays.
 *   LH black w e r t y = C# D# F# G# A#    home a s d f g = C D E F G    bottom z x c v = G A B C(up)
 *   RH black u i o p [ = C# D# F# G# A#    home j k l ; ' = C D E F G    bottom m , . / = G A B C(up)
 *   Base octave: LH 3 (C3 = midi 48), RH 4 (C4 = 60).  midi = (octave + 1) * 12 + semitone.
 */

export const PANEL_KEY = 'omni:expression-panel-v1'
export const QUADS = ['tl', 'tr', 'bl', 'br']
export const DEFAULT_LAYOUT = { tl: 'dj', tr: 'beatpad', bl: 'keysL', br: 'keysR' }   // mirrors utils/OmniQuadrantRegistry.js DEFAULT_LAYOUT (kept local so a missing registry never breaks the model)
export const BASE_OCTAVE = { L: 3, R: 4 }
export const OCT_MIN = 0
export const OCT_MAX = 7
export const MIXER_CHANNELS = 6

const K = (code, label, semi) => ({ code, label, semi })
export const KEY_ROWS = {
  L: {
    black: [K('KeyW', 'W', 1), K('KeyE', 'E', 3), K('KeyR', 'R', 6), K('KeyT', 'T', 8), K('KeyY', 'Y', 10)],
    home: [K('KeyA', 'A', 0), K('KeyS', 'S', 2), K('KeyD', 'D', 4), K('KeyF', 'F', 5), K('KeyG', 'G', 7)],
    bottom: [K('KeyZ', 'Z', 7), K('KeyX', 'X', 9), K('KeyC', 'C', 11), K('KeyV', 'V', 12)]
  },
  R: {
    black: [K('KeyU', 'U', 1), K('KeyI', 'I', 3), K('KeyO', 'O', 6), K('KeyP', 'P', 8), K('BracketLeft', '[', 10)],
    home: [K('KeyJ', 'J', 0), K('KeyK', 'K', 2), K('KeyL', 'L', 4), K('Semicolon', ';', 5), K('Quote', "'", 7)],
    bottom: [K('KeyM', 'M', 7), K('Comma', ',', 9), K('Period', '.', 11), K('Slash', '/', 12)]
  }
}
export const ROW_IDS = ['black', 'home', 'bottom']
export const HAND_NAME = { L: 'Left hand', R: 'Right hand' }

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const clampInt = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d }
const clamp01 = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d }

/** 60 -> 'C4'. Anything not a midi number gives ''. */
export function noteName (midi) {
  const n = Math.round(Number(midi))
  if (!Number.isFinite(n) || n < 0 || n > 127) return ''
  return NAMES[n % 12] + (Math.floor(n / 12) - 1)
}
export const midiOf = (octave, semi) => (clampInt(octave, OCT_MIN, OCT_MAX, 3) + 1) * 12 + semi

/** Fresh keys for one hand at an octave: [{ row, code, label, semi, midi, name, hand }], in row order black, home, bottom. */
export function buildHandKeys (hand, octave, rows = KEY_ROWS) {
  const h = hand === 'R' ? 'R' : 'L'
  const out = []
  for (const row of ROW_IDS) {
    for (const k of rows[h][row]) {
      const midi = midiOf(octave, k.semi)
      out.push({ hand: h, row, code: k.code, label: k.label, semi: k.semi, midi, name: noteName(midi) })
    }
  }
  return out
}

/** Does the (octave) block of this hand contain the pitch? (the block spans semitone 0..12) */
export function blockContains (octave, midi) { const b = midiOf(octave, 0); return midi >= b && midi <= b + 12 }
/** The octave whose block starts at the C at or below the pitch (used to follow the octave of the computer keys). */
export function octaveFor (midi) { return clampInt(Math.floor(Number(midi) / 12) - 1, OCT_MIN, OCT_MAX, 3) }

/** Return a copy of the key rows with semitone offsets replaced by a user map { L: { KeyA: 0 }, R: { ... } } where the map is valid. */
export function applyKeyMap (map, rows = KEY_ROWS) {
  const out = { L: {}, R: {} }
  for (const h of ['L', 'R']) {
    const src = map && typeof map === 'object' ? map[h] : null
    for (const row of ROW_IDS) {
      out[h][row] = rows[h][row].map(k => {
        const v = src && typeof src === 'object' && Object.prototype.hasOwnProperty.call(src, k.code) ? src[k.code] : undefined
        return Number.isInteger(v) && v >= 0 && v <= 24 ? { ...k, semi: v } : { ...k }
      })
    }
  }
  return out
}

/** Defensive read of agent 1's key map: dynamic import, any failure -> null (the built-in table stays). */
export async function loadKeyMap (importer = () => import('./OmniExpressionKeys.js')) {
  try {
    const m = await importer()
    const cand = (typeof m?.getKeyMap === 'function' ? m.getKeyMap() : null) ?? m?.KEY_MAP ?? m?.DEFAULT_KEY_MAP ?? m?.default?.KEY_MAP ?? null
    if (cand && typeof cand === 'object' && (cand.L || cand.R)) return applyKeyMap(cand)
  } catch (_) { /* the module may not exist (agent 1 not merged) */ }
  return null
}

/**
 * Touch velocity. A pen / touch pressure that looks real (not the 0 / 0.5 / 1 a browser reports when it has no sensor) wins;
 * otherwise the vertical position inside the key (top = soft 0.3, bottom = hard 1.0).
 */
export function velocityFrom ({ pointerType = 'mouse', pressure = 0, yFrac = 0.5 } = {}) {
  const p = Number(pressure)
  if (pointerType !== 'mouse' && Number.isFinite(p) && p > 0 && p !== 0.5 && p !== 1) return Math.round((0.2 + 0.8 * Math.min(1, p)) * 100) / 100
  return Math.round((0.3 + 0.7 * clamp01(yFrac, 0.5)) * 100) / 100
}
/** Vertical fraction of a point inside a rect (0 top .. 1 bottom); a rect without height gives 0.5. */
export function yFraction (rect, y) { return rect && rect.height > 0 ? clamp01((y - rect.top) / rect.height, 0.5) : 0.5 }

/** Hit test: [{ id, rect:{left,top,width,height} }] + a point -> the id under it (last one wins on overlap) or null. */
export function hitTest (items, x, y) {
  let hit = null
  for (const it of items) {
    const r = it.rect
    if (r && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height && r.width > 0 && r.height > 0) hit = it.id
  }
  return hit
}

// ── saved state ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9_-]{1,32}$/
const posOf = (p) => (p && typeof p === 'object' && Number.isFinite(p.left) && Number.isFinite(p.top) ? { left: Math.round(Math.min(10000, Math.max(-200, p.left))), top: Math.round(Math.min(10000, Math.max(0, p.top))) } : null)

export function defaultState () {
  return { v: 1, layout: { ...DEFAULT_LAYOUT }, split: false, pos: { L: null, R: null }, octave: { ...BASE_OCTAVE }, mixer: { level: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8], mute: [false, false, false, false, false, false], solo: [false, false, false, false, false, false] } }
}
/** Hostile-safe: only known keys are read, anything else is dropped; always returns a complete state. */
export function sanitizeState (raw) {
  const s = defaultState()
  if (!raw || typeof raw !== 'object') return s
  const lay = raw.layout && typeof raw.layout === 'object' ? raw.layout : {}
  for (const q of QUADS) { const v = Object.prototype.hasOwnProperty.call(lay, q) ? lay[q] : undefined; if (typeof v === 'string' && ID_RE.test(v)) s.layout[q] = v }
  s.split = raw.split === true
  const pos = raw.pos && typeof raw.pos === 'object' ? raw.pos : {}
  s.pos.L = posOf(pos.L); s.pos.R = posOf(pos.R)
  const oc = raw.octave && typeof raw.octave === 'object' ? raw.octave : {}
  s.octave.L = clampInt(oc.L, OCT_MIN, OCT_MAX, BASE_OCTAVE.L); s.octave.R = clampInt(oc.R, OCT_MIN, OCT_MAX, BASE_OCTAVE.R)
  const mx = raw.mixer && typeof raw.mixer === 'object' ? raw.mixer : {}
  for (let i = 0; i < MIXER_CHANNELS; i++) {
    s.mixer.level[i] = Array.isArray(mx.level) ? clamp01(mx.level[i], 0.8) : 0.8
    s.mixer.mute[i] = Array.isArray(mx.mute) ? mx.mute[i] === true : false
    s.mixer.solo[i] = Array.isArray(mx.solo) ? mx.solo[i] === true : false
  }
  return s
}
export function loadState (storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { return sanitizeState(JSON.parse(storage.getItem(PANEL_KEY) || 'null')) } catch (_) { return defaultState() }
}
export function saveState (state, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage.setItem(PANEL_KEY, JSON.stringify(sanitizeState(state))); return true } catch (_) { return false }
}

/** Effective audible level of the 6 mixer channels from level / mute / solo (solo wins: when any channel is soloed only soloed ones sound). */
export function mixerGains (mixer) {
  const m = mixer || {}
  const anySolo = Array.isArray(m.solo) && m.solo.slice(0, MIXER_CHANNELS).some(v => v === true)
  const out = []
  for (let i = 0; i < MIXER_CHANNELS; i++) {
    const lvl = clamp01(m.level?.[i], 0.8)
    const muted = m.mute?.[i] === true
    const soloed = m.solo?.[i] === true
    out.push(anySolo ? (soloed && !muted ? lvl : 0) : (muted ? 0 : lvl))
  }
  return out
}
