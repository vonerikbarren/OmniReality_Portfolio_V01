/**
 * systems/OmniExpressionTyping.js (V195) — the Expression typing mode: the computer keyboard becomes a two-handed instrument.
 * Contract: docs/architecture/OMNIEXPRESSION_CONTRACT.md · key table: utils/OmniExpressionKeys.js · options: utils/OmniExpressionTypingSettings.js ·
 * design + the list of key handlers it shields: docs/architecture/OMNIEXPRESSION_INPUT_DESIGN.md.
 *
 *   Cmd/Ctrl+K  toggles the mode (works from inside a text field too; ON also asks the OmniExpression panel to open: `omni:expression-open`).
 *   Esc         leaves it.  Focusing a real text field (a click into a search box) leaves it too, so typing there is never swallowed.
 *
 * While ON a window CAPTURE listener swallows every key (preventDefault + stopImmediatePropagation) except Esc (handled), browser chords (any Cmd/Ctrl
 * combo except K and Enter, F5, F11, F12) and bare Ctrl / Cmd / Alt presses; so WASD, the hand keys, Q (StarLight), ` (terminal) ... never fire.
 * Older window-capture listeners registered BEFORE this one (OmniStarLight, OmniStateStrictAlign, OmniChronos, TerminalSceneInput) check
 * utils/OmniExpressionFlag.js and stand down. Key-ups of keys that went down BEFORE the mode started are let through (so a held movement key is released).
 *
 * Keys -> the input bus (utils/OmniInputBus.js): notes (ref-counted, the duplicated G is one note), Space = sustain, Left Shift + Up/Down = modulation
 * (steps, stays), Right Shift + Up/Down = pitch bend and + Left/Right = bend2 (second axis; both spring back to 0 after release with a short ease),
 * B / N = octave down / up (scope in the settings), Enter = `omni:music-transport-request` {action:'toggle'}, Cmd/Ctrl+Enter = {action:'record'}.
 * Everything is released (InputBus.allOff) when the mode ends, the window loses focus, or the tab is hidden. Key repeats are ignored.
 *
 * Events out: omni:expression-mode {on, source} · omni:expression-open · omni:expression-octave {octL, octR, last} · omni:music-transport-request {action}
 *             · omni:notify-info (name, desc). Events in: omni:expression-typing-set (settings; this module owns that listener) and -changed.
 * Module contract: constructor(context, opts) / init / update / destroy. opts.bus overrides the input bus (tests). No timers run unless a bend is moving.
 */
import * as DefaultBus from '../utils/OmniInputBus.js'
import * as K from '../utils/OmniExpressionKeys.js'
import * as S from '../utils/OmniExpressionTypingSettings.js'
import { setExpressionFlag } from '../utils/OmniExpressionFlag.js'

export const MODE_EVENT = 'omni:expression-mode'
export const OPEN_EVENT = 'omni:expression-open'
export const OCTAVE_EVENT = 'omni:expression-octave'
export const TRANSPORT_REQUEST_EVENT = 'omni:music-transport-request'
const ATTACK_MS = 40          // a bend key pulls the wheel to full travel in this time
const FRAME_MS = 16
const REL_EPS = 0.004

const fire = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* no window */ } }
const note = (name, desc, holdMs = 3000) => fire('omni:notify-info', { name, desc, source: 'Expression typing', holdMs })
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** Is this element a place where the person types text? */
export function isTextTarget (el) {
  try {
    if (!el || !el.tagName) return false
    const t = String(el.tagName).toUpperCase()
    if (t === 'TEXTAREA' || t === 'SELECT') return true
    if (t === 'INPUT') { const ty = String(el.type || 'text').toLowerCase(); return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'image', 'file', 'color'].includes(ty) }
    return !!el.isContentEditable
  } catch (_) { return false }
}

const BARE_PASS = new Set(['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'OSLeft', 'OSRight'])
const FKEY_PASS = new Set(['F5', 'F11', 'F12'])

export default class OmniExpressionTyping {
  constructor (context, opts = {}) {
    this.ctx = context
    this.bus = opts.bus || DefaultBus
    this._inited = false
    this._on = false
    this._busy = false
    this._queue = null
    this._settings = S.getTypingSettings()
    this._map = K.buildKeyMap(this._settings)
    this._keys = K.createKeyState(this._settings)
    this._shiftL = false; this._shiftR = false
    this._down = new Map()           // note code -> { midi, hand }   (released with the pitch it STARTED with)
    this._pressed = new Set()        // every code whose keydown the mode swallowed (their keyup is swallowed too)
    this._sustain = false
    this._mod = 0; this._modTouched = false
    this._bendKeys = { up: false, down: false }; this._bend2Keys = { left: false, right: false }
    this._bend = 0; this._bend2 = 0
    this._timer = null; this._lastT = 0
    this._chordUp = null
    this._h = null
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  init () {
    if (this._inited) return
    this._inited = true
    this._h = {
      down: (e) => this.handleKeyDown(e), up: (e) => this.handleKeyUp(e),
      blur: () => this.releaseAll('blur'), vis: () => { try { if (document.hidden) this.releaseAll('hidden') } catch (_) { /* ignore */ } },
      focus: (e) => { if (this._on && isTextTarget(e?.target)) this.setMode(false, 'text-field') },
      set: (e) => { S.applySettingsEvent(e?.detail) }, changed: () => this._applySettings(),
      toggle: (e) => this.setMode(typeof e?.detail?.on === 'boolean' ? e.detail.on : !this._on, 'event')
    }
    window.addEventListener('keydown', this._h.down, true)
    window.addEventListener('keyup', this._h.up, true)
    window.addEventListener('blur', this._h.blur)
    window.addEventListener('pagehide', this._h.blur)
    document.addEventListener('visibilitychange', this._h.vis)
    document.addEventListener('focusin', this._h.focus, true)
    window.addEventListener(S.SET_EVENT, this._h.set)
    window.addEventListener(S.CHANGED_EVENT, this._h.changed)
    window.addEventListener('omni:expression-toggle', this._h.toggle)
    this._applySettings()
  }
  update () {}
  destroy () {
    if (!this._inited) return
    this._inited = false
    if (this._on) this._leave('destroy', true)
    this._stopAnim()
    const h = this._h
    window.removeEventListener('keydown', h.down, true)
    window.removeEventListener('keyup', h.up, true)
    window.removeEventListener('blur', h.blur)
    window.removeEventListener('pagehide', h.blur)
    document.removeEventListener('visibilitychange', h.vis)
    document.removeEventListener('focusin', h.focus, true)
    window.removeEventListener(S.SET_EVENT, h.set)
    window.removeEventListener(S.CHANGED_EVENT, h.changed)
    window.removeEventListener('omni:expression-toggle', h.toggle)
    this._h = null
    setExpressionFlag(false)
  }

  // ── state ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  get isOn () { return this._on }
  getState () {
    return { on: this._on, octL: this._keys.octL, octR: this._keys.octR, last: this._keys.last, shiftL: this._shiftL, shiftR: this._shiftR, mod: this._mod, bend: this._bend, bend2: this._bend2, sustain: this._sustain, held: [...this._down.keys()], animating: this._timer != null }
  }
  getSettings () { return { ...this._settings } }

  _applySettings () {
    const prev = this._settings
    this._settings = S.getTypingSettings()
    this._map = K.buildKeyMap(this._settings)
    if (prev.baseOctaveL !== this._settings.baseOctaveL || prev.baseOctaveR !== this._settings.baseOctaveR) {
      this._keys = { ...K.createKeyState(this._settings), last: this._keys.last }
      this._announceOctave()
    }
  }
  _announceOctave () { fire(OCTAVE_EVENT, { octL: this._keys.octL, octR: this._keys.octR, last: this._keys.last }) }

  /** Turn the mode on / off. Reentrancy safe: a call made while a change is being announced is applied right after it. Returns the resulting state. */
  setMode (on, source = 'api') {
    on = !!on
    if (this._busy) { this._queue = { on, source }; return this._on }
    if (on === this._on) return this._on
    this._busy = true
    try {
      if (on) this._enter(source); else this._leave(source, false)
    } finally {
      this._busy = false
      const q = this._queue; this._queue = null
      if (q && q.on !== this._on) this.setMode(q.on, q.source)
    }
    return this._on
  }
  toggle (source = 'api') { return this.setMode(!this._on, source) }

  _enter (source) {
    this._on = true
    setExpressionFlag(true)
    this._pressed.clear(); this._down.clear()
    try { const a = document.activeElement; if (isTextTarget(a)) a.blur() } catch (_) { /* ignore */ }
    fire(MODE_EVENT, { on: true, source })
    fire(OPEN_EVENT, {})
    this._announceOctave()
    note('Expression typing ON', 'Your keys are now an instrument: A S D F G and J K L ; are the white keys, Space is sustain, B / N change the octave. Press Esc to leave.', 4500)
  }
  _leave (source, silent) {
    this._on = false
    this.releaseAll('mode-off')
    setExpressionFlag(false)
    this._pressed.clear()
    this._shiftL = false; this._shiftR = false
    fire(MODE_EVENT, { on: false, source })
    if (!silent) note('Expression typing OFF', source === 'text-field' ? 'You clicked into a text field, so the keys type again.' : 'The keys are back to normal (WASD moves, Q opens search).', 2500)
  }

  /** Release every note, the pedal and the wheels (also on blur / hidden tab / mode off). Safe any time. */
  releaseAll (reason = 'manual') {
    void reason
    const had = this._down.size > 0 || this._sustain
    this._down.clear()
    this._sustain = false
    this._bendKeys.up = this._bendKeys.down = false; this._bend2Keys.left = this._bend2Keys.right = false
    this._stopAnim()
    try { this.bus.allOff() } catch (_) { /* bus never throws, but be safe */ }
    if (this._bend !== 0) { this._bend = 0; this._ctl('bend', 0) }
    if (this._bend2 !== 0) { this._bend2 = 0; this._ctl('bend2', 0) }
    if (!this._on && this._modTouched) { this._mod = 0; this._modTouched = false; this._ctl('mod', 0) }
    this._shiftL = false; this._shiftR = false; this._pressed.clear()   // key-ups missed while the window was away must not leave a Shift or a key 'held'
    return had
  }
  _ctl (kind, v) { try { this.bus.controller(kind, v) } catch (_) { /* ignore */ } }

  // ── keyboard ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  _swallow (e) { try { e.preventDefault() } catch (_) { /* ignore */ } try { e.stopImmediatePropagation() } catch (_) { /* ignore */ } }

  /** One keydown (capture phase). Public for tests. */
  handleKeyDown (e) {
    try { this._keyDown(e) } catch (err) { try { console.warn('OmniExpressionTyping keydown', err) } catch (_) { /* ignore */ } }
  }
  _keyDown (e) {
    if (!e || typeof e.code !== 'string') return
    const cmd = !!(e.metaKey || e.ctrlKey)
    // Cmd/Ctrl+K: the toggle (from anywhere, also from a text field)
    if (cmd && !e.shiftKey && !e.altKey && (e.code === 'KeyK' || e.key === 'k' || e.key === 'K')) {
      this._swallow(e)
      if (!e.repeat) { this._chordUp = 'KeyK'; this.toggle('keys') }
      return
    }
    if (!this._on) return
    if (e.code === 'Escape') { this._swallow(e); if (!e.repeat) this.setMode(false, 'escape'); return }
    // browser chords and bare modifiers pass through untouched
    if (cmd && e.code !== 'Enter' && e.code !== 'NumpadEnter') return
    if (FKEY_PASS.has(e.code) || BARE_PASS.has(e.code)) return
    this._swallow(e)
    if (e.repeat) return
    const code = e.code
    if (code === 'NumpadEnter') { this._act({ type: cmd ? 'record' : 'transport' }, code); return }
    if (code === 'ShiftLeft') { this._shiftL = true; this._pressed.add(code); return }
    if (code === 'ShiftRight') { this._shiftR = true; this._pressed.add(code); return }
    this._pressed.add(code)
    const act = K.resolveKey(code, { shiftL: this._shiftL, shiftR: this._shiftR, meta: !!e.metaKey, ctrl: !!e.ctrlKey }, this._keys, this._map)
    if (act) this._act(act, code)
  }

  _act (a, code) {
    const st = this._settings
    switch (a.type) {
      case 'note': {
        if (this._down.has(code)) return
        this._down.set(code, { midi: a.midi, hand: a.hand })
        this._keys.last = a.hand
        try { this.bus.noteOn({ midi: a.midi, velocity: 0.8, hand: a.hand, source: 'keys', keyId: code }) } catch (_) { /* ignore */ }
        break
      }
      case 'sustain': this._sustain = true; try { this.bus.setSustain(true) } catch (_) { /* ignore */ } break
      case 'octave': {
        if (!st.octaveKeys) break
        this._keys = K.shiftOctave(this._keys, a.delta, st.octaveScope)
        this._announceOctave()
        break
      }
      case 'mod': {
        this._mod = Math.round(clamp(this._mod + (a.dir === 'up' ? 1 : -1) * st.modStep, 0, 1) * 1000) / 1000
        this._modTouched = true
        this._ctl('mod', this._mod)
        break
      }
      case 'bend': this._bendKeys[a.dir] = true; this._startAnim(); break
      case 'bend2': this._bend2Keys[a.dir] = true; this._startAnim(); break
      case 'transport': fire(TRANSPORT_REQUEST_EVENT, { action: 'toggle' }); break
      case 'record': fire(TRANSPORT_REQUEST_EVENT, { action: 'record' }); break
      default: break
    }
  }

  /** One keyup (capture phase). Public for tests. */
  handleKeyUp (e) {
    try { this._keyUp(e) } catch (err) { try { console.warn('OmniExpressionTyping keyup', err) } catch (_) { /* ignore */ } }
  }
  _keyUp (e) {
    if (!e || typeof e.code !== 'string') return
    const code = e.code
    if (this._chordUp === code) { this._chordUp = null; this._swallow(e); return }
    if (!this._on) return
    if (!this._pressed.has(code)) return        // went down before the mode: let it through (releases a held movement key)
    this._swallow(e)
    this._pressed.delete(code)
    const held = this._down.get(code)
    if (held) {
      this._down.delete(code)
      try { this.bus.noteOff({ midi: held.midi, hand: held.hand, source: 'keys', keyId: code }) } catch (_) { /* ignore */ }
      return
    }
    switch (code) {
      case 'Space': this._sustain = false; try { this.bus.setSustain(false) } catch (_) { /* ignore */ } break
      case 'ShiftLeft': this._shiftL = false; break
      case 'ShiftRight': this._shiftR = false; this._bendKeys.up = this._bendKeys.down = false; this._bend2Keys.left = this._bend2Keys.right = false; this._startAnim(); break
      case 'ArrowUp': this._bendKeys.up = false; this._startAnim(); break
      case 'ArrowDown': this._bendKeys.down = false; this._startAnim(); break
      case 'ArrowLeft': this._bend2Keys.left = false; this._startAnim(); break
      case 'ArrowRight': this._bend2Keys.right = false; this._startAnim(); break
      default: break
    }
  }

  // ── wheels: pull to full travel fast, spring back with a short ease ─────────────────────────────────────────────────────
  _targets () { return { bend: (this._bendKeys.up ? 1 : 0) - (this._bendKeys.down ? 1 : 0), bend2: (this._bend2Keys.right ? 1 : 0) - (this._bend2Keys.left ? 1 : 0) } }
  _startAnim () {
    if (this._timer != null) return
    const t = this._targets()
    if (this._bend === t.bend && this._bend2 === t.bend2) return
    this._lastT = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    this._timer = setTimeout(() => this._frame(), FRAME_MS)
    this._timer.unref?.()
  }
  _stopAnim () { if (this._timer != null) { clearTimeout(this._timer); this._timer = null } }
  _frame () {
    this._timer = null
    const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const dt = Math.min(100, Math.max(0, t - this._lastT)); this._lastT = t
    if (!this.step(dt)) { this._timer = setTimeout(() => this._frame(), FRAME_MS); this._timer.unref?.() }
  }
  /** Advance the wheels by dt ms. Returns true when both rest at their target (no more frames needed). Public so tests can drive it without timers. */
  step (dt) {
    const tg = this._targets(); const spring = Math.max(0, this._settings.springMs)
    const move = (cur, target) => {
      if (cur === target) return cur
      if (target !== 0) { const d = dt / ATTACK_MS; return cur < target ? Math.min(target, cur + d) : Math.max(target, cur - d) }
      if (spring <= 0) return 0
      const next = cur * Math.exp(-dt / (spring / 4))
      return Math.abs(next) < REL_EPS ? 0 : next
    }
    const b = move(this._bend, tg.bend); const b2 = move(this._bend2, tg.bend2)
    if (b !== this._bend) { this._bend = b; this._ctl('bend', b) }
    if (b2 !== this._bend2) { this._bend2 = b2; this._ctl('bend2', b2) }
    return this._bend === tg.bend && this._bend2 === tg.bend2
  }
}
