/**
 * modules/TerminalShellTunnel.js — ⟐T TerminalShellTunnel (V192): ONE in-scene terminal.
 *
 * A black cylinder (the "tunnel within the tunnel") with a CanvasTexture panel at its centre that shows the shared terminal session
 * (utils/TerminalSession.js): the output, and the line being typed with a caret. Two kinds of instance:
 *   - the BUILT-IN shell (modules/TerminalTunnel.js): at the centre of the Root, the panel follows the camera height (setting panelPosition);
 *   - a NODE shell (systems/TerminalShellNodes.js): the tunnel sits on a TerminalShellTunnel node (data.nodeKind 'terminalShell') and moves with it.
 *
 * Every instance follows the ONE master on/off of utils/TerminalShells.js (`omni:terminal-shells-state`), like the hand tunnels follow their pads:
 * a Terminal button turns ALL of them on or off together. It reads isOn() when it is built, so a tunnel created later joins the others.
 *
 * Colours: the palette of the active OmniOS theme (utils/TerminalSettings.js getPalette) or the custom colours; redrawn live on
 * `omni:terminal-settings-changed` (which also announces theme changes). Orientation: billboard (faces the camera) or fixed yaw / pitch / roll,
 * per shell (utils/TerminalShells.js) or the Terminal settings default (utils/TerminalOrientation.js).
 * Typing: see utils/TerminalSceneInput.js (a click on the panel gives it the keyboard).
 *
 * Module contract: constructor(context, opts) / init (guarded against a second call) / update(delta) / destroy / onResize.
 * Context: { scene, camera, renderer?, sizes, ticker }. opts: { builtin, shellId, nodeId, omniNode, name }.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import { getSettings, getPalette, startThemeLive, stopThemeLive } from '../utils/TerminalSettings.js'
import { parseColor, withAlpha, toHex } from '../utils/TerminalTheme.js'
import { billboardRoll, panelEuler, panelYOverride, orientationOf } from '../utils/TerminalOrientation.js'
import * as Shells from '../utils/TerminalShells.js'
import * as Session from '../utils/TerminalSession.js'
import { retainInput, releaseInput } from '../utils/TerminalSceneInput.js'

const BUILTIN = { radius: 10, height: 260, y: 28, panelW: 5, panelH: 3.5 }   // matches RootSpace center offset
const NODE = { radius: 6, height: 30, y: 0, panelW: 4.4, panelH: 3.1 }
const TERMINAL_SEGMENTS = 48
const CANVAS_W = 512
const CANVAS_H = 360
const HEADER_H = 36
const LINE_H = 18
const FONT_PX = 12
const NEAR_CENTER = 3      // built-in tunnel: a camera this close to the centre axis (the landing point is ON it) would sit inside the panel
const VIEW_DIST = 4.5      // ...so the panel stands this far in front of the camera instead
const BLINK_S = 0.5
const MIN_REDRAW_S = 0.05

export default class TerminalShellTunnel {
  constructor (context, opts = {}) {
    this.ctx = context
    this.opts = { builtin: false, shellId: null, nodeId: null, omniNode: null, name: null, ...opts }
    this.builtin = !!this.opts.builtin
    this.shellId = this.opts.shellId ?? null
    this.nodeId = this.opts.nodeId ?? null
    /** the key the keyboard focus is stored under (utils/TerminalShells.js getFocus) */
    this.focusKey = this.builtin ? 'home' : (this.shellId ?? this.nodeId ?? 'shell')
    this.dim = this.builtin ? BUILTIN : NODE
    this.group = new THREE.Group()
    this.group.name = this.builtin ? 'terminal-tunnel' : `terminal-shell:${this.shellId ?? this.nodeId}`

    this._cylinder = null
    this._wireLines = null
    this._panel = null
    this._canvas = null
    this._ctx2d = null
    this._texture = null
    this._visible = false
    this._inited = 0
    this._bound = []
    this._dirty = true
    this._sinceDraw = 0
    this._blink = 0
    this._caretOn = true
    this._palSig = ''
    this._raycaster = null
    this._ndc = null
    this._tmpV = new THREE.Vector3()
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not build twice
    this._buildCylinder()
    this._buildPanel()

    // Start hidden; the master flag decides below
    this.group.scale.set(0, 0, 0)
    this.group.visible = false
    this.ctx.scene.add(this.group)

    const on = (target, name, fn, opt) => { target.addEventListener(name, fn, opt); this._bound.push([target, name, fn, opt]) }
    on(window, Shells.STATE_EVENT, (e) => this._applyState(!!e.detail?.on))
    // Real, live update — re-renders the panel (colours, text, orientation) when a setting or the theme changes while this is visible
    on(window, 'omni:terminal-settings-changed', () => { this._recolor(); this._dirty = true })
    on(window, 'omni:terminal-session-changed', () => { this._dirty = true })
    on(window, 'omni:terminal-focus-changed', () => { this._dirty = true })
    on(window, Shells.CHANGED_EVENT, () => { this._dirty = true })
    const dom = this.ctx.renderer?.domElement
    if (dom?.addEventListener) {
      this._raycaster = new THREE.Raycaster()
      this._ndc = new THREE.Vector2()
      on(dom, 'pointerdown', (e) => this._onPointerDown(e))
    }

    Shells.retain()
    retainInput()
    startThemeLive()
    Shells.registerLive(this)
    if (!this.builtin) this._followNode()   // stand on the node from the first frame, even while hidden
    // Join the others: a tunnel built while the terminals are ON appears at once (no tween), one built while OFF stays hidden.
    if (Shells.isOn()) this._showNow()
  }

  update (delta = 0) {
    if (!this.group.visible) return
    if (!this.builtin) this._followNode()
    if (this._panel) {
      this._updatePanelPosition()
      this._updatePanelOrientation()
    }
    this._blink += delta
    if (this._blink >= BLINK_S) {
      this._blink = 0
      this._caretOn = !this._caretOn
      if (Shells.getFocus() === this.focusKey) this._dirty = true
    }
    this._sinceDraw += delta
    if (this._dirty && this._sinceDraw >= MIN_REDRAW_S) this._render()
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._inited = 0
    this._bound.forEach(([t, n, f, o]) => t.removeEventListener(n, f, o))
    this._bound = []
    gsap.killTweensOf(this.group.scale)
    Shells.unregisterLive(this)
    if (Shells.getFocus() === this.focusKey) Shells.setFocus(null)
    Shells.release()
    releaseInput()
    stopThemeLive()
    this._texture?.dispose()
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
    this.ctx.scene.remove(this.group)
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Whether this tunnel is currently shown (or growing in). */
  isShown () { return this._visible }

  /** Spawn the tunnel into the scene. Normally driven by the master flag; kept as a public method (tests, other modules). */
  invoke () {
    if (this._visible) return
    this._visible = true
    this._dirty = true
    if (!this.builtin) this._followNode()
    this.group.visible = true
    gsap.killTweensOf(this.group.scale)
    gsap.fromTo(this.group.scale,
      { x: 0.01, y: 0.01, z: 0.01 },
      { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.4)' }
    )
  }

  /** Remove the tunnel from view. */
  dismiss () {
    if (!this._visible) return
    this._visible = false
    gsap.killTweensOf(this.group.scale)
    gsap.to(this.group.scale, {
      x: 0.01, y: 0.01, z: 0.01,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        this.group.visible = false
        this.group.scale.set(0, 0, 0)
      },
    })
  }

  /** Follow the master flag: make this tunnel match it (idempotent, so a missed announcement is repaired by the next one). */
  _applyState (on) {
    if (on) this.invoke(); else this.dismiss()
  }

  _showNow () {
    this._visible = true
    this._dirty = true
    this.group.visible = true
    this.group.scale.set(1, 1, 1)
  }

  // ── Building ────────────────────────────────────────────────────────────────

  _buildCylinder () {
    const d = this.dim
    const geo = new THREE.CylinderGeometry(d.radius, d.radius, d.height, TERMINAL_SEGMENTS, 2, true)
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0.92 })
    this._cylinder = new THREE.Mesh(geo, mat)
    this._cylinder.position.y = d.y
    this._cylinder.name = 'terminal-cylinder'
    this.group.add(this._cylinder)

    // Subtle scanline tint on the inner surface — wireframe overlay (colour = the palette accent)
    const wireGeo = new THREE.CylinderGeometry(d.radius - 0.1, d.radius - 0.1, d.height, TERMINAL_SEGMENTS, 20, true)
    const wireEdges = new THREE.EdgesGeometry(wireGeo)
    const wireMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.08 })
    const wireLines = new THREE.LineSegments(wireEdges, wireMat)
    wireLines.position.y = d.y
    wireGeo.dispose()
    this._wireLines = wireLines   // stored reference — a later settings / theme change re-colours it
    this.group.add(wireLines)
    this._recolor()
  }

  _buildPanel () {
    this._canvas = document.createElement('canvas')
    this._canvas.width = CANVAS_W
    this._canvas.height = CANVAS_H
    this._ctx2d = this._canvas.getContext('2d')
    this._texture = new THREE.CanvasTexture(this._canvas)
    this._render()

    const geo = new THREE.PlaneGeometry(this.dim.panelW, this.dim.panelH)
    const mat = new THREE.MeshBasicMaterial({ map: this._texture, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    this._panel = new THREE.Mesh(geo, mat)
    this._panel.position.set(0, this.builtin ? 2.5 : 0, 0)   // eye level, center of the tunnel
    this._panel.name = 'terminal-panel'
    this._panel.userData.terminalShell = this.focusKey
    this.group.add(this._panel)
  }

  /** Cylinder wall + wire follow the palette (theme or custom colours). */
  _recolor () {
    const pal = getPalette()
    const bg = parseColor(withAlpha(pal.bg, 1)) ?? [0, 0, 0]
    // the wall is the theme background, darkened a little so the panel stays readable against it
    this._cylinder?.material.color.set(toHex(bg.map(v => v * 0.55)))
    const ac = parseColor(pal.accent)
    if (ac) this._wireLines?.material.color.set(toHex(ac))
  }

  // ── Placement ───────────────────────────────────────────────────────────────

  _followNode () {
    const mesh = this.opts.omniNode?.getMeshById?.(this.nodeId)
    if (!mesh) return
    mesh.getWorldPosition(this._tmpV)
    this.group.position.copy(this._tmpV)
  }

  _updatePanelPosition () {
    const camera = this.ctx.camera
    const y0 = panelYOverride(this._orientation())
    if (!this.builtin) {
      this._panel.position.set(0, y0 == null ? 0 : y0 - this.group.position.y, 0)
      return
    }
    const { panelPosition } = getSettings()
    const camY = y0 == null ? camera.position.y : y0
    if (panelPosition === 'circumference') {
      // Real, live angle toward the camera's own current position (relative to the tunnel's own center), so this stays near
      // the camera rather than parked at a fixed spot on the ring that could end up out of view entirely.
      const angle = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z)
      this._panel.position.set(Math.sin(angle) * BUILTIN.radius * 0.85, camY, Math.cos(angle) * BUILTIN.radius * 0.85)
    } else if (Math.hypot(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z) < NEAR_CENTER) {
      // 'center', but the camera is standing in the centre (the landing point (0, 2, 0.001) is): a panel AT the camera is inside the near plane and
      // never seen, so it stands in front of the camera along its horizontal look direction until the camera moves away from the axis.
      const dir = this._tmpV.set(0, 0, 0); camera.getWorldDirection(dir)
      const len = Math.hypot(dir.x, dir.z) || 1
      const fx = len < 1e-3 ? 0 : dir.x / len; const fz = len < 1e-3 ? -1 : dir.z / len
      this._panel.position.set(camera.position.x + fx * VIEW_DIST, camY, camera.position.z + fz * VIEW_DIST)
    } else {
      // 'center' — real, live Y-tracking, X/Z held at the tunnel's own real center, per direct request ("limited to the center for now").
      this._panel.position.set(0, camY, 0)
    }
  }

  /** The orientation in force for this shell: its own, or the Terminal settings default. */
  _orientation () {
    return Shells.effectiveOrientation(this.shellId, getSettings().orientation)
  }

  _updatePanelOrientation () {
    const o = orientationOf(this._orientation())
    if (o.billboard) {
      this._panel.lookAt(this.ctx.camera.position)
      const roll = billboardRoll(o)
      if (roll) this._panel.rotateZ(roll)
    } else {
      const e = panelEuler(o)
      this._panel.rotation.set(e.x, e.y, e.z, e.order)
    }
  }

  // ── Pointer: a click on the panel gives it the keyboard ─────────────────────

  _onPointerDown (e) {
    if (!this.group.visible || !this._panel || !this._raycaster) return
    const dom = this.ctx.renderer.domElement
    const rect = dom.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 1, height: 1 }
    if (!rect.width || !rect.height) return
    this._ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1))
    try {
      this._panel.updateWorldMatrix(true, false)
      this._raycaster.setFromCamera(this._ndc, this.ctx.camera)
      const hit = this._raycaster.intersectObject(this._panel, false).length > 0
      if (hit) { if (getSettings().inputSurface !== 'dom') Shells.setFocus(this.focusKey) }
      else if (Shells.getFocus() === this.focusKey) Shells.setFocus(null)
    } catch (_) { /* a ray failure must never break the click */ }
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  _render () {
    this._dirty = false
    this._sinceDraw = 0
    const c = this._ctx2d
    if (!c) return
    const w = CANVAS_W; const h = CANVAS_H
    const pal = getPalette()
    const s = getSettings()
    const focused = Shells.getFocus() === this.focusKey && Shells.isOn()
    const font = (px) => `${px}px ${pal.font}`

    c.clearRect(0, 0, w, h)
    // Panel background — the theme background at the chosen opacity
    c.fillStyle = pal.bg
    this._roundRect(c, 0, 0, w, h, 16)
    c.fill()
    // Border
    c.strokeStyle = pal.border
    c.lineWidth = 2
    this._roundRect(c, 1, 1, w - 2, h - 2, 15)
    c.stroke()
    // Header bar
    c.fillStyle = pal.headerBg
    c.fillRect(1, 1, w - 2, HEADER_H)
    c.fillStyle = pal.accent
    c.font = font(13)
    c.fillText(`⟐T  ${this.builtin ? 'TERMINAL TUNNEL' : (this._title() || 'TERMINAL SHELL')}`, 16, 24)
    // Where the user types, and the close glyph
    c.fillStyle = pal.muted
    c.font = font(10)
    const hint = s.inputSurface === 'dom' ? 'typing: DOM panel' : (focused ? 'typing · Esc closes' : 'click to type')
    c.textAlign = 'right'
    c.fillText(hint, w - 40, 23)
    c.font = font(13)
    c.fillText('✕', w - 16, 24)
    c.textAlign = 'left'

    // Body: the last rows of the shared session, then the line being typed
    c.font = font(FONT_PX)
    const cw = (typeof c.measureText === 'function' ? c.measureText('M')?.width : 0) || FONT_PX * 0.6
    const cols = Math.max(20, Math.floor((w - 32) / cw))
    const top = HEADER_H + 24
    const rows = Math.max(3, Math.floor((h - top - 10) / LINE_H))
    const showCaret = focused && this._caretOn
    const layout = Session.layoutRows(Session.getLines(), Session.getDraft(), cols, rows, { prompt: '⟐ ', caret: showCaret ? '▮' : ' ', showCaret: s.inputSurface !== 'dom' })
    layout.forEach((row, i) => {
      const y = top + i * LINE_H
      if (row.cls === 'draft') {
        if (focused) { c.fillStyle = pal.selection; c.fillRect(8, y - FONT_PX - 1, w - 16, LINE_H) }
        c.fillStyle = row.first ? pal.prompt : pal.text
        if (row.first) {
          c.fillText(row.text.slice(0, 2), 16, y)
          c.fillStyle = pal.text
          c.fillText(row.text.slice(2), 16 + cw * 2, y)
        } else c.fillText(row.text, 16, y)
        return
      }
      c.fillStyle = row.cls === 'oct-line--error' ? pal.error : row.cls === 'oct-line--echo' ? pal.muted : pal.text
      c.fillText(row.text, 16, y)
    })
    if (this._texture) this._texture.needsUpdate = true
  }

  _title () {
    const sh = this.shellId ? Shells.getShell(this.shellId) : null
    return sh?.name ? sh.name.toUpperCase().slice(0, 24) : ''
  }

  _roundRect (ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
}

