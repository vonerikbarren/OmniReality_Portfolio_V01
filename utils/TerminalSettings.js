/**
 * utils/TerminalSettings.js — the real, global styling behind the
 * terminal (OmniCommandTerminal — TerminalTunnel's own 3D visual,
 * and OmniChat's Terminal tab)
 *
 * Same real, proven pattern as utils/ToolTipSettings.js — applies
 * live via real CSS custom properties on :root, so both surfaces
 * pick up a change immediately without needing their own CSS
 * rewritten.
 */

const STORE_KEY = 'omni:terminal:settings'
const DEFAULTS = { accent: '#00ff88', backgroundOpacity: 0.78, panelPosition: 'center' }

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
  window.dispatchEvent(new CustomEvent('omni:terminal-settings-changed'))
}

/** Real, live application — writes the actual CSS custom properties
 *  the terminal's own real surfaces read, onto :root. */
export function applyToRoot () {
  const root = document.documentElement
  root.style.setProperty('--terminal-accent', settings.accent)
  root.style.setProperty('--terminal-bg-opacity', String(settings.backgroundOpacity))
}
