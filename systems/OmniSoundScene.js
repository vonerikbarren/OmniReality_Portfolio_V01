/**
 * systems/OmniSoundScene.js — the scene side of the SoundNode (V194): module { init, update(delta), destroy, onResize }.
 *
 * Each frame: the audio LISTENER follows the camera (position + orientation), positional voices follow their node meshes (the engine does the
 * distance attenuation with a PannerNode), auto-start rules run ('manual' | 'scene-load' | 'proximity' | 'click', plus triggerEvent / triggerStop),
 * the OmniMixer <audio> channels are bridged to the engine analyser once audio is unlocked, and voices of deleted / disabled nodes are stopped.
 * The iteration / loop / crescendo scheduling lives INSIDE the engine (lookahead scheduler), this module only starts and stops voices.
 *
 * Events in:  omni:sound-play-request {nodeId, sound?}  omni:sound-stop-request {nodeId}  omni:sound-toggle-request {nodeId, sound?}
 *             omni:node-deleted {id}  omni:node-selected {node}  omni:node-deselected  omni:scene-clear-request  omni:sound-settings-set
 * Global settings come from utils/OmniSoundSettings.js (agent 2's module): imported dynamically and defensively; when it is missing or throws the
 * defaults master 0.8 / voice cap 8 / not muted apply.
 */
import * as THREE from 'three'
import SoundEngine from './OmniSoundEngine.js'
import { sanitizeSound } from '../utils/OmniSoundModel.js'

const SYNC_INTERVAL = 0.25
const DEFAULTS = { masterVolume: 0.8, voiceCap: 8, muteOnPhones: false, muted: false, requireOptIn: false }
let CURRENT = null

/** ids of the nodes whose data.sound.enabled (works without a scene instance: returns []). */
export function getSoundNodes () { return CURRENT ? CURRENT.getSoundNodes() : [] }
/** true while an OmniSoundScene module is initialised (diagnostics / tests). */
export function isSoundSceneActive () { return !!CURRENT }

const pick = (o, names, d) => { for (const n of names) if (o && o[n] != null) return o[n]; return d }
export function normalizeSettings (raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const vol = Number(pick(r, ['masterVolume', 'master', 'volume'], DEFAULTS.masterVolume))
  const cap = Number(pick(r, ['voiceCap', 'maxVoices', 'voices'], DEFAULTS.voiceCap))
  return {
    masterVolume: Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : DEFAULTS.masterVolume,
    voiceCap: Number.isFinite(cap) ? Math.min(32, Math.max(1, Math.round(cap))) : DEFAULTS.voiceCap,
    muteOnPhones: !!pick(r, ['muteOnPhones', 'mutePhones', 'mutePhone'], DEFAULTS.muteOnPhones),
    muted: !!pick(r, ['muted', 'mute'], DEFAULTS.muted),
    requireOptIn: !!pick(r, ['requireOptIn', 'optIn', 'autoplayOptIn', 'requireOptin'], DEFAULTS.requireOptIn)
  }
}
const isPhone = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 700) } catch (_) { return false } }

export default class OmniSoundScene {
  constructor (context, omniNode = null, engine = SoundEngine) {
    this.ctx = context
    this.omniNode = omniNode
    this.engine = engine
    this._inited = 0
    this._bound = []
    this._accum = SYNC_INTERVAL
    this._auto = new Map()      // nodeId -> { sceneLoadDone, inside, lastStart, sig }
    this._selectedId = null
    this._settings = { ...DEFAULTS }
    this._fwd = new THREE.Vector3(); this._up = new THREE.Vector3(); this._pos = new THREE.Vector3(); this._tmp = new THREE.Vector3(); this._q = new THREE.Quaternion()
    this._dead = false
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    CURRENT = this
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:sound-play-request', (d) => this.play(d.nodeId, d.sound))
    on('omni:sound-stop-request', (d) => this.engine.stop(d.nodeId, d.immediate ? { immediate: true } : {}))
    on('omni:sound-toggle-request', (d) => { if (this.engine.isPlaying(d.nodeId)) this.engine.stop(d.nodeId); else this.play(d.nodeId, d.sound) })
    on('omni:node-deleted', (d) => { const id = d.id ?? d.nodeId; if (id != null) { this.engine.stop(id, { immediate: true }); this._auto.delete(String(id)) } })
    on('omni:node-selected', (d) => this._onSelected(d.node))
    on('omni:node-deselected', () => this._onDeselected())
    on('omni:scene-clear-request', () => { this.engine.stopAll({ immediate: true }); this._auto.clear() })
    on('omni:sound-settings-set', () => this._loadSettings())
    on('omni:mixer-audio-ready', () => this._hookMixer())
    this._loadSettings()
    this._hookMixer()
  }

  /** read the Admin settings (dynamic import, defensive) and push them to the engine. */
  async _loadSettings () {
    let raw = null
    try {
      const mod = await import('../utils/OmniSoundSettings.js')
      const fn = mod.getSoundSettings || mod.default?.getSoundSettings || mod.getSettings
      raw = typeof fn === 'function' ? fn() : (mod.default && typeof mod.default === 'object' ? mod.default : null)
    } catch (_) { raw = null }
    if (this._dead) return
    const s = normalizeSettings(raw)
    this._settings = s
    this.engine.configure({ masterVolume: s.masterVolume, voiceCap: s.voiceCap, muted: s.muted || (s.muteOnPhones && isPhone()), requireOptIn: s.requireOptIn })
  }

  getSettings () { return { ...this._settings } }
  _nodes () { try { return this.omniNode?.getAllNodes?.() ?? [] } catch (_) { return [] } }
  _data (id) { try { return this.omniNode?.getNodeData?.(id) ?? null } catch (_) { return null } }
  /** ids of the nodes whose data.sound.enabled. */
  getSoundNodes () { return this._nodes().filter(d => d?.id != null && d.sound && d.sound.enabled).map(d => d.id) }

  _spatialCtx (id) {
    return { getWorldPosition: () => { const m = this.omniNode?.getMeshById?.(id); if (m) { m.getWorldPosition(this._tmp); return this._tmp } const d = this._data(id); const p = d?.position; return p ? { x: p.x ?? p[0] ?? 0, y: p.y ?? p[1] ?? 0, z: p.z ?? p[2] ?? 0 } : { x: 0, y: 0, z: 0 } } }
  }
  /** start a node's sound (sound given -> audition with those settings). Returns false if the node has no sound. */
  play (nodeId, sound = null, manual = true) {
    if (nodeId == null) return false
    const id = String(nodeId)
    const d = this._data(id) ?? this._data(nodeId)
    const src = sound ?? d?.sound
    if (!src) return false
    const a = this._auto.get(id) ?? {}; a.lastStart = performance.now(); a.sig = null; a.manual = manual; this._auto.set(id, a)
    return this.engine.start(id, sanitizeSound(src), this._spatialCtx(nodeId))
  }
  stop (nodeId, opts) { return this.engine.stop(nodeId, opts) }

  _onSelected (node) {
    const id = node?.id; if (id == null) return
    this._selectedId = id
    const s = node.sound ?? this._data(id)?.sound
    if (!s || !s.enabled) return
    if (s.autoStart === 'click') {
      if (this.engine.isPlaying(id) && s.clickToggle) this.engine.stop(id); else if (!this.engine.isPlaying(id)) this._guardedStart(id, s)
    } else if (s.triggerEvent === 'selected') this._guardedStart(id, s)
  }
  _onDeselected () {
    const id = this._selectedId; this._selectedId = null
    if (id == null) return
    const s = this._data(id)?.sound
    if (s && s.triggerStop === 'deselected' && this.engine.isPlaying(id)) this.engine.stop(id)
  }
  _guardedStart (id, s) {
    const a = this._auto.get(String(id)) ?? {}
    const now = performance.now()
    if (s.cooldown > 0 && a.lastStart && now - a.lastStart < s.cooldown * 1000) return false
    this._auto.set(String(id), a)
    return this.play(id, null, false)
  }

  /** once per frame */
  update (delta) {
    if (this._dead) return
    const cam = this.ctx?.camera
    if (cam) {
      cam.getWorldPosition(this._pos); cam.getWorldDirection(this._fwd)
      cam.getWorldQuaternion(this._q); this._up.set(0, 1, 0).applyQuaternion(this._q)
      this.engine.setListener(this._pos, this._fwd, this._up)
    }
    this.engine.updateSpatial(delta || 0.016)
    this._accum += delta || 0
    if (this._accum < SYNC_INTERVAL) return
    this._accum = 0
    this._sync()
  }
  _sync () {
    const eng = this.engine
    const seen = new Set()
    for (const d of this._nodes()) {
      if (!d || d.id == null) continue
      const id = String(d.id); const s = d.sound
      seen.add(id)
      if (!s || typeof s !== 'object') continue
      const playing = eng.isPlaying(id)
      const a = this._auto.get(id) ?? { sceneLoadDone: false, inside: false, lastStart: 0, sig: null }
      a.known = true
      this._auto.set(id, a)
      // an explicit Play / Audition request on a node whose sound is already off keeps playing; automatic starts follow `enabled`
      const was = a.enabled; a.enabled = !!s.enabled
      if (!s.enabled) { if (playing && (!a.manual || was)) eng.stop(id); continue }   // switching sound OFF always stops it
      if (playing) {
        // live changes made by any editor that only mutated node.data.sound
        let sig = null; try { sig = JSON.stringify(s) } catch (_) {}
        if (sig && a.sig && sig !== a.sig) eng.update(id, sanitizeSound(s))
        a.sig = sig
      }
      if (s.autoStart === 'scene-load' && !a.sceneLoadDone) { a.sceneLoadDone = true; if (!playing) this._guardedStart(id, s) }
      else if (s.autoStart === 'proximity' && this.ctx?.camera) {
        const m = this.omniNode?.getMeshById?.(d.id)
        if (m) {
          m.getWorldPosition(this._tmp)
          const dist = this._tmp.distanceTo(this._pos)
          const inside = a.inside ? dist <= s.proximityRadius * 1.1 : dist <= s.proximityRadius
          if (inside && !a.inside && !playing) this._guardedStart(id, s)
          if (!inside && a.inside && s.proximityStop && playing) eng.stop(id)
          a.inside = inside
        }
      }
    }
    // voices of nodes that existed and are gone now (voices of ids that were never nodes, e.g. an audition id, are left alone)
    for (const [id, a] of [...this._auto.entries()]) if (!seen.has(id) && a.known) { this._auto.delete(id); if (eng.isPlaying(id)) eng.stop(id, { immediate: true }) }
    this._bridgeMixer()
  }
  /** OmniMixer bridge: the mixer exposes window.__omniMixerAudio = { 1: <audio>, 2: <audio> } (V194 one-line hook); we tap it once audio is unlocked. */
  _bridgeMixer () {
    const els = typeof window !== 'undefined' ? window.__omniMixerAudio : null
    if (!els || !this.engine.isUnlocked() || this.engine._fake) return
    for (const el of Object.values(els)) if (el && el.src && !el.paused) this.engine.bridgeMediaElement(el, 'mixer')
  }
  /** listen to the mixer channels' play events so the bridge does not depend on the frame rate */
  _hookMixer () {
    const els = typeof window !== 'undefined' ? window.__omniMixerAudio : null
    if (!els) return
    this._hooked = this._hooked || new WeakSet()
    for (const el of Object.values(els)) {
      if (!el || this._hooked.has(el)) continue
      this._hooked.add(el)
      const h = () => this._bridgeMixer()
      el.addEventListener('play', h); el.addEventListener('playing', h)
      this._mixerOff = this._mixerOff || []; this._mixerOff.push(() => { el.removeEventListener('play', h); el.removeEventListener('playing', h) })
    }
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._dead = true
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    ;(this._mixerOff || []).forEach(f => f()); this._mixerOff = []
    this.engine.stopAll({ immediate: true })
    if (CURRENT === this) CURRENT = null
    this._inited = 0
  }
}
export { OmniSoundScene }
