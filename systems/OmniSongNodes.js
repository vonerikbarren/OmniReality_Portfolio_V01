/**
 * systems/OmniSongNodes.js — the runtime of the SongNode kind (V198), built exactly like systems/OmniMusicNodes.js.
 *
 * The model of a song is utils/OmniSongModel.js (pure) and the playback is systems/OmniSongPlayer.js; the node kind (data.nodeKind 'songNode', a record disc) is
 * utils/OmniExtraKinds.js + utils/OmniSongNodeMesh.js. This module does what needs the live scene and the UI:
 *
 *   - CREATING   omni:song-node-create { position?, at?:'camera'|'selected'|'target', label?, select?, song?, demo?, id? } (answer in detail.out { ok, nodeId }). The node is an
 *                ordinary OmniNode (omni:node-create-request), so selection, delete (omni:node-delete-request -> omni:node-deleted), move, StrictAlign, save / load work as
 *                for every node. The song lives IN the node (data.song), saved with it. New songs start from defaultSong(), or demoSong() with `demo: true`.
 *   - REACTING   every frame the disc follows the player (the lit ring segment = the song position; far nodes are skipped; allocates nothing).
 *   - THE STORE  getSong / commit / edit / pushUndo / undo / redo: what the ⟐OmniSong editor and the Inspector read and write. A stored song is NEVER mutated: every edit makes a
 *                new sanitized object (the model's edit ops are immutable), so an undo step is just the previous object. Edits are applied live (SongPlayer.update) and
 *                persisted after a short pause (omni:force-save + omni:node-updated). The undo stack is capped at 100.
 *   - TRANSPORT  transport(action, nodeId, bar?) sends omni:song-transport-request (the player answers with omni:song-transport).
 *   - Events out omni:song-changed { nodeId, reason }
 *
 * Module contract: constructor(context, omniNode) / init (guarded against a second call) / update(delta) / destroy / onResize.
 * User-facing: imports no Dev* module.
 */

import * as THREE from 'three'
import * as SM from '../utils/OmniSongModel.js'
import * as PlayerMod from './OmniSongPlayer.js'
import { KIND_SONG, GEO_SONG, SERVICES } from '../utils/OmniExtraKinds.js'
import { liveSongMeshes, reactSongMesh } from '../utils/OmniSongNodeMesh.js'

const PIN_DISTANCE = 6
const UNDER_OFFSET = 1.6
const FAR_SQ = 220 * 220
const PERSIST_MS = 300
export const UNDO_MAX = 100
const COALESCE_MS = 900
const NODE_COLOR = '#7ad7f0'
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const isPlayer = (p) => !!p && typeof p.getPosition === 'function' && typeof p.isPlaying === 'function'

/** The SongPlayer singleton (the module may export it as `SongPlayer` or as its default), or null. */
export function getSongPlayer () {
  for (const c of [PlayerMod.SongPlayer, PlayerMod.default]) if (isPlayer(c)) return c
  return null
}

export default class OmniSongNodes {
  constructor (context, omniNode = null, opts = {}) {
    this.ctx = context
    this.omniNode = omniNode
    this._player = opts.player ?? null
    this._inited = 0
    this._bound = []
    this._selectedId = null
    this._persist = new Map()
    this._undo = new Map()     // nodeId -> [song]
    this._redo = new Map()
    this._sane = new WeakMap() // raw data.song -> sanitized
    this._coalesce = null      // { id, key, t }
    this._stroke = null        // node id while a drag gesture is one undo step
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:song-node-create', (d, e) => { const out = this.createSongNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? null })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-created', (d) => this._fixNode(d.node))
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    this._syncAll()
    SERVICES.song = this
  }

  update (delta) {
    const meshes = liveSongMeshes()
    if (!meshes.size) return
    const cam = this.ctx?.camera?.position
    const pl = this.player
    for (const mesh of meshes) {
      if (mesh.visible === false) continue
      const id = mesh.userData.nodeId
      if (!id || !mesh.userData.snv) continue
      if (cam) {
        const e = mesh.matrixWorld.elements
        const dx = e[12] - cam.x; const dy = e[13] - cam.y; const dz = e[14] - cam.z
        if (dx * dx + dy * dy + dz * dz > FAR_SQ) continue
      }
      const song = this.getSong(id)
      let playing = false; let frac = -1
      if (pl) {
        try {
          if (pl.isPlaying(id)) {
            const p = pl.getPosition(id)
            playing = true
            frac = song ? Math.max(0, Math.min(0.9999, ((Number(p?.bar) || 1) - 1) / Math.max(1, song.lengthBars || 32))) : -1
          }
        } catch (_) { playing = false }
      }
      reactSongMesh(mesh, song, frac, playing, delta)
    }
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this._persist.forEach(t => clearTimeout(t)); this._persist.clear()
    this._undo.clear(); this._redo.clear()
    if (SERVICES.song === this) SERVICES.song = null
    this._inited = 0
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  get selectedId () { return this._selectedId }
  /** The SongPlayer (or null when it is not available). */
  get player () { return this._player ?? getSongPlayer() }
  getNodeData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isSongNode (id) { return this.getNodeData(id)?.nodeKind === KIND_SONG }
  /** ids of every song node in the scene (creation order). */
  listSongNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_SONG).map(d => d.id) } catch (_) { return [] } }
  /** ids of every music node in the scene (the clip library of patterns); the music runtime may be absent. */
  listMusicNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === 'musicNode').map(d => d.id) } catch (_) { return [] } }

  /** The sanitized song of a node (READ ONLY: never mutate it, make a copy), or null when the node is not a song node. Cached until the node's data.song is replaced. */
  getSong (id) {
    const d = this.getNodeData(id)
    if (!d || d.nodeKind !== KIND_SONG) return null
    const raw = d.song
    if (!raw || typeof raw !== 'object') return this._sanitizedDefault(d)
    let s = this._sane.get(raw)
    if (!s) { s = SM.sanitizeSong(raw); this._sane.set(raw, s); this._sane.set(s, s) }
    return s
  }
  _sanitizedDefault (d) { const s = SM.sanitizeSong(SM.defaultSong()); this._sane.set(s, s); d.song = s; return s }

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
    const labels = new Set((this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_SONG).map(d => d.label))
    if (!labels.has('Song node')) return 'Song node'
    for (let i = 2; i < 999; i++) if (!labels.has(`Song node ${i}`)) return `Song node ${i}`
    return 'Song node'
  }

  _newSong (opts) {
    if (opts.song && typeof opts.song === 'object') return SM.sanitizeSong(opts.song)
    if (opts.demo === true && typeof SM.demoSong === 'function') { try { return SM.sanitizeSong(SM.demoSong(this.listMusicNodes())) } catch (_) { /* fall through */ } }
    return SM.sanitizeSong(SM.defaultSong())
  }

  /** New SongNode. Returns { ok, nodeId } or { ok:false, error }. */
  createSongNode (opts = {}) {
    try {
      const song = this._newSong(opts && typeof opts === 'object' ? opts : {})
      const nodeId = typeof opts.id === 'string' && /^[\w-]{1,64}$/.test(opts.id) ? opts.id : newId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_SONG, song, id: nodeId, label: String(opts.label || this._nextName()).slice(0, 40), geometry: GEO_SONG, primitive: 'objective', color: NODE_COLOR,
        position: this._positionFor(opts), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: opts.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, error: 'The song node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  /** A loaded or created song node without a usable data.song gets the default song (old saves, hand-edited data). Saved once. */
  _fixNode (d) {
    if (!d || d.nodeKind !== KIND_SONG) return
    if (!d.song || typeof d.song !== 'object' || Array.isArray(d.song)) { d.song = SM.sanitizeSong(SM.defaultSong()); this._sane.set(d.song, d.song); this._persistSoon(d.id) }
  }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* no nodes yet */ } }

  _onDeleted (id) {
    clearTimeout(this._persist.get(id)); this._persist.delete(id)
    const had = this._undo.has(id) || this._redo.has(id)
    this._undo.delete(id); this._redo.delete(id)
    if (this._stroke === id) this._stroke = null
    try { const p = this.player; if (p && (had || p.isPlaying?.(id))) p.stop?.(id) } catch (_) { /* player gone */ }
  }

  // ── Transport ───────────────────────────────────────────────────────────────

  /** action 'play' | 'stop' | 'toggle' | 'seek' (bar for seek / play-from). The player answers with omni:song-transport. */
  transport (action, nodeId, bar = null) {
    if (!['play', 'stop', 'toggle', 'seek'].includes(action) || !nodeId) return false
    const detail = { action, nodeId }
    if (bar != null && Number.isFinite(Number(bar))) detail.bar = Number(bar)
    try { window.dispatchEvent(new CustomEvent('omni:song-transport-request', { detail })) } catch (_) { return false }
    return true
  }
  isPlaying (id) { try { return !!this.player?.isPlaying(id) } catch (_) { return false } }

  // ── Store (what the editor and the Inspector use) ───────────────────────────

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
    try { window.dispatchEvent(new CustomEvent('omni:song-changed', { detail: { nodeId, reason } })) } catch (_) { /* no window */ }
  }
  _live (id, song) { try { this.player?.update?.(id, song) } catch (_) { /* the player is optional here */ } }

  /** Replace the song of a node with a sanitized copy of `song`. Does NOT touch the undo stack. Returns the stored song or false. */
  commit (id, song, reason = 'edit') {
    const d = this.getNodeData(id); if (!d || d.nodeKind !== KIND_SONG) return false
    const s = SM.sanitizeSong(song)
    this._sane.set(s, s)
    d.song = s
    this._live(id, s)
    this._announce(id, reason)
    this._persistSoon(id)
    return s
  }

  pushUndo (id) {
    const cur = this.getSong(id); if (!cur) return false
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
    const st = this._undo.get(id); const cur = this.getSong(id)
    if (!cur || !st?.length) return { ok: false, error: 'Nothing to undo.' }
    const prev = st.pop()
    const rd = this._redo.get(id) ?? []; rd.push(cur); this._redo.set(id, rd)
    this._setDirect(id, prev, 'undo')
    return { ok: true }
  }
  redo (id) {
    const rd = this._redo.get(id); const cur = this.getSong(id)
    if (!cur || !rd?.length) return { ok: false, error: 'Nothing to redo.' }
    const next = rd.pop()
    const st = this._undo.get(id) ?? []; st.push(cur); this._undo.set(id, st)
    this._setDirect(id, next, 'redo')
    return { ok: true }
  }
  _setDirect (id, song, reason) {
    const d = this.getNodeData(id); if (!d) return
    d.song = song; this._sane.set(song, song)
    this._coalesce = null
    this._live(id, song)
    this._announce(id, reason); this._persistSoon(id)
  }

  /**
   * Run an edit: `fn(song)` returns the NEW song (the model's edit ops are immutable) or { error }. One undo step (a repeated `coalesce` key within 0.9 s shares one;
   * a beginStroke() gesture is one step). Returns { ok, song } or { ok:false, error }. A no-op (the same content) is not an undo step.
   */
  edit (id, reason, fn, coalesce = null) {
    const cur = this.getSong(id); if (!cur) return { ok: false, error: 'No such song node.' }
    let next
    try { next = fn(cur) } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
    if (next && next.error) return { ok: false, error: next.error }
    if (!next || typeof next !== 'object') return { ok: false, error: 'That edit did not work.' }
    const clean = SM.sanitizeSong(next)
    if (JSON.stringify(clean) === JSON.stringify(cur)) return { ok: true, song: cur, same: true }
    const t = nowMs()
    const merge = this._stroke === id || (coalesce && this._coalesce && this._coalesce.id === id && this._coalesce.key === coalesce && t - this._coalesce.t < COALESCE_MS)
    if (!merge) this.pushUndo(id)
    this._coalesce = coalesce ? { id, key: coalesce, t } : null
    const stored = this.commit(id, clean, reason)
    return { ok: true, song: stored }
  }
  /** A drag gesture: every edit until endStroke() is ONE undo step (one is pushed now). */
  beginStroke (id) { if (this._stroke === id) return true; if (!this.getSong(id)) return false; this.pushUndo(id); this._stroke = id; this._coalesce = null; return true }
  endStroke () { this._stroke = null }

  /** For tests / the dev panel. */
  getStats () { return { meshes: liveSongMeshes().size, selected: this._selectedId, pendingSaves: this._persist.size } }
}
