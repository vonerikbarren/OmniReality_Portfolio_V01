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

// ── Constants ────────────────────────────────────────────────────────────────

const COLLAPSED_H = 48   // px — collapsed bar height (increased for touch)
const EXPANDED_H  = 130   // px — expanded bar height
const ANIM_DUR    = 0.32 // seconds — expand / collapse tween

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
  height          : ${EXPANDED_H}px;  /* full height always — bar clips */
}

.ob-col:last-child {
  border-right : none;
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
  margin-top    : -80px;
  margin-bottom : -10px;
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
  color          : var(--bar-text-muted);
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

/* ── Mobile guard — hide numeric columns below 700 px ───────────────────── */

@media (max-width: 700px) {
  #ob-col04,
  #ob-col05,
  #ob-col06,
  #ob-col07,
  #ob-col08,
  #ob-col09,
  #ob-col10 {
    display: none;
  }
  #ob-col03 { width: auto; flex-grow: 1; }
}

@media (max-width: 460px) {
  #ob-col02 { display: none; }
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

function fmt (n, decimals = 2) {
  if (n == null || isNaN(n)) return '---'
  const s = Number(n).toFixed(decimals)
  return n >= 0 ? ' ' + s : s
}

// ── Helper: build an XYZ triple element ─────────────────────────────────────

function xyzEl (idPrefix) {
  return /* html */`
    <div class="ob-xyz">
      <div class="ob-xyz-item">
        <span class="ob-xyz-axis">x</span>
        <span class="ob-xyz-val" id="${idPrefix}-x">  0.00</span>
      </div>
      <div class="ob-xyz-item">
        <span class="ob-xyz-axis">y</span>
        <span class="ob-xyz-val" id="${idPrefix}-y">  0.00</span>
      </div>
      <div class="ob-xyz-item">
        <span class="ob-xyz-axis">z</span>
        <span class="ob-xyz-val" id="${idPrefix}-z">  0.00</span>
      </div>
    </div>`
}

// ── Helper: key–value row ────────────────────────────────────────────────────

function kvEl (key, id, modifiers = '') {
  return /* html */`
    <div class="ob-kv">
      <span class="ob-kv-key">${key}</span>
      <span class="ob-kv-val undef ${modifiers}" id="${id}">undefined</span>
    </div>`
}

// ── GlobalBar class ──────────────────────────────────────────────────────────

export default class GlobalBar {

  constructor (context) {
    this.ctx       = context
    this._el       = null
    this._expanded = false

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
    this._clockInterval = setInterval(() => this._tickClock(), 1000)
  }

  update (delta) {
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
    if (this._el?.parentNode) this._el.parentNode.removeChild(this._el)
    document.getElementById('omni-globalbar-styles')?.remove()
  }

  // ── Public API ──────────────────────────────────────────────────────────

  setData (data) {
    Object.assign(this._data, data)
    this._refreshAll()
  }

  setExpanded (val) {
    if (val === this._expanded) return
    this._expanded = val
    this._animateBar()
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

      <!-- Col00 — Identity + toggle -->
      <div class="ob-col" id="ob-col00" title="Toggle Global Bar">
        <span class="ob-logo">⟐</span>
        <span class="ob-toggle" id="ob-toggle-arrow">▾</span>
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
        </div>
      </div>

      <!-- Col04 — Position -->
      <div class="ob-col ob-col-group" id="ob-col04">
        <div class="ob-label-row">
          <span class="ob-label">Position</span>
        </div>
        <div class="ob-data-rows">
          ${xyzEl('ob-pos')}
        </div>
      </div>

      <!-- Col05 — Rotation -->
      <div class="ob-col ob-col-group" id="ob-col05">
        <div class="ob-label-row">
          <span class="ob-label">Rotation</span>
        </div>
        <div class="ob-data-rows">
          ${xyzEl('ob-rot')}
        </div>
      </div>

      <!-- Col06 — Scale -->
      <div class="ob-col ob-col-group" id="ob-col06">
        <div class="ob-label-row">
          <span class="ob-label">Scale</span>
        </div>
        <div class="ob-data-rows">
          ${xyzEl('ob-sca')}
        </div>
      </div>

      <!-- Col07 — Performance -->
      <div class="ob-col ob-col-group" id="ob-col07">
        <div class="ob-label-row">
          <span class="ob-label">Perf</span>
        </div>
        <div class="ob-data-rows">
          <div class="ob-fps-badge">
            <span class="ob-fps-num" id="ob-fps">--</span>
            <span class="ob-fps-unit">fps</span>
          </div>
          <div class="ob-perf-label" id="ob-perf">—</div>
        </div>
      </div>

      <!-- Col08 — System Details -->
      <div class="ob-col ob-col-group" id="ob-col08">
        <div class="ob-label-row">
          <span class="ob-label">Roots</span>
        </div>
        <div class="ob-data-rows">
          ${kvEl('Roots',   'ob-roots')}
          ${kvEl('Parents', 'ob-parents')}
          ${kvEl('Child',   'ob-child')}
        </div>
      </div>

      <!-- Col09 — Dimension Details -->
      <div class="ob-col ob-col-group" id="ob-col09">
        <div class="ob-label-row">
          <span class="ob-label">Reality</span>
        </div>
        <div class="ob-data-rows">
          ${kvEl('Reality',     'ob-reality')}
          ${kvEl('Experience',  'ob-experience')}
          ${kvEl('Perspective', 'ob-perspective')}
        </div>
      </div>

      <!-- Col10 — Dimensional Details cont. -->
      <div class="ob-col ob-col-group" id="ob-col10">
        <div class="ob-label-row">
          <span class="ob-label">Time</span>
        </div>
        <div class="ob-data-rows">
          ${kvEl('Time',   'ob-dim-time')}
          ${kvEl('Space',  'ob-dim-space')}
          ${kvEl('Object', 'ob-dim-object')}
        </div>
      </div>

    `
  }

  // ── Event binding ────────────────────────────────────────────────────────

  _bindEvents () {
    const col00 = this._el.querySelector('#ob-col00')
    col00.addEventListener('click', () => {
      this._playSound('click')
      this._expanded = !this._expanded
      this._animateBar()
    })
  }

  // ── Animation ────────────────────────────────────────────────────────────

  _animateBar () {
    const arrow = this._el.querySelector('#ob-toggle-arrow')

    if (this._expanded) {
      this._playSound('open')
      gsap.to(this._el, { height: EXPANDED_H, duration: ANIM_DUR, ease: 'power2.out' })
      if (arrow) arrow.textContent = '▴'
    } else {
      this._playSound('close')
      gsap.to(this._el, { height: COLLAPSED_H, duration: ANIM_DUR, ease: 'power2.inOut' })
      if (arrow) arrow.textContent = '▾'
    }
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

    if (d.pos) {
      this._setEl('ob-pos-x', fmt(d.pos.x))
      this._setEl('ob-pos-y', fmt(d.pos.y))
      this._setEl('ob-pos-z', fmt(d.pos.z))
    }

    if (d.rot) {
      this._setEl('ob-rot-x', fmt(d.rot.x))
      this._setEl('ob-rot-y', fmt(d.rot.y))
      this._setEl('ob-rot-z', fmt(d.rot.z))
    }

    if (d.scale) {
      this._setEl('ob-sca-x', fmt(d.scale.x))
      this._setEl('ob-sca-y', fmt(d.scale.y))
      this._setEl('ob-sca-z', fmt(d.scale.z))
    }

    this._setKV('ob-roots',       d.roots)
    this._setKV('ob-parents',     d.parents)
    this._setKV('ob-child',       d.child)
    this._setKV('ob-reality',     d.reality)
    this._setKV('ob-experience',  d.experience)
    this._setKV('ob-perspective', d.perspective)
    this._setKV('ob-dim-time',    d.dimTime)
    this._setKV('ob-dim-space',   d.dimSpace)
    this._setKV('ob-dim-object',  d.dimObject)
  }

  _refreshFPS () {
    this._setEl('ob-fps',  String(this._data.fps))
    this._setEl('ob-perf', this._data.perf)
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