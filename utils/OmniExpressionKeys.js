/**
 * utils/OmniExpressionKeys.js (V195) — PURE key map of the Expression typing mode (no DOM, no storage). Contract: docs/architecture/OMNIEXPRESSION_CONTRACT.md.
 *
 * Everything is by `event.code` (the PHYSICAL key, so it is the same on QWERTY / AZERTY / Dvorak labels and with Shift or Caps Lock held).
 *
 *   Left hand  (base octave 3, C3 = midi 48)       Right hand (base octave 4, C4 = midi 60)
 *     black  W  E     R  T  Y   = C# D#  F# G# A#     black  U  I     O  P  [   = C# D#  F# G# A#
 *     white  A  S  D  F  G      = C  D  E  F  G      white  J  K  L  ;  '      = C  D  E  F  G
 *     bottom Z  X  C  V         = G  A  B  C(+1)     bottom M  ,  .  /         = G  A  B  C(+1)
 *   The bottom row repeats G (G is on the home row AND on Z / M: both give the same pitch, the input bus counts the two keys as one note).
 *   Other keys: Space = sustain, B / N = octave down / up, Left Shift + Up/Down = modulation, Right Shift + arrows = pitch bend (Up/Down) and
 *   a second axis (Left/Right), Enter = transport, Cmd/Ctrl+Enter = record, Escape = leave, Cmd/Ctrl+K = toggle the mode.
 *
 * The map is DATA: DEFAULT_KEYS rows { code, hand, semi, row, label } where `semi` = semitones above the C of the hand's base octave. The person can change
 * `semi` per key in the settings (`keyOverrides: { [code]: semi }`); buildKeyMap(settings) applies the overrides. Octaves: keyToNote(code, state) with
 * state = { octL, octR } (the CURRENT octaves); shiftOctave() moves them by scope. Notes outside midi 0..127 are not played (keyToNote -> null).
 */

export const OCT_MIN = -1       // C-1 = midi 0
export const OCT_MAX = 9        // C9 = midi 120 (the top keys of the octave then fall above 127 and are silent)
export const SEMI_MIN = -36
export const SEMI_MAX = 48
export const SCOPES = Object.freeze(['both', 'left', 'right', 'last'])
export const NOTE_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])

const row = (hand, row, codes, semis, labels) => codes.map((code, i) => Object.freeze({ code, hand, semi: semis[i], row, label: labels[i] }))
/** the factory key table (frozen). */
export const DEFAULT_KEYS = Object.freeze([
  ...row('L', 'black', ['KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'], [1, 3, 6, 8, 10], ['W', 'E', 'R', 'T', 'Y']),
  ...row('L', 'home', ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'], [0, 2, 4, 5, 7], ['A', 'S', 'D', 'F', 'G']),
  ...row('L', 'bottom', ['KeyZ', 'KeyX', 'KeyC', 'KeyV'], [7, 9, 11, 12], ['Z', 'X', 'C', 'V']),
  ...row('R', 'black', ['KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft'], [1, 3, 6, 8, 10], ['U', 'I', 'O', 'P', '[']),
  ...row('R', 'home', ['KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'], [0, 2, 4, 5, 7], ['J', 'K', 'L', ';', "'"]),
  ...row('R', 'bottom', ['KeyM', 'Comma', 'Period', 'Slash'], [7, 9, 11, 12], ['M', ',', '.', '/'])
])

export const DEFAULT_BASE = Object.freeze({ L: 3, R: 4 })

/** the non-note keys the mode owns (a registry: used by the settings table, the docs and the hints). */
export const SPECIAL_KEYS = Object.freeze({
  Space: Object.freeze({ type: 'sustain', label: 'Space', desc: 'Sustain pedal while held' }),
  KeyB: Object.freeze({ type: 'octave', delta: -1, label: 'B', desc: 'Octave down (scope in the settings)' }),
  KeyN: Object.freeze({ type: 'octave', delta: 1, label: 'N', desc: 'Octave up (scope in the settings)' }),
  ArrowUp: Object.freeze({ type: 'arrow', dir: 'up', label: 'Up', desc: 'Left Shift + Up: modulation up. Right Shift + Up: pitch bend up' }),
  ArrowDown: Object.freeze({ type: 'arrow', dir: 'down', label: 'Down', desc: 'Left Shift + Down: modulation down. Right Shift + Down: pitch bend down' }),
  ArrowLeft: Object.freeze({ type: 'arrow', dir: 'left', label: 'Left', desc: 'Right Shift + Left: second axis (pan) left' }),
  ArrowRight: Object.freeze({ type: 'arrow', dir: 'right', label: 'Right', desc: 'Right Shift + Right: second axis (pan) right' }),
  Enter: Object.freeze({ type: 'transport', label: 'Enter', desc: 'Play / stop the transport. Cmd/Ctrl + Enter: record' }),
  Escape: Object.freeze({ type: 'escape', label: 'Esc', desc: 'Leave Expression typing' }),
  ShiftLeft: Object.freeze({ type: 'shift', side: 'L', label: 'Left Shift', desc: 'With Up / Down: modulation' }),
  ShiftRight: Object.freeze({ type: 'shift', side: 'R', label: 'Right Shift', desc: 'With the arrows: pitch bend and second axis' })
})

const clampInt = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d }
export const clampOctave = (o, d = 3) => clampInt(o, OCT_MIN, OCT_MAX, d)

/** midi -> 'C#4' */
export function midiName (midi) { const m = Math.round(Number(midi)); if (!Number.isFinite(m)) return ''; return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1) }

/** settings (any shape) -> { baseL, baseR, overrides } (clean). */
function readSettings (settings) {
  const s = settings && typeof settings === 'object' ? settings : {}
  const ov = {}
  const src = s.keyOverrides && typeof s.keyOverrides === 'object' && !Array.isArray(s.keyOverrides) ? s.keyOverrides : {}
  for (const k of Object.keys(src)) { if (!Object.prototype.hasOwnProperty.call(src, k)) continue; const n = Number(src[k]); if (typeof src[k] !== 'boolean' && src[k] !== null && src[k] !== '' && Number.isFinite(n)) ov[k] = clampInt(n, SEMI_MIN, SEMI_MAX, 0) }
  return { baseL: clampOctave(s.baseOctaveL, DEFAULT_BASE.L), baseR: clampOctave(s.baseOctaveR, DEFAULT_BASE.R), overrides: ov }
}

/** The key map for the settings: Map code -> { code, hand, semi, row, label, defaultSemi, edited }. Unknown override codes are ignored. */
export function buildKeyMap (settings) {
  const { overrides } = readSettings(settings)
  const map = new Map()
  for (const k of DEFAULT_KEYS) {
    const has = Object.prototype.hasOwnProperty.call(overrides, k.code)
    map.set(k.code, { code: k.code, hand: k.hand, semi: has ? overrides[k.code] : k.semi, row: k.row, label: k.label, defaultSemi: k.semi, edited: has && overrides[k.code] !== k.semi })
  }
  return map
}

/** a fresh octave state from the settings: { octL, octR, last: null }. */
export function createKeyState (settings) { const r = readSettings(settings); return { octL: r.baseL, octR: r.baseR, last: null } }

/**
 * The note a key plays. `state` = { octL, octR } (current octaves). Returns { midi, hand, code, name, label, semi } or null (not a note key, or out of 0..127).
 * `keyMap` is optional (a prebuilt buildKeyMap(); the defaults otherwise).
 */
export function keyToNote (code, state, keyMap) {
  const map = keyMap instanceof Map ? keyMap : DEFAULT_MAP
  const k = typeof code === 'string' ? map.get(code) : null
  if (!k) return null
  const st = state && typeof state === 'object' ? state : {}
  const oct = clampOctave(k.hand === 'L' ? st.octL : st.octR, k.hand === 'L' ? DEFAULT_BASE.L : DEFAULT_BASE.R)
  const midi = 12 * (oct + 1) + k.semi
  if (!(midi >= 0 && midi <= 127)) return null
  return { midi, hand: k.hand, code: k.code, name: midiName(midi), label: k.label, semi: k.semi }
}
const DEFAULT_MAP = buildKeyMap({})

/**
 * Octave shift. Returns a NEW state { octL, octR, last }. scope: 'both' | 'left' | 'right' | 'last' (the hand that played the most recent note; both if none yet).
 * delta is rounded; the result is clamped to OCT_MIN..OCT_MAX.
 */
export function shiftOctave (state, delta, scope = 'both') {
  const st = state && typeof state === 'object' ? state : {}
  const d = Math.round(Number(delta)) || 0
  const out = { octL: clampOctave(st.octL, DEFAULT_BASE.L), octR: clampOctave(st.octR, DEFAULT_BASE.R), last: st.last === 'L' || st.last === 'R' ? st.last : null }
  const sc = SCOPES.includes(scope) ? scope : 'both'
  const target = sc === 'last' ? (out.last || 'both') : sc === 'left' ? 'L' : sc === 'right' ? 'R' : 'both'
  if (target === 'both' || target === 'L') out.octL = clampOctave(out.octL + d)
  if (target === 'both' || target === 'R') out.octR = clampOctave(out.octR + d)
  return out
}

/**
 * Classify one key (by code) given the modifier state. Returns a plain descriptor or null for a key the mode does not use:
 *   { type:'note', ...keyToNote } | { type:'sustain' } | { type:'octave', delta } | { type:'mod', dir:'up'|'down' } | { type:'bend', dir:'up'|'down' } |
 *   { type:'bend2', dir:'left'|'right' } | { type:'transport' } | { type:'record' } | { type:'escape' } | { type:'shift', side } | { type:'arrow-idle', dir }
 * mods = { shiftL, shiftR, meta, ctrl } (booleans; the caller tracks the two Shift keys by their own codes).
 */
export function resolveKey (code, mods, state, keyMap) {
  const m = mods && typeof mods === 'object' ? mods : {}
  const sp = typeof code === 'string' && Object.prototype.hasOwnProperty.call(SPECIAL_KEYS, code) ? SPECIAL_KEYS[code] : null
  if (sp) {
    switch (sp.type) {
      case 'arrow':
        if (m.shiftR && (sp.dir === 'up' || sp.dir === 'down')) return { type: 'bend', dir: sp.dir }
        if (m.shiftR) return { type: 'bend2', dir: sp.dir }
        if (m.shiftL && (sp.dir === 'up' || sp.dir === 'down')) return { type: 'mod', dir: sp.dir }
        return { type: 'arrow-idle', dir: sp.dir }
      case 'transport': return (m.meta || m.ctrl) ? { type: 'record' } : { type: 'transport' }
      case 'octave': return { type: 'octave', delta: sp.delta }
      case 'shift': return { type: 'shift', side: sp.side }
      default: return { type: sp.type }
    }
  }
  const n = keyToNote(code, state, keyMap)
  return n ? { type: 'note', ...n } : null
}

/** Every key the mode owns (notes + specials) - for the settings table / hints. */
export function allOwnedCodes (keyMap) { return [...(keyMap instanceof Map ? keyMap : DEFAULT_MAP).keys(), ...Object.keys(SPECIAL_KEYS)] }

export default { DEFAULT_KEYS, DEFAULT_BASE, SPECIAL_KEYS, SCOPES, OCT_MIN, OCT_MAX, buildKeyMap, createKeyState, keyToNote, shiftOctave, resolveKey, midiName, clampOctave, allOwnedCodes }
