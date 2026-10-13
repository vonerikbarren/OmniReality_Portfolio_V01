/**
 * systems/OmniSoundNodes.js — the runtime of the SoundNode kind and of "sound on every node" (V194).
 *
 * The model of a sound is utils/OmniSoundModel.js, of its particles utils/OmniSoundParticleModel.js (both pure); the audio is systems/OmniSoundEngine.js and its
 * scene glue systems/OmniSoundScene.js (they own start / stop / auto-start / deleting a node's voices); the node kind (data.nodeKind 'soundNode', a speaker-bell mesh
 * with reacting children) is utils/OmniExtraKinds.js + utils/OmniSoundNodeMesh.js. This module does what needs the live scene and the UI:
 *
 *   - CREATING   omni:sound-node-create { position?, at?:'camera'|'selected'|'target', label?, select?, sound?, soundParticles? } (answer in detail.out). The node is an
 *                ordinary OmniNode (omni:node-create-request), so selection, delete (omni:node-delete-request -> omni:node-deleted), move, StrictAlign, save / load work as
 *                for every node. The sound settings live IN the node: data.sound, data.soundParticles (saved by reference with it, nothing is copied elsewhere).
 *   - REACTING   every frame the SoundNode meshes follow SoundEngine.getAnalysis(id) (utils/OmniSoundNodeMesh.js; far nodes are skipped; allocates nothing).
 *   - EDITING    one API shared by the ⟐SoundNodeSettings panel and the Inspector 'Sound' section (getView, ensureSound, setField, applyPreset, resetGroup, undo, JSON):
 *                every edit is sanitized with the models, applied LIVE to a playing voice (SoundEngine.update) and persisted after a short pause (omni:force-save).
 *                Any node can carry sound: data.sound is created lazily with defaultSound() the first time it is enabled; a node without it behaves exactly as before.
 *   - SETTINGS   owns the omni:sound-settings-set listener (utils/OmniSoundSettings.js): saves, announces omni:sound-settings-changed and applies the master volume / mute
 *                to the engine. omni:sound-enable-request = "the person pressed Enable sound": opt-in + unmute.
 *   - Events out omni:sound-data-changed { nodeId, scope:'sound'|'particles'|'both', reason }
 *
 * Module contract: constructor(context, omniNode) / init (guarded against a second call) / update(delta) / destroy / onResize.
 * User-facing: imports no Dev* module.
 */

import * as THREE from 'three'
import SoundEngine from './OmniSoundEngine.js'
import { SOUND_SCHEMA, SOUND_PRESETS, defaultSound, sanitizeSound, noteToFreq, midiToFreq } from '../utils/OmniSoundModel.js'
import { PARTICLE_SCHEMA, defaultParticles, sanitizeParticles } from '../utils/OmniSoundParticleModel.js'
import * as Settings from '../utils/OmniSoundSettings.js'
import { KIND_SOUND, GEO_SOUND, SERVICES } from '../utils/OmniExtraKinds.js'
import { liveSoundMeshes, reactSoundMesh } from '../utils/OmniSoundNodeMesh.js'

const PIN_DISTANCE = 6
const UNDER_OFFSET = 1.6
const FAR_SQ = 220 * 220           // beyond this distance a sound node's visual is not updated
const PERSIST_MS = 300
const AUDITION_MS = 2000
const UNDO_MAX = 30
const JSON_MAX = 200000
export const PRESERVE_KEYS = ['enabled', 'label', 'tags', 'color', 'autoStart']   // kept when a preset replaces the sound
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const plainClone = (o) => { try { return JSON.parse(JSON.stringify(o)) } catch (_) { return null } }
const fieldKeys = (schema) => new Set((schema ?? []).flatMap(g => (g.fields ?? []).map(f => f.key)))
const fieldIndex = (schema) => new Map((schema ?? []).flatMap(g => (g.fields ?? []).map(f => [f.key, f])))
// read from the schemas when needed (not once at import), so a field the models gain is editable without a change here
const soundKeys = () => fieldKeys(SOUND_SCHEMA)
const particleKeys = () => fieldKeys(PARTICLE_SCHEMA)
const hasKnownKey = (o, keys) => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).some(k => keys.has(k))

/** Is `v` a value of the right KIND for this schema field? (The models clamp and repair; this stops a wrong kind from silently becoming the default.) */
function acceptable (f, v) {
  switch (f?.type) {
    case 'number': return (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v))
    case 'bool': return typeof v === 'boolean'
    case 'enum': return Array.isArray(f.options) && f.options.some(o => o.value === v || String(o.value) === String(v))
    case 'note': return (typeof v === 'string' && v.length > 0 && v.length < 8) || (typeof v === 'number' && Number.isFinite(v))
    case 'color': return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
    default: return typeof v === 'string'
  }
}

/** The pitch of a sound in Hz for colouring (the model's note helpers; 440 when the sound has no usable pitch). Never throws. */
export function soundFreq (sound) {
  try {
    if (!sound) return 440
    if (Number.isFinite(sound.midi)) { const f = midiToFreq(sound.midi); if (f > 0) return f }
    const n = sound.note
    if (typeof n === 'string' && n) {
      const f = noteToFreq(/-?\d$/.test(n) ? n : n + (Number.isFinite(sound.octave) ? sound.octave : 4))
      if (f > 0) return f
    } else if (Number.isFinite(n)) { const f = noteToFreq(n); if (f > 0) return f }
  } catch (_) { /* fall through */ }
  return 440
}

export default class OmniSoundNodes {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._inited = 0
    this._bound = []
    this._selectedId = null
    this._t = 0
    this._opts = { muted: false, freqOf: soundFreq }
    this._persist = new Map()   // nodeId -> timeout handle
    this._audition = new Map()  // nodeId -> timeout handle
    this._undo = new Map()      // nodeId -> [{ sound, soundParticles }]
  }

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not double the listeners
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:sound-node-create', (d, e) => { const out = this.createSoundNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? null })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-created', (d) => this._fixNode(d.node))
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on(Settings.SET_EVENT, (d) => { Settings.applySettingsEvent(d) })
    on(Settings.CHANGED_EVENT, () => this.applySettingsToEngine())
    on('omni:sound-enable-request', () => this.enableSound())
    this._syncAll()
    this.applySettingsToEngine()
    SERVICES.sound = this
  }

  update (delta) {
    this._t += delta || 0
    const meshes = liveSoundMeshes()
    if (!meshes.size) return
    const cam = this.ctx?.camera?.position
    const o = this._opts
    for (const mesh of meshes) {
      if (mesh.visible === false) continue
      const ek = mesh.userData.extraKind
      const id = mesh.userData.nodeId
      if (!ek || !id) continue
      if (cam) {
        const e = mesh.matrixWorld.elements
        const dx = e[12] - cam.x; const dy = e[13] - cam.y; const dz = e[14] - cam.z
        if (dx * dx + dy * dy + dz * dz > FAR_SQ) continue
      }
      reactSoundMesh(mesh, SoundEngine.getAnalysis(id), ek.data?.sound, delta, this._t, o)
    }
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this._persist.forEach(t => clearTimeout(t)); this._persist.clear()
    this._audition.forEach(t => clearTimeout(t)); this._audition.clear()
    this._undo.clear()
    if (SERVICES.sound === this) SERVICES.sound = null
    this._inited = 0
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  get selectedId () { return this._selectedId }
  getNodeData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isSoundNode (id) { return this.getNodeData(id)?.nodeKind === KIND_SOUND }

  /**
   * What the UI shows for a node: { exists, id, label, isSoundNode, enabled, sound, particles } with `sound` / `particles` SANITIZED COPIES (or null when the node has none yet).
   * A hostile or old data.sound is repaired in the copy; the stored object is only replaced when the person edits.
   */
  getView (id) {
    const d = this.getNodeData(id)
    if (!d) return { exists: false, id, label: '', isSoundNode: false, enabled: false, sound: null, particles: null }
    const sound = d.sound && typeof d.sound === 'object' ? sanitizeSound(d.sound) : null
    const particles = d.soundParticles && typeof d.soundParticles === 'object' ? sanitizeParticles(d.soundParticles) : null
    return { exists: true, id, label: d.label ?? id, isSoundNode: d.nodeKind === KIND_SOUND, enabled: !!(sound && sound.enabled), sound, particles }
  }

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
    const labels = new Set((this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_SOUND).map(d => d.label))
    if (!labels.has('Sound node')) return 'Sound node'
    for (let i = 2; i < 999; i++) if (!labels.has(`Sound node ${i}`)) return `Sound node ${i}`
    return 'Sound node'
  }

  /** New SoundNode. Returns { ok, nodeId } or { ok:false, error }. Position: opts.position, else under the selected node / the camera target (opts.at), else ahead of the camera. */
  createSoundNode (opts = {}) {
    try {
      const sound = sanitizeSound({ ...defaultSound(), ...(opts.sound && typeof opts.sound === 'object' ? opts.sound : {}), enabled: true })
      const soundParticles = sanitizeParticles({ ...defaultParticles(), ...(opts.soundParticles && typeof opts.soundParticles === 'object' ? opts.soundParticles : {}) })
      const nodeId = typeof opts.id === 'string' && /^[\w-]{1,64}$/.test(opts.id) ? opts.id : newId()
      const color = typeof sound.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(sound.color) ? sound.color : '#7fd8ff'
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_SOUND, sound, soundParticles, id: nodeId, label: String(opts.label || this._nextName()).slice(0, 40), geometry: GEO_SOUND, primitive: 'objective', color,
        position: this._positionFor(opts), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: opts.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, error: 'The sound node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  /** A loaded or created sound node without a usable data.sound gets the defaults (old saves, hand-edited data). Saved once. */
  _fixNode (d) {
    if (!d || d.nodeKind !== KIND_SOUND) return
    let changed = false
    if (!d.sound || typeof d.sound !== 'object' || Array.isArray(d.sound)) { d.sound = sanitizeSound({ ...defaultSound(), enabled: true }); changed = true }
    if (!d.soundParticles || typeof d.soundParticles !== 'object' || Array.isArray(d.soundParticles)) { d.soundParticles = sanitizeParticles(defaultParticles()); changed = true }
    if (changed) this._persistSoon(d.id)
  }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* no nodes yet */ } }

  _onDeleted (id) {
    clearTimeout(this._persist.get(id)); this._persist.delete(id)
    clearTimeout(this._audition.get(id)); this._audition.delete(id)
    this._undo.delete(id)
  }

  // ── Editing (shared by the panel and the Inspector) ─────────────────────────

  _persistSoon (id) {
    if (!id) return
    clearTimeout(this._persist.get(id))
    this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS))
  }
  /** Save now: the node's data is written to storage (omni:force-save) and the listeners are told (omni:node-updated). */
  flush (id) {
    if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) }
    const d = id ? this.getNodeData(id) : null
    if (!d) return false
    try { window.dispatchEvent(new CustomEvent('omni:force-save', { detail: {} })) } catch (_) { /* no window */ }
    try { window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: d } })) } catch (_) { /* no window */ }
    return true
  }
  flushAll () { for (const id of [...this._persist.keys()]) this.flush(id) }

  _announce (nodeId, scope, reason) {
    try { window.dispatchEvent(new CustomEvent('omni:sound-data-changed', { detail: { nodeId, scope, reason } })) } catch (_) { /* no window */ }
  }

  _pushUndo (id) {
    const d = this.getNodeData(id); if (!d) return
    const st = this._undo.get(id) ?? []
    st.push({ sound: d.sound ? plainClone(d.sound) : null, soundParticles: d.soundParticles ? plainClone(d.soundParticles) : null })
    if (st.length > UNDO_MAX) st.shift()
    this._undo.set(id, st)
  }
  canUndo (id) { return (this._undo.get(id)?.length ?? 0) > 0 }
  undo (id) {
    const d = this.getNodeData(id); const st = this._undo.get(id)
    if (!d || !st?.length) return { ok: false, error: 'Nothing to undo.' }
    const prev = st.pop()
    if (prev.sound) d.sound = sanitizeSound(prev.sound); else delete d.sound
    if (prev.soundParticles) d.soundParticles = sanitizeParticles(prev.soundParticles); else delete d.soundParticles
    this._afterSoundChange(id, 'both', 'undo')
    return { ok: true }
  }

  /** Put the new sound into the node, update a playing voice live, stop it if the sound was switched off, save soon. */
  _afterSoundChange (id, scope, reason) {
    const d = this.getNodeData(id)
    if (d && scope !== 'particles') {
      if (SoundEngine.isPlaying(id)) {
        if (d.sound && d.sound.enabled) SoundEngine.update(id, d.sound)
        else window.dispatchEvent(new CustomEvent('omni:sound-stop-request', { detail: { nodeId: id } }))
      }
    }
    this._announce(id, scope, reason)
    this._persistSoon(id)
  }

  /**
   * Make sure the node carries a sound; `enable` switches it on. Returns the stored data.sound (or null for an unknown node).
   * An ordinary node gets defaultSound() the first time (lazily); nothing else about the node changes.
   */
  ensureSound (id, enable = false) {
    const d = this.getNodeData(id); if (!d) return null
    const had = !!(d.sound && typeof d.sound === 'object')
    if (!had || (enable && !d.sound.enabled)) {
      this._pushUndo(id)
      d.sound = sanitizeSound({ ...(had ? d.sound : defaultSound()), enabled: enable ? true : (had ? d.sound.enabled : false) })
      this._afterSoundChange(id, 'sound', enable ? 'enable' : 'create')
    }
    return d.sound
  }

  setEnabled (id, on) {
    const d = this.getNodeData(id); if (!d) return { ok: false, error: 'No such node.' }
    if (on) { this.ensureSound(id, true); return { ok: true, enabled: true } }
    if (d.sound) { this._pushUndo(id); d.sound = sanitizeSound({ ...d.sound, enabled: false }); this._afterSoundChange(id, 'sound', 'disable') }
    return { ok: true, enabled: false }
  }

  /**
   * Set ONE field (scope 'sound' | 'particles', key from the schema). Returns { ok, value } with the value as stored (clamped / repaired) or { ok:false, error }.
   * Unknown keys (also __proto__) are refused. Particles are created with defaultParticles() on the first edit.
   */
  setField (id, scope, key, value) {
    const d = this.getNodeData(id); if (!d) return { ok: false, error: 'No such node.' }
    const keys = scope === 'particles' ? particleKeys() : soundKeys()
    if (scope !== 'sound' && scope !== 'particles') return { ok: false, error: 'Unknown scope.' }
    if (typeof key !== 'string' || !keys.has(key)) return { ok: false, error: 'Unknown setting.' }
    if (!acceptable(fieldIndex(scope === 'particles' ? PARTICLE_SCHEMA : SOUND_SCHEMA).get(key), value)) return { ok: false, error: 'That is not a valid value for this setting.' }
    if (scope === 'sound') {
      const cur = d.sound && typeof d.sound === 'object' ? d.sound : defaultSound()
      d.sound = sanitizeSound({ ...cur, [key]: value })
      this._afterSoundChange(id, 'sound', 'field')
      return { ok: true, value: d.sound[key] }
    }
    const cur = d.soundParticles && typeof d.soundParticles === 'object' ? d.soundParticles : defaultParticles()
    d.soundParticles = sanitizeParticles({ ...cur, [key]: value })
    this._afterSoundChange(id, 'particles', 'field')
    return { ok: true, value: d.soundParticles[key] }
  }

  /** Replace the whole sound with a preset (SOUND_PRESETS id): defaults + the preset's settings, keeping enabled / label / tags / color / autoStart. */
  applyPreset (id, presetId) {
    const d = this.getNodeData(id); if (!d) return { ok: false, error: 'No such node.' }
    if (typeof presetId !== 'string' || !has(SOUND_PRESETS, presetId)) return { ok: false, error: 'Unknown preset.' }
    this._pushUndo(id)
    const cur = d.sound && typeof d.sound === 'object' ? d.sound : {}
    const base = { ...defaultSound(), ...(SOUND_PRESETS[presetId].settings ?? {}) }
    for (const k of PRESERVE_KEYS) if (has(cur, k)) base[k] = cur[k]
    if (!has(cur, 'enabled')) base.enabled = true
    d.sound = sanitizeSound(base)
    this._afterSoundChange(id, 'sound', 'preset')
    return { ok: true, preset: presetId }
  }

  /** Reset the fields of ONE schema group (or every group with groupId null) to their defaults. */
  resetGroup (id, scope, groupId = null) {
    const d = this.getNodeData(id); if (!d) return { ok: false, error: 'No such node.' }
    const schema = scope === 'particles' ? PARTICLE_SCHEMA : SOUND_SCHEMA
    const group = groupId == null ? null : schema.find(g => g.id === groupId)
    if (groupId != null && !group) return { ok: false, error: 'Unknown section.' }
    this._pushUndo(id)
    const defs = scope === 'particles' ? defaultParticles() : defaultSound()
    const cur = (scope === 'particles' ? d.soundParticles : d.sound) ?? defs
    const next = { ...cur }
    for (const g of group ? [group] : schema) for (const f of g.fields ?? []) {
      if (scope === 'sound' && f.key === 'enabled') continue   // reset never silences the node by itself
      next[f.key] = defs[f.key]
    }
    if (scope === 'particles') d.soundParticles = sanitizeParticles(next); else d.sound = sanitizeSound(next)
    this._afterSoundChange(id, scope, 'reset')
    return { ok: true }
  }

  /** The settings of a node as copyable JSON text. */
  exportJSON (id) {
    const v = this.getView(id); if (!v.exists) return ''
    return JSON.stringify({ omniSound: 1, sound: v.sound ?? sanitizeSound({ ...defaultSound(), enabled: false }), soundParticles: v.particles ?? null }, null, 2)
  }
  /** Paste settings JSON ({ omniSound, sound, soundParticles } or a bare sound object). Everything goes through the models; returns { ok, error? }. */
  importJSON (id, text) {
    const d = this.getNodeData(id); if (!d) return { ok: false, error: 'No such node.' }
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Nothing to paste.' }
    if (text.length > JSON_MAX) return { ok: false, error: 'That text is too long to be sound settings.' }
    let raw
    try { raw = JSON.parse(text) } catch (_) { return { ok: false, error: 'That is not valid JSON.' } }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Expected a JSON object.' }
    const wrapped = has(raw, 'sound') || has(raw, 'soundParticles') || has(raw, 'omniSound')
    const snd = wrapped ? raw.sound : raw
    const par = wrapped ? raw.soundParticles : null
    const goodSnd = hasKnownKey(snd, soundKeys()); const goodPar = hasKnownKey(par, particleKeys())
    if (!goodSnd && !goodPar) return { ok: false, error: 'No sound settings found in that text.' }
    this._pushUndo(id)
    if (goodSnd) {
      const keep = d.sound && typeof d.sound.enabled === 'boolean' ? d.sound.enabled : true
      d.sound = sanitizeSound({ ...defaultSound(), ...snd, enabled: keep })
    }
    if (goodPar) d.soundParticles = sanitizeParticles({ ...defaultParticles(), ...par })
    this._afterSoundChange(id, 'both', 'import')
    return { ok: true }
  }

  // ── Playing (the scene module of the engine does the work; these are the requests it listens to) ──

  play (id) {
    const v = this.getView(id)
    if (!v.exists) return { ok: false, error: 'No such node.' }
    if (!v.enabled) return { ok: false, error: 'This node has no sound switched on.' }
    window.dispatchEvent(new CustomEvent('omni:sound-play-request', { detail: { nodeId: id } }))
    return { ok: true }
  }
  stop (id) {
    clearTimeout(this._audition.get(id)); this._audition.delete(id)
    window.dispatchEvent(new CustomEvent('omni:sound-stop-request', { detail: { nodeId: id } }))
    return { ok: true }
  }
  toggle (id) {
    if (SoundEngine.isPlaying(id)) return this.stop(id)
    return this.play(id)
  }
  /** Play for AUDITION_MS (2 s), then stop. */
  audition (id, ms = AUDITION_MS) {
    const r = this.play(id); if (!r.ok) return r
    clearTimeout(this._audition.get(id))
    this._audition.set(id, setTimeout(() => { this._audition.delete(id); window.dispatchEvent(new CustomEvent('omni:sound-stop-request', { detail: { nodeId: id } })) }, ms))
    return { ok: true, ms }
  }
  isPlaying (id) { return !!SoundEngine.isPlaying(id) }

  // ── Global settings -> engine ───────────────────────────────────────────────

  /** Apply the master volume and the mute (speaker toggle / phone default / missing opt-in) to the engine. */
  applySettingsToEngine () {
    const s = Settings.getSoundSettings()
    const muted = Settings.engineMuted(s)
    this._opts.muted = muted
    SoundEngine.setMasterVolume(s.masterVolume)
    SoundEngine.setMuted(muted)
    return { masterVolume: s.masterVolume, muted }
  }

  /** "Enable sound" was pressed: opt in for this session, unmute, resume the audio. */
  enableSound () {
    Settings.setOptedIn(true)
    Settings.applySettingsEvent({ patch: { muted: false } })
    this.applySettingsToEngine()
    try { SoundEngine.unlock() } catch (_) { /* the browser may still refuse; the prompt stays */ }
    return true
  }

  /** For tests / the dev panel. */
  getStats () { return { meshes: liveSoundMeshes().size, selected: this._selectedId, pendingSaves: this._persist.size, muted: this._opts.muted } }
}

