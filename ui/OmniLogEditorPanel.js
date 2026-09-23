/**
 * ui/OmniLogEditorPanel.js — ⟐OmniLog editor
 *
 * The real, confirmed Log build mode — reachable from OmniDraw's own
 * mode picker as a real, seventh option, matching how every other
 * mode already registers itself. Reuses OmniChat's JSON tab as its
 * real structural basis (confirmed directly — "let's basically use
 * that"), just with a real, constrained rich-text editable region
 * instead of a plain textarea, real templates, and the exact same
 * px/py/pz/rx/ry/rz/sx/sy/sz Transform schema OmniDraw's own Static
 * mode already uses, reused directly rather than reinvented.
 *
 * On submit, builds a real modules/OmniLogPagesPanel.js — genuinely
 * separate, real 3D pages in sequence, not one panel of internally
 * scrolling text (confirmed directly).
 */

import OmniLogPagesPanel from '../modules/OmniLogPagesPanel.js'

const TEMPLATES = {
  standard: '<h1>Post Title</h1><p>Start writing here…</p>',
  update: '<h2>Quick Update</h2><p>What changed today…</p>',
  photoEssay: '<h1>Photo Essay Title</h1><p>A short introduction.</p><h2>Section One</h2><p>Description…</p>',
}

const STYLES = `

.omni-log-editor {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 460px; max-height: 82vh;
  background: rgba(8,8,12,0.94); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px; padding: 14px;
  font-family: 'Courier New', Courier, monospace; z-index: 65;
  opacity: 0; visibility: hidden; pointer-events: auto;
  display: flex; flex-direction: column; gap: 8px;
}
.omni-log-editor.open { opacity: 1; visibility: visible; }
.ole-title { font-size: 11px; letter-spacing: 0.05em; color: rgba(255,255,255,0.6); text-align: center; }
.ole-row { display: flex; gap: 6px; align-items: center; }
.ole-select, .ole-input {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; color: #fff; font-family: inherit; font-size: 11px; padding: 5px 7px;
}
.ole-input { flex: 1; }
.ole-toolbar { display: flex; gap: 4px; }
.ole-tb-btn {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px; color: #fff; width: 26px; height: 26px; cursor: pointer; font-size: 12px;
}
.ole-tb-btn:hover { background: rgba(255,255,255,0.16); }
.ole-editable {
  min-height: 220px; max-height: 320px; overflow-y: auto;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10);
  border-radius: 8px; padding: 10px; color: #fff; font-size: 13px; line-height: 1.5;
}
.ole-editable h1 { font-size: 20px; margin: 4px 0; }
.ole-editable h2 { font-size: 16px; margin: 4px 0; }
.ole-transform-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 8px; }
.ole-transform-grid label { display: flex; flex-direction: column; gap: 2px; font-size: 8.5px; color: rgba(255,255,255,0.5); }
.ole-submit {
  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.16);
  color: #fff; border-radius: 8px; padding: 8px; cursor: pointer; font-size: 11px;
}
.ole-submit:hover { background: rgba(255,255,255,0.2); }
`

function injectStyles () {
  if (document.getElementById('ole-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ole-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniLogEditorPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._pagesPanel = new OmniLogPagesPanel(context)
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._pagesPanel.init()
    this._el = this._buildDOM()
    document.body.appendChild(this._el)
    this._bindEvents()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDrawLog') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._pagesPanel.destroy()
    this._el?.parentNode?.removeChild(this._el)
  }

  open () { this._isOpen = true; this._el.classList.add('open') }
  close () { this._isOpen = false; this._el.classList.remove('open') }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-log-editor'
    el.innerHTML = `
      <div class="ole-title">⟐ OmniLog</div>
      <div class="ole-row">
        <input class="ole-input" type="text" placeholder="Title" id="ole-title-input" />
        <select class="ole-select" id="ole-template">
          <option value="standard">Standard Post</option>
          <option value="update">Quick Update</option>
          <option value="photoEssay">Photo Essay</option>
        </select>
      </div>
      <div class="ole-toolbar">
        <button class="ole-tb-btn" data-cmd="bold"><b>B</b></button>
        <button class="ole-tb-btn" data-cmd="italic"><i>I</i></button>
        <button class="ole-tb-btn" data-cmd="formatBlock" data-value="h1">H1</button>
        <button class="ole-tb-btn" data-cmd="formatBlock" data-value="h2">H2</button>
        <button class="ole-tb-btn" data-cmd="insertUnorderedList">•</button>
      </div>
      <div class="ole-editable" id="ole-editable" contenteditable="true">${TEMPLATES.standard}</div>
      <div class="ole-transform-grid">
        <label>px<input type="range" class="ole-t" data-key="px" min="-100" max="100" step="1" value="0" /></label>
        <label>py<input type="range" class="ole-t" data-key="py" min="-100" max="100" step="1" value="0" /></label>
        <label>pz<input type="range" class="ole-t" data-key="pz" min="-100" max="100" step="1" value="-5" /></label>
        <label>rx<input type="range" class="ole-t" data-key="rx" min="-3.14" max="3.14" step="0.01" value="0" /></label>
        <label>ry<input type="range" class="ole-t" data-key="ry" min="-3.14" max="3.14" step="0.01" value="0" /></label>
        <label>rz<input type="range" class="ole-t" data-key="rz" min="-3.14" max="3.14" step="0.01" value="0" /></label>
        <label>sx<input type="range" class="ole-t" data-key="sx" min="-100" max="100" step="1" value="1" /></label>
        <label>sy<input type="range" class="ole-t" data-key="sy" min="-100" max="100" step="1" value="1" /></label>
        <label>sz<input type="range" class="ole-t" data-key="sz" min="-100" max="100" step="1" value="1" /></label>
      </div>
      <button class="ole-submit">Submit — build real, in-scene pages</button>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('#ole-template').addEventListener('change', (e) => {
      this._el.querySelector('#ole-editable').innerHTML = TEMPLATES[e.target.value]
    })

    this._el.querySelectorAll('.ole-tb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._el.querySelector('#ole-editable').focus()
        document.execCommand(btn.dataset.cmd, false, btn.dataset.value ?? null)
      })
    })

    this._el.querySelector('.ole-submit').addEventListener('click', () => this._onSubmit())
  }

  _onSubmit () {
    const title = this._el.querySelector('#ole-title-input').value.trim() || 'Untitled'
    const html = this._el.querySelector('#ole-editable').innerHTML
    const transform = {}
    this._el.querySelectorAll('.ole-t').forEach(input => { transform[input.dataset.key] = Number(input.value) })
    this._pagesPanel.build(title, html, transform)
    this.close()
  }
}
