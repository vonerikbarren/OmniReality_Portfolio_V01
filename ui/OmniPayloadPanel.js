/**
 * ui/OmniPayloadPanel.js — ⟐Payload: create the RightHand's AMMO (V168)
 *
 * One draggable, WindowManager-registered panel (id 'omnipayload') opened from the RightHand's radial
 * page ⟐1 (ui/RadialMenu.js): #1 DataTypes, #2 Color, #3 Texture, #4 Material open THIS panel and focus
 * the matching section (a single shared panel rather than four popovers: one place edits one payload).
 *
 *   DATA TYPE  String | Number | Boolean (Array / Object are listed, disabled, "later")
 *   VALUE      a text field: <textarea> (string, max 500) / number input / true | false toggle
 *   NAME       optional; defaults to the (shortened) value
 *   WORD TIMING (strings: delay between words 50-3000 ms slider + number, hold, rise, direction, loop,
 *              max words; numbers / booleans: hold, rise, direction) -> payload.display
 *   PREVIEW    a small area where the words animate (utils/FlowWordPlayer.js, the same player the fired
 *              element uses) + a Preview button; it replays (debounced) after any timing / style change
 *   STYLE      Color (colour input + swatches), Texture (the OmniGallery swatches shown in-panel, or none),
 *              Material (standard / basic / emissive / glass / wireframe / metal) -> payload.style.
 *              A style change is applied LIVE to the current payload (and kept in the draft for the next one).
 *   LIBRARY    Create ammo (adds + makes it current), the list of created payloads: Use (= current ammo),
 *              Edit (loads it into the form; Save changes), Delete.
 *
 * Why the texture swatches are listed here instead of opening OmniGallery in select mode: its
 * omni:gallery-texture-select event is also applied by the Inspector to whatever node is selected, so a
 * pick made for a payload would re-texture the fired-at target. The swatch list is the gallery's own
 * GALLERY_ASSETS (exported in V168), so both stay in sync.
 *
 * Storage: utils/OmniPayloads.js. Events consumed: omni:tool-select / -deselect {hand:'rh', page:'⟐1'},
 * omni:payload-open {section}, omni:panel-restore {id:'omnipayload'}, omni:payload-changed / -current.
 * Events dispatched: omni:payload-panel-state {open, section}, omni:panel-minimized.
 *
 * Standard module contract: constructor / init / update / destroy / onResize.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import {
  listPayloads, getPayload, getCurrentId, getCurrentPayload, addPayload, updatePayload, removePayload, setCurrentPayload,
  TYPES, FUTURE_TYPES, MATERIALS, MAX_STRING, DISPLAY_LIMITS, DISPLAY_DEFAULTS, STYLE_DEFAULTS, sanitizeDisplay,
  CHANGED_EVENT, CURRENT_EVENT,
} from '../utils/OmniPayloads.js'
import { getHandSetting } from '../utils/OmniHandsSettings.js'
import FlowWordPlayer, { injectWordStyles } from '../utils/FlowWordPlayer.js'
import { GALLERY_ASSETS } from '../systems/OmniGallery.js'

export const PANEL_ID = 'omnipayload'
export const TOOL_SECTIONS = { DataTypes: 'datatype', Color: 'color', Texture: 'texture', Material: 'material' }
export const SWATCHES = ['#7fd8ff', '#ffffff', '#ffd166', '#ff6b6b', '#c792ea', '#6ee7a8', '#ff9f43', '#222233']
const PREVIEW_DEBOUNCE_MS = 350

const STYLES = `
.omni-payload-panel {
  pointer-events: auto;
  --opl-bg: var(--omni-theme-bg, rgba(8, 8, 12, 0.94));
  --opl-border: var(--omni-theme-border, rgba(255, 255, 255, 0.12));
  --opl-header-bg: var(--omni-theme-header-bg, rgba(255, 255, 255, 0.04));
  --opl-text: var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --opl-dim: var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --mono: 'Courier New', Courier, monospace;
  position: fixed; top: 96px; right: 240px; width: 352px; max-width: calc(100vw - 16px); max-height: calc(100vh - 96px - 64px);
  display: flex; flex-direction: column; z-index: 61; overflow: hidden;
  background: var(--opl-bg); border: 1px solid var(--opl-border); border-radius: 12px;
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family: var(--mono); color: var(--opl-text); font-size: 10px;
  opacity: 0; visibility: hidden;
}
.opl-header {
  height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative;
  background: var(--opl-header-bg); border-bottom: 1px solid var(--opl-border); cursor: grab; user-select: none; touch-action: none;
}
.opl-title { font-size: 11px; letter-spacing: 0.05em; color: var(--opl-dim); pointer-events: none; }
.opl-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.opl-ctrl {
  width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--opl-border); background: rgba(255,255,255,0.04);
  color: var(--opl-dim); font-size: 11px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;
}
.opl-ctrl:hover { background: rgba(255,255,255,0.12); color: var(--opl-text); }
.opl-body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.opl-section { display: flex; flex-direction: column; gap: 6px; border-radius: 8px; padding: 2px; transition: box-shadow 0.3s; }
.opl-section.is-focus { box-shadow: 0 0 0 1px rgba(255,255,255,0.7), 0 0 14px rgba(255,255,255,0.25); }
.opl-group-title { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--opl-dim); border-bottom: 1px solid var(--opl-border); padding-bottom: 3px; }
.opl-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.opl-row > span:first-child { flex: 1; }
.opl-types { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.opl-btn {
  background: rgba(255,255,255,0.05); border: 1px solid var(--opl-border); color: var(--opl-text); border-radius: 6px;
  padding: 5px 6px; font-family: var(--mono); font-size: 10px; cursor: pointer;
}
.opl-btn:hover:not(:disabled) { background: rgba(255,255,255,0.13); }
.opl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.opl-btn.is-active { background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.7); }
.opl-btn--primary { background: rgba(120,200,255,0.22); border-color: rgba(120,200,255,0.6); }
.opl-input, .opl-text {
  background: rgba(255,255,255,0.06); border: 1px solid var(--opl-border); color: var(--opl-text); border-radius: 5px;
  padding: 4px 6px; font-family: var(--mono); font-size: 11px; box-sizing: border-box; width: 100%;
}
.opl-text { min-height: 54px; resize: vertical; }
.opl-num { width: 64px; flex-shrink: 0; }
.opl-range { flex: 1; min-width: 0; }
.opl-preview {
  position: relative; height: 118px; overflow: hidden; border-radius: 8px; border: 1px dashed var(--opl-border);
  background: rgba(0,0,0,0.25);
}
.opl-preview-anchor { position: absolute; left: 50%; bottom: 10px; width: 0; height: 0; pointer-events: none; }
.opl-preview-hint { position: absolute; left: 8px; top: 6px; font-size: 9px; color: var(--opl-dim); pointer-events: none; }
.opl-swatches { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.opl-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.35); cursor: pointer; padding: 0; }
.opl-swatch.is-active { border-color: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.6); }
.opl-color { width: 34px; height: 24px; padding: 0; border: 1px solid var(--opl-border); background: none; border-radius: 5px; cursor: pointer; }
.opl-tex-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
.opl-tex {
  aspect-ratio: 1; border-radius: 6px; border: 2px solid transparent; background: rgba(255,255,255,0.1) center / cover no-repeat;
  cursor: pointer; padding: 0; font-size: 8px; color: var(--opl-text); font-family: var(--mono);
}
.opl-tex.is-active { border-color: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.6); }
.opl-mats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.opl-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
.opl-item { display: flex; align-items: center; gap: 5px; padding: 4px 6px; border: 1px solid var(--opl-border); border-radius: 6px; background: rgba(255,255,255,0.03); }
.opl-item.is-current { border-color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.1); }
.opl-item-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.5); }
.opl-item-main { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.opl-item-sub { color: var(--opl-dim); font-size: 9px; }
.opl-mini { padding: 2px 6px; font-size: 9px; }
.opl-note { font-size: 9px; color: var(--opl-dim); line-height: 1.45; }
.opl-status { font-size: 9px; color: rgba(150,255,190,0.9); min-height: 12px; }
`

function injectStyles () {
  if (document.getElementById('omni-payload-panel-styles')) return
  const s = document.createElement('style')
  s.id = 'omni-payload-panel-styles'
  s.textContent = STYLES
  document.head.appendChild(s)
}

function el (tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export default class OmniPayloadPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._section = 'datatype'
    this._editingId = null
    this._draft = {
      type: 'string', value: '', name: '',
      display: { ...DISPLAY_DEFAULTS }, style: { ...STYLE_DEFAULTS },
    }
    this._refs = {}
    this._player = null
    this._previewTimer = null
    this._statusTimer = null
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    injectStyles()
    injectWordStyles()
    this._onTool = (e) => {
      const d = e.detail ?? {}
      if (d.hand !== 'rh' || d.page !== '⟐1' || !TOOL_SECTIONS[d.tool]) return
      if (e.type === 'omni:tool-deselect') this.close()
      else this.open(TOOL_SECTIONS[d.tool])
    }
    this._onOpen = (e) => this.open(e.detail?.section)
    this._onRestore = (e) => { if (e.detail?.id === PANEL_ID) this.open() }
    this._onStore = () => {
      const cur = getCurrentPayload()
      if (cur && !this._editingId) this._draft.style = { ...cur.style }   // the style tools always show the current ammo's style
      this._refreshAll()
    }
    window.addEventListener('omni:tool-select', this._onTool)
    window.addEventListener('omni:tool-deselect', this._onTool)
    window.addEventListener('omni:payload-open', this._onOpen)
    window.addEventListener('omni:panel-restore', this._onRestore)
    window.addEventListener(CHANGED_EVENT, this._onStore)
    window.addEventListener(CURRENT_EVENT, this._onStore)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:tool-select', this._onTool)
    window.removeEventListener('omni:tool-deselect', this._onTool)
    window.removeEventListener('omni:payload-open', this._onOpen)
    window.removeEventListener('omni:panel-restore', this._onRestore)
    window.removeEventListener(CHANGED_EVENT, this._onStore)
    window.removeEventListener(CURRENT_EVENT, this._onStore)
    clearTimeout(this._previewTimer); clearTimeout(this._statusTimer)
    this._player?.destroy()
    this._unbindHeader?.()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister(PANEL_ID)
  }

  // ── Open / close / minimize ─────────────────────────────────────────────────

  /** @param {'datatype'|'color'|'texture'|'material'|'library'} [section] focus this section */
  open (section) {
    if (!this._el) { this._el = this._buildDOM(); this._seedDraft() }
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    if (section) this._section = section
    this._refreshAll()
    gsap.killTweensOf(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.25 })
    this._isOpen = true
    WindowManager.bringToFront(PANEL_ID)
    this._focusSection(this._section)
    this._emitState()
    this._queuePreview(0)
  }

  close () {
    if (!this._el) return
    gsap.killTweensOf(this._el)
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { if (!this._isOpen) this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    clearTimeout(this._previewTimer)
    this._player?.stop(true)
    this._emitState()
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { if (!this._isOpen) this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    clearTimeout(this._previewTimer)
    this._player?.stop(true)
    this._emitState()
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: { id: PANEL_ID, label: '⟐Payload', iconLabel: '⟐PL',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' },
    }))
  }

  get isOpen () { return this._isOpen }
  getDraft () { return JSON.parse(JSON.stringify(this._draft)) }

  _emitState () {
    window.dispatchEvent(new CustomEvent('omni:payload-panel-state', { detail: { open: this._isOpen, section: this._section } }))
  }

  /** A fresh draft: blank value, the hand's default word delay, style from the current payload (so edits feel continuous). */
  _seedDraft () {
    const cur = getCurrentPayload()
    this._editingId = null
    this._draft = {
      type: 'string', value: '', name: '',
      display: { ...DISPLAY_DEFAULTS, wordDelayMs: Number(getHandSetting('rh', 'defaultWordDelayMs')) || DISPLAY_DEFAULTS.wordDelayMs },
      style: cur ? { ...cur.style } : { ...STYLE_DEFAULTS },
    }
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────

  _buildDOM () {
    const root = el('div', 'omni-payload-panel')
    root.id = 'omni-payload-panel'
    root.innerHTML = `
      <div class="opl-header">
        <span class="opl-title">⟐Payload · RightHand ammo</span>
        <div class="opl-controls">
          <button class="opl-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="opl-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="opl-body"></div>
    `
    root.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    root.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    const body = root.querySelector('.opl-body')
    this._buildDataSection(body)
    this._buildPreview(body)
    this._buildStyleSections(body)
    this._buildLibrary(body)
    this._bindHeader(root)
    root.dataset.winId = PANEL_ID
    // Own placement (so WindowManager's cascade does not drop it low enough to clip): right side, clear of the pads.
    root.style.top = '96px'
    root.style.left = `${Math.max(8, window.innerWidth - 240 - 352)}px`
    WindowManager.register(PANEL_ID, root, 'Payload')
    WindowManager.watchPanelOpacity(root, () => this._isOpen)
    return root
  }

  _section_(body, name, title) {
    const sec = el('div', 'opl-section')
    sec.dataset.section = name
    sec.appendChild(el('div', 'opl-group-title', title))
    body.appendChild(sec)
    this._refs['sec_' + name] = sec
    return sec
  }

  _buildDataSection (body) {
    const sec = this._section_(body, 'datatype', '1 · Data type')
    const types = el('div', 'opl-types')
    this._refs.typeBtns = {}
    ;[...TYPES, ...FUTURE_TYPES].forEach(t => {
      const b = el('button', 'opl-btn', t[0].toUpperCase() + t.slice(1))
      b.type = 'button'; b.dataset.type = t
      if (FUTURE_TYPES.includes(t)) { b.disabled = true; b.title = `${t} — later`; b.textContent = t[0].toUpperCase() + t.slice(1, 3) + '…' }
      else b.addEventListener('click', () => this._setType(t))
      types.appendChild(b)
      this._refs.typeBtns[t] = b
    })
    sec.appendChild(types)
    sec.appendChild(el('div', 'opl-note', 'Array and Object come later.'))

    // value field (one of three)
    const valWrap = el('div', 'opl-valuewrap')
    const ta = el('textarea', 'opl-text')
    ta.id = 'opl-value-string'; ta.maxLength = MAX_STRING; ta.placeholder = 'The text to send, e.g. "hello world from the right hand"'
    ta.setAttribute('aria-label', 'String value')
    ta.addEventListener('input', () => { this._draft.value = ta.value; this._updateCount(); this._queuePreview() })
    const num = el('input', 'opl-input'); num.type = 'number'; num.step = 'any'; num.id = 'opl-value-number'; num.placeholder = '0'
    num.setAttribute('aria-label', 'Number value')
    num.addEventListener('input', () => { this._draft.value = num.value; this._queuePreview() })
    const boolRow = el('div', 'opl-row'); boolRow.id = 'opl-value-boolean'
    this._refs.boolBtns = {}
    ;['true', 'false'].forEach(v => {
      const b = el('button', 'opl-btn', v); b.type = 'button'; b.dataset.bool = v
      b.addEventListener('click', () => { this._draft.value = v === 'true'; this._syncForm(); this._queuePreview() })
      boolRow.appendChild(b); this._refs.boolBtns[v] = b
    })
    const count = el('div', 'opl-note'); count.id = 'opl-count'
    valWrap.append(ta, num, boolRow, count)
    sec.appendChild(valWrap)
    Object.assign(this._refs, { ta, num, boolRow, count })

    const nameRow = el('div', 'opl-row')
    nameRow.appendChild(el('span', null, 'Name'))
    const name = el('input', 'opl-input'); name.id = 'opl-name'; name.placeholder = '(optional)'; name.maxLength = 40
    name.style.width = '200px'
    name.addEventListener('input', () => { this._draft.name = name.value })
    nameRow.appendChild(name)
    sec.appendChild(nameRow)
    this._refs.name = name

    // word timing
    const timing = el('div', 'opl-timing')
    timing.style.cssText = 'display:flex;flex-direction:column;gap:6px'
    this._refs.timing = timing
    this._refs.words = el('div'); this._refs.words.style.cssText = 'display:flex;flex-direction:column;gap:6px'
    const d = (k) => DISPLAY_LIMITS[k]
    this._rangeRow(this._refs.words, 'Delay between words', 'wordDelayMs', d('wordDelayMs').min, d('wordDelayMs').max, 10, 'ms')
    this._numRow(this._refs.words, 'Max words', 'maxWords', d('maxWords').min, d('maxWords').max, 1, '')
    timing.appendChild(this._refs.words)
    this._numRow(timing, 'Hold (visible)', 'holdMs', d('holdMs').min, d('holdMs').max, 50, 'ms')
    this._numRow(timing, 'Rise distance', 'risePx', d('risePx').min, d('risePx').max, 5, 'px')
    const dirRow = el('div', 'opl-row'); dirRow.appendChild(el('span', null, 'Direction'))
    const dirSel = el('select', 'opl-input'); dirSel.id = 'opl-direction'; dirSel.style.width = '90px'
    ;[['up', 'up'], ['down', 'down']].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; dirSel.appendChild(o) })
    dirSel.addEventListener('change', () => { this._setDisplay({ direction: dirSel.value }) })
    dirRow.appendChild(dirSel); timing.appendChild(dirRow)
    const loopRow = el('label', 'opl-row'); loopRow.appendChild(el('span', null, 'Loop'))
    const loop = el('input'); loop.type = 'checkbox'; loop.id = 'opl-loop'
    loop.addEventListener('change', () => this._setDisplay({ loop: loop.checked }))
    loopRow.appendChild(loop); timing.appendChild(loopRow)
    Object.assign(this._refs, { dirSel, loop })
    const wt = el('div', 'opl-group-title', 'Timing (tooltip words)')
    sec.appendChild(wt)
    sec.appendChild(timing)
    sec.appendChild(el('div', 'opl-note', 'Words are cheap tooltips (they follow ⟐ToolTipSettings). A per-word panel is a documented future switch, not built.'))

    const actions = el('div', 'opl-row')
    const create = el('button', 'opl-btn opl-btn--primary', 'Create ammo'); create.type = 'button'; create.id = 'opl-create'
    create.addEventListener('click', () => this._create())
    const save = el('button', 'opl-btn', 'Save changes'); save.type = 'button'; save.id = 'opl-save'; save.style.display = 'none'
    save.addEventListener('click', () => this._saveEdit())
    const cancel = el('button', 'opl-btn', 'Cancel edit'); cancel.type = 'button'; cancel.id = 'opl-cancel'; cancel.style.display = 'none'
    cancel.addEventListener('click', () => { this._seedDraft(); this._refreshAll(); this._queuePreview(0) })
    actions.append(create, save, cancel)
    sec.appendChild(actions)
    const status = el('div', 'opl-status'); status.id = 'opl-status'; status.setAttribute('role', 'status')
    sec.appendChild(status)
    Object.assign(this._refs, { create, save, cancel, status })
  }

  _rangeRow (parent, label, key, min, max, step, unit) {
    const row = el('div', 'opl-row')
    row.appendChild(el('span', null, label))
    const range = el('input', 'opl-range'); range.type = 'range'; range.min = min; range.max = max; range.step = step
    range.dataset.key = key; range.setAttribute('aria-label', label)
    const num = el('input', 'opl-input opl-num'); num.type = 'number'; num.min = min; num.max = max; num.step = step; num.dataset.key = key + '-num'
    range.addEventListener('input', () => { num.value = range.value; this._setDisplay({ [key]: Number(range.value) }, false) })
    num.addEventListener('change', () => { range.value = num.value; this._setDisplay({ [key]: Number(num.value) }) })
    row.append(range, num, el('span', 'opl-note', unit))
    row.firstChild.style.flex = '0 0 112px'
    parent.appendChild(row)
    this._refs['r_' + key] = { range, num }
  }

  _numRow (parent, label, key, min, max, step, unit) {
    const row = el('div', 'opl-row')
    row.appendChild(el('span', null, label))
    const num = el('input', 'opl-input opl-num'); num.type = 'number'; num.min = min; num.max = max; num.step = step; num.dataset.key = key
    num.addEventListener('change', () => { this._setDisplay({ [key]: Number(num.value) }) })
    row.append(num, el('span', 'opl-note', unit))
    parent.appendChild(row)
    this._refs['n_' + key] = num
  }

  _buildPreview (body) {
    const wrap = el('div', 'opl-section')
    const area = el('div', 'opl-preview'); area.id = 'opl-preview'
    area.appendChild(el('span', 'opl-preview-hint', 'Preview'))
    const anchor = el('div', 'opl-preview-anchor')
    area.appendChild(anchor)
    const btn = el('button', 'opl-btn', '▶ Preview'); btn.type = 'button'; btn.id = 'opl-preview-btn'
    btn.addEventListener('click', () => this.preview())
    wrap.append(area, btn)
    body.appendChild(wrap)
    Object.assign(this._refs, { previewArea: area, previewAnchor: anchor })
  }

  _buildStyleSections (body) {
    // colour
    const col = this._section_(body, 'color', '2 · Color')
    const row = el('div', 'opl-swatches')
    const colorIn = el('input', 'opl-color'); colorIn.type = 'color'; colorIn.id = 'opl-color'; colorIn.setAttribute('aria-label', 'Payload colour')
    colorIn.addEventListener('input', () => this._setStyle({ color: colorIn.value }))
    row.appendChild(colorIn)
    this._refs.swatches = []
    SWATCHES.forEach(c => {
      const b = el('button', 'opl-swatch'); b.type = 'button'; b.style.background = c; b.dataset.color = c; b.title = c
      b.setAttribute('aria-label', `Colour ${c}`)
      b.addEventListener('click', () => this._setStyle({ color: c }))
      row.appendChild(b); this._refs.swatches.push(b)
    })
    col.appendChild(row)
    this._refs.colorIn = colorIn

    // texture
    const tex = this._section_(body, 'texture', '3 · Texture')
    const grid = el('div', 'opl-tex-grid')
    this._refs.texBtns = []
    const none = el('button', 'opl-tex', 'none'); none.type = 'button'; none.dataset.tex = ''; none.title = 'No texture'
    none.addEventListener('click', () => this._setStyle({ textureId: null }))
    grid.appendChild(none); this._refs.texBtns.push(none)
    GALLERY_ASSETS.forEach(a => {
      const b = el('button', 'opl-tex'); b.type = 'button'; b.dataset.tex = a.id; b.title = a.label
      b.style.backgroundImage = `url("${a.path}")`
      b.setAttribute('aria-label', `Texture ${a.label}`)
      b.addEventListener('click', () => this._setStyle({ textureId: a.id }))
      grid.appendChild(b); this._refs.texBtns.push(b)
    })
    tex.appendChild(grid)
    tex.appendChild(el('div', 'opl-note', 'The same swatches as ⟐OmniGallery. The texture multiplies the colour; wireframe ignores it.'))

    // material
    const mat = this._section_(body, 'material', '4 · Material')
    const mg = el('div', 'opl-mats')
    this._refs.matBtns = {}
    MATERIALS.forEach(m => {
      const b = el('button', 'opl-btn', m); b.type = 'button'; b.dataset.material = m
      b.addEventListener('click', () => this._setStyle({ material: m }))
      mg.appendChild(b); this._refs.matBtns[m] = b
    })
    mat.appendChild(mg)
    mat.appendChild(el('div', 'opl-note', 'Applies to the current ammo live; fired flowchart elements take on this style (the display words use the colour).'))
  }

  _buildLibrary (body) {
    const sec = this._section_(body, 'library', 'Library · created ammo')
    const list = el('div', 'opl-list'); list.id = 'opl-list'
    sec.appendChild(list)
    this._refs.list = list
  }

  // ── Behaviour ───────────────────────────────────────────────────────────────

  _setType (t) {
    if (!TYPES.includes(t) || this._draft.type === t) return
    this._draft.type = t
    this._draft.value = t === 'boolean' ? true : ''
    this._syncForm()
    this._queuePreview(0)
  }

  _setDisplay (patch, syncControls = true) {
    this._draft.display = sanitizeDisplay({ ...this._draft.display, ...patch })
    if (syncControls) this._syncForm()
    this._queuePreview()
  }

  /** Style edits go to the draft AND live onto the current payload (spec: style tools edit the current ammo). */
  _setStyle (patch) {
    this._draft.style = { ...this._draft.style, ...patch }
    const cur = getCurrentId()
    if (cur) updatePayload(cur, { style: patch })
    this._syncForm()
    this._queuePreview()
  }

  _draftPayload () {
    const d = this._draft
    return { type: d.type, value: d.type === 'string' || d.type === 'boolean' ? d.value : (d.value === '' ? null : Number(d.value)), name: d.name, display: d.display, style: d.style }
  }

  _create () {
    const p = addPayload(this._draftPayload(), { setCurrent: true })
    if (!p) { this._status('Nothing to create: enter a value (a string needs text, a number must be finite).', true); return }
    this._status(`Created “${p.name}” — it is now the RightHand's ammo.`)
    this._seedAfterCreate(p)
  }

  _seedAfterCreate (p) {
    this._editingId = null
    this._draft = { ...this._draft, value: this._draft.type === 'boolean' ? true : '', name: '', style: { ...p.style } }
    this._refreshAll()
  }

  _saveEdit () {
    if (!this._editingId) return
    const d = this._draftPayload()
    const p = updatePayload(this._editingId, { type: d.type, value: d.value, name: d.name || undefined, display: d.display, style: d.style })
    if (!p) { this._status('Could not save: the value is not valid for this type.', true); return }
    this._status(`Saved “${p.name}”.`)
    this._seedDraft(); this._refreshAll()
  }

  _edit (id) {
    const p = getPayload(id)
    if (!p) return
    this._editingId = id
    this._draft = { type: p.type, value: p.value, name: p.name, display: { ...p.display }, style: { ...p.style } }
    this._section = 'datatype'
    this._refreshAll()
    this._focusSection('datatype')
    this._queuePreview(0)
  }

  _status (msg, bad = false) {
    const s = this._refs.status
    if (!s) return
    s.textContent = msg
    s.style.color = bad ? 'rgba(255,150,150,0.95)' : 'rgba(150,255,190,0.9)'
    clearTimeout(this._statusTimer)
    this._statusTimer = setTimeout(() => { s.textContent = '' }, 3500)
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  _queuePreview (ms = PREVIEW_DEBOUNCE_MS) {
    clearTimeout(this._previewTimer)
    if (!this._isOpen) return
    this._previewTimer = setTimeout(() => this.preview(), ms)
  }

  /** Plays the DRAFT in the preview area (empty draft: a sample sentence so the timing can still be judged). */
  preview () {
    if (!this._el || !this._refs.previewAnchor || !this._isOpen) return false
    const d = this._draft
    const p = this._draftPayload()
    let payload = { ...p }
    const empty = p.type === 'string' ? !String(p.value ?? '').trim() : p.value === null || p.value === ''
    if (empty) payload = { ...p, type: 'string', value: 'hello world from the right hand' }
    this._player?.destroy()
    this._refs.previewAnchor.textContent = ''
    const anchor = this._refs.previewAnchor
    const container = el('div', 'omni-flow-anchor')
    container.style.position = 'absolute'
    anchor.appendChild(container)
    this._player = new FlowWordPlayer({ payload: { ...payload, display: sanitizeDisplay(d.display) }, container })
    return this._player.start()
  }

  // ── Syncing the form with the draft / store ─────────────────────────────────

  _refreshAll () {
    if (!this._el) return
    this._syncForm()
    this._renderList()
  }

  _syncForm () {
    const r = this._refs, d = this._draft
    if (!r.ta) return
    TYPES.forEach(t => r.typeBtns[t].classList.toggle('is-active', d.type === t))
    r.ta.style.display = d.type === 'string' ? '' : 'none'
    r.num.style.display = d.type === 'number' ? '' : 'none'
    r.boolRow.style.display = d.type === 'boolean' ? '' : 'none'
    r.count.style.display = d.type === 'string' ? '' : 'none'
    if (d.type === 'string' && document.activeElement !== r.ta) r.ta.value = String(d.value ?? '')
    if (d.type === 'number' && document.activeElement !== r.num) r.num.value = d.value === null ? '' : String(d.value)
    r.boolBtns.true.classList.toggle('is-active', d.value === true)
    r.boolBtns.false.classList.toggle('is-active', d.value === false)
    this._updateCount()
    if (document.activeElement !== r.name) r.name.value = d.name ?? ''
    r.words.style.display = d.type === 'string' ? 'flex' : 'none'
    const disp = d.display
    ;['wordDelayMs'].forEach(k => {
      const rr = r['r_' + k]
      rr.range.value = String(disp[k])
      if (document.activeElement !== rr.num) rr.num.value = String(disp[k])
    })
    ;['maxWords', 'holdMs', 'risePx'].forEach(k => { if (document.activeElement !== r['n_' + k]) r['n_' + k].value = String(disp[k]) })
    r.dirSel.value = disp.direction
    r.loop.checked = !!disp.loop
    // style
    r.colorIn.value = d.style.color
    r.swatches.forEach(b => b.classList.toggle('is-active', b.dataset.color.toLowerCase() === d.style.color))
    r.texBtns.forEach(b => b.classList.toggle('is-active', (b.dataset.tex || null) === (d.style.textureId ?? null)))
    MATERIALS.forEach(m => r.matBtns[m].classList.toggle('is-active', d.style.material === m))
    // edit mode buttons
    const editing = !!this._editingId
    r.create.style.display = editing ? 'none' : ''
    r.save.style.display = editing ? '' : 'none'
    r.cancel.style.display = editing ? '' : 'none'
  }

  _updateCount () {
    const r = this._refs
    if (!r.count) return
    const len = String(this._draft.value ?? '').length
    const words = String(this._draft.value ?? '').trim().split(/\s+/).filter(Boolean).length
    r.count.textContent = `${len}/${MAX_STRING} characters · ${words} word${words === 1 ? '' : 's'}`
  }

  _renderList () {
    const list = this._refs.list
    if (!list) return
    const cur = getCurrentId()
    const items = listPayloads()
    list.textContent = ''
    if (!items.length) { list.appendChild(el('div', 'opl-note', 'No ammo yet. Pick a data type, type a value, press Create ammo.')); return }
    items.forEach(p => {
      const row = el('div', 'opl-item' + (p.id === cur ? ' is-current' : ''))
      row.dataset.id = p.id
      const dot = el('span', 'opl-item-dot'); dot.style.background = p.style.color
      const main = el('div', 'opl-item-main')
      main.appendChild(document.createTextNode((p.id === cur ? '● ' : '') + p.name))
      const sub = el('div', 'opl-item-sub', `${p.type} · ${String(p.value).slice(0, 40)}`)
      main.appendChild(sub)
      const use = el('button', 'opl-btn opl-mini', p.id === cur ? 'current' : 'Use'); use.type = 'button'; use.dataset.action = 'use'
      use.disabled = p.id === cur
      use.addEventListener('click', () => { setCurrentPayload(p.id); this._draft.style = { ...p.style }; this._refreshAll(); this._queuePreview(0) })
      const edit = el('button', 'opl-btn opl-mini', 'Edit'); edit.type = 'button'; edit.dataset.action = 'edit'
      edit.addEventListener('click', () => this._edit(p.id))
      const del = el('button', 'opl-btn opl-mini', '✕'); del.type = 'button'; del.dataset.action = 'delete'; del.title = 'Delete'
      del.setAttribute('aria-label', `Delete ${p.name}`)
      del.addEventListener('click', () => { if (this._editingId === p.id) this._seedDraft(); removePayload(p.id); this._refreshAll() })
      row.append(dot, main, use, edit, del)
      list.appendChild(row)
    })
  }

  _focusSection (name) {
    const sec = this._refs['sec_' + name]
    if (!sec) return
    Object.keys(this._refs).filter(k => k.startsWith('sec_')).forEach(k => this._refs[k].classList.remove('is-focus'))
    sec.classList.add('is-focus')
    try { sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } catch (_) {}
    clearTimeout(this._focusTimer)
    this._focusTimer = setTimeout(() => sec.classList.remove('is-focus'), 1400)
  }

  // ── Dragging (same as the other settings panels) ────────────────────────────

  _bindHeader (root) {
    const header = root.querySelector('.opl-header')
    const drag = { active: false }
    const pt = (e) => ({ x: e.touches?.[0]?.clientX ?? e.clientX, y: e.touches?.[0]?.clientY ?? e.clientY })
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const { x, y } = pt(e)
      const rect = root.getBoundingClientRect()
      drag.active = true; drag.startX = x; drag.startY = y; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const { x, y } = pt(e)
      gsap.set(root, { left: drag.originX + (x - drag.startX), top: drag.originY + (y - drag.startY), right: 'auto' })
    }
    const onUp = () => { drag.active = false }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    this._unbindHeader = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }
}
