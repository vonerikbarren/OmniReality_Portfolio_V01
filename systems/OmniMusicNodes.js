/**
 * systems/OmniMusicNodes.js — the runtime of the MusicNode kind (V195).
 *
 * The model of a pattern is utils/OmniMusicModel.js (pure); the node kind (data.nodeKind 'musicNode', a drum-machine plate) is utils/OmniExtraKinds.js +
 * utils/OmniMusicNodeMesh.js; the transport / scheduler / recorder is systems/OmniSequencer.js. This module does what needs the live scene and the UI:
 *
 *   - CREATING   omni:music-node-create { position?, at?:'camera'|'selected'|'target', label?, select?, music?, id? } (answer in detail.out). The node is an ordinary
 *                OmniNode (omni:node-create-request), so selection, delete (omni:node-delete-request -> omni:node-deleted), move, StrictAlign, save / load work as for
 *                every node. The pattern lives IN the node (data.music), saved by reference with it.
 *   - REACTING   every frame the plate follows the sequencer (lit cells = notes, playhead column, flash on notes; far nodes are skipped; allocates nothing).
 *   - THE STORE  getMusic / commit / pushUndo / undo / redo / undoDepth: what the sequencer and the panels read and write. A stored pattern is NEVER mutated: every edit
 *                makes a new sanitized object, so an undo step is just the previous object. Edits are applied live (the scheduler reads the pattern each tick) and
 *                persisted after a short pause (omni:force-save + omni:node-updated).
 *   - EDITING    one API shared by the OmniSequencer panel and the Inspector block: setField, setTrackField, addTrack, removeTrack, moveTrack, duplicateTrack,
 *                toggleStep, setEvent, removeEvent, applyPattern, clearTrack, copyTrack / pasteTrack. Every call returns { ok, ... } or { ok:false, error }; unknown keys
 *                (also __proto__) are refused.
 *   - Events out omni:music-data-changed { nodeId, reason }
 *
 * Module contract: constructor(context, omniNode) / init (guarded against a second call) / update(delta) / destroy / onResize.
 * User-facing: imports no Dev* module.
 */

import * as THREE from 'three'
import * as MM from '../utils/OmniMusicModel.js'
import { KIND_MUSIC, GEO_MUSIC, SERVICES } from '../utils/OmniExtraKinds.js'
import { liveMusicMeshes, reactMusicMesh, flashNote } from '../utils/OmniMusicNodeMesh.js'

const PIN_DISTANCE = 6
const UNDER_OFFSET = 1.6
const FAR_SQ = 220 * 220
const PERSIST_MS = 300
const UNDO_MAX = 60
const COALESCE_MS = 900
const NODE_COLOR = '#ffb86b'
export const MUSIC_NODES_MAX = 64   // V198: how many music nodes a reality may hold (create and duplicate refuse beyond it, code 'node-cap')
const DUP_STEP_Z = 1.4
export const FIELD_KEYS = Object.freeze(['tempo', 'stepsPerBar', 'bars', 'resolution', 'swing', 'gain', 'loop', 'countIn', 'metronome', 'recordQuantize', 'recordResolution', 'overdub'])
export const TRACK_KEYS = Object.freeze(['name', 'instrumentNodeId', 'mute', 'solo', 'volume', 'pan', 'transpose', 'note', 'view'])
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
let CLIP = null   // a copied track (plain object) shared by every music node

export default class OmniMusicNodes {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._inited = 0
    this._bound = []
    this._selectedId = null
    this._persist = new Map()
    this._undo = new Map()     // nodeId -> [music]
    this._redo = new Map()
    this._sane = new WeakMap() // raw data.music -> sanitized
    this._coalesce = null      // { id, key, t }
    this._stroke = null        // node id while a drag / paint gesture is one undo step
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:music-node-create', (d, e) => { const out = this.createMusicNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:music-node-duplicate', (d, e) => { const out = this.duplicateMusicNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? null })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-created', (d) => this._fixNode(d.node))
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on('omni:music-step', (d) => this._flash(d))
    this._syncAll()
    SERVICES.music = this
  }

  update (delta) {
    const meshes = liveMusicMeshes()
    if (!meshes.size) return
    const cam = this.ctx?.camera?.position
    const seq = SERVICES.sequencer
    for (const mesh of meshes) {
      if (mesh.visible === false) continue
      const id = mesh.userData.nodeId
      if (!id || !mesh.userData.mnv) continue
      if (cam) {
        const e = mesh.matrixWorld.elements
        const dx = e[12] - cam.x; const dy = e[13] - cam.y; const dz = e[14] - cam.z
        if (dx * dx + dy * dy + dz * dz > FAR_SQ) continue
      }
      let state = 0; let step = -1
      if (seq && seq.nodeId === id && seq.state !== 'stop') { state = seq.state === 'record' ? (seq.countingIn ? 3 : 2) : 1; step = seq.currentStep(id) }
      reactMusicMesh(mesh, this.getMusic(id), step, state, delta)
    }
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this._persist.forEach(t => clearTimeout(t)); this._persist.clear()
    this._undo.clear(); this._redo.clear()
    if (SERVICES.music === this) SERVICES.music = null
    this._inited = 0
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  get selectedId () { return this._selectedId }
  getNodeData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isMusicNode (id) { return this.getNodeData(id)?.nodeKind === KIND_MUSIC }
  /** ids of every music node in the scene (creation order). */
  listMusicNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_MUSIC).map(d => d.id) } catch (_) { return [] } }

  /** The sanitized pattern of a node (READ ONLY: never mutate it, make a copy), or null when the node is not a music node. Cached until the node's data.music is replaced. */
  getMusic (id) {
    const d = this.getNodeData(id)
    if (!d || d.nodeKind !== KIND_MUSIC) return null
    const raw = d.music
    if (!raw || typeof raw !== 'object') return this._sanitizedDefault(d)
    let s = this._sane.get(raw)
    if (!s) { s = MM.sanitizeMusic(raw); this._sane.set(raw, s); this._sane.set(s, s) }
    return s
  }
  _sanitizedDefault (d) { const s = MM.defaultMusic(); this._sane.set(s, s); d.music = s; return s }

  // ── Creating ────────────────────────────────────────────────────────────────

  _frontOfCamera () {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const p = cam.position.clone().addScaledVector(dir, PIN_DISTANCE)
    return [p.x, Math.max(0.6, p.y), p.z]
  }

  _positionFor (opts) {
    const p = opts.position
    if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    if (p && typeof p === 'object' && [p.x, p.y, p.z].every(Number.isFinite)) return [p.x, p.y, p.z]
    if (opts.at === 'selected' && this._selectedId) {
      const m = this.omniNode?.getMeshById?.(this._selectedId)
      if (m) { const v = new THREE.Vector3(); m.getWorldPosition(v); return [v.x, v.y - UNDER_OFFSET, v.z] }
    }
    if (opts.at === 'target') {
      const t = this.ctx.controls?.target
      if (t && [t.x, t.y, t.z].every(Number.isFinite)) return [t.x, t.y - UNDER_OFFSET * 0.5, t.z]
    }
    return this._frontOfCamera()
  }

  _nextName () {
    const labels = new Set((this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_MUSIC).map(d => d.label))
    if (!labels.has('Music node')) return 'Music node'
    for (let i = 2; i < 999; i++) if (!labels.has(`Music node ${i}`)) return `Music node ${i}`
    return 'Music node'
  }

  /** New MusicNode. Returns { ok, nodeId } or { ok:false, error }. */
  createMusicNode (opts = {}) {
    try {
      if (this.listMusicNodes().length >= MUSIC_NODES_MAX) return { ok: false, code: 'node-cap', error: `A reality can hold at most ${MUSIC_NODES_MAX} music nodes.` }
      const music = MM.sanitizeMusic(opts.music && typeof opts.music === 'object' ? opts.music : MM.defaultMusic())
      const nodeId = typeof opts.id === 'string' && /^[\w-]{1,64}$/.test(opts.id) ? opts.id : newId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_MUSIC, music, id: nodeId, label: String(opts.label || this._nextName()).slice(0, 40), geometry: GEO_MUSIC, primitive: 'objective', color: NODE_COLOR,
        position: this._positionFor(opts), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: opts.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, error: 'The music node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  /**
   * V198: omni:music-node-duplicate { nodeId, select? } -> detail.out { ok, nodeId, sourceId } or { ok:false, code, error } with code 'no-node' (missing / no id),
   * 'not-music' (the node is not a music node), 'node-cap' (MUSIC_NODES_MAX reached) or 'failed'. The copy is a deep SANITIZED clone of data.music (same tracks,
   * notes and instruments), its label gets ' copy', it is placed next to the original (one plate depth further, further again when taken) and has its own undo stack.
   * The original is not touched, so a duplicate never changes what Undo does for it.
   */
  duplicateMusicNode (opts = {}) {
    try {
      const src = typeof opts?.nodeId === 'string' ? opts.nodeId : null
      const d = src ? this.getNodeData(src) : null
      if (!d) return { ok: false, code: 'no-node', error: 'That music node does not exist.' }
      if (d.nodeKind !== KIND_MUSIC) return { ok: false, code: 'not-music', error: 'That node is not a music node.' }
      if (this.listMusicNodes().length >= MUSIC_NODES_MAX) return { ok: false, code: 'node-cap', error: `A reality can hold at most ${MUSIC_NODES_MAX} music nodes.` }
      const music = MM.sanitizeMusic(JSON.parse(JSON.stringify(this.getMusic(src))))
      const mesh = this.omniNode?.getMeshById?.(src)
      let position = null; let rotation = [0, 0, 0]; let scale = [1, 1, 1]
      if (mesh) {
        const v = new THREE.Vector3(); mesh.getWorldPosition(v)
        const taken = this.listMusicNodes().map(id => this.omniNode?.getMeshById?.(id)).filter(Boolean).map(m => { const w = new THREE.Vector3(); m.getWorldPosition(w); return w })
        let z = DUP_STEP_Z
        for (let i = 0; i < 12; i++, z += DUP_STEP_Z) if (!taken.some(w => Math.abs(w.x - v.x) < 0.5 && Math.abs(w.y - v.y) < 0.5 && Math.abs(w.z - (v.z + z)) < 0.5)) break
        position = [v.x, v.y, v.z + z]
        if (mesh.rotation) rotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z]
        if (mesh.scale) scale = [mesh.scale.x, mesh.scale.y, mesh.scale.z]
      }
      const nodeId = newId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_MUSIC, music, id: nodeId, label: (String(d.label || 'Music node') + ' copy').slice(0, 40), geometry: GEO_MUSIC, primitive: 'objective', color: d.color || NODE_COLOR,
        position: position ?? this._frontOfCamera(), rotation, scale, noParent: true, noSelect: opts.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, code: 'failed', error: 'The music node could not be duplicated.' }
      return { ok: true, nodeId, sourceId: src }
    } catch (err) { return { ok: false, code: 'failed', error: String(err?.message ?? err) } }
  }

  /** A loaded or created music node without a usable data.music gets the default pattern (old saves, hand-edited data). Saved once. */
  _fixNode (d) {
    if (!d || d.nodeKind !== KIND_MUSIC) return
    if (!d.music || typeof d.music !== 'object' || Array.isArray(d.music)) { d.music = MM.defaultMusic(); this._sane.set(d.music, d.music); this._persistSoon(d.id) }
  }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* no nodes yet */ } }

  _onDeleted (id) {
    clearTimeout(this._persist.get(id)); this._persist.delete(id)
    this._undo.delete(id); this._redo.delete(id)
    if (SERVICES.sequencer && SERVICES.sequencer.nodeId === id) SERVICES.sequencer.stop?.()
  }

  _flash (d) {
    const mesh = this.omniNode?.getMeshById?.(d?.nodeId); if (!mesh?.userData?.mnv) return
    const m = this.getMusic(d.nodeId); if (!m) return
    const row = m.tracks.findIndex(t => t.id === d.trackId)
    if (row >= 0) flashNote(mesh, row, d.step, MM.totalSteps(m))
  }

  // ── Store (what the sequencer and the panels use) ───────────────────────────

  _persistSoon (id) {
    if (!id) return
    clearTimeout(this._persist.get(id))
    this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS))
  }
  /** Save now (omni:force-save) and tell the listeners (omni:node-updated). */
  flush (id) {
    if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) }
    const d = id ? this.getNodeData(id) : null
    if (!d) return false
    try { window.dispatchEvent(new CustomEvent('omni:force-save', { detail: {} })) } catch (_) { /* no window */ }
    try { window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: d } })) } catch (_) { /* no window */ }
    return true
  }
  flushAll () { for (const id of [...this._persist.keys()]) this.flush(id) }

  _announce (nodeId, reason) {
    try { window.dispatchEvent(new CustomEvent('omni:music-data-changed', { detail: { nodeId, reason } })) } catch (_) { /* no window */ }
  }

  /** Replace the pattern of a node with a sanitized copy of `music`. Does NOT touch the undo stack. Returns the stored pattern or false. */
  commit (id, music, reason = 'edit') {
    const d = this.getNodeData(id); if (!d || d.nodeKind !== KIND_MUSIC) return false
    const s = MM.sanitizeMusic(music)
    this._sane.set(s, s)
    d.music = s
    this._announce(id, reason)
    this._persistSoon(id)
    return s
  }

  pushUndo (id) {
    const cur = this.getMusic(id); if (!cur) return false
    const st = this._undo.get(id) ?? []
    st.push(cur)
    if (st.length > UNDO_MAX) st.shift()
    this._undo.set(id, st)
    this._redo.delete(id)
    return true
  }
  undoDepth (id) { return this._undo.get(id)?.length ?? 0 }
  canUndo (id) { return this.undoDepth(id) > 0 }
  canRedo (id) { return (this._redo.get(id)?.length ?? 0) > 0 }
  undo (id) {
    const st = this._undo.get(id); const cur = this.getMusic(id)
    if (!cur || !st?.length) return { ok: false, error: 'Nothing to undo.' }
    const prev = st.pop()
    const rd = this._redo.get(id) ?? []; rd.push(cur); this._redo.set(id, rd)
    this._setDirect(id, prev, 'undo')
    return { ok: true }
  }
  redo (id) {
    const rd = this._redo.get(id); const cur = this.getMusic(id)
    if (!cur || !rd?.length) return { ok: false, error: 'Nothing to redo.' }
    const next = rd.pop()
    const st = this._undo.get(id) ?? []; st.push(cur); this._undo.set(id, st)
    this._setDirect(id, next, 'redo')
    return { ok: true }
  }
  _setDirect (id, music, reason) {
    const d = this.getNodeData(id); if (!d) return
    d.music = music; this._sane.set(music, music)
    this._coalesce = null
    this._announce(id, reason); this._persistSoon(id)
  }

  // ── Editing ─────────────────────────────────────────────────────────────────

  /** Run an edit on a CLONE: `fn(next, clone-helpers)` mutates and may return an { error }; one undo step (a repeated `coalesce` key within 0.9 s shares one). */
  _edit (id, reason, fn, coalesce = null) {
    const cur = this.getMusic(id); if (!cur) return { ok: false, error: 'No such music node.' }
    const next = { ...cur, tracks: cur.tracks.map(t => ({ ...t, steps: t.steps.slice() })) }
    const res = fn(next)
    if (res && res.error) return { ok: false, error: res.error }
    const t = nowMs()
    const merge = this._stroke === id || (coalesce && this._coalesce && this._coalesce.id === id && this._coalesce.key === coalesce && t - this._coalesce.t < COALESCE_MS)
    if (!merge) this.pushUndo(id)
    this._coalesce = coalesce ? { id, key: coalesce, t } : null
    const stored = this.commit(id, next, reason)
    return { ok: true, music: stored, ...(res && typeof res === 'object' ? res : {}) }
  }
  _track (m, trackId) { return m.tracks.find(t => t.id === trackId) ?? null }
  /** A drag / paint gesture: every edit until endStroke() is ONE undo step (one is pushed now). */
  beginStroke (id) { if (this._stroke === id) return true; if (!this.getMusic(id)) return false; this.pushUndo(id); this._stroke = id; this._coalesce = null; return true }
  endStroke () { this._stroke = null }

  /** Set one pattern field (FIELD_KEYS). Returns { ok, value, lost? } (lost = notes cut off by a shorter pattern). */
  setField (id, key, value) {
    if (typeof key !== 'string' || !FIELD_KEYS.includes(key)) return { ok: false, error: 'Unknown setting.' }
    const before = this.getMusic(id)
    const r = this._edit(id, 'field', (m) => { m[key] = value }, 'field:' + key)
    if (!r.ok) return r
    const now = r.music
    const lost = before ? MM.countEvents(before) - MM.countEvents(now) : 0
    return { ok: true, value: now[key], lost: lost > 0 ? lost : 0 }
  }

  setTrackField (id, trackId, key, value) {
    if (typeof key !== 'string' || !TRACK_KEYS.includes(key)) return { ok: false, error: 'Unknown track setting.' }
    if (key === 'instrumentNodeId' && value != null && value !== '') {
      const d = this.getNodeData(String(value))
      if (!d || !d.sound || typeof d.sound !== 'object') return { ok: false, error: 'That node has no sound to play the notes with.' }
    }
    const r = this._edit(id, 'track', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      t[key] = key === 'instrumentNodeId' && (value === '' || value == null) ? null : value
    }, 'track:' + trackId + ':' + key)
    if (!r.ok) return r
    return { ok: true, value: MM.findTrack(r.music, trackId)?.[key] }
  }

  addTrack (id, over = {}) {
    return this._edit(id, 'track', (m) => {
      if (m.tracks.length >= MM.LIMITS.tracksMax) return { error: `A pattern has at most ${MM.LIMITS.tracksMax} tracks.` }
      const t = MM.newTrack(m, over && typeof over === 'object' ? over : {})
      m.tracks.push(t)
      return { trackId: t.id }
    })
  }
  removeTrack (id, trackId) {
    return this._edit(id, 'track', (m) => {
      const i = m.tracks.findIndex(t => t.id === trackId); if (i < 0) return { error: 'No such track.' }
      m.tracks.splice(i, 1)
    })
  }
  moveTrack (id, trackId, delta) {
    return this._edit(id, 'track', (m) => {
      const i = m.tracks.findIndex(t => t.id === trackId); if (i < 0) return { error: 'No such track.' }
      const j = Math.max(0, Math.min(m.tracks.length - 1, i + (Number(delta) < 0 ? -1 : 1)))
      if (j === i) return
      const [t] = m.tracks.splice(i, 1); m.tracks.splice(j, 0, t)
    })
  }
  duplicateTrack (id, trackId) {
    return this._edit(id, 'track', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      if (m.tracks.length >= MM.LIMITS.tracksMax) return { error: `A pattern has at most ${MM.LIMITS.tracksMax} tracks.` }
      const c = MM.newTrack(m, { ...t, name: (t.name + ' copy').slice(0, MM.LIMITS.nameMax) })
      c.steps = t.steps.map(s => ({ ...s }))
      m.tracks.splice(m.tracks.indexOf(t) + 1, 0, c)
      return { trackId: c.id }
    })
  }

  /** The grid click: a note at (step, midi = the track's note by default) is added, or removed when it is already there. Returns { ok, on }. */
  toggleStep (id, trackId, step, midi = null, o = {}) {
    return this._edit(id, 'steps', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      const total = MM.totalSteps(m); const s = Math.round(Number(step))
      if (!Number.isFinite(s) || s < 0 || s >= total) return { error: 'That step does not exist.' }
      const n = midi == null ? t.note : Math.round(Number(midi))
      const had = MM.removeEvent(t, s, n) > 0
      if (had) return { on: false }
      const ok = MM.upsertEvent(t, { step: s, midi: n, velocity: o.velocity ?? 0.8, gate: o.gate ?? 0.9, prob: o.prob ?? 1, offset: o.offset ?? 0 }, total)
      return ok ? { on: true } : { error: 'That note could not be added.' }
    })
  }

  /** Add / replace an event ({ step, midi, velocity?, gate?, prob?, offset? }); `coalesce` (e.g. a drag) shares one undo step. */
  setEvent (id, trackId, ev, coalesce = null) {
    return this._edit(id, 'steps', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      if (!MM.upsertEvent(t, ev, MM.totalSteps(m))) return { error: 'That note could not be set.' }
    }, coalesce)
  }
  /** V198 (piano roll): replace ALL the events of a track at once (sanitized by the commit: clamps, one event per step + pitch, sorted, 4096 max). `coalesce` / a stroke share one undo step. */
  replaceEvents (id, trackId, events, coalesce = null) {
    if (!Array.isArray(events)) return { ok: false, error: 'No notes given.' }
    return this._edit(id, 'steps', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      t.steps = events.slice(0, MM.LIMITS.eventsMax * 2).map(e => ({ ...e }))
    }, coalesce)
  }
  removeEvent (id, trackId, step, midi = null) {
    return this._edit(id, 'steps', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      if (!MM.removeEvent(t, Math.round(Number(step)), midi == null ? null : Math.round(Number(midi)))) return { error: 'There was no note there.' }
    })
  }

  /** Fill a track with a preset pattern (PATTERNS), written at `root` (default: the preset's own pitch for drums, the track's note for pitched presets). */
  applyPattern (id, trackId, patternId, root = null) {
    if (!MM.isPatternId(patternId)) return { ok: false, error: 'Unknown pattern.' }
    return this._edit(id, 'pattern', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      const p = MM.PATTERNS[patternId]
      const r = root != null ? root : (p.role === 'drum' ? p.note : t.note)
      t.steps = MM.patternEvents(patternId, m, { root: r })
      if (patternId !== 'empty') { t.note = Math.max(0, Math.min(127, Math.round(Number(r)))); t.view = p.role === 'pitch' ? 'roll' : t.view }
    })
  }
  clearTrack (id, trackId) { return this.applyPattern(id, trackId, 'empty') }

  copyTrack (id, trackId) {
    const m = this.getMusic(id); const t = m && MM.findTrack(m, trackId)
    if (!t) return { ok: false, error: 'No such track.' }
    CLIP = JSON.parse(JSON.stringify(t))
    return { ok: true, events: t.steps.length }
  }
  get hasClipboard () { return !!CLIP }
  /** Paste the copied notes into a track (replacing its notes; the length of the target pattern decides what fits). */
  pasteTrack (id, trackId) {
    if (!CLIP) return { ok: false, error: 'Nothing was copied.' }
    return this._edit(id, 'paste', (m) => {
      const t = this._track(m, trackId); if (!t) return { error: 'No such track.' }
      t.steps = CLIP.steps.map(s => ({ ...s }))
      t.note = CLIP.note; t.view = CLIP.view
    })
  }

  /** For tests / the dev panel. */
  getStats () { return { meshes: liveMusicMeshes().size, selected: this._selectedId, pendingSaves: this._persist.size } }
}
