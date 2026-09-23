/**
 * utils/JsonChatMessageOptions.js — the real, global saved
 * configuration behind OmniChat's JSON tab
 *
 * Confirmed directly: "like what we have for wallpaper" actually
 * means a single, global saved configuration (checked directly —
 * WallpaperSettingsPanel has no real, multiple/named profile system,
 * just one saved settings object under one key), not a new
 * multi-profile system. Same real, proven pattern already used for
 * utils/TerminalSettings.js.
 *
 * The transform fields (px/py/pz/rx/ry/rz/sx/sy/sz) and their real
 * ranges are taken directly from OmniDraw's own, already-proven
 * Transform schema (ui/OmniDraw.js) — the "same summon logic as
 * OmniDraw components" the person referenced directly — reused, not
 * reinvented.
 */

const STORE_KEY = 'omni:jsonchat:options'
const DEFAULTS = {
  form: 1,           // shape — same Form 1-6 mechanic as text messages
  origin: 'user',     // 'user' | 'left' | 'right' | 'ceiling' | 'ground' | 'point'
  px: 0, py: 0, pz: -3,
  rx: 0, ry: 0, rz: 0,
  sx: 1, sy: 1, sz: 1,
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
}
