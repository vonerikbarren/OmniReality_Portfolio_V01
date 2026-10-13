/**
 * ui/OmniMusicInspector.js — the Inspector block of a MusicNode (V195), shown in Appearance next to the other kinds' blocks (ui/OmniExtraKindInspector.js).
 *
 * musicKindBlockHTML / wireMusicKindBlock: a state line (tempo, steps, tracks, notes; "Playing" / "Recording"), the TEMPO (slider + number, applied live), Play / Stop,
 * Record, Loop, Metronome and 'Open sequencer' (⟐OmniSequencer). Everything is read and written through Extra.SERVICES.music (systems/OmniMusicNodes.js) and
 * Extra.SERVICES.sequencer (systems/OmniSequencer.js), so this file imports no system. User-facing: imports no Dev* module.
 */

import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as MM from '../utils/OmniMusicModel.js'
import { esc, tip as tip3 } from './OmniSoundFields.js'
const tip = (name, desc) => tip3(name, '—', desc)

const NAV_ITEM = '⟐OmniSequencer'
const STYLES = `
.oim-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.oim-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.oim-row .oi-btn-small.is-on { background: rgba(255,184,107,.32); }
.oim-row .oim-in { flex: 0 0 64px; min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.oim-row input[type=range] { flex: 1 1 100px; min-width: 60px; }
.oim-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.oim-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .oim-msg.is-err { color: #ff9c9c; }
@media (max-width: 700px) { .oim-row .oi-btn-small, .oim-row .oim-in { min-height: 40px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oim-styles')) return
  const s = document.createElement('style'); s.id = 'oim-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const svc = () => SERVICES.music
const seq = () => SERVICES.sequencer
const openSeq = () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } }))

function stateText (id) {
  const s = svc(); const q = seq()
  if (!s) return 'The music system is not running.'
  const m = s.getMusic(id); if (!m) return 'This node has no pattern.'
  const mine = q && q.nodeId === id && q.state !== 'stop'
  if (mine && q.state === 'record') return q.countingIn ? 'Count-in…' : (q.mode === 'step' ? 'Step recording…' : 'Recording…')
  if (mine) return 'Playing.'
  return MM.describeMusic(m)
}

/** Run one action; returns { ok, text }. Exported so the tests call the same code the buttons do. */
export function runMusicAction (act, id) {
  const q = seq(); const s = svc()
  if (!q || !s) return { ok: false, text: 'The music system is not running.' }
  const fail = (r) => ({ ok: false, text: r?.error || 'That did not work.' })
  switch (act) {
    case 'play': { const r = q.state !== 'stop' && q.nodeId === id ? q.stop() : q.play(id); return r.ok ? { ok: true, text: r.state === 'stop' ? 'Stopped.' : 'Playing.' } : fail(r) }
    case 'stop': q.stop(); return { ok: true, text: 'Stopped.' }
    case 'rec': { const r = q.record(id, { mode: 'live' }); return r.ok ? { ok: true, text: r.state === 'record' ? 'Recording into the armed track.' : 'Recording finished.' } : fail(r) }
    case 'loop': { const m = s.getMusic(id); const r = s.setField(id, 'loop', !m?.loop); return r.ok ? { ok: true, text: r.value ? 'Loop on.' : 'Loop off.' } : fail(r) }
    case 'metro': { const m = s.getMusic(id); const r = s.setField(id, 'metronome', !m?.metronome); return r.ok ? { ok: true, text: r.value ? 'Metronome on.' : 'Metronome off.' } : fail(r) }
    case 'open': openSeq(); return { ok: true, text: 'Opening the sequencer…' }
    default: return { ok: false, text: 'Unknown action.' }
  }
}

export function musicKindBlockHTML (data) {
  injectStyles(); bindLive()
  const m = svc()?.getMusic(data.id)
  const q = seq(); const mine = !!(q && q.nodeId === data.id && q.state !== 'stop')
  return `<div class="oi-custom-section" id="oi-custom-music" data-oim-root data-kind="musicNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">♫ Music node</div>
    <div class="oim-row"><span class="oim-note" style="margin:0;flex:1 1 100%" data-testid="oim-state">${esc(stateText(data.id))}</span></div>
    <div class="oim-row"><span class="oi-label">Tempo</span>
      <input type="range" data-oim="tempo" min="${MM.LIMITS.tempoMin}" max="${MM.LIMITS.tempoMax}" step="1" value="${m?.tempo ?? 120}" aria-label="Tempo" ${tip('Tempo', 'Speed in beats per minute (20 to 300). Heard at once while playing.')}>
      <input class="oim-in" type="number" data-oim="tempo" min="${MM.LIMITS.tempoMin}" max="${MM.LIMITS.tempoMax}" step="1" value="${m?.tempo ?? 120}" aria-label="Tempo in bpm" ${tip('Tempo (bpm)', 'Speed in beats per minute (20 to 300).')}></div>
    <div class="oim-row" data-ref="oim-buttons">
      <button class="oi-btn-small ${mine && q.state === 'play' ? 'is-on' : ''}" data-oima="play" ${tip(mine && q.state === 'play' ? 'Stop' : 'Play', mine && q.state === 'play' ? 'Stops the pattern.' : 'Plays the pattern of this music node from the start.')}>${mine && q.state === 'play' ? '■ Stop' : '▶ Play'}</button>
      <button class="oi-btn-small ${mine && q.state === 'record' ? 'is-on' : ''}" data-oima="rec" ${tip('Record', 'Records what you play on the keys / MIDI into the armed track after the count-in. Press again to finish.')}>● Record</button>
      <button class="oi-btn-small ${m?.loop ? 'is-on' : ''}" data-oima="loop" aria-pressed="${!!m?.loop}" ${tip('Loop', 'On: the pattern repeats. Off: it plays once.')}>⟳ Loop</button>
      <button class="oi-btn-small ${m?.metronome ? 'is-on' : ''}" data-oima="metro" aria-pressed="${!!m?.metronome}" ${tip('Metronome', 'A click on every beat while playing.')}>◔ Click</button>
      <button class="oi-btn-small" data-oima="open" ${tip('Open sequencer', 'Opens ⟐OmniSequencer: the step grid, piano roll, tracks, instruments and presets of this node.')}>⚙ Open sequencer</button></div>
    <div class="oim-msg" role="status" aria-live="polite" data-ref="oim-msg"></div>
    <div class="oim-note">A music node is a step sequencer you can place. Its plate lights the playing step. The pattern lives in the node and is saved with it.</div>
  </div>`
}

export function wireMusicKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-music')
  if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-oima]'); if (!b || b.disabled) return
    const r = runMusicAction(b.dataset.oima, data.id)
    say(sec, r); refreshLive(sec)
  })
  // the slider applies while it moves; the number box when the person finishes typing (a half-typed 1 must not become 20 bpm on the way to 120)
  const setTempo = (e) => {
    const el = e.target; if (el.dataset?.oim !== 'tempo' || el.value === '' || !Number.isFinite(Number(el.value))) return
    const r = svc()?.setField(data.id, 'tempo', Number(el.value))
    if (r?.ok) sec.querySelectorAll('[data-oim="tempo"]').forEach(o => { o.value = String(r.value) }); else say(sec, { ok: false, text: r?.error || 'The music system is not running.' })
  }
  sec.addEventListener('input', (e) => { if (e.target.type === 'range') setTempo(e) })
  sec.addEventListener('change', (e) => { if (e.target.type === 'number') setTempo(e) })
}

function say (root, r) {
  const m = root.querySelector('[data-ref="oim-msg"]'); if (!m) return
  m.textContent = r.text; m.className = 'oim-msg' + (r.ok ? '' : ' is-err')
}

/** Update the buttons and the state line inside one root without rebuilding it. */
function refreshLive (root) {
  const id = root.dataset.nodeId; const s = svc(); const q = seq(); if (!id || !s) return
  const m = s.getMusic(id); if (!m) return
  const mine = !!(q && q.nodeId === id && q.state !== 'stop')
  const set = (a, on, label) => { const b = root.querySelector(`[data-oima="${a}"]`); if (!b) return; b.classList.toggle('is-on', !!on); if (label) b.textContent = label }
  set('play', mine && q.state === 'play', mine && q.state === 'play' ? '■ Stop' : '▶ Play'); set('rec', mine && q.state === 'record'); set('loop', m.loop); set('metro', m.metronome)
  const st = root.querySelector('[data-testid="oim-state"]'); if (st) st.textContent = stateText(id)
  root.querySelectorAll('[data-oim="tempo"]').forEach(el => { if (document.activeElement !== el) el.value = String(m.tempo) })
}

let LIVE_BOUND = false
function bindLive () {
  if (LIVE_BOUND || typeof window === 'undefined') return
  LIVE_BOUND = true
  const h = () => { if (typeof document !== 'undefined') document.querySelectorAll('[data-oim-root][data-node-id]').forEach(refreshLive) }
  window.addEventListener('omni:music-transport', h)
  window.addEventListener('omni:music-data-changed', h)
}
