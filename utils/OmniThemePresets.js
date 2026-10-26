/**
 * utils/OmniThemePresets.js (V205) — theme PRESETS: one click = a wallpaper + a full set of rgba() panel colours (what you would otherwise set by hand in the wallpaper
 * settings and then again in Admin > Theme). Pure data and functions: no DOM, the storage is passed in. Shown in Admin > Theme presets (ui/AdminPanel.js).
 *
 * preset = { id, label, wallpaper:{ kind:'image'|'slot'|'color', imgUrl?, slot?, color, alpha }, panel:{ bg, border, headerBg, text, textDim, textMuted, accent, inputBg, inputBorder } }
 *   kind 'image'  a picture by URL (the default wallpaper)     kind 'slot'  one of the 20 saved wallpaper slots (this browser)     kind 'color'  no picture, a plain colour
 * toWallpaperPatch(p)  -> the patch for omni:wallpaper-settings-set (video off, picture / slot / colour, alpha)
 * toPanelTokens(p)     -> the object ThemeManager.setCustomTheme takes
 * Every colour is validated (rgb(), rgba(), #hex only): a hostile string never reaches a CSS variable.
 */
export const PRESET_KEY = 'omni:admin:themePresets'
export const MAX_CUSTOM = 24
export const DEFAULT_IMG = './assets/images/wallpaper-default.jpg'
export const PANEL_KEYS = Object.freeze(['bg', 'border', 'headerBg', 'text', 'textDim', 'textMuted', 'accent', 'inputBg', 'inputBorder'])

const COLOR_RE = /^(?:rgba?\(\s*\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}(?:\.\d+)?\s*(?:,\s*(?:0|1|0?\.\d+|1\.0+)\s*)?\)|#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8}))$/i
export const isColor = (v) => typeof v === 'string' && v.length <= 48 && COLOR_RE.test(v.trim())
const own = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
const clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>"'`]/g, '').trim() : '')
const label = (v, d) => { const s = clean(v).slice(0, 32); return s || d }
const id = (v) => (typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{0,40}$/i.test(v) && v !== '__proto__' ? v : '')

const BASE_PANEL = { bg: 'rgba(8, 8, 12, 0.92)', border: 'rgba(255, 255, 255, 0.09)', headerBg: 'rgba(255, 255, 255, 0.03)', text: 'rgba(255, 255, 255, 0.95)', textDim: 'rgba(255, 255, 255, 0.70)', textMuted: 'rgba(255, 255, 255, 0.48)', accent: '#7fd8ff', inputBg: 'rgba(255, 255, 255, 0.10)', inputBorder: 'rgba(255, 255, 255, 0.18)' }

export function sanitizePreset (raw, fallbackId = '') {
  const r = raw && typeof raw === 'object' ? raw : {}
  const w = own(r, 'wallpaper') ?? {}; const p = own(r, 'panel') ?? {}
  const kind = ['image', 'slot', 'color'].includes(own(w, 'kind')) ? w.kind : 'color'
  const a = Number(own(w, 'alpha')); const alpha = Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 0.9
  const wallpaper = { kind, color: isColor(own(w, 'color')) ? w.color.trim() : '#445566', alpha }
  if (kind === 'image') { const u = clean(own(w, 'imgUrl')); wallpaper.imgUrl = /^(\.\/assets\/[\w./-]{1,120}|data:image\/[a-z+.-]{1,20};base64,[A-Za-z0-9+/=]{1,200000})$/.test(u) ? u : DEFAULT_IMG }
  if (kind === 'slot') { const s = Math.round(Number(own(w, 'slot'))); wallpaper.slot = Number.isFinite(s) && s >= 1 && s <= 20 ? s : 1 }
  const panel = {}
  for (const k of PANEL_KEYS) { const v = own(p, k); panel[k] = isColor(v) ? v.trim() : BASE_PANEL[k] }
  return { id: id(own(r, 'id')) || id(fallbackId), label: label(own(r, 'label'), 'Theme'), wallpaper, panel }
}

const P = (idv, lab, wall, panel) => sanitizePreset({ id: idv, label: lab, wallpaper: wall, panel: { ...BASE_PANEL, ...panel } })
export const SHIPPED = Object.freeze([
  P('midnight', 'Midnight', { kind: 'image', imgUrl: DEFAULT_IMG, color: '#445566', alpha: 0.9 }, {}),
  P('daylight', 'Daylight', { kind: 'color', color: '#dfe6f0', alpha: 0.9 }, { bg: 'rgba(246, 247, 250, 0.94)', border: 'rgba(20, 20, 30, 0.12)', headerBg: 'rgba(20, 20, 30, 0.04)', text: 'rgba(15, 15, 20, 0.94)', textDim: 'rgba(15, 15, 20, 0.68)', textMuted: 'rgba(15, 15, 20, 0.45)', accent: '#2f7cd6', inputBg: 'rgba(15, 15, 20, 0.06)', inputBorder: 'rgba(15, 15, 20, 0.16)' }),
  P('ember', 'Ember', { kind: 'color', color: '#2a1410', alpha: 0.9 }, { bg: 'rgba(30, 14, 10, 0.92)', border: 'rgba(255, 160, 100, 0.20)', headerBg: 'rgba(255, 160, 100, 0.05)', text: 'rgba(255, 240, 230, 0.95)', textDim: 'rgba(255, 225, 205, 0.72)', textMuted: 'rgba(255, 215, 190, 0.5)', accent: '#ff9a5c', inputBg: 'rgba(255, 190, 150, 0.10)', inputBorder: 'rgba(255, 170, 120, 0.24)' }),
  P('ocean', 'Ocean', { kind: 'color', color: '#0b2a3a', alpha: 0.9 }, { bg: 'rgba(6, 22, 32, 0.92)', border: 'rgba(120, 220, 255, 0.18)', headerBg: 'rgba(120, 220, 255, 0.05)', text: 'rgba(232, 248, 255, 0.95)', textDim: 'rgba(205, 238, 252, 0.72)', textMuted: 'rgba(190, 230, 250, 0.5)', accent: '#5ad1ff', inputBg: 'rgba(140, 220, 255, 0.10)', inputBorder: 'rgba(120, 210, 250, 0.24)' }),
  P('forest', 'Forest', { kind: 'color', color: '#10261a', alpha: 0.9 }, { bg: 'rgba(8, 24, 16, 0.92)', border: 'rgba(130, 230, 170, 0.18)', headerBg: 'rgba(130, 230, 170, 0.05)', text: 'rgba(236, 255, 242, 0.95)', textDim: 'rgba(210, 245, 222, 0.72)', textMuted: 'rgba(195, 238, 210, 0.5)', accent: '#6fe3a0', inputBg: 'rgba(150, 235, 185, 0.10)', inputBorder: 'rgba(130, 225, 170, 0.24)' }),
  P('violet', 'Violet', { kind: 'color', color: '#1c1030', alpha: 0.9 }, { bg: 'rgba(20, 12, 34, 0.92)', border: 'rgba(201, 163, 255, 0.20)', headerBg: 'rgba(201, 163, 255, 0.05)', text: 'rgba(246, 238, 255, 0.95)', textDim: 'rgba(228, 212, 250, 0.72)', textMuted: 'rgba(215, 195, 245, 0.5)', accent: '#c9a3ff', inputBg: 'rgba(210, 180, 255, 0.10)', inputBorder: 'rgba(200, 165, 250, 0.26)' }),
  P('contrast', 'High contrast', { kind: 'color', color: '#000000', alpha: 1 }, { bg: 'rgba(0, 0, 0, 0.97)', border: 'rgba(255, 255, 255, 0.60)', headerBg: 'rgba(255, 255, 255, 0.10)', text: 'rgba(255, 255, 255, 1)', textDim: 'rgba(255, 255, 255, 0.88)', textMuted: 'rgba(255, 255, 255, 0.70)', accent: '#ffe14d', inputBg: 'rgba(255, 255, 255, 0.14)', inputBorder: 'rgba(255, 255, 255, 0.55)' }),
])

/** The patch for omni:wallpaper-settings-set: video off, then picture / slot / colour, and the alpha. */
export function toWallpaperPatch (preset) {
  const p = sanitizePreset(preset); const w = p.wallpaper
  const base = { alpha: w.alpha, videoActive: false, activeVideoSlot: null, videoUrl: '' }
  if (w.kind === 'slot') return { ...base, activeSlot: w.slot, color: w.color }
  if (w.kind === 'image') return { ...base, activeSlot: null, imgUrl: w.imgUrl, color: w.color }
  return { ...base, activeSlot: null, imgUrl: '', color: w.color }
}
export const toPanelTokens = (preset) => ({ ...sanitizePreset(preset).panel })

/** Build a preset from what is on screen now: the wallpaper settings object (omni:wallpaper:settings) and the applied panel tokens. */
export function captureCurrent (wallpaperState, panelTokens, name) {
  const w = wallpaperState && typeof wallpaperState === 'object' ? wallpaperState : {}
  const slot = Number(w.activeSlot)
  const wallpaper = slot >= 1 && !w.videoActive ? { kind: 'slot', slot, color: w.color, alpha: w.alpha }
    : (typeof w.imgUrl === 'string' && w.imgUrl.startsWith('./assets/') ? { kind: 'image', imgUrl: w.imgUrl, color: w.color, alpha: w.alpha } : { kind: 'color', color: w.color, alpha: w.alpha })
  return sanitizePreset({ label: name, wallpaper, panel: panelTokens })
}

// ── the user's own presets (storage passed in; localStorage by default) ───────────────────────────────────────────────────────────────────────────
const store = (s) => s ?? (typeof localStorage !== 'undefined' ? localStorage : null)
export function loadCustom (s = null) {
  try {
    const raw = store(s)?.getItem(PRESET_KEY); const arr = raw ? JSON.parse(raw) : []
    if (!Array.isArray(arr)) return []
    const out = []; const seen = new Set(SHIPPED.map(x => x.id))
    for (const r of arr.slice(0, MAX_CUSTOM * 2)) { const p = sanitizePreset(r); if (!p.id || seen.has(p.id)) continue; seen.add(p.id); out.push(p); if (out.length >= MAX_CUSTOM) break }
    return out
  } catch (_) { return [] }
}
export function saveCustom (list, s = null) { try { store(s)?.setItem(PRESET_KEY, JSON.stringify(list.slice(0, MAX_CUSTOM))); return true } catch (_) { return false } }
const newId = (taken) => { for (let i = 0; i < 50; i++) { const c = 'my-' + Math.random().toString(36).slice(2, 8); if (!taken.has(c)) return c } return 'my-' + Date.now().toString(36) }
/** Add a preset (a new id). Returns { ok, list, preset } or { ok:false, error }. */
export function addCustom (list, preset) {
  if (list.length >= MAX_CUSTOM) return { ok: false, error: `You can keep ${MAX_CUSTOM} of your own themes. Delete one first.` }
  const taken = new Set([...SHIPPED.map(x => x.id), ...list.map(x => x.id)])
  const p = sanitizePreset({ ...preset, id: newId(taken) })
  return { ok: true, list: [...list, p], preset: p }
}
export const removeCustom = (list, pid) => list.filter(x => x.id !== pid)
export const renameCustom = (list, pid, name) => list.map(x => (x.id === pid ? { ...x, label: label(name, x.label) } : x))
export const allPresets = (list) => [...SHIPPED, ...list]
export const findPreset = (list, pid) => allPresets(list).find(x => x.id === pid) ?? null
export default { SHIPPED, PANEL_KEYS, isColor, sanitizePreset, toWallpaperPatch, toPanelTokens, captureCurrent, loadCustom, saveCustom, addCustom, removeCustom, renameCustom, allPresets, findPreset }
