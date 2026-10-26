/**
 * ui/OmniVibrationPanel.js — ⟐OmniVibration (V216): start, sustain and edit looped motion for you and for nodes.
 * Reads/writes Extra.SERVICES.vibration only. Opened by omni:nav-select '⟐OmniVibration' (ribbon, OmniStarLight).
 */
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { PROPS, WAVE_NAMES, sanitizeProgram } from '../utils/OmniVibrationModel.js'

export const NAV_ITEM = '⟐OmniVibration'
export const PANEL_ID = 'omnivibration'
const STYLES = `
.oss-panel.ovb-panel, .oss-panel.ovb-panel.is-wide { width: 360px; max-width: calc(100vw - 16px); max-height: calc(100vh - 120px); }
.ovb-run { display: flex; gap: 6px; align-items: center; font-size: 11px; margin: 2px 0; }
.ovb-run span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ovb-ch { display: grid; grid-template-columns: 1fr 1fr 54px 48px 48px 26px; gap: 3px; align-items: center; margin: 3px 0; }
.ovb-ch .oss-input, .ovb-ch .oss-select { width: 100%; min-width: 0; padding: 2px 4px; }
.ovb-ch.ovb-head { font-size: 9px; opacity: .65; }
.ovb-pat { grid-column: 1 / -1; }
.ovb-note { font-size: 10px; opacity: .7; margin: 4px 0; }
.ovb-details > summary { cursor: pointer; font-weight: 600; margin: 6px 0; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.ovb-panel, .oss-panel.ovb-panel.is-wide { width: 100%; max-height: 62vh; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('ovb-panel-styles')) return
  const s = document.createElement('style'); s.id = 'ovb-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default class OmniVibrationPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: '⟐OmniVibration', iconLabel: '⟐〰', navItems: [NAV_ITEM], className: 'ovb-panel' })
    this._els = {}; this._sel = null; this._selName = ''; this._draft = null; this._progId = 'bounce'; this._evs = []
  }
  get vib () { return SERVICES.vibration }
  onInit () {
    injectStyles()
    const on = (t, fn) => { window.addEventListener(t, fn); this._evs.push([t, fn]) }
    on('omni:node-selected', (e) => { this._sel = e.detail?.node?.id ?? e.detail?.mesh?.userData?.nodeId ?? null; this._selName = e.detail?.node?.name ?? e.detail?.node?.label ?? this._sel ?? ''; if (this.isOpen) this.refresh() })
    on('omni:vibration-changed', () => { if (this.isOpen) this._refreshRuns() })
    on('omni:vibration-programs-changed', () => { if (this.isOpen) this.refresh() })
  }
  buildBody (body) {
    body.innerHTML = `
      <div class="oss-row"><label for="ovb-target">Move</label>
        <select id="ovb-target" class="oss-select" data-ref="target"></select></div>
      <div class="oss-row"><label for="ovb-prog">Vibration</label>
        <select id="ovb-prog" class="oss-select" data-ref="prog"></select></div>
      <div class="oss-row"><label>Sustain (s, 0 = until stopped)</label><input class="oss-input" type="number" min="0" max="3600" step="0.5" data-ref="hold"></div>
      <div class="oss-row"><label>Attack (s)</label><input class="oss-input" type="number" min="0" max="30" step="0.05" data-ref="attack">
        <label>Release (s)</label><input class="oss-input" type="number" min="0" max="60" step="0.05" data-ref="release"></div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="start">Start</button>
        <button type="button" class="oss-btn" data-act="stop">Stop (release)</button>
        <button type="button" class="oss-btn" data-act="snap">Stop now</button></div>
      <div class="oss-msg oss-dim" data-ref="msg"></div>
      <div data-ref="runs"></div>
      <details class="ovb-details" data-ref="editor"><summary>Edit this vibration</summary><div data-ref="edit"></div></details>
      <div class="ovb-note">A vibration is a loop added on top of where something already is. On you it is a view effect (camera and avatar); your real position never changes. Boost can start one and sustain it after a dash (next build).</div>`
    const q = (r) => body.querySelector(`[data-ref="${r}"]`)
    this._els = { body, target: q('target'), prog: q('prog'), hold: q('hold'), attack: q('attack'), release: q('release'), msg: q('msg'), runs: q('runs'), edit: q('edit'), editor: q('editor') }
    body.addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-act]'); if (!b) return
      const a = b.dataset.act
      if (a === 'start') this._start(); else if (a === 'stop') this._stop(false); else if (a === 'snap') this._stop(true)
      else if (a === 'run-stop') this.vib?.stop(b.dataset.id)
      else if (a === 'add-ch') { this._draft.channels.push({ prop: 'pos.y', wave: 'sine', amp: 0.3, freq: 1, phase: 0 }); this._renderEditor() }
      else if (a === 'del-ch') { this._draft.channels.splice(Number(b.dataset.i), 1); if (!this._draft.channels.length) this._draft.channels.push({ prop: 'pos.y', wave: 'sine', amp: 0.3, freq: 1, phase: 0 }); this._renderEditor() }
      else if (a === 'save') this._save(false); else if (a === 'save-new') this._save(true); else if (a === 'delete') this._delete()
    })
    body.addEventListener('change', (e) => this._onChange(e))
    this._els.prog.addEventListener('change', () => { this._progId = this._els.prog.value; this._loadDraft(); this._fillEnv(); this._renderEditor() })
    this.refresh()
  }
  _say (t, err) { const m = this._els.msg; if (m) { m.textContent = t; m.classList.toggle('is-err', !!err) } }
  _prog () { return this.vib?.getProgram(this._progId) ?? null }
  _loadDraft () { const p = this._prog(); this._draft = p ? JSON.parse(JSON.stringify(p)) : null }
  _fillEnv () { const p = this._prog(), e = this._els; if (!p || !e.hold) return; e.hold.value = String(p.envelope.hold); e.attack.value = String(p.envelope.attack); e.release.value = String(p.envelope.release) }

  refresh () {
    const e = this._els; if (!e.target) return
    const v = this.vib
    if (!v) { e.runs.innerHTML = '<div class="oss-dim">The vibration system is not running.</div>'; return }
    const tv = e.target.value
    e.target.innerHTML = `<option value="user">You (view and avatar)</option>` + (this._sel ? `<option value="${esc(this._sel)}">Selected node: ${esc(this._selName || this._sel)}</option>` : '')
    e.target.value = [...e.target.options].some(o => o.value === tv) ? tv : 'user'
    const progs = v.programs()
    if (!progs.some(p => p.id === this._progId)) this._progId = 'bounce'
    e.prog.innerHTML = progs.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.builtin ? '' : ' (yours)'}</option>`).join('')
    e.prog.value = this._progId
    if (!this._draft || this._draft.id !== this._progId) { this._loadDraft(); this._fillEnv(); this._renderEditor() }
    this._refreshRuns()
  }
  _refreshRuns () {
    const e = this._els; const v = this.vib; if (!e.runs || !v) return
    const runs = v.runs()
    e.runs.innerHTML = runs.length ? runs.map(r => `<div class="ovb-run"><span>${esc(r.target === 'user' ? 'You' : (r.target === this._sel ? this._selName : r.target))} · ${esc(r.name)}${r.releasing ? ' (releasing)' : ''}</span><button type="button" class="oss-btn" data-act="run-stop" data-id="${esc(r.id)}">Stop</button></div>`).join('') : '<div class="oss-dim">Nothing is vibrating.</div>'
  }
  _start () {
    const v = this.vib; if (!v) return
    const e = this._els, target = e.target.value
    const id = v.start(target, this._progId, { hold: e.hold.value, attack: e.attack.value, release: e.release.value })
    this._say(id ? 'Started.' : 'Could not start (is the node still there?).', !id)
  }
  _stop (immediate) {
    const v = this.vib; if (!v) return
    const n = v.stop(this._els.target.value, { immediate })
    this._say(n ? (immediate ? 'Stopped.' : 'Releasing…') : 'Nothing running on that target.')
  }

  // ── editor ──
  _renderEditor () {
    const d = this._draft, host = this._els.edit; if (!d || !host) return
    const p = this._prog()
    const opt = (list, cur) => list.map(x => `<option value="${x}"${x === cur ? ' selected' : ''}>${x}</option>`).join('')
    host.innerHTML = `
      <div class="oss-row"><label>Name</label><input class="oss-input" data-f="name" value="${esc(d.name)}" maxlength="40"></div>
      <div class="oss-row"><label>Timing</label><select class="oss-select" data-f="mode"><option value="free"${d.mode === 'free' ? ' selected' : ''}>Free (cycles per second)</option><option value="beat"${d.mode === 'beat' ? ' selected' : ''}>Beat (BPM)</option></select>
        ${d.mode === 'beat' ? `<input class="oss-input" type="number" data-f="bpm" min="20" max="300" step="1" value="${d.bpm}">` : `<input class="oss-input" type="number" data-f="rate" min="0.05" max="12" step="0.05" value="${d.rate}">`}</div>
      <div class="oss-row"><label>Swing (uneven beats)</label><input class="oss-input" type="number" data-f="swing" min="0" max="0.75" step="0.05" value="${d.swing}"></div>
      <div class="ovb-ch ovb-head"><span>What moves</span><span>Wave</span><span>Size</span><span>×Speed</span><span>Phase°</span><span></span></div>
      ${d.channels.map((c, i) => `<div class="ovb-ch" data-i="${i}">
        <select class="oss-select" data-c="prop">${opt(PROPS, c.prop)}</select><select class="oss-select" data-c="wave">${opt(WAVE_NAMES, c.wave)}</select>
        <input class="oss-input" type="number" data-c="amp" step="0.05" value="${c.amp}"><input class="oss-input" type="number" data-c="freq" step="0.25" value="${c.freq}"><input class="oss-input" type="number" data-c="phase" step="15" value="${c.phase}">
        <button type="button" class="oss-btn" data-act="del-ch" data-i="${i}" title="Remove">×</button>
        ${c.wave === 'steps' ? `<input class="oss-input ovb-pat" data-c="pattern" value="${esc((c.pattern ?? []).join(', '))}" title="Values from -1 to 1, looped and eased">` : ''}</div>`).join('')}
      <div class="oss-row"><button type="button" class="oss-btn" data-act="add-ch">+ Channel</button>
        ${p && !p.builtin ? '<button type="button" class="oss-btn" data-act="save">Save changes</button><button type="button" class="oss-btn" data-act="delete">Delete</button>' : ''}
        <button type="button" class="oss-btn" data-act="save-new">Save as new</button></div>
      <div class="ovb-note">Size: world units for position, degrees for rotation, a fraction for scale. ×Speed multiplies the base rate; keep it to simple ratios (0.5, 1, 2, 1.5) so the loop repeats exactly. Built-ins are copied, never overwritten.</div>`
  }
  _onChange (e) {
    const t = e.target, d = this._draft; if (!d || !t.dataset) return
    if (t.dataset.f) {
      const f = t.dataset.f; d[f] = (f === 'name' || f === 'mode') ? t.value : Number(t.value)
      if (f === 'mode') this._renderEditor()
    } else if (t.dataset.c) {
      const row = t.closest('[data-i]'); const c = d.channels[Number(row?.dataset.i)]; if (!c) return
      const k = t.dataset.c
      if (k === 'pattern') c.pattern = t.value.split(',').map(s => Number(s.trim())).filter(Number.isFinite)
      else if (k === 'prop' || k === 'wave') { c[k] = t.value; if (k === 'wave') this._renderEditor() }
      else c[k] = Number(t.value)
    }
  }
  _save (asNew) {
    const v = this.vib; if (!v || !this._draft) return
    const d = JSON.parse(JSON.stringify(this._draft))
    d.envelope = { attack: Number(this._els.attack.value), hold: Number(this._els.hold.value), release: Number(this._els.release.value) }
    const cur = this._prog()
    if (asNew || !cur || cur.builtin) { d.id = undefined; if (asNew && d.name === cur?.name) d.name = d.name + ' copy' }
    const q = v.saveProgram(sanitizeProgram(d))
    this._progId = q.id; this._loadDraft(); this.refresh(); this._say(`Saved “${q.name}”.`)
  }
  _delete () {
    const v = this.vib, p = this._prog(); if (!v || !p || p.builtin) return
    v.deleteProgram(p.id); this._progId = 'bounce'; this._draft = null; this.refresh(); this._say('Deleted.')
  }
  onOpened () { this.refresh() }
  onDestroy () { for (const [t, h] of this._evs) window.removeEventListener(t, h); this._evs = [] }
}
