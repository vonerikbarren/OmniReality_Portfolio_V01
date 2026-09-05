/**
 * ui/AdminPanel.js — ⟐mniReality Admin Panel
 *
 * Opens from the top-left drawer (⟐mniMenu → ⟐Admin → ⟐mniAdminSettings). Draggable,
 * resizable, minimizable, maximizable into the grid dashboard — same
 * window chrome as ui/OmniDraw.js and systems/OmniInspector.js, via
 * the shared ui/WindowManager.js / ui/GridWidgets.js.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Save-gated — the one thing that makes this panel different
 * ─────────────────────────────────────────────────────────────────────────────
 * Every other panel in this project applies each field's change
 * immediately. This one deliberately does NOT: editing a field only
 * updates a local staged copy (this._staged). Nothing is written to
 * localStorage or broadcast to the rest of the app until Save is
 * clicked, which then:
 *   1. persists the full settings object to localStorage
 *      (omni:admin:settings)
 *   2. dispatches omni:admin-settings-saved with that object, which
 *      modules/VoidBoundary.js, modules/WallpaperSphere.js, and
 *      modules/UserSpaceSphere.js all listen for
 *   3. applies the chosen theme via ui/ThemeManager.js
 *
 * Every consumer module ALSO reads omni:admin:settings directly from
 * localStorage on its own init() — so settings saved in a previous
 * session are still applied correctly on a fresh page load, regardless
 * of module registration order.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What's live vs. schema-only
 * ─────────────────────────────────────────────────────────────────────────────
 *   LIVE        — step sizes, theme, wallpaper color/alpha, domain grid
 *                 color, user-space color/size/spin
 *   SCHEMA-ONLY — wallpaper imgUrl/videoUrl, user-space textureUrl
 *                 (stored, not yet texture-mapped — see BACKLOG.md)
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import * as GridWidgets   from './GridWidgets.js'
import * as ThemeManager  from './ThemeManager.js'

const STORE_KEY = 'omni:admin:settings'

const DEFAULTS = {
  steps: { px: 1, py: 1, pz: 1 },
  theme: 'dark',
  wallpaper: {
    color: '#445566', alpha: 0.4,
    imgUrl: './assets/images/wallpaper-default.jpg',   // must match modules/WallpaperSphere.js's DEFAULT_IMG_URL
    videoUrl: '',
    rotationSpeed: 0.05, autoSpinX: false, autoSpinY: true, autoSpinZ: true,
  },
  domainGridColor: '#888888',
  domainGridOpacity: 0.35,
  domainGridWireframe: true,
  domainGridVisible: false,
  userSpace: { color: '#ffffff', sizeMultiplier: 1, spinning: true, visible: false, textureUrl: '' },
  uiSettings: { panelOpacity: 0.92 },
}

function loadSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return structuredClone(DEFAULTS)
    const parsed = JSON.parse(raw)
    return {
      steps: { ...DEFAULTS.steps, ...parsed.steps },
      theme: parsed.theme ?? DEFAULTS.theme,
      wallpaper: { ...DEFAULTS.wallpaper, ...parsed.wallpaper },
      domainGridColor: parsed.domainGridColor ?? DEFAULTS.domainGridColor,
      domainGridOpacity: parsed.domainGridOpacity ?? DEFAULTS.domainGridOpacity,
      domainGridWireframe: parsed.domainGridWireframe ?? DEFAULTS.domainGridWireframe,
      domainGridVisible: parsed.domainGridVisible ?? DEFAULTS.domainGridVisible,
      userSpace: { ...DEFAULTS.userSpace, ...parsed.userSpace },
      uiSettings: { ...DEFAULTS.uiSettings, ...parsed.uiSettings },
    }
  } catch (_) {
    return structuredClone(DEFAULTS)
  }
}

const STYLES = /* css */`

.omni-admin-panel {
  --ap-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ap-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ap-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ap-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --ap-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.68));
  --ap-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.45));
  --ap-accent      : var(--omni-theme-accent, #ffb27f);
  --ap-input-bg    : var(--omni-theme-input-bg, rgba(255, 255, 255, 0.09));
  --ap-input-border: var(--omni-theme-input-border, rgba(255, 255, 255, 0.18));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 100px;
  left             : 120px;
  width            : 380px;
  min-width        : 300px;
  max-width        : 720px;
  height           : 520px;
  min-height       : 320px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ap-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ap-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ap-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;

  opacity          : 0;
  transform        : scale(0.92);
}

.ap-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ap-header-bg);
  border-bottom    : 1px solid var(--ap-border);
  cursor           : grab;
  user-select      : none;
}
.ap-header.is-dragging { cursor: grabbing; }

.ap-title {
  position         : absolute;
  left             : 14px;
  font-size        : 12px;
  letter-spacing   : 0.06em;
  color            : var(--ap-text-dim);
  pointer-events   : none;
}

.ap-controls { display: flex; align-items: center; gap: 8px; }

.ap-ctrl {
  width            : 24px;
  height           : 24px;
  border-radius    : 6px;
  border           : 1px solid var(--ap-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--ap-text-dim);
  font-size        : 11px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.ap-ctrl:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.24); color: var(--ap-text); }
.ap-ctrl--minimize { order: -1; }
.ap-ctrl--save {
  color         : rgba(140, 255, 180, 0.85);
  border-color  : rgba(140, 255, 180, 0.22);
}
.ap-ctrl--save:hover { background: rgba(140, 255, 180, 0.14); border-color: rgba(140, 255, 180, 0.35); }
.ap-ctrl--save.is-saved { background: rgba(140, 255, 180, 0.22); border-color: rgba(140, 255, 180, 0.5); }

.ap-unsaved-banner {
  flex-shrink      : 0;
  display          : none;
  align-items      : center;
  justify-content  : center;
  gap              : 6px;
  padding          : 6px;
  font-size        : 9.5px;
  letter-spacing   : 0.04em;
  color            : rgba(255, 200, 140, 0.9);
  background       : rgba(255, 178, 127, 0.08);
  border-bottom    : 1px solid rgba(255, 178, 127, 0.2);
}
.ap-unsaved-banner.is-visible { display: flex; }

.ap-body {
  flex             : 1 1 auto;
  overflow-y       : auto;
  padding          : 6px 14px 14px;
}
.ap-body::-webkit-scrollbar { width: 6px; }
.ap-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

.ap-group-block { margin-bottom: 4px; }
.ap-group-title {
  font-size        : 10px;
  letter-spacing   : 0.10em;
  text-transform   : uppercase;
  color            : var(--ap-text-muted);
  margin           : 14px 0 6px;
}
.ap-group-block:first-child .ap-group-title { margin-top: 4px; }

.ap-row {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  gap              : 10px;
  padding          : 5px 0;
  border-bottom    : 1px solid rgba(255,255,255,0.04);
}
.ap-row-label { font-size: 10.5px; color: var(--ap-text-dim); }

.ap-num, .ap-text {
  background       : var(--ap-input-bg);
  border           : 1px solid var(--ap-input-border);
  border-radius    : 4px;
  color            : var(--ap-text);
  font-family      : var(--mono);
  font-size        : 10.5px;
  padding          : 3px 6px;
}
.ap-num { width: 60px; text-align: right; }
.ap-text { width: 160px; }

.ap-color {
  width            : 36px;
  height           : 22px;
  padding          : 0;
  border           : 1px solid var(--ap-input-border);
  border-radius    : 4px;
  background       : none;
  cursor           : pointer;
}

.ap-action-btn {
  width            : 100%;
  padding          : 9px;
  margin-bottom    : 6px;
  background       : rgba(255,255,255,0.06);
  border           : 1px solid var(--ap-input-border, rgba(255,255,255,0.18));
  border-radius    : 6px;
  color            : var(--ap-text-dim, rgba(255,255,255,0.85));
  font-family      : var(--mono);
  font-size        : 10.5px;
  cursor           : pointer;
}
.ap-action-btn:hover { background: rgba(255,255,255,0.12); }
.ap-action-btn--danger {
  background       : rgba(255, 100, 100, 0.1);
  border-color     : rgba(255, 100, 100, 0.3);
  color            : rgba(255, 160, 160, 0.9);
}
.ap-action-btn--danger:hover { background: rgba(255, 100, 100, 0.18); }
.ap-import-input { display: none; }

.ap-toggle {
  width            : 30px;
  height           : 16px;
  border-radius    : 8px;
  background       : rgba(255,255,255,0.10);
  border           : 1px solid var(--ap-border);
  cursor           : pointer;
  position         : relative;
}
.ap-toggle::after {
  content          : '';
  position         : absolute;
  top              : 1px; left: 1px;
  width            : 12px; height: 12px;
  border-radius    : 50%;
  background       : var(--ap-text-dim);
  transition       : transform 0.15s ease, background 0.15s ease;
}
.ap-toggle.is-on { background: rgba(255, 178, 127, 0.35); border-color: rgba(255, 178, 127, 0.5); }
.ap-toggle.is-on::after { transform: translateX(14px); background: var(--ap-accent); }

.ap-select {
  background       : var(--ap-input-bg);
  border           : 1px solid var(--ap-input-border);
  border-radius    : 4px;
  color            : var(--ap-text);
  font-family      : var(--mono);
  font-size        : 10px;
  padding          : 3px 4px;
}

.ap-file-row { flex-direction: column; align-items: stretch; gap: 4px; }
.ap-file-controls { display: flex; align-items: center; gap: 8px; }
.ap-file-btn {
  font-family      : var(--mono);
  font-size        : 9.5px;
  letter-spacing   : 0.04em;
  color            : var(--ap-accent);
  background       : rgba(255, 178, 127, 0.08);
  border           : 1px solid rgba(255, 178, 127, 0.3);
  border-radius    : 5px;
  padding          : 5px 10px;
  cursor           : pointer;
  transition       : background 0.12s ease;
  flex-shrink      : 0;
}
.ap-file-btn:hover { background: rgba(255, 178, 127, 0.16); }
.ap-file-name {
  font-size        : 9px;
  color            : var(--ap-text-muted);
  overflow         : hidden;
  text-overflow    : ellipsis;
  white-space      : nowrap;
  flex             : 1;
}
.ap-file-clear {
  background       : none;
  border           : none;
  color            : var(--ap-text-muted);
  cursor           : pointer;
  font-size        : 11px;
  flex-shrink      : 0;
}
.ap-file-clear:hover { color: var(--ap-text); }

/* ── Resize handle — bottom-right (left-anchored panel) ───────────────────── */
.ap-resize-handle {
  position         : absolute; right: 0; bottom: 0;
  width            : 16px; height: 16px;
  cursor           : nwse-resize;
  z-index          : 2;
}
.ap-resize-handle::before {
  content          : '';
  position         : absolute; right: 3px; bottom: 3px;
  width            : 8px; height: 8px;
  border-right     : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom    : 2px solid rgba(255, 255, 255, 0.25);
  border-radius    : 0 0 2px 0;
}
.ap-resize-handle:hover::before { border-color: rgba(255, 255, 255, 0.6); }

`

function injectStyles () {
  if (document.getElementById('omni-admin-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-admin-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class AdminPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._gridEl = null
    this._gridWidgets = null

    this._saved  = loadSettings()       // what's actually applied/persisted
    this._staged = structuredClone(this._saved)   // what the form currently shows, pre-save

    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐mniAdminSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('adminpanel')
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
      opacity: 0, scale: 0.92, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'adminpanel', label: '⟐Admin', iconLabel: '⟐A',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-admin-panel'
    el.innerHTML = /* html */`
      <div class="ap-header">
        <span class="ap-title">⟐Admin</span>
        <div class="ap-controls">
          <button class="ap-ctrl ap-ctrl--minimize" data-action="minimize" title="Minimize">–</button>
          <button class="ap-ctrl ap-ctrl--save" data-action="save" title="Save (nothing applies until you do)">💾</button>
          <button class="ap-ctrl ap-ctrl--maximize" data-action="maximize" title="Maximize"></button>
          <button class="ap-ctrl ap-ctrl--close" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ap-unsaved-banner" id="ap-unsaved-banner">⚠ Unsaved changes — click 💾 to apply</div>
      <div class="ap-body" id="ap-body"></div>
      <div class="ap-resize-handle" aria-hidden="true"></div>
    `

    this._renderBody(el.querySelector('#ap-body'))
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'adminpanel'
    WindowManager.register('adminpanel', el, 'Admin')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    WindowManager.makeMaximizable(el, el.querySelector('.ap-ctrl--maximize'), {
      onMaximize: () => this._toGridDashboard(),
      onRestore : () => this._fromGridDashboard(),
    })
    WindowManager.wireSaveButton(el.querySelector('.ap-ctrl--save'), 'adminpanel', () => this._save())

    return el
  }

  _renderBody (body) {
    const s = this._staged

    const group = (title, id, rowsHtml) => /* html */`
      <div class="ap-group-block" data-group="${id}">
        <div class="ap-group-title">${title}</div>
        ${rowsHtml}
      </div>
    `
    const numRow = (label, key, value, step = 1, min, max) => /* html */`
      <div class="ap-row">
        <span class="ap-row-label">${label}</span>
        <input class="ap-num" type="number" step="${step}" value="${value}" data-key="${key}"
               ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''}>
      </div>
    `
    const colorRow = (label, key, value) => /* html */`
      <div class="ap-row">
        <span class="ap-row-label">${label}</span>
        <input class="ap-color" type="color" value="${value}" data-key="${key}">
      </div>
    `
    const textRow = (label, key, value, placeholder = '') => /* html */`
      <div class="ap-row">
        <span class="ap-row-label">${label}</span>
        <input class="ap-text" type="text" value="${value}" placeholder="${placeholder}" data-key="${key}">
      </div>
    `
    const fileRow = (label, key, currentValue, accept) => {
      const hasValue = !!currentValue
      const nameLabel = hasValue
        ? (currentValue.startsWith('data:') ? 'Uploaded file' : currentValue.split('/').pop())
        : 'No file selected'
      return /* html */`
        <div class="ap-row ap-file-row">
          <span class="ap-row-label">${label}</span>
          <div class="ap-file-controls">
            <label class="ap-file-btn">
              Browse…
              <input type="file" accept="${accept}" data-file-key="${key}" style="display:none">
            </label>
            <span class="ap-file-name" data-file-name-for="${key}">${nameLabel}</span>
            <button class="ap-file-clear" data-file-clear="${key}" title="Clear" style="display:${hasValue ? '' : 'none'}">×</button>
          </div>
        </div>
      `
    }
    const toggleRow = (label, key, value) => /* html */`
      <div class="ap-row">
        <span class="ap-row-label">${label}</span>
        <button class="ap-toggle ${value ? 'is-on' : ''}" data-key="${key}" role="switch" aria-checked="${value}"></button>
      </div>
    `

    body.innerHTML =
      group('Navigation Steps', 'steps',
        numRow('px step', 'steps.px', s.steps.px, 0.01) +
        numRow('py step', 'steps.py', s.steps.py, 0.01) +
        numRow('pz step', 'steps.pz', s.steps.pz, 0.01)
      ) +
      group('Theme', 'theme',
        `<div class="ap-row"><span class="ap-row-label">Panel theme</span><select class="ap-select" id="ap-theme-select" data-key="theme"></select></div>`
      ) +
      group('Space Wallpaper', 'wallpaper',
        colorRow('Color', 'wallpaper.color', s.wallpaper.color) +
        numRow('Alpha (0–1)', 'wallpaper.alpha', s.wallpaper.alpha, 0.05) +
        fileRow('Image', 'wallpaper.imgUrl', s.wallpaper.imgUrl, 'image/*') +
        fileRow('Video', 'wallpaper.videoUrl', s.wallpaper.videoUrl, 'video/*') +
        numRow('Rotation speed', 'wallpaper.rotationSpeed', s.wallpaper.rotationSpeed, 0.05, -2, 2) +
        toggleRow('x-autoSpin', 'wallpaper.autoSpinX', s.wallpaper.autoSpinX) +
        toggleRow('y-autoSpin', 'wallpaper.autoSpinY', s.wallpaper.autoSpinY) +
        toggleRow('z-autoSpin', 'wallpaper.autoSpinZ', s.wallpaper.autoSpinZ)
      ) +
      group('Domain Grid', 'domain',
        colorRow('Grid color', 'domainGridColor', s.domainGridColor) +
        numRow('Opacity (0–1)', 'domainGridOpacity', s.domainGridOpacity, 0.05) +
        toggleRow('Wireframe', 'domainGridWireframe', s.domainGridWireframe) +
        toggleRow('Visible', 'domainGridVisible', s.domainGridVisible)
      ) +
      group('User Space', 'userspace',
        colorRow('Color', 'userSpace.color', s.userSpace.color) +
        numRow('Size multiplier', 'userSpace.sizeMultiplier', s.userSpace.sizeMultiplier, 0.1) +
        toggleRow('Visible', 'userSpace.visible', s.userSpace.visible) +
        toggleRow('Spinning', 'userSpace.spinning', s.userSpace.spinning) +
        fileRow('Texture (default: wireframe)', 'userSpace.textureUrl', s.userSpace.textureUrl, 'image/*')
      ) +
      group('UI Settings', 'uisettings',
        numRow('Panel opacity (0.3–1)', 'uiSettings.panelOpacity', s.uiSettings.panelOpacity, 0.02)
      ) +
      group('Data Management', 'datamanagement',
        `<button class="ap-action-btn ap-action-btn--danger" id="ap-clear-scene">🗑 Clear Scene</button>
         <button class="ap-action-btn" id="ap-export-data">⬇ Export Data</button>
         <label class="ap-action-btn" for="ap-import-input" style="display:block;text-align:center;box-sizing:border-box">⬆ Import Data</label>
         <input type="file" accept="application/json,.json" class="ap-import-input" id="ap-import-input">
         <div class="ap-data-note" style="font-size:9px;color:var(--ap-text-muted,rgba(255,255,255,0.6));line-height:1.4;margin-top:4px">
           Clear Scene removes every created object — cannot be undone.
           Export downloads everything currently in local storage as one
           JSON file. Import replaces local storage with a previously
           exported file and reloads the page to apply it.
         </div>`
      )

    this._populateThemeSelect(body)
    this._bindFields(body)
    this._bindDataManagement(body)
  }

  async _populateThemeSelect (body) {
    const select = body.querySelector('#ap-theme-select')
    if (!select) return
    const themes = await ThemeManager.getThemes()
    select.innerHTML = Object.entries(themes)
      .map(([key, t]) => `<option value="${key}" ${key === this._staged.theme ? 'selected' : ''}>${t.label ?? key}</option>`)
      .join('')
    select.addEventListener('change', () => {
      this._setStaged('theme', select.value)
    })
  }

  /** Clear Scene dispatches an event rather than reaching into
   *  OmniNode's storage keys directly — this panel doesn't (and
   *  shouldn't need to) know that system's internal key names. Export
   *  /Import work directly against localStorage since "whatever is in
   *  local storage" is explicitly the whole point of those two. */
  _bindDataManagement (body) {
    body.querySelector('#ap-clear-scene')?.addEventListener('click', () => {
      const ok = window.confirm('Clear every object in the scene? This cannot be undone.')
      if (!ok) return
      window.dispatchEvent(new CustomEvent('omni:scene-clear-request'))
    })

    body.querySelector('#ap-export-data')?.addEventListener('click', () => {
      const dump = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        dump[key] = localStorage.getItem(key)
      }
      const json = JSON.stringify(dump, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `omnireality-export-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    })

    body.querySelector('#ap-import-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      if (!file) return

      const ok = window.confirm(
        'Importing replaces everything currently in local storage with ' +
        'the contents of this file, then reloads the page. Continue?'
      )
      if (!ok) { e.target.value = ''; return }

      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          throw new Error('Expected a JSON object of key/value pairs, like an exported file.')
        }
        localStorage.clear()
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key, value)
        }
        window.location.reload()
      } catch (err) {
        window.alert(`Import failed: ${err?.message ?? err}`)
        e.target.value = ''
      }
    })
  }

  _bindFields (body) {
    body.querySelectorAll('.ap-num, .ap-text').forEach(input => {
      input.addEventListener('input', () => {
        let value = input.type === 'number' ? Number(input.value) : input.value
        if (input.type === 'number') {
          if (input.min !== '' && value < Number(input.min)) value = Number(input.min)
          if (input.max !== '' && value > Number(input.max)) value = Number(input.max)
        }
        this._setStaged(input.dataset.key, value)
      })
    })
    body.querySelectorAll('.ap-color').forEach(input => {
      input.addEventListener('input', () => this._setStaged(input.dataset.key, input.value))
    })
    body.querySelectorAll('.ap-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = !btn.classList.contains('is-on')
        btn.classList.toggle('is-on', next)
        btn.setAttribute('aria-checked', String(next))
        this._setStaged(btn.dataset.key, next)
      })
    })

    // File browse — reads the selected file as a data URL and stages it.
    // Held entirely in localStorage on Save (no server, no external
    // storage) — large files can hit the browser's localStorage quota,
    // so _save() surfaces that clearly if it happens rather than failing
    // silently.
    body.querySelectorAll('[data-file-key]').forEach(input => {
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) return
        const key = input.dataset.fileKey
        const reader = new FileReader()
        reader.onload = () => {
          this._setStaged(key, reader.result)
          const row = input.closest('.ap-file-row')
          const nameEl  = row?.querySelector(`[data-file-name-for="${key}"]`)
          const clearEl = row?.querySelector(`[data-file-clear="${key}"]`)
          if (nameEl) nameEl.textContent = file.name
          if (clearEl) clearEl.style.display = ''
        }
        reader.onerror = () => console.warn('⟐Admin — failed to read file:', file.name)
        reader.readAsDataURL(file)
      })
    })

    body.querySelectorAll('[data-file-clear]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.fileClear
        this._setStaged(key, '')
        const row = btn.closest('.ap-file-row')
        const nameEl = row?.querySelector(`[data-file-name-for="${key}"]`)
        if (nameEl) nameEl.textContent = 'No file selected'
        btn.style.display = 'none'
        const fileInput = row?.querySelector(`[data-file-key="${key}"]`)
        if (fileInput) fileInput.value = ''
      })
    })
  }

  /** Sets a (possibly dotted-path) key on the staged object and shows
   *  the unsaved-changes banner. Nothing is applied yet. */
  _setStaged (path, value) {
    const parts = path.split('.')
    let obj = this._staged
    while (parts.length > 1) obj = obj[parts.shift()]
    obj[parts[0]] = value
    const banner = this._el?.querySelector('#ap-unsaved-banner')
    if (banner) {
      banner.textContent = '⚠ Unsaved changes — click 💾 to apply'
      banner.classList.add('is-visible')
    }
  }

  /** Save button — this is the ONLY place staged changes actually take
   *  effect: persisted to localStorage, broadcast to every consumer
   *  module, and the theme applied. */
  async _save () {
    this._saved = structuredClone(this._staged)
    const banner = this._el?.querySelector('#ap-unsaved-banner')

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._saved))
      banner?.classList.remove('is-visible')
    } catch (err) {
      // Realistic now that uploaded images/video are embedded as data
      // URLs — localStorage typically caps around 5-10MB total.
      console.warn('⟐Admin — localStorage save failed (likely quota exceeded from an uploaded file):', err)
      if (banner) {
        banner.textContent = '⚠ Save failed — uploaded file may be too large for local storage'
        banner.classList.add('is-visible')
      }
      // Settings still apply live below even if persistence failed —
      // just won't survive a reload.
    }

    window.dispatchEvent(new CustomEvent('omni:admin-settings-saved', { detail: this._saved }))
    await ThemeManager.setTheme(this._saved.theme)
  }

  // ── Header drag ──────────────────────────────────────────────────────────

  _bindHeader (el) {
    const header = el.querySelector('.ap-header')
    const onDown = (e) => {
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
    const handle = el.querySelector('.ap-resize-handle')
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

  // ── Maximize → grid dashboard ────────────────────────────────────────────

  _toGridDashboard () {
    if (this._gridEl) return
    const body = this._el.querySelector('#ap-body')
    if (!body) return
    const widgets = [...body.querySelectorAll('.ap-group-block')].map(block => ({
      id: block.dataset.group,
      title: block.querySelector('.ap-group-title')?.textContent ?? block.dataset.group,
      el: block,
    }))
    if (widgets.length === 0) return
    this._gridWidgets = widgets
    body.style.display = 'none'
    this._gridEl = GridWidgets.mountGrid(body.parentElement, widgets, 'adminpanel')
  }

  _fromGridDashboard () {
    if (!this._gridEl) return
    GridWidgets.unmountGrid(this._gridEl, this._gridWidgets ?? [])
    this._gridEl = null
    this._gridWidgets = null
    const body = this._el.querySelector('#ap-body')
    if (body) body.style.display = ''
  }
}
