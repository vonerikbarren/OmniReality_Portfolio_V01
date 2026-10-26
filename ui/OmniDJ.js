/**
 * ui/OmniDJ.js (V195) — the OmniDJ: 6 jog-wheel CIRCLES + 6 channel strips + crossfader + master, on a grid you can rearrange.
 *
 * Components (each a small class with mount / destroy / setValue, see ui/OmniDJControls.js), placed on the OmniGridLayout:
 *   dj-circle-1..6   the six big rotating circles (jog wheels), top row by default; later they may become faces of a cube in the 3D space
 *   dj-eq-N          LOW / MID / HIGH knobs of channel N          dj-btn-N   play, cue, mute, loop, crossfader assign A / T / B
 *   dj-deck-N        load button + title + pitch fader           dj-vol-N   volume fader with level meter
 *   dj-master        master volume knob                          dj-xfade   crossfader + curve        dj-status  audio state, Enable audio, Stop all
 * Audio: systems/OmniDJDecks.js (shared singleton: the quadrant content and the OmniDJ window show the same decks).
 * Entry points: createOmniDJ(host, opts) -> instance; mountDJ(host, ctx) -> { destroy, onResize } (the OmniQuadrantRegistry content 'dj');
 * ui/OmniDJPanel.js opens the same thing as a class-A window. Destroying the UI does NOT stop the music (a track keeps playing like in the
 * OmniMusicPlayer); "Stop all" does, and OmniDJDecks.destroy() frees everything.
 */

import OmniGridLayout, { createClickFeel, tip as _tip } from './OmniGridLayout.js'
import { DJKnob, DJFader, DJButton, DJCircle, esc, injectControlStyles } from './OmniDJControls.js'
import { getDJDecks } from '../systems/OmniDJDecks.js'
import { DECKS, eqDb, fmtDb, fmtPitch, fmtTime, CURVES, ASSIGNS, EQ_BANDS, RATE_RANGES, LIBRARY_SLOTS } from '../utils/OmniDJModel.js'

export { DJKnob, DJFader, DJButton, DJCircle }
export const CIRCLE_IDS = Object.freeze(Array.from({ length: DECKS }, (_, i) => `dj-circle-${i + 1}`))
const FRAME_MS = 33

const EXTRA_CSS = `
.dj-root { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; background: transparent; }
.dj-row { display: flex; gap: 2px; flex: 1 1 0; min-height: 0; min-width: 0; align-items: stretch; }
.dj-col { display: flex; flex-direction: column; gap: 2px; width: 100%; height: 100%; padding: 2px; min-height: 0; min-width: 0; }
.dj-knobs { display: flex; gap: 2px; width: 100%; height: 100%; padding: 2px; min-height: 0; }
.dj-title { flex: 2 1 0; min-width: 0; align-self: center; font-size: clamp(8px, 11cqmin, 12px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .9; }
.dj-title.is-empty { opacity: .45; }
.dj-title.is-err { color: #ff8f8f; opacity: 1; }
.dj-pitchtxt { flex: 0 0 auto; align-self: center; font-size: clamp(7px, 10cqmin, 11px); min-width: 4.2em; text-align: right; font-variant-numeric: tabular-nums; opacity: .8; }
.dj-xf { display: flex; flex-direction: column; gap: 3px; width: 100%; height: 100%; padding: 3px 6px; }
.dj-xf .dj-line { display: flex; align-items: center; gap: 6px; flex: 1 1 0; min-height: 0; }
.dj-xf .dj-ab { font-size: clamp(9px, 14cqmin, 16px); font-weight: bold; opacity: .8; }
.dj-status { display: flex; flex-direction: column; gap: 3px; width: 100%; height: 100%; padding: 3px 5px; font-size: clamp(8px, 10cqmin, 11px); }
.dj-status .dj-st-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .85; }
.dj-status .dj-row { flex: 0 0 auto; min-height: 22px; }
.dj-pop { position: fixed; z-index: 100000; width: 250px; max-height: 60vh; overflow: auto; padding: 6px; border-radius: 8px; background: rgba(10,14,22,.97); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.25)); box-shadow: 0 8px 30px rgba(0,0,0,.6); color: #e8f4ff; font-family: 'Courier New', Courier, monospace; font-size: 12px; }
.dj-pop h4 { margin: 0 0 4px; font-size: 11px; opacity: .7; font-weight: normal; letter-spacing: .06em; }
.dj-pop button.dj-slot { display: flex; width: 100%; gap: 6px; align-items: center; text-align: left; font: inherit; color: inherit; background: rgba(255,255,255,.05); border: 1px solid transparent; border-radius: 4px; padding: 4px 6px; margin: 2px 0; cursor: pointer; min-height: 26px; }
.dj-pop button.dj-slot:hover, .dj-pop button.dj-slot:focus-visible { border-color: var(--omni-theme-accent, #5ce8c4); outline: none; }
.dj-pop button.dj-slot[disabled] { opacity: .35; cursor: default; }
.dj-pop .dj-n { width: 1.6em; opacity: .6; }
.dj-pop .dj-note { opacity: .6; font-size: 11px; margin: 4px 0; line-height: 1.35; }
`
let extraIn = false
function injectExtra () {
  if (extraIn || typeof document === 'undefined') return
  injectControlStyles()
  if (!document.getElementById('omni-dj-styles')) { const s = document.createElement('style'); s.id = 'omni-dj-styles'; s.textContent = EXTRA_CSS; (document.head || document.documentElement).appendChild(s) }
  extraIn = true
}
const div = (cls, parent) => { const d = document.createElement('div'); if (cls) d.className = cls; if (parent) parent.appendChild(d); return d }
const txt = (cls, parent, t = '') => { const d = div(cls, parent); d.textContent = t; return d }
const pct = (v) => Math.round(v * 100) + '%'

/** The default positions on the 24 x 14 grid (the six circles in the top row). */
export function defaultComponentSpecs () {
  const L = []
  for (let i = 1; i <= DECKS; i++) {
    const x = (i - 1) * 4
    L.push({ id: `dj-circle-${i}`, title: `Circle ${i}`, x, y: 0, w: 4, h: 4, minW: 2, minH: 2 })
    L.push({ id: `dj-eq-${i}`, title: `EQ ${i}`, x, y: 4, w: 3, h: 3, minW: 2, minH: 2 })
    L.push({ id: `dj-btn-${i}`, title: `Buttons ${i}`, x, y: 7, w: 3, h: 2, minW: 2, minH: 2 })
    L.push({ id: `dj-deck-${i}`, title: `Track ${i}`, x, y: 9, w: 3, h: 2, minW: 2, minH: 1 })
    L.push({ id: `dj-vol-${i}`, title: `Volume ${i}`, x: x + 3, y: 4, w: 1, h: 7, minW: 1, minH: 2 })
  }
  L.push({ id: 'dj-master', title: 'Master', x: 2, y: 11, w: 3, h: 3, minW: 2, minH: 2 })
  L.push({ id: 'dj-xfade', title: 'Crossfader', x: 6, y: 11, w: 12, h: 3, minW: 4, minH: 2 })
  L.push({ id: 'dj-status', title: 'Audio', x: 18, y: 11, w: 6, h: 3, minW: 3, minH: 2 })
  return L
}

export class OmniDJ {
  /** opts: { decks, storageKey, store } */
  constructor (host, opts = {}) {
    injectExtra()
    this.host = host; this.opts = opts
    this.decks = opts.decks || getDJDecks()
    this.circles = {}; this.eq = {}; this.vol = {}; this.pitch = {}; this.btn = {}; this.deckEls = {}
    this.master = null; this.xfade = null; this.status = null; this.curveBtn = null
    this._refs = []   // refresh(deckN) callbacks
    this._pop = null; this._popOff = null
    this._raf = 0; this._last = 0; this._alive = true; this._levels = new Array(DECKS + 1).fill(0)
    this.feel = createClickFeel({ getContext: () => this.decks.context })
    host.classList.add('dj')
    this._unsub = this.decks.on((d) => this._onState(d))
    this._gestureFn = () => { if (!this._alive) return; this.decks.unlock().then(() => this._refreshStatus()).catch(() => {}) }
    host.addEventListener('pointerdown', this._gestureFn, { capture: true, passive: true })
    host.addEventListener('keydown', this._gestureFn, { capture: true, passive: true })
    this.layout = new OmniGridLayout({
      components: this._components(), feel: this.feel, storageKey: opts.storageKey, minWidth: 640, minHeight: 300,
      toolbar: (bar) => this._toolbar(bar),
    })
    this.layout.mount(host)
    this.refreshAll()
    this._start()
  }

  _components () {
    const mk = (spec, create) => ({ ...spec, create })
    const out = []
    for (const s of defaultComponentSpecs()) {
      const m = /^dj-(circle|eq|btn|deck|vol)-(\d)$/.exec(s.id)
      if (m) { const n = Number(m[2]); const fn = { circle: this._circle, eq: this._eq, btn: this._btns, deck: this._deck, vol: this._vol }[m[1]]; out.push(mk(s, (slot) => fn.call(this, slot, n))) } else if (s.id === 'dj-master') out.push(mk(s, (slot) => this._master(slot)))
      else if (s.id === 'dj-xfade') out.push(mk(s, (slot) => this._xfade(slot)))
      else out.push(mk(s, (slot) => this._statusBox(slot)))
    }
    return out
  }

  // ── toolbar ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  _toolbar (bar) {
    const t = div('', bar); t.style.display = 'contents'
    const mkb = (label, key, desc, getOn, set) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ogl-btn'; b.textContent = label
      b.setAttribute('aria-pressed', String(getOn())); b.setAttribute('data-omni-tip', label); b.setAttribute('data-omni-tip-key', '—'); b.setAttribute('data-omni-tip-desc', desc)
      b.addEventListener('click', () => { const on = !(b.getAttribute('aria-pressed') === 'true'); set(on); b.setAttribute('aria-pressed', String(on)); this.feel.tick('press') })
      t.appendChild(b); return b
    }
    this._tickBtn = mkb('Tick', 'sound', 'A very short tick sound on every button press and knob detent (needs audio to be running).', () => this.layout.state.click.sound, (on) => this.layout.setClick('sound', on))
    this._buzzBtn = mkb('Buzz', 'haptic', 'A tiny vibration on press, on phones that support it.', () => this.layout.state.click.haptic, (on) => this.layout.setClick('haptic', on))
  }

  // ── components ──────────────────────────────────────────────────────────────────────────────────────────────────────
  _circle (slot, n) {
    const c = new DJCircle({
      index: n, feel: this.feel,
      onScrubStart: () => this.decks.scrubBegin(n), onScrub: (sec) => { this.decks.nudge(n, sec) }, onScrubEnd: () => this.decks.scrubEnd(n),
      onReset: () => { const d = this.decks.getDeck(n); if (d && d.loaded) this.decks.seek(n, d.cue) },
    })
    c.mount(slot); this.circles[n] = c
    return { destroy: () => { delete this.circles[n]; c.destroy() }, setValue: (v) => c.setValue(v) }
  }
  _eq (slot, n) {
    const wrap = div('dj-knobs', slot); const knobs = {}
    const labels = { low: 'LOW', mid: 'MID', high: 'HIGH' }
    for (const band of EQ_BANDS) {
      const k = new DJKnob({ id: `dj-eq-${n}-${band}`, label: labels[band], def: 0.5, value: 0.5, detents: [0.5], feel: this.feel, fmt: (v) => fmtDb(eqDb(v)), tipName: `Deck ${n} ${labels[band]} EQ`, tipDesc: `Turns the ${band} frequencies of channel ${n} down (left, to silence) or up (right, +12 dB). Centre click = flat. Double-click resets.`, onInput: (v) => this.decks.setEq(n, band, v) })
      k.mount(wrap); knobs[band] = k
    }
    this.eq[n] = knobs
    this._refs.push((d) => { if (d.n === n) for (const b of EQ_BANDS) knobs[b].setValue(d.eq[b]) })
    return { destroy: () => { delete this.eq[n]; for (const b of EQ_BANDS) knobs[b].destroy() }, setValue: (v) => { if (v && typeof v === 'object') for (const b of EQ_BANDS) if (b in v) knobs[b].setValue(v[b]) } }
  }
  _btns (slot, n) {
    const col = div('dj-col', slot); const r1 = div('dj-row', col); const r2 = div('dj-row', col)
    const dk = this.decks
    const play = new DJButton({ id: `dj-play-${n}`, label: '▶', tipName: `Deck ${n} play / pause`, tipDesc: 'Starts or pauses the track on this deck.', ariaLabel: `Deck ${n} play or pause`, feel: this.feel, onPress: () => dk.toggle(n) })
    const cue = new DJButton({ id: `dj-cue-${n}`, label: 'CUE', tipName: `Deck ${n} cue`, tipDesc: 'While paused: sets the cue point here. While playing: jumps back to the cue point and pauses.', feel: this.feel, onPress: () => dk.cue(n) })
    const mute = new DJButton({ id: `dj-mute-${n}`, label: 'M', toggle: true, warn: true, tipName: `Deck ${n} mute`, tipDesc: 'Silences this channel (the track keeps running).', ariaLabel: `Deck ${n} mute`, feel: this.feel, onChange: (on) => dk.setMute(n, on) })
    const loop = new DJButton({ id: `dj-loop-${n}`, label: '⟲', toggle: true, tipName: `Deck ${n} loop`, tipDesc: 'Repeats the whole track.', ariaLabel: `Deck ${n} loop`, feel: this.feel, onChange: (on) => dk.setLoop(n, on) })
    for (const b of [play, cue, mute, loop]) b.mount(r1)
    const as = {}
    for (const a of ASSIGNS) {
      const b = new DJButton({ id: `dj-assign-${n}-${a}`, label: a, toggle: true, value: a === 'T', tipName: `Deck ${n} crossfader ${a === 'T' ? 'thru' : 'side ' + a}`, tipDesc: a === 'T' ? 'Not affected by the crossfader.' : `The crossfader fades this channel ${a === 'A' ? 'out as it moves to B' : 'in as it moves from A'}.`, ariaLabel: `Deck ${n} assign ${a}`, feel: this.feel, onChange: () => { dk.setAssign(n, a); as[a].setValue(true) } })
      b.mount(r2); as[a] = b
    }
    this.btn[n] = { play, cue, mute, loop, as }
    this._refs.push((d) => {
      if (d.n !== n) return
      play.setLabel(d.playing ? '❚❚' : '▶'); play.setValue(d.playing); play.setDisabled(!d.loaded); cue.setDisabled(!d.loaded)
      mute.setValue(d.mute); loop.setValue(d.loop)
      for (const a of ASSIGNS) as[a].setValue(d.assign === a)
    })
    return { destroy: () => { delete this.btn[n]; for (const b of [play, cue, mute, loop, ...Object.values(as)]) b.destroy() }, setValue: () => {} }
  }
  _deck (slot, n) {
    const col = div('dj-col', slot); const r1 = div('dj-row', col); const r2 = div('dj-row', col)
    const load = new DJButton({ id: `dj-load-${n}`, label: 'Load', tipName: `Deck ${n} load track`, tipDesc: 'Pick a track from the OmniMusicPlayer library (15 slots) or open an audio file.', feel: this.feel, onPress: () => this._openLoad(n, load.root) })
    load.mount(r1); load.root.style.flex = '1 1 0'
    const title = txt('dj-title', r1, '— empty —'); title.classList.add('is-empty')
    const pitchTxt = txt('dj-pitchtxt', r2, '+0.0%')
    const f = new DJFader({ id: `dj-pitch-${n}`, label: `Deck ${n} pitch`, orientation: 'h', min: -1, max: 1, def: 0, value: 0, step: 0.01, feel: this.feel, fmt: (v) => v.toFixed(2), tipName: `Deck ${n} pitch`, tipDesc: 'Speed of the deck (and its jog wheel): +-8 % by default. Double-click returns to normal speed.', onInput: (v) => this.decks.setPitch(n, v) })
    f.mount(r2); r2.insertBefore(f.root, pitchTxt)
    this.pitch[n] = f; this.deckEls[n] = { title, pitchTxt, load }
    this._refs.push((d) => {
      if (d.n !== n) return
      f.setValue(d.pitch); pitchTxt.textContent = fmtPitch(d.pitch, d.range)
      const t = d.error || (d.loaded ? d.name : '— empty —')
      title.textContent = t; title.title = t; title.classList.toggle('is-empty', !d.loaded && !d.error); title.classList.toggle('is-err', !!d.error)
    })
    return { destroy: () => { delete this.pitch[n]; delete this.deckEls[n]; load.destroy(); f.destroy() }, setValue: () => {} }
  }
  _vol (slot, n) {
    const f = new DJFader({ id: `dj-vol-${n}`, label: `Deck ${n} volume`, orientation: 'v', min: 0, max: 1, def: 0.8, value: 0.8, step: 0.02, meter: true, feel: this.feel, fmt: pct, tipName: `Deck ${n} volume`, tipDesc: 'Channel volume fader with a level meter. Double-click resets to 80 %.', onInput: (v) => this.decks.setVolume(n, v) })
    f.mount(slot); this.vol[n] = f
    this._refs.push((d) => { if (d.n === n) f.setValue(d.volume) })
    return { destroy: () => { delete this.vol[n]; f.destroy() }, setValue: (v) => f.setValue(v) }
  }
  _master (slot) {
    const wrap = div('dj-knobs', slot)
    const k = new DJKnob({ id: 'dj-master-knob', label: 'MASTER', def: 0.85, value: 0.85, detents: [0.85], feel: this.feel, fmt: pct, tipName: 'Master volume', tipDesc: 'The volume of everything the six decks play together. Double-click resets.', onInput: (v) => this.decks.setMaster(v) })
    k.mount(wrap); this.master = k
    return { destroy: () => { this.master = null; k.destroy() }, setValue: (v) => k.setValue(v) }
  }
  _xfade (slot) {
    const box = div('dj-xf', slot); const line = div('dj-line', box); const line2 = div('dj-line', box)
    txt('dj-ab', line, 'A')
    const f = new DJFader({ id: 'dj-crossfader', label: 'Crossfader', orientation: 'h', min: -1, max: 1, def: 0, value: 0, step: 0.04, feel: this.feel, fmt: (v) => v.toFixed(2), tipName: 'Crossfader', tipDesc: 'Fades between the channels assigned to A (left) and B (right). Channels set to T (thru) are not affected. Double-click centres it.', onInput: (v) => this.decks.setCrossfader(v) })
    f.mount(line); line.appendChild(f.root); f.root.style.flex = '1 1 0'
    txt('dj-ab', line, 'B')
    const curve = new DJButton({ id: 'dj-curve', label: 'Curve: constant power', tipName: 'Crossfader curve', tipDesc: 'Constant power keeps the loudness even through the middle; linear dips in the middle.', feel: this.feel, onPress: () => { const cur = this.decks.getState().cross.curve; this.decks.setCurve(CURVES[(CURVES.indexOf(cur) + 1) % CURVES.length]) } })
    curve.mount(line2); this.curveBtn = curve; this.xfade = f
    return { destroy: () => { this.xfade = null; this.curveBtn = null; f.destroy(); curve.destroy() }, setValue: (v) => f.setValue(v) }
  }
  _statusBox (slot) {
    const box = div('dj-status', slot)
    const l1 = txt('dj-st-line', box); const l2 = txt('dj-st-line', box)
    const row = div('dj-row', box)
    const en = new DJButton({ id: 'dj-enable', label: 'Enable audio', tipName: 'Enable audio', tipDesc: 'Browsers keep audio locked until you touch the page. This button unlocks the six decks.', feel: this.feel, onPress: () => { this.decks.unlock().then(() => this._refreshStatus()) } })
    const stop = new DJButton({ id: 'dj-stopall', label: 'Stop all', tipName: 'Stop all decks', tipDesc: 'Pauses every deck.', feel: this.feel, onPress: () => this.decks.stopAll() })
    en.mount(row); stop.mount(row)
    this.status = { l1, l2, en, stop }
    this._refreshStatus()
    return { destroy: () => { this.status = null; en.destroy(); stop.destroy() }, setValue: () => {} }
  }
  _refreshStatus () {
    const s = this.status; if (!s) return
    const st = this.decks.getState(); const playing = st.decks.filter(d => d.playing).length; const loaded = st.decks.filter(d => d.loaded).length
    const ctx = this.decks.context
    s.l1.textContent = !ctx ? 'Audio: not started' : st.running ? `Audio: running${st.shared ? ' (shared)' : ''}` : 'Audio: locked'
    s.l2.textContent = `${loaded} loaded · ${playing} playing`
    s.en.root.hidden = !!(ctx && st.running); s.en.root.style.display = s.en.root.hidden ? 'none' : ''
  }

  // ── load menu ───────────────────────────────────────────────────────────────────────────────────────────────────────
  async _openLoad (n, anchor) {
    this._closePop()
    const pop = div('dj dj-pop'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', `Load a track into deck ${n}`)
    pop.innerHTML = `<h4>DECK ${n} · LOAD</h4><div class="dj-list"></div><button type="button" class="dj-slot" data-a="file"><span class="dj-n">⇪</span><span>Open an audio file…</span></button><button type="button" class="dj-slot" data-a="unload"><span class="dj-n">✕</span><span>Empty this deck</span></button><div class="dj-note">The library is the OmniMusicPlayer's 15 slots. Add tracks there to keep them; a file opened here is used for this session only.</div>`
    document.body.appendChild(pop)
    const r = anchor ? anchor.getBoundingClientRect() : { left: 20, bottom: 40, top: 20 }
    const W = typeof window !== 'undefined' ? window.innerWidth : 1024; const H = typeof window !== 'undefined' ? window.innerHeight : 768
    pop.style.left = Math.max(6, Math.min(W - 262, r.left)) + 'px'; pop.style.top = Math.max(6, Math.min(H - 260, r.bottom + 4)) + 'px'
    const list = pop.querySelector('.dj-list')
    const close = () => this._closePop()
    pop.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-a], button[data-slot]'); if (!b) return
      this.feel.tick('press')
      if (b.dataset.a === 'unload') { this.decks.unload(n); close() } else if (b.dataset.a === 'file') this._pickFile(n, close)
      else if (b.dataset.slot) { close(); await this.decks.unlock(); await this.decks.load(n, { slot: Number(b.dataset.slot) }) }
    })
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); try { anchor && anchor.focus() } catch (_) { /* ignore */ } } }
    const onDown = (e) => { if (!pop.contains(e.target) && e.target !== anchor) close() }
    document.addEventListener('keydown', onKey, true); document.addEventListener('pointerdown', onDown, true)
    this._pop = pop; this._popOff = () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown, true) }
    let names = new Map()
    try { for (const w of (await this.decks.store.listWallpapers()) || []) names.set(w.slot, w.name || '') } catch (_) { names = new Map() }
    if (this._pop !== pop) return
    let html = ''
    for (let s = 1; s <= LIBRARY_SLOTS; s++) { const has = names.has(s); html += `<button type="button" class="dj-slot" data-slot="${s}" ${has ? '' : 'disabled'}><span class="dj-n">${s}</span><span>${has ? esc(names.get(s) || 'Track ' + s) : '(empty)'}</span></button>` }
    list.innerHTML = html
    const first = pop.querySelector('button[data-slot]:not([disabled])') || pop.querySelector('button[data-a]'); try { first && first.focus() } catch (_) { /* ignore */ }
  }
  _pickFile (n, done) {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*'; input.style.display = 'none'
    document.body.appendChild(input)
    input.addEventListener('change', async () => { const f = input.files && input.files[0]; input.remove(); done(); if (f) { await this.decks.unlock(); await this.decks.load(n, f) } })
    input.click()
  }
  _closePop () { if (this._popOff) { this._popOff(); this._popOff = null } if (this._pop) { this._pop.remove(); this._pop = null } }

  // ── state / frame loop ──────────────────────────────────────────────────────────────────────────────────────────────
  _onState (d) {
    if (!this._alive) return
    if (d.deck) { for (const f of this._refs) f(d.state) } else {
      const st = this.decks.getState()
      if (this.master) this.master.setValue(st.master)
      if (this.xfade) this.xfade.setValue(st.cross.pos)
      if (this.curveBtn) this.curveBtn.setLabel('Curve: ' + st.cross.curve.replace('-', ' '))
      if (d.why === 'state' || d.why === 'destroy') this.refreshAll(true)
    }
    this._refreshStatus()
  }
  refreshAll (skipGlobal) {
    const st = this.decks.getState()
    for (const d of st.decks) for (const f of this._refs) f(d)
    if (!skipGlobal) {
      if (this.master) this.master.setValue(st.master)
      if (this.xfade) this.xfade.setValue(st.cross.pos)
      if (this.curveBtn) this.curveBtn.setLabel('Curve: ' + st.cross.curve.replace('-', ' '))
    }
    this._refreshStatus()
  }
  _start () {
    if (this._raf || typeof requestAnimationFrame !== 'function') return
    const step = (ts) => {
      this._raf = 0
      if (!this._alive) return
      if (!this.host.isConnected) { this._idle = true; return }   // removed from the page without destroy(): stop (resume() restarts)
      this._raf = requestAnimationFrame(step)
      if (ts - this._last < FRAME_MS) return
      const dt = Math.min(0.25, this._last ? (ts - this._last) / 1000 : 0); this._last = ts
      this.frame(dt)
    }
    this._raf = requestAnimationFrame(step)
  }
  resume () { this._idle = false; this._last = 0; this._start() }
  /** One UI frame (public so tests can drive it). */
  frame (dt) {
    let any = false
    for (let n = 1; n <= DECKS; n++) {
      const d = this.decks.getDeck(n)
      const lvl = d.playing ? this.decks.getLevel(n) : 0
      this._levels[n] = this._levels[n] * 0.6 + Math.min(1, lvl * 2.6) * 0.4
      const c = this.circles[n]; if (c) c.sync(d, this._levels[n], dt)
      const v = this.vol[n]; if (v) v.setMeter(this._levels[n])
      if (d.playing) any = true
    }
    this._frames = (this._frames || 0) + 1
    if (this._frames % 15 === 0) this._refreshStatus()
    return any
  }
  onResize () { /* percentages: nothing to recompute */ }
  destroy () {
    if (!this._alive) return
    this._alive = false
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf)
    this._raf = 0
    this._closePop()
    try { this._unsub && this._unsub() } catch (_) { /* ignore */ }
    try { this.host.removeEventListener('pointerdown', this._gestureFn, { capture: true }); this.host.removeEventListener('keydown', this._gestureFn, { capture: true }) } catch (_) { /* ignore */ }
    this.layout.destroy()
    this._refs = []
  }
}

export function createOmniDJ (host, opts) { return new OmniDJ(host, opts) }

/** The OmniQuadrantRegistry content 'dj': mount(host, ctx) -> { destroy, onResize }. */
export function mountDJ (host, ctx = {}) {
  const dj = new OmniDJ(host, { quadrant: ctx && ctx.quadrant })
  return { destroy: () => dj.destroy(), onResize: () => dj.onResize(), dj }
}
export default OmniDJ
