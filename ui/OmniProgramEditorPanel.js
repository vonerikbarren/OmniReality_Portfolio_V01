/**
 * ui/OmniProgramEditorPanel.js — ⟐OmniProgram Editor (the growing IDE)
 *
 * The dedicated home for the Program feature. The Inspector's own
 * "▶ Program" section (systems/OmniInspector.js) is the quick editor
 * — this panel is the same real data, in its own space, meant to grow
 * (per direct request: "slowly build the coolest ide this way"). For
 * now it's the same command-dropdown-per-step editor as the
 * Inspector's quick version, just roomier, plus the same
 * ⟐OmniBegin(Program) run button. Includes the Group step — a step
 * whose body is its own nested, reorderable step list (recursively,
 * including further Groups) — as the first real "middle zone" toward
 * the eventual full IDE, per direct request. See
 * systems/OmniProgramCommands.js's header comment for the data model
 * and depth cap.
 *
 * Follows the exact same real, working pattern as
 * ui/OmniInternalPanel.js: this panel never touches localStorage
 * itself. Saving here dispatches omni:node-program-set, which
 * systems/OmniInspector.js listens for and does the actual,
 * unconditional persist (STORE_PREFIX + nodeId) — so the Inspector's
 * own in-memory copy stays in sync if the same node happens to be
 * loaded there too, and there's exactly one real place this data is
 * written, not two competing ones.
 *
 * Event contract:
 *   omni:program-panel-open-request   { id, label, program }
 *     — dispatched by OmniInspector's "Open Full Editor ⟐" button
 *   omni:node-program-set             { id, program }
 *     — dispatched by this panel's Save button; OmniInspector.js
 *       listens for this and does the actual localStorage write
 *
 * Running a program here looks the mesh up live via
 * omniNode.getMeshById(id) rather than requiring one be handed in at
 * open-time, so the run button still works if this panel is left open
 * after the Inspector's own selection has moved on to something else.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { defaultStep, stepRowHTML, runProgram, resolveStepPath } from '../systems/OmniProgramCommands.js'

const STYLES = /* css */`

.omni-program-editor {
  --ope-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ope-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ope-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ope-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --ope-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --ope-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --ope-accent      : var(--omni-theme-accent, #ffee00);
  --mono            : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 100px;
  right            : 90px;
  width            : 360px;
  min-width        : 300px;
  max-width        : 92vw;
  height           : 520px;
  min-height       : 340px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ope-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ope-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ope-text);
  z-index          : 62;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.ope-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ope-header-bg);
  border-bottom    : 1px solid var(--ope-border);
  cursor           : grab;
  user-select      : none;
}
.ope-header.is-dragging { cursor: grabbing; }
.ope-title { position: absolute; left: 14px; font-size: 11px; letter-spacing: 0.06em; color: var(--ope-text-dim); }
.ope-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.ope-ctrl {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--ope-border);
  background: rgba(255,255,255,0.04);
  color: var(--ope-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ope-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--ope-text); }
.ope-ctrl--save { color: rgba(140, 255, 180, 0.9); border-color: rgba(140, 255, 180, 0.25); }
.ope-ctrl--save:hover { background: rgba(140, 255, 180, 0.14); }
.ope-ctrl--save.is-saved { background: rgba(140, 255, 180, 0.3); }

.ope-unsaved-banner {
  flex-shrink: 0; display: none; align-items: center; justify-content: center; gap: 6px;
  padding: 6px; font-size: 9.5px; color: rgba(255, 200, 140, 0.95);
  background: rgba(255, 180, 100, 0.12); border-bottom: 1px solid rgba(255, 180, 100, 0.2);
}
.ope-unsaved-banner.is-visible { display: flex; }

.ope-saved-banner {
  flex-shrink: 0; max-height: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center; font-size: 9px;
  color: rgba(160, 255, 195, 0.95); background: rgba(140, 255, 180, 0.10);
  transition: max-height 0.2s ease, padding 0.2s ease;
}
.ope-saved-banner.is-visible { max-height: 22px; padding: 5px; }

.ope-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--ope-text-muted); font-size: 10px; text-align: center; padding: 20px; }

.ope-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: none; flex-direction: column; gap: 10px; }
.ope-body.is-visible { display: flex; }

.ope-node-badge { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ope-text-muted); }

.ope-enabled-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ope-enabled-label { font-size: 10px; color: var(--ope-text-dim); }
.ope-note { font-size: 9px; color: var(--ope-text-muted); line-height: 1.5; }

/* Step editor — same class names/markup as OmniInspector.js's quick
   Program section, so both really are the same editor experience. */
.ope-steps { display: flex; flex-direction: column; gap: 8px; }
.oi-program-empty { font-size: 9.5px; color: rgba(255,255,255,0.35); padding: 8px 2px; text-align: center; }
.op-step { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; padding: 7px 8px; }
.op-step-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.op-step-num { font-size: 9px; color: rgba(255,255,255,0.4); width: 14px; }
.op-step-cmd { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16); border-radius: 5px; color: #fff; font-size: 9.5px; font-family: inherit; padding: 3px 4px; }
.op-step-del { background: none; border: none; color: rgba(255,255,255,0.3); font-size: 10.5px; cursor: pointer; padding: 0 2px; }
.op-step-del:hover { color: rgba(255,120,120,0.85); }
.op-step-fields { display: flex; flex-wrap: wrap; gap: 6px; }
.op-field { display: flex; flex-direction: column; gap: 2px; flex: 1 1 70px; min-width: 64px; }
.op-field-label { font-size: 8px; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
.op-field-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16); border-radius: 4px; color: #fff; font-size: 9.5px; font-family: inherit; padding: 3px 5px; width: 100%; box-sizing: border-box; }

/* Group step — same recursive op-step markup, indented. Matches
   systems/OmniInspector.js's copy of these same rules. */
.op-step--group { border-color: rgba(255, 238, 0, 0.18); }
.op-step-collapse { background: none; border: none; color: rgba(255,255,255,0.45); font-size: 10px; cursor: pointer; padding: 0 2px; width: 12px; }
.op-step-collapse:hover { color: #fff; }
.op-group-body { margin: 6px 0 2px 14px; padding: 8px 0 0 10px; border-left: 2px solid rgba(255, 238, 0, 0.16); display: flex; flex-direction: column; gap: 8px; }
.op-group-steps { display: flex; flex-direction: column; gap: 8px; }
.op-step-add-nested { align-self: flex-start; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); color: rgba(255,255,255,0.75); border-radius: 5px; font-family: inherit; font-size: 9px; padding: 4px 8px; cursor: pointer; }
.op-step-add-nested:hover { background: rgba(255,255,255,0.1); }

.ope-row { display: flex; gap: 8px; }
.ope-btn {
  flex: 1; background: rgba(140, 255, 180, 0.1); border: 1px solid rgba(140, 255, 180, 0.3);
  color: rgba(160, 255, 195, 0.95); border-radius: 6px; padding: 6px 10px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer; text-align: center;
}
.ope-btn:hover { background: rgba(140, 255, 180, 0.18); }
.ope-btn-begin {
  background: rgba(255, 238, 0, 0.12); border-color: rgba(255, 238, 0, 0.35); color: #ffee00;
  font-size: 11px; padding: 9px;
}
.ope-btn-begin:hover { background: rgba(255, 238, 0, 0.2); }
.ope-btn-begin:disabled { opacity: 0.35; cursor: not-allowed; }
.ope-btn-begin.is-running { background: rgba(255, 90, 90, 0.14); border-color: rgba(255, 90, 90, 0.4); color: rgba(255, 140, 140, 0.95); }
.ope-btn-begin.is-running:hover { background: rgba(255, 90, 90, 0.22); }

.ope-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.ope-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}
`

function injectStyles () {
  if (document.getElementById('omni-program-editor-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-program-editor-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniProgramEditorPanel {
  constructor (context, omniNode) {
    this.ctx = context
    this.omniNode = omniNode
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    this._nodeId = null
    this._nodeLabel = ''
    this._saved = { enabled: false, steps: [], autoPersist: false, repeat: 'once' }
    this._staged = { enabled: false, steps: [], autoPersist: false, repeat: 'once' }
    this._onOpenRequest = null
    this._runningTimeline = null
  }

  init () {
    injectStyles()
    this._onOpenRequest = (e) => {
      const { id, label, program } = e.detail ?? {}
      if (!id) return
      this._nodeId = id
      this._nodeLabel = label ?? id
      this._saved = {
        enabled: !!program?.enabled,
        steps: Array.isArray(program?.steps) ? program.steps : [],
        autoPersist: !!program?.autoPersist,
        repeat: program?.repeat === 'infinite' ? 'infinite' : 'once',
      }
      this._staged = structuredClone(this._saved)
      this.open()
      this._render()
    }
    window.addEventListener('omni:program-panel-open-request', this._onOpenRequest)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:program-panel-open-request', this._onOpenRequest)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniprogrameditor')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-program-editor'
    el.innerHTML = /* html */`
      <div class="ope-header">
        <span class="ope-title">⟐ Program Editor</span>
        <div class="ope-controls">
          <button class="ope-ctrl ope-ctrl--save" data-action="save" title="Save">💾</button>
          <button class="ope-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ope-unsaved-banner" id="ope-unsaved-banner">⚠ Unsaved changes — click 💾 to apply</div>
      <div class="ope-saved-banner" id="ope-saved-banner"></div>
      <div class="ope-empty" id="ope-empty">Open a node's Inspector, expand ▶ Program, and click "Open Full Editor ⟐".</div>
      <div class="ope-body" id="ope-body"></div>
      <div class="ope-resize-handle" aria-hidden="true"></div>
    `
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="save"]').addEventListener('click', () => this._save())

    el.dataset.winId = 'omniprogrameditor'
    WindowManager.register('omniprogrameditor', el, 'Program Editor')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _render () {
    if (!this._el) return
    this._el.querySelector('#ope-empty').style.display = 'none'
    const body = this._el.querySelector('#ope-body')
    body.classList.add('is-visible')

    body.innerHTML = /* html */`
      <div class="ope-node-badge">Node: ${this._nodeLabel} (${this._nodeId})</div>

      <div class="ope-enabled-row">
        <span class="ope-enabled-label">Program Enabled</span>
        <label class="op-field" style="flex:0 0 auto">
          <input type="checkbox" id="ope-enabled" ${this._staged.enabled ? 'checked' : ''}>
        </label>
      </div>
      <div class="ope-note">
        Move / Rotate / Scale genuinely tween this object; Communicate /
        Notify push through the real ⟐OmniNotify pipeline. Group bundles
        an ordered set of steps — including further Groups — into one
        container, run in order like any other step. Running a program
        plays it live — it won't overwrite this object's saved
        transform. This is the same data as the Inspector's own
        "▶ Program" section — saving here saves for real, no need to
        also save there.
      </div>

      <div class="ope-steps" id="ope-steps">
        ${this._staged.steps.length ? this._staged.steps.map((s, i) => stepRowHTML(s, i)).join('') : '<div class="oi-program-empty">No steps yet — add one below.</div>'}
      </div>

      <div class="ope-row">
        <button class="ope-btn" id="ope-add-step">+ Add Step</button>
        <button class="ope-btn" id="ope-add-group">+ Add Group</button>
      </div>

      <div class="ope-enabled-row">
        <span class="ope-enabled-label">Run Mode</span>
        <select class="op-step-cmd" id="ope-repeat" style="flex:0 0 140px">
          <option value="once" ${this._staged.repeat === 'once' ? 'selected' : ''}>Once</option>
          <option value="infinite" ${this._staged.repeat === 'infinite' ? 'selected' : ''}>Infinite (loop)</option>
        </select>
      </div>
      <div class="ope-enabled-row">
        <span class="ope-enabled-label">Auto-Persist (save end state)</span>
        <label class="op-field" style="flex:0 0 auto">
          <input type="checkbox" id="ope-autopersist" ${this._staged.autoPersist ? 'checked' : ''}>
        </label>
      </div>

      <button class="ope-btn ope-btn-begin" id="ope-begin" ${this._staged.steps.length ? '' : 'disabled'}>⟐OmniBegin(Program)</button>
    `

    this._wireBody()
  }

  _wireBody () {
    const body = this._el.querySelector('#ope-body')

    body.querySelector('#ope-enabled')?.addEventListener('change', (e) => {
      this._staged.enabled = e.target.checked
      this._markUnsaved()
    })

    // Steps can now nest (Group), so every row is addressed by its
    // dotted-index path ("0", "0.2", "0.2.1", ...) via
    // resolveStepPath() rather than a flat array index — same scheme
    // as systems/OmniInspector.js's quick editor, since both share
    // this exact row markup/behavior.
    const wireStepRows = () => {
      body.querySelectorAll('.op-step-cmd').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const hit = resolveStepPath(this._staged.steps, sel.dataset.path)
          if (!hit) return
          hit.arr[hit.index] = defaultStep(e.target.value)
          this._markUnsaved()
          rerenderSteps()
        })
      })
      body.querySelectorAll('.op-field-input').forEach(input => {
        input.addEventListener('input', (e) => {
          const hit = resolveStepPath(this._staged.steps, input.dataset.path)
          if (!hit) return
          const step = hit.arr[hit.index]
          const field = input.dataset.field
          step[field] = input.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value
          this._markUnsaved()
        })
      })
      body.querySelectorAll('.op-step-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const hit = resolveStepPath(this._staged.steps, btn.dataset.path)
          if (!hit) return
          hit.arr.splice(hit.index, 1)
          this._markUnsaved()
          rerenderSteps()
        })
      })
      body.querySelectorAll('.op-step-collapse').forEach(btn => {
        btn.addEventListener('click', () => {
          const hit = resolveStepPath(this._staged.steps, btn.dataset.path)
          if (!hit) return
          const step = hit.arr[hit.index]
          step.collapsed = !step.collapsed
          this._markUnsaved()
          rerenderSteps()
        })
      })
      body.querySelectorAll('.op-step-add-nested').forEach(btn => {
        btn.addEventListener('click', () => {
          const hit = resolveStepPath(this._staged.steps, btn.dataset.groupPath)
          if (!hit) return
          const group = hit.arr[hit.index]
          if (!Array.isArray(group.steps)) group.steps = []
          group.steps.push(defaultStep('move'))
          this._markUnsaved()
          rerenderSteps()
        })
      })
    }

    const rerenderSteps = () => {
      const container = body.querySelector('#ope-steps')
      if (container) {
        container.innerHTML = this._staged.steps.length
          ? this._staged.steps.map((s, i) => stepRowHTML(s, i)).join('')
          : '<div class="oi-program-empty">No steps yet — add one below.</div>'
      }
      const beginBtn = body.querySelector('#ope-begin')
      if (beginBtn) beginBtn.disabled = this._staged.steps.length === 0
      wireStepRows()
    }
    wireStepRows()

    body.querySelector('#ope-add-step')?.addEventListener('click', () => {
      this._staged.steps.push(defaultStep('move'))
      this._markUnsaved()
      rerenderSteps()
    })

    body.querySelector('#ope-add-group')?.addEventListener('click', () => {
      this._staged.steps.push(defaultStep('group'))
      this._markUnsaved()
      rerenderSteps()
    })

    body.querySelector('#ope-repeat')?.addEventListener('change', (e) => {
      this._staged.repeat = e.target.value
      this._markUnsaved()
    })
    body.querySelector('#ope-autopersist')?.addEventListener('change', (e) => {
      this._staged.autoPersist = e.target.checked
      this._markUnsaved()
    })

    const beginBtn = body.querySelector('#ope-begin')
    beginBtn?.addEventListener('click', () => {
      if (this._runningTimeline && this._runningTimeline.isActive()) {
        this._runningTimeline.kill()
        this._runningTimeline = null
        beginBtn.textContent = '⟐OmniBegin(Program)'
        beginBtn.classList.remove('is-running')
        this._playSound('click')
        return
      }
      const mesh = this.omniNode?.getMeshById?.(this._nodeId)
      if (!mesh || this._staged.steps.length === 0) return
      this._runningTimeline = runProgram(mesh, this._staged.steps, this._nodeLabel, {
        repeat: this._staged.repeat, autoPersist: this._staged.autoPersist, nodeId: this._nodeId,
      })
      beginBtn.textContent = '⟐ Stop'
      beginBtn.classList.add('is-running')
      this._runningTimeline.eventCallback('onComplete', () => {
        this._runningTimeline = null
        beginBtn.textContent = '⟐OmniBegin(Program)'
        beginBtn.classList.remove('is-running')
      })
      this._playSound('click')
    })
  }

  _markUnsaved () {
    this._el?.querySelector('#ope-unsaved-banner')?.classList.add('is-visible')
  }

  /** The ONLY place a change actually takes effect — persists
   *  immediately and unconditionally (via OmniInspector.js's
   *  omni:node-program-set listener, which owns the real localStorage
   *  write), so the person doesn't need to also save in the Inspector
   *  for this to stick. */
  _save () {
    if (!this._nodeId) return
    this._saved = structuredClone(this._staged)

    window.dispatchEvent(new CustomEvent('omni:node-program-set', {
      detail: { id: this._nodeId, program: this._saved }
    }))

    this._el?.querySelector('#ope-unsaved-banner')?.classList.remove('is-visible')

    const savedBanner = this._el?.querySelector('#ope-saved-banner')
    if (savedBanner) {
      savedBanner.textContent = '✓ Saved'
      savedBanner.classList.add('is-visible')
      clearTimeout(this._savedBannerTimer)
      this._savedBannerTimer = setTimeout(() => savedBanner.classList.remove('is-visible'), 1400)
    }

    const saveBtn = this._el?.querySelector('[data-action="save"]')
    saveBtn?.classList.add('is-saved')
    setTimeout(() => saveBtn?.classList.remove('is-saved'), 500)
  }

  // ── Header drag / resize ─────────────────────────────────────────────────

  _bindHeader (el) {
    const header = el.querySelector('.ope-header')
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
    const handle = el.querySelector('.ope-resize-handle')
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
