/**
 * ui/OmniGateGear.js — the gear and the settings panel of the opening screen (V276).
 *
 * Mounted INSIDE #omni-boot by boot/OmniStarBoot.js (a dynamic import after the small models arrive), so it has no dependency on main.js and
 * takes its colours from the boot screen's own variables (--boot-ink / --boot-bg ...). Everything it changes is saved to localStorage 'omni:gate-v1'
 * through utils/OmniGateSettings.js; the boot script listens for omni:gate-settings-changed and applies it at once.
 * This panel also folds in what the dev-only intro settings did for colour: Light / Dark, background, ink, logo star and star field opacity.
 * Text goes in with textContent / .value only. No emoji; the gear is an inline svg drawn here.
 */
import { loadGateSettings, saveGateSettings, resetGateSettings, CHANGED_EVENT, LOOK_LIGHT, LOOK_DARK } from '../utils/OmniGateSettings.js'
import { SPACES, SPACE_IDS } from '../utils/OmniSpaces.js'

const STYLE_ID = 'omni-gear-style'
const CSS = `
#omni-gear { position: absolute; left: 14px; bottom: 10px; z-index: 6; width: 36px; height: 36px; padding: 0; border-radius: 50%; cursor: pointer;
  background: rgba(var(--boot-halo-rgb, 255,255,255), 0.55); color: var(--boot-ink, #000); border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.35);
  display: flex; align-items: center; justify-content: center; transition: background .2s ease, border-color .2s ease, transform .4s ease; }
#omni-gear:hover, #omni-gear:focus-visible { background: rgba(var(--boot-ink-rgb, 0,0,0), 0.1); border-color: rgba(var(--boot-ink-rgb, 0,0,0), 0.8); outline: none; }
#omni-gear[aria-expanded="true"] { transform: rotate(60deg); }
#omni-gear svg { width: 20px; height: 20px; }
#omni-gear-panel { position: absolute; left: 14px; bottom: 54px; z-index: 6; width: min(350px, calc(100vw - 28px)); max-height: calc(100vh - 80px); overflow: auto;
  padding: 12px 14px 14px; border-radius: 10px; font: 12px/1.45 'Courier New', Courier, monospace; color: var(--boot-ink, #000);
  background: rgba(var(--boot-halo-rgb, 255,255,255), 0.9); border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.25);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); box-shadow: 0 6px 30px rgba(var(--boot-ink-rgb, 0,0,0), 0.18); }
#omni-gear-panel[hidden] { display: none; }
#omni-gear-panel h3 { margin: 12px 0 6px; font-size: 11px; font-weight: normal; letter-spacing: .22em; text-transform: uppercase; opacity: .65; }
#omni-gear-panel h3:first-child { margin-top: 0; }
#omni-gear-panel .og-row { display: flex; align-items: center; gap: 8px; margin: 5px 0; }
#omni-gear-panel .og-row > label { flex: 0 0 118px; }
#omni-gear-panel .og-row > label.og-c { flex: 1 1 auto; }
#omni-gear-panel .og-row > .og-val { flex: 0 0 44px; text-align: right; opacity: .65; font-variant-numeric: tabular-nums; }
#omni-gear-panel input[type=range] { flex: 1; min-width: 0; accent-color: var(--boot-ink, #000); }
#omni-gear-panel input[type=color] { width: 38px; height: 24px; padding: 0; border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.4); background: none; cursor: pointer; }
#omni-gear-panel select { flex: 1; font: inherit; color: inherit; background: rgba(var(--boot-halo-rgb, 255,255,255), 0.9); border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.4); border-radius: 4px; padding: 3px 4px; }
#omni-gear-panel button.og-btn { font: inherit; color: inherit; background: transparent; border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.45); border-radius: 999px; padding: 3px 12px; cursor: pointer; }
#omni-gear-panel button.og-btn:hover, #omni-gear-panel button.og-btn:focus-visible { background: rgba(var(--boot-ink-rgb, 0,0,0), 0.1); outline: none; }
#omni-gear-panel .og-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; }
#omni-gear-panel .og-grid label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
#omni-gear-panel .og-note { opacity: .6; font-size: 11px; margin-top: 4px; }
#omni-gear-panel input[type=checkbox] { accent-color: var(--boot-ink, #000); }
`

function el (tag, attrs, ...kids) {
  const e = document.createElement(tag)
  if (attrs) for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v) }
  for (const k of kids) if (k) e.appendChild(k)
  return e
}

function gearSvg () {
  // a gear drawn from 8 teeth and a hole: own path, no font
  let d = ''
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 16, r = i % 2 ? 6.4 : 9.6
    const a2 = a + Math.PI / 16 * 0.0
    d += (i ? 'L' : 'M') + (12 + Math.cos(a2) * r).toFixed(2) + ' ' + (12 + Math.sin(a2) * r).toFixed(2)
  }
  d += 'Z'
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false')
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.appendChild(p)
  const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '2.8'); svg.appendChild(c)
  return svg
}

/** Builds the gear + panel inside `boot` (the #omni-boot element). Returns { destroy }. Safe to call once per boot element. */
export function mountGear (boot) {
  if (!boot || boot.querySelector('#omni-gear')) return { destroy () {} }
  if (!document.getElementById(STYLE_ID)) { const st = el('style', { id: STYLE_ID }); st.textContent = CSS; document.head.appendChild(st) }

  const gear = el('button', { id: 'omni-gear', type: 'button', 'aria-label': 'Settings', 'aria-expanded': 'false', 'aria-controls': 'omni-gear-panel', title: 'Settings' })
  gear.appendChild(gearSvg())
  const panel = el('div', { id: 'omni-gear-panel', role: 'group', 'aria-label': 'Opening screen settings' }); panel.hidden = true
  boot.appendChild(gear); boot.appendChild(panel)

  let selfChange = false
  const save = (patch) => { selfChange = true; try { return saveGateSettings(patch) } finally { selfChange = false } }
  const cssVar = (name, d) => { try { return getComputedStyle(boot).getPropertyValue(name).trim() || d } catch (_) { return d } }

  function slider (id, label, min, max, step, value, fmt, onInput) {
    const input = el('input', { id, type: 'range', min: String(min), max: String(max), step: String(step) }); input.value = String(value)
    const val = el('span', { class: 'og-val', text: fmt(value) })
    input.addEventListener('input', () => { const v = Number(input.value); val.textContent = fmt(v); onInput(v) })
    return el('div', { class: 'og-row' }, el('label', { for: id, text: label }), input, val)
  }
  function check (id, label, checked, onChange) {
    const input = el('input', { id, type: 'checkbox' }); input.checked = !!checked
    input.addEventListener('change', () => onChange(input.checked))
    return el('label', { for: id, class: 'og-c' }, input, el('span', { text: label }))
  }
  function select (id, label, options, value, onChange) {
    const s = el('select', { id }); for (const [v, t] of options) { const o = el('option', { value: String(v), text: t }); if (String(v) === String(value)) o.selected = true; s.appendChild(o) }
    s.addEventListener('change', () => onChange(s.value))
    return el('div', { class: 'og-row' }, el('label', { for: id, text: label }), s)
  }
  function colour (id, label, value, onInput) {
    const c = el('input', { id, type: 'color' }); c.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
    c.addEventListener('input', () => onInput(c.value))
    return el('div', { class: 'og-row' }, el('label', { for: id, text: label }), c)
  }
  const pct = (v) => Math.round(v * 100) + '%'
  const lookNow = (s) => s.look || { bg: cssVar('--boot-bg', LOOK_LIGHT.bg), ink: cssVar('--boot-ink', LOOK_LIGHT.ink), starOpacity: Number(cssVar('--boot-star-alpha', '0.7')) || 0.7, fieldOpacity: 1, shootColor: cssVar('--boot-ink', LOOK_LIGHT.ink) }

  function render () {
    const s = loadGateSettings(), look = lookNow(s)
    panel.textContent = ''

    panel.appendChild(el('h3', { text: 'Look' }))
    const lb = el('div', { class: 'og-row' })
    const bl = el('button', { type: 'button', class: 'og-btn', text: 'Light' }), bd = el('button', { type: 'button', class: 'og-btn', text: 'Dark' })
    bl.addEventListener('click', () => { save({ look: LOOK_LIGHT }); render() }); bd.addEventListener('click', () => { save({ look: LOOK_DARK }); render() })
    lb.appendChild(bl); lb.appendChild(bd); panel.appendChild(lb)
    panel.appendChild(colour('og-bg', 'Background', look.bg, (v) => save({ look: { ...lookNow(loadGateSettings()), bg: v } })))
    panel.appendChild(colour('og-ink', 'Words and stars', look.ink, (v) => save({ look: { ...lookNow(loadGateSettings()), ink: v, shootColor: v } })))
    panel.appendChild(slider('og-overall', 'Overall opacity', 30, 100, 1, Math.round(s.overall * 100), (v) => v + '%', (v) => save({ overall: v / 100 })))
    panel.appendChild(slider('og-logo', 'Logo star', 0, 100, 1, Math.round(look.starOpacity * 100), (v) => v + '%', (v) => save({ look: { ...lookNow(loadGateSettings()), starOpacity: v / 100 } })))
    panel.appendChild(slider('og-field', 'Star field', 0, 100, 1, Math.round(look.fieldOpacity * 100), (v) => v + '%', (v) => save({ look: { ...lookNow(loadGateSettings()), fieldOpacity: v / 100 } })))

    panel.appendChild(el('h3', { text: 'Plexus' }))
    panel.appendChild(slider('og-count', 'Points', 20, 200, 1, s.plexus.count, String, (v) => save({ plexus: { count: v } })))
    panel.appendChild(slider('og-link', 'Link distance', 40, 300, 1, s.plexus.link, String, (v) => save({ plexus: { link: v } })))
    panel.appendChild(slider('og-lines', 'Line opacity', 0, 100, 1, Math.round(s.plexus.lineAlpha * 100), (v) => v + '%', (v) => save({ plexus: { lineAlpha: v / 100 } })))
    panel.appendChild(slider('og-speed', 'Speed', 0, 3, 0.05, s.plexus.speed, (v) => v.toFixed(2), (v) => save({ plexus: { speed: v } })))
    panel.appendChild(slider('og-size', 'Point size', 0.5, 3, 0.05, s.plexus.size, (v) => v.toFixed(2), (v) => save({ plexus: { size: v } })))

    panel.appendChild(el('h3', { text: 'Spaces' }))
    const grid = el('div', { class: 'og-grid' })
    const boxes = []
    for (const sp of SPACES) {
      const cb = check('og-sp-' + sp.id, sp.name.replace(' space', ''), s.spaces.enabled.includes(sp.id), () => {
        const on = SPACE_IDS.filter(id => boxes.find(b => b.id === id).cb.checked)
        if (!on.length) { boxes.find(b => b.id === sp.id).cb.checked = true; return }    // at least one stays ticked
        save({ spaces: { enabled: on } })
      })
      boxes.push({ id: sp.id, cb: cb.querySelector('input') }); grid.appendChild(cb)
    }
    panel.appendChild(grid)
    const allRow = el('div', { class: 'og-row' }); const all = el('button', { type: 'button', class: 'og-btn', text: 'All' })
    all.addEventListener('click', () => { for (const b of boxes) b.cb.checked = true; save({ spaces: { enabled: [...SPACE_IDS] } }) }); allRow.appendChild(all); panel.appendChild(allRow)
    panel.appendChild(slider('og-hold', 'Stay seconds', 2, 60, 0.5, s.spaces.holdSec, (v) => v.toFixed(1), (v) => save({ spaces: { holdSec: v } })))
    panel.appendChild(slider('og-move', 'Zoom seconds', 1, 10, 0.1, s.spaces.moveSec, (v) => v.toFixed(1), (v) => save({ spaces: { moveSec: v } })))
    panel.appendChild(select('og-dir', 'Order', [['out', 'Small to large'], ['in', 'Large to small']], s.spaces.direction, (v) => save({ spaces: { direction: v } })))
    panel.appendChild(el('div', { class: 'og-row' }, check('og-cap', 'Show the name of the space', s.spaces.caption, (v) => save({ spaces: { caption: v } }))))

    panel.appendChild(el('h3', { text: 'Loading bar' }))
    panel.appendChild(select('og-bar', 'Colour', [['plain', 'Plain'], ['rainbow', 'Rainbow spectrum']], s.bar, (v) => save({ bar: v })))

    panel.appendChild(el('h3', { text: 'Key ring' }))
    panel.appendChild(el('div', { class: 'og-row' }, check('og-gate', 'Ask for the key ring on Enter', s.gate, (v) => save({ gate: v }))))
    panel.appendChild(select('og-digits', 'Digit key', [[6, '6 digits'], [10, '10 digits']], s.digits, (v) => save({ digits: Number(v) })))

    panel.appendChild(el('h3', { text: 'Motion' }))
    panel.appendChild(el('div', { class: 'og-row' }, check('og-calm', 'Reduce motion', s.reduceMotion, (v) => save({ reduceMotion: v }))))
    panel.appendChild(el('div', { class: 'og-note', text: 'Turning motion back on takes full effect on the next load.' }))
    const rr = el('div', { class: 'og-row' }); const reset = el('button', { type: 'button', class: 'og-btn', text: 'Reset all' })
    reset.addEventListener('click', () => { selfChange = true; try { resetGateSettings() } finally { selfChange = false } render() }); rr.appendChild(reset); panel.appendChild(rr)
  }

  const setOpen = (open) => {
    if (open && panel.hidden) render()
    panel.hidden = !open; gear.setAttribute('aria-expanded', open ? 'true' : 'false')
  }
  gear.addEventListener('click', () => setOpen(panel.hidden))
  const onKey = (e) => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); gear.focus() } }
  window.addEventListener('keydown', onKey)
  const onChanged = () => { if (!selfChange && !panel.hidden) render() }
  window.addEventListener(CHANGED_EVENT, onChanged)

  return {
    destroy () {
      window.removeEventListener('keydown', onKey); window.removeEventListener(CHANGED_EVENT, onChanged)
      gear.remove(); panel.remove()
    }
  }
}
