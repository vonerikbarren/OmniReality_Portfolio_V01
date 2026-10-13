/**
 * ui/OmniSoundPanel.js — ⟐SoundNodeSettings: the editor of ONE node's sound and sound particles (V194, class-A window panel).
 *
 * It edits EVERY field of the selected node's data.sound and data.soundParticles. The controls are GENERATED from SOUND_SCHEMA (utils/OmniSoundModel.js) and
 * PARTICLE_SCHEMA (utils/OmniSoundParticleModel.js) by ui/OmniSoundFields.js, so a setting the models gain later appears here without a change to this file.
 *
 *   sections     one collapsible section per schema group, with a Reset button per section; a search box filters the fields (label, key, description)
 *   fields       number = slider + number + unit, enum = select, bool = switch, note = name + octave, text, colour; `?` shows the description (it is also the tooltip)
 *   top          Play / Stop / Audition (2 s) / speaker (mute) / Undo, the Presets menu (SOUND_PRESETS), the on / off switch of the node's sound
 *   bottom       Copy / Paste JSON, Reset all sound, Reset all particles
 *   live         every edit goes through systems/OmniSoundNodes.js: sanitized with the model, applied to a playing voice with SoundEngine.update, saved after a short pause
 *   follows      the selected node (a sound node or any node); says clearly when the node has no sound switched on and offers a button to switch it on
 *
 * Built on ui/OmniSettingsPanelBase.js (WindowManager registration => resize + maximize from utils/OmniWindowChrome.js, a bottom sheet on phones).
 * Opened by omni:nav-select '⟐SoundNodeSettings' (ribbon Home > Tools > Sound settings, the Inspector's 'Open sound settings', Admin / dock lists).
 */

import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { SOUND_SCHEMA, SOUND_PRESETS } from '../utils/OmniSoundModel.js'
import { PARTICLE_SCHEMA, sanitizeParticles } from '../utils/OmniSoundParticleModel.js'
import SoundEngine from '../systems/OmniSoundEngine.js'
import * as Settings from '../utils/OmniSoundSettings.js'
import { esc, tip, fieldHTML, wireFields, syncRow, indexSchema, FIELD_STYLES } from './OmniSoundFields.js'

export const NAV_ITEM = '⟐SoundNodeSettings'
export const PANEL_ID = 'soundnodesettings'

const STYLES = `${FIELD_STYLES}
.osp-panel .osp-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px 0; }
.osp-panel .osp-who { font-size: 11px; margin: 2px 0 4px; }
.osp-panel .osp-who b { color: var(--omni-theme-accent, #c9a3ff); }
.osp-panel .osp-notice { padding: 8px; margin: 6px 0; border: 1px dashed rgba(255,255,255,.35); border-radius: 8px; line-height: 1.45; }
.osp-panel .osp-search { flex: 1 1 140px; min-width: 0; min-height: 28px; box-sizing: border-box; padding: 2px 8px; font: inherit; color: inherit; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); }
.osp-panel .osp-h { margin: 12px 0 2px; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; opacity: .65; }
.osp-panel .osp-sec { margin: 4px 0; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; overflow: hidden; }
.osp-panel .osp-sec[hidden] { display: none; }
.osp-panel .osp-sec-head { display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,.05); }
.osp-panel .osp-sec-toggle { flex: 1 1 auto; text-align: left; padding: 5px 8px; font: inherit; color: inherit; background: transparent; border: 0; cursor: pointer; min-height: 28px; }
.osp-panel .osp-count { opacity: .55; font-size: 9px; margin-left: 4px; }
.osp-panel .osp-sec-reset { margin-right: 4px; min-height: 22px; padding: 0 8px; font-size: 9.5px; }
.osp-panel .osp-sec-desc { padding: 2px 8px; font-size: 9.5px; opacity: .7; line-height: 1.4; }
.osp-panel .osp-sec-body { padding: 2px 8px 6px; }
.osp-panel .osp-json { width: 100%; min-height: 80px; box-sizing: border-box; font-size: 10px; }
.osp-panel .osp-json[hidden], .osp-panel .osp-jsonrow[hidden] { display: none; }
@media (max-width: ${PHONE_MAX}px) { .osp-panel .osp-search { min-height: 40px; } .osp-panel .osp-sec-toggle { min-height: 40px; } .osp-panel .osp-sec-reset { min-height: 36px; } .oss-panel.osp-panel, .oss-panel.osp-panel.is-wide { max-height: 62vh; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('osp-styles')) return
  const s = document.createElement('style'); s.id = 'osp-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const SCHEMAS = { sound: SOUND_SCHEMA, particles: PARTICLE_SCHEMA }
const groupKey = (scope, g) => `${scope}:${g.id}`

export default class OmniSoundPanel extends OmniSettingsPanelBase {
  /** @param soundNodes the systems/OmniSoundNodes.js instance (the editing API, the selection, playing). */
  constructor (soundNodes) {
    super({ id: PANEL_ID, label: '⟐SoundNodeSettings', iconLabel: '⟐♪', navItems: [NAV_ITEM, '⟐SoundNodeSettingsPanel'], className: 'osp-panel', wide: true })
    this.svc = soundNodes
    this._nodeId = null
    this._open = new Set(SOUND_SCHEMA.length ? [groupKey('sound', SOUND_SCHEMA[0])] : [])
    this._query = ''
    this._helpAll = false
    this._msg = { text: '', err: false }
    this._hs = null
    this._unwire = null
    this._rq = 0
  }

  onInit () {
    injectStyles()
    const full = () => this._later(() => this.refresh())
    this._hs = {
      sel: (e) => { this._nodeId = e.detail?.node?.id ?? null; full() },
      desel: () => { this._nodeId = null; full() },
      del: (e) => { if (e.detail?.id === this._nodeId) { this._nodeId = null; full() } },
      data: (e) => {
        const d = e.detail ?? {}
        if (d.nodeId !== this._nodeId || !this._isOpen) return
        if (d.reason === 'field') this._later(() => this.syncValues()); else full()
      },
      state: () => { if (this._isOpen) this._later(() => this._syncTransport()) },
      settings: () => { if (this._isOpen) this._later(() => this._syncTransport()) },
      upd: (e) => { if (this._isOpen && e.detail?.node?.id === this._nodeId) this._later(() => this.syncValues()) },
    }
    window.addEventListener('omni:node-selected', this._hs.sel)
    window.addEventListener('omni:node-deselected', this._hs.desel)
    window.addEventListener('omni:node-deleted', this._hs.del)
    window.addEventListener('omni:sound-data-changed', this._hs.data)
    window.addEventListener('omni:sound-state', this._hs.state)
    window.addEventListener(Settings.CHANGED_EVENT, this._hs.settings)
    window.addEventListener('omni:node-updated', this._hs.upd)
  }

  onDestroy () {
    if (this._hs) {
      window.removeEventListener('omni:node-selected', this._hs.sel)
      window.removeEventListener('omni:node-deselected', this._hs.desel)
      window.removeEventListener('omni:node-deleted', this._hs.del)
      window.removeEventListener('omni:sound-data-changed', this._hs.data)
      window.removeEventListener('omni:sound-state', this._hs.state)
      window.removeEventListener(Settings.CHANGED_EVENT, this._hs.settings)
      window.removeEventListener('omni:node-updated', this._hs.upd)
    }
    this._hs = null
    this._unwire?.(); this._unwire = null
  }

  /** Run `fn` on the next animation frame (several events in one frame render once). */
  _later (fn) {
    if (!this._isOpen) return
    if (this._rq) return
    const run = () => { this._rq = 0; if (this._isOpen) fn() }
    if (typeof requestAnimationFrame === 'function') this._rq = requestAnimationFrame(run); else run()
  }

  onOpened () { this._nodeId = this._nodeId ?? this.svc?.selectedId ?? null; this.refresh() }

  say (text, err = false) { this._msg = { text, err }; const m = this.body?.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'oss-msg ' + (err ? 'is-err' : 'is-ok') } }

  buildBody (body) {
    body.innerHTML = '<div data-ref="top"></div><div data-ref="main"></div><div data-ref="foot"></div>'
    body.addEventListener('click', (e) => this._click(e))
    body.addEventListener('change', (e) => this._change(e))
    body.addEventListener('input', (e) => { if (e.target.dataset?.f === 'search') { this._query = e.target.value; this._applyFilter() } })
    this._unwire = wireFields(body, SCHEMAS, (scope, key, value) => {
      if (!this._nodeId) return undefined
      const r = this.svc.setField(this._nodeId, scope, key, value)
      if (!r.ok) { this.say(r.error, true); return undefined }
      return r.value
    })
  }

  // ── Actions (public so tests use the same code the buttons do) ──────────────

  get nodeId () { return this._nodeId }
  setNode (id) { this._nodeId = id ?? null; if (this._isOpen) this.refresh() }

  createNode () {
    const r = this.svc.createSoundNode({ select: true })
    this.say(r.ok ? 'A sound node was created in front of you.' : r.error, !r.ok)
    if (r.ok) { this._nodeId = r.nodeId; this.refresh() }
    return r
  }
  enable () {
    if (!this._nodeId) return { ok: false }
    const r = this.svc.setEnabled(this._nodeId, true)
    this.say('Sound is on for this node.'); this.refresh(); return r
  }
  disable () {
    if (!this._nodeId) return { ok: false }
    const r = this.svc.setEnabled(this._nodeId, false)
    this.say('Sound is off for this node (its settings are kept).'); this.refresh(); return r
  }
  preset (id) {
    const r = this.svc.applyPreset(this._nodeId, id)
    this.say(r.ok ? `Preset "${SOUND_PRESETS[id]?.label ?? id}" applied. Undo brings the old sound back.` : r.error, !r.ok)
    return r
  }
  resetSection (scope, groupId) {
    const r = this.svc.resetGroup(this._nodeId, scope, groupId)
    this.say(r.ok ? 'Section reset to its defaults. Undo brings it back.' : r.error, !r.ok)
    return r
  }
  copyJSON () {
    const text = this.svc.exportJSON(this._nodeId)
    const ta = this.body?.querySelector('[data-ref="json"]')
    const row = this.body?.querySelector('[data-ref="jsonrow"]')
    if (ta) { ta.value = text; ta.removeAttribute('hidden') }
    row?.removeAttribute('hidden')
    let done = false
    try { if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).catch(() => {}); done = true } } catch (_) { /* clipboard blocked */ }
    this.say(done ? 'Copied to the clipboard.' : 'Select the text below and copy it.')
    return text
  }
  applyJSON (text) {
    const r = this.svc.importJSON(this._nodeId, text)
    this.say(r.ok ? 'Settings pasted. Undo brings the old sound back.' : r.error, !r.ok)
    return r
  }

  _click (e) {
    const b = e.target.closest?.('[data-act]'); if (!b || b.disabled) return
    const act = b.dataset.act; const id = this._nodeId; const svc = this.svc
    switch (act) {
      case 'create': this.createNode(); break
      case 'enable': this.enable(); break
      case 'disable': this.disable(); break
      case 'play': { const r = svc.play(id); this.say(r.ok ? 'Playing.' : r.error, !r.ok); break }
      case 'stop': svc.stop(id); this.say('Stopped.'); break
      case 'audition': { const r = svc.audition(id); this.say(r.ok ? 'Playing for 2 seconds.' : r.error, !r.ok); break }
      case 'mute': {
        if (Settings.engineMuted()) window.dispatchEvent(new CustomEvent('omni:sound-enable-request', { detail: {} }))
        else window.dispatchEvent(new CustomEvent(Settings.SET_EVENT, { detail: { patch: { muted: true } } }))
        break
      }
      case 'undo': { const r = svc.undo(id); this.say(r.ok ? 'Undone.' : r.error, !r.ok); break }
      case 'sec': { const k = b.closest('[data-sec]').dataset.sec; if (this._open.has(k)) this._open.delete(k); else this._open.add(k); this._applyFilter(); break }
      case 'sec-reset': { const s = b.closest('[data-sec]'); this.resetSection(s.dataset.scope, s.dataset.group); break }
      case 'all-open': for (const sc of ['sound', 'particles']) for (const g of SCHEMAS[sc]) this._open.add(groupKey(sc, g)); this._applyFilter(); break
      case 'all-close': this._open.clear(); this._applyFilter(); break
      case 'help-all': {
        this._helpAll = !this._helpAll
        this.body.querySelectorAll('[data-osf-help]').forEach(h => { const box = h.closest('[data-osf]').querySelector('.osf-help'); if (this._helpAll) box.removeAttribute('hidden'); else box.setAttribute('hidden', ''); h.setAttribute('aria-expanded', String(this._helpAll)) })
        b.setAttribute('aria-pressed', String(this._helpAll)); b.classList.toggle('is-on', this._helpAll)
        break
      }
      case 'copy': this.copyJSON(); break
      case 'paste': {
        const row = this.body.querySelector('[data-ref="jsonrow"]'); const ta = this.body.querySelector('[data-ref="json"]')
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          navigator.clipboard.readText().then(t => this.applyJSON(t)).catch(() => { row.removeAttribute('hidden'); ta.removeAttribute('hidden'); ta.value = ''; ta.focus?.(); this.say('Paste the JSON into the box, then press Apply.') })
        } else { row.removeAttribute('hidden'); ta.removeAttribute('hidden'); ta.value = ''; ta.focus?.(); this.say('Paste the JSON into the box, then press Apply.') }
        break
      }
      case 'apply-json': this.applyJSON(this.body.querySelector('[data-ref="json"]').value); break
      case 'reset-sound': { const r = svc.resetGroup(id, 'sound', null); this.say(r.ok ? 'All sound settings reset (the node stays on). Undo brings them back.' : r.error, !r.ok); break }
      case 'reset-particles': { const r = svc.resetGroup(id, 'particles', null); this.say(r.ok ? 'All particle settings reset. Undo brings them back.' : r.error, !r.ok); break }
      default: break
    }
  }

  _change (e) {
    const f = e.target.dataset?.f
    if (f === 'preset') { const id = e.target.value; e.target.value = ''; if (id) this.preset(id) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  _sectionHTML (scope, g, values) {
    const k = groupKey(scope, g)
    const fields = (g.fields ?? []).map(f => {
      const row = fieldHTML(scope, f, values[f.key])
      return row.replace('data-osf="1"', `data-osf="1" data-q="${esc(`${f.label ?? ''} ${f.key} ${f.desc ?? ''}`.toLowerCase())}"`)
    }).join('')
    return `<section class="osp-sec" data-sec="${esc(k)}" data-scope="${scope}" data-group="${esc(g.id)}">
      <div class="osp-sec-head">
        <button type="button" class="osp-sec-toggle" data-act="sec" aria-expanded="false" ${tip(g.label ?? g.id, g.id, g.desc || g.label)}>▸ ${esc(g.label ?? g.id)}<span class="osp-count">${(g.fields ?? []).length}</span></button>
        <button type="button" class="oss-btn osp-sec-reset" data-act="sec-reset" ${tip('Reset ' + (g.label ?? g.id), g.id, 'Puts every setting of this section back to its default. Undo brings them back.')}>Reset</button>
      </div>
      ${g.desc ? `<div class="osp-sec-desc">${esc(g.desc)}</div>` : ''}
      <div class="osp-sec-body" hidden>${fields}</div>
    </section>`
  }

  refresh () {
    const body = this.body; if (!body) return
    const keepScroll = body.scrollTop
    this._render(body)
    body.scrollTop = keepScroll   // a preset / reset / undo rebuilds the rows: stay where the person was
  }

  _render (body) {
    const top = body.querySelector('[data-ref="top"]'); const main = body.querySelector('[data-ref="main"]'); const foot = body.querySelector('[data-ref="foot"]')
    const msg = `<div class="oss-msg ${this._msg.err ? 'is-err' : 'is-ok'}" data-ref="msg" role="status" aria-live="polite">${esc(this._msg.text)}</div>`
    const v = this._nodeId ? this.svc.getView(this._nodeId) : null
    if (!v || !v.exists) {
      this._nodeId = null
      top.innerHTML = `<div class="osp-notice" data-testid="osp-nonode">No node is selected. Select a node to edit its sound, or create a sound node.</div>
        <div class="osp-row"><button class="oss-btn" data-act="create" ${tip('Create a sound node', '—', 'Creates a SoundNode in front of the camera and selects it.')}>＋ Create a sound node</button></div>`
      main.innerHTML = ''; foot.innerHTML = msg
      return
    }
    const who = `<div class="osp-who" data-testid="osp-who">♪ <b>${esc(v.label)}</b> · ${v.isSoundNode ? 'sound node' : 'ordinary node'}</div>`
    if (!v.enabled) {
      top.innerHTML = `${who}<div class="osp-notice" data-testid="osp-off">This node has no sound switched on. It stays an ordinary node until you switch it on.</div>
        <div class="osp-row"><button class="oss-btn is-on" data-act="enable" ${tip('Enable sound on this node', '—', 'Gives this node a sound (the default one) and shows all its settings here.')}>♪ Enable sound on this node</button></div>`
      main.innerHTML = ''; foot.innerHTML = msg
      return
    }
    const playing = this.svc.isPlaying(this._nodeId)
    const muted = Settings.engineMuted()
    top.innerHTML = `${who}
      <div class="osp-row" data-ref="transport">
        <button class="oss-btn" data-act="play" ${playing ? 'disabled' : ''} ${tip('Play', '—', 'Starts the sound of this node.')}>▶ Play</button>
        <button class="oss-btn" data-act="stop" ${playing ? '' : 'disabled'} ${tip('Stop', '—', 'Stops the sound (it fades out with its release).')}>■ Stop</button>
        <button class="oss-btn" data-act="audition" ${tip('Audition', '—', 'Plays the sound for 2 seconds, then stops it.')}>◔ Audition 2 s</button>
        <button class="oss-btn ${muted ? 'is-on' : ''}" data-act="mute" aria-pressed="${muted}" ${tip(muted ? 'Sound is muted' : 'Mute sound', '—', 'The speaker: mutes or unmutes ALL sound (the global switch, also in Admin > UI Settings).')}>${muted ? '🔇 Muted' : '🔊 Sound on'}</button>
        <button class="oss-btn" data-act="undo" ${this.svc.canUndo(this._nodeId) ? '' : 'disabled'} ${tip('Undo', '—', 'Takes back the last preset, reset, paste or switch (30 steps).')}>↶ Undo</button>
        <button class="oss-btn" data-act="disable" ${tip('Switch sound off', '—', 'Switches the sound of this node off. The settings are kept.')}>Off</button>
      </div>
      <div class="osp-row">
        <select class="oss-select" data-f="preset" aria-label="Presets" ${tip('Presets', '—', 'Replaces the sound with a ready-made one (pad, pluck, bell, organ, kick, ...). Your label, colour and tags stay. Undo takes it back.')}>
          <option value="">Presets…</option>${Object.entries(SOUND_PRESETS).map(([id, p]) => `<option value="${esc(id)}">${esc(p.label ?? id)}</option>`).join('')}</select>
        <input class="osp-search" type="search" data-f="search" placeholder="Search settings…" value="${esc(this._query)}" aria-label="Search settings" ${tip('Search settings', '—', 'Shows only the settings whose name, key or description contains your text.')}>
      </div>
      <div class="osp-row">
        <button class="oss-btn" data-act="all-open" ${tip('Expand all', '—', 'Opens every section.')}>Expand all</button>
        <button class="oss-btn" data-act="all-close" ${tip('Collapse all', '—', 'Closes every section.')}>Collapse all</button>
        <button class="oss-btn ${this._helpAll ? 'is-on' : ''}" data-act="help-all" aria-pressed="${this._helpAll}" ${tip('Show help', '—', 'Shows or hides the explanation under every setting. Each setting also has a ? button.')}>Help text</button>
      </div>`
    const sv = v.sound
    const pv = v.particles ?? sanitizeParticles({ enabled: false })
    main.innerHTML = `<div class="osp-h">Sound</div>${SOUND_SCHEMA.map(g => this._sectionHTML('sound', g, sv)).join('')}
      <div class="osp-h">Particles${v.particles ? '' : ' (off for this node)'}</div>${PARTICLE_SCHEMA.map(g => this._sectionHTML('particles', g, pv)).join('')}`
    foot.innerHTML = `
      <div class="osp-row">
        <button class="oss-btn" data-act="copy" ${tip('Copy settings', '—', 'Copies the sound and particle settings of this node as JSON text.')}>Copy JSON</button>
        <button class="oss-btn" data-act="paste" ${tip('Paste settings', '—', 'Replaces the settings with JSON text you copied before (from this or another node).')}>Paste JSON</button>
        <button class="oss-btn" data-act="reset-sound" ${tip('Reset all sound', '—', 'Puts every sound setting back to its default.')}>Reset all sound</button>
        <button class="oss-btn" data-act="reset-particles" ${tip('Reset all particles', '—', 'Puts every particle setting back to its default.')}>Reset all particles</button>
      </div>
      <div class="osp-jsonrow" data-ref="jsonrow" hidden><textarea class="oss-text osp-json" data-ref="json" spellcheck="false" aria-label="Settings JSON" ${tip('Settings JSON', '—', 'The sound and particle settings of this node as JSON text. Copy JSON fills it; paste JSON here and press Apply.')} hidden></textarea>
        <button class="oss-btn" data-act="apply-json" ${tip('Apply JSON', '—', 'Reads the JSON in the box and applies it to this node.')}>Apply</button></div>
      ${msg}`
    this._applyFilter()
  }

  /** Update the controls from the node's data without rebuilding (a live edit from elsewhere, the viewer panels, an undo). */
  syncValues () {
    const body = this.body; if (!body || !this._nodeId) return
    const v = this.svc.getView(this._nodeId); if (!v.exists || !v.enabled) { this.refresh(); return }
    const idx = { sound: indexSchema(SOUND_SCHEMA), particles: indexSchema(PARTICLE_SCHEMA) }
    const vals = { sound: v.sound, particles: v.particles ?? sanitizeParticles({ enabled: false }) }
    body.querySelectorAll('[data-osf]').forEach(row => {
      const f = idx[row.dataset.scope]?.get(row.dataset.key)
      if (f) syncRow(row, f, vals[row.dataset.scope][row.dataset.key])
    })
    this._syncTransport()
  }

  _syncTransport () {
    const body = this.body; if (!body || !this._nodeId) return
    const playing = this.svc.isPlaying(this._nodeId)
    const p = body.querySelector('[data-act="play"]'); const s = body.querySelector('[data-act="stop"]')
    if (p) p.disabled = playing
    if (s) s.disabled = !playing
    const m = body.querySelector('[data-act="mute"]')
    if (m) { const muted = Settings.engineMuted(); m.classList.toggle('is-on', muted); m.setAttribute('aria-pressed', String(muted)); m.textContent = muted ? '🔇 Muted' : '🔊 Sound on' }
    const u = body.querySelector('[data-act="undo"]'); if (u) u.disabled = !this.svc.canUndo(this._nodeId)
  }

  /** Show / hide sections and fields for the open state and the search text. */
  _applyFilter () {
    const body = this.body; if (!body) return
    const q = this._query.trim().toLowerCase()
    body.querySelectorAll('.osp-sec').forEach(sec => {
      const rows = sec.querySelectorAll('[data-osf]')
      let any = 0
      rows.forEach(r => { const hit = !q || (r.dataset.q ?? '').includes(q); if (hit) { r.removeAttribute('hidden'); any++ } else r.setAttribute('hidden', '') })
      const open = q ? any > 0 : this._open.has(sec.dataset.sec)
      sec.toggleAttribute('hidden', !!q && any === 0)
      const bodyEl = sec.querySelector('.osp-sec-body'); if (open) bodyEl.removeAttribute('hidden'); else bodyEl.setAttribute('hidden', '')
      const t = sec.querySelector('.osp-sec-toggle'); t.setAttribute('aria-expanded', String(open))
      t.firstChild.textContent = (open ? '▾ ' : '▸ ') + (t.firstChild.textContent || '').replace(/^[▸▾] /, '')
    })
  }
}
