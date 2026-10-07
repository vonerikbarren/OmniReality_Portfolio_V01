/**
 * systems/OmniTimelinePlayer.js — ⟐OmniTime player (V172): evaluates the project timeline (utils/OmniTimeline.js)
 * against the real scene every frame, and owns the ribbon / hand events so they work with the OmniChronos
 * window CLOSED (this module lives in main.js; the window is only a view).
 *
 * Primary Time is advanced by ui/OmniChronos.js update() (module order: this module is added AFTER it).
 *
 * Evaluation (only nodes that have at least one clip on an audible track are ever touched):
 *   - the playhead inside a clip  -> node mesh visible, keyframes interpolated onto it;
 *   - the playhead outside        -> node mesh hidden (the behaviour engine skips hidden nodes, so a node's
 *                                    OmniNodeBehavior effectively runs only while its clip is active);
 *   - clip deleted / track muted / timeline disabled / module destroyed -> the node gets its pre-timeline
 *     visibility, position, scale, rotation, opacity and colour back.
 * Muted tracks are ignored; if any track is soloed, only soloed tracks count. Overlapping clips of one node:
 * the one that starts last wins.
 *
 * Meshes are found the way systems/OmniNodeBehavior.js finds them: every node of BOTH registries (OmniNode._nodes,
 * NodeLoader._registry) has a mesh tagged mesh.userData.nodeId, so this module never reads either registry.
 * Keyframes write straight to the mesh (position.x/y/z, uniform scale, rotation.y, opacity, colour) and are never
 * saved into node data: the timeline store is the only place they live.
 *
 * Events consumed (window):
 *   omni:timeline-play-set {playing?|toggle?}  omni:timeline-step {frames}  omni:timeline-seek {t}
 *   omni:timeline-add-selected  omni:timeline-marker-add {t?, name?}
 *   omni:node-selected / -deselected / -deleted / -created / -restored, omni:nodes-updated, omni:scene-clear-request
 *
 * Module contract: constructor / init / update(delta) / destroy / onResize.
 */

import * as TL from '../utils/OmniTimeline.js'
import * as PrimaryTime from '../utils/PrimaryTime.js'

const DEG = Math.PI / 180
const RETRY_FRAMES = 20
let instance = null
export const getPlayer = () => instance

/** Node label / mesh lookups for the views (work before the module exists, with an honest fallback). */
export const nodeInfo = (id) => instance?.nodeInfo(id) ?? { id, label: id, mesh: null, exists: false }
export const listNodes = () => instance?.listNodes() ?? []
export const getNodeValue = (id, prop) => instance?.getNodeValue(id, prop) ?? null
export const getSelectedNodeId = () => instance?._selectedId ?? null

export default class OmniTimelinePlayer {
  constructor (context) {
    this.ctx = context
    this._bound = []
    this._labels = new Map()      // nodeId -> label
    this._structural = new Set()  // nodeIds that are not user content (MasterClock)
    this._meshes = new Map()      // nodeId -> mesh (validated on use)
    this._selectedId = null
    this._index = new Map()       // nodeId -> { clips: [ref] }
    this._indexRev = -1
    this._base = new Map()        // nodeId -> base pose captured on first touch
    this._lastT = NaN
    this._lastRev = -1
    this._lastEnabled = true
    this._prevT = 0
    this._frame = 0
    this._retry = false
    this._evalT = NaN
  }

  init () {
    instance = this
    TL.load()
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:timeline-play-set', (d) => { if (d.toggle) TL.togglePlay(); else TL.setPlaying(d.playing !== false) })
    on('omni:timeline-step', (d) => { TL.step(Number(d.frames) || 0); this.evaluateNow() })
    on('omni:timeline-seek', (d) => { if (Number.isFinite(d.t)) { TL.seek(d.t); this.evaluateNow() } })
    on('omni:timeline-add-selected', () => this.addSelected())
    on('omni:timeline-marker-add', (d) => { TL.addMarker({ t: Number.isFinite(d.t) ? d.t : TL.getT(), name: d.name }) })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? d.mesh?.userData?.nodeId ?? null; this._noteNode(d.node) })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-deleted', (d) => {
      if (!d.id) return
      this._restoreNode(d.id)
      this._meshes.delete(d.id); this._labels.delete(d.id)
      if (this._selectedId === d.id) this._selectedId = null
      TL.removeClipsForNode(d.id)
    })
    on('omni:node-created', (d) => { this._noteNode(d.node); this._retry = true })
    on('omni:node-restored', (d) => { this._noteNode(d.node); this._retry = true })
    on('omni:node-updated', (d) => this._noteNode(d.node))
    on('omni:nodes-updated', (d) => { if (Array.isArray(d.nodes)) for (const n of d.nodes) this._noteNode(n); this._retry = true })
    on('omni:scene-clear-request', () => { this.restoreAll(); TL.clearAll() })
  }

  onResize () {}

  update () {
    this._frame++
    const st = TL.getState()
    const t = TL.getT()

    // work area / loop: only acts when playing through the end point (never while scrubbing)
    if (PrimaryTime.isPlaying() && !TL.isScrubbing() && t !== this._prevT) {
      const end = st.workArea.out ?? (st.loop ? this.projectEnd() : null)
      if (end != null && end > 0 && this._prevT < end && t >= end) {
        if (st.loop) TL.seek(st.workArea.in ?? 0)
        else { PrimaryTime.pause(); TL.seek(end) }
      }
    }
    const now = TL.getT()
    this._prevT = now
    if (now !== this._lastT) { this._lastT = now; window.dispatchEvent(new CustomEvent('omni:timeline-playhead', { detail: { t: now } })) }

    const dirty = TL.getRevision() !== this._lastRev || st.enabled !== this._lastEnabled
    if (!dirty && now === this._evalT && !(this._retry && this._frame % RETRY_FRAMES === 0)) return
    this.evaluateNow()
  }

  destroy () {
    for (const [n, h] of this._bound) window.removeEventListener(n, h)
    this._bound.length = 0
    this.restoreAll()
    if (instance === this) instance = null
  }

  // ── nodes ─────────────────────────────────────────────────────────────────

  _noteNode (n) {
    if (!n?.id) return
    if (typeof n.label === 'string') this._labels.set(n.id, n.label)
    if (n.skipAutoSelect) this._structural.add(n.id)
  }

  resolveMesh (id) {
    let m = this._meshes.get(id)
    if (m && m.parent) return m
    m = null
    const scene = this.ctx?.scene
    if (scene?.traverse) scene.traverse((o) => { if (!m && o.userData?.nodeId === id) m = o })
    if (m) this._meshes.set(id, m); else this._meshes.delete(id)
    return m
  }

  nodeInfo (id) {
    const mesh = this._meshes.get(id)?.parent ? this._meshes.get(id) : this.resolveMesh(id)
    return { id, label: this._labels.get(id) ?? mesh?.userData?.label ?? id, mesh, exists: !!mesh }
  }

  /** Every node of BOTH registries that is in the scene right now (structural nodes excluded). */
  listNodes () {
    const out = []
    this.ctx?.scene?.traverse?.((o) => {
      const id = o.userData?.nodeId
      if (!id || this._structural.has(id)) return
      this._meshes.set(id, o)
      out.push({ id, label: this._labels.get(id) ?? o.userData.label ?? id })
    })
    return out
  }

  addSelected () {
    const id = this._selectedId
    if (!id) {
      window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: 'Timeline', desc: 'Select a node in the scene first, then add it to the timeline.', holdMs: 3500 } }))
      return null
    }
    return this.addNode(id)
  }

  addNode (id, start = TL.getT(), duration = 5) {
    const info = this.nodeInfo(id)
    const clip = TL.addClip({ nodeId: id, start, duration, label: info.label })
    if (clip) window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: 'Timeline', desc: `${info.label} added at ${TL.toTimecode(clip.start)} for ${duration}s.`, holdMs: 2500 } }))
    this.evaluateNow()
    return clip
  }

  projectEnd () {
    let e = 0
    for (const c of TL.getClips()) e = Math.max(e, c.start + c.duration)
    return e
  }

  /** Current value of a keyframe property read from the node's real mesh (rotation in degrees, colour as #rrggbb). */
  getNodeValue (id, prop) {
    const m = this.resolveMesh(id)
    if (!m) return null
    switch (prop) {
      case 'position.x': return m.position.x
      case 'position.y': return m.position.y
      case 'position.z': return m.position.z
      case 'scale': return m.scale.x
      case 'rotation.y': return m.rotation.y / DEG
      case 'opacity': return m.material && !Array.isArray(m.material) ? m.material.opacity : 1
      case 'color': return m.material?.color ? '#' + m.material.color.getHexString() : null
      default: return null
    }
  }

  // ── evaluation ────────────────────────────────────────────────────────────

  _rebuildIndex () {
    const prev = this._index
    const next = new Map()
    const keysByClip = new Map()
    for (const k of TL.getKeys()) {
      let m = keysByClip.get(k.clipId); if (!m) keysByClip.set(k.clipId, m = new Map())
      let l = m.get(k.property); if (!l) m.set(k.property, l = [])
      l.push(k)
    }
    const tracks = new Map(TL.getTracks().map(t => [t.id, t]))
    const anySolo = TL.getTracks().some(t => t.solo)
    for (const c of TL.getClips()) {
      const tr = tracks.get(c.trackId)
      if (!tr || tr.muted || (anySolo && !tr.solo)) continue
      const props = []
      const km = keysByClip.get(c.id)
      if (km) for (const [property, list] of km) {
        list.sort((a, b) => a.t - b.t)
        const rgb = property === 'color' ? list.map(k => TL.hexToRgb(k.value)) : null
        props.push({ property, list, rgb })
      }
      const ref = { clip: c, props, cycle: c.loop ? TL.cycleLength(c) : 0 }
      let n = next.get(c.nodeId); if (!n) next.set(c.nodeId, n = { clips: [] })
      n.clips.push(ref)
    }
    for (const n of next.values()) n.clips.sort((a, b) => a.clip.start - b.clip.start)
    // nodes that lost every audible clip get their own state back
    for (const id of prev.keys()) if (!next.has(id)) this._restoreNode(id)
    for (const id of [...this._base.keys()]) if (!next.has(id)) this._restoreNode(id)
    this._index = next
    this._indexRev = TL.getRevision()
  }

  evaluateNow () {
    const st = TL.getState()
    if (this._indexRev !== TL.getRevision()) this._rebuildIndex()
    this._lastRev = TL.getRevision()
    this._lastEnabled = st.enabled
    const t = TL.getT()
    this._evalT = t
    if (!st.enabled) { this.restoreAll(); return }
    let missing = false
    for (const [id, entry] of this._index) {
      const mesh = this._meshes.get(id)?.parent ? this._meshes.get(id) : this.resolveMesh(id)
      if (!mesh) { missing = true; continue }
      let active = null
      for (let i = 0; i < entry.clips.length; i++) {
        const r = entry.clips[i], c = r.clip
        if (t >= c.start && t < c.start + c.duration) active = r
      }
      let b = this._base.get(id)
      if (!b) {
        b = { visible: mesh.visible, px: mesh.position.x, py: mesh.position.y, pz: mesh.position.z, s: mesh.scale.x, sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z, ry: mesh.rotation.y, touched: 0, op: 1, transp: false, r: 1, g: 1, bl: 1 }
        const mat = mesh.material && !Array.isArray(mesh.material) ? mesh.material : null
        if (mat) { b.op = mat.opacity; b.transp = mat.transparent; if (mat.color) { b.r = mat.color.r; b.g = mat.color.g; b.bl = mat.color.b } }
        this._base.set(id, b)
      }
      if (!active) { if (mesh.visible) mesh.visible = false; continue }
      if (!mesh.visible) mesh.visible = true
      const c = active.clip
      const src = TL.sourceTime(c, t, active.cycle)
      for (let i = 0; i < active.props.length; i++) {
        const p = active.props[i]
        this._applyProp(mesh, b, p, src)
      }
    }
    this._retry = missing
  }

  _applyProp (mesh, b, p, src) {
    const prop = p.property
    if (prop === 'color') {
      const mat = mesh.material && !Array.isArray(mesh.material) ? mesh.material : null
      if (!mat?.color) return
      const l = p.list, n = l.length
      let r, g, bl
      if (src <= l[0].t || n === 1) { r = p.rgb[0][0]; g = p.rgb[0][1]; bl = p.rgb[0][2] }
      else if (src >= l[n - 1].t) { r = p.rgb[n - 1][0]; g = p.rgb[n - 1][1]; bl = p.rgb[n - 1][2] }
      else {
        let i = 0
        while (i < n - 2 && src >= l[i + 1].t) i++
        const span = l[i + 1].t - l[i].t
        const u = span > 1e-9 ? TL.easeU(l[i].ease, (src - l[i].t) / span) : 1
        const A = p.rgb[i], B = p.rgb[i + 1]
        r = A[0] + (B[0] - A[0]) * u; g = A[1] + (B[1] - A[1]) * u; bl = A[2] + (B[2] - A[2]) * u
      }
      mat.color.setRGB(r / 255, g / 255, bl / 255)
      b.touched |= 32
      return
    }
    const v = TL.evalKeyList(p.list, src, prop)
    if (v == null) return
    switch (prop) {
      case 'position.x': mesh.position.x = v; b.touched |= 1; break
      case 'position.y': mesh.position.y = v; b.touched |= 1; break
      case 'position.z': mesh.position.z = v; b.touched |= 1; break
      case 'scale': mesh.scale.set(v, v, v); b.touched |= 2; break
      case 'rotation.y': mesh.rotation.y = v * DEG; b.touched |= 4; break
      case 'opacity': {
        const mat = mesh.material && !Array.isArray(mesh.material) ? mesh.material : null
        if (!mat) break
        if (!mat.transparent) { mat.transparent = true; mat.needsUpdate = true }
        mat.opacity = v < 0 ? 0 : v > 1 ? 1 : v
        b.touched |= 8
        break
      }
    }
  }

  /** Give one node back everything the timeline changed. */
  _restoreNode (id) {
    const b = this._base.get(id)
    if (!b) return
    this._base.delete(id)
    const mesh = this._meshes.get(id)
    if (!mesh) return
    mesh.visible = b.visible
    if (b.touched & 1) mesh.position.set(b.px, b.py, b.pz)
    if (b.touched & 2) mesh.scale.set(b.sx, b.sy, b.sz)
    if (b.touched & 4) mesh.rotation.y = b.ry
    const mat = mesh.material && !Array.isArray(mesh.material) ? mesh.material : null
    if (mat) {
      if (b.touched & 8) { mat.opacity = b.op; if (mat.transparent !== b.transp) { mat.transparent = b.transp; mat.needsUpdate = true } }
      if ((b.touched & 32) && mat.color) mat.color.setRGB(b.r, b.g, b.bl)
    }
  }

  restoreAll () {
    for (const id of [...this._base.keys()]) this._restoreNode(id)
  }
}
