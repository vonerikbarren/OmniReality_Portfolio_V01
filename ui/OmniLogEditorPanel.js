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
import { getLogEntry } from '../utils/OmniLogRegistry.js'
import { hexToRgba } from '../utils/ColorUtils.js'

const TEMPLATES = {
  standard: '<h1>Post Title</h1><p>Start writing here…</p>',
  update: '<h2>Quick Update</h2><p>What changed today…</p>',
  photoEssay: '<h1>Photo Essay Title</h1><p>A short introduction.</p><h2>Section One</h2><p>Description…</p>',
}

// Real, standard Lorem Ipsum word pool — used to generate real,
// genuinely long content on demand, specifically to prove out what
// multipage pagination actually looks like, per direct request.
const LOREM_WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur'.split(' ')

function generateLoremParagraph (wordCount) {
  const words = []
  for (let i = 0; i < wordCount; i++) words.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)])
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1) + '.'
}

/** Real, generated multi-paragraph content — long enough on its own
 *  to genuinely force real pagination into multiple pages, so the
 *  person can actually see what that looks like without needing to
 *  hand-type a long real post first. */
function generateLoremIpsum () {
  const paragraphs = Array.from({ length: 12 }, () => `<p>${generateLoremParagraph(40)}</p>`)
  return `<h1>Lorem Ipsum — Multipage Demo</h1>${paragraphs.join('')}`
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
.ole-t-num {
  width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px; color: #fff; font-family: inherit; font-size: 9px; padding: 2px 4px;
}
.ole-page-options { display: flex; gap: 4px; margin-left: auto; align-items: center; }
.ole-field-label { font-size: 10px; color: rgba(255,255,255,0.6); }
.ole-swatch-label { font-size: 10px; color: rgba(255,255,255,0.7); min-width: 34px; }
#ole-color { width: 30px; height: 24px; padding: 0; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12); cursor: pointer; }
#ole-alpha { flex: 1; }
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
    this._editingNodeId = null   // real, existing entry being re-edited, or null for a fresh, new one
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

    this._onEditRequest = (e) => {
      const entry = getLogEntry(e.detail?.nodeId)
      if (!entry) return   // not a real OmniLog entry — some other node type's own edit handling, not this one's concern
      this._editingNodeId = e.detail.nodeId
      this._el.querySelector('#ole-title-input').value = entry.title
      this._el.querySelector('#ole-editable').innerHTML = entry.html
      this._el.querySelectorAll('.ole-t').forEach(input => {
        const key = input.dataset.key
        if (entry.transform[key] !== undefined) input.value = entry.transform[key]
      })
      this.open()
    }
    window.addEventListener('omni:edit-request', this._onEditRequest)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:edit-request', this._onEditRequest)
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
        <div class="ole-page-options" title="OmniLogPageOptions">
          <select class="ole-select" id="ole-template">
            <option value="standard">Standard Post</option>
            <option value="update">Quick Update</option>
            <option value="photoEssay">Photo Essay</option>
          </select>
          <button class="ole-tb-btn" id="ole-lorem-btn" title="Generate Lorem Ipsum — see what multipage looks like">Lorem</button>
        </div>
      </div>
      <div class="ole-toolbar">
        <button class="ole-tb-btn" data-cmd="bold"><b>B</b></button>
        <button class="ole-tb-btn" data-cmd="italic"><i>I</i></button>
        <button class="ole-tb-btn" data-cmd="formatBlock" data-value="h1">H1</button>
        <button class="ole-tb-btn" data-cmd="formatBlock" data-value="h2">H2</button>
        <button class="ole-tb-btn" data-cmd="insertUnorderedList">•</button>
      </div>
      <div class="ole-editable" id="ole-editable" contenteditable="true">${TEMPLATES.standard}</div>
      <div class="ole-row">
        <span class="ole-field-label">Color (RGBA)</span>
        <input type="color" id="ole-color" value="#8899ff" />
        <input type="range" id="ole-alpha" min="0" max="1" step="0.02" value="1" />
        <span class="ole-swatch-label" id="ole-alpha-val">100%</span>
      </div>
      <div class="ole-transform-grid">
        <label>px<input type="range" class="ole-t" data-key="px" min="-100" max="100" step="1" value="0" /><input type="number" class="ole-t-num" data-key="px" value="0" /></label>
        <label>py<input type="range" class="ole-t" data-key="py" min="-100" max="100" step="1" value="0" /><input type="number" class="ole-t-num" data-key="py" value="0" /></label>
        <label>pz<input type="range" class="ole-t" data-key="pz" min="-100" max="100" step="1" value="-5" /><input type="number" class="ole-t-num" data-key="pz" value="-5" /></label>
        <label>rx<input type="range" class="ole-t" data-key="rx" min="-3.14" max="3.14" step="0.01" value="0" /><input type="number" class="ole-t-num" data-key="rx" value="0" step="0.01" /></label>
        <label>ry<input type="range" class="ole-t" data-key="ry" min="-3.14" max="3.14" step="0.01" value="0" /><input type="number" class="ole-t-num" data-key="ry" value="0" step="0.01" /></label>
        <label>rz<input type="range" class="ole-t" data-key="rz" min="-3.14" max="3.14" step="0.01" value="0" /><input type="number" class="ole-t-num" data-key="rz" value="0" step="0.01" /></label>
        <label>sx<input type="range" class="ole-t" data-key="sx" min="-100" max="100" step="1" value="1" /><input type="number" class="ole-t-num" data-key="sx" value="1" /></label>
        <label>sy<input type="range" class="ole-t" data-key="sy" min="-100" max="100" step="1" value="1" /><input type="number" class="ole-t-num" data-key="sy" value="1" /></label>
        <label>sz<input type="range" class="ole-t" data-key="sz" min="-100" max="100" step="1" value="1" /><input type="number" class="ole-t-num" data-key="sz" value="1" /></label>
      </div>
      <button class="ole-submit">Submit — build real, in-scene pages</button>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('#ole-template').addEventListener('change', (e) => {
      this._el.querySelector('#ole-editable').innerHTML = TEMPLATES[e.target.value]
    })

    // Real fix — excludes the Lorem button, which shares this class
    // only for styling; it has no real data-cmd and isn't a format
    // command, so it needs its own, separate real handler below
    // rather than being wired into execCommand(undefined, ...).
    this._el.querySelectorAll('.ole-tb-btn:not(#ole-lorem-btn)').forEach(btn => {
      btn.addEventListener('click', () => {
        this._el.querySelector('#ole-editable').focus()
        document.execCommand(btn.dataset.cmd, false, btn.dataset.value ?? null)
      })
    })

    this._el.querySelector('#ole-lorem-btn').addEventListener('click', () => {
      this._el.querySelector('#ole-editable').innerHTML = generateLoremIpsum()
    })

    // Real, two-way sync between every slider and its own real
    // number field — either one can drive the real, shared value.
    this._el.querySelectorAll('.ole-t').forEach(slider => {
      const key = slider.dataset.key
      const numberField = this._el.querySelector(`.ole-t-num[data-key="${key}"]`)
      slider.addEventListener('input', () => { numberField.value = slider.value })
      numberField.addEventListener('input', () => { slider.value = numberField.value })
    })

    this._el.querySelector('#ole-alpha').addEventListener('input', (e) => {
      this._el.querySelector('#ole-alpha-val').textContent = `${Math.round(Number(e.target.value) * 100)}%`
    })

    this._el.querySelector('.ole-submit').addEventListener('click', () => this._onSubmit())
  }

  _onSubmit () {
    const title = this._el.querySelector('#ole-title-input').value.trim() || 'Untitled'
    const html = this._el.querySelector('#ole-editable').innerHTML
    const transform = {}
    // Real number fields are the ones read here — they're kept in
    // live sync with their sliders above, so either one being the
    // most recently touched still produces the same, real value.
    this._el.querySelectorAll('.ole-t-num').forEach(input => { transform[input.dataset.key] = Number(input.value) })
    const hex = this._el.querySelector('#ole-color').value
    const alpha = Number(this._el.querySelector('#ole-alpha').value)
    transform.colorRgba = hexToRgba(hex, alpha)
    this._pagesPanel.build(title, html, transform, this._editingNodeId)
    this._editingNodeId = null
    this.close()
  }
}
