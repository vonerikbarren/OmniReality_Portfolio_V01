/**
 * ui/OmniSoundFields.js — controls GENERATED FROM A SCHEMA (V194), shared by the ⟐SoundNodeSettings panel and the Inspector 'Sound' section.
 *
 * utils/OmniSoundModel.js SOUND_SCHEMA and utils/OmniSoundParticleModel.js PARTICLE_SCHEMA are arrays of groups { id, label, desc, fields:[{ key, label, type, min, max,
 * step, unit, options, default, desc }] }. Nothing here names a setting: a field the model gains later gets a control by itself.
 *
 *   number  a slider + a number input + the unit        enum  a select          bool  a switch (button role=switch)
 *   note    a note name select (+ an octave input when the value carries one: "A4" or a MIDI number; "A" alone has no octave input)
 *   text    a text input                                 color a colour input
 *
 * Every row carries data-osf / data-scope / data-key / data-type, the OmniNotify attributes (data-omni-tip, data-omni-tip-key, data-omni-tip-desc) and a `?`
 * button that shows the field's `desc` as small help text. The Inspector's quick controls use findQuick() to look up the few fields it shows by what they ARE.
 */

import { NOTE_NAMES } from '../utils/OmniSoundModel.js'

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const tip = (name, key, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key || '—')}" data-omni-tip-desc="${esc(desc || name)}"`

const NAMES = Array.isArray(NOTE_NAMES) && NOTE_NAMES.length ? NOTE_NAMES : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const HEX = /^#[0-9a-fA-F]{6}$/
const fin = (n) => Number.isFinite(n)
const prettyNum = (v) => (fin(+v) ? String(Number((+v).toPrecision(7))) : '0')

/** Map key -> field for a schema. */
export function indexSchema (schema) {
  const m = new Map()
  for (const g of schema ?? []) for (const f of g.fields ?? []) m.set(f.key, f)
  return m
}

/** Find a field of a schema: by the first matching key of `keys`, else the first whose key matches `re`, else the first of `type`. Returns the field or null. */
export function findField (schema, { keys = [], re = null, type = null } = {}) {
  const idx = indexSchema(schema)
  for (const k of keys) if (idx.has(k)) return idx.get(k)
  for (const f of idx.values()) if (re && re.test(f.key)) return f
  if (type) for (const f of idx.values()) if (f.type === type) return f
  return null
}

/** The few fields the Inspector shows as quick controls, found in the schema by what they are. Missing ones are null (the control is left out). */
export function findQuick (schema) {
  return {
    note: findField(schema, { keys: ['note'], type: 'note' }),
    dynamic: findField(schema, { keys: ['dynamic', 'dynamics', 'dynamicMark'], re: /dynamic/i }),
    volume: findField(schema, { keys: ['gainDb', 'gain', 'volume'], re: /^(gain|volume)/i }),
    loop: findField(schema, { keys: ['loop'], re: /^loop$/i }),
    spatial: findField(schema, { keys: ['spatial', 'positional'], re: /(spatial|positional)/i }),
  }
}

// ── The note value ("A4", "A", or a MIDI number) ────────────────────────────────────────────────────────────────────

/** { kind:'str-oct'|'str'|'num', name, oct } for a note value. */
export function noteParts (value) {
  if (typeof value === 'number' && fin(value)) {
    const m = Math.round(value)
    return { kind: 'num', name: NAMES[((m % 12) + 12) % 12], oct: Math.floor(m / 12) - 1 }
  }
  const mm = /^\s*([A-Ga-g][#b♯♭]?)\s*(-?\d{1,2})?\s*$/.exec(String(value ?? ''))
  if (mm) {
    let name = mm[1][0].toUpperCase() + (mm[1][1] ?? '').replace('♯', '#').replace('♭', 'b')
    if (!NAMES.includes(name)) { // a flat spelled name -> its sharp twin
      const flat = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' }
      name = flat[name] ?? NAMES[0]
    }
    return mm[2] != null ? { kind: 'str-oct', name, oct: Number(mm[2]) } : { kind: 'str', name, oct: null }
  }
  return { kind: 'str', name: NAMES[0], oct: null }
}
/** The value for a note name + octave in the stored kind. */
export function noteJoin (kind, name, oct) {
  const o = fin(+oct) ? Math.max(-1, Math.min(9, Math.round(+oct))) : 4
  if (kind === 'num') { const i = Math.max(0, NAMES.indexOf(name)); return Math.max(0, Math.min(127, (o + 1) * 12 + i)) }
  return kind === 'str-oct' ? `${name}${o}` : name
}

// ── Rendering ───────────────────────────────────────────────────────────────────────────────────────────────────────

function controlHTML (scope, f, value, id) {
  const t = tip(f.label ?? f.key, f.key, f.desc)
  switch (f.type) {
    case 'number': {
      const min = fin(f.min) ? f.min : 0
      const max = fin(f.max) ? f.max : 1
      const step = fin(f.step) && f.step > 0 ? f.step : (max - min) / 100 || 0.01
      const v = fin(+value) ? +value : (fin(+f.default) ? +f.default : min)
      return `<input class="osf-range" type="range" data-ctl="range" min="${min}" max="${max}" step="${step}" value="${prettyNum(v)}" aria-label="${esc(f.label ?? f.key)} slider" ${t}>
        <input class="osf-num" type="number" id="${id}" data-ctl="num" min="${min}" max="${max}" step="${step}" value="${prettyNum(v)}" aria-label="${esc(f.label ?? f.key)}" ${t}>${f.unit ? `<span class="osf-unit">${esc(f.unit)}</span>` : ''}`
    }
    case 'enum': {
      const opts = Array.isArray(f.options) ? f.options : []
      return `<select class="osf-select" id="${id}" data-ctl="enum" aria-label="${esc(f.label ?? f.key)}" ${t}>${opts.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label ?? o.value)}</option>`).join('')}</select>`
    }
    case 'bool': {
      const on = value === true
      return `<button type="button" class="osf-sw ${on ? 'is-on' : ''}" id="${id}" data-ctl="bool" role="switch" aria-checked="${on}" aria-label="${esc(f.label ?? f.key)}" ${t}></button>`
    }
    case 'note': {
      const p = noteParts(value)
      return `<select class="osf-select osf-note" id="${id}" data-ctl="noteName" aria-label="${esc(f.label ?? f.key)} name" ${t}>${NAMES.map(n => `<option value="${esc(n)}" ${n === p.name ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        ${p.kind === 'str' ? '' : `<input class="osf-num osf-oct" type="number" data-ctl="noteOct" min="-1" max="9" step="1" value="${p.oct}" aria-label="${esc(f.label ?? f.key)} octave" ${t}>`}`
    }
    case 'color': {
      const v = typeof value === 'string' && HEX.test(value) ? value : '#ffffff'
      return `<input class="osf-color" type="color" id="${id}" data-ctl="color" value="${esc(v)}" aria-label="${esc(f.label ?? f.key)}" ${t}>`
    }
    default:
      return `<input class="osf-text" type="text" id="${id}" data-ctl="text" maxlength="80" value="${esc(value ?? '')}" aria-label="${esc(f.label ?? f.key)}" ${t}>`
  }
}

/** One control row. `value` is the current value (the model's sanitized one). */
export function fieldHTML (scope, f, value, { compact = false } = {}) {
  const id = `osf-${scope}-${f.key}`
  const label = f.label ?? f.key
  const known = ['number', 'enum', 'bool', 'note', 'color'].includes(f.type) ? f.type : 'text'
  const nk = known === 'note' ? noteParts(value).kind : ''
  return `<div class="osf-row${compact ? ' is-compact' : ''}" data-osf="1" data-scope="${esc(scope)}" data-key="${esc(f.key)}" data-type="${known}" ${nk ? `data-note-kind="${nk}"` : ''}>
    <div class="osf-head"><label class="osf-label" for="${id}" ${tip(label, f.key, f.desc)}>${esc(label)}</label>${f.desc && !compact ? `<button type="button" class="osf-help-btn" data-osf-help aria-expanded="false" aria-label="Help: ${esc(label)}" ${tip('Help: ' + label, f.key, 'Shows or hides the explanation of this setting.')}>?</button>` : ''}</div>
    <div class="osf-ctl">${controlHTML(scope, f, value, id)}</div>
    ${f.desc && !compact ? `<div class="osf-help" hidden>${esc(f.desc)}</div>` : ''}
  </div>`
}

// ── Reading and updating the DOM ────────────────────────────────────────────────────────────────────────────────────

/** The value a row's controls currently hold, as the schema type (undefined when it cannot be read). `changed` is the control that fired. */
export function readRow (row, f, changed) {
  const q = (c) => row.querySelector(`[data-ctl="${c}"]`)
  switch (row.dataset.type) {
    case 'number': {
      const el = changed && (changed.dataset.ctl === 'num' || changed.dataset.ctl === 'range') ? changed : q('num')
      if (el.value === '' || el.value == null) return undefined
      const n = Number(el.value)
      return fin(n) ? n : undefined
    }
    case 'enum': {
      const el = q('enum'); const opts = Array.isArray(f.options) ? f.options : []
      const o = opts.find(x => String(x.value) === el.value)
      return o ? o.value : undefined
    }
    case 'bool': return q('bool').getAttribute('aria-checked') !== 'true'
    case 'note': return noteJoin(row.dataset.noteKind || 'str', q('noteName').value, q('noteOct')?.value)
    case 'color': return q('color').value
    default: return q('text').value
  }
}

/** Show `value` in a row's controls without firing anything (the control being edited is left alone). */
export function syncRow (row, f, value, force = false) {
  const q = (c) => row.querySelector(`[data-ctl="${c}"]`)
  const idle = (el) => el && (force || typeof document === 'undefined' || document.activeElement !== el)
  switch (row.dataset.type) {
    case 'number': { const v = prettyNum(value); const r = q('range'); const n = q('num'); if (r && idle(r)) r.value = v; if (n && idle(n)) n.value = v; break }
    case 'enum': { const el = q('enum'); if (el && idle(el)) el.value = String(value); break }
    case 'bool': { const el = q('bool'); const on = value === true; el.classList.toggle('is-on', on); el.setAttribute('aria-checked', String(on)); break }
    case 'note': { const p = noteParts(value); const n = q('noteName'); const o = q('noteOct'); if (n && idle(n)) n.value = p.name; if (o && idle(o) && p.oct != null) o.value = String(p.oct); break }
    case 'color': { const el = q('color'); if (el && idle(el) && typeof value === 'string' && HEX.test(value)) el.value = value; break }
    default: { const el = q('text'); if (el && idle(el)) el.value = String(value ?? '') }
  }
}

/**
 * Delegate the controls of `root` (once). `onChange(scope, key, value, row)` is called for every change; the caller stores it and returns the stored value (or
 * an object { ok, value }) so the row can show what the model really kept (clamped). Help buttons are handled here.
 * `schemas` = { sound: SOUND_SCHEMA, particles: PARTICLE_SCHEMA }. Returns an unbind function.
 */
export function wireFields (root, schemas, onChange) {
  const handle = (e, live) => {
    const el = e.target
    const row = el.closest?.('[data-osf]'); if (!row || !root.contains(row)) return
    const f = indexSchema(schemas[row.dataset.scope]).get(row.dataset.key); if (!f) return
    const ctl = el.dataset?.ctl; if (!ctl) return
    if (live && ctl !== 'range') return          // only sliders fire while dragging; the rest on change
    if (!live && ctl === 'range') return          // the slider's final 'change' is covered by its 'input'
    const v = readRow(row, f, el)
    if (v === undefined) return
    const r = onChange(row.dataset.scope, row.dataset.key, v, row)
    const stored = r && typeof r === 'object' && 'value' in r ? r.value : r
    if (stored !== undefined) syncRow(row, f, stored, !live)
  }
  const onInput = (e) => handle(e, true)
  const onChg = (e) => handle(e, false)
  const onClick = (e) => {
    const help = e.target.closest?.('[data-osf-help]')
    if (help && root.contains(help)) {
      const row = help.closest('[data-osf]'); const box = row.querySelector('.osf-help')
      const open = box.hasAttribute('hidden')
      if (open) box.removeAttribute('hidden'); else box.setAttribute('hidden', '')
      help.setAttribute('aria-expanded', String(open))
      return
    }
    const sw = e.target.closest?.('[data-ctl="bool"]')
    if (sw && root.contains(sw)) handle({ target: sw }, false)
  }
  root.addEventListener('input', onInput); root.addEventListener('change', onChg); root.addEventListener('click', onClick)
  return () => { root.removeEventListener('input', onInput); root.removeEventListener('change', onChg); root.removeEventListener('click', onClick) }
}

export const FIELD_STYLES = `
.osf-row { padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
.osf-row[hidden] { display: none; }
.osf-head { display: flex; align-items: center; gap: 6px; }
.osf-label { flex: 1 1 auto; min-width: 0; font-size: 10.5px; }
.osf-ctl { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.osf-range { flex: 1 1 110px; min-width: 80px; accent-color: var(--omni-theme-accent, #c9a3ff); }
.osf-num, .osf-select, .osf-text, .osf-color { min-height: 26px; box-sizing: border-box; padding: 1px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.osf-num { width: 72px; } .osf-oct { width: 56px; } .osf-text { flex: 1 1 140px; min-width: 0; } .osf-color { width: 44px; padding: 0; }
.osf-select { max-width: 100%; } .osf-select option { color: #111; background: #fff; }
.osf-unit { font-size: 9.5px; opacity: .7; min-width: 18px; }
.osf-sw { position: relative; width: 38px; height: 20px; padding: 0; border-radius: 10px; border: 1px solid rgba(255,255,255,.3); background: rgba(255,255,255,.1); cursor: pointer; }
.osf-sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #ddd; transition: left .12s; }
.osf-sw.is-on { background: rgba(127,214,255,.55); border-color: rgba(127,214,255,.9); } .osf-sw.is-on::after { left: 20px; background: #fff; }
.osf-help-btn { width: 18px; height: 18px; padding: 0; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); background: transparent; color: inherit; font-size: 10px; cursor: pointer; opacity: .75; }
.osf-help { margin-top: 2px; font-size: 9.5px; line-height: 1.4; opacity: .75; }
@media (max-width: 700px) { .osf-num, .osf-select, .osf-text { min-height: 40px; } .osf-sw { width: 52px; height: 28px; border-radius: 14px; } .osf-sw::after { width: 22px; height: 22px; } .osf-sw.is-on::after { left: 26px; } .osf-help-btn { width: 32px; height: 32px; } .osf-range { min-height: 32px; } }
`
