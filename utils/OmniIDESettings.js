/**
 * utils/OmniIDESettings.js (V233) — settings and themes for the OmniIDE. No DOM, so it can be tested alone.
 *
 * The user's file is /home/settings_IDE.json in the OmniTerminal file system, edited in the IDE like any file. When it is saved the IDE re-reads it:
 * valid keys apply, a bad key or value is reported with its name and ignored (the rest still apply), broken JSON keeps the last good settings.
 *
 *   theme            omni-dark | midnight | paper | terminal | dusk
 *   fontFamily       any font name(s); a monospace fallback is added          fontSize 8..28       lineHeight 1.1..2.4      tabSize 1..8
 *   opacity          0.2..1  how solid the IDE areas are (lower shows the space behind)
 *   sidebar          { shade: darker | lighter | same, amount: 0..0.6 }  the file-tree area compared with the editor
 *   text             { color: "#rrggbb" | null, shadow: { enabled, x, y, blur, color } }   null colour = the theme's
 *   brackets         { autoClose, autoSkip, wrapSelection, colorPairs, highlightMatch }   all true by default
 *   extensions       [] reserved: a list of names, kept and ignored for now
 */
export const FILE_PATH = '/home/settings_IDE.json'
export const THEME_NAMES = ['omni-dark', 'midnight', 'paper', 'terminal', 'dusk']

export const DEFAULTS = Object.freeze({
  theme: 'omni-dark', fontFamily: 'Courier New', fontSize: 12, lineHeight: 1.5, tabSize: 2, opacity: 0.96,
  sidebar: { shade: 'darker', amount: 0.22 },
  text: { color: null, shadow: { enabled: false, x: 0, y: 0, blur: 6, color: '#7fd1ff' } },
  brackets: { autoClose: true, autoSkip: true, wrapSelection: true, colorPairs: true, highlightMatch: true },
  extensions: []
})

/** bg, fg, caret, selection, gutter, border; token colours; bracket depth colours (cycled). */
export const THEMES = {
  'omni-dark': { bg: '#10151c', fg: '#e6edf5', caret: '#ffffff', sel: 'rgba(120,160,255,.45)', gutter: '#5b6573', border: 'rgba(255,255,255,.14)', c: '#7d8590', k0: '#8aa0b8', kw: '#7fd1ff', ac: '#ffd479', pn: '#c4a7ff', wd: '#ff9ec4', num: '#8fe3a2', str: '#ffb38a', bool: '#ff9ec4', pu: '#9aa4b2', br: ['#ffd479', '#c4a7ff', '#7fd1ff', '#8fe3a2', '#ff9ec4', '#ffb38a'] },
  midnight: { bg: '#070a1a', fg: '#c9d4ff', caret: '#9fb4ff', sel: 'rgba(90,110,255,.45)', gutter: '#46507a', border: 'rgba(140,160,255,.2)', c: '#5d678f', k0: '#7080c0', kw: '#6fa8ff', ac: '#ffcc66', pn: '#b79bff', wd: '#ff8fb8', num: '#6fe0b0', str: '#ffa77a', bool: '#ff8fb8', pu: '#7f8bbd', br: ['#ffcc66', '#b79bff', '#6fa8ff', '#6fe0b0', '#ff8fb8', '#ffa77a'] },
  paper: { bg: '#fbf8f1', fg: '#2b2b2b', caret: '#000000', sel: 'rgba(70,120,255,.28)', gutter: '#a39e90', border: 'rgba(0,0,0,.16)', c: '#8a8578', k0: '#6a7a8c', kw: '#0b6fb8', ac: '#a35f00', pn: '#6b3fc4', wd: '#b4235f', num: '#13803a', str: '#b3541e', bool: '#b4235f', pu: '#6d6a60', br: ['#a35f00', '#6b3fc4', '#0b6fb8', '#13803a', '#b4235f', '#b3541e'] },
  terminal: { bg: '#020a04', fg: '#7dff9b', caret: '#b8ffc9', sel: 'rgba(60,255,120,.3)', gutter: '#2e7a45', border: 'rgba(80,255,130,.25)', c: '#3d8f55', k0: '#4fbf70', kw: '#b8ffc9', ac: '#e6ff7a', pn: '#7dffe0', wd: '#a6ff7d', num: '#e6ff7a', str: '#7dffd0', bool: '#a6ff7d', pu: '#4fbf70', br: ['#e6ff7a', '#7dffe0', '#b8ffc9', '#a6ff7d', '#7dff9b', '#c8ffb0'] },
  dusk: { bg: '#1c1420', fg: '#f1e4ee', caret: '#ffd3ee', sel: 'rgba(255,140,200,.35)', gutter: '#7a5f78', border: 'rgba(255,190,230,.18)', c: '#8f7a8c', k0: '#b08fb0', kw: '#ff9ad0', ac: '#ffd08a', pn: '#c9a0ff', wd: '#ff8fa3', num: '#9be3b4', str: '#ffb58a', bool: '#ff8fa3', pu: '#b39ab0', br: ['#ffd08a', '#c9a0ff', '#ff9ad0', '#9be3b4', '#ff8fa3', '#ffb58a'] }
}
const THEME_TEXT_SHADOW = { terminal: { enabled: true, x: 0, y: 0, blur: 5, color: '#3dff80' } }   // a theme may bring its own glow; the user's setting wins when they set text.shadow

const HEX = /^#[0-9a-f]{6}$/i
const FONT_OK = /^[A-Za-z0-9 ,'"._-]{1,120}$/
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)
const clone = (o) => JSON.parse(JSON.stringify(o))

/** Merge a parsed JSON object over the defaults. Returns { settings, problems: [string] }. Never throws. */
export function mergeSettings (input) {
  const out = clone(DEFAULTS), problems = []
  if (!isObj(input)) return { settings: out, problems: ['the file must hold one JSON object { ... }'] }
  const num = (path, v, lo, hi) => { if (typeof v !== 'number' || !Number.isFinite(v)) { problems.push(`${path} needs a number (${lo}..${hi})`); return undefined } if (v < lo || v > hi) problems.push(`${path} ${v} is outside ${lo}..${hi}; using ${clamp(v, lo, hi)}`); return clamp(v, lo, hi) }
  const bool = (path, v) => { if (typeof v !== 'boolean') { problems.push(`${path} needs true or false`); return undefined } return v }
  const unknown = (obj, allowed, path) => { for (const k of Object.keys(obj)) if (!allowed.includes(k)) problems.push(`unknown setting "${path}${k}"; valid here: ${allowed.join(', ')}`) }
  unknown(input, Object.keys(DEFAULTS), '')
  if ('theme' in input) { if (THEME_NAMES.includes(input.theme)) out.theme = input.theme; else problems.push(`theme "${input.theme}" is not one of: ${THEME_NAMES.join(', ')}`) }
  if ('fontFamily' in input) { if (typeof input.fontFamily === 'string' && FONT_OK.test(input.fontFamily)) out.fontFamily = input.fontFamily; else problems.push('fontFamily needs font names with letters, digits, spaces, commas and quotes only') }
  for (const [k, lo, hi] of [['fontSize', 8, 28], ['lineHeight', 1.1, 2.4], ['opacity', 0.2, 1]]) if (k in input) { const n = num(k, input[k], lo, hi); if (n !== undefined) out[k] = n }
  if ('tabSize' in input) { const n = num('tabSize', input.tabSize, 1, 8); if (n !== undefined) out.tabSize = Math.round(n) }
  if ('sidebar' in input) {
    if (!isObj(input.sidebar)) problems.push('sidebar needs { "shade": "darker", "amount": 0.2 }')
    else {
      unknown(input.sidebar, ['shade', 'amount'], 'sidebar.')
      if ('shade' in input.sidebar) { if (['darker', 'lighter', 'same'].includes(input.sidebar.shade)) out.sidebar.shade = input.sidebar.shade; else problems.push('sidebar.shade is one of: darker, lighter, same') }
      if ('amount' in input.sidebar) { const n = num('sidebar.amount', input.sidebar.amount, 0, 0.6); if (n !== undefined) out.sidebar.amount = n }
    }
  }
  let userShadow = false
  if ('text' in input) {
    if (!isObj(input.text)) problems.push('text needs { "color": null, "shadow": { ... } }')
    else {
      unknown(input.text, ['color', 'shadow'], 'text.')
      if ('color' in input.text) { if (input.text.color === null || (typeof input.text.color === 'string' && HEX.test(input.text.color))) out.text.color = input.text.color === null ? null : input.text.color.toLowerCase(); else problems.push('text.color needs #rrggbb or null') }
      if ('shadow' in input.text) {
        const sh = input.text.shadow
        if (!isObj(sh)) problems.push('text.shadow needs { "enabled": true, "x": 0, "y": 0, "blur": 6, "color": "#7fd1ff" }')
        else {
          userShadow = true; unknown(sh, ['enabled', 'x', 'y', 'blur', 'color'], 'text.shadow.')
          if ('enabled' in sh) { const b = bool('text.shadow.enabled', sh.enabled); if (b !== undefined) out.text.shadow.enabled = b }
          for (const [k, lo, hi] of [['x', -20, 20], ['y', -20, 20], ['blur', 0, 40]]) if (k in sh) { const n = num('text.shadow.' + k, sh[k], lo, hi); if (n !== undefined) out.text.shadow[k] = n }
          if ('color' in sh) { if (typeof sh.color === 'string' && HEX.test(sh.color)) out.text.shadow.color = sh.color.toLowerCase(); else problems.push('text.shadow.color needs #rrggbb') }
        }
      }
    }
  }
  if (!userShadow && THEME_TEXT_SHADOW[out.theme]) out.text.shadow = { ...THEME_TEXT_SHADOW[out.theme] }
  if ('brackets' in input) {
    if (!isObj(input.brackets)) problems.push('brackets needs { "autoClose": true, ... }')
    else { unknown(input.brackets, Object.keys(DEFAULTS.brackets), 'brackets.'); for (const k of Object.keys(DEFAULTS.brackets)) if (k in input.brackets) { const b = bool('brackets.' + k, input.brackets[k]); if (b !== undefined) out.brackets[k] = b } }
  }
  if ('extensions' in input) { if (Array.isArray(input.extensions) && input.extensions.every(x => typeof x === 'string' && x.length <= 64) && input.extensions.length <= 50) out.extensions = [...input.extensions]; else problems.push('extensions needs a list of names (it is reserved and does nothing yet)') }
  return { settings: out, problems }
}

/** Parse the file text. broken JSON -> { ok: false, error, line } and no settings. */
export function parseSettingsText (text) {
  let obj
  try { obj = JSON.parse(String(text ?? '')) } catch (e) {
    const m = /position (\d+)/.exec(e.message), line = m ? String(text).slice(0, +m[1]).split('\n').length : undefined
    return { ok: false, error: 'not valid JSON: ' + e.message.replace(/^JSON\.parse: /, ''), line }
  }
  const r = mergeSettings(obj); return { ok: true, settings: r.settings, problems: r.problems }
}

/** The text a new settings_IDE.json starts with: every setting at its default, plus the theme list as a hint. */
export function defaultText () { return JSON.stringify({ ...DEFAULTS, theme: DEFAULTS.theme }, null, 2) + '\n' }

/** Set one top-level key in the file text and keep the rest (re-serialised, 2 spaces). Throws on broken JSON. */
export function setKeyInText (text, key, value) {
  const obj = JSON.parse(String(text || '{}')); if (!isObj(obj)) throw new Error('the settings file is not a JSON object')
  obj[key] = value; return JSON.stringify(obj, null, 2) + '\n'
}

// ── colour helpers ──
const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (rgb, to, t) => rgb.map((v, i) => Math.round(v + (to[i] - v) * t))
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${+a.toFixed(3)})`

/** Settings -> CSS custom properties for the panel. Plain object name -> value. */
export function toCssVars (s) {
  const t = THEMES[s.theme] ?? THEMES['omni-dark'], bg = toRgb(t.bg)
  const side = s.sidebar.shade === 'same' ? bg : s.sidebar.shade === 'darker' ? mix(bg, [0, 0, 0], s.sidebar.amount) : mix(bg, [255, 255, 255], s.sidebar.amount)
  const sh = s.text.shadow, fam = s.fontFamily.trim()
  const vars = {
    '--oide-bg': rgba(bg, s.opacity), '--oide-side': rgba(side, s.opacity), '--oide-bar': rgba(mix(bg, s.sidebar.shade === 'lighter' ? [255, 255, 255] : [0, 0, 0], 0.1), s.opacity),
    '--oide-fg': s.text.color ?? t.fg, '--oide-caret': t.caret, '--oide-sel': t.sel, '--oide-gutter': t.gutter, '--oide-border': t.border,
    '--oide-font': `${/[ ,]/.test(fam) && !/['"]/.test(fam) ? `'${fam}'` : fam}, 'Courier New', monospace`, '--oide-fs': s.fontSize + 'px', '--oide-lh': Math.round(s.fontSize * s.lineHeight) + 'px', '--oide-tab': String(s.tabSize),
    '--oide-shadow': sh.enabled ? `${sh.x}px ${sh.y}px ${sh.blur}px ${sh.color}` : 'none',
    '--oide-c': t.c, '--oide-k0': t.k0, '--oide-kw': t.kw, '--oide-ac': t.ac, '--oide-pn': t.pn, '--oide-wd': t.wd, '--oide-num': t.num, '--oide-str': t.str, '--oide-bool': t.bool, '--oide-pu': t.pu
  }
  t.br.forEach((c, i) => { vars['--oide-b' + i] = c })
  return vars
}
