/**
 * ui/OmniMixInspector.js — the Inspector block of an OmniMusicMixNode (V201), shown in Appearance next to the other kinds' blocks (ui/OmniExtraKindInspector.js).
 * A state line (strips, tempo, automation lanes; "Playing"), Play / Stop, Record, the mix tempo and 'Open mixer' (⟐OmniMix). Everything is read and written through
 * Extra.SERVICES.mix (systems/OmniMixNodes.js), so this file imports no system. User-facing: imports no Dev* module.
 */

import { SERVICES } from '../utils/OmniExtraKinds.js'
import { esc } from './OmniSoundFields.js'

const NAV_ITEM = '⟐OmniMix'
const svc = () => SERVICES.mix
const STYLES = `
.oimx-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.oimx-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.oimx-row .oi-btn-small.is-on { background: rgba(255,180,90,.34); }
.oimx-row .oimx-in { flex: 0 0 64px; min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.oimx-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.oimx-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .oimx-msg.is-err { color: #ff9c9c; }
@media (max-width: 700px) { .oimx-row .oi-btn-small, .oimx-row .oimx-in { min-height: 40px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oimx-styles')) return
  const s = document.createElement('style'); s.id = 'oimx-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const openMixer = () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } }))

export function describeMix (m) {
  if (!m) return 'This node has no mix.'
  const n = (v, one, many) => `${v} ${v === 1 ? one : many}`
  return `${n(m.strips.length, 'strip', 'strips')}, ${Math.round(m.bpm)} bpm, ${n(m.automation.length, 'automation lane', 'automation lanes')}.`
}
function stateText (id) {
  const s = svc(); if (!s) return 'The mix system is not running.'
  const m = s.getMix(id); if (!m) return 'This node has no mix.'
  return s.isPlaying(id) ? 'Playing. ' + describeMix(m) : describeMix(m)
}

/** Run one action; returns { ok, text }. Exported so the tests call the same code the buttons do. */
export function runMixAction (act, id) {
  const s = svc()
  if (!s) return { ok: false, text: 'The mix system is not running.' }
  const m = s.getMix(id); if (!m) return { ok: false, text: 'This node has no mix.' }
  switch (act) {
    case 'play': { const was = s.isPlaying(id); const r = s.transport('toggle', id); if (r && r.ok === false) return { ok: false, text: r.error || 'Could not play.' }; return { ok: true, text: was ? 'Stopped.' : 'Playing.' } }
    case 'stop': s.transport('stop', id); return { ok: true, text: 'Stopped.' }
    case 'rec': { const on = s.setRecording(!s.recording); return { ok: true, text: on ? 'Recording: fader moves while it plays are saved as automation.' : 'Recording off.' } }
    case 'open': openMixer(); return { ok: true, text: 'Opening the mixer…' }
    default: return { ok: false, text: 'Unknown action.' }
  }
}

export function mixKindBlockHTML (data) {
  injectStyles(); bindLive()
  const m = svc()?.getMix(data.id)
  const playing = !!svc()?.isPlaying(data.id)
  const rec = !!svc()?.recording
  return `<div class="oi-custom-section" id="oi-custom-mix" data-oimx-root data-kind="mixNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Mix node</div>
    <div class="oimx-row"><span class="oimx-note" style="margin:0;flex:1 1 100%" data-testid="oimx-state">${esc(stateText(data.id))}</span></div>
    <div class="oimx-row"><span class="oi-label">Tempo</span><input class="oimx-in" type="number" data-oimx="bpm" min="40" max="240" step="1" value="${Math.round(m?.bpm ?? 120)}" aria-label="Mix tempo in bpm"></div>
    <div class="oimx-row">
      <button class="oi-btn-small ${playing ? 'is-on' : ''}" data-oimxa="play">${playing ? '■ Stop' : '▶ Play'}</button>
      <button class="oi-btn-small ${rec ? 'is-on' : ''}" data-oimxa="rec" aria-pressed="${rec}">● Record</button>
      <button class="oi-btn-small" data-oimxa="open">⚙ Open mixer</button></div>
    <div class="oimx-msg" role="status" aria-live="polite" data-ref="oimx-msg"></div>
    <div class="oimx-note">A mix node is a mixing desk with DJ behaviour: strips play songs, sounds and audio clips; a crossfader and DJ moves are saved as automation. The desk lives in the node and is saved with it.</div>
  </div>`
}

export function wireMixKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-mix')
  if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-oimxa]'); if (!b || b.disabled) return
    const r = runMixAction(b.dataset.oimxa, data.id)
    say(sec, r); setTimeout(() => refreshLive(sec), 0)
  })
  sec.addEventListener('change', (e) => {
    const el = e.target; if (el.dataset?.oimx !== 'bpm' || !Number.isFinite(Number(el.value))) return
    const r = svc()?.edit(data.id, 'bpm', (x) => ({ ...x, bpm: Number(el.value) }), 'field:bpm')
    if (r?.ok) refreshLive(sec, el); else say(sec, { ok: false, text: r?.error || 'The mix system is not running.' })
  })
}

function say (root, r) {
  const m = root.querySelector('[data-ref="oimx-msg"]'); if (!m) return
  m.textContent = r.text; m.className = 'oimx-msg' + (r.ok ? '' : ' is-err')
}
function refreshLive (root, skip = null) {
  const id = root.dataset.nodeId; const s = svc(); if (!id || !s) return
  const m = s.getMix(id); if (!m) return
  const playing = s.isPlaying(id)
  const play = root.querySelector('[data-oimxa="play"]'); if (play) { play.classList.toggle('is-on', playing); play.textContent = playing ? '■ Stop' : '▶ Play' }
  const rec = root.querySelector('[data-oimxa="rec"]'); if (rec) { rec.classList.toggle('is-on', !!s.recording); rec.setAttribute('aria-pressed', String(!!s.recording)) }
  const st = root.querySelector('[data-testid="oimx-state"]'); if (st) st.textContent = stateText(id)
  root.querySelectorAll('[data-oimx="bpm"]').forEach(el => { if (el !== skip && document.activeElement !== el) el.value = String(Math.round(m.bpm)) })
}

let LIVE_BOUND = false
function bindLive () {
  if (LIVE_BOUND || typeof window === 'undefined') return
  LIVE_BOUND = true
  const h = () => { if (typeof document !== 'undefined') document.querySelectorAll('[data-oimx-root][data-node-id]').forEach(r => refreshLive(r)) }
  window.addEventListener('omni:mix-transport', h)
  window.addEventListener('omni:mix-changed', h)
}
