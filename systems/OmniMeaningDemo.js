/**
 * systems/OmniMeaningDemo.js (V241) — plays the 10-second "meaning by change" demo (data: utils/OmniMeaningDemoModel.js).
 *   SERVICES.demo.play({ speed: 1, captions: true, keep: false })  .stop()  .isPlaying()  .t (seconds)
 *   Omni Demo play | stop | list      Esc stops it.      Ribbon: Sandbox > Demos > Meaning demo.
 * It makes three ordinary nodes (ids demo_meaning_a / _b / _c) in front of the camera, drives them from valueAt(t) each frame, shows a caption, and deletes them at the end (unless keep).
 * Left-over demo nodes from a reload are removed at init. Nothing here is saved.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as M from '../utils/OmniMeaningDemoModel.js'

const send = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))
const GEOS = ['SphereGeometry', 'BoxGeometry', 'OctahedronGeometry']

export default class OmniMeaningDemo {
  constructor (context, omniNode) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this.t = 0; this._on = false; this._opts = null; this._cap = null; this._meshes = null; this._bound = []; this._spin = [0, 0, 0]; this._origin = null; this._axes = null }
  init () {
    SERVICES.demo = this
    for (const id of M.IDS) { try { if (this.omniNode?.getNodeData?.(id)) send('omni:node-delete-request', { id }) } catch (_) { /* gone */ } }
    const on = (n, fn, t = window) => { const h = (e) => fn(e); t.addEventListener(n, h); this._bound.push([n, h, t]) }
    on('omni:demo-request', (e) => { const d = e.detail ?? {}; try { if (d.action === 'stop') this.stop(); else this.play(d) } catch (err) { send('omni:notify-info', { text: 'Demo: ' + err.message }) } })
    on('keydown', (e) => { if (e.key === 'Escape' && this._on) this.stop() }, document)
  }
  isPlaying () { return this._on }
  play ({ speed = 1, captions = true, keep = false } = {}) {
    if (!this.omniNode?.getMeshById) throw new Error('the node system is not available')
    this.stop(true)
    const cam = this.context?.camera
    // centred in the view wherever the camera looks (also straight down): 11 units ahead along the real view direction, laid out along the camera's own right vector
    const dir = new THREE.Vector3(0, 0, -1); const right = new THREE.Vector3(1, 0, 0)
    if (cam) { cam.updateMatrixWorld?.(true); cam.getWorldDirection(dir); right.setFromMatrixColumn(cam.matrixWorld, 0).normalize() }
    const origin = (cam ? cam.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 2, 8)).addScaledVector(dir, 11)
    this._origin = origin; this._right = right
    M.IDS.forEach((id, i) => send('omni:node-create-request', { id, label: ['A', 'B', 'C'][i], geometry: GEOS[i], primitive: 'objective', color: M.BASE.cool, position: [origin.x, origin.y, origin.z], scale: [0.0001, 0.0001, 0.0001], rotation: [0, 0, 0], noParent: true, noSelect: true }))
    this._meshes = M.IDS.map(id => this.omniNode.getMeshById(id))
    if (this._meshes.some(m => !m)) { this.stop(); throw new Error('the demo nodes could not be made') }
    this._opts = { speed: Math.max(0.25, Math.min(4, Number(speed) || 1)), captions: captions !== false, keep: !!keep }
    this._spin = [0, 0, 0]; this.t = 0; this._t0 = performance.now(); this._on = true
    if (this._opts.captions) this._showCaption('')
    send('omni:demo-state', { playing: true })
    return 'Playing the 10-second meaning demo (Esc stops it)'
  }
  update (delta) {
    if (!this._on) return
    const dt = Math.min(delta || 0, 0.1)
    const now = performance.now(); this.t = ((now - this._t0) / 1000) * this._opts.speed   // wall clock: the demo lasts 10 s even when frames are slow
    const done = this.t >= M.DURATION
    const v = M.valueAt(Math.min(this.t, M.DURATION)); const cool = new THREE.Color(M.BASE.cool), warm = new THREE.Color(M.BASE.warm)
    ;[v.a, v.b, v.c].forEach((s, i) => {
      const m = this._meshes[i]; if (!m || !m.parent) return
      m.position.set(this._origin.x + this._right.x * s.x, this._origin.y + this._right.y * s.x, this._origin.z + this._right.z * s.x)
      m.scale.setScalar(Math.max(0.0001, s.scale))
      this._spin[i] += s.spin * dt * this._opts.speed; m.rotation.y = this._spin[i]; m.rotation.x = this._spin[i] * 0.35
      const mat = m.material
      if (mat && mat.color) { mat.color.copy(cool).lerp(warm, s.mix); if ('emissive' in mat) { mat.emissive.copy(mat.color); mat.emissiveIntensity = s.glow * 0.9 } }
    })
    if (this._opts.captions) this._showCaption(v.step ? M.AXES[v.step.axis].symbol + '  ' + v.step.caption : '', v.step ? M.AXES[v.step.axis].color : '')
    if (done) this.stop()
  }
  _showCaption (text, color = '#fff') {
    if (!this._cap) {
      const el = document.createElement('div'); el.id = 'omni-meaning-demo-caption'
      el.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:2147483000;pointer-events:none;font:600 20px system-ui,sans-serif;color:#fff;text-shadow:0 0 10px #000,0 2px 6px #000;padding:6px 16px;border-radius:14px;background:rgba(0,0,0,.35);max-width:90vw;text-align:center'
      document.body.appendChild(el); this._cap = el
    }
    this._cap.textContent = text; this._cap.style.color = color || '#fff'; this._cap.style.display = text ? 'block' : 'none'
  }
  stop (silent = false) {
    const was = this._on; this._on = false
    this._cap?.remove(); this._cap = null
    if (this._opts && !this._opts.keep) for (const id of M.IDS) { try { if (this.omniNode?.getNodeData?.(id)) send('omni:node-delete-request', { id }) } catch (_) { /* gone */ } }
    this._meshes = null
    if (was && !silent) send('omni:demo-state', { playing: false })
    return was
  }
  onResize () {}
  destroy () { this.stop(true); for (const [n, h, t] of this._bound) t.removeEventListener(n, h); this._bound = []; if (SERVICES.demo === this) SERVICES.demo = null }
}
