/**
 * utils/ToolTipSettings.js — the real, global default styling
 * behind every tooltip header
 *
 * Confirmed directly: this is the default applied to ALL tooltips,
 * not a per-node override — that's now real too, in
 * utils/ToolTipNodeOverrides.js. Applies live via real CSS custom
 * properties on :root, matching the exact `var(--x, fallback)`
 * theming pattern every other panel in this project already uses,
 * so ToolTipMenu's own CSS never needed rewriting beyond swapping
 * in variables.
 */

import { hexToRgba } from './ColorUtils.js'

const STORE_KEY = 'omni:tooltip:settings'
const DEFAULTS = { background: '#08080c', border: '#ffffff', color: '#ffffff' }

let settings = loadSettings()

function loadSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch (_) {
    return { ...DEFAULTS }
  }
}

export function getSettings () {
  return { ...settings }
}

export function setSettings (patch) {
  settings = { ...settings, ...patch }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)) } catch (_) { /* real save simply skipped if storage unavailable */ }
  applyToRoot()
}

/** Real, live application — writes the actual CSS custom properties
 *  ToolTipMenu's own header styling now reads, onto :root so every
 *  current and future tooltip header picks it up immediately. */
export function applyToRoot () {
  const root = document.documentElement
  root.style.setProperty('--ttm-bg', hexToRgba(settings.background, 0.82))
  root.style.setProperty('--ttm-border', hexToRgba(settings.border, 0.15))
  root.style.setProperty('--ttm-color', settings.color)
}
