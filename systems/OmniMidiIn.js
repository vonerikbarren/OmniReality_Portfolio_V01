/**
 * systems/OmniMidiIn.js (V195) — Web MIDI input -> the input bus (utils/OmniInputBus.js). Contract: docs/architecture/OMNIEXPRESSION_CONTRACT.md.
 *
 *   Needs navigator.requestMIDIAccess (Chrome, Edge, Opera, Android Chrome; Firefox asks for a site permission add-on; Safari and iOS have NO Web MIDI: a clear
 *   message is shown instead). Called with { sysex:false } and ONLY when the person turns MIDI on in the Expression settings (omni:expression-typing-set
 *   { patch:{ midiEnabled:true } }) - not at startup. If MIDI was already on at startup it connects silently only when the browser already granted the permission
 *   (otherwise `omni:midi-state` carries error.code 'needs-permission' and the settings show a Connect button = omni:midi-connect-request).
 *
 *   - devices: listed (omni:midi-state), hot-plug via access.onstatechange, a per-device switch (settings midiDevices, default ON), a channel filter
 *     (settings midiChannel: all | 1..16) and channel -> hand (settings midiHands: default ch1 = L, ch2 = R, others X; the keyboards highlight the hand).
 *   - messages: note on / off (velocity 0 = off), pitch bend (14 bit, -1..1), CC1 modulation, CC64 sustain, CC11 expression, CC120/123 all notes off. Program change
 *     and everything else is ignored. Nothing here ever throws on hostile data.
 *   - notes are ref-counted per (device, channel, note) so two devices playing the same pitch do not cut each other; disabling / unplugging a device releases its notes.
 *
 * Event out: omni:midi-state { supported, enabled, devices:[{id,name,enabled,connected}], error?:{code,message} }. Module contract: init / update / destroy.
 * opts.nav / opts.bus override navigator and the bus (tests: a fake MIDIAccess).
 */
import * as DefaultBus from '../utils/OmniInputBus.js'
import * as S from '../utils/OmniExpressionTypingSettings.js'

export const STATE_EVENT = 'omni:midi-state'
export const CONNECT_EVENT = 'omni:midi-connect-request'
export const MSG_UNSUPPORTED = 'This browser has no Web MIDI, so a MIDI keyboard cannot connect here (Safari and iOS do not support it). Use Chrome, Edge or Opera on a computer or Android, or play with the computer keys or the on-screen keyboards.'
export const MSG_DENIED = 'MIDI access was blocked. Allow MIDI for this site in the browser\'s site settings, then switch MIDI off and on again here.'
export const MSG_NEEDS = 'MIDI is on in the settings, but the browser has not been allowed to use it yet. Press Connect MIDI to ask.'

const fire = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* no window */ } }

/**
 * Pure: bytes -> { type, channel(1..16), ... } or null.
 *   note-on {midi,velocity(0..1)} | note-off {midi} | cc {cc,value(0..127)} | bend {value(-1..1)} | program (ignored by callers)
 */
export function parseMidiMessage (data) {
  try {
    if (!data || typeof data.length !== 'number' || data.length < 1) return null
    const st = data[0] | 0
    if (st < 0x80 || st >= 0xF0) return null
    const kind = st & 0xF0; const channel = (st & 0x0F) + 1
    const d1 = (data[1] | 0) & 0x7F; const d2 = (data[2] | 0) & 0x7F
    if (kind === 0x90) { if (data.length < 3) return null; return d2 === 0 ? { type: 'note-off', channel, midi: d1 } : { type: 'note-on', channel, midi: d1, velocity: d2 / 127 } }
    if (kind === 0x80) { if (data.length < 3) return null; return { type: 'note-off', channel, midi: d1 } }
    if (kind === 0xB0) { if (data.length < 3) return null; return { type: 'cc', channel, cc: d1, value: d2 } }
    if (kind === 0xE0) { if (data.length < 3) return null; const v = d1 | (d2 << 7); return { type: 'bend', channel, value: Math.max(-1, Math.min(1, (v - 8192) / 8192)) } }
    if (kind === 0xC0) return { type: 'program', channel, program: d1 }
    return null
  } catch (_) { return null }
}

const errName = (e) => String(e?.name || e?.code || '')

export default class OmniMidiIn {
  constructor (context, opts = {}) {
    this.ctx = context
    this.nav = opts.nav || (typeof navigator !== 'undefined' ? navigator : null)
    this.bus = opts.bus || DefaultBus
    this._inited = false
    this._access = null
    this._wantOn = false
    this._connecting = null
    this._devices = new Map()        // id -> { id, name, input, connected, idx }
    this._held = new Map()           // keyId -> { midi, hand }
    this._error = null
    this._settings = S.getTypingSettings()
    this._seq = 0
    this._off = []
  }

  get supported () { return !!(this.nav && typeof this.nav.requestMIDIAccess === 'function') }

  init () {
    if (this._inited) return
    this._inited = true
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(name, h); this._off.push(() => window.removeEventListener(name, h)) }
    on(S.CHANGED_EVENT, () => this._onSettings())
    on(CONNECT_EVENT, () => { if (this._settings.midiEnabled) this.enable() })
    this._settings = S.getTypingSettings()
    if (this._settings.midiEnabled) this._startup()
    else this._emit()
  }
  update () {}
  destroy () {
    if (!this._inited) return
    this._inited = false
    this._off.forEach(f => f()); this._off = []
    this._wantOn = false
    this._detachAll(true)
    try { if (this._access) this._access.onstatechange = null } catch (_) { /* ignore */ }
    this._access = null
  }

  async _startup () {
    // never prompt at startup: connect only if the browser already granted it
    if (!this.supported) { this._error = { code: 'unsupported', message: MSG_UNSUPPORTED }; this._emit(); return }
    let granted = false
    try { const p = await this.nav.permissions?.query?.({ name: 'midi' }); granted = p?.state === 'granted' } catch (_) { granted = false }
    if (!this._inited || !this._settings.midiEnabled) return
    if (granted) this.enable(); else { this._error = { code: 'needs-permission', message: MSG_NEEDS }; this._emit() }
  }

  _onSettings () {
    const prev = this._settings
    this._settings = S.getTypingSettings()
    const s = this._settings
    if (s.midiEnabled && !prev.midiEnabled) this.enable()               // the person just switched it on: asking now is allowed
    else if (!s.midiEnabled && prev.midiEnabled) this.disable()
    else if (s.midiEnabled) { this._rewire(); this._emit() }
  }

  /** Ask the browser for MIDI and start listening. Resolves to true when connected. Never throws. */
  async enable () {
    this._wantOn = true
    if (!this.supported) { this._error = { code: 'unsupported', message: MSG_UNSUPPORTED }; this._emit(); return false }
    if (this._access) { this._error = null; this._rewire(); this._emit(); return true }
    if (this._connecting) return this._connecting
    this._connecting = (async () => {
      try {
        const access = await this.nav.requestMIDIAccess({ sysex: false })
        if (!this._wantOn || !this._inited) return false    // switched off while the prompt was open
        this._access = access
        this._error = null
        try { access.onstatechange = () => { this._rewire(); this._emit() } } catch (_) { /* ignore */ }
        this._rewire()
        this._emit()
        return true
      } catch (e) {
        const n = errName(e)
        this._error = (n === 'SecurityError' || n === 'NotAllowedError' || n === 'PermissionDeniedError') ? { code: 'denied', message: MSG_DENIED } : { code: 'failed', message: 'MIDI could not start: ' + String(e?.message || n || 'unknown error').slice(0, 160) }
        this._emit()
        return false
      } finally { this._connecting = null }
    })()
    return this._connecting
  }
  disable () {
    this._wantOn = false
    this._detachAll(true)
    this._error = null
    this._emit()
  }

  // ── devices ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  _inputs () {
    const out = []
    try { const ins = this._access?.inputs; if (ins && typeof ins.forEach === 'function') ins.forEach((inp) => { if (inp && inp.id != null) out.push(inp) }) } catch (_) { /* ignore */ }
    return out
  }
  _deviceOn (id) { const v = this._settings.midiDevices?.[id]; return v !== false }
  /** sync the device list with the access, and attach / detach the message handlers per device switch. */
  _rewire () {
    if (!this._access) return
    const seen = new Set()
    for (const inp of this._inputs()) {
      const id = String(inp.id).slice(0, 120); seen.add(id)
      let d = this._devices.get(id)
      if (!d) { d = { id, name: String(inp.name || 'MIDI device').slice(0, 80), input: inp, connected: true, idx: ++this._seq }; this._devices.set(id, d) }
      d.input = inp; d.name = String(inp.name || d.name).slice(0, 80)
      d.connected = inp.state !== 'disconnected'
      const want = d.connected && this._deviceOn(id) && this._wantOn
      if (want && !d.bound) { try { inp.onmidimessage = (m) => this._onMessage(d, m) } catch (_) { /* ignore */ } d.bound = true }
      if (!want && d.bound) { try { inp.onmidimessage = null } catch (_) { /* ignore */ } d.bound = false; this._releaseDevice(d) }
      if (!d.connected) this._releaseDevice(d)
    }
    for (const [id, d] of this._devices) if (!seen.has(id)) { d.connected = false; if (d.bound) { try { d.input.onmidimessage = null } catch (_) { /* ignore */ } d.bound = false } this._releaseDevice(d) }
  }
  _detachAll (release) {
    for (const d of this._devices.values()) { if (d.bound) { try { d.input.onmidimessage = null } catch (_) { /* ignore */ } d.bound = false } }
    if (release) { this._releaseAll() }
    this._devices.forEach(d => { d.connected = d.connected && !!this._access })
  }
  _releaseDevice (d) {
    const pre = `m${d.idx}:`
    for (const [keyId, h] of [...this._held]) if (keyId.startsWith(pre)) { this._held.delete(keyId); try { this.bus.noteOff({ midi: h.midi, hand: h.hand, source: 'midi', keyId }) } catch (_) { /* ignore */ } }
  }
  _releaseAll () { for (const d of this._devices.values()) this._releaseDevice(d) }

  getState () {
    const devices = [...this._devices.values()].filter(d => d.connected).map(d => ({ id: d.id, name: d.name, enabled: this._deviceOn(d.id), connected: true }))
    const st = { supported: this.supported, enabled: this._wantOn && !!this._access, devices }
    if (this._error) st.error = { ...this._error }
    return st
  }
  _emit () { fire(STATE_EVENT, this.getState()) }

  // ── messages ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  _onMessage (d, m) {
    try {
      const msg = parseMidiMessage(m?.data)
      if (!msg || msg.type === 'program') return
      const s = this._settings
      if (s.midiChannel !== 'all' && msg.channel !== s.midiChannel) return
      const hand = S.handForChannel(s, msg.channel)
      const keyId = `m${d.idx}:${msg.channel}:${msg.midi}`
      switch (msg.type) {
        case 'note-on':
          this._held.set(keyId, { midi: msg.midi, hand })
          this.bus.noteOn({ midi: msg.midi, velocity: msg.velocity, hand, source: 'midi', keyId, channel: msg.channel })
          break
        case 'note-off':
          if (this._held.delete(keyId)) this.bus.noteOff({ midi: msg.midi, hand, source: 'midi', keyId })
          break
        case 'bend': this.bus.controller('bend', msg.value); break
        case 'cc':
          if (msg.cc === 1) this.bus.controller('mod', msg.value / 127)
          else if (msg.cc === 64) this.bus.controller('sustain', msg.value >= 64 ? 1 : 0)
          else if (msg.cc === 11) this.bus.controller('expression', msg.value / 127)
          else if (msg.cc === 120 || msg.cc === 123) { this._releaseDevice(d) }
          break
        default: break
      }
    } catch (_) { /* hostile data never breaks input */ }
  }
}
