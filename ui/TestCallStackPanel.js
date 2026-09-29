/**
 * ui/TestCallStackPanel.js — ⟐TestCallStack (Developer menu, Dev05)
 *
 * A living checklist of "latest updates to the OS" — real changes
 * landed in the build, grouped by class (subsystem) so testing can be
 * worked through in order. Each row is a tappable checkbox; state
 * persists in localStorage keyed by a stable per-item id, so checking
 * something off survives reloads and future rebuilds of this panel.
 *
 * The seed list below is not placeholder copy — it's the real set of
 * changes delivered in V131–V135 (persistence fix, dash movement,
 * inspector snap-to-right, custom per-node inspector options, video
 * wallpaper + the image-mirror fix, DoubleSide toggle, docs reorg).
 * New rows can be added from the panel itself as future updates land,
 * so this stays accurate instead of needing a code edit every time.
 *
 * Storage:
 *   localStorage['omni:dev:testcallstack:items']  → JSON array of
 *     { id, cls, label, checked, ts }
 *   localStorage['omni:dev:testcallstack:seeded'] → '1' once the
 *     seed list below has been merged in, so re-opening the panel
 *     never re-adds items the user deleted.
 *
 * Nav:
 *   omni:nav-select { item: '⟐TestCallStack' } — opens the panel
 *   (wired from main.js, Developer specialSlots[5])
 */

const STORAGE_KEY = 'omni:dev:testcallstack:items'
const SEEDED_KEY = 'omni:dev:testcallstack:seeded'

// Real, delivered changes (V131–V135) — grouped by class/subsystem.
const SEED_ITEMS = [
  { cls: 'Persistence', label: 'Force-save on tab close/refresh/hide (beforeunload + visibilitychange → omni:force-save)' },
  { cls: 'Persistence', label: 'Inspector rotation/scale debounce now flushes on force-save instead of dropping the last change' },
  { cls: 'Movement', label: 'Dash modifier on the LH movement pad (⟫⟫ button, configurable multiplier)' },
  { cls: 'Movement', label: 'Dash multiplier setting added to Camera Movement Options panel' },
  { cls: 'Inspector', label: 'Snap-to-right toolbar button (⇥) docks the Inspector panel to the opposite edge' },
  { cls: 'Inspector', label: 'Per-node custom options section (MasterClock: tunnel toggle, Z-axis mode, time format)' },
  { cls: 'Inspector', label: 'THREE.DoubleSide toggle next to Wireframe, additive-only on restore so it never fights Is-Domain nodes' },
  { cls: 'Wallpaper', label: 'Wallpaper sphere now supports video (upload, loop/mute/volume, play toggle)' },
  { cls: 'Wallpaper', label: 'Interior-view texture mirror fix applied to both image and video (real bug, affected images too)' },
  { cls: 'Wallpaper', label: 'Video aspect-ratio guidance corrected to 2:1 equirectangular in the settings panel' },
  { cls: 'Browser', label: 'OmniBrowser window 1 auto-loads Wikipedia on first landing if no URL is already set' },
  { cls: 'Docs', label: 'BusinessStrategy/ moved to docs/business_strategy/, all cross-references fixed' },
  { cls: 'Docs', label: 'Dev/ moved to docs/dev/, all cross-references fixed' },
  { cls: 'Docs', label: 'Drawer → The 30 meaning-based mapping documented (DRAWER_TO_30_MAPPING.md)' },
]

const STYLES = `

.tcs-panel {
  pointer-events   : auto;
  position         : fixed;
  top              : 130px;
  left             : 1420px;
  width            : 300px;
  max-height       : 70vh;
  background       : rgba(8, 8, 12, 0.94);
  border           : 1px solid rgba(255, 255, 255, 0.10);
  border-radius    : 12px;
  font-family      : 'Courier New', Courier, monospace;
  z-index          : 60;
  opacity          : 0;
  visibility       : hidden;
  display          : flex;
  flex-direction   : column;
}
.tcs-panel.open { opacity: 1; visibility: visible; }

.tcs-header {
  display: flex; align-items: center; justify-content: center;
  height: 32px; border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 10px; color: rgba(255,255,255,0.7); position: relative;
  flex-shrink: 0;
}
.tcs-close {
  position: absolute; right: 8px; background: none; border: none;
  color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer;
}
.tcs-progress {
  font-size: 9px; color: rgba(255,255,255,0.45); text-align: center;
  padding: 6px 8px 0; flex-shrink: 0;
}
.tcs-body {
  padding: 8px; display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto; flex: 1;
}
.tcs-group-label {
  font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase;
  color: rgba(255, 238, 0, 0.65); padding: 2px 2px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.tcs-group { display: flex; flex-direction: column; gap: 4px; }
.tcs-row {
  display: flex; align-items: flex-start; gap: 7px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 6px; padding: 6px 7px; cursor: pointer;
}
.tcs-row:hover { background: rgba(255,255,255,0.09); }
.tcs-row.checked { border-color: rgba(120, 220, 140, 0.5); background: rgba(120, 220, 140, 0.07); }
.tcs-check {
  width: 13px; height: 13px; flex-shrink: 0; margin-top: 1px;
  accent-color: #7adc8c; cursor: pointer;
}
.tcs-label {
  font-size: 10.5px; color: #fff; line-height: 1.35; flex: 1; word-break: break-word;
}
.tcs-row.checked .tcs-label { color: rgba(255,255,255,0.45); text-decoration: line-through; }
.tcs-del {
  background: none; border: none; color: rgba(255,255,255,0.25);
  font-size: 11px; cursor: pointer; padding: 0 2px; flex-shrink: 0;
}
.tcs-del:hover { color: rgba(255,120,120,0.8); }

.tcs-add {
  display: flex; flex-direction: column; gap: 5px;
  padding: 8px; border-top: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
}
.tcs-add input, .tcs-add select {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 5px; color: #fff; font-size: 10px; font-family: inherit;
  padding: 5px 6px;
}
.tcs-add-row { display: flex; gap: 5px; }
.tcs-add-row select { flex: 0 0 96px; }
.tcs-add-row input { flex: 1; }
.tcs-add-btn {
  background: rgba(255, 238, 0, 0.14); border: 1px solid rgba(255, 238, 0, 0.35);
  border-radius: 5px; color: #ffee00; font-size: 10px; padding: 5px;
  cursor: pointer;
}
.tcs-add-btn:hover { background: rgba(255, 238, 0, 0.22); }
.tcs-empty { font-size: 10px; color: rgba(255,255,255,0.35); padding: 12px 4px; text-align: center; }
`

function injectStyles () {
  if (document.getElementById('tcs-styles')) return
  const tag = document.createElement('style')
  tag.id = 'tcs-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

function loadItems () {
  let items = []
  try { items = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch (_) { items = [] }
  const seeded = localStorage.getItem(SEEDED_KEY) === '1'
  if (!seeded) {
    const existingIds = new Set(items.map(i => i.id))
    SEED_ITEMS.forEach((s, idx) => {
      const id = `seed-${idx}-${s.cls.toLowerCase().replace(/\s+/g, '-')}`
      if (!existingIds.has(id)) {
        items.push({ id, cls: s.cls, label: s.label, checked: false, ts: Date.now() })
      }
    })
    try { localStorage.setItem(SEEDED_KEY, '1') } catch (_) {}
    saveItems(items)
  }
  return items
}

function saveItems (items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch (_) {}
}

export default class TestCallStackPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._items = []
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._items = loadItems()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._bindStaticEvents()
    this._render()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐TestCallStack') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
  }

  open () { this._isOpen = true; this._el.classList.add('open') }
  close () { this._isOpen = false; this._el.classList.remove('open') }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'tcs-panel'
    el.innerHTML = `
      <div class="tcs-header">⟐ TestCallStack<button class="tcs-close">✕</button></div>
      <div class="tcs-progress"></div>
      <div class="tcs-body"></div>
      <div class="tcs-add">
        <div class="tcs-add-row">
          <select class="tcs-add-cls"></select>
          <input class="tcs-add-input" type="text" placeholder="New update…" />
        </div>
        <button class="tcs-add-btn">+ Add to checklist</button>
      </div>
    `
    return el
  }

  _bindStaticEvents () {
    this._el.querySelector('.tcs-close').addEventListener('click', () => this.close())
    this._el.querySelector('.tcs-add-btn').addEventListener('click', () => this._addItem())
    this._el.querySelector('.tcs-add-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._addItem()
    })
  }

  _classes () {
    const seen = new Set()
    const out = []
    this._items.forEach(i => { if (!seen.has(i.cls)) { seen.add(i.cls); out.push(i.cls) } })
    if (out.length === 0) out.push('General')
    return out
  }

  _addItem () {
    const input = this._el.querySelector('.tcs-add-input')
    const select = this._el.querySelector('.tcs-add-cls')
    const label = input.value.trim()
    if (!label) return
    let cls = select.value
    if (cls === '__new__') {
      cls = window.prompt('New class/category name:', '')?.trim()
      if (!cls) return
    }
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    this._items.push({ id, cls, label, checked: false, ts: Date.now() })
    saveItems(this._items)
    input.value = ''
    this._render()
  }

  _toggle (id) {
    const item = this._items.find(i => i.id === id)
    if (!item) return
    item.checked = !item.checked
    saveItems(this._items)
    this._render()
  }

  _delete (id) {
    this._items = this._items.filter(i => i.id !== id)
    saveItems(this._items)
    this._render()
  }

  _render () {
    const body = this._el.querySelector('.tcs-body')
    const progress = this._el.querySelector('.tcs-progress')
    const select = this._el.querySelector('.tcs-add-cls')

    const total = this._items.length
    const done = this._items.filter(i => i.checked).length
    progress.textContent = total ? `${done} / ${total} checked off` : 'No items yet'

    const classes = this._classes()
    select.innerHTML = classes.map(c => `<option value="${c}">${c}</option>`).join('') +
      `<option value="__new__">+ New class…</option>`

    if (total === 0) {
      body.innerHTML = `<div class="tcs-empty">Nothing tracked yet. Add the latest OS update below.</div>`
      return
    }

    const groups = {}
    this._items.forEach(i => { (groups[i.cls] ??= []).push(i) })

    body.innerHTML = Object.entries(groups).map(([cls, rows]) => `
      <div class="tcs-group" data-cls="${cls}">
        <div class="tcs-group-label">${cls} (${rows.filter(r => r.checked).length}/${rows.length})</div>
        ${rows.map(r => `
          <div class="tcs-row ${r.checked ? 'checked' : ''}" data-id="${r.id}">
            <input type="checkbox" class="tcs-check" data-id="${r.id}" ${r.checked ? 'checked' : ''} />
            <div class="tcs-label">${r.label}</div>
            <button class="tcs-del" data-id="${r.id}" title="Remove">✕</button>
          </div>
        `).join('')}
      </div>
    `).join('')

    body.querySelectorAll('.tcs-check').forEach(cb => {
      cb.addEventListener('click', (e) => { e.stopPropagation(); this._toggle(cb.dataset.id) })
    })
    body.querySelectorAll('.tcs-row').forEach(row => {
      row.addEventListener('click', () => this._toggle(row.dataset.id))
    })
    body.querySelectorAll('.tcs-del').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._delete(btn.dataset.id) })
    })
  }
}
