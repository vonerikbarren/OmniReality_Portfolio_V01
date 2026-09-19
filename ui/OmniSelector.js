/**
 * ui/OmniSelector.js — ⟐mniReality OmniSelector
 *
 * A duplicate of ui/OmniDraw.js's panel pattern (same chrome, same
 * geometry/transform approach), repurposed for a different job:
 * instead of authoring a container object, this places a WIREFRAME
 * selection volume in the world. Whatever nodes fall inside its
 * bounds — checked live, every time you move or scale it — become the
 * "grouped" selection, shown in this tool's own dedicated Inspector
 * (ui/OmniSelectorInspector.js).
 *
 * Deliberately trimmed vs. OmniDraw's full schema: Particles,
 * Cycles/Orbits, Media, and Automation don't serve a selection
 * volume's purpose, so they're left out here rather than carried over
 * as dead weight. Real RGBA sliders were added fresh (R/G/B/A, same
 * pattern as systems/OmniInspector.js's own color control) since
 * OmniDraw doesn't actually have a full RGBA picker itself yet — only
 * a wireframe/alpha toggle — and RGBA was explicitly requested here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * How selection works
 * ─────────────────────────────────────────────────────────────────────────────
 * "Select 3D by scaling the geometry to select the components" — the
 * volume's own sx/sy/sz *is* the selection mechanism: every node whose
 * saved position falls within the volume's current world-space
 * axis-aligned bounds counts as selected. Recomputed on every
 * position/scale change, live.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Wireframe tap-to-open — what's built vs. simplified this pass
 * ─────────────────────────────────────────────────────────────────────────────
 * Clicking a placed selection volume in the 3D world opens its
 * Inspector — built, via a self-contained raycaster here rather than
 * hooking into OmniNode's own (keeps this tool decoupled from node
 * selection). NOT built this pass: dragging a specific wireframe
 * face/edge to resize the volume directly in-world — for now, resizing
 * happens through the Transform sliders (here or in the Inspector),
 * not by grabbing the wireframe itself. Flagged rather than faked.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { GEOMETRY_DEFS, GEO_LABELS, generateId } from '../systems/OmniNode.js'

const GEO_OPTIONS = Object.keys(GEOMETRY_DEFS)

const STYLES = /* css */`

.omni-selector-panel {
  --os-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --os-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --os-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --os-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --os-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --os-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --os-accent      : var(--omni-theme-accent, #8cffb4);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 100px;
  left             : 100px;
  width            : 300px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 560px;
  min-height       : 340px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--os-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--os-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--os-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.os-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--os-header-bg);
  border-bottom    : 1px solid var(--os-border);
  cursor           : grab;
  user-select      : none;
}
.os-header.is-dragging { cursor: grabbing; }
.os-title { position: absolute; left: 14px; font-size: 11px; letter-spacing: 0.06em; color: var(--os-text-dim); }
.os-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.os-ctrl {
  width            : 22px; height: 22px;
  border-radius    : 6px;
  border           : 1px solid var(--os-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--os-text-dim);
  font-size        : 10px;
  display          : flex; align-items: center; justify-content: center;
  cursor           : pointer;
}
.os-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--os-text); }
.os-ctrl--inspector { color: rgba(140, 255, 180, 0.85); border-color: rgba(140, 255, 180, 0.22); }
.os-ctrl--inspector:hover { background: rgba(140, 255, 180, 0.14); }

.os-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; }

.os-group-title {
  font-size        : 9.5px;
  letter-spacing   : 0.08em;
  text-transform   : uppercase;
  color            : var(--os-accent);
  margin           : 12px 0 6px;
  padding-top      : 8px;
  border-top       : 1px solid rgba(255,255,255,0.06);
}
.os-group-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.os-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.os-row-label { width: 26px; flex-shrink: 0; font-size: 9.5px; color: var(--os-text-muted); }
.os-range { flex: 1; accent-color: var(--os-accent); }
.os-range-val { width: 34px; text-align: right; font-size: 9px; color: var(--os-text-dim); }
.os-select {
  flex: 1;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px;
  color: var(--os-text);
  font-family: var(--mono);
  font-size: 10.5px;
  padding: 4px 6px;
}

.os-swatch {
  width: 100%; height: 36px;
  border-radius: 6px;
  border: 1px solid var(--os-border);
  margin-bottom: 8px;
}

.os-place-btn {
  width            : 100%;
  margin-top       : 10px;
  padding          : 9px;
  border-radius    : 7px;
  border           : 1px solid rgba(140, 255, 180, 0.3);
  background       : rgba(140, 255, 180, 0.1);
  color            : rgba(160, 255, 195, 0.95);
  font-family      : var(--mono);
  font-size        : 10.5px;
  letter-spacing   : 0.04em;
  cursor           : pointer;
}
.os-place-btn:hover { background: rgba(140, 255, 180, 0.18); }

.os-resize-handle {
  position         : absolute; right: 0; bottom: 0;
  width            : 16px; height: 16px;
  cursor           : nwse-resize;
}
.os-resize-handle::before {
  content          : '';
  position         : absolute; right: 3px; bottom: 3px;
  width            : 8px; height: 8px;
  border-right     : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom    : 2px solid rgba(255, 255, 255, 0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-selector-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-selector-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniSelector {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    this._data = {
      geometry: 'BoxGeometry',
      px: 0, py: 2, pz: 0,
      rx: 0, ry: 0, rz: 0,
      sx: 3, sy: 3, sz: 3,
      wireframe: true,
    }
    this._color = { r: 140, g: 255, b: 180, a: 0.5 }

    this._preview = null
    this._volumes = new Map()   // volumeId -> { mesh, containedIds: [] }
    this._activeVolumeId = null
    this._allNodes = []

    this._onNavSelect = null
    this._onNodesUpdated = null
    this._onCanvasClick = null
    this._onInspectorUpdate = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniSelect') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onNodesUpdated = (e) => { this._allNodes = e.detail?.nodes ?? [] }
    window.addEventListener('omni:nodes-updated', this._onNodesUpdated)

    this._onCanvasClick = (e) => this._tryPickVolume(e)
    this.ctx.renderer.domElement.addEventListener('click', this._onCanvasClick)

    this._onInspectorUpdate = (e) => {
      const { volumeId, transform, color } = e.detail ?? {}
      if (!volumeId) return
      this._applyVolumeUpdate(volumeId, transform, color)
    }
    window.addEventListener('omni:selector-volume-updated', this._onInspectorUpdate)
  }

  update () {
    if (!this._preview) return
    this._preview.renderer.render(this._preview.scene, this._preview.camera)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:nodes-updated', this._onNodesUpdated)
    window.removeEventListener('omni:selector-volume-updated', this._onInspectorUpdate)
    this.ctx.renderer.domElement.removeEventListener('click', this._onCanvasClick)
    this._volumes.forEach(v => this._disposeVolume(v.mesh))
    this._teardownPreview()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniselector')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    if (!this._preview) this._setupPreview()
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'omniselector', label: '⟐OmniSelect', iconLabel: '⟐S',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-selector-panel'
    el.innerHTML = /* html */`
      <div class="os-header">
        <span class="os-title">⟐OmniSelect</span>
        <div class="os-controls">
          <button class="os-ctrl os-ctrl--inspector" data-action="inspector" title="Open OmniSelector Inspector">⟐i</button>
          <button class="os-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="os-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="os-body" id="os-body">

        <div class="os-group-title">Preview</div>
        <canvas class="os-swatch" id="os-canvas" width="260" height="80" style="height:80px"></canvas>

        <div class="os-group-title">Geometry</div>
        <div class="os-row">
          <span class="os-row-label">Type</span>
          <select class="os-select" id="os-geometry">
            ${GEO_OPTIONS.map(g => `<option value="${g}">${GEO_LABELS?.[g] ?? g}</option>`).join('')}
          </select>
        </div>

        <div class="os-group-title">Color (RGBA)</div>
        <div class="os-row"><span class="os-row-label">R</span><input type="range" class="os-range" id="os-r" min="0" max="255" value="${this._color.r}"><span class="os-range-val" id="os-r-val">${this._color.r}</span></div>
        <div class="os-row"><span class="os-row-label">G</span><input type="range" class="os-range" id="os-g" min="0" max="255" value="${this._color.g}"><span class="os-range-val" id="os-g-val">${this._color.g}</span></div>
        <div class="os-row"><span class="os-row-label">B</span><input type="range" class="os-range" id="os-b" min="0" max="255" value="${this._color.b}"><span class="os-range-val" id="os-b-val">${this._color.b}</span></div>
        <div class="os-row"><span class="os-row-label">A</span><input type="range" class="os-range" id="os-a" min="0" max="1" step="0.01" value="${this._color.a}"><span class="os-range-val" id="os-a-val">${this._color.a.toFixed(2)}</span></div>
        <div class="os-row" style="gap:6px">
          <span class="os-row-label" style="width:auto">Wireframe</span>
          <button class="os-ctrl ${this._data.wireframe ? 'is-active' : ''}" id="os-wireframe" style="width:auto;padding:2px 8px;font-size:9px">${this._data.wireframe ? 'On' : 'Off'}</button>
        </div>

        <div class="os-group-title">Position</div>
        ${this._rangeRow('px', -100, 100, 1)}
        ${this._rangeRow('py', -100, 100, 1)}
        ${this._rangeRow('pz', -100, 100, 1)}

        <div class="os-group-title">Rotation</div>
        ${this._rangeRow('rx', -3.14, 3.14, 0.01)}
        ${this._rangeRow('ry', -3.14, 3.14, 0.01)}
        ${this._rangeRow('rz', -3.14, 3.14, 0.01)}

        <div class="os-group-title">Scale — this is the actual selection mechanism</div>
        ${this._rangeRow('sx', 0.1, 100, 0.1)}
        ${this._rangeRow('sy', 0.1, 100, 0.1)}
        ${this._rangeRow('sz', 0.1, 100, 0.1)}

        <button class="os-place-btn" id="os-place">⟐ Place Selection Volume</button>
      </div>
      <div class="os-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="inspector"]').addEventListener('click', () => this._openInspectorForActive())

    el.dataset.winId = 'omniselector'
    WindowManager.register('omniselector', el, 'OmniSelect')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    WindowManager.registerContextMenu('omniselector', {
      Objects: [
        { label: '⟐ Place Selection Volume', action: () => this._placeVolume() },
      ],
    })

    return el
  }

  _rangeRow (key, min, max, step) {
    const val = this._data[key]
    return /* html */`
      <div class="os-row">
        <span class="os-row-label">${key}</span>
        <input type="range" class="os-range" data-field="${key}" min="${min}" max="${max}" step="${step}" value="${val}">
        <span class="os-range-val" data-field-val="${key}">${Number(val).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
    `
  }

  _bindControls (el) {
    el.querySelector('#os-geometry').addEventListener('change', (e) => {
      this._data.geometry = e.target.value
      this._rebuildPreviewGeometry()
    })

    ;['r', 'g', 'b'].forEach(ch => {
      el.querySelector(`#os-${ch}`).addEventListener('input', (e) => {
        this._color[ch] = Number(e.target.value)
        el.querySelector(`#os-${ch}-val`).textContent = e.target.value
        this._applyColorToPreview()
      })
    })
    el.querySelector('#os-a').addEventListener('input', (e) => {
      this._color.a = Number(e.target.value)
      el.querySelector('#os-a-val').textContent = Number(e.target.value).toFixed(2)
      this._applyColorToPreview()
    })

    el.querySelector('#os-wireframe').addEventListener('click', (e) => {
      this._data.wireframe = !this._data.wireframe
      e.currentTarget.textContent = this._data.wireframe ? 'On' : 'Off'
      e.currentTarget.classList.toggle('is-active', this._data.wireframe)
      if (this._preview?.mesh.material) {
        this._preview.mesh.material.wireframe = this._data.wireframe
      }
    })

    el.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        const key = input.dataset.field
        this._data[key] = Number(e.target.value)
        const valEl = el.querySelector(`[data-field-val="${key}"]`)
        if (valEl) valEl.textContent = Number(e.target.value).toFixed(Number(input.step) < 1 ? 2 : 0)
        this._applyTransformToPreview()
        if (this._activeVolumeId) this._updatePlacedVolume(this._activeVolumeId)
      })
    })

    el.querySelector('#os-place').addEventListener('click', () => this._placeVolume())
  }

  // ── Embedded preview — same small-canvas pattern as OmniDraw/Inspector ───

  _setupPreview () {
    const canvas = this._el.querySelector('#os-canvas')
    if (!canvas) return
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(260, 80, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 260 / 80, 0.1, 10)
    camera.position.set(0, 0, 3)
    camera.lookAt(0, 0, 0)
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))

    const geo = GEOMETRY_DEFS[this._data.geometry]?.() ?? new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshBasicMaterial({
      color: this._rgbHex(),
      wireframe: this._data.wireframe,
      transparent: true,
      opacity: this._color.a,
    })
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    this._preview = { renderer, scene, camera, mesh }
  }

  _teardownPreview () {
    if (!this._preview) return
    this._preview.mesh.geometry?.dispose()
    this._preview.mesh.material?.dispose()
    this._preview.renderer.dispose()
    this._preview = null
  }

  _rebuildPreviewGeometry () {
    if (!this._preview) return
    this._preview.mesh.geometry.dispose()
    this._preview.mesh.geometry = GEOMETRY_DEFS[this._data.geometry]?.() ?? new THREE.BoxGeometry(1, 1, 1)
  }

  _rgbHex () {
    return (this._color.r << 16) | (this._color.g << 8) | this._color.b
  }

  _applyColorToPreview () {
    if (!this._preview) return
    this._preview.mesh.material.color.setHex(this._rgbHex())
    this._preview.mesh.material.opacity = this._color.a
    if (this._activeVolumeId) this._updatePlacedVolume(this._activeVolumeId)
  }

  _applyTransformToPreview () {
    if (!this._preview) return
    // The embedded preview stays centered/small — position/rotation
    // still shown via rotation only, to keep the swatch legible;
    // full position/scale apply to the real placed volume instead.
    this._preview.mesh.rotation.set(this._data.rx, this._data.ry, this._data.rz)
  }

  // ── Placing + live-updating a selection volume in the real world ────────

  /** Places the volume, then plays a brief flash/pulse — scale
   *  overshoots and settles, opacity spikes then eases to the
   *  configured alpha. Placing a volume was previously the only silent
   *  step in this whole tool (everything else has a visible reaction);
   *  this gives an unmistakable "yes, that worked" the moment it's
   *  created, before the user ever needs to click it to find out. */
  _placeVolume () {
    const id = generateId()
    const geo = GEOMETRY_DEFS[this._data.geometry]?.() ?? new THREE.BoxGeometry(1, 1, 1)
    const targetAlpha = this._color.a
    const mat = new THREE.MeshBasicMaterial({
      color: this._rgbHex(),
      wireframe: this._data.wireframe,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(this._data.px, this._data.py, this._data.pz)
    mesh.rotation.set(this._data.rx, this._data.ry, this._data.rz)
    const targetScale = { x: this._data.sx, y: this._data.sy, z: this._data.sz }
    mesh.scale.set(0, 0, 0)
    mesh.userData.omniSelectorVolumeId = id
    this.ctx.scene.add(mesh)

    this._volumes.set(id, { mesh, containedIds: [] })
    this._activeVolumeId = id

    const tl = gsap.timeline()
    tl.to(mesh.scale, {
      x: targetScale.x * 1.15, y: targetScale.y * 1.15, z: targetScale.z * 1.15,
      duration: 0.22, ease: 'power2.out',
    })
    tl.to(mat, { opacity: Math.max(targetAlpha, 0.85), duration: 0.15, ease: 'power2.out' }, '<')
    tl.to(mesh.scale, {
      x: targetScale.x, y: targetScale.y, z: targetScale.z,
      duration: 0.3, ease: 'back.out(2.4)',
      onComplete: () => this._recomputeSelection(id),   // scale must settle before containment math means anything
    })
    tl.to(mat, { opacity: targetAlpha, duration: 0.35, ease: 'power2.out' }, '<')
  }

  _updatePlacedVolume (id) {
    const v = this._volumes.get(id)
    if (!v) return
    v.mesh.position.set(this._data.px, this._data.py, this._data.pz)
    v.mesh.rotation.set(this._data.rx, this._data.ry, this._data.rz)
    v.mesh.scale.set(this._data.sx, this._data.sy, this._data.sz)
    v.mesh.material.color.setHex(this._rgbHex())
    v.mesh.material.opacity = this._color.a
    v.mesh.material.wireframe = this._data.wireframe
    this._recomputeSelection(id)
  }

  /** The actual selection mechanism — "select 3D by scaling the
   *  geometry to select the components." A node counts as contained if
   *  its saved position falls within the volume's current world-space
   *  axis-aligned bounds. Simple and robust regardless of which
   *  geometry type the volume uses (sphere, box, etc. all just define
   *  their bounding box for this purpose) — a closer per-shape test
   *  (e.g. true sphere-radius containment) is a reasonable refinement
   *  later, not needed for "which components are roughly in this area." */
  _recomputeSelection (id) {
    const v = this._volumes.get(id)
    if (!v) return
    const half = {
      x: Math.abs(v.mesh.scale.x) / 2,
      y: Math.abs(v.mesh.scale.y) / 2,
      z: Math.abs(v.mesh.scale.z) / 2,
    }
    const min = { x: v.mesh.position.x - half.x, y: v.mesh.position.y - half.y, z: v.mesh.position.z - half.z }
    const max = { x: v.mesh.position.x + half.x, y: v.mesh.position.y + half.y, z: v.mesh.position.z + half.z }

    v.containedIds = this._allNodes
      .filter(n => {
        const [x, y, z] = n.position ?? [0, 0, 0]
        return x >= min.x && x <= max.x && y >= min.y && y <= max.y && z >= min.z && z <= max.z
      })
      .map(n => n.id)

    window.dispatchEvent(new CustomEvent('omni:selector-volume-grouped', {
      detail: { volumeId: id, containedIds: v.containedIds }
    }))
  }

  _disposeVolume (mesh) {
    this.ctx.scene.remove(mesh)
    mesh.geometry?.dispose()
    mesh.material?.dispose()
  }

  // ── Clicking a placed volume in the world opens its Inspector ───────────

  _tryPickVolume (e) {
    if (!this._isOpen || this._volumes.size === 0) return
    const rect = this.ctx.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.ctx.camera)
    const meshes = [...this._volumes.values()].map(v => v.mesh)
    const hits = raycaster.intersectObjects(meshes, false)
    if (hits.length === 0) return
    const id = hits[0].object.userData.omniSelectorVolumeId
    this._activeVolumeId = id
    this._syncFieldsFromVolume(id)
    this._openInspectorFor(id)
  }

  _syncFieldsFromVolume (id) {
    const v = this._volumes.get(id)
    if (!v) return
    this._data.px = v.mesh.position.x; this._data.py = v.mesh.position.y; this._data.pz = v.mesh.position.z
    this._data.rx = v.mesh.rotation.x; this._data.ry = v.mesh.rotation.y; this._data.rz = v.mesh.rotation.z
    this._data.sx = v.mesh.scale.x; this._data.sy = v.mesh.scale.y; this._data.sz = v.mesh.scale.z
  }

  _applyVolumeUpdate (volumeId, transform, color) {
    const v = this._volumes.get(volumeId)
    if (!v) return
    if (transform) {
      v.mesh.position.set(transform.px, transform.py, transform.pz)
      v.mesh.rotation.set(transform.rx, transform.ry, transform.rz)
      v.mesh.scale.set(transform.sx, transform.sy, transform.sz)
    }
    if (color) {
      v.mesh.material.color.setHex((color.r << 16) | (color.g << 8) | color.b)
      v.mesh.material.opacity = color.a
    }
    this._recomputeSelection(volumeId)
  }

  _openInspectorForActive () {
    if (!this._activeVolumeId) return
    this._openInspectorFor(this._activeVolumeId)
  }

  _openInspectorFor (id) {
    const v = this._volumes.get(id)
    if (!v) return
    const groupedLabels = v.containedIds
      .map(cid => this._allNodes.find(n => n.id === cid)?.label ?? cid)
    window.dispatchEvent(new CustomEvent('omni:selector-inspect-request', {
      detail: {
        volumeId: id,
        transform: {
          px: v.mesh.position.x, py: v.mesh.position.y, pz: v.mesh.position.z,
          rx: v.mesh.rotation.x, ry: v.mesh.rotation.y, rz: v.mesh.rotation.z,
          sx: v.mesh.scale.x, sy: v.mesh.scale.y, sz: v.mesh.scale.z,
        },
        color: {
          r: (v.mesh.material.color.getHex() >> 16) & 255,
          g: (v.mesh.material.color.getHex() >> 8) & 255,
          b: v.mesh.material.color.getHex() & 255,
          a: v.mesh.material.opacity,
        },
        wireframe: v.mesh.material.wireframe,
        groupedLabels,
      }
    }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.os-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
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
    const handle = el.querySelector('.os-resize-handle')
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
}
