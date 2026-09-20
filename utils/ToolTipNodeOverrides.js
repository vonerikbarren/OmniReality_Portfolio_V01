/**
 * utils/ToolTipNodeOverrides.js — a specific node's own tooltip
 * styling, real and persistent, independent of the global default
 *
 * Confirmed directly: stays the same even if ToolTipSettings' own
 * global default changes later — a genuinely separate, per-node
 * value, not just reading the default at the moment it was set.
 * Keyed by the node's own real, stable id (confirmed to survive a
 * reload, unlike Jsonifier's own regenerating tree ids).
 */

const STORE_KEY = 'omni:tooltip:nodeOverrides'

function loadAll () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (_) {
    return {}
  }
}

let overrides = loadAll()

export function getOverride (nodeId) {
  return overrides[nodeId] ?? null
}

export function setOverride (nodeId, patch) {
  overrides[nodeId] = { ...(overrides[nodeId] ?? {}), ...patch }
  save()
}

export function clearOverride (nodeId) {
  delete overrides[nodeId]
  save()
}

export function hasOverride (nodeId) {
  return nodeId in overrides
}

function save () {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(overrides)) } catch (_) { /* real save simply skipped if storage unavailable */ }
}
