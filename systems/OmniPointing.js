/**
 * systems/OmniPointing.js — ⟐OmniPointing / ⟐OmniStemming (Admin15,
 * "OmniMeter(External)")
 *
 * A real, new, self-contained system — NOT a mode bolted onto
 * systems/OmniRealityGridSelector.js or
 * systems/OmniRealityGridPointSelector.js, per direct confirmation
 * ("you can use it as a base I guess but this is something completely
 * different"). This file borrows only their grid-spacing/floor-plane
 * concept (GRID_SPACING/FLOOR_Y below, matching their own real
 * constants so OmniPointing's snap grid lines up with what those two
 * systems already draw), nothing else.
 *
 * Grid basis — PROCEDURAL, per direct confirmation: there are no real,
 * persistent point objects anywhere in the scene. Every frame, the
 * cursor is raycast onto the floor plane and the hit is snapped to the
 * nearest grid-intersection coordinate by spacing math — that snapped
 * coordinate is what gets shown/clicked. Nothing becomes a real scene
 * object until the user genuinely commits something via "Highlight and
 * Edit" (spawns a real `locationNode` — see _createLocationNode below)
 * — that's the one real exception, per direct confirmation.
 *
 * Two real modes:
 *   OmniPointing  (default) — hover shows the snapped floor coordinate
 *                 (x, y, z) in a tooltip; nearby grid intersections
 *                 fade in near the cursor and fade out with distance
 *                 (FADE_MAX_DIST below); click opens a real
 *                 subContextMenu (TakeMeThere / Title / Pocket / STEM /
 *                 Highlight and Edit).
 *   OmniStemming  (toggle key below) — hover instead follows a
 *                 vertical "stem" through the snapped (x, z) column,
 *                 showing the exact (x, y, z) along it as the mouse
 *                 moves vertically on screen; click "activates" that
 *                 exact point as the real, persisted, highlighted
 *                 ActiveStemming line, with the same subContextMenu
 *                 (mirrored — see _renderMenu).
 *
 * Honest notes (see BuildLog for the full write-up):
 *  - No "sonar" effect, and no single reusable "0,0,0 origin marker"
 *    object, exist anywhere in this codebase (grepped for both,
 *    zero matches). The sonar-ping effect built here (_attachSonar)
 *    is therefore a new, original effect inspired by the user's own
 *    description, not a scaled-down copy of a pre-existing one.
 *  - Pocket is a real, honest, disabled stub — matches this
 *    codebase's established "labeled, not wired" convention (see
 *    main.js's Developer→OmniCommandTerminal slot).
 *  - STEM is real, not a stub: it genuinely enters the ActiveStemming
 *    highlighted state at that point and opens its own mirrored menu.
 */

import * as THREE from 'three'
import gsap from 'gsap'

const TITLES_STORE_KEY = 'omni:pointing:titles'   // "x,y,z" -> user title string

// Reused directly from systems/OmniRealityGridSelector.js /
// OmniRealityGridPointSelector.js's own real constants (neither
// module exports them, so they're duplicated here, deliberately kept
// numerically identical) — same floor, same grid, so OmniPointing's
// snap grid lines up exactly with what those two systems already draw
// and select.
const GRID_SPACING = 20
const FLOOR_Y = -0.08
const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y)

// Neighbor fade-by-distance — a real, lightweight DOM-overlay effect
// (small screen-projected dot elements, positioned every mousemove via
// the same world-to-screen projection ui/ToolTipMenu.js's node headers
// already use), chosen over spawning real Three.js geometry per
// candidate point since the whole effect is purely cursor-anchored and
// transient. Documented, chosen falloff — not derived from anything
// else in the project:
const NEIGHBOR_RADIUS_CELLS = 2                    // 5x5 neighborhood around the hovered point
const FADE_MAX_DIST = GRID_SPACING * 2.5           // beyond this, a neighbor dot is fully transparent

// OmniStemming's vertical dashed ray — Y-axis only, per direct answer
// ("no real vertical grid needed"). Rises only (does not also
// descend) — a documented call: the user's own wording named "rising"
// explicitly and left descending as optional/undecided.
const STEM_HEIGHT = 14

// locationNode ("Highlight and Edit") — small yellow orb + sonar ping.
const LOCATION_NODE_SCALE = 0.22
const LOCATION_NODE_COLOR = '#ffe14d'
const SONAR_RING_COUNT = 3
const SONAR_BASE_RADIUS = 0.4
const SONAR_MAX_RADIUS = 1.6     // visibly smaller than PortalSpheres.js's own orbital-ring radius (SPHERE_RADIUS * 1.7 there) — the closest existing analogue in this project
const SONAR_DURATION = 2.2       // seconds per ring cycle

function roundTo (n, step) { return Math.round(n / step) * step }
function coordKey (x, y, z) { return `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}` }

// omp- prefixed CSS, deliberately its own copy of ui/ToolTipMenu.js's
// .ttm-header / .ttm-quickmenu / .ttm-action-btn visual pattern
// (same colors/padding/radius) rather than importing that module's
// injected styles — keeps OmniPointing fully decoupled from
// ToolTipMenu's init order.
const STYLES = /* css */`
.omp-tooltip {
  position: fixed; pointer-events: none; transform: translate(14px, -50%);
  background: var(--ttm-bg, rgba(8,8,12,0.88)); color: var(--ttm-color, #fff);
  font: 10px 'Courier New', monospace; padding: 4px 8px; border-radius: 5px;
  border: 1px solid var(--ttm-border, rgba(255,255,255,0.15)); white-space: pre; z-index: 50;
}
.omp-dot {
  position: fixed; pointer-events: none; width: 5px; height: 5px;
  margin-left: -2.5px; margin-top: -2.5px; border-radius: 50%;
  background: #ffee88; box-shadow: 0 0 4px rgba(255,238,136,0.8); z-index: 39;
}
.omp-quickmenu {
  position: fixed; pointer-events: auto; transform: translate(-50%, 4px);
  background: rgba(8,8,12,0.94); border: 1px solid rgba(255,255,255,0.18);
  border-radius: 6px; padding: 4px; display: flex; flex-direction: column; gap: 2px;
  z-index: 51; font: 10px 'Courier New', monospace;
}
.omp-action-btn {
  background: transparent; border: none; color: #fff; font: 10px 'Courier New', monospace;
  padding: 5px 10px; text-align: left; cursor: pointer; border-radius: 4px; white-space: nowrap;
}
.omp-action-btn:hover { background: rgba(255,255,255,0.12); }
.omp-action-btn.omp-stub { color: rgba(255,255,255,0.35); cursor: not-allowed; }
.omp-action-btn.omp-stub:hover { background: transparent; }
.omp-menu-title {
  font-size: 9px; color: rgba(255,255,255,0.55); padding: 3px 10px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 2px; white-space: nowrap;
}
`

function injectStyles () {
  if (document.getElementById('omp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniPointing {
  /** @param {object} context  — { scene, camera, renderer, ... }
   *  @param {object} omniNode — systems/OmniNode.js instance, used only
   *         to (a) check whether the cursor is over a real node mesh
   *         (so OmniPointing steps aside) and (b) issue the real
   *         omni:node-create-request for "Highlight and Edit". */
  constructor (context, omniNode) {
    this.ctx = context
    this.omniNode = omniNode

    this._active = false        // toggled from Admin15 ("OmniMeter(External)")
    this._stemmingMode = false  // toggled by the KeyJ shortcut, only while active

    this._titles = this._loadTitles()

    this._tooltipEl = null
    this._dotEls = []
    this._menuEl = null
    this._menuKind = null       // 'point' | 'stem'
    this._menuPoint = null      // { x, y, z } the open menu refers to
    this._ignoreNextDocClick = false

    this._previewStem = null    // live hover preview while stemming, not yet activated: { key, group, marker }
    this._activeStems = new Map()  // "x,z" -> { group, px, pz, y } — persisted ActiveStemming line(s)
    this._sonarRings = new Map()   // nodeId -> [{ mesh, phase }]
    this._pendingLocationNodeId = null

    this._raycaster = new THREE.Raycaster()
    this._mouse = new THREE.Vector2()

    this._onNavSelect = null
    this._onKeydown = null
    this._onMouseMove = null
    this._onClick = null
    this._onDocClick = null
    this._onNodeCreated = null
    this._onNodeRestored = null
    this._onNodeDeleted = null
  }

  // ── Module contract ──────────────────────────────────────────────────

  init () {
    injectStyles()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniMeterExternal') return
      this.toggleActive()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onKeydown = (e) => {
      if (e.repeat || e.code !== 'KeyJ') return
      const active = document.activeElement
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      if (isTyping || !this._active) return
      this._toggleStemmingMode()
    }
    window.addEventListener('keydown', this._onKeydown)

    const canvas = this.ctx.renderer?.domElement
    if (canvas) {
      this._onMouseMove = (e) => this._handleMouseMove(e)
      this._onClick = (e) => this._handleClick(e)
      canvas.addEventListener('mousemove', this._onMouseMove, { passive: true })
      canvas.addEventListener('click', this._onClick)
    }

    // Same real "ignore the click that just opened the menu" pattern
    // ui/ToolTipMenu.js already uses for its own quick menu — a click
    // on the canvas bubbles up to document too, which would otherwise
    // close the menu the instant it opens.
    this._onDocClick = (e) => {
      if (!this._menuEl) return
      if (this._ignoreNextDocClick) return
      if (e.target.closest('.omp-quickmenu')) return
      this._closeMenu()
    }
    document.addEventListener('click', this._onDocClick)

    this._onNodeCreated = (e) => this._maybeAttachSonar(e.detail)
    window.addEventListener('omni:node-created', this._onNodeCreated)
    // A locationNode restored from a previous session (page reload)
    // needs its sonar re-attached too — it's a runtime-only child
    // effect, never part of the saved geometry (same reason
    // OmniNode.js itself re-runs _rebuildEssenceVisual on restore).
    this._onNodeRestored = (e) => this._maybeAttachSonar(e.detail)
    window.addEventListener('omni:node-restored', this._onNodeRestored)

    this._onNodeDeleted = (e) => this._disposeSonar(e.detail?.id)
    window.addEventListener('omni:node-deleted', this._onNodeDeleted)
  }

  update (delta) {
    if (this._sonarRings.size === 0) return
    const dt = delta ?? 0
    this._sonarRings.forEach(rings => {
      rings.forEach(r => {
        r.phase = (r.phase + dt / SONAR_DURATION) % 1
        r.mesh.scale.setScalar(1 + r.phase * (SONAR_MAX_RADIUS / SONAR_BASE_RADIUS - 1))
        r.mesh.material.opacity = 0.55 * (1 - r.phase)
      })
    })
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('keydown', this._onKeydown)
    window.removeEventListener('omni:node-created', this._onNodeCreated)
    window.removeEventListener('omni:node-restored', this._onNodeRestored)
    window.removeEventListener('omni:node-deleted', this._onNodeDeleted)
    document.removeEventListener('click', this._onDocClick)
    const canvas = this.ctx.renderer?.domElement
    if (canvas) {
      canvas.removeEventListener('mousemove', this._onMouseMove)
      canvas.removeEventListener('click', this._onClick)
    }
    this._clearHoverVisuals()
    this._closeMenu()
    this._activeStems.forEach(s => this._disposeGroup(s.group))
    this._activeStems.clear()
    this._sonarRings.forEach(rings => rings.forEach(r => this._disposeMesh(r.mesh)))
    this._sonarRings.clear()
  }

  // ── Admin15 toggle ("OmniMeter(External)") ───────────────────────────

  toggleActive () {
    this._active = !this._active
    if (!this._active) {
      this._stemmingMode = false
      this._clearHoverVisuals()
      this._closeMenu()
    }
    window.dispatchEvent(new CustomEvent('omni:omnipointing-active-changed', { detail: { active: this._active } }))
  }

  isActive () { return this._active }
  isStemmingMode () { return this._stemmingMode }

  _toggleStemmingMode () {
    this._stemmingMode = !this._stemmingMode
    this._clearHoverVisuals()
  }

  // ── Title persistence (localStorage, keyed by exact coordinate) ─────

  _loadTitles () {
    try {
      const raw = localStorage.getItem(TITLES_STORE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch (_) { return {} }
  }

  _saveTitles () {
    try { localStorage.setItem(TITLES_STORE_KEY, JSON.stringify(this._titles)) } catch (_) { /* best effort */ }
  }

  _titleFor (x, y, z) { return this._titles[coordKey(x, y, z)] ?? null }

  _setTitleFor (x, y, z, title) {
    const key = coordKey(x, y, z)
    if (title) this._titles[key] = title
    else delete this._titles[key]
    this._saveTitles()
  }

  // ── Raycasting / snapping ─────────────────────────────────────────────

  _updateMouseNDC (e) {
    const canvas = this.ctx.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  /** True when the cursor is over a real OmniNode mesh right now — in
   *  that case OmniPointing steps aside entirely (no tooltip, no
   *  menu) and lets systems/OmniNode.js's own click/hover handling own
   *  the cursor, rather than opening a competing point menu on top of
   *  a real node. */
  _hitsRealNode () {
    const meshes = this.omniNode?.getAllMeshes?.() ?? []
    if (meshes.length === 0) return false
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    return this._raycaster.intersectObjects(meshes, false).length > 0
  }

  _floorHit () {
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    const target = new THREE.Vector3()
    return this._raycaster.ray.intersectPlane(FLOOR_PLANE, target) ? target : null
  }

  _snap (hit) {
    return { x: roundTo(hit.x, GRID_SPACING), z: roundTo(hit.z, GRID_SPACING) }
  }

  /** OmniStemming's "exact coordinate along the stem" — the mouse's
   *  screen position maps to a real world Y by intersecting the ray
   *  against a vertical plane that contains the stem's own vertical
   *  axis through (px, pz) and faces the camera (instead of the floor
   *  plane). Clamped to [FLOOR_Y, FLOOR_Y + STEM_HEIGHT] so a glancing
   *  ray nearly parallel to that plane can't fling the result off to
   *  a huge, meaningless value. */
  _verticalHit (px, pz) {
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    const camDir = new THREE.Vector3()
    this.ctx.camera.getWorldDirection(camDir)
    const normal = new THREE.Vector3(-camDir.z, 0, camDir.x)
    if (normal.lengthSq() < 0.0001) normal.set(1, 0, 0)
    normal.normalize()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(px, 0, pz))
    const target = new THREE.Vector3()
    if (!this._raycaster.ray.intersectPlane(plane, target)) return FLOOR_Y
    return Math.min(Math.max(target.y, FLOOR_Y), FLOOR_Y + STEM_HEIGHT)
  }

  // ── Hover ──────────────────────────────────────────────────────────────

  _handleMouseMove (e) {
    if (!this._active || this._menuEl) return   // a menu is open — leave whatever was showing exactly as it was underneath it
    this._updateMouseNDC(e)

    if (this._hitsRealNode()) { this._clearHoverVisuals(); return }

    const hit = this._floorHit()
    if (!hit) { this._clearHoverVisuals(); return }

    const { x: px, z: pz } = this._snap(hit)

    if (this._stemmingMode) {
      const y = this._verticalHit(px, pz)
      this._showStemPreview(px, pz, y)
      this._showTooltip(e, px, y, pz, true)
      this._clearNeighborDots()
    } else {
      this._showTooltip(e, px, FLOOR_Y, pz, false)
      this._updateNeighborDots(px, pz)
      this._clearStemPreview()
    }
  }

  _clearHoverVisuals () {
    this._hideTooltip()
    this._clearNeighborDots()
    this._clearStemPreview()
  }

  // ── Tooltip — reuses ToolTipSettings' CSS vars for visual parity with
  // every other tooltip header in the project (see ToolTipMenu.js). ──

  _showTooltip (e, x, y, z, isStem) {
    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement('div')
      this._tooltipEl.className = 'omp-tooltip'
      document.body.appendChild(this._tooltipEl)
    }
    const title = this._titleFor(x, y, z)
    const header = isStem ? '⟐ OmniStemming' : '⟐ OmniPointing'
    const titleLine = title ? `${title}\n` : ''
    this._tooltipEl.textContent = `${titleLine}${header} — (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})`
    this._tooltipEl.style.left = `${e.clientX}px`
    this._tooltipEl.style.top = `${e.clientY}px`
    this._tooltipEl.style.display = ''
  }

  _hideTooltip () {
    if (this._tooltipEl) this._tooltipEl.style.display = 'none'
  }

  // ── Neighbor fade-by-distance ────────────────────────────────────────

  _updateNeighborDots (centerPx, centerPz) {
    const coords = []
    for (let i = -NEIGHBOR_RADIUS_CELLS; i <= NEIGHBOR_RADIUS_CELLS; i++) {
      for (let j = -NEIGHBOR_RADIUS_CELLS; j <= NEIGHBOR_RADIUS_CELLS; j++) {
        if (i === 0 && j === 0) continue   // the hovered point itself already has the tooltip
        coords.push({ x: centerPx + i * GRID_SPACING, z: centerPz + j * GRID_SPACING })
      }
    }

    while (this._dotEls.length < coords.length) {
      const d = document.createElement('div')
      d.className = 'omp-dot'
      document.body.appendChild(d)
      this._dotEls.push(d)
    }
    while (this._dotEls.length > coords.length) {
      this._dotEls.pop().remove()
    }

    coords.forEach((c, i) => {
      const el = this._dotEls[i]
      const dist = Math.hypot(c.x - centerPx, c.z - centerPz)
      const opacity = Math.max(0, 1 - dist / FADE_MAX_DIST)
      const screen = (opacity > 0.02) ? this._worldToScreen(new THREE.Vector3(c.x, FLOOR_Y, c.z)) : null
      if (!screen) { el.style.display = 'none'; return }
      el.style.display = ''
      el.style.left = `${screen.x}px`
      el.style.top = `${screen.y}px`
      el.style.opacity = opacity.toFixed(2)
    })
  }

  _clearNeighborDots () {
    this._dotEls.forEach(d => d.remove())
    this._dotEls = []
  }

  _worldToScreen (worldPos) {
    const camera = this.ctx.camera
    const projected = worldPos.clone().project(camera)
    if (projected.z > 1) return null   // behind the camera
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    }
  }

  // ── Dashed vertical line — real geometric dashing (stacked short
  // cylinder segments with real gaps), matching this codebase's own
  // established convention in systems/OmniNode.js's
  // _buildDashedCylinderGeometry (grepped for "Dashed" first, per
  // instruction — that's the only prior dashed-line technique in this
  // project; THREE.LineDashedMaterial is never used here, so this
  // follows the existing pattern instead of introducing a second one).

  _buildDashedVerticalLine (height, colorHex, opacity, segments = 14, dutyCycle = 0.5) {
    const group = new THREE.Group()
    const segLen = height / segments
    const visibleLen = segLen * dutyCycle
    const material = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity })
    for (let i = 0; i < segments; i++) {
      const geo = new THREE.CylinderGeometry(0.035, 0.035, visibleLen, 6, 1)
      const seg = new THREE.Mesh(geo, material)
      seg.position.y = segLen * (i + 0.5)
      group.add(seg)
    }
    return group
  }

  _disposeGroup (group) {
    if (!group) return
    const seenMaterials = new Set()
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material && !seenMaterials.has(obj.material)) {
        seenMaterials.add(obj.material)
        obj.material.dispose()
      }
    })
    this.ctx.scene.remove(group)
  }

  // ── OmniStemming — live preview (hover, not yet activated) ──────────

  _showStemPreview (px, pz, y) {
    const key = `${px},${pz}`
    if (!this._previewStem || this._previewStem.key !== key) {
      this._clearStemPreview()
      const group = this._buildDashedVerticalLine(STEM_HEIGHT, 0x66ccff, 0.35)
      group.position.set(px, FLOOR_Y, pz)
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: 0x66ccff }))
      group.add(marker)
      this.ctx.scene.add(group)
      this._previewStem = { key, group, marker }
    }
    this._previewStem.marker.position.y = y - FLOOR_Y
  }

  _clearStemPreview () {
    if (!this._previewStem) return
    this._disposeGroup(this._previewStem.group)
    this._previewStem = null
  }

  // ── OmniStemming — ActiveStemming (persisted, highlighted) ──────────

  /** Only one real ActiveStemming line at a time, per the user's own
   *  description of it as a single highlighted state (not a
   *  multi-select system) — a documented, deliberate scope choice. */
  _activateStem (px, pz, y) {
    this._deactivateAllStems()
    const group = this._buildDashedVerticalLine(STEM_HEIGHT, 0xffee00, 0.9)
    group.position.set(px, FLOOR_Y, pz)
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffee00 }))
    marker.position.y = y - FLOOR_Y
    group.add(marker)
    this.ctx.scene.add(group)
    this._activeStems.set(`${px},${pz}`, { group, px, pz, y })
  }

  _deactivateAllStems () {
    this._activeStems.forEach(s => this._disposeGroup(s.group))
    this._activeStems.clear()
  }

  // ── Click → subContextMenu ────────────────────────────────────────────

  _handleClick (e) {
    if (!this._active || this._menuEl) return
    this._updateMouseNDC(e)
    if (this._hitsRealNode()) return   // let OmniNode own this click

    const hit = this._floorHit()
    if (!hit) return
    const { x: px, z: pz } = this._snap(hit)

    if (this._stemmingMode) {
      const y = this._verticalHit(px, pz)
      this._activateStem(px, pz, y)
      this._menuKind = 'stem'
      this._menuPoint = { x: px, y, z: pz }
    } else {
      this._menuKind = 'point'
      this._menuPoint = { x: px, y: FLOOR_Y, z: pz }
    }
    this._openMenu(e.clientX, e.clientY)
  }

  _openMenu (screenX, screenY) {
    this._clearHoverVisuals()
    this._menuEl = document.createElement('div')
    this._menuEl.className = 'omp-quickmenu'
    document.body.appendChild(this._menuEl)
    this._renderMenu()
    this._menuEl.style.left = `${screenX}px`
    this._menuEl.style.top = `${screenY}px`
    this._ignoreNextDocClick = true
    setTimeout(() => { this._ignoreNextDocClick = false }, 0)
  }

  _closeMenu () {
    this._menuEl?.remove()
    this._menuEl = null
    this._menuKind = null
    this._menuPoint = null
  }

  /** The real subContextMenu — TakeMeThere / Title / Pocket / STEM /
   *  Highlight and Edit, exactly per the user's own spec. The stem
   *  variant mirrors this same menu adapted to a stem context, per
   *  direct request ("its own subContextMenu that mirrors the context
   *  menu above... adapted sensibly to a stem/line context"): STEM
   *  becomes "Deactivate STEM" (there's nothing left to activate —
   *  it's already active), and Highlight and Edit drops the
   *  locationNode at the exact (x, y, z) along the stem that was
   *  clicked rather than at floor level. */
  _renderMenu () {
    const p = this._menuPoint
    const isStem = this._menuKind === 'stem'
    const header = isStem ? 'OmniStemming (Active)' : 'OmniPointing'

    this._menuEl.innerHTML = /* html */`
      <div class="omp-menu-title">⟐ ${header} — (${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)})</div>
      <button class="omp-action-btn" data-action="take-me-there">🎯 TakeMeThere</button>
      <button class="omp-action-btn" data-action="title">✎ Title</button>
      <button class="omp-action-btn omp-stub" data-action="pocket" disabled
              title="Pocket — real, honest stub. Not yet implemented, same convention as Developer → OmniCommandTerminal in main.js.">⟐ Pocket (soon)</button>
      <button class="omp-action-btn" data-action="stem">${isStem ? '✕ Deactivate STEM' : '📍 STEM'}</button>
      <button class="omp-action-btn" data-action="highlight-edit">✦ Highlight and Edit</button>
    `

    this._menuEl.querySelector('[data-action="take-me-there"]').addEventListener('click', () => {
      this._takeMeThere(p)
      this._closeMenu()
    })

    this._menuEl.querySelector('[data-action="title"]').addEventListener('click', () => {
      const current = this._titleFor(p.x, p.y, p.z) ?? ''
      const next = window.prompt('Title for this point:', current)
      if (next === null) return   // cancelled
      this._setTitleFor(p.x, p.y, p.z, next.trim())
      this._closeMenu()
    })

    // Pocket intentionally has no click handler at all (and is
    // `disabled`) — a real, honest stub, not a fake working button.

    this._menuEl.querySelector('[data-action="stem"]').addEventListener('click', () => {
      if (isStem) this._deactivateAllStems()
      else this._activateStem(p.x, p.z, p.y)
      this._closeMenu()
    })

    this._menuEl.querySelector('[data-action="highlight-edit"]').addEventListener('click', () => {
      this._createLocationNode(p)
      this._closeMenu()
    })
  }

  // ── TakeMeThere — same real camera-tween pattern as the Spaces
  // feature (main.js's `gsap.to(base.camera.position, {...})`) and
  // utils/CameraTravel.js's goToObject, adapted for a bare coordinate
  // (no mesh exists here to call goToObject with directly). ──────────

  _takeMeThere (p) {
    const camera = this.ctx.camera
    const targetPos = new THREE.Vector3(p.x, p.y, p.z)

    const away = camera.position.clone().sub(targetPos)
    if (away.lengthSq() < 0.0001) away.set(0, 3, 6)
    away.y = Math.max(away.y, 3)   // keep some height rather than ending up eye-level with the floor
    away.normalize()
    const dest = targetPos.clone().add(away.multiplyScalar(6))

    window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))
    gsap.to(camera.position, {
      x: dest.x, y: dest.y, z: dest.z, duration: 1.1, ease: 'power2.inOut',
      onUpdate: () => camera.lookAt(targetPos),
      onComplete: () => {
        window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: targetPos.x, y: targetPos.y, z: targetPos.z } }))
        window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
      },
    })
  }

  // ── Highlight and Edit — the one real, scene-committing action ──────

  _createLocationNode (p) {
    const id = 'loc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    const title = this._titleFor(p.x, p.y, p.z)
    this._pendingLocationNodeId = id
    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id,
        label: title || `Location (${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)})`,
        geometry: 'SphereGeometry',
        primitive: 'objective',
        color: LOCATION_NODE_COLOR,
        position: [p.x, p.y + LOCATION_NODE_SCALE * 0.5, p.z],
        scale: [LOCATION_NODE_SCALE, LOCATION_NODE_SCALE, LOCATION_NODE_SCALE],
        isLocationNode: true,
        pointingCoordinate: { x: p.x, y: p.y, z: p.z },
      },
    }))
  }

  /** Sonar ping — added as independent scene objects at the node's
   *  real world position (NOT as a child of the locationNode mesh,
   *  since that mesh's own small scale (LOCATION_NODE_SCALE) would
   *  otherwise shrink the ring effect down to near-nothing too). Runs
   *  for both a freshly created node (omni:node-created) and one
   *  restored from a previous session (omni:node-restored) — see
   *  init(). */
  _maybeAttachSonar (detail) {
    const { node, mesh } = detail ?? {}
    if (!node?.isLocationNode || !mesh) return
    if (this._sonarRings.has(node.id)) return   // already attached (e.g. a duplicate restore event)

    const worldPos = mesh.getWorldPosition(new THREE.Vector3())
    const rings = []
    for (let i = 0; i < SONAR_RING_COUNT; i++) {
      const geo = new THREE.RingGeometry(SONAR_BASE_RADIUS - 0.03, SONAR_BASE_RADIUS, 32)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = -Math.PI / 2   // lie flat on the floor, concentric with the orb above it
      ring.position.set(worldPos.x, FLOOR_Y + 0.02, worldPos.z)
      this.ctx.scene.add(ring)
      rings.push({ mesh: ring, phase: i / SONAR_RING_COUNT })
    }
    this._sonarRings.set(node.id, rings)
    if (node.id === this._pendingLocationNodeId) this._pendingLocationNodeId = null
  }

  _disposeMesh (mesh) {
    mesh.geometry?.dispose()
    mesh.material?.dispose()
    this.ctx.scene.remove(mesh)
  }

  _disposeSonar (nodeId) {
    if (!nodeId) return
    const rings = this._sonarRings.get(nodeId)
    if (!rings) return
    rings.forEach(r => this._disposeMesh(r.mesh))
    this._sonarRings.delete(nodeId)
  }
}
