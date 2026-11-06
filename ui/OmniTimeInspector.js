/**
 * ui/OmniTimeInspector.js (V259) — the "TimeNode" section of the Inspector, shown under the poly block for a TimeCube.
 * Every field of the cube's entry (title, notes, start/end date and time, zone, clock, rate, repeat, chain, loop) plus Activate / Halt / Resume / Reset / Replay,
 * its sequence, and a calendar view picker (all 14 spans + custom). Everything goes through SERVICES.timenodes (systems/OmniTimeNodes.js): this file imports no system.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { SPANS, SPAN_INFO, REPEATS, UNITS, humanDuration, stateOf } from '../utils/OmniTimeModel.js'
import { esc } from './OmniSoundFields.js'

const svc = () => SERVICES.timenodes
const STYLES = `
.oitm-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.oitm-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.oitm-in { min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: var(--omni-theme-input-bg, rgba(255,255,255,.07)); border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,.2)); border-radius: 5px; }
.oitm-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.oitm-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .oitm-msg.is-err { color: #ff9c9c; }
.oitm-cal { font-size: 10px; line-height: 1.5; max-height: 160px; overflow: auto; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.15)); border-radius: 5px; padding: 4px 6px; }
@media (max-width: 700px) { .oitm-row .oi-btn-small, .oitm-in { min-height: 40px; } }
`
function injectStyles () { if (typeof document === 'undefined' || document.getElementById('oitm-styles')) return; const s = document.createElement('style'); s.id = 'oitm-styles'; s.textContent = STYLES; document.head.appendChild(s) }
const FIELDS = [['title', 'Title', 'text'], ['startDate', 'Start date', 'date'], ['startTime', 'Start time', 'time'], ['endDate', 'End date', 'date'], ['endTime', 'End time', 'time'], ['zone', 'Zone', 'text']]

/** Run one action; returns { ok, text }. Exported so the tests call the same code the buttons do. */
export function runTimeAction (act, id, arg = null) {
  const s = svc(); if (!s) return { ok: false, text: 'The time system is not running.' }
  if (!s.isTime(id)) return { ok: false, text: 'This is not a TimeCube.' }
  const done = (r, text) => (r?.ok === false ? { ok: false, text: r.error } : { ok: true, text })
  switch (act) {
    case 'activate': case 'halt': case 'resume': case 'reset': case 'replay': return done(s[act](id), act[0].toUpperCase() + act.slice(1) + 'd.')
    case 'toggle-halt': return done(s.toggleHalt(id), 'Done.')
    case 'next': { const r = s.createCube({ after: id, title: 'Next' }); return done(r, 'Added a cube to the sequence.') }
    case 'set': return done(s.setEntry(id, arg ?? {}), 'Saved.')
    case 'view': { const v = s.view(String(arg?.span ?? '7d'), { sequence: s.get(id).sequence, zone: s.entry(id).zone, customDays: Number(arg?.days ?? 30) }); return { ok: true, text: `${v.range.label}: ${v.columns.length} ${v.range.unit}s`, view: v } }
    default: return { ok: false, text: 'Unknown action.' }
  }
}
function calHTML (v) { const rows = v.columns.filter(c => c.items.length).map(c => `<div><b>${esc(c.label)}</b> ${c.items.map(i => esc(i.title || i.entryId)).join(', ')}</div>`); return rows.length ? rows.join('') : '<div style="opacity:.6">Nothing in this view.</div>' }
function stateLine (id) { const s = svc(); const e = s?.entry(id); if (!e) return 'Not a TimeCube.'; const st = stateOf(e, s.now()); return `${st.status} · ${Math.round(st.progress * 100)}% · ${st.fulfilled ? 'fulfilled' : 'left ' + humanDuration(st.remainingMs)} · sequence of ${s.sequenceOf(id).length}` }

export function timeKindBlockHTML (data) {
  injectStyles(); const s = svc(); const e = s?.entry(data.id); if (!e) return ''
  const fields = FIELDS.map(([k, label, type]) => `<div class="oitm-row"><span class="oi-label" style="min-width:64px">${label}</span><input class="oitm-in" ${type === 'text' ? 'type="text"' : `type="${type}"`} data-oitm="${k}" value="${esc(e[k])}" aria-label="${label}" style="flex:1"></div>`).join('')
  const spans = SPANS.map(k => `<option value="${k}"${k === '7d' ? ' selected' : ''}>${esc(SPAN_INFO[k].label)}</option>`).join('')
  const reps = REPEATS.map(k => `<option value="${k}"${e.repeat.every === k ? ' selected' : ''}>${k}</option>`).join('')
  const units = UNITS.map(k => `<option value="${k}">${k}</option>`).join('')
  return `<div class="oi-custom-section" id="oi-custom-time" data-oitm-root data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">◷ TimeNode</div>
    <div class="oitm-note" data-testid="oitm-state">${esc(stateLine(data.id))}</div>
    ${fields}
    <div class="oitm-row"><span class="oi-label" style="min-width:64px">Notes</span><textarea class="oitm-in" data-oitm="notes" rows="2" aria-label="Notes" style="flex:1">${esc(e.notes)}</textarea></div>
    <div class="oitm-row"><span class="oi-label" style="min-width:64px">Clock</span><select class="oitm-in" data-oitm="bind" aria-label="Clock"><option value="node"${e.bind === 'node' ? ' selected' : ''}>The calendar</option><option value="own"${e.bind === 'own' ? ' selected' : ''}>Its own (starts when activated)</option></select>
      <span class="oi-label">Speed ×</span><input class="oitm-in" type="number" data-oitm="rate" min="0.01" max="10000" step="0.5" value="${e.rate}" style="width:70px" aria-label="Speed"></div>
    <div class="oitm-row"><span class="oi-label" style="min-width:64px">Repeat</span><select class="oitm-in" data-oitm="repeatEvery" aria-label="Repeat">${reps}</select><span class="oi-label">times</span><input class="oitm-in" type="number" data-oitm="repeatTimes" min="0" max="1000" value="${e.repeat.times}" style="width:60px" aria-label="Repeat times (0 = forever)"></div>
    <div class="oitm-row"><label><input type="checkbox" data-oitm="chain"${e.chain ? ' checked' : ''}> Start when the cube before is fulfilled</label></div>
    <div class="oitm-row"><label><input type="checkbox" data-oitm="loop"${e.loop ? ' checked' : ''}> Loop (for analysis)</label></div>
    <div class="oitm-row"><button class="oi-btn-small" data-oitma="activate">▶ Activate</button><button class="oi-btn-small" data-oitma="toggle-halt">❚❚ Halt / resume</button><button class="oi-btn-small" data-oitma="reset">↺ Reset</button><button class="oi-btn-small" data-oitma="replay">⟲ Replay</button></div>
    <div class="oitm-row"><button class="oi-btn-small" data-oitma="next">＋ Add the next cube to this sequence</button></div>
    <div class="oitm-row"><span class="oi-label" style="min-width:64px">Calendar</span><select class="oitm-in" data-oitmv="span" aria-label="Calendar view">${spans}</select><input class="oitm-in" type="number" data-oitmv="days" min="1" max="36500" value="45" style="width:60px" aria-label="Custom days"></div>
    <div class="oitm-cal" data-ref="oitm-cal" aria-live="polite"></div>
    <div class="oitm-row"><span class="oi-label" style="min-width:64px">Filter</span><select class="oitm-in" data-oitmf="unit" aria-label="Filter unit">${units}</select><span class="oitm-note" style="margin:0">hour, minute, day, week, month or year: Omni Time filter unit(...) key(...)</span></div>
    <div class="oitm-msg" role="status" aria-live="polite" data-ref="oitm-msg"></div>
    <div class="oitm-note">Press a side of the cube for its panel. Halting stops just this cube; its icosahedron pauses and glows.</div>
  </div>`
}
export function wireTimeKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-time'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const say = (r) => { const m = sec.querySelector('[data-ref="oitm-msg"]'); if (m) { m.textContent = r.text; m.className = 'oitm-msg' + (r.ok ? '' : ' is-err') } }
  const paintCal = () => { const sp = sec.querySelector('[data-oitmv="span"]'); const dy = sec.querySelector('[data-oitmv="days"]'); const r = runTimeAction('view', data.id, { span: sp.value, days: dy.value }); const c = sec.querySelector('[data-ref="oitm-cal"]'); if (c && r.view) c.innerHTML = `<div style="opacity:.7">${esc(r.text)}</div>` + calHTML(r.view) }
  const tick = () => { const st = sec.querySelector('[data-testid="oitm-state"]'); if (st && sec.isConnected) st.textContent = stateLine(data.id) }
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oitma]'); if (!b || b.disabled) return; say(runTimeAction(b.dataset.oitma, data.id)); tick(); paintCal() })
  sec.addEventListener('change', (e) => {
    const el = e.target; if (el.dataset?.oitmv) return paintCal()
    const k = el.dataset?.oitm; if (!k) return
    let patch
    if (k === 'repeatEvery' || k === 'repeatTimes') { const e0 = svc().entry(data.id); patch = { repeat: { every: k === 'repeatEvery' ? el.value : e0.repeat.every, times: k === 'repeatTimes' ? Number(el.value) : e0.repeat.times } } } else if (el.type === 'checkbox') { patch = { [k]: el.checked } } else if (k === 'rate') { patch = { rate: Number(el.value) } } else { patch = { [k]: el.value } }
    say(runTimeAction('set', data.id, patch)); tick(); paintCal()
  })
  paintCal()
  if (typeof window !== 'undefined') { const h = () => tick(); window.addEventListener('omni:time-status', h); window.addEventListener('omni:time-changed', h); const obs = new MutationObserver(() => { if (!sec.isConnected) { window.removeEventListener('omni:time-status', h); window.removeEventListener('omni:time-changed', h); obs.disconnect() } }); obs.observe(document.body, { childList: true, subtree: true }) }
}
