/**
 * ui/DevOmniStarIntroSettingsPanel.js — ⟐DevOmniStarIntroSettings: DEV ONLY (V190, ⟐Developer drawer slot 8)
 *
 * Tunes the OmniStar boot / intro screen (boot/OmniStarBoot.js): background colour (any), a procedural background texture
 * (none / noise / grid / scanlines / dots, or your own image: a png / jpeg / webp / gif file up to 200 KB, or an https URL) with an
 * opacity, the colour and opacity of the landed star, the opacity of the background star field and the colour of the shooting stars.
 *
 * Why it only stores a value: the boot script is a classic script that runs BEFORE the app modules load, so it reads
 * localStorage 'omni:dev-intro-v1' itself (validated, never trusted) and applies it at the next load. "Preview intro" replays the
 * boot markup + script right now through window.__omniBootPreview() (Esc / the Close button ends it). If that hook is missing
 * (the boot script did not run) the panel says to reload instead. `?bootintro=off` in the page URL ignores the saved value.
 *
 * DEV ONLY. No user-facing module imports this file or utils/DevOmniStarIntroSettings.js. Text goes in with textContent / .value only.
 */

import OmniSettingsPanelBase from './OmniSettingsPanelBase.js'
import * as Intro from '../utils/DevOmniStarIntroSettings.js'

export const PANEL_ID = 'devomnistarintrosettings'
export const NAV_ITEM = '⟐DevOmniStarIntroSettings'

const STYLES = `
.dis-panel .oss-body { padding-top: 4px; overflow-x: hidden; }
.dis-panel *, .dis-panel *::before { box-sizing: border-box; }
.dis-field { border-top: 1px dashed rgba(255,255,255,.14); padding: 6px 0; }
.dis-field:first-child { border-top: 0; }
.dis-label { display: block; margin-bottom: 3px; }
.dis-color { width: 44px; height: 30px; padding: 2px; border-radius: 6px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); background: transparent; cursor: pointer; }
.dis-hex { width: 96px; font-variant-numeric: tabular-nums; }
.dis-range { flex: 1 1 120px; min-width: 0; }
.dis-val { width: 38px; text-align: right; }
.dis-prev { height: 34px; border-radius: 6px; border: 1px solid rgba(255,255,255,.18); margin-top: 6px; position: relative; overflow: hidden; }
.dis-prev > i { position: absolute; inset: 0; display: block; }
.dis-prev > b { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('dis-styles')) return
  const s = document.createElement('style'); s.id = 'dis-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

function h (tag, props = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  kids.flat().forEach(c => { if (c !== null && c !== undefined && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c) })
  return el
}
const tip = (props, name, desc) => ({ ...props, 'data-omni-tip': name, 'data-omni-tip-key': '—', 'data-omni-tip-desc': desc })

export default class DevOmniStarIntroSettingsPanel extends OmniSettingsPanelBase {
  constructor () {
    super({
      id: PANEL_ID, label: '⟐DevOmniStarIntroSettings', iconLabel: '⟐DI', navItems: [NAV_ITEM], className: 'dis-panel', devOnly: true,
      bannerText: 'DEV ONLY — changes the intro / boot screen. Saved at once; shown on the next load or with Preview intro',
    })
    this._s = Intro.load()
  }

  onInit () { injectStyles() }

  refresh () {
    this._s = Intro.load()
    this._syncControls()
  }

  _msg (text, kind = '') {
    const m = this.body?.querySelector('[data-ref="msg"]')
    if (!m) return
    m.textContent = text
    m.className = 'oss-msg' + (kind ? ' is-' + kind : '')
  }

  /** Save one or more fields (validated by the model) and refresh the controls from what was actually stored. */
  _set (patch) {
    const r = Intro.save(patch)
    this._s = r.settings
    this._syncControls()
    this._msg(r.ok ? 'Saved. Applies on the next load, or press Preview intro.' : 'Could not save (storage blocked or full).', r.ok ? 'ok' : 'err')
  }

  _colorField (key, label, desc) {
    const color = h('input', tip({ type: 'color', class: 'dis-color', 'data-f': key + '-c', 'aria-label': label + ' (colour picker)' }, label, desc))
    const hex = h('input', tip({ type: 'text', class: 'oss-input dis-hex', 'data-f': key + '-h', maxlength: 7, spellcheck: 'false', 'aria-label': label + ' (hex)' }, label + ' hex', 'Type a hex colour such as #ff8800 or #f80. Anything invalid is ignored.'))
    color.addEventListener('input', () => this._set({ [key]: color.value }))
    hex.addEventListener('change', () => {
      const v = Intro.normalizeHex(hex.value, null)
      if (v === null) { this._msg('Not a hex colour (use #rgb or #rrggbb).', 'err'); hex.value = this._s[key]; return }
      this._set({ [key]: v })
    })
    return h('div', { class: 'dis-field' }, h('span', { class: 'dis-label', text: label }), h('div', { class: 'oss-row' }, color, hex))
  }

  _rangeField (key, label, desc) {
    const range = h('input', tip({ type: 'range', class: 'dis-range', min: 0, max: 1, step: 0.01, 'data-f': key + '-r', 'aria-label': label }, label, desc))
    const val = h('span', { class: 'dis-val oss-dim', 'data-f': key + '-v' })
    range.addEventListener('input', () => { val.textContent = Number(range.value).toFixed(2) })
    range.addEventListener('change', () => this._set({ [key]: Number(range.value) }))
    return h('div', { class: 'dis-field' }, h('span', { class: 'dis-label', text: label }), h('div', { class: 'oss-row' }, range, val))
  }

  buildBody (body) {
    const fields = h('div')
    fields.append(
      h('div', { class: 'oss-sec', text: 'Background' }),
      this._colorField('bg', 'Background colour', 'Any colour for the intro screen background (default black).'),
    )
    const texSel = h('select', tip({ class: 'oss-select', 'data-f': 'texture', 'aria-label': 'Background texture' }, 'Background texture', 'A texture drawn over the background colour. noise / grid / scanlines / dots are generated in code; custom uses the image below.'),
      Intro.TEXTURES.map(t => h('option', { value: t, text: t })))
    texSel.addEventListener('change', () => {
      if (texSel.value === 'custom' && !this._s.customUrl) { this._msg('Add an image or https URL first (below).', 'err'); texSel.value = this._s.texture; return }
      this._set({ texture: texSel.value })
    })
    fields.append(
      h('div', { class: 'dis-field' }, h('span', { class: 'dis-label', text: 'Background texture' }), h('div', { class: 'oss-row' }, texSel)),
      this._rangeField('textureOpacity', 'Texture opacity', 'How strongly the texture shows over the background colour, 0 (invisible) to 1.'),
    )
    // custom image: https URL or a small file
    const url = h('input', tip({ type: 'text', class: 'oss-input is-wide', 'data-f': 'customUrl', maxlength: 500, spellcheck: 'false', placeholder: 'https://… image URL (https only)', 'aria-label': 'Custom texture URL' }, 'Custom texture URL', 'An https image URL (max 500 characters, no spaces or quotes). Use the file picker for a local image.'))
    url.addEventListener('change', () => {
      const v = url.value.trim()
      if (v && !Intro.safeImageUrl(v)) { this._msg('Only an https URL (no spaces, quotes or parentheses) is accepted.', 'err'); url.value = this._s.customUrl.startsWith('data:') ? '' : this._s.customUrl; return }
      this._set({ customUrl: v, ...(v ? { texture: 'custom' } : (this._s.texture === 'custom' ? { texture: 'none' } : {})) })
    })
    const file = h('input', tip({ type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', 'data-f': 'file', 'aria-label': 'Custom texture file' }, 'Custom texture file', 'A png, jpeg, webp or gif up to 200 KB. It is stored in this browser only, as a data URL.'))
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]
      if (!f) return
      const r = await Intro.readImageFile(f)
      file.value = ''
      if (!r.ok) { this._msg(r.error, 'err'); return }
      this._set({ customUrl: r.url, texture: 'custom' })
    })
    const clearImg = h('button', tip({ type: 'button', class: 'oss-btn', 'data-act': 'clear-img' }, 'Remove custom image', 'Forgets the custom image / URL; a texture set to custom falls back to none.'), 'Remove image')
    clearImg.addEventListener('click', () => this._set({ customUrl: '', ...(this._s.texture === 'custom' ? { texture: 'none' } : {}) }))
    fields.append(
      h('div', { class: 'dis-field' }, h('span', { class: 'dis-label', text: 'Custom texture (optional)' }), url, h('div', { class: 'oss-row' }, file, clearImg),
        h('div', { class: 'oss-dim', 'data-f': 'img-state' })),
      h('div', { class: 'oss-sec', text: 'Stars' }),
      this._colorField('starColor', 'Star colour', 'Colour of the landed logo star, its flight tail and the background star field.'),
      this._rangeField('starOpacity', 'Landed star opacity', 'Opacity of the star behind the ⟐ once it has landed (default 0.7).'),
      this._rangeField('fieldOpacity', 'Star field opacity', 'Opacity of the small drifting background stars and their faint lines (default 1).'),
      h('div', { class: 'oss-sec', text: 'Shooting stars' }),
      this._colorField('shootColor', 'Shooting-star colour', 'Colour of the light shooting stars that cross the background after the star lands.'),
    )
    const prev = h('div', { class: 'dis-prev', 'data-f': 'swatch', 'aria-hidden': 'true' }, h('i'), h('b'))
    const btnPrev = h('button', tip({ type: 'button', class: 'oss-btn', 'data-act': 'preview' }, 'Preview intro', 'Replays the intro on top of the app right now with the saved settings (Esc or the Close preview button ends it). If it cannot, reload the page.'), 'Preview intro')
    btnPrev.addEventListener('click', () => this._preview())
    const btnReset = h('button', tip({ type: 'button', class: 'oss-btn is-danger', 'data-act': 'reset' }, 'Reset to defaults', 'Removes the saved intro settings: black background, no texture, white stars.'), 'Reset to defaults')
    btnReset.addEventListener('click', () => { this._s = Intro.reset(); this._syncControls(); this._msg('Reset. The intro uses its defaults on the next load.', 'ok') })
    body.append(fields, prev,
      h('div', { class: 'oss-row' }, btnPrev, btnReset),
      h('div', { class: 'oss-msg', role: 'status', 'aria-live': 'polite', 'data-ref': 'msg' }),
      h('div', { class: 'oss-dim', text: 'Stored in this browser only (localStorage "omni:dev-intro-v1"). The boot script reads it before the app loads, so a change shows on the next load or with Preview intro. If a colour makes the intro unreadable, open the page with ?bootintro=off to ignore the saved value.' }))
    this._syncControls()
  }

  _q (f) { return this.body?.querySelector(`[data-f="${f}"]`) }

  _syncControls () {
    if (!this.body) return
    const s = this._s
    for (const k of ['bg', 'starColor', 'shootColor']) {
      const c = this._q(k + '-c'), x = this._q(k + '-h')
      if (c) c.value = s[k]
      if (x) x.value = s[k]
    }
    for (const k of ['textureOpacity', 'starOpacity', 'fieldOpacity']) {
      const r = this._q(k + '-r'), v = this._q(k + '-v')
      if (r) r.value = String(s[k])
      if (v) v.textContent = s[k].toFixed(2)
    }
    const t = this._q('texture'); if (t) t.value = s.texture
    const u = this._q('customUrl'); if (u) u.value = s.customUrl.startsWith('data:') ? '' : s.customUrl
    const st = this._q('img-state'); if (st) st.textContent = s.customUrl ? (s.customUrl.startsWith('data:') ? `Custom image stored (${Math.round(s.customUrl.length / 1024)} KB as data URL).` : 'Custom image: https URL set.') : 'No custom image.'
    const sw = this._q('swatch')
    if (sw) {
      sw.style.background = s.bg
      const dot = sw.querySelector('b'); if (dot) { dot.style.background = s.starColor; dot.style.opacity = String(s.starOpacity) }
    }
  }

  _preview () {
    let started = false
    try { started = typeof window.__omniBootPreview === 'function' && window.__omniBootPreview() === true } catch (_) { started = false }
    this._msg(started ? 'Preview running. Press Esc or "Close preview" to return.' : 'Could not preview here (the boot script is not available or the boot is still showing). Reload the page to see the saved intro.', started ? 'ok' : 'err')
  }
}
