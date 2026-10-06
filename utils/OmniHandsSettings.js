/**
 * utils/OmniHandsSettings.js — the real, persisted per-hand settings behind
 * ⟐OmniHands (ui/OmniHandsPanel.js).
 *
 * Same shape as utils/MiniMapSettings.js: a module-scoped store loaded once from
 * localStorage ('omni:hands-settings-v1', stamped with `_v`), `{ ...DEFAULTS,
 * ...saved }` merge on load (per hand, then sanitised), try/catch around every
 * storage call, and a window event on every write:
 *
 *   omni:hands-settings-changed  { hand, key, value }
 *
 * Consumers (all read the store AT USE TIME, so a change applies live):
 *   systems/OmniAxinator.js  travelDuration, relDuration, stagger, clockHour
 *                            (tunnels whose def.padHand is 'conscious'|'omnihand')
 *   ui/MovementPad.js        holdRepeatMs (axis hold-to-repeat interval)
 *   main.js                  padOnStart (pad opened once at startup)
 *
 * DEFAULTS equal the pre-V163 module constants exactly (TRAVEL_DURATION 0.55,
 * REL_DURATION 0.45, HOLD_REPEAT_MS 450, CLOCK hours from
 * data/OmniDimensionalAxesData.js, OmniHand stagger ON), so nothing changes until
 * the user edits a value.
 *
 * V165 additions (all four hands unless noted; defaults reproduce V164 at 1x):
 *   speed        1..25   the ⟫ Speed satellite's multiplier (ui/HandSpeedPanel.js slider).
 *                        Consumers read the EASED value from utils/OmniHandSpeed.js,
 *                        never this raw target (lh translate, rh nav/altitude, axis
 *                        tween durations + hold-repeat for conscious/omnihand).
 *   lh / rh only (the "ammo" magazine, systems/OmniHandAmmo.js):
 *   magazine     array of behaviour names loaded in the hand (PROPOSED default split,
 *                user-editable in ⟐OmniHands; not a decided taxonomy)
 *   ammo         the currently loaded behaviour (must be in the magazine; else the first)
 *   maxActive    simultaneously hand-fired behaviours per hand (oldest released first)
 *   anchorMode   'nearest' | 'none'  how a two-node behaviour (Orbit, Follow...) gets its pair
 *   anchorCount  how many nearest nodes a multi-target behaviour receives
 *
 * V168 additions (Fire = the centre button of the lh / rh pad, systems/OmniFlowFire.js):
 *   lh:  elementKind  flowchart element the LeftHand fires (Terminator|Process|Decision|InputOutput|Connector|Loop)
 *        chainEnabled consecutive LH-fired elements link into a chain
 *   lh, rh:  fireDistance  units ahead of the camera for the HUD-centre fire point (2..60) when no node is targeted
 *            maxAlive      fired elements / display anchors kept per hand (oldest removed first)
 *   rh:  defaultWordDelayMs  word delay a NEW payload starts with in the payload panel
 *
 * LogicalHand / CreativeHand axis-step values (px/py/pz, altitude, orbit) still live in
 * 'omni:admin:settings' (ui/CameraMovementOptionsPanel.js); speed COMPOSES with them:
 *   effective = admin step (or Global override) x hand speed (eased).
 * The old dash multiplier ('omni:admin:settings'.dashMultiplier) is no longer applied
 * and is deliberately NOT migrated into speed (see BuildLog V165).
 *
 * Adding fields needs no `_v` bump: load() merges every hand over DEFAULTS.
 */

import { CLOCK } from '../data/OmniDimensionalAxesData.js'

export const STORE_KEY = 'omni:hands-settings-v1'
export const STORE_VERSION = 1
export const CHANGE_EVENT = 'omni:hands-settings-changed'

export const HAND_IDS = ['lh', 'rh', 'conscious', 'omnihand']

/**
 * V165 PROPOSED communication-style split of the 34 behaviours (systems/OmniNodeBehavior.js)
 * into two default magazines. Disjoint and exhaustive (6+7+5+6+10 = 34). A proposal, not a
 * decided taxonomy: both magazines are editable per hand in ⟐OmniHands.
 *   LogicalHand  (the "logic" side)   Mechanic - {Drift, Oscillate}  +  Relational - {Mirror}  +  Transformational
 *   CreativeHand (the "expressive")   Temporal + Emergent + Drift, Oscillate, Mirror
 */
export const DEFAULT_MAGAZINE = {
  lh: ['Orbit', 'Anchor', 'Align', 'Traverse',
       'Attract', 'Repel', 'Follow', 'Follower', 'Leader', 'Bind',
       'Transform', 'Amplify', 'Dampen', 'Filter', 'Encode', 'Decode', 'Store', 'Release', 'Gate', 'Mediate'],
  rh: ['Drift', 'Oscillate', 'Mirror',
       'Delay', 'Pulse', 'Schedule', 'Cascade', 'Sync',
       'Coalesce', 'Diffuse', 'Compete', 'Cooperate', 'Adapt', 'Emerge'],
}

/** Pre-V163 values of the constants the systems used to hard-code (+ V165 speed / ammo). */
export const DEFAULTS = {
  lh:        { padOnStart: false, speed: 1, magazine: DEFAULT_MAGAZINE.lh, ammo: 'Orbit', maxActive: 8, anchorMode: 'nearest', anchorCount: 3,
               elementKind: 'Process', chainEnabled: true, fireDistance: 10, maxAlive: 40 },
  rh:        { padOnStart: false, speed: 1, magazine: DEFAULT_MAGAZINE.rh, ammo: 'Pulse', maxActive: 8, anchorMode: 'nearest', anchorCount: 3,
               fireDistance: 10, maxAlive: 40, defaultWordDelayMs: 450 },
  conscious: { padOnStart: false, speed: 1, travelDuration: 0.55, relDuration: 0.45, holdRepeatMs: 450, clockHour: CLOCK.conscious.pos },
  omnihand:  { padOnStart: false, speed: 1, travelDuration: 0.55, relDuration: 0.45, holdRepeatMs: 450, clockHour: CLOCK.omnihand.pos, stagger: true },
}

/** Numeric limits (min, max) used to clamp every write and every load. */
export const LIMITS = {
  travelDuration: { min: 0.1, max: 3 },
  relDuration:    { min: 0.1, max: 3 },
  holdRepeatMs:   { min: 100, max: 2000 },
  clockHour:      { min: 0, max: 12 },
  speed:          { min: 1, max: 25 },      // V166: hard limit 25x (V165: 10x)
  maxActive:      { min: 1, max: 32 },
  anchorCount:    { min: 1, max: 8 },
  fireDistance:   { min: 2, max: 60 },      // V168: HUD-centre fire point (units ahead of the camera)
  maxAlive:       { min: 1, max: 200 },     // V168: fired flow elements / display anchors kept per hand
  defaultWordDelayMs: { min: 50, max: 3000 },
}

/** Allowed values of the string fields that are enums. */
export const ENUMS = {
  anchorMode: ['nearest', 'none'],
  elementKind: ['Terminator', 'Process', 'Decision', 'InputOutput', 'Connector', 'Loop'],   // V168 (mirrors systems/OmniFlowFire.js FLOW_KINDS)
}

function sanitizeMagazine (value, def) {
  if (!Array.isArray(value)) return [...def]
  const out = []
  value.forEach(v => { if (typeof v === 'string' && v && !out.includes(v) && out.length < 64) out.push(v) })
  return out
}

function sanitize (hand, key, value) {
  const def = DEFAULTS[hand]?.[key]
  if (def === undefined) return undefined          // unknown key for this hand
  if (typeof def === 'boolean') return !!value
  if (Array.isArray(def)) return sanitizeMagazine(value, def)
  if (typeof def === 'string') {
    if (typeof value !== 'string') return def
    return ENUMS[key] && !ENUMS[key].includes(value) ? def : value.slice(0, 48)
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return def
  const lim = LIMITS[key]
  const c = lim ? Math.min(lim.max, Math.max(lim.min, n)) : n
  return key === 'speed' ? Math.round(c * 100) / 100 : c
}

function sanitizeHand (hand, obj) {
  const out = {}
  Object.keys(DEFAULTS[hand]).forEach(k => { const d = DEFAULTS[hand][k]; out[k] = Array.isArray(d) ? [...d] : d })
  if (obj && typeof obj === 'object') {
    Object.keys(DEFAULTS[hand]).forEach(k => {
      if (k in obj) out[k] = sanitize(hand, k, obj[k])
    })
  }
  return out
}

function load () {
  const store = { _v: STORE_VERSION }
  let saved = null
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') saved = parsed
  } catch (_) { saved = null }
  HAND_IDS.forEach(h => { store[h] = sanitizeHand(h, saved?.[h]) })
  return store
}

let settings = load()

function persist () {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)) } catch (_) { /* storage unavailable: setting still applies for this session */ }
}

function emit (hand, key, value) {
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { hand, key, value } })) } catch (_) {}
}

/** Copy of one hand's settings (defaults merged in). */
export function getHandSettings (hand) {
  const out = { ...(settings[hand] ?? {}) }
  Object.keys(out).forEach(k => { if (Array.isArray(out[k])) out[k] = [...out[k]] })
  return out
}

/** One value; falls back to the default if the hand/key is unknown or unset. */
export function getHandSetting (hand, key) {
  const v = settings[hand]?.[key] ?? DEFAULTS[hand]?.[key]
  return Array.isArray(v) ? [...v] : v
}

export function getDefault (hand, key) {
  const v = DEFAULTS[hand]?.[key]
  return Array.isArray(v) ? [...v] : v
}

/** Write one value (sanitised), persist, announce. Returns the stored value. */
export function setHandSetting (hand, key, value) {
  if (!settings[hand]) return undefined
  const v = sanitize(hand, key, value)
  if (v === undefined) return undefined
  const cur = settings[hand][key]
  if (Array.isArray(v) ? JSON.stringify(cur) === JSON.stringify(v) : cur === v) return v
  settings[hand] = { ...settings[hand], [key]: v }
  persist()
  emit(hand, key, v)
  return v
}

/** Restore every setting of one hand to its default (announces each changed key). */
export function resetHand (hand) {
  if (!settings[hand]) return
  Object.keys(DEFAULTS[hand]).forEach(k => setHandSetting(hand, k, DEFAULTS[hand][k]))
}

/** Test/support hook: re-read storage (e.g. after localStorage was edited). */
export function reloadFromStorage () {
  settings = load()
}
