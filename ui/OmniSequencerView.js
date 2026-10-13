/**
 * ui/OmniSequencerView.js — the step-sequencer EDITOR of a MusicNode (V195): the content of the OmniSequencer window and of the 'sequencer' quadrant.
 *
 * 2D DOM + <canvas> only (no WebGL context). One lane per track:
 *   grid lane   steps as columns (16 by default): tap a step to switch it on / off, drag across empty steps to paint, drag UP / DOWN on a note (or hold it, long press)
 *               to set its velocity, drag sideways over notes to erase. The track's note (a picker) is what the grid writes.
 *   roll lane   a compact piano roll for pitched tracks: a key column, one row per semitone (scrolls), tap an empty cell to paint a note (it sounds once), tap a note to
 *               select it, drag sideways on a note to set its length (gate), Delete removes it.
 *   note editor under the lanes: the selected note's velocity, length (gate), probability and timing offset.
 * Per track: arm (the red dot = where recording goes AND where a preset / clear / copy / paste acts), name, instrument (the scene's SoundNodes or the default sine), mute,
 * solo, and under the gear: note, grid / roll, volume, pan, transpose, move up / down, duplicate, remove. Whole pattern: tempo, swing, steps per bar, bars, step length
 * (resolution), master gain, count-in, record quantize + resolution, overdub, loop, metronome; presets, clear / copy / paste track; undo / redo; undo last recording.
 * The playhead is a thin overlay moved with a transform while the sequencer runs (the canvases are redrawn only when the data changes).
 *
 * Everything is read and written through systems/OmniMusicNodes.js (Extra.SERVICES.music) and the transport through systems/OmniSequencer.js (SERVICES.sequencer): this
 * file imports no system, only the models and the SoundScene's getSoundNodes (defensively). `opts.compact` (the quadrant) hides the settings and the editor rows.
 * Touch: pointer events, touch-action pan-x on the lanes (they scroll sideways), 40 px controls on phones.
 * User-facing: imports no Dev* module.
 */

import * as MM from '../utils/OmniMusicModel.js'
import { SERVICES, KIND_MUSIC } from '../utils/OmniExtraKinds.js'
import * as Settings from '../utils/OmniSoundSettings.js'
import { getSoundNodes } from '../systems/OmniSoundScene.js'
import { esc, tip } from './OmniSoundFields.js'

const NAV_ITEM = '⟐OmniSequencer'
const LONG_PRESS_MS = 450
const ROLL_KEY_W = 34
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const trackColor = (i) => `hsl(${(i * 47 + 24) % 360} 72% 62%)`

export const STYLES = `
.osq { font-size: 11px; }
.osq .osq-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px 0; }
.osq .osq-notice { padding: 8px; margin: 6px 0; border: 1px dashed rgba(255,255,255,.35); border-radius: 8px; line-height: 1.45; }
.osq .osq-who { font-size: 11px; margin: 2px 0 4px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.osq .osq-who b { color: var(--omni-theme-accent, #ffb86b); }
.osq .osq-st { margin-left: auto; font-size: 10px; opacity: .85; }
.osq .osq-st.is-live { color: #8cffb4; opacity: 1; } .osq .osq-st.is-rec { color: #ff7b7b; opacity: 1; }
.osq .osq-btn, .osq .osq-in, .osq .osq-sel { min-height: 28px; box-sizing: border-box; padding: 2px 8px; font: inherit; color: inherit; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); }
.osq .osq-btn { cursor: pointer; } .osq .osq-btn:hover:not(:disabled) { background: rgba(255,255,255,.17); } .osq .osq-btn:disabled { opacity: .4; cursor: default; }
.osq .osq-btn.is-on { background: rgba(255,184,107,.32); border-color: rgba(255,184,107,.85); }
.osq .osq-btn.is-rec.is-on { background: rgba(255,77,77,.4); border-color: #ff6b6b; }
.osq .osq-btn.is-danger { background: rgba(255,90,90,.22); border-color: rgba(255,120,120,.6); }
.osq .osq-sel option { color: #111; background: #fff; }
.osq .osq-in { width: 64px; } .osq .osq-name { width: 96px; } .osq .osq-range { flex: 1 1 70px; min-width: 60px; min-height: 22px; }
.osq .osq-field { display: inline-flex; gap: 4px; align-items: center; } .osq .osq-field > span { opacity: .7; font-size: 9.5px; white-space: nowrap; }
.osq .osq-h { margin: 10px 0 2px; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; opacity: .65; }
.osq .osq-track { margin: 6px 0; padding: 4px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(255,255,255,.025); }
.osq .osq-track.is-armed { border-color: rgba(255,120,120,.75); background: rgba(255,90,90,.05); }
.osq .osq-track.is-muted { opacity: .55; }
.osq .osq-arm { width: 22px; min-height: 22px; padding: 0; border-radius: 50%; }
.osq .osq-arm.is-on { background: #ff4d4d; border-color: #ff9a9a; }
.osq .osq-ms { width: 26px; padding: 0; text-align: center; }
.osq .osq-ms.is-mute.is-on { background: rgba(255,200,80,.4); border-color: #ffc850; } .osq .osq-ms.is-solo.is-on { background: rgba(120,200,255,.4); border-color: #78c8ff; }
.osq .osq-more { display: none; } .osq .osq-track.is-open .osq-more { display: flex; }
.osq .osq-lane { position: relative; overflow-x: auto; overflow-y: hidden; touch-action: pan-x; border-radius: 6px; background: rgba(0,0,0,.28); margin-top: 4px; -webkit-overflow-scrolling: touch; }
.osq .osq-lane.is-roll { max-height: 150px; overflow-y: auto; touch-action: pan-x pan-y; }
.osq .osq-lane-in { position: relative; }
.osq .osq-lane canvas { display: block; outline: none; } .osq .osq-lane canvas:focus-visible { box-shadow: inset 0 0 0 2px rgba(255,184,107,.9); }
.osq .osq-head { position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: #ffb86b; box-shadow: 0 0 6px #ffb86b; pointer-events: none; display: none; will-change: transform; }
.osq .osq-noteed { padding: 4px 6px; margin: 6px 0; border: 1px solid rgba(255,184,107,.5); border-radius: 8px; }
.osq .osq-msg { min-height: 14px; margin-top: 4px; } .osq .osq-msg.is-err { color: #ff8a8a; } .osq .osq-msg.is-ok { color: #8fe3a2; }
.osq.is-compact .osq-full { display: none; }
@media (max-width: 700px) { .osq .osq-btn, .osq .osq-in, .osq .osq-sel { min-height: 40px; } .osq .osq-arm { width: 36px; min-height: 36px; } .osq .osq-ms { width: 40px; } .osq .osq-range { min-height: 34px; } .osq .osq-name { width: 80px; } }
`
let styled = false
export function injectSequencerStyles () {
  if (typeof document === 'undefined') return
  if (styled && document.getElementById('osq-styles')) return
  styled = true
  const s = document.createElement('style'); s.id = 'osq-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const svcOf = (v) => v.opts.svc ?? SERVICES.music
const seqOf = (v) => v.opts.seq ?? SERVICES.sequencer

export default class OmniSequencerView {
  /** @param host an element to fill. @param opts { svc?, seq?, compact?, nodeId?, onFull? } (svc / seq default to Extra.SERVICES). */
  constructor (host, opts = {}) {
    this.host = host
    this.opts = opts
    this.compact = !!opts.compact
    this._nodeId = opts.nodeId ?? null
    this._expanded = new Set()
    this._sel = null
    this._msg = { text: '', err: false }
    this._ranges = new Map()
    this._lanes = new Map()      // trackId -> { canvas, head, wrap, kind, cellW, rowH, keyW, lo, hi }
    this._drag = null
    this._raf = 0
    this._bound = []
    this._dead = false
    this._rq = 0
    this._pending = new Map()
    this._built = false
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  mount () {
    injectSequencerStyles()
    if (this._built) return this
    this._built = true
    this.host.classList.add('osq'); this.host.classList.toggle('is-compact', this.compact)
    this.host.innerHTML = '<div data-ref="top"></div><div data-ref="main"></div><div data-ref="msg" class="osq-msg" role="status" aria-live="polite"></div>'
    this.host.addEventListener('click', (e) => this._click(e))
    this.host.addEventListener('input', (e) => this._input(e))
    this.host.addEventListener('change', (e) => this._change(e))
    this.host.addEventListener('pointerdown', (e) => this._down(e))
    this.host.addEventListener('keydown', (e) => this._key(e))
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:music-data-changed', (d) => this._onData(d))
    on('omni:music-transport', () => this._later('transport', () => this._syncTransport()))
    on('omni:music-armed', () => this._later('armed', () => this._syncArmed()))
    on('omni:node-selected', (d) => { const id = d.node?.id; if (id && d.node?.nodeKind === KIND_MUSIC) { this._nodeId = id; this._later('refresh', () => this.refresh()) } })
    on('omni:node-deleted', (d) => { if (d.id === this._nodeId) { this._nodeId = null; this._sel = null } this._later('refresh', () => this.refresh()) })
    on('omni:node-created', () => this._later('nodes', () => this._syncNodeList()))
    on('omni:sound-settings-changed', () => this._later('transport', () => this._syncTransport()))
    this._startLoop()
    this.refresh()
    return this
  }

  destroy () {
    this._dead = true
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h)); this._bound = []
    this._stopLoop()
    clearTimeout(this._drag?.timer); this._drag = null
    if (this._rq && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._rq)
    this._rq = 0
    this._lanes.clear()
    if (this.host) { this.host.innerHTML = ''; this.host.classList.remove('osq', 'is-compact') }
  }

  /** Called when the host is shown / resized: redraw the lanes. */
  onResize () { this._drawAll() }

  get nodeId () { return this._nodeId }
  setNode (id) { this._nodeId = id ?? null; this._sel = null; if (this._built) this.refresh() }
  say (text, err = false) { this._msg = { text, err }; const m = this.host?.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'osq-msg ' + (err ? 'is-err' : 'is-ok') } }

  /** Run `fn` on the next animation frame; calls with the same key in one frame run once (the last one), different keys all run, in order. */
  _later (key, fn) {
    if (this._dead || (this.opts.active && !this.opts.active())) return   // a closed window does no work; it refreshes when it opens
    this._pending.set(key, fn)
    if (this._rq) return
    const run = () => {
      this._rq = 0
      const todo = [...this._pending.values()]; this._pending.clear()
      if (!this._dead) for (const f of todo) { try { f() } catch (err) { console.warn('OmniSequencerView', err) } }
    }
    if (typeof requestAnimationFrame === 'function') this._rq = requestAnimationFrame(run); else run()
  }

  _music () { try { return this._nodeId ? svcOf(this)?.getMusic(this._nodeId) ?? null : null } catch (_) { return null } }
  _name (id) { try { return svcOf(this)?.getNodeData(id)?.label ?? id } catch (_) { return id } }

  // ── Following the data ──────────────────────────────────────────────────────

  _onData (d) {
    if (d.nodeId !== this._nodeId) return
    const r = d.reason
    if (r === 'steps' || r === 'record') this._later('draw', () => { this._drawAll(); this._syncNoteEd() })
    else if (r === 'field') this._later('values', () => { this._syncValues(); this._relayoutIfNeeded() })
    else this._later('refresh', () => this.refresh())
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  _musicNodeIds () { try { return svcOf(this)?.listMusicNodes() ?? [] } catch (_) { return [] } }

  refresh () {
    const top = this.host.querySelector('[data-ref="top"]'); const main = this.host.querySelector('[data-ref="main"]')
    if (!top || !main) return
    const svc = svcOf(this)
    if (!svc) { top.innerHTML = '<div class="osq-notice" data-testid="osq-nosvc">The music system is not running.</div>'; main.innerHTML = ''; return }
    const ids = this._musicNodeIds()
    if (!this._nodeId || !svc.getMusic(this._nodeId)) {
      const fallback = (seqOf(this)?.nodeId && ids.includes(seqOf(this).nodeId)) ? seqOf(this).nodeId : (svc.selectedId && ids.includes(svc.selectedId) ? svc.selectedId : ids[0] ?? null)
      this._nodeId = fallback
    }
    const m = this._music()
    if (!m) {
      top.innerHTML = `<div class="osq-notice" data-testid="osq-nonode">No music node is selected. Select a music node to edit its pattern, or create one.</div>
        <div class="osq-row"><button type="button" class="osq-btn is-on" data-act="create" ${tip('Create a music node', '—', 'Creates a MusicNode in front of the camera: a step sequencer you can place, with four tracks to start from. It is selected and opens here.')}>＋ Create a music node</button></div>`
      main.innerHTML = ''; this._lanes.clear(); this.say('', false); return
    }
    const scroll = this.host.parentElement?.scrollTop ?? 0
    top.innerHTML = this._topHTML(ids)
    main.innerHTML = this._mainHTML(m)
    this._layoutLanes(m)
    this._syncTransport(); this._syncValues(); this._syncArmed(); this._syncNoteEd()
    if (this.host.parentElement) this.host.parentElement.scrollTop = scroll
  }

  _topHTML (ids) {
    const opts = ids.map(id => `<option value="${esc(id)}" ${id === this._nodeId ? 'selected' : ''}>${esc(this._name(id))}</option>`).join('')
    return `<div class="osq-who" data-testid="osq-who">♫ <select class="osq-sel" data-f="node" aria-label="Music node" ${tip('Music node', '—', 'Which music node you are editing. Selecting a music node in the scene switches to it.')}>${opts}</select>
      <button type="button" class="osq-btn osq-full" data-act="create" ${tip('New music node', '—', 'Creates another music node in front of the camera.')}>＋</button>
      <span class="osq-st" data-ref="status" data-testid="osq-status"></span></div>
      <div class="osq-row" data-ref="transport">
        <button type="button" class="osq-btn" data-act="play" ${tip('Play', '—', 'Plays the pattern from the start. Press again (Stop) to stop. Needs sound switched on (the speaker).')}>▶ Play</button>
        <button type="button" class="osq-btn" data-act="stop" ${tip('Stop', '—', 'Stops the transport and the notes it started.')}>■ Stop</button>
        <button type="button" class="osq-btn is-rec" data-act="rec" ${tip('Record', '—', 'Records what you play on the keys, MIDI or the touch keyboards / BeatPad into the ARMED track (the red dot). After the count-in it records while the pattern loops. Press again to finish the take.')}>● Rec</button>
        <button type="button" class="osq-btn is-rec" data-act="steprec" ${tip('Step record', '—', 'Step recording: each note you play is written to the next step of the armed track and the cursor advances. No clock. Notes played together make a chord.')}>⏭ Step</button>
        <button type="button" class="osq-btn" data-act="rest" ${tip('Rest', '—', 'Step recording: skip a step without a note.')}>Rest</button>
        <button type="button" class="osq-btn" data-act="back" ${tip('Step back', '—', 'Step recording: move the cursor one step back.')}>◀ Back</button>
        <button type="button" class="osq-btn" data-act="loop" ${tip('Loop', '—', 'On: the pattern repeats. Off: it plays once and stops.')}>⟳ Loop</button>
        <button type="button" class="osq-btn" data-act="metro" ${tip('Metronome', '—', 'A click on every beat while the pattern plays (the count-in always clicks).')}>◔ Metronome</button>
        <button type="button" class="osq-btn" data-act="undo" ${tip('Undo', '—', 'Takes back the last change of the pattern (60 steps). A whole recording or a whole drag is one step.')}>↶</button>
        <button type="button" class="osq-btn" data-act="redo" ${tip('Redo', '—', 'Puts back what Undo took away.')}>↷</button>
        <button type="button" class="osq-btn" data-act="undotake" ${tip('Undo recording', '—', 'Takes back the last recording take (only while nothing else was edited after it).')}>↶ Take</button>
      </div>
      <div class="osq-row" data-ref="mute" hidden><span data-testid="osq-muted">Sound is muted.</span><button type="button" class="osq-btn is-on" data-act="enable" ${tip('Enable sound', '—', 'Switches sound on for this session (the same as the Enable sound prompt).')}>🔊 Enable sound</button></div>`
  }

  _mainHTML (m) {
    const num = (key, label, min, max, step, desc, unit = '') => `<label class="osq-field osq-grow"><span>${label}</span><input class="osq-range" type="range" data-f="${key}" min="${min}" max="${max}" step="${step}" ${tip(label, key, desc)}><input class="osq-in" type="number" data-f="${key}" min="${min}" max="${max}" step="${step}" aria-label="${label}" ${tip(label, key, desc)}>${unit ? `<span>${unit}</span>` : ''}</label>`
    const sel = (key, label, opts, desc) => `<label class="osq-field"><span>${label}</span><select class="osq-sel" data-f="${key}" ${tip(label, key, desc)}>${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></label>`
    const chk = (key, label, desc) => `<label class="osq-field"><input type="checkbox" data-f="${key}" ${tip(label, key, desc)}><span>${label}</span></label>`
    const res = MM.RESOLUTIONS.map(r => [r, r])
    return `<div class="osq-full">
      <div class="osq-h">Pattern</div>
      <div class="osq-row">${num('tempo', 'Tempo', MM.LIMITS.tempoMin, MM.LIMITS.tempoMax, 1, 'Speed in beats per minute (20 to 300). Changes are heard at once while playing.', 'bpm')}${num('swing', 'Swing', 0, MM.LIMITS.swingMax, 0.01, 'Delays every second step by this fraction of a step (0 = straight, 0.5 = a shuffle).')}</div>
      <div class="osq-row">${num('stepsPerBar', 'Steps / bar', MM.LIMITS.stepsMin, MM.LIMITS.stepsMax, 1, 'How many steps one bar has (4 to 32). Notes beyond a shorter pattern are cut off (Undo brings them back).')}${num('bars', 'Bars', MM.LIMITS.barsMin, MM.LIMITS.barsMax, 1, 'How many bars the pattern has (1 to 8).')}</div>
      <div class="osq-row">${sel('resolution', 'Step length', res, 'How long ONE step is: 1/16 = a sixteenth note, 1/4 = a quarter note (one beat).')}${num('gain', 'Master', 0, 1, 0.01, 'The loudness of the whole pattern (0 to 1).')}${sel('countIn', 'Count-in', [0, 1, 2, 3, 4].map(n => [n, n ? n + ' bar' + (n > 1 ? 's' : '') : 'off']), 'Bars of clicks before a recording starts.')}</div>
      <div class="osq-row">${chk('recordQuantize', 'Quantize recording', 'On: recorded notes snap to the grid below. Off: they keep their exact timing (as an offset inside the step).')}${sel('recordResolution', 'Grid', res, 'The grid recorded notes snap to.')}${chk('overdub', 'Overdub', 'On: recording adds to the armed track. Off: the armed track is cleared when the take starts.')}</div>
      <div class="osq-row">
        <select class="osq-sel" data-f="pattern" aria-label="Pattern presets" ${tip('Pattern presets', '—', 'Fills the ARMED track with a ready-made pattern (four on the floor, backbeat, hats, arpeggios, bassline, chords ...). Undo takes it back.')}><option value="">Pattern preset for the armed track…</option>${MM.PATTERN_IDS.map(id => `<option value="${esc(id)}">${esc(MM.PATTERNS[id].label)}</option>`).join('')}</select>
        <button type="button" class="osq-btn" data-act="clear" ${tip('Clear track', '—', 'Removes every note of the armed track.')}>Clear</button>
        <button type="button" class="osq-btn" data-act="copy" ${tip('Copy track', '—', 'Copies the notes of the armed track.')}>Copy</button>
        <button type="button" class="osq-btn" data-act="paste" ${tip('Paste track', '—', 'Replaces the notes of the armed track with the copied ones (it works across music nodes).')}>Paste</button>
        <button type="button" class="osq-btn" data-act="addtrack" ${tip('Add track', '—', 'Adds an empty track (up to 16).')}>＋ Track</button>
      </div></div>
      <div class="osq-h">Tracks</div>
      <div data-ref="tracks">${m.tracks.map((t, i) => this._trackHTML(m, t, i)).join('') || '<div class="osq-notice">This pattern has no tracks. Press ＋ Track.</div>'}</div>
      <div data-ref="noteed" class="osq-full"></div>`
  }

  _instrumentOptions (cur) {
    let ids = []
    try { ids = getSoundNodes() ?? [] } catch (_) { ids = [] }
    if (!ids.length) { try { ids = (svcOf(this)?.omniNode?.getAllNodes?.() ?? []).filter(d => d?.sound && d.sound.enabled).map(d => d.id) } catch (_) { ids = [] } }
    const mine = this._nodeId
    ids = ids.filter(id => id !== mine)
    const o = [`<option value="" ${cur ? '' : 'selected'}>Default sine</option>`]
    for (const id of ids) o.push(`<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(this._name(id))}</option>`)
    if (cur && !ids.includes(cur)) o.push(`<option value="${esc(cur)}" selected>⚠ missing: ${esc(cur)}</option>`)
    return o.join('')
  }

  _trackHTML (m, t, i) {
    const open = this._expanded.has(t.id)
    const notes = []; for (let n = 127; n >= 0; n--) notes.push(`<option value="${n}" ${n === t.note ? 'selected' : ''}>${esc(MM.midiToName(n))}</option>`)
    return `<div class="osq-track ${open ? 'is-open' : ''}" data-track="${esc(t.id)}" data-testid="osq-track">
      <div class="osq-row">
        <button type="button" class="osq-btn osq-arm" data-act="arm" aria-label="Arm ${esc(t.name)}" ${tip('Arm for recording', '—', 'The armed track receives recorded notes and is the one the preset, Clear, Copy and Paste buttons act on.')}></button>
        <input class="osq-in osq-name" data-tf="name" value="${esc(t.name)}" maxlength="${MM.LIMITS.nameMax}" aria-label="Track name" ${tip('Track name', '—', 'The name of this track.')}>
        <select class="osq-sel" data-tf="instrumentNodeId" aria-label="Instrument" ${tip('Instrument', '—', 'What plays this track: the Default sine, or one of the SoundNodes in the scene (its sound settings are the instrument).')}>${this._instrumentOptions(t.instrumentNodeId)}</select>
        <button type="button" class="osq-btn osq-ms is-mute" data-act="mute" aria-pressed="${t.mute}" ${tip('Mute', '—', 'Silences this track.')}>M</button>
        <button type="button" class="osq-btn osq-ms is-solo" data-act="solo" aria-pressed="${t.solo}" ${tip('Solo', '—', 'Only the solo tracks sound.')}>S</button>
        <button type="button" class="osq-btn osq-ms osq-full" data-act="more" aria-expanded="${open}" ${tip('Track settings', '—', 'Shows the note, view, volume, pan, transpose and the move / duplicate / remove buttons of this track.')}>⚙</button>
      </div>
      <div class="osq-row osq-more osq-full">
        <label class="osq-field"><span>Note</span><select class="osq-sel" data-tf="note" ${tip('Track note', '—', 'The pitch the step grid writes for this track (and the root of the pattern presets).')}>${notes.join('')}</select></label>
        <button type="button" class="osq-btn" data-act="view" ${tip('Grid / piano roll', '—', 'Switches this track between the step grid and a compact piano roll for pitched notes.')}>${t.view === 'roll' ? '▦ Grid' : '♪ Roll'}</button>
        <label class="osq-field osq-grow"><span>Vol</span><input class="osq-range" type="range" min="0" max="1" step="0.01" data-tf="volume" value="${t.volume}" ${tip('Track volume', '—', 'The loudness of this track (0 to 1).')}></label>
        <label class="osq-field osq-grow"><span>Pan</span><input class="osq-range" type="range" min="-1" max="1" step="0.01" data-tf="pan" value="${t.pan}" ${tip('Track pan', '—', 'Left (-1) to right (+1). Used when the sound engine supports panning.')}></label>
        <label class="osq-field"><span>Transpose</span><input class="osq-in" type="number" min="-48" max="48" step="1" data-tf="transpose" value="${t.transpose}" ${tip('Transpose', '—', 'Moves every note of this track by semitones (12 = an octave).')}></label>
        <button type="button" class="osq-btn" data-act="up" ${tip('Move up', '—', 'Moves the track up.')}>▲</button>
        <button type="button" class="osq-btn" data-act="down" ${tip('Move down', '—', 'Moves the track down.')}>▼</button>
        <button type="button" class="osq-btn" data-act="dup" ${tip('Duplicate track', '—', 'Copies the track with its notes.')}>⧉</button>
        <button type="button" class="osq-btn is-danger" data-act="remove" ${tip('Remove track', '—', 'Deletes the track and its notes (Undo brings it back).')}>✕</button>
      </div>
      <div class="osq-lane ${t.view === 'roll' ? 'is-roll' : ''}" data-lane="${esc(t.id)}"><div class="osq-lane-in"><canvas data-track="${esc(t.id)}" tabindex="0" role="application" aria-label="${esc(t.name)} steps: arrow keys move, Enter or Space toggles a note" ${tip(t.name + (t.view === 'roll' ? ' piano roll' : ' steps'), '—', t.view === 'roll' ? 'Tap an empty cell to paint a note, tap a note to select it, drag sideways on a note to set its length, Delete removes it.' : 'Tap a step to switch a note on or off, drag across steps to paint, drag a note up or down (or hold it) to set its velocity.')}></canvas><div class="osq-head"></div></div></div>
    </div>`
  }

  // ── Lanes (canvas) ──────────────────────────────────────────────────────────

  _isPhone () { return typeof window !== 'undefined' && window.innerWidth <= 700 }

  _range (t) {
    let r = this._ranges.get(t.id)
    let lo = clamp(t.note - 12, 0, 127); let hi = clamp(t.note + 24, 0, 127)
    for (const e of t.steps) { if (e.midi - 2 < lo) lo = clamp(e.midi - 2, 0, 127); if (e.midi + 2 > hi) hi = clamp(e.midi + 2, 0, 127) }
    if (!r || r.lo > lo || r.hi < hi) { r = { lo: Math.min(lo, r?.lo ?? lo), hi: Math.max(hi, r?.hi ?? hi) }; this._ranges.set(t.id, r) }
    return r
  }

  _layoutLanes (m) {
    this._lanes.clear()
    const total = MM.totalSteps(m)
    const hostW = Math.max(240, (this.host.clientWidth || 360) - 20)
    const phone = this._isPhone()
    const cellW = clamp(Math.floor((hostW - ROLL_KEY_W) / total), phone ? 26 : 18, 40)
    this.host.querySelectorAll('.osq-lane').forEach((wrap) => {
      const tid = wrap.dataset.lane; const t = m.tracks.find(x => x.id === tid); if (!t) return
      const canvas = wrap.querySelector('canvas'); const head = wrap.querySelector('.osq-head')
      const roll = t.view === 'roll'
      const rng = roll ? this._range(t) : null
      const rowH = roll ? (phone ? 16 : 11) : (phone ? 44 : 30)
      const keyW = roll ? ROLL_KEY_W : 0
      const w = keyW + total * cellW; const h = roll ? (rng.hi - rng.lo + 1) * rowH : rowH
      const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'
      wrap.querySelector('.osq-lane-in').style.width = w + 'px'
      this._lanes.set(tid, { canvas, head, wrap, roll, cellW, rowH, keyW, lo: rng?.lo ?? 0, hi: rng?.hi ?? 0, w, h, dpr, total })
    })
    this._drawAll()
    // a roll opens scrolled to the track's note
    for (const [tid, L] of this._lanes) if (L.roll && !L.wrap.dataset.scrolled) {
      const t = m.tracks.find(x => x.id === tid); L.wrap.dataset.scrolled = '1'
      try { L.wrap.scrollTop = Math.max(0, (L.hi - clamp(t.note + 8, L.lo, L.hi)) * L.rowH) } catch (_) { /* no layout */ }
    }
  }

  _relayoutIfNeeded () {
    const m = this._music(); if (!m) return
    const first = [...this._lanes.values()][0]
    if (!first || first.total !== MM.totalSteps(m)) this._layoutLanes(m)
    else this._drawAll()
  }

  _drawAll () { const m = this._music(); if (!m) return; m.tracks.forEach((t, i) => { const L = this._lanes.get(t.id); if (L) this._drawLane(L, t, i, m) }) }

  _drawLane (L, t, idx, m) {
    let g = null
    try { g = L.canvas.getContext('2d') } catch (_) { g = null }
    if (!g) return
    const { cellW, rowH, keyW, total, roll } = L
    const spb = MM.stepsPerBar(m)
    g.setTransform?.(L.dpr, 0, 0, L.dpr, 0, 0)
    g.clearRect?.(0, 0, L.w, L.h)
    const color = trackColor(idx)
    g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect?.(0, 0, L.w, L.h)
    if (roll) {
      const rows = L.hi - L.lo + 1
      for (let r = 0; r < rows; r++) {
        const midi = L.hi - r; const y = r * rowH
        g.fillStyle = MM.isBlackKey(midi) ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.05)'; g.fillRect?.(keyW, y, total * cellW, rowH - 1)
        g.fillStyle = MM.isBlackKey(midi) ? '#222' : '#ddd'; g.fillRect?.(0, y, keyW - 2, rowH - 1)
        if (midi % 12 === 0) { g.fillStyle = '#333'; g.font = '9px monospace'; g.fillText?.(MM.midiToName(midi), 2, y + rowH - 2) }
        if (midi === t.note) { g.strokeStyle = color; g.lineWidth = 1; g.strokeRect?.(keyW + 0.5, y + 0.5, total * cellW - 1, rowH - 2) }
      }
    }
    // step cells / grid lines
    for (let s = 0; s < total; s++) {
      const x = keyW + s * cellW
      if (!roll) {
        g.fillStyle = (Math.floor(s / 4) % 2) ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)'; g.fillRect?.(x + 1, 1, cellW - 2, L.h - 2)
      }
      if (s % spb === 0) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect?.(x, 0, 1, L.h) } else if (s % 4 === 0) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect?.(x, 0, 1, L.h) }
    }
    // notes
    const sel = this._sel && this._sel.trackId === t.id ? this._sel : null
    for (const e of t.steps) {
      const x = keyW + e.step * cellW
      g.globalAlpha = 0.35 + 0.65 * e.velocity
      g.fillStyle = color
      if (roll) {
        const y = (L.hi - e.midi) * rowH; if (e.midi < L.lo || e.midi > L.hi) continue
        const w = Math.max(5, Math.min(e.gate, total - e.step) * cellW - 1)
        g.fillRect?.(x + 1, y + 1, w, rowH - 2)
      } else {
        const h = Math.max(4, (L.h - 6) * (0.35 + 0.65 * e.velocity))
        g.fillRect?.(x + 2, L.h - 3 - h, cellW - 4, h)
      }
      g.globalAlpha = 1
      if (sel && sel.step === e.step && sel.midi === e.midi) {
        g.strokeStyle = '#fff'; g.lineWidth = 2
        if (roll) g.strokeRect?.(x + 1, (L.hi - e.midi) * rowH + 1, Math.max(5, Math.min(e.gate, total - e.step) * cellW - 1), rowH - 2)
        else g.strokeRect?.(x + 2, 2, cellW - 4, L.h - 4)
      }
    }
    g.globalAlpha = 1
  }

  // ── Sync (values of the controls, no rebuild) ───────────────────────────────

  _setCtl (el, v) {
    if (!el || document.activeElement === el && el.type === 'number') return
    if (el.type === 'checkbox') el.checked = !!v
    else if (String(el.value) !== String(v)) el.value = String(v)
  }

  _syncValues () {
    const m = this._music(); if (!m || !this.host) return
    this.host.querySelectorAll('[data-f]').forEach(el => {
      const k = el.dataset.f
      if (k === 'node') { if (this._nodeId) el.value = this._nodeId; return }
      if (k === 'pattern' || !has(m, k)) return
      this._setCtl(el, m[k])
    })
    for (const t of m.tracks) {
      const row = this._rowOf(t.id); if (!row) continue
      row.classList.toggle('is-muted', t.mute)
      row.querySelectorAll('[data-tf]').forEach(el => { const k = el.dataset.tf; if (k === 'name' && document.activeElement === el) return; this._setCtl(el, t[k] ?? '') })
      const mu = row.querySelector('[data-act="mute"]'); const so = row.querySelector('[data-act="solo"]')
      mu.classList.toggle('is-on', t.mute); mu.setAttribute('aria-pressed', String(t.mute)); so.classList.toggle('is-on', t.solo); so.setAttribute('aria-pressed', String(t.solo))
    }
    this._syncTransport()
  }

  _syncArmed () {
    const m = this._music(); if (!m) return
    const armed = seqOf(this)?.armedTrack(this._nodeId) ?? m.tracks[0]?.id
    this.host.querySelectorAll('.osq-track').forEach(row => { const on = row.dataset.track === armed; row.classList.toggle('is-armed', on); row.querySelector('[data-act="arm"]')?.classList.toggle('is-on', on) })
  }

  _syncNodeList () {
    const s = this.host.querySelector('[data-f="node"]'); if (!s) { this.refresh(); return }
    const ids = this._musicNodeIds()
    s.innerHTML = ids.map(id => `<option value="${esc(id)}" ${id === this._nodeId ? 'selected' : ''}>${esc(this._name(id))}</option>`).join('')
  }

  _syncTransport () {
    const m = this._music(); if (!m || !this.host) return
    const seq = seqOf(this); const mine = seq && seq.nodeId === this._nodeId && seq.state !== 'stop'
    const state = mine ? seq.state : 'stop'; const stepMode = mine && seq.mode === 'step'
    const q = (a) => this.host.querySelector(`[data-ref="transport"] [data-act="${a}"]`)
    const set = (a, on) => { const b = q(a); if (b) { b.classList.toggle('is-on', !!on); b.setAttribute('aria-pressed', String(!!on)) } }
    const playing = mine && !stepMode
    set('play', playing && state === 'play'); set('rec', mine && state === 'record' && !stepMode); set('steprec', stepMode); set('loop', m.loop); set('metro', m.metronome)
    const dis = (a, d) => { const b = q(a); if (b) b.disabled = !!d }
    dis('stop', !mine); dis('rest', !stepMode); dis('back', !stepMode)
    dis('undo', !svcOf(this)?.canUndo(this._nodeId)); dis('redo', !svcOf(this)?.canRedo(this._nodeId)); dis('undotake', !seq?.canUndoTake)
    const st = this.host.querySelector('[data-ref="status"]')
    if (st) {
      st.className = 'osq-st' + (state === 'record' ? ' is-rec' : mine ? ' is-live' : '')
      st.textContent = !mine ? `${MM.describeMusic(m)}` : stepMode ? `Step recording: step ${seq.currentStep() + 1}` : seq.countingIn ? 'Count-in…' : state === 'record' ? 'Recording…' : 'Playing'
    }
    let muted = false; try { muted = !!Settings.engineMuted() } catch (_) { muted = false }
    const mr = this.host.querySelector('[data-ref="mute"]'); if (mr) mr.hidden = !muted
  }

  _syncNoteEd () {
    const host = this.host.querySelector('[data-ref="noteed"]'); if (!host || this.compact) return
    const m = this._music(); const s = this._sel
    const t = m && s ? m.tracks.find(x => x.id === s.trackId) : null
    const e = t ? t.steps.find(x => x.step === s.step && x.midi === s.midi) : null
    if (!e) { this._sel = null; host.innerHTML = ''; return }
    const f = (k, label, min, max, step, desc) => `<label class="osq-field osq-grow"><span>${label}</span><input class="osq-range" type="range" data-ne="${k}" min="${min}" max="${max}" step="${step}" value="${e[k]}" ${tip(label, k, desc)}></label>`
    if (host.firstChild && host.dataset.key === `${s.trackId}|${s.step}|${s.midi}`) {   // same note: only move the sliders
      host.querySelectorAll('[data-ne]').forEach(el => { if (document.activeElement !== el) el.value = String(e[el.dataset.ne]) })
      return
    }
    host.dataset.key = `${s.trackId}|${s.step}|${s.midi}`
    host.innerHTML = `<div class="osq-noteed" data-testid="osq-noteed"><div class="osq-row"><b>${esc(MM.midiToName(e.midi))}</b> · step ${e.step + 1} · ${esc(t.name)}
      <button type="button" class="osq-btn" data-act="ne-play" ${tip('Hear the note', '—', 'Plays this note once with the track instrument.')}>▶</button>
      <button type="button" class="osq-btn is-danger" data-act="ne-delete" ${tip('Delete note', '—', 'Removes this note.')}>Delete</button>
      <button type="button" class="osq-btn" data-act="ne-close" ${tip('Close', '—', 'Deselects the note.')}>✕</button></div>
      <div class="osq-row">${f('velocity', 'Velocity', 0.01, 1, 0.01, 'How hard the note is played (louder and a bit brighter).')}${f('gate', 'Length', 0.05, 4, 0.05, 'How long the note is held, in steps.')}</div>
      <div class="osq-row">${f('prob', 'Chance', 0, 1, 0.05, 'The probability that the note plays on each pass (1 = always).')}${f('offset', 'Offset', -0.5, 0.5, 0.01, 'Plays the note a little early (-) or late (+), as a fraction of a step.')}</div></div>`
  }

  // ── Playhead (rAF while the view is alive) ──────────────────────────────────

  _startLoop () {
    if (this._raf || typeof requestAnimationFrame !== 'function') return
    const step = () => {
      this._raf = 0
      if (this._dead) return
      this._frame()
      this._raf = requestAnimationFrame(step)
    }
    this._raf = requestAnimationFrame(step)
  }
  _stopLoop () { if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf); this._raf = 0 }

  /** Move the playhead overlays (public: tests call it). */
  _frame () {
    if (!this.host || !this.host.isConnected || !this._lanes.size || (this.opts.active && !this.opts.active())) return
    const seq = seqOf(this); const m = this._music()
    const live = !!(seq && m && seq.nodeId === this._nodeId && seq.state !== 'stop')
    for (const L of this._lanes.values()) {
      if (!live) { if (L.head.style.display !== 'none') L.head.style.display = 'none'; continue }
      const pos = seq.getPosition()
      if (!(pos >= 0)) { L.head.style.display = 'none'; continue }
      const total = L.total; const p = seq.mode === 'step' ? pos : ((pos % total) + total) % total
      L.head.style.display = 'block'
      L.head.style.transform = `translateX(${(L.keyW + p * L.cellW).toFixed(1)}px)`
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  _rowOf (trackId) { return [...this.host.querySelectorAll('.osq-track')].find(r => r.dataset.track === trackId) ?? null }
  _trackOf (el) { return el.closest?.('[data-track]')?.dataset.track ?? null }

  _click (e) {
    const b = e.target.closest?.('[data-act]'); if (!b || b.disabled || !this.host.contains(b)) return
    this.act(b.dataset.act, this._trackOf(b), b)
  }

  /** Every button, as a method (the tests press buttons with it as well as by clicking). */
  act (act, trackId = null, el = null) {
    const svc = svcOf(this); const seq = seqOf(this); const id = this._nodeId
    const armed = () => seq?.armedTrack(id) ?? this._music()?.tracks[0]?.id
    const res = (r, ok, fail) => { if (r && r.ok === false) this.say(r.error || fail || 'That did not work.', true); else if (ok) this.say(ok); return r }
    switch (act) {
      case 'create': { const r = svc?.createMusicNode({ select: true }); if (r?.ok) { this._nodeId = r.nodeId; this.say('A music node was created in front of you.'); this.refresh() } else this.say(r?.error || 'The music system is not running.', true); return r }
      case 'enable': window.dispatchEvent(new CustomEvent('omni:sound-enable-request', { detail: {} })); return null
      case 'play': return res(seq && seq.state === 'play' && seq.nodeId === id ? seq.stop() : seq?.play(id))
      case 'stop': return res(seq?.stop())
      case 'rec': return res(seq?.record(id, { mode: 'live' }), 'Recording into the armed track (red dot). Press Rec again to finish.')
      case 'steprec': return res(seq?.record(id, { mode: 'step' }), 'Step recording: play a note for each step. Rest skips a step.')
      case 'rest': return res({ ok: seq?.stepRest() })
      case 'back': return res({ ok: seq?.stepBack() })
      case 'loop': { const m = this._music(); return res(svc?.setField(id, 'loop', !m?.loop)) }
      case 'metro': { const m = this._music(); return res(svc?.setField(id, 'metronome', !m?.metronome)) }
      case 'undo': return res(svc?.undo(id), 'Undone.')
      case 'redo': return res(svc?.redo(id), 'Redone.')
      case 'undotake': return res(seq?.undoTake(), 'The recording was taken back.')
      case 'addtrack': { const r = svc?.addTrack(id); if (r?.ok) this._expanded.add(r.trackId); return res(r, 'Track added.') }
      case 'clear': return res(svc?.clearTrack(id, armed()), 'Track cleared. Undo brings it back.')
      case 'copy': return res(svc?.copyTrack(id, armed()), 'Track copied.')
      case 'paste': return res(svc?.pasteTrack(id, armed()), 'Pasted into the armed track. Undo takes it back.')
      case 'pattern': return null
      case 'arm': { const ok = seq?.setArmed(id, trackId); this._syncArmed(); return { ok } }
      case 'mute': case 'solo': { const t = MM.findTrack(this._music(), trackId); return res(svc?.setTrackField(id, trackId, act, !t?.[act])) }
      case 'more': { if (this._expanded.has(trackId)) this._expanded.delete(trackId); else this._expanded.add(trackId); const row = this._rowOf(trackId); row?.classList.toggle('is-open', this._expanded.has(trackId)); el?.setAttribute('aria-expanded', String(this._expanded.has(trackId))); return null }
      case 'view': { const t = MM.findTrack(this._music(), trackId); return res(svc?.setTrackField(id, trackId, 'view', t?.view === 'roll' ? 'grid' : 'roll')) }
      case 'up': case 'down': return res(svc?.moveTrack(id, trackId, act === 'up' ? -1 : 1))
      case 'dup': return res(svc?.duplicateTrack(id, trackId), 'Track duplicated.')
      case 'remove': return res(svc?.removeTrack(id, trackId), 'Track removed. Undo brings it back.')
      case 'ne-delete': { const s = this._sel; if (!s) return null; this._sel = null; return res(svc?.removeEvent(id, s.trackId, s.step, s.midi)) }
      case 'ne-play': { const s = this._sel; if (s) seq?.preview(id, s.trackId, s.midi); return null }
      case 'ne-close': this._sel = null; this._syncNoteEd(); this._drawAll(); return null
      default: return null
    }
  }

  /** Sliders apply while they move; number boxes apply when the person finishes typing (a half-typed 1 must not become 20 bpm on the way to 120). */
  _input (e) {
    const el = e.target; const svc = svcOf(this); const id = this._nodeId; if (!svc || !id || !el.dataset) return
    if (el.type !== 'range') return
    if (el.dataset.f && el.dataset.f !== 'node' && el.dataset.f !== 'pattern') {
      this._applyField(el.dataset.f, Number(el.value), el)
    } else if (el.dataset.tf) {
      const r = svc.setTrackField(id, this._trackOf(el), el.dataset.tf, Number(el.value)); if (!r.ok) this.say(r.error, true)
    } else if (el.dataset.ne && this._sel) {
      const s = this._sel
      const r = svc.setEvent(id, s.trackId, { step: s.step, midi: s.midi, ...this._selEvent(), [el.dataset.ne]: Number(el.value) }, 'ne:' + el.dataset.ne); if (!r.ok) this.say(r.error, true)
    }
  }
  _applyField (key, value, el) {
    const r = svcOf(this).setField(this._nodeId, key, value)
    if (!r.ok) { this.say(r.error, true); return r }
    this.host.querySelectorAll(`[data-f="${key}"]`).forEach(o => { if (o !== el || el.type === 'number') o.value = String(r.value) })
    if (r.lost) this.say(`${r.lost} note${r.lost === 1 ? ' was' : 's were'} beyond the new length and were cut off. Undo brings them back.`, true)
    return r
  }
  _selEvent () { const m = this._music(); const s = this._sel; const t = m && s && m.tracks.find(x => x.id === s.trackId); return t?.steps.find(x => x.step === s.step && x.midi === s.midi) ?? {} }

  _change (e) {
    const el = e.target; const svc = svcOf(this); const id = this._nodeId; if (!svc || !el.dataset) return
    const f = el.dataset.f; const tf = el.dataset.tf
    if (f === 'node') { this._nodeId = el.value; this._sel = null; this.refresh(); return }
    if (f === 'pattern') { const p = el.value; el.value = ''; if (!p) return; const armed = seqOf(this)?.armedTrack(id) ?? this._music()?.tracks[0]?.id; const r = svc.applyPattern(id, armed, p); this.say(r.ok ? `Pattern "${MM.PATTERNS[p].label}" written to the armed track. Undo takes it back.` : r.error, !r.ok); return }
    if (f && el.type === 'number') { if (el.value !== '' && Number.isFinite(Number(el.value))) this._applyField(f, Number(el.value), el); else this._syncValues(); return }
    if (f && el.type === 'checkbox') { const r = svc.setField(id, f, el.checked); if (!r.ok) this.say(r.error, true); return }
    if (f && el.tagName === 'SELECT') { const r = svc.setField(id, f, el.value); if (!r.ok) this.say(r.error, true); return }
    if (tf && el.type !== 'range') {
      const tid = this._trackOf(el); let v = el.value
      if (tf === 'note') v = Number(v)
      const r = svc.setTrackField(id, tid, tf, v)
      if (!r.ok) { this.say(r.error, true); this._syncValues(); return }
      if (tf === 'note') seqOf(this)?.preview(id, tid, Number(v))
      if (tf === 'note' || tf === 'instrumentNodeId') this._later('refresh', () => { this._ranges.delete(tid); this.refresh() })
    }
  }

  // ── Pointer (lanes) ─────────────────────────────────────────────────────────

  _hit (canvas, e) {
    const L = this._lanes.get(canvas.dataset.track); if (!L) return null
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left; const y = e.clientY - r.top
    const step = Math.floor((x - L.keyW) / L.cellW)
    if (x < L.keyW || step < 0 || step >= L.total) return { L, x, y, step: -1 }
    const midi = L.roll ? clamp(L.hi - Math.floor(y / L.rowH), 0, 127) : null
    return { L, x, y, step, midi }
  }

  _down (e) {
    const canvas = e.target.closest?.('canvas[data-track]'); if (!canvas || !this.host.contains(canvas)) return
    if (e.button != null && e.button > 0) return
    const svc = svcOf(this); const id = this._nodeId; const m = this._music(); if (!svc || !m) return
    const tid = canvas.dataset.track; const t = m.tracks.find(x => x.id === tid); if (!t) return
    const hit = this._hit(canvas, e); if (!hit || hit.step < 0) return
    try { canvas.setPointerCapture?.(e.pointerId) } catch (_) { /* synthetic event */ }
    try { canvas.focus?.({ preventScroll: true }) } catch (_) { /* ignore */ }
    seqOf(this)?.setArmed?.(id, tid)   // working on a lane arms its track
    const L = hit.L
    const here = L.roll ? t.steps.find(x => x.step === hit.step && x.midi === hit.midi) : null
    const atStep = L.roll ? (here ? [here] : []) : MM.eventsAtStep(t, hit.step)
    const d = this._drag = { tid, canvas, L, x0: e.clientX, y0: e.clientY, mode: atStep.length ? 'pending' : 'add', visited: new Set([hit.step + ':' + hit.midi]), vel0: atStep[0]?.velocity ?? 0.8, gate0: here?.gate ?? 0.9, step0: hit.step, midi0: hit.midi, pid: e.pointerId, timer: null, moved: false }
    const move = (ev) => this._move(ev); const up = (ev) => this._up(ev)
    d.cleanup = () => { canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); window.removeEventListener('pointerup', up) }
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); window.addEventListener('pointerup', up)
    if (d.mode === 'add') {
      svc.beginStroke(id)
      this._addAt(t, hit, true)
    } else if (L.roll) {
      this._sel = { trackId: tid, step: hit.step, midi: hit.midi }; this._syncNoteEd(); this._drawAll()
      d.mode = 'gate'
    } else {
      d.timer = setTimeout(() => {   // long press: velocity mode, the note is selected
        if (!this._drag || this._drag !== d || d.moved) return
        d.mode = 'vel'; d.timer = null
        this._sel = { trackId: tid, step: hit.step, midi: atStep[0].midi }; this._syncNoteEd(); this._drawAll()
        this.say('Drag up or down to set the velocity.')
      }, LONG_PRESS_MS)
    }
  }

  _addAt (t, hit, first = false) {
    const svc = svcOf(this); const id = this._nodeId
    const midi = hit.L.roll ? hit.midi : t.note
    const r = svc.setEvent(id, t.id, { step: hit.step, midi, velocity: 0.8, gate: hit.L.roll ? 1 : 0.9 })
    if (r.ok && hit.L.roll) { this._sel = { trackId: t.id, step: hit.step, midi }; if (first) seqOf(this)?.preview(id, t.id, midi) ; this._syncNoteEd() }
    return r
  }

  _move (e) {
    const d = this._drag; if (!d || e.pointerId !== d.pid && d.pid != null && e.pointerId != null) return
    const svc = svcOf(this); const id = this._nodeId; const m = this._music(); if (!m) return
    const t = m.tracks.find(x => x.id === d.tid); if (!t) return
    const dx = e.clientX - d.x0; const dy = e.clientY - d.y0
    const hit = this._hit(d.canvas, e)
    if (d.mode === 'pending') {
      if (Math.abs(dy) >= 4 && Math.abs(dy) >= Math.abs(dx)) { d.mode = 'vel'; d.moved = true; clearTimeout(d.timer); const e0 = MM.eventsAtStep(t, d.step0)[0]; if (e0) { this._sel = { trackId: d.tid, step: d.step0, midi: e0.midi }; this._syncNoteEd() } }
      else if (Math.abs(dx) >= d.L.cellW * 0.6) { d.mode = 'erase'; d.moved = true; clearTimeout(d.timer); svc.beginStroke(id); svc.removeEvent(id, d.tid, d.step0, null); d.visited.add(d.step0 + ':' + d.midi0) }   // and carry on with the step under the pointer
      else return
    }
    if (d.mode === 'vel') {
      svc.beginStroke(id)
      const v = clamp(d.vel0 - dy / 70, 0.05, 1)
      for (const ev of MM.eventsAtStep(t, d.step0)) svc.setEvent(id, d.tid, { ...ev, velocity: v })
      this.say(`Velocity ${Math.round(v * 100)}%`)
      return
    }
    if (d.mode === 'gate') {
      if (!hit) return
      const g = clamp(Math.round(((hit.x - d.L.keyW) / d.L.cellW - d.step0) * 4) / 4, 0.25, 4)
      const ev = t.steps.find(x => x.step === d.step0 && x.midi === d.midi0)
      if (ev && Math.abs(ev.gate - g) > 1e-6) { d.moved = true; svc.beginStroke(id); svc.setEvent(id, d.tid, { ...ev, gate: g }) }
      return
    }
    if (!hit || hit.step < 0) return
    const key = hit.step + ':' + hit.midi
    if (d.visited.has(key)) return
    d.visited.add(key)
    if (d.mode === 'add') this._addAt(t, hit)
    else if (d.mode === 'erase') svc.removeEvent(id, d.tid, hit.step, null)
  }

  _up () {
    const d = this._drag; if (!d) return
    this._drag = null; clearTimeout(d.timer); d.cleanup?.()
    const svc = svcOf(this); const id = this._nodeId
    if (d.mode === 'pending') {   // a plain tap on a note in a grid lane switches it off
      const r = svc.removeEvent(id, d.tid, d.step0, null); if (!r.ok) this.say(r.error, true)
    }
    svc.endStroke()
    this._later('draw', () => { this._drawAll(); this._syncNoteEd() })
  }

  _key (e) {
    const canvas = e.target.closest?.('canvas[data-track]'); if (!canvas) return
    const svc = svcOf(this); const id = this._nodeId; const m = this._music(); if (!svc || !m) return
    const tid = canvas.dataset.track; const t = m.tracks.find(x => x.id === tid); const L = this._lanes.get(tid); if (!t || !L) return
    const cur = this._kb && this._kb.tid === tid ? this._kb : (this._kb = { tid, step: 0, midi: t.note })
    const k = e.key
    if (k === 'ArrowRight') cur.step = Math.min(L.total - 1, cur.step + 1)
    else if (k === 'ArrowLeft') cur.step = Math.max(0, cur.step - 1)
    else if (k === 'ArrowUp' && L.roll) cur.midi = Math.min(127, cur.midi + 1)
    else if (k === 'ArrowDown' && L.roll) cur.midi = Math.max(0, cur.midi - 1)
    else if (k === 'Enter' || k === ' ') { svc.toggleStep(id, tid, cur.step, L.roll ? cur.midi : t.note); e.preventDefault(); return }
    else if ((k === 'Delete' || k === 'Backspace') && this._sel) { this.act('ne-delete'); e.preventDefault(); return }
    else return
    e.preventDefault()
    this._sel = { trackId: tid, step: cur.step, midi: L.roll ? cur.midi : (MM.eventsAtStep(t, cur.step)[0]?.midi ?? t.note) }
    const has1 = t.steps.some(x => x.step === this._sel.step && x.midi === this._sel.midi)
    if (!has1) { this.say(`Step ${cur.step + 1}${L.roll ? ' · ' + MM.midiToName(cur.midi) : ''}: Enter adds a note.`); this._sel = null }
    this._syncNoteEd(); this._drawAll()
  }
}

export { NAV_ITEM }
