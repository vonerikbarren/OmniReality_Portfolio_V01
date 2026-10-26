/**
 * utils/OmniExpressionTypingSettings.js — the OmniExpression typing / MIDI options (V195): names, defaults, validation, storage.
 * User-facing: no DOM beyond localStorage / window events, and no import of any Dev* module. Mirrors utils/OmniSoundSettings.js.
 *
 *   key              values                          default   meaning
 *   octaveKeys       true | false                    true      the B / N keys shift the octave while Expression typing is on
 *   octaveScope      both | left | right | last       both      which hand B / N move ("last" = the hand that played the latest note)
 *   baseOctaveL      -1..8 (integer)                 3         octave of the left-hand block (C3 = midi 48)
 *   baseOctaveR      -1..8 (integer)                 4         octave of the right-hand block (C4 = midi 60)
 *   modStep          0.01..0.5                       0.1       how much one Left Shift + Up / Down press moves the modulation (0..1, stays)
 *   bendRange        1..24 (semitones, integer)      2         pitch bend at full travel (wheel, Right Shift + Up / Down, MIDI bend)
 *   springMs         0..2000 (integer)               150       how long the bend wheel takes to spring back to 0 after release
 *   followSelection  true | false                    true      the selected sound node becomes the instrument
 *   instrumentNodeId null | node id (text)           null      the instrument when nothing is selected (null = a soft sine)
 *   showHints        true | false                    true      key hints on the keyboards / panel
 *   midiEnabled      true | false                    false     use Web MIDI (the browser permission is asked only when this is turned on)
 *   midiChannel      all | 1..16                     all       listen to one MIDI channel only
 *   midiHands        { "1".."16": L | R | X }        1=L 2=R   which hand a MIDI channel plays as (the keyboards highlight it); others X
 *   midiDevices      { deviceId: true | false }      {}        per device switch (an unknown device is ON)
 *   keyOverrides     { KeyCode: semitones }          {}        edited key map: semitones above the hand's C (see utils/OmniExpressionKeys.js)
 *
 * Storage 'omni:expression-typing-v1' = { v:1, ...only the keys the person changed }. Load is defensive: bad JSON / wrong types / unknown keys /
 * prototype keys / blocked storage all end at the defaults; booleans accept "true"/"false"/1/0; numbers are rounded / clamped; true / "" / null / arrays
 * are rejected for numbers (never coerced).
 *
 * Events: in   `omni:expression-typing-set`     { patch:{...} } | { merge:{ keyOverrides:{KeyA:2|null}, midiHands:{3:'L'}, midiDevices:{id:false|null} } }
 *                                               | { reset:true } | { resetKeys:true }
 *         out  `omni:expression-typing-changed` { settings }    after every accepted change
 * systems/OmniExpressionTyping.js owns the `set` listener; everybody else reads getTypingSettings() (cached, always complete and valid).
 */
import { DEFAULT_KEYS, SEMI_MIN, SEMI_MAX } from './OmniExpressionKeys.js'

export const STORE_KEY = 'omni:expression-typing-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:expression-typing-set'
export const CHANGED_EVENT = 'omni:expression-typing-changed'

export const LIMITS = Object.freeze({
  baseOctave: Object.freeze({ min: -1, max: 8, step: 1 }),
  modStep: Object.freeze({ min: 0.01, max: 0.5, step: 0.01 }),
  bendRange: Object.freeze({ min: 1, max: 24, step: 1 }),
  springMs: Object.freeze({ min: 0, max: 2000, step: 10 }),
  semi: Object.freeze({ min: SEMI_MIN, max: SEMI_MAX, step: 1 }),
  maxDevices: 32, maxIdLength: 120
})
export const SCOPES = Object.freeze(['both', 'left', 'right', 'last'])
export const HANDS = Object.freeze(['L', 'R', 'X'])
export const DEFAULT_MIDI_HANDS = Object.freeze(Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, i === 0 ? 'L' : i === 1 ? 'R' : 'X'])))
const KEY_CODES = new Set(DEFAULT_KEYS.map(k => k.code))

export const DEFAULTS = Object.freeze({
  octaveKeys: true, octaveScope: 'both', baseOctaveL: 3, baseOctaveR: 4, modStep: 0.1, bendRange: 2, springMs: 150,
  followSelection: true, instrumentNodeId: null, showHints: true,
  midiEnabled: false, midiChannel: 'all', midiHands: DEFAULT_MIDI_HANDS, midiDevices: Object.freeze({}), keyOverrides: Object.freeze({})
})
export const KEYS = Object.keys(DEFAULTS)
const BOOL_KEYS = ['octaveKeys', 'followSelection', 'showHints', 'midiEnabled']
const toBool = (v) => (typeof v === 'boolean' ? v : (v === 1 || v === 0) ? v === 1 : (v === 'true' || v === 'false') ? v === 'true' : undefined)
const toNum = (v) => (typeof v === 'boolean' || v === null || v === '' || (typeof v !== 'number' && typeof v !== 'string')) ? undefined : (Number.isFinite(Number(v)) ? Number(v) : undefined)
const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o)
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : undefined)
const clampN = (n, lim) => Math.min(lim.max, Math.max(lim.min, n))

/** semitone offset 0 stays valid (a key can be moved to the hand's C). */
function cleanKeyOverrides (v) {
  if (!plain(v)) return undefined
  const out = {}
  for (const k of Object.keys(v)) {
    if (!own(v, k) || !KEY_CODES.has(k)) continue
    const n = toNum(v[k]); if (n === undefined) continue
    out[k] = Math.round(clampN(n, LIMITS.semi))
  }
  return out
}
function cleanMidiHands (v) {
  if (!plain(v)) return undefined
  const out = {}
  for (let ch = 1; ch <= 16; ch++) {
    const raw = own(v, String(ch)) ? v[String(ch)] : undefined
    const h = typeof raw === 'string' ? raw.toUpperCase() : undefined
    out[ch] = HANDS.includes(h) ? h : DEFAULT_MIDI_HANDS[ch]
  }
  return out
}
function cleanMidiDevices (v) {
  if (!plain(v)) return undefined
  const out = {}
  let n = 0
  for (const k of Object.keys(v)) {
    if (!own(v, k) || n >= LIMITS.maxDevices) continue
    const id = cleanText(k, LIMITS.maxIdLength); const b = toBool(v[k])
    if (!id || b === undefined || id === '__proto__' || id === 'constructor' || id === 'prototype') continue
    out[id] = b; n++
  }
  return out
}

/** Validate ONE key; returns the clean value or undefined (= reject). */
export function cleanValue (key, v) {
  if (BOOL_KEYS.includes(key)) return toBool(v)
  switch (key) {
    case 'octaveScope': return SCOPES.includes(v) ? v : undefined
    case 'baseOctaveL': case 'baseOctaveR': { const n = toNum(v); return n === undefined ? undefined : Math.round(clampN(n, LIMITS.baseOctave)) }
    case 'modStep': { const n = toNum(v); return n === undefined ? undefined : Math.round(clampN(n, LIMITS.modStep) * 100) / 100 }
    case 'bendRange': { const n = toNum(v); return n === undefined ? undefined : Math.round(clampN(n, LIMITS.bendRange)) }
    case 'springMs': { const n = toNum(v); return n === undefined ? undefined : Math.round(clampN(n, LIMITS.springMs)) }
    case 'instrumentNodeId': { if (v === null || v === '') return null; const t = cleanText(v, 64); return t || undefined }
    case 'midiChannel': { if (v === 'all') return 'all'; const n = toNum(v); return n === undefined ? undefined : (n >= 1 && n <= 16 && Math.round(n) === n ? n : undefined) }
    case 'midiHands': return cleanMidiHands(v)
    case 'midiDevices': return cleanMidiDevices(v)
    case 'keyOverrides': return cleanKeyOverrides(v)
    default: return undefined
  }
}

/** A patch -> only its valid known keys. Never throws, never reads inherited keys. */
export function sanitizePatch (patch) {
  const out = {}
  if (!plain(patch)) return out
  for (const k of KEYS) {
    if (!own(patch, k)) continue
    const c = cleanValue(k, patch[k])
    if (c !== undefined) out[k] = c
  }
  return out
}

export function parseOverrides (text) {
  if (typeof text !== 'string' || !text) return {}
  let raw
  try { raw = JSON.parse(text) } catch (_) { return {} }
  return plain(raw) ? sanitizePatch(raw) : {}
}
export function loadOverrides () { try { return parseOverrides(localStorage.getItem(STORE_KEY)) } catch (_) { return {} } }
export function saveOverrides (overrides) {
  try {
    const clean = sanitizePatch(overrides)
    for (const k of KEYS) if (own(clean, k) && JSON.stringify(clean[k]) === JSON.stringify(DEFAULTS[k])) delete clean[k]   // only what differs from the defaults
    if (!Object.keys(clean).length) localStorage.removeItem(STORE_KEY)
    else localStorage.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION, ...clean }))
    return true
  } catch (_) { return false }
}
const thaw = (o) => (o && typeof o === 'object' ? JSON.parse(JSON.stringify(o)) : o)
/** defaults + overrides -> the full settings object (a fresh deep copy). */
export function resolveSettings (overrides = {}) {
  const base = {}; for (const k of KEYS) base[k] = thaw(DEFAULTS[k])
  return { ...base, ...thaw(sanitizePatch(overrides)) }
}

/** Pure: apply one event detail to an overrides object -> { overrides, changed }. */
export function applyChange (overrides, detail) {
  const cur = sanitizePatch(overrides)
  if (detail && detail.reset === true) return { overrides: {}, changed: Object.keys(cur).length > 0 }
  let next = { ...cur }
  if (detail && detail.resetKeys === true) delete next.keyOverrides
  next = { ...next, ...sanitizePatch(detail?.patch) }
  const mg = plain(detail?.merge) ? detail.merge : null
  if (mg) {
    if (plain(mg.keyOverrides)) { const o = { ...(next.keyOverrides || {}) }; for (const k of Object.keys(mg.keyOverrides)) { if (!own(mg.keyOverrides, k)) continue; if (mg.keyOverrides[k] === null) delete o[k]; else o[k] = mg.keyOverrides[k] } next.keyOverrides = cleanKeyOverrides(o) }
    if (plain(mg.midiHands)) { const o = { ...(next.midiHands || cleanMidiHands({})) }; for (const k of Object.keys(mg.midiHands)) { if (own(mg.midiHands, k)) o[k] = mg.midiHands[k] } next.midiHands = cleanMidiHands(o) }
    if (plain(mg.midiDevices)) { const o = { ...(next.midiDevices || {}) }; for (const k of Object.keys(mg.midiDevices)) { if (!own(mg.midiDevices, k)) continue; if (mg.midiDevices[k] === null) delete o[k]; else o[k] = mg.midiDevices[k] } next.midiDevices = cleanMidiDevices(o) }
  }
  next = sanitizePatch(next)
  for (const k of KEYS) if (own(next, k) && JSON.stringify(next[k]) === JSON.stringify(DEFAULTS[k])) delete next[k]
  return { overrides: next, changed: JSON.stringify(next) !== JSON.stringify(cur) }
}

let CACHE = null
/** The current settings: always a complete, valid object (a fresh deep copy). */
export function getTypingSettings () { if (!CACHE) CACHE = resolveSettings(loadOverrides()); return thaw(CACHE) }
export function _reload () { CACHE = null; return getTypingSettings() }

/** Apply one `omni:expression-typing-set` detail: validate, save, update the live copy, announce `-changed`. Returns { changed, settings }. Never throws. */
export function applySettingsEvent (detail) {
  try {
    const { overrides, changed } = applyChange(loadOverrides(), detail)
    if (changed) saveOverrides(overrides)
    CACHE = resolveSettings(changed ? overrides : loadOverrides())
    if (changed) { try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings: thaw(CACHE) } })) } catch (_) { /* no window */ } }
    return { changed, settings: thaw(CACHE) }
  } catch (_) { return { changed: false, settings: getTypingSettings() } }
}

/** which hand a MIDI channel (1..16) plays as. */
export function handForChannel (settings, channel) { const h = settings?.midiHands?.[Number(channel)]; return HANDS.includes(h) ? h : (DEFAULT_MIDI_HANDS[Number(channel)] || 'X') }
export default { STORE_KEY, SET_EVENT, CHANGED_EVENT, DEFAULTS, LIMITS, getTypingSettings, applySettingsEvent, resolveSettings, sanitizePatch, applyChange, handForChannel }
