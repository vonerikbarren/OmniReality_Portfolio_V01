/**
 * utils/OmniBeatPadModel.js (V195) — pure rules of the OmniBeatPad (4x4 = exactly 16 pads): pad data, hostile-safe sanitizing, kit presets,
 * the keyboard hint map, the saved state `omni:beatpad-v1`. No DOM, no window.
 *
 * A pad: { label, colour, binding, mode, choke, volume }
 *   binding  null (only the pad note goes to the InputBus)
 *          | { kind:'note',   midi }                         plays that note through the bus (default: the pad note 36 + index)
 *          | { kind:'sound',  nodeId }                       also sends the window event omni:sound-play-request { nodeId } (stop request on release)
 *          | { kind:'sample', sampleSlot (1..15), nodeId? }  an OmniMusicPlayer library slot; when a nodeId is given it is played like a sound
 *   mode     'oneshot' (a short hit) | 'hold' (sounds while the pad is held) | 'toggle' (loop: first hit starts, next hit stops)
 *   choke    0 = none, 1..8 = choke group (a hit silences the other pads of the group)
 *   volume   0..1 per pad (multiplies the velocity)
 * Pads are numbered like GM drum pads: index 0 = note 36 (bottom-left of the grid, as on an MPC) .. index 15 = note 51 (top-right).
 */
export const BEATPAD_KEY = 'omni:beatpad-v1'
export const PAD_COUNT = 16
export const COLS = 4
export const BASE_NOTE = 36
export const MODES = ['oneshot', 'hold', 'toggle']
export const MODE_LABELS = { oneshot: 'One-shot', hold: 'Hold', toggle: 'Toggle loop' }
export const CHOKE_MAX = 8
export const KINDS = ['none', 'note', 'sound', 'sample']
export const COLOURS = ['#ff5d73', '#ff8a4d', '#ffc93d', '#c5e84d', '#4de88a', '#4de8d1', '#4dc3ff', '#4d86ff', '#8a6bff', '#c66bff', '#ff6bd5', '#ff6b9a', '#9aa5b8', '#d6d6d6', '#7fd8ff', '#ffe08a']
const GM = ['Kick', 'Rim', 'Snare', 'Clap', 'Snare 2', 'Tom low', 'Hat closed', 'Tom low 2', 'Hat pedal', 'Tom mid', 'Hat open', 'Tom mid 2', 'Tom hi-mid', 'Crash', 'Tom high', 'Ride']

/** Keyboard hints (only while the pad grid has focus and Expression mode is off): rows as on the keyboard, top row of the grid = 1 2 3 4. */
export const PAD_KEYS = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'],   // pads 12..15 (top row)
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],           // pads 8..11
  ['KeyA', 'KeyS', 'KeyD', 'KeyF'],           // pads 4..7
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV']            // pads 0..3 (bottom row)
]
export const PAD_KEY_LABELS = [['1', '2', '3', '4'], ['Q', 'W', 'E', 'R'], ['A', 'S', 'D', 'F'], ['Z', 'X', 'C', 'V']]
/** code -> pad index. */
export const KEY_TO_PAD = (() => { const m = {}; PAD_KEYS.forEach((row, r) => row.forEach((code, c) => { m[code] = (3 - r) * COLS + c })); return m })()
/** Display order of pad indexes: top row first. */
export const DISPLAY_ORDER = (() => { const o = []; for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) o.push((3 - r) * COLS + c); return o })()
export const keyLabelOf = (idx) => { const r = 3 - Math.floor(idx / COLS), c = idx % COLS; return PAD_KEY_LABELS[r][c] }
export const padNote = (idx) => BASE_NOTE + idx

const clampInt = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d }
const clamp01 = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d }
const cleanText = (s, max, d) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : d)
const HEX = /^#[0-9a-fA-F]{6}$/
const ID_RE = /^[A-Za-z0-9_:.\-]{1,64}$/

export function sanitizeBinding (b, idx = 0) {
  if (!b || typeof b !== 'object') return null
  const kind = typeof b.kind === 'string' ? b.kind : ''
  if (kind === 'note') return { kind: 'note', midi: clampInt(b.midi, 0, 127, padNote(idx)) }
  if (kind === 'sound') return typeof b.nodeId === 'string' && ID_RE.test(b.nodeId) ? { kind: 'sound', nodeId: b.nodeId } : null
  if (kind === 'sample') {
    const o = { kind: 'sample', sampleSlot: clampInt(b.sampleSlot, 1, 15, 1) }
    if (typeof b.nodeId === 'string' && ID_RE.test(b.nodeId)) o.nodeId = b.nodeId
    return o
  }
  return null
}
export function defaultPad (idx, kit = 'gm') {
  return { label: kit === 'gm' ? GM[idx] : `Pad ${idx + 1}`, colour: COLOURS[idx % COLOURS.length], binding: { kind: 'note', midi: padNote(idx) }, mode: 'oneshot', choke: 0, volume: 0.9 }
}
export function sanitizePad (p, idx) {
  const d = defaultPad(idx)
  if (!p || typeof p !== 'object') return d
  const has = (k) => Object.prototype.hasOwnProperty.call(p, k)
  return {
    label: has('label') ? cleanText(p.label, 14, d.label) : d.label,
    colour: has('colour') && typeof p.colour === 'string' && HEX.test(p.colour) ? p.colour : d.colour,
    binding: has('binding') ? sanitizeBinding(p.binding, idx) : d.binding,
    mode: has('mode') && MODES.includes(p.mode) ? p.mode : 'oneshot',
    choke: has('choke') ? clampInt(p.choke, 0, CHOKE_MAX, 0) : 0,
    volume: has('volume') ? clamp01(p.volume, d.volume) : d.volume
  }
}
export function defaultState () { return { v: 1, kit: 'gm', pads: Array.from({ length: PAD_COUNT }, (_, i) => defaultPad(i)) } }
/** Always exactly 16 pads, whatever comes in. */
export function sanitizeState (raw) {
  const s = defaultState()
  if (!raw || typeof raw !== 'object') return s
  if (typeof raw.kit === 'string' && /^[a-z0-9_-]{1,24}$/i.test(raw.kit)) s.kit = raw.kit
  if (Array.isArray(raw.pads)) s.pads = Array.from({ length: PAD_COUNT }, (_, i) => (raw.pads[i] !== undefined ? sanitizePad(raw.pads[i], i) : defaultPad(i)))
  return s
}
export function loadState (storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { return sanitizeState(JSON.parse(storage.getItem(BEATPAD_KEY) || 'null')) } catch (_) { return defaultState() }
}
export function saveState (state, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage.setItem(BEATPAD_KEY, JSON.stringify(sanitizeState(state))); return true } catch (_) { return false }
}

/**
 * Kit presets. Every preset works with NOTHING available (no sound nodes, no samples): then the pads simply play their notes.
 *   gm      GM drum names on the notes 36..51 (the default)
 *   chroma  16 chromatic notes C3..D#4 on the pads, hold mode (a tiny keyboard)
 *   empty   16 blank pads, no binding (only the pad note reaches the bus)
 *   nodes   binds the pads to the scene's sound nodes in order (as many as exist); the rest stay on their notes
 */
export const PRESETS = [
  { id: 'gm', label: 'GM drums', desc: 'GM drum names on the notes 36 to 51, one-shot.' },
  { id: 'chroma', label: 'Chromatic notes', desc: 'Sixteen chromatic notes from C3, hold mode: a small keyboard.' },
  { id: 'empty', label: 'Empty kit', desc: 'Sixteen blank pads with no binding.' },
  { id: 'nodes', label: 'Sound nodes', desc: 'Binds the pads to the sound nodes of the scene in order; with no sound nodes the pads keep their notes.' }
]
export function applyPreset (id, ctx = {}) {
  const pads = Array.from({ length: PAD_COUNT }, (_, i) => defaultPad(i))
  const kit = PRESETS.some(p => p.id === id) ? id : 'gm'
  if (kit === 'chroma') {
    const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    pads.forEach((p, i) => { const m = 48 + i; p.label = NAMES[m % 12] + (Math.floor(m / 12) - 1); p.binding = { kind: 'note', midi: m }; p.mode = 'hold'; p.colour = NAMES[m % 12].includes('#') ? '#4d86ff' : '#7fd8ff' })
  } else if (kit === 'empty') {
    pads.forEach((p, i) => { p.label = ''; p.binding = null; p.colour = '#9aa5b8' })
  } else if (kit === 'nodes') {
    const nodes = Array.isArray(ctx.soundNodes) ? ctx.soundNodes : []
    nodes.slice(0, PAD_COUNT).forEach((n, i) => {
      const id2 = typeof n === 'string' ? n : n?.id
      if (typeof id2 !== 'string' || !ID_RE.test(id2)) return
      pads[i].binding = { kind: 'sound', nodeId: id2 }; pads[i].label = cleanText(typeof n === 'string' ? n : (n.label || id2), 14, `Pad ${i + 1}`) || `Pad ${i + 1}`
    })
  }
  return { v: 1, kit, pads: pads.map((p, i) => sanitizePad(p, i)) }
}
