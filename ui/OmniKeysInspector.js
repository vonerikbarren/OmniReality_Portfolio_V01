/**
 * ui/OmniKeysInspector.js — ⟐mniReality OmniKeys Inspector
 *
 * OmniKeys' own dedicated Inspector (per the design brief — "I would
 * like OmniKeys to have its own inspector"), rather than a section
 * folded into the main OmniInspector. Opens when a key is clicked in
 * ui/OmniKeys.js, in either Edit or Sequence mode.
 *
 * Fields, this pass:
 *   - Title (identifying label shown on the key itself)
 *   - String (the plain-text macro value — what Delivery mode actually
 *     uses to build a Dimensional Text node)
 *   - Sequence Start / Sequence End (font size, case, opacity, color) —
 *     see DIMENSIONAL_TEXT_DESIGN.md. Fields only in this pass; the
 *     actual start→end transformation playback is future work.
 *
 * Edits flow back to ui/OmniKeys.js via omni:omnikeys-key-updated so
 * the grid's own key label and persisted storage both stay in sync —
 * this panel doesn't own storage itself.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { classifyChar, defaultKeyData } from './OmniKeys.js'

const STYLES = /* css */`

.omni-keys-inspector-panel {
  --oki-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oki-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oki-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oki-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --oki-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --oki-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --oki-accent      : var(--omni-theme-accent, #c9a3ff);
  --mono            : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  right            : 90px;
  width            : 300px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 520px;
  min-height       : 320px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--oki-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--oki-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--oki-text);
  z-index          : 62;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.oki-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oki-header-bg);
  border-bottom    : 1px solid var(--oki-border);
  cursor           : grab;
  user-select      : none;
}
.oki-header.is-dragging { cursor: grabbing; }
.oki-title {
  position         : absolute;
  left             : 14px;
  font-size        : 11px;
  letter-spacing   : 0.06em;
  color            : var(--oki-text-dim);
}
.oki-controls { display: flex; align-items: center; gap: 8px; }
.oki-ctrl {
  width            : 22px; height: 22px;
  border-radius    : 6px;
  border           : 1px solid var(--oki-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--oki-text-dim);
  font-size        : 10px;
  display          : flex; align-items: center; justify-content: center;
  cursor           : pointer;
}
.oki-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--oki-text); }
.oki-ctrl--save { color: rgba(140, 255, 180, 0.85); border-color: rgba(140, 255, 180, 0.22); }
.oki-ctrl--save:hover { background: rgba(140, 255, 180, 0.14); border-color: rgba(140, 255, 180, 0.35); }
.oki-ctrl--save.is-saved { background: rgba(140, 255, 180, 0.22); border-color: rgba(140, 255, 180, 0.5); }
.oki-ctrl--reset { color: rgba(255, 140, 140, 0.7); border-color: rgba(255, 140, 140, 0.18); }
.oki-ctrl--reset:hover { background: rgba(255, 100, 100, 0.14); border-color: rgba(255, 100, 100, 0.35); color: rgba(255, 160, 160, 1); }

.oki-notify-banner {
  flex-shrink      : 0;
  max-height       : 0;
  overflow         : hidden;
  display          : flex; align-items: center; justify-content: center;
  font-size        : 9px;
  transition       : max-height 0.2s ease, padding 0.2s ease;
  color            : rgba(160, 255, 195, 0.95);
  background       : rgba(140, 255, 180, 0.10);
}
.oki-notify-banner.is-visible { max-height: 24px; padding: 5px; }

.oki-empty {
  flex             : 1;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  color            : var(--oki-text-muted);
  font-size        : 10px;
  text-align       : center;
  padding          : 20px;
}

.oki-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: none; }
.oki-body.is-visible { display: block; }

.oki-key-badge {
  font-size        : 9px;
  letter-spacing   : 0.08em;
  text-transform   : uppercase;
  color            : var(--oki-text-muted);
  margin-bottom    : 8px;
}

.oki-field { margin-bottom: 10px; }
.oki-field-label {
  display          : block;
  font-size        : 9px;
  letter-spacing   : 0.08em;
  text-transform   : uppercase;
  color            : var(--oki-text-muted);
  margin-bottom    : 4px;
}
.oki-input, .oki-textarea, .oki-select {
  width            : 100%;
  background       : var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border           : 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius    : 5px;
  color            : var(--oki-text);
  font-family      : var(--mono);
  font-size        : 10.5px;
  padding          : 5px 7px;
  box-sizing       : border-box;
}
.oki-textarea { min-height: 50px; resize: vertical; }

.oki-section-title {
  font-size        : 9.5px;
  letter-spacing   : 0.08em;
  text-transform   : uppercase;
  color            : var(--oki-accent);
  margin           : 14px 0 6px;
  padding-top      : 8px;
  border-top       : 1px solid rgba(255,255,255,0.06);
}
.oki-section-title.is-focused { text-shadow: 0 0 8px rgba(201, 163, 255, 0.6); }

.oki-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.oki-row-label { width: 60px; flex-shrink: 0; font-size: 9.5px; color: var(--oki-text-muted); }
.oki-range { flex: 1; accent-color: var(--oki-accent); }
.oki-range-val { width: 30px; text-align: right; font-size: 9px; color: var(--oki-text-dim); }
.oki-color { width: 30px; height: 22px; padding: 0; border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18)); border-radius: 4px; background: none; cursor: pointer; }

.oki-resize-handle {
  position         : absolute; right: 0; bottom: 0;
  width            : 16px; height: 16px;
  cursor           : nwse-resize;
}
.oki-resize-handle::before {
  content          : '';
  position         : absolute; right: 3px; bottom: 3px;
  width            : 8px; height: 8px;
  border-right     : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom    : 2px solid rgba(255, 255, 255, 0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-keys-inspector-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-keys-inspector-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniKeysInspector {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._index = null
    this._data = null
    this._saveTimer = null
    this._bannerTimer = null
    this._onInspectRequest = null
  }

  init () {
    injectStyles()
    this._onInspectRequest = (e) => {
      const { index, keyData, focusMode } = e.detail ?? {}
      if (index == null) return
      this._index = index
      this._data = structuredClone(keyData)
      this.open()
      this._render(focusMode)
    }
    window.addEventListener('omni:omnikeys-inspect-request', this._onInspectRequest)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:omnikeys-inspect-request', this._onInspectRequest)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnikeysinspector')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
  }

  // ── DOM shell ────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-keys-inspector-panel'
    el.innerHTML = /* html */`
      <div class="oki-header">
        <span class="oki-title">⟐OmniKeys Inspector</span>
        <div class="oki-controls">
          <button class="oki-ctrl oki-ctrl--save" data-action="save" title="Save now">💾</button>
          <button class="oki-ctrl oki-ctrl--reset" data-action="reset" title="Reset this key to its default">🗑</button>
          <button class="oki-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oki-notify-banner" id="oki-notify-banner"></div>
      <div class="oki-empty" id="oki-empty">Click a key in ⟐OmniKeys to edit it here.</div>
      <div class="oki-body" id="oki-body"></div>
      <div class="oki-resize-handle" aria-hidden="true"></div>
    `
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="save"]').addEventListener('click', (e) => this._explicitSave(e.currentTarget))
    el.querySelector('[data-action="reset"]').addEventListener('click', () => this._resetKey())

    el.dataset.winId = 'omnikeysinspector'
    WindowManager.register('omnikeysinspector', el, 'OmniKeys Inspector')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  _render (focusMode) {
    if (!this._el || !this._data) return
    this._el.querySelector('#oki-empty').style.display = 'none'
    const body = this._el.querySelector('#oki-body')
    body.classList.add('is-visible')

    const seqFields = (prefix, seq) => /* html */`
      <div class="oki-row">
        <span class="oki-row-label">Font Size</span>
        <input type="range" class="oki-range" data-seq="${prefix}" data-key="fontSize" min="0.2" max="4" step="0.05" value="${seq.fontSize}">
        <span class="oki-range-val" data-seq-val="${prefix}-fontSize">${Number(seq.fontSize).toFixed(2)}</span>
      </div>
      <div class="oki-row">
        <span class="oki-row-label">Case</span>
        <select class="oki-select" data-seq="${prefix}" data-key="case">
          ${['none', 'upper', 'lower', 'capitalize'].map(c => `<option value="${c}" ${seq.case === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="oki-row">
        <span class="oki-row-label">Opacity</span>
        <input type="range" class="oki-range" data-seq="${prefix}" data-key="opacity" min="0" max="1" step="0.05" value="${seq.opacity}">
        <span class="oki-range-val" data-seq-val="${prefix}-opacity">${Number(seq.opacity).toFixed(2)}</span>
      </div>
      <div class="oki-row">
        <span class="oki-row-label">Color</span>
        <input type="color" class="oki-color" data-seq="${prefix}" data-key="color" value="${seq.color}">
      </div>
    `

    body.innerHTML = /* html */`
      <div class="oki-key-badge">Key #${this._index}</div>

      <div class="oki-field">
        <label class="oki-field-label">Title</label>
        <input type="text" class="oki-input" id="oki-title" value="${this._data.title}">
      </div>

      <div class="oki-field">
        <label class="oki-field-label">String (macro value)</label>
        <textarea class="oki-textarea" id="oki-string">${this._data.string}</textarea>
      </div>

      <div class="oki-section-title ${focusMode === 'Sequence' ? 'is-focused' : ''}">Sequence — Start</div>
      ${seqFields('start', this._data.sequenceStart)}

      <div class="oki-section-title ${focusMode === 'Sequence' ? 'is-focused' : ''}">Sequence — End</div>
      ${seqFields('end', this._data.sequenceEnd)}
    `

    if (focusMode === 'Sequence') {
      body.querySelector('.oki-section-title')?.scrollIntoView?.({ block: 'start' })
    }

    this._wireFields(body)
  }

  _wireFields (body) {
    body.querySelector('#oki-title')?.addEventListener('input', (e) => {
      this._data.title = e.target.value
      this._commit()
    })
    body.querySelector('#oki-string')?.addEventListener('input', (e) => {
      this._data.string = e.target.value
      this._data.classType = classifyChar(e.target.value.trim()[0] ?? '')
      this._commit()
    })

    body.querySelectorAll('[data-seq]').forEach(input => {
      input.addEventListener('input', (e) => {
        const prefix = input.dataset.seq
        const key = input.dataset.key
        const seqKey = prefix === 'start' ? 'sequenceStart' : 'sequenceEnd'
        const value = input.type === 'range' ? Number(e.target.value) : e.target.value

        this._data[seqKey][key] = value

        const valEl = body.querySelector(`[data-seq-val="${prefix}-${key}"]`)
        if (valEl) valEl.textContent = Number(value).toFixed(2)

        this._commit()
      })
    })
  }

  /** Debounced — pushes the edited key back to ui/OmniKeys.js (which
   *  owns persistence) and flashes a save confirmation, same pattern
   *  as the main Inspector's notify banner. */
  _commit () {
    clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('omni:omnikeys-key-updated', {
        detail: { index: this._index, keyData: this._data }
      }))
      this._flashBanner()
    }, 200)
  }

  _flashBanner (text = '✓ Saved') {
    const banner = this._el?.querySelector('#oki-notify-banner')
    if (!banner) return
    banner.textContent = text
    banner.classList.add('is-visible')
    clearTimeout(this._bannerTimer)
    this._bannerTimer = setTimeout(() => banner.classList.remove('is-visible'), 1400)
  }

  /** Explicit save button — everything already autosaves on a 200ms
   *  debounce, so this mostly matters for flushing immediately +
   *  giving the same visible confirmation Admin/OmniInspector's save
   *  buttons give, rather than only relying on the debounce. */
  _explicitSave (btn) {
    if (this._index == null) return
    clearTimeout(this._saveTimer)
    window.dispatchEvent(new CustomEvent('omni:omnikeys-key-updated', {
      detail: { index: this._index, keyData: this._data }
    }))
    this._flashBanner('✓ Saved')
    btn?.classList.add('is-saved')
    setTimeout(() => btn?.classList.remove('is-saved'), 500)
  }

  /** The "trash" equivalent for a fixed 128-key grid — keys can't be
   *  removed the way a scene node can, so this resets the currently
   *  selected key back to its default title/string/sequence instead. */
  _resetKey () {
    if (this._index == null) return
    this._data = defaultKeyData(this._index)
    this._render(null)
    window.dispatchEvent(new CustomEvent('omni:omnikeys-key-updated', {
      detail: { index: this._index, keyData: this._data }
    }))
    this._flashBanner('↺ Reset to default')
  }

  // ── Header drag / resize ─────────────────────────────────────────────────

  _bindHeader (el) {
    const header = el.querySelector('.oki-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top: this._drag.originY + (cy - this._drag.startY) })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }

    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.oki-resize-handle')
    if (!handle) return
    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy
      resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
