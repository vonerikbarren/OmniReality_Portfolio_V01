/**
 * ui/OmniSoundInspector.js — the Inspector side of sound (V194).
 *
 *   soundSectionHTML / wireSoundSection   the 'Sound' section that EVERY node has (systems/OmniInspector.js, id 'sound'): the on / off switch, the Presets menu, a few
 *                                         quick controls (note, dynamic, volume, loop, spatial: found in the schema by ui/OmniSoundFields.js findQuick), Play / Stop,
 *                                         the speaker (mute) and 'Open sound settings' (⟐SoundNodeSettings). A node that never had sound shows only the switch; the
 *                                         first switch-on creates data.sound with defaultSound() (systems/OmniSoundNodes.js ensureSound). Nothing else about the node changes.
 *   soundKindBlockHTML / wireSoundKindBlock  the short block a SoundNode shows in Appearance (next to the other kinds' blocks): state, Play / Stop, speaker, Open sound settings.
 *
 * Everything is read and written through Extra.SERVICES.sound (the systems/OmniSoundNodes.js instance), so this file imports no system.
 * User-facing: imports no Dev* module.
 */

import { SOUND_SCHEMA, SOUND_PRESETS } from '../utils/OmniSoundModel.js'
import { PARTICLE_SCHEMA } from '../utils/OmniSoundParticleModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as Settings from '../utils/OmniSoundSettings.js'
import { esc, tip, findQuick, fieldHTML, wireFields, FIELD_STYLES } from './OmniSoundFields.js'

const NAV_ITEM = '⟐SoundNodeSettings'
const STYLES = `${FIELD_STYLES}
.ois-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.ois-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.ois-row .oi-btn-small.is-on { background: rgba(127,214,255,.3); }
.ois-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.ois-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .ois-msg.is-err { color: #ff9c9c; }
.ois-select { flex: 1 1 120px; min-width: 0; min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.ois-select option { color: #111; background: #fff; }
@media (max-width: 700px) { .ois-row .oi-btn-small, .ois-select { min-height: 40px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('ois-styles')) return
  const s = document.createElement('style'); s.id = 'ois-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const SCHEMAS = { sound: SOUND_SCHEMA, particles: PARTICLE_SCHEMA }
const svc = () => SERVICES.sound
const open = () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } }))

const speakerHTML = () => {
  const m = Settings.engineMuted()
  return `<button class="oi-btn-small ${m ? 'is-on' : ''}" data-ois="mute" aria-pressed="${m}" ${tip(m ? 'Unmute' : 'Mute', '—', 'The speaker: mutes or unmutes ALL sound (the global switch, also in Admin > UI Settings > Sound).')}>${m ? '🔇 Unmute' : '🔊 Mute'}</button>`
}
const playHTML = (id) => {
  const p = !!svc()?.isPlaying(id)
  return `<button class="oi-btn-small" data-ois="${p ? 'stop' : 'play'}" ${tip(p ? 'Stop' : 'Play', '—', p ? 'Stops the sound of this node.' : 'Plays the sound of this node.')}>${p ? '■ Stop' : '▶ Play'}</button>`
}

/** Run one action; returns { ok, text }. Exported so the tests call the same code the buttons do. */
export function runSoundAction (act, id) {
  const s = svc()
  if (!s) return { ok: false, text: 'The sound system is not running.' }
  switch (act) {
    case 'enable': s.setEnabled(id, true); return { ok: true, text: 'Sound is on for this node.' }
    case 'disable': s.setEnabled(id, false); return { ok: true, text: 'Sound is off for this node.' }
    case 'play': { const r = s.play(id); return { ok: r.ok, text: r.ok ? 'Playing.' : r.error } }
    case 'stop': s.stop(id); return { ok: true, text: 'Stopped.' }
    case 'open': open(); return { ok: true, text: 'Opened ⟐SoundNodeSettings.' }
    case 'mute':
      if (Settings.engineMuted()) { window.dispatchEvent(new CustomEvent('omni:sound-enable-request', { detail: {} })); return { ok: true, text: 'Sound is on.' } }
      window.dispatchEvent(new CustomEvent(Settings.SET_EVENT, { detail: { patch: { muted: true } } })); return { ok: true, text: 'All sound is muted.' }
    default: return { ok: true, text: '' }
  }
}

// ── The 'Sound' section (every node) ──────────────────────────────────────────────────────────────────────────────

export function soundSectionHTML (data) {
  injectStyles(); bindLive()
  const s = svc()
  if (!s) return `<div class="ois-note" data-testid="ois-missing">The sound system is not running.</div>`
  const v = s.getView(data.id)
  const on = v.enabled
  const sw = `<div class="ois-row"><span class="oi-label">Sound</span><button class="osf-sw ${on ? 'is-on' : ''}" data-ois="${on ? 'disable' : 'enable'}" role="switch" aria-checked="${on}" aria-label="This node makes sound" ${tip('This node makes sound', 'sound.enabled', 'Switch on to give this node a sound: a note, a pad, a beat. Off keeps the settings but the node stays silent. A node that never had sound is not changed at all.')}></button><span class="ois-note" style="margin:0">${on ? 'makes sound' : 'silent'}</span></div>`
  if (!on) {
    return `<div class="ois" data-ois-root data-node-id="${esc(data.id)}">${sw}
      <div class="ois-note" data-testid="ois-off">${v.sound ? 'Sound is off for this node; its settings are kept.' : 'This node is silent. Switch Sound on to give it a note, a pad or a beat.'}</div>
      <div class="ois-msg" role="status" aria-live="polite" data-ref="ois-msg"></div></div>`
  }
  const q = findQuick(SOUND_SCHEMA)
  const rows = ['note', 'dynamic', 'volume', 'loop', 'spatial'].map(k => (q[k] ? fieldHTML('sound', q[k], v.sound[q[k].key], { compact: true }) : '')).join('')
  const presets = Object.entries(SOUND_PRESETS).map(([id, p]) => `<option value="${esc(id)}">${esc(p.label ?? id)}</option>`).join('')
  return `<div class="ois" data-ois-root data-node-id="${esc(data.id)}">${sw}
    <div class="ois-row"><select class="ois-select" data-ois-preset aria-label="Presets" ${tip('Presets', '—', 'Replaces the sound with a ready-made one (pad, pluck, bell, ...). Your label, colour and tags stay.')}><option value="">Presets…</option>${presets}</select></div>
    <div data-ref="ois-quick">${rows}</div>
    <div class="ois-row" data-ref="ois-buttons">${playHTML(data.id)}${speakerHTML()}<button class="oi-btn-small" data-ois="open" ${tip('Open sound settings', '—', 'Opens ⟐SoundNodeSettings: every setting of this sound and of its particles, in sections with a search box.')}>⚙ Open sound settings</button></div>
    <div class="ois-msg" role="status" aria-live="polite" data-ref="ois-msg"></div></div>`
}

function say (root, r) { const m = root.querySelector('[data-ref="ois-msg"]'); if (m) { m.textContent = r.text || ''; m.classList.toggle('is-err', !r.ok) } }

/** Wire the section that soundSectionHTML rendered (body = the Inspector body). Re-renders itself when the switch or a preset changes. */
export function wireSoundSection (body, data) {
  const host = body.querySelector?.('#oisec-sound .oi-section-inner')
  if (!host || host.dataset.wired === '1') return
  host.dataset.wired = '1'
  const render = () => { host.innerHTML = soundSectionHTML(data) }
  host.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-ois]'); if (!b || b.disabled) return
    const act = b.dataset.ois
    const r = runSoundAction(act, data.id)
    if (act === 'enable' || act === 'disable') { render(); say(host, r) } else { say(host, r); refreshLive(host) }
  })
  host.addEventListener('change', (e) => {
    const sel = e.target.closest?.('[data-ois-preset]'); if (!sel) return
    const id = sel.value; sel.value = ''
    if (!id) return
    const r = svc()?.applyPreset(data.id, id) ?? { ok: false, error: 'The sound system is not running.' }
    render(); say(host, { ok: r.ok, text: r.ok ? `Preset "${SOUND_PRESETS[id]?.label ?? id}" applied.` : r.error })
  })
  wireFields(host, SCHEMAS, (scope, key, value) => {
    const r = svc()?.setField(data.id, scope, key, value)
    if (!r?.ok) { say(host, { ok: false, text: r?.error ?? 'Not possible.' }); return undefined }
    return r.value
  })
}

// ── The SoundNode block in Appearance ─────────────────────────────────────────────────────────────────────────────

export function soundKindBlockHTML (data) {
  injectStyles(); bindLive()
  const s = svc()
  const v = s?.getView(data.id)
  const state = !s ? 'The sound system is not running.' : !v.enabled ? 'Sound is off for this node.' : s.isPlaying(data.id) ? 'Playing.' : 'Silent: press Play.'
  return `<div class="oi-custom-section" id="oi-custom-sound" data-ois-root data-kind="soundNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">♪ Sound node</div>
    <div class="ois-row"><span class="ois-note" style="margin:0;flex:1 1 100%" data-testid="ois-state">${esc(state)}</span></div>
    <div class="ois-row" data-ref="ois-buttons">${s && v.enabled ? playHTML(data.id) : ''}${speakerHTML()}<button class="oi-btn-small" data-ois="open" ${tip('Open sound settings', '—', 'Opens ⟐SoundNodeSettings: every setting of this sound and of its particles, in sections with a search box.')}>⚙ Open sound settings</button></div>
    <div class="ois-msg" role="status" aria-live="polite" data-ref="ois-msg"></div>
    <div class="ois-note">A sound node is a speaker you can place. Its bell glows and its rings pulse with the sound. The settings live in the node; the Sound section below has the quick controls.</div>
  </div>`
}

export function wireSoundKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-sound')
  if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-ois]'); if (!b || b.disabled) return
    const r = runSoundAction(b.dataset.ois, data.id)
    say(sec, r); refreshLive(sec)
  })
}

// ── Following the engine (play / pause, mute) ─────────────────────────────────────────────────────────────────────

/** Update the Play / Stop button, the speaker and the state line inside one root without rebuilding it. */
function refreshLive (root) {
  const id = root.dataset.nodeId; const s = svc(); if (!id || !s) return
  const holder = root.querySelector('[data-ref="ois-buttons"]'); if (!holder) return
  const v = s.getView(id)
  const showPlay = v.enabled
  holder.innerHTML = `${showPlay ? playHTML(id) : ''}${speakerHTML()}<button class="oi-btn-small" data-ois="open" ${tip('Open sound settings', '—', 'Opens ⟐SoundNodeSettings: every setting of this sound and of its particles, in sections with a search box.')}>⚙ Open sound settings</button>`
  const st = root.querySelector('[data-testid="ois-state"]')
  if (st) st.textContent = !v.enabled ? 'Sound is off for this node.' : s.isPlaying(id) ? 'Playing.' : 'Silent: press Play.'
}

let LIVE_BOUND = false
function bindLive () {
  if (LIVE_BOUND || typeof window === 'undefined') return
  LIVE_BOUND = true
  const h = () => { if (typeof document !== 'undefined') document.querySelectorAll('[data-ois-root][data-node-id]').forEach(r => { if (r.querySelector('[data-ref="ois-buttons"]')) refreshLive(r) }) }
  window.addEventListener('omni:sound-state', h)
  window.addEventListener(Settings.CHANGED_EVENT, h)
}
