/**
 * modules/OmniTargeting.js — ⟐Targeting
 *
 * Z-Targeting, from Zelda: a real reticle that locks onto whatever's
 * currently selected, rather than a generic highlight. Reuses the
 * existing, already-working selection mechanism (omni:node-selected)
 * directly — targeting is "what does the reticle look like around
 * the current selection," not a second, separate selection system.
 *
 * V227: bright (unlit, additive, glowing halos, solid by default), faster focusing spin, white bolts striking the node; speed, opacity, glow and bolts are settings (utils/OmniTargetFx.js).
 *
 * Default: four tetrahedrons arranged around the target, each one's
 * own apex pointed inward toward the target's center — the classic
 * Z-target reticle shape, not a generic ring. targetRadiusGeometry
 * lets that default shape be swapped for any of the same shapes
 * OmniDraw itself offers.
 *
 * A CSS2D-style tooltip (a real screen-projected HTML label, not
 * Three.js's own CSS2DRenderer add-on) shows the targeted object's
 * label — a quick identifier, not a full Inspector.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'
import * as Fx from '../utils/OmniTargetFx.js'

const MARKER_COUNT = 4   // per ring — three rings, 12 markers total
const DEFAULT_GEOMETRY = 'TetrahedronGeometry'
const MARKER_RADIUS = 0.2    // real, deliberately smaller — more markers around one target needs less visual weight per marker
const ORBIT_RADIUS = 1.6     // how far out from the target center the 4 markers sit

// Same curated geometry vocabulary already used elsewhere (OmniDraw,
// OmniSystem, OmniBrowserSpace) — not a new, separate shape list.
const GEOMETRY_BUILDERS = {
  TetrahedronGeometry:  (r) => new THREE.TetrahedronGeometry(r),
  BoxGeometry:          (r) => new THREE.BoxGeometry(r * 1.4, r * 1.4, r * 1.4),
  SphereGeometry:       (r) => new THREE.SphereGeometry(r, 16, 16),
  OctahedronGeometry:   (r) => new THREE.OctahedronGeometry(r),
  IcosahedronGeometry:  (r) => new THREE.IcosahedronGeometry(r, 0),
  ConeGeometry:         (r) => new THREE.ConeGeometry(r, r * 1.6, 12),
}
export const TARGETING_GEOMETRIES = Object.keys(GEOMETRY_BUILDERS)

const TARGET_TEXTURE_SLOTS = 5
const targetTextureStore = createWallpaperStore('targeting-marker', TARGET_TEXTURE_SLOTS)

const MAX_BOLTS = 10
const BOLT_LIFE = 0.16   // seconds a strike stays visible

export default class OmniTargeting {
  constructor (context) {
    this.ctx = context
    this._group = null
    this._groupY = null   // spins on Y — a clock lying flat, hands sweeping horizontally from above
    this._groupZ = null   // spins on Z — a clock facing the camera, hands sweeping in the plane being looked at
    this._groupX = null   // spins on X — a clock standing on its side, hands sweeping vertically front-to-back
    this._markers = []    // every marker across all three rings — kept for texture/color application and disposal
    this._targetMesh = null
    this._geometry = DEFAULT_GEOMETRY
    this._color = Fx.DEFAULTS.color
    this._opacity = Fx.DEFAULTS.opacity
    this._speed = Fx.DEFAULTS.speed
    this._glow = Fx.DEFAULTS.glow
    this._boltRate = Fx.DEFAULTS.bolts
    this._t = 0; this._acc = 0; this._bolts = []; this._haloTex = null; this._boltRoot = null
    this._activeSlot = null
    this._texture = null
    this._tooltipEl = null
    this._onNodeSelected = null
    this._onSettingsSet = null
  }

  init () {
    const saved = Fx.load()
    this._geometry = GEOMETRY_BUILDERS[saved.geometry] ? saved.geometry : DEFAULT_GEOMETRY
    this._color = saved.color
    this._opacity = saved.opacity
    this._speed = saved.speed
    this._glow = saved.glow
    this._boltRate = saved.bolts
    this._activeSlot = saved.activeSlot

    this._group = new THREE.Group()
    this._group.visible = false   // nothing targeted yet
    this.ctx.scene.add(this._group)
    this._buildMarkers()
    this._buildBolts()

    this._tooltipEl = document.createElement('div')
    this._tooltipEl.id = 'omni-targeting-tooltip'
    Object.assign(this._tooltipEl.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: '999997',
      transform: 'translate(-50%, -140%)', display: 'none',
      background: 'rgba(8,8,12,0.85)', color: '#fff',
      font: '10px "Courier New", monospace', padding: '4px 8px',
      borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
      whiteSpace: 'nowrap',
    })
    document.body.appendChild(this._tooltipEl)

    this._onNodeSelected = (e) => this._setTarget(e.detail?.node, e.detail?.mesh)
    window.addEventListener('omni:node-selected', this._onNodeSelected)

    this._onSettingsSet = (e) => {
      const patch = e.detail ?? {}
      let needsRebuild = false
      if (patch.geometry !== undefined && GEOMETRY_BUILDERS[patch.geometry] && patch.geometry !== this._geometry) {
        this._geometry = patch.geometry
        needsRebuild = true
      }
      const c = Fx.clean(patch)
      if (c.color !== undefined) this._color = c.color
      if (c.opacity !== undefined) this._opacity = c.opacity
      if (c.speed !== undefined) this._speed = c.speed
      if (c.glow !== undefined) this._glow = c.glow
      if (c.bolts !== undefined) this._boltRate = c.bolts
      this._applyColor()
      if (patch.activeSlot !== undefined) {
        this._activeSlot = patch.activeSlot
        if (this._activeSlot) this._applySlotTexture(this._activeSlot)
        else this._clearTexture()
      }
      if (needsRebuild) { this._disposeMarkers(); this._buildMarkers() }
      Fx.save({ geometry: this._geometry, color: this._color, opacity: this._opacity, speed: this._speed, glow: this._glow, bolts: this._boltRate, activeSlot: this._activeSlot })
    }
    window.addEventListener('omni:targeting-set', this._onSettingsSet)
  }

  update (delta) {
    if (!this._group.visible || !this._targetMesh) return
    this._group.position.copy(this._targetMesh.position)
    // V227: faster spin that breathes (the ring tightens and eases as if trying to focus), and white bolts striking the node
    this._t += delta
    const f = Fx.focus(this._t, this._speed), k = delta * this._speed * f.spin
    this._groupZ.rotation.z += k * 0.6   // a clock facing the camera
    this._groupY.rotation.y += k * 0.4   // a clock lying flat
    this._groupX.rotation.x += k * 0.5   // a clock standing on its side
    this._groupZ.scale.setScalar(f.radius); this._groupY.scale.setScalar(f.radius); this._groupX.scale.setScalar(f.radius)
    this._updateBolts(delta)

    // Screen-project the target's real world position for the tooltip —
    // a genuine CSS2D-style label, not Three.js's own add-on.
    const pos = this._targetMesh.position.clone().project(this.ctx.camera)
    if (pos.z > 1) { this._tooltipEl.style.display = 'none'; return }   // behind the camera
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight
    this._tooltipEl.style.left = `${x}px`
    this._tooltipEl.style.top = `${y}px`
    this._tooltipEl.style.display = ''
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:node-selected', this._onNodeSelected)
    window.removeEventListener('omni:targeting-set', this._onSettingsSet)
    this._texture?.dispose(); this._haloTex?.dispose()
    this._tooltipEl?.remove()
    if (this._group) {
      this.ctx.scene.remove(this._group)
      this._group.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose() })
    }
  }

  _setTarget (node, mesh) {
    if (!mesh) { this._group.visible = false; this._tooltipEl.style.display = 'none'; return }
    this._targetMesh = mesh
    this._group.visible = true
    this._tooltipEl.textContent = node?.label ?? node?.id ?? 'Target'
  }

  _buildMarkers () {
    this._groupY = new THREE.Group()
    this._groupZ = new THREE.Group()
    this._groupX = new THREE.Group()
    this._group.add(this._groupY, this._groupZ, this._groupX)
    this._buildRing(this._groupY)
    this._buildRing(this._groupZ)
    this._buildRing(this._groupX)
  }

  /** One real ring of 4 markers, built the same way regardless of
   *  which sub-group it's parented to — the three rings only differ
   *  in which axis their own parent group spins on, in update(). */
  _buildRing (parentGroup) {
    const builder = GEOMETRY_BUILDERS[this._geometry] ?? GEOMETRY_BUILDERS[DEFAULT_GEOMETRY]
    const isTetrahedron = this._geometry === 'TetrahedronGeometry'

    for (let i = 0; i < MARKER_COUNT; i++) {
      const geo = builder(MARKER_RADIUS)

      // Real fix — TetrahedronGeometry's own default vertices sit at
      // the cube-corner pattern (1,1,1), (-1,-1,1), (-1,1,-1),
      // (1,-1,-1); none of them naturally line up with any one axis,
      // so the old lookAt + guessed extra rotation never reliably
      // pointed a real apex at anything. Baking a rotation into the
      // geometry itself — so one real vertex sits exactly on local
      // -Z, the same direction lookAt always points an object's own
      // forward — means lookAt alone now genuinely aims an apex at
      // the target, not an approximation.
      if (isTetrahedron) {
        const apexDefault = new THREE.Vector3(1, 1, 1).normalize()
        const forward = new THREE.Vector3(0, 0, -1)
        const align = new THREE.Quaternion().setFromUnitVectors(apexDefault, forward)
        geo.applyQuaternion(align)
      }

      const mat = this._makeMat()
      const marker = new THREE.Mesh(geo, mat)

      const angle = (i / MARKER_COUNT) * Math.PI * 2
      marker.position.set(Math.cos(angle) * ORBIT_RADIUS, Math.sin(angle) * ORBIT_RADIUS, 0)
      // Point each marker toward the target center — for the
      // tetrahedron, a real, baked-in apex; for every other shape,
      // its own natural forward, same as before.
      marker.lookAt(0, 0, 0)

      const halo = new THREE.Sprite(this._haloMat())   // a soft glow behind each marker: the bloom look
      halo.scale.setScalar(MARKER_RADIUS * 7); halo.userData.isHalo = true
      marker.add(halo)
      parentGroup.add(marker)
      this._markers.push(marker)
    }
  }

  _disposeMarkers () {
    this._markers.forEach(m => {
      m.parent?.remove(m)
      m.geometry.dispose()
      m.material.dispose()
    })
    this._markers = []
    // Real fix — _buildMarkers() creates fresh sub-groups every time,
    // so the previous ones need removing here too, or they'd be left
    // as orphaned, empty children on every rebuild (e.g. switching
    // the marker geometry).
    if (this._groupY) this._group.remove(this._groupY)
    if (this._groupZ) this._group.remove(this._groupZ)
    if (this._groupX) this._group.remove(this._groupX)
    this._groupY = null
    this._groupZ = null
    this._groupX = null
  }

  /** Bright, not see-through: unlit, additive, outside tone mapping, colour pushed past 1 by the glow setting. */
  _makeMat () {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: this._opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    m.color.set(this._color).multiplyScalar(0.6 + this._glow * 0.5)
    return m
  }
  _haloMat () {
    if (!this._haloTex && !this._haloTried && typeof document !== 'undefined') {
      this._haloTried = true
      const c = document.createElement('canvas'); c.width = c.height = 64
      const g = c.getContext?.('2d')
      if (g?.createRadialGradient) {
        const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
        r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = r; g.fillRect(0, 0, 64, 64)
        this._haloTex = new THREE.CanvasTexture(c)
      }
    }
    const m = new THREE.SpriteMaterial({ map: this._haloTex ?? null, color: this._color, transparent: true, opacity: this._haloOpacity(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    return m
  }
  _haloOpacity () { return Math.min(1, this._glow * 0.22) * this._opacity }
  _applyColor () {
    this._markers.forEach(m => {
      if (!this._texture) m.material.color.set(this._color).multiplyScalar(0.6 + this._glow * 0.5)
      m.material.opacity = this._opacity
      for (const ch of m.children) if (ch.userData.isHalo) { ch.material.color.set(this._color); ch.material.opacity = this._haloOpacity() }
    })
  }

  // ── bolts: short bright white lines from a marker to a random point on the node ──
  _buildBolts () {
    this._boltRoot = new THREE.Group(); this._group.add(this._boltRoot)
    for (let i = 0; i < MAX_BOLTS; i++) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3))
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      const line = new THREE.Line(geo, mat); line.visible = false; line.frustumCulled = false
      const flash = new THREE.Sprite(this._haloMat()); flash.material.color.set(0xffffff); flash.visible = false
      this._boltRoot.add(line, flash)
      this._bolts.push({ line, flash, age: BOLT_LIFE })
    }
  }
  _targetRadius () {
    const m = this._targetMesh, g = m?.geometry
    if (g) { if (!g.boundingSphere) g.computeBoundingSphere?.(); const r = g.boundingSphere?.radius; if (r) return r * Math.max(m.scale.x, m.scale.y, m.scale.z) }
    return 0.7
  }
  _updateBolts (dt) {
    const s = Fx.strikes(this._acc, this._boltRate, dt); this._acc = s.acc
    for (let n = 0; n < s.n; n++) {
      const b = this._bolts.find(x => x.age >= BOLT_LIFE); if (!b || !this._markers.length) break
      const mk = this._markers[Math.floor(Math.random() * this._markers.length)]
      const a = mk.getWorldPosition(new THREE.Vector3()).sub(this._group.position).toArray()
      const end = Fx.surfacePoint(Math.random, this._targetRadius() * 0.95)
      const pts = Fx.boltPoints(Math.random, a, end, 7, 0.16)
      b.line.geometry.attributes.position.array.set(pts); b.line.geometry.attributes.position.needsUpdate = true
      b.flash.position.set(...end); b.flash.scale.setScalar(0.5); b.age = 0
    }
    for (const b of this._bolts) {
      if (b.age >= BOLT_LIFE) { b.line.visible = false; b.flash.visible = false; continue }
      b.age += dt
      const k = Math.max(0, 1 - b.age / BOLT_LIFE), on = b.age < BOLT_LIFE
      b.line.visible = b.flash.visible = on
      b.line.material.opacity = k * this._opacity
      b.flash.material.opacity = k * Math.min(1, 0.3 + this._glow * 0.25); b.flash.scale.setScalar(0.35 + (1 - k) * 0.5)
    }
  }

  async _applySlotTexture (slot) {
    try {
      const record = await targetTextureStore.loadWallpaper(slot)
      if (!record) return
      const url = URL.createObjectURL(record.blob)
      new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        this._texture?.dispose()
        this._texture = texture
        this._markers.forEach(m => {
          m.material.map = texture
          m.material.color.set(0xffffff)
          m.material.needsUpdate = true
        })
      })
      this._activeSlot = slot
    } catch (err) {
      console.warn('⟐OmniTargeting — failed to load marker texture slot', slot, err)
    }
  }

  _clearTexture () {
    this._texture?.dispose()
    this._texture = null
    this._markers.forEach(m => { m.material.map = null; m.material.color.set(this._color); m.material.needsUpdate = true })
    this._activeSlot = null
  }
}

export { targetTextureStore, TARGET_TEXTURE_SLOTS }
