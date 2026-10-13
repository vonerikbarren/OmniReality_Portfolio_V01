/**
 * utils/OmniInputBus.js (V195) — the ONE place every musical input goes through: computer keys (Expression typing), the on-screen
 * keyboards / BeatPad (touch), Web MIDI, the step sequencer's playback echo. Pure module: no DOM needed (window events are fired only when
 * `window` exists). Contract: docs/architecture/OMNIEXPRESSION_CONTRACT.md.
 *
 * Notes are REF-COUNTED per pitch: two keys that give the same pitch (the duplicated G of the LH layout) only emit noteOff when the LAST one
 * is released. The sustain pedal holds noteOffs until released. Everything is hostile-input safe (never throws).
 *
 *   noteOn({ midi, velocity=0.8, hand='X'|'L'|'R', source='keys'|'midi'|'touch'|'pad'|'seq', keyId?, channel? })
 *   noteOff({ midi, hand, source, keyId? })          setSustain(bool)         allOff()
 *   controller(kind, value)   kind: 'bend' (-1..1) | 'bend2' (-1..1) | 'mod' (0..1) | 'expression' (0..1) | 'sustain' (bool-ish)
 *   subscribe(fn) -> unsubscribe   fn receives { type:'noteOn'|'noteOff'|'controller'|'allOff', ... , t }
 *   getState() -> { held:[midi...], sustain, bend, bend2, mod, expression }
 * Window events (detail = the event): omni:input-note-on  omni:input-note-off  omni:input-controller  omni:input-all-off
 */
const subs = new Set()
const held = new Map()          // midi -> Map(keyId -> {hand, source, velocity})
const pedal = new Set()         // midis whose key is up but the pedal holds them
const st = { sustain: false, bend: 0, bend2: 0, mod: 0, expression: 0 }
const clamp = (v, a, b) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a)
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())
const HANDS = ['L', 'R', 'X']

function emit (evt) {
  evt.t = now()
  for (const fn of [...subs]) { try { fn(evt) } catch (_) { /* a bad subscriber never breaks input */ } }
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    const name = evt.type === 'noteOn' ? 'omni:input-note-on' : evt.type === 'noteOff' ? 'omni:input-note-off' : evt.type === 'allOff' ? 'omni:input-all-off' : 'omni:input-controller'
    try { window.dispatchEvent(new CustomEvent(name, { detail: evt })) } catch (_) { /* no window */ }
  }
}
const midiOf = (m) => { const n = Math.round(Number(m)); return Number.isFinite(n) && n >= 0 && n <= 127 ? n : null }

export function noteOn (o = {}) {
  const midi = midiOf(o?.midi); if (midi === null) return false
  const hand = HANDS.includes(o.hand) ? o.hand : 'X', source = typeof o.source === 'string' ? o.source.slice(0, 16) : 'keys'
  const keyId = o.keyId != null ? String(o.keyId).slice(0, 48) : `${source}:${hand}:${midi}`
  const velocity = clamp(o.velocity === undefined ? 0.8 : Number(o.velocity), 0, 1) || 0.8
  let m = held.get(midi); if (!m) { m = new Map(); held.set(midi, m) }
  const had = m.size > 0 || pedal.has(midi)
  m.set(keyId, { hand, source, velocity })
  if (pedal.has(midi)) { pedal.delete(midi); emit({ type: 'noteOff', midi, hand, source, retrigger: true }) }
  if (!had || m.size === 1) emit({ type: 'noteOn', midi, velocity, hand, source, channel: Number.isFinite(o.channel) ? o.channel : undefined })
  return true
}
export function noteOff (o = {}) {
  const midi = midiOf(o?.midi); if (midi === null) return false
  const m = held.get(midi); if (!m) return false
  const hand = HANDS.includes(o.hand) ? o.hand : 'X', source = typeof o.source === 'string' ? o.source.slice(0, 16) : 'keys'
  const keyId = o.keyId != null ? String(o.keyId).slice(0, 48) : `${source}:${hand}:${midi}`
  if (!m.delete(keyId)) return false
  if (m.size === 0) { held.delete(midi); if (st.sustain) pedal.add(midi); else emit({ type: 'noteOff', midi, hand, source }) }
  return true
}
export function setSustain (on) {
  const v = !!on; if (v === st.sustain) return
  st.sustain = v
  emit({ type: 'controller', kind: 'sustain', value: v ? 1 : 0 })
  if (!v) { for (const midi of [...pedal]) { pedal.delete(midi); emit({ type: 'noteOff', midi, hand: 'X', source: 'pedal' }) } }
}
export function controller (kind, value) {
  if (kind === 'sustain') { setSustain(Number(value) >= 0.5 || value === true); return true }
  const range = kind === 'bend' || kind === 'bend2' ? [-1, 1] : (kind === 'mod' || kind === 'expression') ? [0, 1] : null
  if (!range) return false
  const v = clamp(Number(value), range[0], range[1]); st[kind] = v
  emit({ type: 'controller', kind, value: v }); return true
}
export function allOff () {
  held.clear(); pedal.clear(); st.sustain = false
  emit({ type: 'allOff' })
}
export function subscribe (fn) { if (typeof fn !== 'function') return () => {}; subs.add(fn); return () => subs.delete(fn) }
export function getState () { return { held: [...held.keys()].sort((a, b) => a - b), sustainHeld: [...pedal].sort((a, b) => a - b), sustain: st.sustain, bend: st.bend, bend2: st.bend2, mod: st.mod, expression: st.expression } }
export function _reset () { held.clear(); pedal.clear(); subs.clear(); st.sustain = false; st.bend = st.bend2 = st.mod = st.expression = 0 }
export default { noteOn, noteOff, setSustain, controller, allOff, subscribe, getState, _reset }
