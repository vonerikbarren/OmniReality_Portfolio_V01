/**
 * ui/ThemeManager.js — shared panel theme system
 *
 * Loosely modeled on iTerm-style color profiles: a JSON file
 * (data/themes.json) defines named token sets (dark, light, and any
 * custom ones dropped in later — "sandboxes of themes"). Applying a
 * theme sets a small set of shared CSS custom properties on
 * :root (--omni-theme-*), which every panel's own stylesheet derives
 * its variables from with a fallback to its original hardcoded value —
 * so panels built before this system still work unthemed, and panels
 * that opt in get themed automatically without per-rule changes.
 *
 * Persisted to localStorage so the chosen theme survives a reload.
 */

const STORE_KEY = 'omni:admin:theme'
let themes = null

async function loadThemes () {
  if (themes) return themes
  try {
    const res = await fetch('./data/themes.json')
    themes = await res.json()
  } catch (err) {
    console.warn('⟐ ThemeManager — failed to load themes.json, falling back to built-in dark only:', err)
    themes = { dark: { label: 'Dark' } }
  }
  return themes
}

function applyTheme (name, theme) {
  const root = document.documentElement.style
  root.setProperty('--omni-theme-bg',          theme.bg ?? '')
  root.setProperty('--omni-theme-border',      theme.border ?? '')
  root.setProperty('--omni-theme-header-bg',   theme.headerBg ?? '')
  root.setProperty('--omni-theme-text',        theme.text ?? '')
  root.setProperty('--omni-theme-text-dim',    theme.textDim ?? '')
  root.setProperty('--omni-theme-text-muted',  theme.textMuted ?? '')
  root.setProperty('--omni-theme-accent',      theme.accent ?? '')
  root.setProperty('--omni-theme-input-bg',    theme.inputBg ?? '')
  root.setProperty('--omni-theme-input-border', theme.inputBorder ?? '')

  try { localStorage.setItem(STORE_KEY, name) } catch (_) {}
}

/** Loads themes.json (if not already loaded) and returns { name: {label, ...} } */
export async function getThemes () {
  return loadThemes()
}

/** Applies a theme by name, loading themes.json first if needed. */
export async function setTheme (name) {
  const all = await loadThemes()
  const theme = all[name]
  if (!theme) {
    console.warn(`⟐ ThemeManager — unknown theme "${name}"`)
    return
  }
  applyTheme(name, theme)
}

/** Reads the persisted theme choice, defaulting to 'dark'. */
export function getSavedThemeName () {
  try { return localStorage.getItem(STORE_KEY) ?? 'dark' } catch (_) { return 'dark' }
}

/** Call once at startup — applies whatever theme was last saved. */
export async function initTheme () {
  await setTheme(getSavedThemeName())
}
