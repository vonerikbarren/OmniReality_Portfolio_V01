/**
 * ui/GlobalBar.js — ⟐mniReality Global Bar
 *
 * Persistent top-bar overlay spanning the full viewport width.
 * Two forms — collapsed (minimal, Apple-menu-bar style) and expanded
 * (full data grid, opens downward). Toggle lives in Col00.
 *
 * Column inventory:
 *   Col00  Identity        Logo + Expand toggle (▾ / ▴)
 *   Col01  User            Profile picture
 *   Col02  Profile         Name + Level
 *   Col03  Current State   Space name, time in space, current time
 *   Col04  Position        Pos X / Y / Z   (live, fed from scene)
 *   Col05  Rotation        Rot X / Y / Z   (live, fed from scene)
 *   Col06  Scale           Sca X / Y / Z   (live, fed from scene)
 *   Col07  Performance     FPS + Perf label (live, fed from scene)
 *   Col08  System Details  Roots / Parents / Child
 *   Col09  Dimension       Reality / Experience / Perspective
 *   Col10  Dimensional+    Time / Space / Object
 *
 * Public API:
 *   bar.setData({ pos, rot, scale, fps, spaceName, spaceEntryTime,
 *                 roots, parents, child,
 *                 reality, experience, perspective,
 *                 dimTime, dimSpace, dimObject })
 *
 * Follows the standard module contract (constructor / init / update / destroy)
 * but is a UI module — it does not touch the Three.js scene directly.
 *
 * GSAP is used for the expand / collapse animation.
 * Sound.play() is called for all user interactions.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { flashHeaderLine } from './Panel.js'
import OmniAddressBar from './OmniAddressBar.js'

// ── Constants ────────────────────────────────────────────────────────────────

const COLLAPSED_H = 48   // px — bar height (fixed now — no more expand/collapse)
const CATEGORIES  = ['Realities', 'Experiences', 'Perspectives', 'Times', 'Spaces', 'Objects', 'Windows', 'Assistance']

// ── Stylesheet (injected once) ───────────────────────────────────────────────

const STYLES = /* css */`

/* ── GlobalBar root ──────────────────────────────────────────────────────── */

#omni-global-bar {
  --bar-bg         : rgba(10, 10, 14, 0.72);
  --bar-border     : rgba(255, 255, 255, 0.08);
  --bar-text       : rgba(255, 255, 255, 0.95);
  --bar-text-dim   : rgba(255, 255, 255, 0.70);
  --bar-text-muted : rgba(255, 255, 255, 0.50);
  --bar-accent     : rgba(255, 255, 255, 0.92);
  --bar-glow       : 0 0 8px rgba(255, 255, 255, 0.25);
  --bar-separator  : rgba(255, 255, 255, 0.06);
  --label-size     : 9px;
  --value-size     : 11px;
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 0;
  left             : 0;
  width            : 100%;
  height           : ${COLLAPSED_H}px;
  overflow         : hidden;

  display          : flex;
  align-items      : stretch;

  background       : var(--bar-bg);
  backdrop-filter  : blur(18px) saturate(1.4);
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  border-bottom    : 1px solid var(--bar-border);

  font-family      : var(--mono);
  font-size        : var(--value-size);
  color            : var(--bar-text);
  z-index          : 50;
  pointer-events   : auto;
  user-select      : none;

  -webkit-font-smoothing : antialiased;
}

/* ── Column base ─────────────────────────────────────────────────────────── */

.ob-col {
  display         : flex;
  flex-direction  : column;
  justify-content : flex-start;
  align-items     : flex-start;
  padding         : 0 12px;
  min-width       : 0;
  flex-shrink     : 0;
  border-right    : 1px solid var(--bar-separator);
  position        : relative;
  height          : 100%;
}

.ob-col:last-child {
  border-right : none;
}

/* ── Hover — column brightens so it's clearer what's under the cursor ────── */

.ob-col {
  transition      : background 0.14s ease;
}

.ob-col:hover {
  background      : rgba(255, 255, 255, 0.035);
}

.ob-col:hover .ob-label,
.ob-col:hover .ob-value,
.ob-col:hover .ob-value.muted,
.ob-col:hover .ob-xyz-axis,
.ob-col:hover .ob-kv-key,
.ob-col:hover .ob-kv-val,
.ob-col:hover .ob-fps-unit {
  color           : rgba(255, 255, 255, 0.98);
}

/* ── Label row — pinned to collapsed height so all headers align ─────────── */

.ob-label-row {
  display         : flex;
  align-items     : center;
  height          : ${COLLAPSED_H}px;
  flex-shrink     : 0;
  min-height      : ${COLLAPSED_H}px;
}

.ob-label-row .ob-label {
  margin-bottom   : 0;
}

/* Data rows — sit below label row, revealed on expand */
.ob-data-rows {
  display         : flex;
  flex-direction  : column;
  gap             : 3px;
  padding-top     : 4px;
  padding-bottom  : 4px;
}

/* ── Column 00 — Identity / Toggle ──────────────────────────────────────── */

#ob-col00 {
  width           : 64px;
  flex-shrink     : 0;
  align-items     : center;
  justify-content : center;
  cursor          : pointer;
  padding         : 0 10px;
  gap             : 4px;
  /* full collapsed height is the touch target */
  min-height      : ${COLLAPSED_H}px;
}

#ob-col00:hover .ob-logo {
  text-shadow  : var(--bar-glow);
  color        : var(--bar-accent);
}

.ob-logo {
  font-size     : 35px;
  color         : var(--bar-accent);
  line-height   : 1;
  letter-spacing: 0;
  text-shadow   : 0 0 12px rgba(255,255,255,0.90), 0 0 24px rgba(255,255,255,0.45);
  transition    : text-shadow 0.2s ease, color 0.2s ease;
}

.ob-toggle {
  font-size    : 9px;
  color        : var(--bar-text-dim);
  line-height  : 1;
  transition   : color 0.2s ease;
}

#ob-col00:hover .ob-toggle {
  color: var(--bar-text);
}

/* ── Column 01 — Profile picture ────────────────────────────────────────── */

#ob-col01 {
  width           : 48px;
  align-items     : center;
  justify-content : center;
  padding         : 0 8px;
}

.ob-avatar {
  width         : 26px;
  height        : 26px;
  border-radius : 50%;
  background    : rgba(255,255,255,0.10);
  border        : 1px solid rgba(255,255,255,0.18);
  overflow      : hidden;
  display       : flex;
  align-items   : center;
  justify-content: center;
  font-size     : 9px;
  color         : var(--bar-text-dim);
  flex-shrink   : 0;
}

.ob-avatar img {
  width     : 100%;
  height    : 100%;
  object-fit: cover;
}

/* ── Typography helpers ──────────────────────────────────────────────────── */

.ob-label {
  font-size      : var(--label-size);
  color          : var(--bar-text);
  text-transform : uppercase;
  letter-spacing : 0.10em;
  line-height    : 1;
  white-space    : nowrap;
}

.ob-value {
  font-size    : var(--value-size);
  color        : var(--bar-text);
  line-height  : 1.3;
  white-space  : nowrap;
  overflow     : hidden;
  text-overflow: ellipsis;
}

.ob-value.bright {
  color      : var(--bar-accent);
  text-shadow: var(--bar-glow);
}

.ob-value.dim {
  color      : var(--bar-text-dim);
}

.ob-value.muted {
  color      : var(--bar-text-muted);
  font-style : italic;
}

/* XYZ row — three values in one line */
.ob-xyz {
  display : flex;
  flex-direction : column;
  gap     : 6px;
}

.ob-xyz-item {
  display    : flex;
  align-items: baseline;
  gap        : 2px;
}

.ob-xyz-axis {
  font-size     : 8px;
  color         : var(--bar-text-muted);
  text-transform: uppercase;
}

.ob-xyz-val {
  font-size  : 10px;
  color      : var(--bar-text);
  font-family: var(--mono);
  min-width  : 36px;
}

/* key–value pair */
.ob-kv {
  display    : flex;
  align-items: baseline;
  gap        : 5px;
}

.ob-kv-key {
  font-size     : 8px;
  color         : var(--bar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  flex-shrink   : 0;
}

.ob-kv-val {
  font-size    : 10px;
  color        : var(--bar-text-dim);
  font-family  : var(--mono);
  overflow     : hidden;
  text-overflow: ellipsis;
  white-space  : nowrap;
  max-width    : 90px;
}

.ob-kv-val.live {
  color : var(--bar-text);
}

.ob-kv-val.undef {
  color      : var(--bar-text-muted);
  font-style : italic;
}

/* ── Column sizing ───────────────────────────────────────────────────────── */

#ob-col02 { width: 110px; }
#ob-col03 { width: 160px; }
#ob-col04,
#ob-col05,
#ob-col06 { width: 130px; }
#ob-col07 { width:  90px; }
#ob-col08,
#ob-col09,
#ob-col10 { width: 120px; flex-shrink: 1; }

/* rightmost group grows to fill remaining space */
#ob-col10 { flex-grow: 1; border-right: none; }

/* ── FPS badge ───────────────────────────────────────────────────────────── */

.ob-fps-badge {
  display    : flex;
  align-items: baseline;
  gap        : 3px;
}

.ob-fps-num {
  font-size  : 14px;
  font-weight: bold;
  color      : var(--bar-accent);
  line-height: 1;
  font-family: var(--mono);
}

.ob-fps-unit {
  font-size     : 8px;
  color         : var(--bar-text-muted);
  text-transform: uppercase;
}

.ob-perf-label {
  font-size  : 9px;
  color      : var(--bar-text-dim);
  margin-top : 2px;
}

/* ── Separator accent line ───────────────────────────────────────────────── */

.ob-col-group::before {
  content   : '';
  position  : absolute;
  left      : 0;
  top       : 20%;
  height    : 60%;
  width     : 1px;
  background: rgba(255,255,255,0.15);
}

/* ── Mobile guard — trim the context menu, not hide it, below 700px ─────── */

@media (max-width: 700px) {
  .ob-app-title { display: none; }
  #ob-col03 { width: auto; flex-grow: 1; }
}

@media (max-width: 460px) {
  #ob-col02 { display: none; }
}

/* ── Global Context Menu ──────────────────────────────────────────────────── */

.ob-context-menu {
  flex             : 1;
  display          : flex;
  align-items      : center;
  gap              : 18px;
  padding          : 0 16px;
  min-width        : 0;
}

.ob-app-title {
  font-size        : 11px;
  font-weight      : bold;
  letter-spacing   : 0.04em;
  color            : var(--bar-text);
  white-space      : nowrap;
  flex-shrink      : 0;
}

.ob-menu-cats {
  display          : flex;
  gap              : 4px;
  height           : 100%;
  align-items      : center;
  overflow-x       : auto;
  scrollbar-width  : none;
}
.ob-menu-cats::-webkit-scrollbar { display: none; }

.ob-menu-cat {
  position         : relative;
  display          : flex;
  align-items      : center;
  height           : 100%;
}

.ob-menu-cat-btn {
  background       : none;
  border           : none;
  color            : var(--bar-text-dim);
  font-family      : var(--mono);
  font-size        : 10px;
  letter-spacing   : 0.03em;
  padding          : 6px 9px;
  border-radius    : 5px;
  cursor           : pointer;
  white-space      : nowrap;
  transition       : color 0.12s ease, background 0.12s ease;
}
.ob-menu-cat-btn:hover,
.ob-menu-cat-btn.is-open {
  color            : var(--bar-text);
  background       : rgba(255, 255, 255, 0.06);
}

/* Dropdown — the "quiet piece of light" reveal: no bounce, quick, calm */
.ob-menu-dropdown {
  position         : absolute;
  top              : 100%;
  left             : 0;
  min-width        : 200px;
  max-width        : 280px;
  background       : rgba(8, 8, 12, 0.95);
  backdrop-filter  : blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border           : 1px solid rgba(255, 255, 255, 0.12);
  border-radius    : 0 0 8px 8px;
  box-shadow       : 0 12px 32px rgba(0,0,0,0.5);
  padding          : 4px;
  z-index          : 60;
  overflow         : hidden;

  opacity          : 0;
  transform        : translateY(-4px) scaleY(0.94);
  transform-origin : top;
  pointer-events   : none;
}
.ob-menu-dropdown.is-open { pointer-events: auto; }

.ob-menu-dropdown .panel-glitch-line {
  position         : absolute;
  left             : 0;
  top              : 0;
  width            : 18%;
  height           : 2px;
  background       : rgba(255, 255, 255, 0.9);
  opacity          : 0;
  pointer-events   : none;
}

.ob-menu-item {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  gap              : 10px;
  padding          : 7px 10px;
  border-radius    : 5px;
  font-size        : 10.5px;
  color            : var(--bar-text-dim);
  cursor           : pointer;
  transition       : color 0.1s ease, background 0.1s ease;
}

/* Hover — darker background, brighter text (inverted from the usual
   pattern) — matches the project's dark-glass aesthetic, reads as
   "focus" rather than "glow". */
.ob-menu-item:hover {
  background       : rgba(0, 0, 0, 0.28);
  color            : var(--bar-text);
}

.ob-menu-item.is-window-closed { opacity: 0.55; }

.ob-menu-empty {
  padding          : 10px;
  font-size        : 9.5px;
  color            : var(--bar-text-muted);
  text-align       : center;
}

`

// ── Helper: inject stylesheet once ──────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-globalbar-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-globalbar-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Helper: format a float to fixed width ───────────────────────────────────

// ── GlobalBar class ──────────────────────────────────────────────────────────

export default class GlobalBar {

  constructor (context) {
    this.ctx       = context
    this._el       = null

    this._data = {
      pos           : { x: 0, y: 0, z: 0 },
      rot           : { x: 0, y: 0, z: 0 },
      scale         : { x: 1, y: 1, z: 1 },
      fps           : 0,
      perf          : '—',
      spaceName     : 'Root',
      spaceEntryTime: null,
      roots         : null,
      parents       : null,
      child         : null,
      reality       : null,
      experience    : null,
      perspective   : null,
      dimTime       : null,
      dimSpace      : null,
      dimObject     : null,
    }

    this._fpsBuffer   = []
    this._lastFpsTick = performance.now()
    this._frameCount  = 0
  }

  // ── Module contract ─────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildDOM()
    this._bindEvents()
    this._mountNotifyAddressBar()
    this._clockInterval = setInterval(() => this._tickClock(), 1000)
  }

  _mountNotifyAddressBar () {
    const slot = document.getElementById('ob-notify-address-bar-slot')
    if (!slot) return
    this._notifyAddressBar = new OmniAddressBar({ size: 'main' })
    const barEl = this._notifyAddressBar.mount()
    slot.appendChild(barEl)

    const col = document.getElementById('ob-col-notify')
    col?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:notify-panel-toggle'))
    })
    col.style.cursor = 'pointer'
  }

  update (delta) {
    // Real, per-frame update — milliseconds change continuously, so
    // this can't ride the 1Hz _tickClock() interval above; every
    // frame keeps it genuinely live rather than stepping once a
    // second like the HH:MM:SS row does.
    this._setEl('ob-current-ms', String(new Date().getMilliseconds()).padStart(3, '0'))

    this._frameCount++
    const now = performance.now()
    if (now - this._lastFpsTick >= 500) {
      const elapsed = (now - this._lastFpsTick) / 1000
      const fps     = this._frameCount / elapsed
      this._frameCount  = 0
      this._lastFpsTick = now

      this._fpsBuffer.push(fps)
      if (this._fpsBuffer.length > 4) this._fpsBuffer.shift()
      const avg = this._fpsBuffer.reduce((a, b) => a + b, 0) / this._fpsBuffer.length

      this._data.fps  = Math.round(avg)
      this._data.perf = avg >= 55 ? 'smooth' : avg >= 30 ? 'moderate' : 'low'

      this._refreshFPS()
    }
  }

  destroy () {
    clearInterval(this._clockInterval)
    this._notifyAddressBar?.destroy()
    window.removeEventListener('omni:frontmost-changed', this._onFrontmostChanged)
    document.removeEventListener('click', this._onDocumentClick)
    if (this._el?.parentNode) this._el.parentNode.removeChild(this._el)
    document.getElementById('omni-globalbar-styles')?.remove()
  }

  // ── Public API ──────────────────────────────────────────────────────────

  setData (data) {
    Object.assign(this._data, data)
    this._refreshAll()
  }

  // ── DOM construction ────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id        = 'omni-global-bar'
    el.innerHTML = this._template()
    this._el     = el

    const shell = document.getElementById('omni-ui')
    if (shell) shell.appendChild(el)
    else        document.body.appendChild(el)
  }

  _template () {
    return /* html */`

      <!-- Col00 — Identity -->
      <div class="ob-col" id="ob-col00">
        <span class="ob-logo">⟐</span>
      </div>

      <!-- Col01 — User avatar -->
      <div class="ob-col" id="ob-col01">
        <div class="ob-avatar" id="ob-avatar" title="User">
          <span>⟐</span>
        </div>
      </div>

      <!-- Col02 — Profile name + level -->
      <div class="ob-col" id="ob-col02">
        <div class="ob-label-row">
          <span class="ob-label">Profile</span>
        </div>
        <div class="ob-data-rows">
          <div class="ob-value bright" id="ob-username">Anonymous</div>
          <div class="ob-value dim"   id="ob-level">Lv 0</div>
        </div>
      </div>

      <!-- Col03 — Current State -->
      <div class="ob-col" id="ob-col03">
        <div class="ob-label-row">
          <span class="ob-label">Current State</span>
        </div>
        <div class="ob-data-rows">
          <div class="ob-kv">
            <span class="ob-kv-key">Space</span>
            <span class="ob-kv-val live" id="ob-space-name">Root</span>
          </div>
          <div class="ob-kv">
            <span class="ob-kv-key">In&nbsp;space</span>
            <span class="ob-kv-val live" id="ob-time-in-space">00:00:00</span>
          </div>
          <div class="ob-kv">
            <span class="ob-kv-key">Time</span>
            <span class="ob-kv-val live" id="ob-current-time">--:--:--</span>
          </div>
          <div class="ob-kv">
            <span class="ob-kv-key">ms</span>
            <span class="ob-kv-val live" id="ob-current-ms">---</span>
          </div>
        </div>
      </div>

      <!-- Col04 — Notifications: OmniAddressBar + drop-down trigger.
           Deliberately living in GlobalBar's own, already-reserved
           space rather than a new floating top-right element, which
           would otherwise collide with ConsciousHand directly below. -->
      <div class="ob-col" id="ob-col-notify">
        <div class="ob-label-row">
          <span class="ob-label">⟐Notify</span>
        </div>
        <div id="ob-notify-address-bar-slot"></div>
      </div>

      <!-- Global Context Menu — App title + 8 fixed categories, contents
           adapt to whichever panel currently has focus (WindowManager's
           frontmost tracking). See OmniDimensionalApps.md. -->
      <div class="ob-context-menu" id="ob-context-menu">
        <span class="ob-app-title" id="ob-app-title">⟐OmniEXP</span>
        <div class="ob-menu-cats" id="ob-menu-cats"></div>
      </div>

    `
  }

  // ── Event binding ────────────────────────────────────────────────────────

  _bindEvents () {
    this._buildContextMenu()
    this._onFrontmostChanged = (e) => this._refreshContextMenu(e.detail?.id)
    window.addEventListener('omni:frontmost-changed', this._onFrontmostChanged)

    this._onDocumentClick = () => this._closeAllDropdowns()
    document.addEventListener('click', this._onDocumentClick)
  }

  // ── Global Context Menu ──────────────────────────────────────────────────

  _buildContextMenu () {
    const container = this._el.querySelector('#ob-menu-cats')
    if (!container) return

    container.innerHTML = CATEGORIES.map(cat => /* html */`
      <div class="ob-menu-cat" data-cat="${cat}">
        <button class="ob-menu-cat-btn" data-cat-btn="${cat}">${cat}</button>
        <div class="ob-menu-dropdown" data-dropdown="${cat}">
          <span class="panel-glitch-line" aria-hidden="true"></span>
          <div class="ob-menu-dropdown-list" data-list="${cat}"></div>
        </div>
      </div>
    `).join('')

    container.querySelectorAll('[data-cat-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const cat = btn.dataset.catBtn
        const wasOpen = btn.classList.contains('is-open')
        this._closeAllDropdowns()
        if (!wasOpen) this._openDropdown(cat)
      })
    })

    this._refreshContextMenu(WindowManager.getFrontmost())
  }

  /** Quiet, non-bouncy reveal — power2.out, no overshoot — plus the same
   *  light-sweep used across ui/OmniDraw.js and elsewhere, so this reads
   *  as the same visual language rather than a one-off effect. */
  _openDropdown (cat) {
    const btn      = this._el.querySelector(`[data-cat-btn="${cat}"]`)
    const dropdown = this._el.querySelector(`[data-dropdown="${cat}"]`)
    if (!btn || !dropdown) return

    btn.classList.add('is-open')
    dropdown.classList.add('is-open')
    gsap.to(dropdown, { opacity: 1, y: 0, scaleY: 1, duration: 0.18, ease: 'power2.out' })
    flashHeaderLine(dropdown, 'rgba(255,255,255,0.85)')
    this._playSound('open')
  }

  _closeAllDropdowns () {
    this._el?.querySelectorAll('.ob-menu-cat-btn.is-open').forEach(b => b.classList.remove('is-open'))
    this._el?.querySelectorAll('.ob-menu-dropdown.is-open').forEach(dd => {
      dd.classList.remove('is-open')
      gsap.to(dd, { opacity: 0, y: -4, scaleY: 0.94, duration: 0.12, ease: 'power1.in' })
    })
  }

  /**
   * Rebuilds the app title + all 8 dropdowns' contents for whichever
   * panel id is now frontmost. `Windows` is special-cased — it's always
   * auto-populated from WindowManager's registry, not from a panel's
   * own registered categories.
   */
  _refreshContextMenu (frontmostId) {
    this._setEl('ob-app-title', frontmostId ? WindowManager.getLabel(frontmostId) : '⟐OmniEXP')
    const categories = frontmostId ? WindowManager.getContextMenu(frontmostId) : {}

    CATEGORIES.forEach(cat => {
      const list = this._el?.querySelector(`[data-list="${cat}"]`)
      if (!list) return

      if (cat === 'Windows') {
        const windows = WindowManager.getRegisteredWindows()
        list.innerHTML = windows.length
          ? windows.map(w => /* html */`
              <div class="ob-menu-item ${w.isOpen ? '' : 'is-window-closed'}" data-window-id="${w.id}">
                <span>${w.label}</span>
              </div>`).join('')
          : `<div class="ob-menu-empty">No windows open</div>`
        list.querySelectorAll('[data-window-id]').forEach(item => {
          item.addEventListener('click', () => {
            WindowManager.bringToFront(item.dataset.windowId)
            this._playSound('click')
            this._closeAllDropdowns()
          })
        })
        return
      }

      const items = categories[cat] ?? []
      list.innerHTML = items.length
        ? items.map((it, i) => `<div class="ob-menu-item" data-action-idx="${i}"><span>${it.label}</span></div>`).join('')
        : `<div class="ob-menu-empty">No actions here</div>`
      list.querySelectorAll('[data-action-idx]').forEach(item => {
        const idx = Number(item.dataset.actionIdx)
        item.addEventListener('click', () => {
          try { items[idx]?.action?.() } catch (err) { console.warn('⟐GlobalBar — context action failed:', err) }
          this._playSound('click')
          this._closeAllDropdowns()
        })
      })
    })
  }

  // ── Clock tick (1 Hz) ────────────────────────────────────────────────────

  _tickClock () {
    const now = new Date()
    const hh  = String(now.getHours()).padStart(2, '0')
    const mm  = String(now.getMinutes()).padStart(2, '0')
    const ss  = String(now.getSeconds()).padStart(2, '0')
    this._setEl('ob-current-time', `${hh}:${mm}:${ss}`)

    if (this._data.spaceEntryTime instanceof Date) {
      const elapsed = Math.floor((now - this._data.spaceEntryTime) / 1000)
      const eh = String(Math.floor(elapsed / 3600)).padStart(2, '0')
      const em = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
      const es = String(elapsed % 60).padStart(2, '0')
      this._setEl('ob-time-in-space', `${eh}:${em}:${es}`)
    }
  }

  // ── Refresh helpers ──────────────────────────────────────────────────────

  _refreshAll () {
    const d = this._data
    this._setEl('ob-space-name', d.spaceName || 'Root')
    this._broadcastData()
  }

  _refreshFPS () {
    this._broadcastData()
  }

  /** Q1 of OmniStartHUD renders this same data — see ui/OmniStartHUD.js. */
  _broadcastData () {
    window.dispatchEvent(new CustomEvent('omni:globalbar-data', { detail: { ...this._data } }))
  }

  _setEl (id, text) {
    const el = this._el?.querySelector(`#${id}`)
    if (el) el.textContent = text
  }

  _setKV (id, value) {
    const el = this._el?.querySelector(`#${id}`)
    if (!el) return
    if (value == null) {
      el.textContent = 'undefined'
      el.classList.add('undef')
      el.classList.remove('live')
    } else {
      el.textContent = String(value)
      el.classList.remove('undef')
      el.classList.add('live')
    }
  }

  // ── Sound ────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}