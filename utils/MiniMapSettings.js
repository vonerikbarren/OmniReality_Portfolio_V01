/**
 * utils/MiniMapSettings.js — the real, persisted settings behind
 * ui/MiniMap.js, editable from ui/MiniMapSettingsPanel.js (Admin04).
 *
 * Same shape as utils/ToolTipSettings.js: a module-scoped store,
 * loaded once from localStorage, read directly by MiniMap.js at
 * init(), and re-applied live via a window event on every change so
 * an already-open MiniMap picks up a setting without needing a
 * reload — MiniMap.js has real per-frame state (drag position,
 * minimize state) a CSS-variable-only approach like ToolTipSettings
 * can't reach, hence the event instead of pure :root variables.
 */

const STORE_KEY = 'omni:minimap:settings'

// top-right matches the BotW/TotK corner-minimap convention, per
// direct request — the previous default was bottom-center.
const DEFAULTS = {
  corner: 'top-right',   // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  showPortals: true,
  startVisible: true,
}

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
  window.dispatchEvent(new CustomEvent('omni:minimap-settings-set', { detail: patch }))
}
