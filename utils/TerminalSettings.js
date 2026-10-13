/**
 * utils/TerminalSettings.js — the real, global styling and behaviour behind the terminal
 * (the in-scene TerminalShellTunnel panels, ui/OmniCommandTerminalPanel.js and OmniChat's Terminal tab)
 *
 * Same real, proven pattern as utils/ToolTipSettings.js — applies live via real CSS custom properties on :root, so both surfaces
 * pick up a change immediately without needing their own CSS rewritten.
 *
 * V192 adds (all validated, persisted in one localStorage record, announced by `omni:terminal-settings-changed`):
 *   inputSurface   where the user types: 'scene' | 'dom' | 'both' (both are kept in sync). Default 'scene' (what F1 always showed).
 *   followTheme    true (default): the terminal takes its colours from the active OmniOS theme (utils/TerminalTheme.js) and follows it LIVE
 *                  (the `omni:theme-changed` event + a MutationObserver on :root, see startThemeLive). false: custom colours below.
 *   custom         { bg, text, prompt, selection, border } '#rrggbb' used only when followTheme is OFF (accent is the top-level key).
 *   orientation    the default orientation of an in-scene terminal (utils/TerminalOrientation.js); each TerminalShellTunnel node may override it.
 * The CSS variables written on :root: --terminal-accent, --terminal-bg-opacity (as before) and --terminal-bg / -text / -dim / -muted / -prompt /
 * -selection / -border / -rule / -header-bg / -input-bg / -error / -font (the palette).
 */

import { sanitizeOrientation, DEFAULT_ORIENTATION } from './TerminalOrientation.js'
import { terminalPalette, readThemeTokens, paletteSig, paletteCssVars } from './TerminalTheme.js'

const STORE_KEY = 'omni:terminal:settings'
export const INPUT_SURFACES = ['scene', 'dom', 'both']
export const PANEL_POSITIONS = ['center', 'circumference']
export const CUSTOM_KEYS = ['bg', 'text', 'prompt', 'selection', 'border']
const HEX = /^#[0-9a-f]{6}$/i
const DEFAULT_CUSTOM = Object.freeze({ bg: '#000000', text: '#00ff88', prompt: '#00ff88', selection: '#00ff88', border: '#00ff88' })
const DEFAULTS = Object.freeze({
  accent: '#00ff88', backgroundOpacity: 0.78, panelPosition: 'center',
  inputSurface: 'scene', followTheme: true, custom: DEFAULT_CUSTOM, orientation: DEFAULT_ORIENTATION,
})

const clone = (s) => ({ ...s, custom: { ...s.custom }, orientation: { ...s.orientation } })

/**
 * Validate a (partial) settings object on top of `base`. Returns { settings, rejected } — settings is ALWAYS complete and valid
 * (a bad field keeps its previous value and is named in `rejected`). Unknown keys are dropped.
 */
export function sanitizeSettings (patch, base = DEFAULTS) {
  const b = base && typeof base === 'object' ? base : DEFAULTS
  const p = patch && typeof patch === 'object' ? patch : {}
  const rejected = []
  const out = clone({
    accent: HEX.test(b.accent) ? b.accent : DEFAULTS.accent,
    backgroundOpacity: Number.isFinite(b.backgroundOpacity) ? Math.min(1, Math.max(0, b.backgroundOpacity)) : DEFAULTS.backgroundOpacity,
    panelPosition: PANEL_POSITIONS.includes(b.panelPosition) ? b.panelPosition : DEFAULTS.panelPosition,
    inputSurface: INPUT_SURFACES.includes(b.inputSurface) ? b.inputSurface : DEFAULTS.inputSurface,
    followTheme: b.followTheme !== false,
    custom: Object.fromEntries(CUSTOM_KEYS.map(k => [k, HEX.test(b.custom?.[k]) ? b.custom[k] : DEFAULT_CUSTOM[k]])),
    orientation: sanitizeOrientation(b.orientation, DEFAULT_ORIENTATION).orientation,
  })
  if ('accent' in p) { if (typeof p.accent === 'string' && HEX.test(p.accent)) out.accent = p.accent.toLowerCase(); else rejected.push('accent') }
  if ('backgroundOpacity' in p) {
    const v = typeof p.backgroundOpacity === 'string' && p.backgroundOpacity.trim() !== '' ? Number(p.backgroundOpacity) : p.backgroundOpacity
    if (typeof v === 'number' && Number.isFinite(v)) out.backgroundOpacity = Math.min(1, Math.max(0, v)); else rejected.push('backgroundOpacity')
  }
  if ('panelPosition' in p) { if (PANEL_POSITIONS.includes(p.panelPosition)) out.panelPosition = p.panelPosition; else rejected.push('panelPosition') }
  if ('inputSurface' in p) { if (INPUT_SURFACES.includes(p.inputSurface)) out.inputSurface = p.inputSurface; else rejected.push('inputSurface') }
  if ('followTheme' in p) { if (typeof p.followTheme === 'boolean') out.followTheme = p.followTheme; else rejected.push('followTheme') }
  if (p.custom && typeof p.custom === 'object') {
    for (const k of Object.keys(p.custom)) {
      if (!CUSTOM_KEYS.includes(k)) { rejected.push('custom.' + k); continue }
      if (typeof p.custom[k] === 'string' && HEX.test(p.custom[k])) out.custom[k] = p.custom[k].toLowerCase(); else rejected.push('custom.' + k)
    }
  } else if ('custom' in p) rejected.push('custom')
  if ('orientation' in p) {
    const r = sanitizeOrientation(p.orientation, out.orientation)
    out.orientation = r.orientation
    r.rejected.forEach(k => rejected.push('orientation.' + k))
  }
  return { settings: out, rejected }
}

let settings = loadSettings()

function loadSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? sanitizeSettings(JSON.parse(raw), DEFAULTS).settings : clone(DEFAULTS)
  } catch (_) {
    return clone(DEFAULTS)
  }
}

export function getSettings () {
  return clone(settings)
}

/** The defaults (a copy), for the "Reset" button and the tests. */
export function getDefaultSettings () {
  return clone(DEFAULTS)
}

/** Re-read the saved record (tests, and after another tab changed it). */
export function _reloadSettings () {
  settings = loadSettings()
  return getSettings()
}

/** Validate + merge + persist + apply + announce. Returns { settings, rejected }; a rejected field is left unchanged. */
export function setSettings (patch) {
  const r = sanitizeSettings(patch, settings)
  settings = r.settings
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)) } catch (_) { /* real save simply skipped if storage unavailable */ }
  applyToRoot()
  window.dispatchEvent(new CustomEvent('omni:terminal-settings-changed', { detail: { keys: Object.keys(patch ?? {}), rejected: r.rejected } }))
  return { settings: getSettings(), rejected: r.rejected }
}

/** The palette both surfaces draw with: the active OmniOS theme (or the custom colours) + the opacity setting. */
export function getPalette () {
  return terminalPalette(readThemeTokens(), settings)
}

/** Real, live application — writes the actual CSS custom properties
 *  the terminal's own real surfaces read, onto :root. */
let lastSig = ''
export function applyToRoot () {
  const root = document.documentElement
  const pal = getPalette()
  lastSig = paletteSig(pal)
  root.style.setProperty('--terminal-accent', pal.accent)
  root.style.setProperty('--terminal-bg-opacity', String(settings.backgroundOpacity))
  for (const [k, v] of Object.entries(paletteCssVars(pal))) if (k !== '--terminal-accent') root.style.setProperty(k, v)
  return pal
}

// ── Following the OmniOS theme live ───────────────────────────────────────────

let live = null
/**
 * Start following theme changes (idempotent, reference counted: every caller pairs it with stopThemeLive). Listens for `omni:theme-changed`
 * (ui/ThemeManager.js) and also watches the style attribute of :root, so a theme set by any other route is caught too. A change of palette
 * rewrites the --terminal-* variables and announces `omni:terminal-settings-changed` (which the in-scene panels redraw on).
 */
export function startThemeLive () {
  if (live) { live.refs++; return }
  const check = () => {
    if (paletteSig(getPalette()) === lastSig) return
    applyToRoot()
    window.dispatchEvent(new CustomEvent('omni:terminal-settings-changed', { detail: { keys: ['theme'], rejected: [] } }))
  }
  const onTheme = () => check()
  window.addEventListener('omni:theme-changed', onTheme)
  let mo = null
  try {
    if (typeof MutationObserver === 'function') {
      mo = new MutationObserver(check)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    }
  } catch (_) { mo = null }
  live = { refs: 1, onTheme, mo }
}

export function stopThemeLive () {
  if (!live) return
  if (--live.refs > 0) return
  window.removeEventListener('omni:theme-changed', live.onTheme)
  try { live.mo?.disconnect() } catch (_) { /* ignore */ }
  live = null
}
