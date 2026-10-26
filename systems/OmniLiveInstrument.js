/**
 * systems/OmniLiveInstrument.js (V195) — plays the input bus: every musical input (computer keys, MIDI, touch keyboards, BeatPad) becomes sound.
 * Contract: docs/architecture/OMNIEXPRESSION_CONTRACT.md · engine API: systems/OmniSoundEngine.js (polyphonic noteOn / noteOff / setPitchBend ...).
 *
 *   bus noteOn / noteOff   -> SoundEngine.noteOn(instrumentNodeId, midi, { velocity, sound }) / noteOff(handle)   (source 'seq' is the sequencer's own echo: ignored,
 *                             the sequencer already plays its notes itself, so nothing sounds twice)
 *   bus 'bend'             -> SoundEngine.setPitchBend(id, bend * bendRange semitones)       (bendRange: setting, default 2)
 *   bus 'mod'              -> SoundEngine.setModulation(id, mod)         'bend2' -> setPan(id, x)         'expression' -> setExpression(id, v) (only once one arrived)
 *   bus 'sustain'          -> handled by the bus itself (it holds the noteOffs); bus allOff -> SoundEngine.allNotesOff
 *
 * The INSTRUMENT is a sound: the `data.sound` of a node. Which node: the selected node that carries a sound (setting followSelection, default on), else the node
 * chosen with setInstrument() / the settings picker (instrumentNodeId), else a soft sine (defaultSound() shaped). The engine id of the notes is that node id
 * (so the node's particles / viewers react to the live notes) or 'live-instrument' for the soft sine. A node's sound edits take effect on the next note.
 *
 * Module contract: constructor(context, omniNode, opts) / init / update / destroy. opts.engine / opts.bus override the singletons (tests).
 */
import SoundEngineDefault from './OmniSoundEngine.js'
import * as DefaultBus from '../utils/OmniInputBus.js'
import { defaultSound, sanitizeSound } from '../utils/OmniSoundModel.js'
import * as S from '../utils/OmniExpressionTypingSettings.js'

export const DEFAULT_ID = 'live-instrument'
export const CHANGED_EVENT = 'omni:live-instrument-changed'
const fire = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* no window */ } }

/** the soft sine used when no node supplies a sound. */
export function softSine () {
  return sanitizeSound({ ...defaultSound(), sourceType: 'oscillator', waveform: 'sine', attack: 0.012, hold: 0, decay: 0.25, sustainLevel: 0.7, release: 0.3, dynamic: 'mf', sustained: true, positional: false })
}

let ACTIVE = null

export default class OmniLiveInstrument {
  constructor (context, omniNode, opts = {}) {
    this.ctx = context
    this.omniNode = omniNode || null
    this.engine = opts.engine || SoundEngineDefault
    this.bus = opts.bus || DefaultBus
    this._inited = false
    this._unsub = null
    this._handles = new Map()      // midi -> { id, handle }
    this._waiting = new Map()      // midi -> true  (pressed while the audio was locked; started once it unlocks if still held)
    this._selectedId = null
    this._manualId = null
    this._settings = S.getTypingSettings()
    this._ctl = { bend: 0, mod: 0, bend2: 0, expression: null }
    this._lastId = undefined
    this._off = []
  }

  static get instance () { return ACTIVE }
  /** Choose the instrument node (null = soft sine). Also stored in the settings (instrumentNodeId) as "the last chosen instrument". */
  static setInstrument (nodeId) { return ACTIVE ? ACTIVE.setInstrument(nodeId) : false }

  init () {
    if (this._inited) return
    this._inited = true
    ACTIVE = this
    this._unsub = this.bus.subscribe((evt) => this._onBus(evt))
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._off.push(() => window.removeEventListener(name, h)) }
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? d.id ?? null; this._maybeChanged() })
    on('omni:node-deselected', () => { this._selectedId = null; this._maybeChanged() })
    on('omni:node-deleted', (d) => { if (d.id && d.id === this._manualId) this._manualId = null; if (d.id && d.id === this._selectedId) this._selectedId = null; this._maybeChanged() })
    on(S.CHANGED_EVENT, () => { this._settings = S.getTypingSettings(); this._maybeChanged() })
    this._settings = S.getTypingSettings()
    this._maybeChanged()
  }
  update () {}
  destroy () {
    if (!this._inited) return
    this._inited = false
    try { this._unsub?.() } catch (_) { /* ignore */ }
    this._unsub = null
    this._off.forEach(f => f()); this._off = []
    this._releaseAll()
    if (ACTIVE === this) ACTIVE = null
  }

  // ── which instrument ─────────────────────────────────────────────────────────────────────────────────────────────────
  _soundOf (id) {
    if (!id) return null
    try { const d = this.omniNode?.getNodeData?.(id); return d && d.sound && typeof d.sound === 'object' ? d.sound : null } catch (_) { return null }
  }
  /** { id, sound, nodeId|null, label }. Never throws. */
  resolve () {
    const st = this._settings
    const cands = []
    if (st.followSelection && this._selectedId) cands.push(this._selectedId)
    if (this._manualId) cands.push(this._manualId)
    if (st.instrumentNodeId) cands.push(st.instrumentNodeId)
    for (const id of cands) { const raw = this._soundOf(id); if (raw) return { id, nodeId: id, sound: sanitizeSound({ ...raw, positional: false }), label: this._label(id) } }
    return { id: DEFAULT_ID, nodeId: null, sound: softSine(), label: 'Soft sine' }
  }
  _label (id) { try { return this.omniNode?.getNodeData?.(id)?.label ?? id } catch (_) { return id } }
  getInstrumentId () { return this.resolve().nodeId }
  setInstrument (nodeId) {
    const id = typeof nodeId === 'string' && nodeId ? nodeId : null
    this._manualId = id
    S.applySettingsEvent({ patch: { instrumentNodeId: id } })   // saved as "the last chosen instrument"; announces omni:expression-typing-changed
    this._settings = S.getTypingSettings()
    this._maybeChanged()
    return true
  }
  _maybeChanged () {
    const r = this.resolve()
    if (r.id === this._lastId) return
    const first = this._lastId === undefined
    this._lastId = r.id
    this._reapplyControllers(r.id)
    if (!first) fire(CHANGED_EVENT, { nodeId: r.nodeId, label: r.label })
  }
  _reapplyControllers (id) {
    const c = this._ctl; const e = this.engine
    try {
      e.setPitchBend(id, c.bend * this._settings.bendRange); e.setModulation(id, c.mod); e.setPan?.(id, c.bend2)
      if (c.expression !== null) e.setExpression?.(id, c.expression)
    } catch (_) { /* ignore */ }
  }

  // ── bus ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  _onBus (evt) {
    try {
      if (!evt) return
      switch (evt.type) {
        case 'noteOn': if (evt.source !== 'seq') this._noteOn(evt); break
        case 'noteOff': if (evt.source !== 'seq') this._noteOff(evt.midi); break
        case 'allOff': this._releaseAll(); break
        case 'controller': this._controller(evt.kind, evt.value); break
        default: break
      }
    } catch (e) { try { console.warn('OmniLiveInstrument', e) } catch (_) { /* ignore */ } }
  }
  _noteOn (evt) {
    const midi = evt.midi
    if (this._handles.has(midi)) this._noteOff(midi)
    const r = this.resolve()
    if (r.id !== this._lastId) { this._lastId = r.id; this._reapplyControllers(r.id) }
    const vel = Number.isFinite(evt.velocity) ? evt.velocity : 0.8
    const h = this.engine.noteOn(r.id, midi, { velocity: vel, sound: r.sound })
    if (h) { this._handles.set(midi, { id: r.id, handle: h }); return }
    // audio still locked: this key press is a user gesture, unlock and start the note if the key is still down
    if (this.engine.isUnlocked?.() === false) {
      this._waiting.set(midi, true)
      Promise.resolve(this.engine.unlock?.()).then(() => {
        if (!this._waiting.get(midi)) return
        this._waiting.delete(midi)
        const h2 = this.engine.noteOn(r.id, midi, { velocity: vel, sound: r.sound })
        if (h2) this._handles.set(midi, { id: r.id, handle: h2 })
      }).catch(() => { this._waiting.delete(midi) })
    }
  }
  _noteOff (midi) {
    this._waiting.delete(midi)
    const e = this._handles.get(midi); if (!e) return
    this._handles.delete(midi)
    try { this.engine.noteOff(e.handle) } catch (_) { /* ignore */ }
  }
  _releaseAll () {
    this._waiting.clear()
    const ids = new Set([...this._handles.values()].map(x => x.id))
    this._handles.clear()
    for (const id of ids) { try { this.engine.allNotesOff(id) } catch (_) { /* ignore */ } }
  }
  _controller (kind, v) {
    const id = this.resolve().id; const e = this.engine; const c = this._ctl
    if (kind === 'bend') { c.bend = v; e.setPitchBend(id, v * this._settings.bendRange) }
    else if (kind === 'mod') { c.mod = v; e.setModulation(id, v) }
    else if (kind === 'bend2') { c.bend2 = v; e.setPan?.(id, v) }
    else if (kind === 'expression') { c.expression = v; e.setExpression?.(id, v) }
    // 'sustain' is held by the bus
  }
  getState () { return { held: [...this._handles.keys()], instrument: this.resolve().nodeId, controllers: { ...this._ctl } } }
}
