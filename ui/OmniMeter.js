/**
 * ui/OmniMeter.js — ⟐OmniMeter
 *
 * Recreated from ui/OmniVerticalMeter.js by direct request — that
 * file's own vertical-track logic (track/ticks/marker math, the
 * screen-edge-HUD approach) is kept and reused here almost verbatim
 * as the Vertical/Y indicator, now joined by two new siblings so all
 * three spatial axes read at a glance:
 *
 *   Vertical  (Y) — the original right-edge vertical track.
 *   Horizontal(X) — new: a track running along the TOP of the screen.
 *   Depth     (Z) — new: a line running from the top edge down to
 *                   screen-center (depth has no natural "up/down"
 *                   reading, so it's drawn as a short radial line
 *                   instead of a full-width track).
 *
 * All three consolidate into this one system/settings surface,
 * "OmniMeter" — a small ⚙ control opens a panel with a show/hide
 * checkbox per axis plus a label-style toggle (Horizontal/Vertical/
 * Depth vs. plain X/Y/Z — direct request, either naming is fine).
 *
 * Range — direct request: "as large as the wallpaper is. Actually
 * half that. So the user doesnt feel like that have an infinite
 * boundary." WallpaperSphere's own BASE_SIZE (modules/WallpaperSphere.js)
 * is 1050, so HALF_EXTENT below is exactly half of that — 525 — used
 * as the +/- span on every axis, each centered on that axis's own
 * real rest value (Y centers on WallpaperSphere's CENTER_Y so the
 * meter's "middle" matches the wallpaper's own middle; X/Z center on
 * world origin, same as the floor/grid's own center).
 *
 * Old ui/OmniVerticalMeter.js is left in the repo untouched (its code
 * is what this file reuses) but is no longer instantiated from
 * main.js — this module fully replaces it.
 */

const STYLES = `

.omni-meter-vertical,
.omni-meter-horizontal,
.omni-meter-depth {
  pointer-events   : none;
  position         : fixed;
  z-index          : 45;
  opacity          : 0;
  visibility       : hidden;
  font-family      : 'Courier New', Courier, monospace;
  transition       : opacity 0.18s ease;
}
.omni-meter-vertical.open,
.omni-meter-horizontal.open,
.omni-meter-depth.open { opacity: 1; visibility: visible; }

/* ── Vertical (Y) — right edge, reused from OmniVerticalMeter ────────── */

.omni-meter-vertical {
  top              : 80px;
  bottom           : 80px;
  right            : 16px;
  width            : 46px;
}
.om-v-track {
  position: absolute; top: 0; bottom: 0; left: 6px; width: 2px;
  background: rgba(255,255,255,0.15); border-radius: 1px;
}
.om-v-tick {
  position: absolute; left: 0; width: 12px; height: 1px;
  background: rgba(255,255,255,0.25);
}
.om-v-tick-label {
  position: absolute; left: 15px; font-size: 8px; color: rgba(255,255,255,0.4);
  transform: translateY(-50%); white-space: nowrap;
}
.om-v-marker {
  position: absolute; left: 0; width: 14px; height: 14px;
  border-radius: 50%; background: rgba(255, 238, 0, 0.85);
  box-shadow: 0 0 6px rgba(255, 238, 0, 0.6);
  transform: translate(-2px, -7px);
}
.om-v-marker-label {
  position: absolute; left: 18px; font-size: 9.5px; color: #ffee00;
  transform: translateY(-50%); white-space: nowrap; font-weight: bold;
}

/* ── Horizontal (X) — new, top edge, mirrors the vertical track's own
      look rotated 90deg conceptually (same track/tick/marker roles). ── */

.omni-meter-horizontal {
  top              : 16px;
  left             : 90px;
  right            : 90px;
  height           : 46px;
}
.om-h-track {
  position: absolute; left: 0; right: 0; top: 6px; height: 2px;
  background: rgba(255,255,255,0.15); border-radius: 1px;
}
.om-h-tick {
  position: absolute; top: 0; height: 12px; width: 1px;
  background: rgba(255,255,255,0.25);
}
.om-h-tick-label {
  position: absolute; top: 15px; font-size: 8px; color: rgba(255,255,255,0.4);
  transform: translateX(-50%); white-space: nowrap;
}
.om-h-marker {
  position: absolute; top: 0; width: 14px; height: 14px;
  border-radius: 50%; background: rgba(120, 220, 255, 0.85);
  box-shadow: 0 0 6px rgba(120, 220, 255, 0.6);
  transform: translate(-7px, -2px);
}
.om-h-marker-label {
  position: absolute; top: 18px; font-size: 9.5px; color: #78dcff;
  transform: translateX(-50%); white-space: nowrap; font-weight: bold;
}

/* ── Depth (Z) — new, a short line from the top edge down to
      screen-center; no natural full-width/height reading for depth,
      so it's a single radial line rather than an edge-spanning track. ── */

.omni-meter-depth {
  top              : 16px;
  left             : 50%;
  width            : 2px;
  height           : calc(50vh - 16px);
  transform        : translateX(-50%);
}
.om-d-track {
  position: absolute; top: 0; bottom: 0; left: 0; width: 2px;
  background: rgba(255,255,255,0.15); border-radius: 1px;
}
.om-d-tick {
  position: absolute; left: -5px; width: 12px; height: 1px;
  background: rgba(255,255,255,0.25);
}
.om-d-tick-label {
  position: absolute; left: 10px; font-size: 8px; color: rgba(255,255,255,0.4);
  transform: translateY(-50%); white-space: nowrap;
}
.om-d-marker {
  position: absolute; left: -6px; width: 14px; height: 14px;
  border-radius: 50%; background: rgba(170, 255, 140, 0.85);
  box-shadow: 0 0 6px rgba(170, 255, 140, 0.6);
  transform: translate(-2px, -7px);
}
.om-d-marker-label {
  position: absolute; left: 13px; font-size: 9.5px; color: #aaff8c;
  transform: translateY(-50%); white-space: nowrap; font-weight: bold;
}

/* ── Settings toggle + popover ─────────────────────────────────────── */

.om-settings-btn {
  position         : fixed;
  top              : 16px;
  right            : 16px;
  width            : 26px;
  height           : 26px;
  border-radius    : 50%;
  background       : rgba(10, 10, 14, 0.75);
  border           : 1px solid rgba(255, 255, 255, 0.35);
  color            : rgba(255, 255, 255, 0.85);
  font-size        : 13px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  cursor           : pointer;
  z-index          : 46;
  pointer-events   : none;
  opacity          : 0;
  visibility       : hidden;
  transition       : opacity 0.18s ease;
}
.om-settings-btn.open { pointer-events: auto; opacity: 1; visibility: visible; }

.om-settings-panel {
  position         : fixed;
  top              : 48px;
  right            : 16px;
  width            : 190px;
  background       : rgba(10, 10, 14, 0.92);
  border           : 1px solid rgba(255, 255, 255, 0.18);
  border-radius     : 8px;
  padding          : 10px 12px;
  z-index          : 46;
  font-family      : 'Courier New', Courier, monospace;
  font-size        : 10.5px;
  color            : rgba(255, 255, 255, 0.85);
  display          : none;
  flex-direction   : column;
  gap              : 7px;
  pointer-events   : auto;
  box-shadow       : 0 10px 30px rgba(0,0,0,0.5);
}
.om-settings-panel.open { display: flex; }
.om-settings-title { font-size: 10px; letter-spacing: 0.04em; color: rgba(255,255,255,0.55); margin-bottom: 2px; }
.om-settings-row { display: flex; align-items: center; gap: 7px; cursor: pointer; }
.om-settings-row input { cursor: pointer; }
.om-settings-divider { border-top: 1px solid rgba(255,255,255,0.12); margin: 4px 0; }
.om-settings-label-toggle {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.8); border-radius: 5px; padding: 4px 6px;
  font-family: inherit; font-size: 10px; cursor: pointer;
}
`

function injectStyles () {
  if (document.getElementById('om-styles')) return
  const tag = document.createElement('style')
  tag.id = 'om-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// WallpaperSphere's own BASE_SIZE is 1050 — half of that (525) is the
// +/- range requested on every axis ("as large as the wallpaper is.
// Actually half that."), each centered on that axis's own real rest
// value rather than all three sharing one blind center.
const HALF_EXTENT = 525
const CENTER_Y = 28 // matches WallpaperSphere/VoidBoundary/RootSpace's own CENTER_Y
const CENTER_X = 0
const CENTER_Z = 0
const TICK_STEP = HALF_EXTENT / 3.5 // 5 ticks per side, same density feel as the original

const AXES = {
  y: { min: CENTER_Y - HALF_EXTENT, max: CENTER_Y + HALF_EXTENT, spatialLabel: 'Vertical', xyzLabel: 'Y' },
  x: { min: CENTER_X - HALF_EXTENT, max: CENTER_X + HALF_EXTENT, spatialLabel: 'Horizontal', xyzLabel: 'X' },
  z: { min: CENTER_Z - HALF_EXTENT, max: CENTER_Z + HALF_EXTENT, spatialLabel: 'Depth', xyzLabel: 'Z' },
}

const SETTINGS_KEY = 'omni:meter:settings'
const DEFAULT_SETTINGS = { showX: true, showY: true, showZ: true, labelStyle: 'spatial' }

export default class OmniMeter {
  constructor (context) {
    this.ctx = context
    this._isOpen = false
    this._settings = { ...DEFAULT_SETTINGS }
    this._els = {}
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._loadSettings()
    this._buildDOM()
    this._bindSettingsUI()
    this._applySettingsToDOM()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniMeter') return
      this.toggle()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  /** Real, per-frame update — camera position changes continuously on
   *  every axis, so all three markers track it every frame. */
  update () {
    if (!this._isOpen) return
    const pos = this.ctx.camera.position
    if (this._settings.showY) this._updateAxis('y', pos.y, this._els.vMarker, this._els.vMarkerLabel, true)
    if (this._settings.showX) this._updateAxis('x', pos.x, this._els.hMarker, this._els.hMarkerLabel, false)
    if (this._settings.showZ) this._updateAxis('z', pos.z, this._els.dMarker, this._els.dMarkerLabel, true)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    Object.values(this._els).forEach(el => { if (el?.parentNode) el.parentNode.removeChild(el) })
  }

  toggle () {
    this._isOpen = !this._isOpen
    this._els.vertical?.classList.toggle('open', this._isOpen && this._settings.showY)
    this._els.horizontal?.classList.toggle('open', this._isOpen && this._settings.showX)
    this._els.depth?.classList.toggle('open', this._isOpen && this._settings.showZ)
    this._els.settingsBtn?.classList.toggle('open', this._isOpen)
    if (!this._isOpen) this._els.settingsPanel?.classList.remove('open')
  }

  // ── Shared per-axis math — same "clamp, normalize to 0-1, place as a
  //    %" approach the original OmniVerticalMeter used, now parameterized
  //    by axis so all three indicators share one real implementation. ──

  _updateAxis (axis, value, markerEl, labelEl, vertical) {
    const { min, max } = AXES[axis]
    const clamped = Math.max(min, Math.min(max, value))
    const t = (clamped - min) / (max - min)
    if (!markerEl) return
    if (vertical) {
      const pct = (1 - t) * 100 // higher real value = higher on screen
      markerEl.style.top = `${pct}%`
      if (labelEl) { labelEl.style.top = `${pct}%`; labelEl.textContent = value.toFixed(1) }
    } else {
      const pct = t * 100 // left = smaller X, right = larger X
      markerEl.style.left = `${pct}%`
      if (labelEl) { labelEl.style.left = `${pct}%`; labelEl.textContent = value.toFixed(1) }
    }
  }

  // ── Build ────────────────────────────────────────────────────────

  _buildDOM () {
    const shell = document.getElementById('omni-ui') ?? document.body

    this._els.vertical   = this._buildVertical()
    this._els.horizontal = this._buildHorizontal()
    this._els.depth      = this._buildDepth()
    this._els.settingsBtn = this._buildSettingsBtn()
    this._els.settingsPanel = this._buildSettingsPanel()

    shell.appendChild(this._els.vertical)
    shell.appendChild(this._els.horizontal)
    shell.appendChild(this._els.depth)
    shell.appendChild(this._els.settingsBtn)
    shell.appendChild(this._els.settingsPanel)

    this._els.vMarker = this._els.vertical.querySelector('.om-v-marker')
    this._els.vMarkerLabel = this._els.vertical.querySelector('.om-v-marker-label')
    this._els.hMarker = this._els.horizontal.querySelector('.om-h-marker')
    this._els.hMarkerLabel = this._els.horizontal.querySelector('.om-h-marker-label')
    this._els.dMarker = this._els.depth.querySelector('.om-d-marker')
    this._els.dMarkerLabel = this._els.depth.querySelector('.om-d-marker-label')
  }

  _axisLabel (axis) {
    const a = AXES[axis]
    return this._settings.labelStyle === 'xyz' ? a.xyzLabel : a.spatialLabel
  }

  _buildVertical () {
    const el = document.createElement('div')
    el.className = 'omni-meter-vertical'
    let ticks = ''
    const { min, max } = AXES.y
    for (let v = min; v <= max + 0.01; v += TICK_STEP) {
      const t = (v - min) / (max - min)
      const pct = (1 - t) * 100
      ticks += `<div class="om-v-tick" style="top:${pct}%"></div><div class="om-v-tick-label" style="top:${pct}%">${Math.round(v)}</div>`
    }
    el.innerHTML = `
      <div class="om-v-track"></div>
      ${ticks}
      <div class="om-v-marker"></div>
      <div class="om-v-marker-label">0.0</div>
    `
    return el
  }

  _buildHorizontal () {
    const el = document.createElement('div')
    el.className = 'omni-meter-horizontal'
    let ticks = ''
    const { min, max } = AXES.x
    for (let v = min; v <= max + 0.01; v += TICK_STEP) {
      const t = (v - min) / (max - min)
      const pct = t * 100
      ticks += `<div class="om-h-tick" style="left:${pct}%"></div><div class="om-h-tick-label" style="left:${pct}%">${Math.round(v)}</div>`
    }
    el.innerHTML = `
      <div class="om-h-track"></div>
      ${ticks}
      <div class="om-h-marker"></div>
      <div class="om-h-marker-label">0.0</div>
    `
    return el
  }

  _buildDepth () {
    const el = document.createElement('div')
    el.className = 'omni-meter-depth'
    let ticks = ''
    const { min, max } = AXES.z
    for (let v = min; v <= max + 0.01; v += TICK_STEP) {
      const t = (v - min) / (max - min)
      const pct = (1 - t) * 100
      ticks += `<div class="om-d-tick" style="top:${pct}%"></div><div class="om-d-tick-label" style="top:${pct}%">${Math.round(v)}</div>`
    }
    el.innerHTML = `
      <div class="om-d-track"></div>
      ${ticks}
      <div class="om-d-marker"></div>
      <div class="om-d-marker-label">0.0</div>
    `
    return el
  }

  _buildSettingsBtn () {
    const btn = document.createElement('button')
    btn.className = 'om-settings-btn'
    btn.type = 'button'
    btn.title = 'OmniMeter settings'
    btn.textContent = '⚙'
    return btn
  }

  _buildSettingsPanel () {
    const el = document.createElement('div')
    el.className = 'om-settings-panel'
    el.innerHTML = `
      <div class="om-settings-title">⟐OmniMeter</div>
      <label class="om-settings-row"><input type="checkbox" data-axis="showY" ${this._settings.showY ? 'checked' : ''}> <span data-axis-label="y"></span></label>
      <label class="om-settings-row"><input type="checkbox" data-axis="showX" ${this._settings.showX ? 'checked' : ''}> <span data-axis-label="x"></span></label>
      <label class="om-settings-row"><input type="checkbox" data-axis="showZ" ${this._settings.showZ ? 'checked' : ''}> <span data-axis-label="z"></span></label>
      <div class="om-settings-divider"></div>
      <button class="om-settings-label-toggle" data-action="toggle-label-style">Labels: ${this._settings.labelStyle === 'xyz' ? 'X / Y / Z' : 'Horiz / Vert / Depth'}</button>
    `
    return el
  }

  _refreshAxisLabels () {
    const panel = this._els.settingsPanel
    if (!panel) return
    panel.querySelector('[data-axis-label="y"]').textContent = this._axisLabel('y')
    panel.querySelector('[data-axis-label="x"]').textContent = this._axisLabel('x')
    panel.querySelector('[data-axis-label="z"]').textContent = this._axisLabel('z')
  }

  _bindSettingsUI () {
    this._els.settingsBtn.addEventListener('click', () => {
      this._els.settingsPanel.classList.toggle('open')
    })
    this._els.settingsPanel.querySelectorAll('[data-axis]').forEach(input => {
      input.addEventListener('change', () => {
        this._settings[input.dataset.axis] = input.checked
        this._saveSettings()
        this._applySettingsToDOM()
      })
    })
    this._els.settingsPanel.querySelector('[data-action="toggle-label-style"]').addEventListener('click', (e) => {
      this._settings.labelStyle = this._settings.labelStyle === 'xyz' ? 'spatial' : 'xyz'
      this._saveSettings()
      e.currentTarget.textContent = `Labels: ${this._settings.labelStyle === 'xyz' ? 'X / Y / Z' : 'Horiz / Vert / Depth'}`
      this._refreshAxisLabels()
    })
    this._refreshAxisLabels()
  }

  _applySettingsToDOM () {
    if (!this._isOpen) return
    this._els.vertical.classList.toggle('open', this._settings.showY)
    this._els.horizontal.classList.toggle('open', this._settings.showX)
    this._els.depth.classList.toggle('open', this._settings.showZ)
  }

  _loadSettings () {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')
      if (saved) this._settings = { ...DEFAULT_SETTINGS, ...saved }
    } catch (_) { /* keep defaults */ }
  }

  _saveSettings () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._settings)) } catch (_) {}
  }
}
