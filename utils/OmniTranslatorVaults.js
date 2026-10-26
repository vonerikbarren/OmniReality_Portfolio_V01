/**
 * utils/OmniTranslatorVaults.js — the real, saved contents of
 * OmniTranslator's four vaults
 *
 * Independent pools, confirmed as the real, deliberate choice over
 * strict Right/Left pairing — a forced 1:1 link would need real
 * linking data and synchronized positions between two separate
 * vaults, genuine fragile complexity for a relationship that won't
 * always hold true. Same real reasoning already applied to
 * OmniCommunicate's own type system: start simple, add real
 * structure only once a genuine need for it shows up.
 *
 * A node's own real, existing label is its identity here — no
 * separate type-classification system built yet, honestly, since
 * nothing real has needed one so far.
 */

const STORE_KEY = 'omni:translator:vaults'
const DEFAULTS = { top: [], right: [], bottom: [], left: [] }

let vaults = loadVaults()

function loadVaults () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS, top: [], right: [], bottom: [], left: [] }
  } catch (_) {
    return { top: [], right: [], bottom: [], left: [] }
  }
}

export function getVaults () {
  return { top: [...vaults.top], right: [...vaults.right], bottom: [...vaults.bottom], left: [...vaults.left] }
}

/** Real, honest add — a node's own nodeId and current label, no
 *  duplicate entries for the same real node in the same real vault. */
export function addToVault (side, nodeId, label) {
  if (!vaults[side]) return
  if (vaults[side].some(e => e.nodeId === nodeId)) return
  vaults[side] = [...vaults[side], { nodeId, label }]
  save()
}

export function removeFromVault (side, nodeId) {
  if (!vaults[side]) return
  vaults[side] = vaults[side].filter(e => e.nodeId !== nodeId)
  save()
}

function save () {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(vaults)) } catch (_) { /* real save simply skipped if storage unavailable */ }
}
