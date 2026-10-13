/**
 * ui/OmniExpressionTypingSettingsPanel.js — ⟐OmniExpressionTypingSettings: options of Expression typing, the live instrument and MIDI in (V195, class-A window).
 *
 *   Typing        octave keys (B / N) on or off + which hand they move (both / left / right / last), base octave of each hand, modulation step, pitch bend range,
 *                 spring-back time, show key hints
 *   Instrument    follow the selected node's sound (on by default), and the instrument node to use when nothing is selected (a picker of the nodes that carry a sound)
 *   MIDI          switch Web MIDI on (the browser asks for permission only then), the devices found (per-device switch), channel filter, channel -> hand
 *   Key map       a table of the 28 note keys: semitone offset above the hand's C (editable), the resulting note, reset per key / all
 *
 * Every control sends `omni:expression-typing-set` (utils/OmniExpressionTypingSettings.js); systems/OmniExpressionTyping.js validates, saves
 * 'omni:expression-typing-v1' and answers `omni:expression-typing-changed`, which this panel and the Admin block follow. The device list follows `omni:midi-state`.
 * Opened by the nav item '⟐OmniExpressionTypingSettings' (Admin slot, ribbon Home > Tools > Expression settings). Window-chrome class A via OmniSettingsPanelBase.
 * Also exports the compact Admin > UI Settings block (adminRowsHtml / bindAdminRows). User-facing: imports no Dev* module.
 */
import OmniSettingsPanelBase, { esc } from './OmniSettingsPanelBase.js'
import * as S from '../utils/OmniExpressionTypingSettings.js'
import * as K from '../utils/OmniExpressionKeys.js'
import OmniLiveInstrument from '../systems/OmniLiveInstrument.js'

export const PANEL_ID = 'omniexpressiontypingsettings'
export const NAV_ITEM = '⟐OmniExpressionTypingSettings'
export const OPEN_EVENT = 'omni:expression-settings-open'

const STYLES = `
.oets-panel .oets-grid { display: grid; grid-template-columns: 1fr 64px; gap: 4px 8px; align-items: center; }
.oets-panel .oets-keys { width: 100%; border-collapse: collapse; font-size: 10px; }
.oets-panel .oets-keys th { text-align: left; font-weight: normal; opacity: .6; padding: 2px 3px; }
.oets-panel .oets-keys td { padding: 1px 3px; }
.oets-panel .oets-keys input { width: 54px; }
.oets-panel .oets-keys tr.is-edited td:first-child { color: var(--omni-theme-accent, #c9a3ff); }
.oets-panel .oets-hands { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.oets-panel .oets-hands label { display: flex; gap: 4px; align-items: center; font-size: 10px; }
.oets-panel .oets-hands select { min-height: 24px; }
.oets-panel .oets-dev { display: flex; gap: 6px; align-items: center; margin: 2px 0; }
.oets-panel .oets-kbd { display: inline-block; min-width: 18px; padding: 0 4px; text-align: center; border: 1px solid rgba(255,255,255,.3); border-radius: 4px; font-size: 10px; }
`
const tip = (name, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="—" data-omni-tip-desc="${esc(desc)}"`
const send = (detail) => window.dispatchEvent(new CustomEvent(S.SET_EVENT, { detail }))
const sel = (opts, v, attrs) => `<select class="oss-select" ${attrs}>${opts.map(([val, lab]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`
const SCOPE_OPTS = [['both', 'Both hands'], ['left', 'Left hand'], ['right', 'Right hand'], ['last', 'Last played hand']]

/** nodes that carry a sound: [{ id, label }]. */
export function soundNodesOf (omniNode) {
  const out = []
  try { for (const d of omniNode?.getAllNodes?.() ?? []) if (d && d.id && d.sound && typeof d.sound === 'object') out.push({ id: String(d.id), label: String(d.label ?? d.id) }) } catch (_) { /* ignore */ }
  return out
}

export default class OmniExpressionTypingSettingsPanel extends OmniSettingsPanelBase {
  constructor (omniNode = null) {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐⌨', navItems: [NAV_ITEM, '⟐ExpressionTypingSettings'], className: 'oets-panel', wide: true })
    this.omniNode = omniNode
    this._settings = S.getTypingSettings()
    this._midi = { supported: true, enabled: false, devices: [] }
    this._h = {}
  }

  onInit () {
    if (typeof document !== 'undefined' && !document.getElementById('oets-styles')) { const st = document.createElement('style'); st.id = 'oets-styles'; st.textContent = STYLES; document.head.appendChild(st) }
    this._h.changed = (e) => { if (e.detail?.settings) { this._settings = e.detail.settings; if (this._isOpen) this._sync() } }
    this._h.midi = (e) => { if (e.detail) { this._midi = e.detail; if (this._isOpen) this._renderMidi() } }
    this._h.open = () => this.open()
    window.addEventListener(S.CHANGED_EVENT, this._h.changed)
    window.addEventListener('omni:midi-state', this._h.midi)
    window.addEventListener(OPEN_EVENT, this._h.open)
  }
  onDestroy () {
    window.removeEventListener(S.CHANGED_EVENT, this._h.changed)
    window.removeEventListener('omni:midi-state', this._h.midi)
    window.removeEventListener(OPEN_EVENT, this._h.open)
    document.getElementById('oets-styles')?.remove()
  }

  buildBody (body) {
    const L = S.LIMITS
    const num = (k, min, max, step, name, desc) => `<div class="oss-row"><label for="oets-${k}">${name}</label><input class="oss-input" id="oets-${k}" type="number" data-k="${k}" min="${min}" max="${max}" step="${step}" ${tip(name, desc)}></div>`
    const chk = (k, name, desc) => `<div class="oss-row"><label for="oets-${k}">${name}</label><input id="oets-${k}" type="checkbox" data-k="${k}" ${tip(name, desc)}></div>`
    const keyRows = K.DEFAULT_KEYS.map(k => `<tr data-key="${k.code}"><td>${esc(k.label)}</td><td>${k.hand === 'L' ? 'Left' : 'Right'} · ${k.row}</td><td><input class="oss-input" type="number" min="${L.semi.min}" max="${L.semi.max}" step="1" data-semi="${k.code}" aria-label="Semitones for key ${esc(k.label)}"></td><td data-note="${k.code}"></td><td><button type="button" class="oss-btn" data-reset-key="${k.code}" aria-label="Reset key ${esc(k.label)}">↺</button></td></tr>`).join('')
    const handRows = Array.from({ length: 16 }, (_, i) => `<label>Ch ${i + 1} ${sel([['L', 'L'], ['R', 'R'], ['X', 'X']], 'X', `data-hand="${i + 1}" aria-label="MIDI channel ${i + 1} plays as hand"`)}</label>`).join('')
    body.innerHTML = `
      <div class="oss-dim">Cmd/Ctrl+K turns Expression typing on: your keys become a two-handed instrument. Esc leaves it.</div>
      <div class="oss-sec">Typing</div>
      ${chk('octaveKeys', 'Octave keys (B / N)', 'While Expression typing is on, B moves the octave down and N up.')}
      <div class="oss-row"><label for="oets-octaveScope">Octave keys move</label>${sel(SCOPE_OPTS, 'both', `id="oets-octaveScope" data-k="octaveScope" ${tip('Octave keys move', 'Which hand the B / N keys shift: both, only the left, only the right, or the hand that played the last note.')}`)}</div>
      ${num('baseOctaveL', L.baseOctave.min, L.baseOctave.max, 1, 'Left hand octave', 'The octave of the left-hand keys (W E R T Y / A S D F G / Z X C V). 3 means C3 = MIDI 48.')}
      ${num('baseOctaveR', L.baseOctave.min, L.baseOctave.max, 1, 'Right hand octave', 'The octave of the right-hand keys (U I O P [ / J K L ; \' / M , . /). 4 means C4 = MIDI 60.')}
      ${num('modStep', L.modStep.min, L.modStep.max, 0.01, 'Modulation step', 'How far one Left Shift + Up / Down press moves the modulation (0 to 1). It stays where you leave it.')}
      ${num('bendRange', L.bendRange.min, L.bendRange.max, 1, 'Pitch bend range (semitones)', 'How far the pitch moves at full bend (Right Shift + Up / Down, or a MIDI wheel). Default 2.')}
      ${num('springMs', L.springMs.min, L.springMs.max, 10, 'Spring-back time (ms)', 'How long the bend takes to return to the middle after you let go.')}
      ${chk('showHints', 'Show key hints', 'Show the key letters on the on-screen keyboards.')}
      <div class="oss-sec">Instrument</div>
      ${chk('followSelection', 'Follow the selected node', 'On: the node you select (one that carries a sound) becomes the instrument. Off: always use the node chosen below.')}
      <div class="oss-row"><label for="oets-instrument">Instrument node</label><select class="oss-select" id="oets-instrument" data-instrument="1" ${tip('Instrument node', 'The node whose sound the keys play when nothing is selected. None = a soft sine.')}></select></div>
      <div class="oss-sec">MIDI keyboard</div>
      ${chk('midiEnabled', 'Use MIDI', 'Turns on Web MIDI. The browser asks for permission now (and only now).')}
      <div class="oss-msg" data-midi-msg></div>
      <div data-midi-devices></div>
      <div class="oss-row"><label for="oets-midiChannel">Listen to channel</label>${sel([['all', 'All']].concat(Array.from({ length: 16 }, (_, i) => [i + 1, String(i + 1)])), 'all', `id="oets-midiChannel" data-k="midiChannel" ${tip('MIDI channel', 'All channels, or just one (1 to 16).')}`)}</div>
      <div class="oss-dim">Channel plays as hand (L / R / X = no hand):</div>
      <div class="oets-hands">${handRows}</div>
      <div class="oss-sec">Key map</div>
      <div class="oss-dim">Semitones above the hand's C. The factory map is the standard piano layout; the bottom row repeats G.</div>
      <table class="oets-keys"><thead><tr><th>Key</th><th>Hand</th><th>Semi</th><th>Note</th><th></th></tr></thead><tbody>${keyRows}</tbody></table>
      <div class="oss-sec">Other keys</div>
      <div class="oss-dim">${Object.values(K.SPECIAL_KEYS).filter(x => x.type !== 'shift').map(x => `<span class="oets-kbd">${esc(x.label)}</span> ${esc(x.desc)}`).join('<br>')}</div>
      <div class="oss-sec">Reset</div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="reset-keys" ${tip('Reset key map', 'Puts every note key back on the standard layout.')}>Reset key map</button><button type="button" class="oss-btn is-danger" data-act="reset" ${tip('Reset Expression typing', 'Back to the defaults, key map included.')}>Reset everything</button></div>`
    body.addEventListener('change', (e) => {
      const t = e.target
      if (t.dataset.k) {
        const v = t.type === 'checkbox' ? !!t.checked : (t.dataset.k === 'octaveScope' ? t.value : (t.dataset.k === 'midiChannel' ? (t.value === 'all' ? 'all' : Number(t.value)) : Number(t.value)))
        send({ patch: { [t.dataset.k]: v } })
      } else if (t.dataset.semi) {
        const def = K.DEFAULT_KEYS.find(k => k.code === t.dataset.semi)?.semi
        const n = Number(t.value)
        send({ merge: { keyOverrides: { [t.dataset.semi]: t.value === '' || n === def ? null : n } } })
      } else if (t.dataset.hand) send({ merge: { midiHands: { [t.dataset.hand]: t.value } } })
      else if (t.dataset.device) send({ merge: { midiDevices: { [t.dataset.device]: !!t.checked } } })
      else if (t.dataset.instrument) { const id = t.value || null; if (OmniLiveInstrument.instance) OmniLiveInstrument.setInstrument(id); else send({ patch: { instrumentNodeId: id } }) }
    })
    body.addEventListener('click', (e) => {
      const b = e.target.closest?.('button'); if (!b) return
      if (b.dataset.resetKey) send({ merge: { keyOverrides: { [b.dataset.resetKey]: null } } })
      else if (b.dataset.act === 'reset-keys') send({ resetKeys: true })
      else if (b.dataset.act === 'reset') send({ reset: true })
      else if (b.dataset.act === 'connect') window.dispatchEvent(new CustomEvent('omni:midi-connect-request'))
    })
    this._sync()
  }

  refresh () { this._settings = S.getTypingSettings(); this._sync() }

  _sync () {
    const body = this.body; if (!body) return
    const s = this._settings; const active = document.activeElement
    const set = (el, v) => { if (el && el !== active && String(el.value) !== String(v)) el.value = String(v) }
    body.querySelectorAll('[data-k]').forEach(el => { if (el.type === 'checkbox') el.checked = !!s[el.dataset.k]; else set(el, s[el.dataset.k]) })
    const map = K.buildKeyMap(s); const st = K.createKeyState(s)
    for (const k of K.DEFAULT_KEYS) {
      const m = map.get(k.code); const row = body.querySelector(`tr[data-key="${k.code}"]`); if (!row) continue
      set(row.querySelector('[data-semi]'), m.semi)
      row.classList.toggle('is-edited', !!m.edited)
      const n = K.keyToNote(k.code, st, map); row.querySelector('[data-note]').textContent = n ? `${n.name} (${n.midi})` : '—'
    }
    for (let ch = 1; ch <= 16; ch++) set(body.querySelector(`[data-hand="${ch}"]`), s.midiHands[ch])
    this._renderInstrument()
    this._renderMidi()
  }

  _renderInstrument () {
    const el = this.body?.querySelector('[data-instrument]'); if (!el || el === document.activeElement) return
    const list = soundNodesOf(this.omniNode)
    const cur = this._settings.instrumentNodeId
    const opts = [['', 'Soft sine (default)']].concat(list.map(n => [n.id, n.label]))
    if (cur && !list.some(n => n.id === cur)) opts.push([cur, `${cur} (missing)`])
    el.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('')
  }

  _renderMidi () {
    const body = this.body; if (!body) return
    const m = this._midi; const s = this._settings
    const msg = body.querySelector('[data-midi-msg]')
    msg.className = 'oss-msg' + (m.error ? ' is-err' : '')
    if (!m.supported) msg.textContent = m.error?.message || 'Web MIDI is not available in this browser.'
    else if (m.error) msg.innerHTML = `${esc(m.error.message)} ${m.error.code === 'needs-permission' ? '<button type="button" class="oss-btn" data-act="connect">Connect MIDI</button>' : ''}`
    else if (!s.midiEnabled) msg.textContent = 'MIDI is off.'
    else if (!m.devices.length) msg.textContent = 'MIDI is on. No MIDI device found: plug one in, it appears here by itself.'
    else msg.textContent = `MIDI is on. ${m.devices.length} device${m.devices.length === 1 ? '' : 's'} found.`
    const box = body.querySelector('[data-midi-devices]')
    box.innerHTML = (m.devices || []).map(d => `<div class="oets-dev"><input type="checkbox" id="oets-d-${esc(d.id)}" data-device="${esc(d.id)}" ${d.enabled === false ? '' : 'checked'}><label for="oets-d-${esc(d.id)}">${esc(d.name)}</label></div>`).join('')
  }
}

// ── Admin > UI Settings block ───────────────────────────────────────────────────────────────

/** HTML of the compact Expression typing block for Admin > UI Settings (the Admin panel's own ap-* classes). */
export function adminRowsHtml () {
  const s = S.getTypingSettings(); const L = S.LIMITS
  const row = (label, inner) => `<div class="ap-row"><span class="ap-row-label">${label}</span>${inner}</div>`
  const toggle = (k, on, label, name, desc) => `<button class="ap-toggle ${on ? 'is-on' : ''}" data-ets="${k}" role="switch" aria-checked="${on}" aria-label="${label}" ${tip(name, desc)}></button>`
  return `
        <div class="ap-subhead" data-ets-section="1" id="ap-ets-section">Expression typing</div>
        <div class="ap-data-note" style="font-size:9px;color:var(--ap-text-muted,rgba(255,255,255,0.6));line-height:1.4">Cmd/Ctrl+K turns your computer keys into a two-handed instrument (Esc leaves). The full list of options, the editable key map and MIDI devices are in the settings window. Changes apply at once.</div>
        ${row('Octave keys (B / N)', toggle('octaveKeys', s.octaveKeys, 'Octave keys', 'Octave keys (B / N)', 'While Expression typing is on, B and N move the octave. Default on.'))}
        ${row('Octave keys move', `<select class="ap-select" data-ets="octaveScope" aria-label="Octave keys move" ${tip('Octave keys move', 'Both hands, the left, the right, or the hand that played last.')}>${SCOPE_OPTS.map(([v, l]) => `<option value="${v}"${s.octaveScope === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${row('Pitch bend range', `<input class="ap-range" type="range" min="${L.bendRange.min}" max="${L.bendRange.max}" step="1" value="${s.bendRange}" data-ets="bendRange" aria-label="Pitch bend range in semitones" ${tip('Pitch bend range', 'Semitones at full bend, 1 to 24. Default 2.')}>`)}
        ${row('Follow selected node', toggle('followSelection', s.followSelection, 'Follow the selected node', 'Follow the selected node', 'On: the selected node that carries a sound becomes the instrument.'))}
        ${row('Use MIDI', toggle('midiEnabled', s.midiEnabled, 'Use MIDI', 'Use MIDI', 'Turns on Web MIDI (the browser asks for permission then). Not available in Safari / iOS.'))}
        <div class="ap-row"><span class="ap-row-label">Expression typing</span><button class="ap-file-btn" id="ap-ets-open" type="button" ${tip('Expression typing settings', 'Opens the full settings: key map, base octaves, instrument, MIDI devices and channels.')}>Open settings</button><button class="ap-file-btn" id="ap-ets-reset" type="button" ${tip('Reset Expression typing', 'Back to the defaults, key map included.')}>Reset</button></div>`
}

/** Wires the block; returns an unbind function. */
export function bindAdminRows (body) {
  body.querySelectorAll('button[data-ets]').forEach(b => b.addEventListener('click', () => send({ patch: { [b.dataset.ets]: !b.classList.contains('is-on') } })))
  body.querySelectorAll('select[data-ets]').forEach(i => i.addEventListener('change', () => send({ patch: { [i.dataset.ets]: i.value } })))
  body.querySelectorAll('input[data-ets]').forEach(i => i.addEventListener('change', () => send({ patch: { [i.dataset.ets]: Number(i.value) } })))
  body.querySelector('#ap-ets-open')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM } })))
  body.querySelector('#ap-ets-reset')?.addEventListener('click', () => send({ reset: true }))
  const follow = (e) => {
    const s = e.detail?.settings; if (!s) return
    body.querySelectorAll('button[data-ets]').forEach(b => { const on = !!s[b.dataset.ets]; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)) })
    body.querySelectorAll('select[data-ets], input[data-ets]').forEach(i => { if (document.activeElement !== i && String(i.value) !== String(s[i.dataset.ets])) i.value = String(s[i.dataset.ets]) })
  }
  window.addEventListener(S.CHANGED_EVENT, follow)
  return () => window.removeEventListener(S.CHANGED_EVENT, follow)
}
