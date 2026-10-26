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

// Bumped whenever a DEFAULTS value changes in a way that must win over
// a user's previously-saved blob (see loadSettings() below). Each bump
// gets a one-time migration entry in MIGRATIONS.
const STORE_VERSION = 2

// top-right matches the BotW/TotK corner-minimap convention, per
// direct request — the previous default was bottom-center.
const DEFAULTS = {
  corner: 'top-right',   // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top' | 'bottom' | 'left' | 'right'
  showPortals: true,
  // Turned off by default (2026-10-04) for easier testing — flip back to
  // `true` here, or toggle "Visible on Start" in the MiniMap settings
  // panel (⟐ Admin → MiniMap), or press 'm' at runtime to show it live.
  startVisible: false,
}

// Real bug fix (2026-10-04): loadSettings() used to do
// `{ ...DEFAULTS, ...JSON.parse(raw) }`, which means ANY key the user
// already had saved in localStorage — from before `startVisible`'s
// default flipped to `false` — silently overrode the new default
// forever. A user with an old saved blob (e.g. `{ startVisible: true }`
// from when the live default was effectively visible) would never see
// the new `false` default take effect, no matter how the code default
// changed, because the spread puts the saved blob last.
//
// Fix: stamp every saved blob with `_v`. On load, if the stored `_v` is
// missing or older than STORE_VERSION, run the matching one-time
// migrations below (each forces just the specific key(s) that default
// changed back to the new code default, preserving every other saved
// pref untouched), then persist the bumped `_v` so this only happens
// once — after that, the user's own toggling of "Visible on Start" is
// respected normally, including setting it back to `true`.
const MIGRATIONS = [
  // v1 -> v2: startVisible's default changed from (effectively) true to
  // false. Force it to the new default once; corner/showPortals are
  // left exactly as the user had them.
  { to: 2, apply: (saved) => ({ ...saved, startVisible: DEFAULTS.startVisible }) },
]

let settings = loadSettings()

function loadSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return { ...DEFAULTS, _v: STORE_VERSION }

    const parsed = JSON.parse(raw)
    const savedVersion = typeof parsed._v === 'number' ? parsed._v : 0

    let merged = { ...DEFAULTS, ...parsed }

    if (savedVersion < STORE_VERSION) {
      for (const migration of MIGRATIONS) {
        if (savedVersion < migration.to) {
          merged = migration.apply(merged)
        }
      }
      merged._v = STORE_VERSION
      // Persist immediately so this migration runs exactly once per browser.
      try { localStorage.setItem(STORE_KEY, JSON.stringify(merged)) } catch (_) { /* best effort */ }
    } else {
      merged._v = STORE_VERSION
    }

    return merged
  } catch (_) {
    return { ...DEFAULTS, _v: STORE_VERSION }
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
