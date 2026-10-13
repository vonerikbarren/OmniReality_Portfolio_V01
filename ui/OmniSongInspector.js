/**
 * ui/OmniSongInspector.js — the Inspector block of a SongNode (V198), shown in Appearance next to the other kinds' blocks (ui/OmniExtraKindInspector.js).
 *
 * songKindBlockHTML / wireSongKindBlock: a state line (bars, bpm, lanes, clips; "Playing"), Play / Pause, Stop, Loop, the base TEMPO (slider + number, applied live), the LENGTH in
 * bars and 'Open song editor' (⟐OmniSong). Everything is read and written through Extra.SERVICES.song (systems/OmniSongNodes.js), so this file imports no system.
 * User-facing: imports no Dev* module.
 */

import { SERVICES } from '../utils/OmniExtraKinds.js'
import { esc, tip as tip3 } from './OmniSoundFields.js'
const tip = (name, desc) => tip3(name, '—', desc)

const NAV_ITEM = '⟐OmniSong'
const STYLES = `
.oisg-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.oisg-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.oisg-row .oi-btn-small.is-on { background: rgba(122,215,240,.32); }
.oisg-row .oisg-in { flex: 0 0 64px; min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.oisg-row input[type=range] { flex: 1 1 100px; min-width: 60px; }
.oisg-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.oisg-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .oisg-msg.is-err { color: #ff9c9c; }
@media (max-width: 700px) { .oisg-row .oi-btn-small, .oisg-row .oisg-in { min-height: 40px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oisg-styles')) return
  const s = document.createElement('style'); s.id = 'oisg-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const svc = () => SERVICES.song
const openEditor = () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } }))

export function describeSong (s) {
  if (!s) return 'This node has no song.'
  const n = (v, one, many) => `${v} ${v === 1 ? one : many}`
  return `${n(s.lengthBars, 'bar', 'bars')}, ${Math.round(s.bpm)} bpm, ${n(s.lanes.length, 'lane', 'lanes')}, ${n(s.clips.length, 'clip', 'clips')}.`
}
function stateText (id) {
  const s = svc(); if (!s) return 'The song system is not running.'
  const song = s.getSong(id); if (!song) return 'This node has no song.'
  return s.isPlaying(id) ? 'Playing. ' + describeSong(song) : describeSong(song)
}

/** Run one action; returns { ok, text }. Exported so the tests call the same code the buttons do. */
export function runSongAction (act, id) {
  const s = svc()
  if (!s) return { ok: false, text: 'The song system is not running.' }
  const song = s.getSong(id); if (!song) return { ok: false, text: 'This node has no song.' }
  switch (act) {
    case 'play': { const was = s.isPlaying(id); s.transport('toggle', id); return { ok: true, text: was ? 'Paused.' : 'Playing.' } }
    case 'stop': s.transport('stop', id); return { ok: true, text: 'Stopped.' }
    case 'loop': { const r = s.edit(id, 'loop', (x) => ({ ...x, loop: { ...x.loop, on: !x.loop.on } })); return r.ok ? { ok: true, text: r.song.loop.on ? 'Loop on.' : 'Loop off.' } : { ok: false, text: r.error } }
    case 'open': openEditor(); return { ok: true, text: 'Opening the song editor…' }
    default: return { ok: false, text: 'Unknown action.' }
  }
}

export function songKindBlockHTML (data) {
  injectStyles(); bindLive()
  const s = svc()?.getSong(data.id)
  const playing = !!svc()?.isPlaying(data.id)
  return `<div class="oi-custom-section" id="oi-custom-song" data-oisg-root data-kind="songNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Song node</div>
    <div class="oisg-row"><span class="oisg-note" style="margin:0;flex:1 1 100%" data-testid="oisg-state">${esc(stateText(data.id))}</span></div>
    <div class="oisg-row"><span class="oi-label">Tempo</span>
      <input type="range" data-oisg="bpm" min="60" max="240" step="1" value="${Math.round(s?.bpm ?? 120)}" aria-label="Tempo" ${tip('Tempo', 'The base speed of the song in beats per minute (60 to 240). Tempo changes along the song are set in the song editor.')}>
      <input class="oisg-in" type="number" data-oisg="bpm" min="60" max="240" step="1" value="${Math.round(s?.bpm ?? 120)}" aria-label="Tempo in bpm" ${tip('Tempo (bpm)', 'The base speed of the song in beats per minute (60 to 240).')}></div>
    <div class="oisg-row"><span class="oi-label">Length</span>
      <input class="oisg-in" type="number" data-oisg="len" min="4" max="256" step="1" value="${s?.lengthBars ?? 32}" aria-label="Length in bars" ${tip('Length (bars)', 'How many bars the song lasts (4 to 256).')}><span class="oisg-note" style="margin:0">bars</span></div>
    <div class="oisg-row" data-ref="oisg-buttons">
      <button class="oi-btn-small ${playing ? 'is-on' : ''}" data-oisga="play" ${tip(playing ? 'Pause' : 'Play', playing ? 'Pauses the song.' : 'Plays the song of this node: every lane and clip.')}>${playing ? '⏸ Pause' : '▶ Play'}</button>
      <button class="oi-btn-small" data-oisga="stop" ${tip('Stop', 'Stops the song and returns to the start.')}>■ Stop</button>
      <button class="oi-btn-small ${s?.loop?.on ? 'is-on' : ''}" data-oisga="loop" aria-pressed="${!!s?.loop?.on}" ${tip('Loop', 'On: the loop region of the song repeats. Off: the song plays once.')}>⟳ Loop</button>
      <button class="oi-btn-small" data-oisga="open" ${tip('Open song editor', 'Opens ⟐OmniSong: the timeline with lanes, clips, sections, the mixer and automation of this node.')}>⚙ Open song editor</button></div>
    <div class="oisg-msg" role="status" aria-live="polite" data-ref="oisg-msg"></div>
    <div class="oisg-note">A song node arranges music nodes and audio clips on a timeline and mixes them. Its record lights the playing part. The song lives in the node and is saved with it.</div>
  </div>`
}

export function wireSongKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-song')
  if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-oisga]'); if (!b || b.disabled) return
    const r = runSongAction(b.dataset.oisga, data.id)
    say(sec, r); setTimeout(() => refreshLive(sec), 0)
  })
  const set = (e) => {
    const el = e.target; const k = el.dataset?.oisg; if (!k || el.value === '' || !Number.isFinite(Number(el.value))) return
    const v = Number(el.value)
    const r = svc()?.edit(data.id, 'field', (x) => (k === 'bpm' ? { ...x, bpm: v } : { ...x, lengthBars: Math.round(v) }), 'field:' + k)
    if (r?.ok) refreshLive(sec, el); else say(sec, { ok: false, text: r?.error || 'The song system is not running.' })
  }
  sec.addEventListener('input', (e) => { if (e.target.type === 'range') set(e) })
  sec.addEventListener('change', (e) => { if (e.target.type === 'number') set(e) })
}

function say (root, r) {
  const m = root.querySelector('[data-ref="oisg-msg"]'); if (!m) return
  m.textContent = r.text; m.className = 'oisg-msg' + (r.ok ? '' : ' is-err')
}

/** Update the buttons and the state line inside one root without rebuilding it. */
function refreshLive (root, skip = null) {
  const id = root.dataset.nodeId; const s = svc(); if (!id || !s) return
  const song = s.getSong(id); if (!song) return
  const playing = s.isPlaying(id)
  const play = root.querySelector('[data-oisga="play"]')
  if (play) { play.classList.toggle('is-on', playing); play.textContent = playing ? '⏸ Pause' : '▶ Play' }
  const lp = root.querySelector('[data-oisga="loop"]'); if (lp) { lp.classList.toggle('is-on', !!song.loop.on); lp.setAttribute('aria-pressed', String(!!song.loop.on)) }
  const st = root.querySelector('[data-testid="oisg-state"]'); if (st) st.textContent = stateText(id)
  root.querySelectorAll('[data-oisg="bpm"]').forEach(el => { if (el !== skip && document.activeElement !== el) el.value = String(Math.round(song.bpm)) })
  root.querySelectorAll('[data-oisg="len"]').forEach(el => { if (el !== skip && document.activeElement !== el) el.value = String(song.lengthBars) })
}

let LIVE_BOUND = false
function bindLive () {
  if (LIVE_BOUND || typeof window === 'undefined') return
  LIVE_BOUND = true
  const h = () => { if (typeof document !== 'undefined') document.querySelectorAll('[data-oisg-root][data-node-id]').forEach(r => refreshLive(r)) }
  window.addEventListener('omni:song-transport', h)
  window.addEventListener('omni:song-changed', h)
}
