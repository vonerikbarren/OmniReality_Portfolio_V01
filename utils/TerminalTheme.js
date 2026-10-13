/**
 * utils/TerminalTheme.js — V192: theme -> terminal palette (pure helpers, no THREE, no storage).
 *
 * The terminal exists in two places (the in-scene TerminalShellTunnel panel drawn on a canvas texture, and the DOM panels:
 * ui/OmniCommandTerminalPanel.js and OmniChat's Terminal tab). Both take their colours from ONE palette made here:
 *
 *   tokens   the active OmniOS theme as ui/ThemeManager.js writes it: { bg, border, headerBg, text, textDim, textMuted, accent,
 *            inputBg, inputBorder, font? } (the --omni-theme-* CSS variables on :root, whose source is data/themes.json).
 *            Any key may be missing or unreadable: it falls back to the DARK theme's value, never to a half-guess.
 *   settings utils/TerminalSettings.js: followTheme (default ON), backgroundOpacity, accent + custom { bg, text, prompt, selection, border }
 *            used only when followTheme is OFF.
 *
 *   terminalPalette(tokens, settings) -> { follow, light, bg, bgRgb, bgAlpha, text, dim, muted, prompt, accent, selection, border, rule,
 *                                          headerBg, inputBg, error, cursor, font }
 * All colour values are CSS strings ('rgba(r, g, b, a)' or '#rrggbb'); bgRgb is [r,g,b] for canvas fills.
 */

export const DEFAULT_FONT = '"Courier New", Courier, monospace'

/** The built-in dark theme (data/themes.json "dark"): what every missing token falls back to. */
export const FALLBACK_TOKENS = Object.freeze({
  bg: 'rgba(8, 8, 12, 0.92)',
  border: 'rgba(255, 255, 255, 0.09)',
  headerBg: 'rgba(255, 255, 255, 0.03)',
  text: 'rgba(255, 255, 255, 0.95)',
  textDim: 'rgba(255, 255, 255, 0.70)',
  textMuted: 'rgba(255, 255, 255, 0.48)',
  accent: '#7fd8ff',
  inputBg: 'rgba(255, 255, 255, 0.10)',
  inputBorder: 'rgba(255, 255, 255, 0.18)',
})

export const TOKEN_KEYS = ['bg', 'border', 'headerBg', 'text', 'textDim', 'textMuted', 'accent', 'inputBg', 'inputBorder']
/** token key -> the CSS variable ui/ThemeManager.js writes. `font` is optional: no shipped theme defines it yet. */
export const TOKEN_VARS = Object.freeze({
  bg: '--omni-theme-bg', border: '--omni-theme-border', headerBg: '--omni-theme-header-bg', text: '--omni-theme-text',
  textDim: '--omni-theme-text-dim', textMuted: '--omni-theme-text-muted', accent: '--omni-theme-accent',
  inputBg: '--omni-theme-input-bg', inputBorder: '--omni-theme-input-border', font: '--omni-theme-font',
})

const clamp01 = (n) => Math.min(1, Math.max(0, n))
const byte = (n) => Math.min(255, Math.max(0, Math.round(n)))

/** '#rgb' / '#rrggbb' / 'rgb(r,g,b)' / 'rgba(r,g,b,a)' (commas or spaces, % alpha) -> [r,g,b,a] or null. */
export function parseColor (v) {
  if (typeof v !== 'string') return null
  const s = v.trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(s)
  if (m) return [...m[1]].map(c => parseInt(c + c, 16)).concat(1)
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s)
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1]
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/.exec(s)
  if (m) {
    const a = m[4] == null ? 1 : (m[5] ? Number(m[4]) / 100 : Number(m[4]))
    const rgb = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (rgb.some(n => !Number.isFinite(n) || n > 255) || !Number.isFinite(a)) return null
    return [...rgb.map(byte), clamp01(a)]
  }
  return null
}

export const isColor = (v) => parseColor(v) !== null
export const toCss = ([r, g, b, a = 1]) => `rgba(${byte(r)}, ${byte(g)}, ${byte(b)}, ${Math.round(clamp01(a) * 1000) / 1000})`
export const toHex = ([r, g, b]) => '#' + [r, g, b].map(n => byte(n).toString(16).padStart(2, '0')).join('')
/** The same colour with another alpha ('' input -> null). */
export function withAlpha (color, alpha) {
  const c = parseColor(color)
  return c ? toCss([c[0], c[1], c[2], alpha]) : null
}
/** Relative luminance 0..1 of a colour (alpha ignored). */
export function luminance (color) {
  const c = parseColor(color)
  if (!c) return 0
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

/** Fill every missing / unreadable token from the dark fallback. `font` is kept only when it is a plain font-family string. */
export function normalizeTokens (tokens) {
  const t = tokens && typeof tokens === 'object' ? tokens : {}
  const out = {}
  for (const k of TOKEN_KEYS) out[k] = isColor(t[k]) ? String(t[k]).trim() : FALLBACK_TOKENS[k]
  out.font = typeof t.font === 'string' && /^[\w\s,"'.-]{2,120}$/.test(t.font.trim()) ? t.font.trim() : null
  return out
}

/** Read the active theme's tokens from the CSS variables on an element (default :root). Missing variables stay undefined (-> fallback). */
export function readThemeTokens (el) {
  const root = el ?? (typeof document !== 'undefined' ? document.documentElement : null)
  const out = {}
  if (!root) return out
  let cs = null
  try { cs = typeof getComputedStyle === 'function' ? getComputedStyle(root) : null } catch (_) { cs = null }
  for (const [k, v] of Object.entries(TOKEN_VARS)) {
    let val = ''
    try { val = (root.style?.getPropertyValue(v) || cs?.getPropertyValue(v) || '').trim() } catch (_) { val = '' }
    if (val) out[k] = val
  }
  return out
}

/** The terminal palette for a theme + the terminal settings. Pure; never throws. */
export function terminalPalette (tokens, settings) {
  const t = normalizeTokens(tokens)
  const s = settings && typeof settings === 'object' ? settings : {}
  const follow = s.followTheme !== false
  const opacity = typeof s.backgroundOpacity === 'number' && Number.isFinite(s.backgroundOpacity) ? clamp01(s.backgroundOpacity) : 0.78
  const custom = s.custom && typeof s.custom === 'object' ? s.custom : {}
  const pick = (v, fb) => (isColor(v) ? String(v).trim() : fb)

  const bgSrc = follow ? t.bg : pick(custom.bg, '#000000')
  const bgC = parseColor(bgSrc) ?? parseColor(FALLBACK_TOKENS.bg)
  const text = follow ? t.text : pick(custom.text, '#00ff88')
  const accent = follow ? t.accent : pick(s.accent, '#00ff88')
  const prompt = follow ? t.accent : pick(custom.prompt, accent)
  const selSrc = follow ? t.accent : pick(custom.selection, accent)
  const borderSrc = follow ? t.border : pick(custom.border, accent)
  const bc = parseColor(borderSrc)
  const light = luminance(toCss(bgC)) > 0.5
  const dimSrc = follow ? t.textDim : withAlpha(text, 0.7)
  const mutedSrc = follow ? t.textMuted : withAlpha(text, 0.5)
  return {
    follow,
    light,
    bg: toCss([bgC[0], bgC[1], bgC[2], opacity]),
    bgRgb: [bgC[0], bgC[1], bgC[2]],
    bgAlpha: opacity,
    text,
    dim: dimSrc,
    muted: mutedSrc,
    prompt,
    accent,
    selection: withAlpha(selSrc, 0.32),
    border: toCss([bc[0], bc[1], bc[2], Math.max(bc[3], 0.28)]),
    rule: follow ? t.border : withAlpha(accent, 0.2),
    headerBg: follow ? t.headerBg : withAlpha(accent, 0.1),
    inputBg: follow ? t.inputBg : 'rgba(255, 255, 255, 0.06)',
    error: light ? '#c0392b' : '#ff7b7b',
    cursor: prompt,
    font: follow ? (t.font ?? DEFAULT_FONT) : DEFAULT_FONT,
  }
}

/** One short string that changes when any colour of the palette changes (used to skip redundant redraws). */
export const paletteSig = (p) => [p.bg, p.text, p.dim, p.prompt, p.accent, p.selection, p.border, p.rule, p.headerBg, p.error, p.font].join('|')

/** CSS custom properties the DOM surfaces read (written on :root by utils/TerminalSettings.js applyToRoot). */
export function paletteCssVars (p) {
  return {
    '--terminal-bg': p.bg, '--terminal-text': p.text, '--terminal-dim': p.dim, '--terminal-muted': p.muted, '--terminal-prompt': p.prompt,
    '--terminal-accent': p.accent, '--terminal-selection': p.selection, '--terminal-border': p.border, '--terminal-rule': p.rule,
    '--terminal-header-bg': p.headerBg, '--terminal-input-bg': p.inputBg, '--terminal-error': p.error, '--terminal-font': p.font,
  }
}
