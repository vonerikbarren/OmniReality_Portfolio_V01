/**
 * ui/TimeDataRulerSettingsPanel.js — ⟐TimeDataRulerSettings: the USER's settings of the TimeData ruler (V192, Admin)
 *
 * User side of the `<System>Settings` / `Dev<System>Settings` convention: it imports only utils/TimeDataRulerSettings.js and
 * utils/TimeRulerMath.js; there is no Dev counterpart and nothing here imports a Dev* module.
 *
 *   Baseline      the date + time that is 00:00:00 on the ruler (default: local midnight today, recomputed every day);
 *                 buttons Now, Session start, Today 00:00 (back to automatic); invalid input is refused with a message
 *   Lines         week start (ISO / Monday / Sunday), show week / month / year / decade lines, minor notches (off / 30 / 15 / 5 min)
 *   Time passing  animation on / off (off = the marker steps once a minute, no hour pulse), what happens after 24:00 (follow / stop)
 *   Look          line colour, accent colour, dimming of the consumed part, line opacity, Reset
 * Every control applies live (S.updateSettings validates, saves 'omni:timedata-ruler-v1' and announces omni:timedata-ruler-changed).
 * Opened by the nav item '⟐TimeDataRulerSettings' (Admin slot, the ⚙ on the ruler). Window-chrome class A (OmniSettingsPanelBase).
 */

import OmniSettingsPanelBase, { esc } from './OmniSettingsPanelBase.js'
import * as S from '../utils/TimeDataRulerSettings.js'
import { parseBaselineInput, baselineInputs, formatStamp } from '../utils/TimeRulerMath.js'

export const PANEL_ID = 'timedatarulersettings'
export const NAV_ITEM = '⟐TimeDataRulerSettings'
const tip = (name, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="—" data-omni-tip-desc="${esc(desc)}"`

const TOGGLES = [
  ['showWeeks', 'Week lines', 'Draws a line at the start of every week (with its week number).'],
  ['showMonths', 'Month lines', 'Draws a line at the start of every month (with its name).'],
  ['showYears', 'Year lines', 'Draws a line at the start of every year.'],
  ['showDecades', 'Decade years', 'Emphasises every 10th year (2020, 2030 ...) with the longest, heaviest line.'],
]

const EXTRA_STYLES = `
.tdrs-panel input[type=color] { width: 40px; height: 28px; padding: 0; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); border-radius: 5px; background: none; cursor: pointer; }
.tdrs-panel input[type=range] { flex: 1 1 100px; min-width: 0; accent-color: var(--omni-theme-accent, #fff); }
.tdrs-panel input[type=date], .tdrs-panel input[type=time] { width: auto; min-width: 0; color-scheme: dark; }
.tdrs-panel .tdrs-now { font-variant-numeric: tabular-nums; }
@media (max-width: 700px) { .tdrs-panel input[type=color] { height: 40px; width: 48px; } }
`

export default class TimeDataRulerSettingsPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐◷', navItems: [NAV_ITEM], className: 'tdrs-panel', wide: true })
    this._settings = S.getSettings()
    this._h = {}
    this.now = () => Date.now()   // test hook
  }

  onInit () {
    if (typeof document !== 'undefined' && !document.getElementById('tdrs-styles')) {
      const st = document.createElement('style'); st.id = 'tdrs-styles'; st.textContent = EXTRA_STYLES; document.head.appendChild(st)
    }
    this._h.changed = (e) => { if (e.detail?.settings) { this._settings = e.detail.settings; if (this._isOpen) this._sync() } }
    window.addEventListener(S.CHANGED_EVENT, this._h.changed)
  }
  onDestroy () {
    window.removeEventListener(S.CHANGED_EVENT, this._h.changed)
    document.getElementById('tdrs-styles')?.remove()
  }

  say (text, err = false) {
    const m = this.body?.querySelector('[data-ref="msg"]'); if (!m) return
    m.textContent = text; m.className = 'oss-msg ' + (err ? 'is-err' : 'is-ok')
  }

  buildBody (body) {
    const sel = (k, opts, label) => `<select class="oss-select" data-k="${k}" aria-label="${esc(label)}">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>`
    body.innerHTML = `
      <div class="oss-sec">Baseline (00:00:00)</div>
      <div class="oss-row"><label for="tdrs-date">Date</label><input id="tdrs-date" class="oss-input" type="date" data-ref="date" min="1900-01-01" max="2999-12-31" ${tip('Baseline date', 'The day whose time is 00:00:00 on the ruler. Every notch and line is measured from here.')}></div>
      <div class="oss-row"><label for="tdrs-time">Time</label><input id="tdrs-time" class="oss-input" type="time" step="1" data-ref="time" ${tip('Baseline time', 'The time of day that is 00:00:00 on the ruler (24-hour, seconds allowed).')}></div>
      <div class="oss-row">
        <button type="button" class="oss-btn" data-act="apply" ${tip('Set baseline', 'Uses the date and time above as the ruler baseline (it also applies when you leave a field).')}>Set</button>
        <button type="button" class="oss-btn" data-act="now" ${tip('Baseline now', 'Makes this very second the baseline: the ruler starts counting from now.')}>Now</button>
        <button type="button" class="oss-btn" data-act="session" ${tip('Baseline session start', 'Makes the start of this browser session the baseline (the same start the OmniMeter shows).')}>Session start</button>
        <button type="button" class="oss-btn" data-act="auto" ${tip('Baseline automatic', 'Back to the default: local midnight of today, moving on by itself at midnight.')}>Today 00:00</button>
      </div>
      <div class="oss-dim tdrs-now" data-ref="current"></div>
      <div class="oss-msg" data-ref="msg"></div>
      <div class="oss-sec">Lines</div>
      <div class="oss-row"><label>Week start</label>${sel('weekMode', [['iso', 'ISO-8601 (Monday, ISO week numbers)'], ['monday', 'Monday start'], ['sunday', 'Sunday start']], 'Week start')}</div>
      ${TOGGLES.map(([k, l, d]) => `<div class="oss-row"><label for="tdrs-${k}">${esc(l)}</label><input id="tdrs-${k}" type="checkbox" data-k="${k}" ${tip(l, d)}></div>`).join('')}
      <div class="oss-row"><label>Minor notches</label>${sel('minorDensity', [['off', 'Off'], ['30', 'Every 30 min'], ['15', 'Every 15 min'], ['5', 'Every 5 min']], 'Minor notches')}</div>
      <div class="oss-sec">Time passing</div>
      <div class="oss-row"><label for="tdrs-animate">Animation</label><input id="tdrs-animate" type="checkbox" data-k="animate" ${tip('Ruler animation', 'On: the marker moves every second and the hour boundary pulses. Off: it steps once a minute, no pulse. prefers-reduced-motion always turns it off.')}></div>
      <div class="oss-row"><label>After 24:00</label>${sel('rollover', [['follow', 'Move on to the next day'], ['stop', 'Stay on this day (full bar)']], 'After 24:00')}</div>
      <div class="oss-sec">Look</div>
      <div class="oss-row"><label>Line colour</label><input type="color" data-k="lineColor" aria-label="Line colour" ${tip('Line colour', 'Colour of the notches and lines (higher levels get lighter).')}></div>
      <div class="oss-row"><label>Accent colour</label><input type="color" data-k="accentColor" aria-label="Accent colour" ${tip('Accent colour', 'Colour of the baseline, the moving marker, the consumed bar and the decade years.')}></div>
      <div class="oss-row"><label>Consumed dimming</label><input type="range" data-k="pastOpacity" min="10" max="90" step="1" aria-label="Consumed dimming (percent)"><span class="oss-dim" data-out="pastOpacity"></span></div>
      <div class="oss-row"><label>Line opacity</label><input type="range" data-k="lineOpacity" min="30" max="100" step="1" aria-label="Line opacity (percent)"><span class="oss-dim" data-out="lineOpacity"></span></div>
      <div class="oss-sec">Reset</div>
      <div class="oss-row"><button type="button" class="oss-btn is-danger" data-act="reset" ${tip('Reset ruler settings', 'Back to the defaults: baseline today 00:00, ISO weeks, every line shown, 15-minute notches, animation on.')}>Reset everything</button>
        <button type="button" class="oss-btn" data-act="open" ${tip('Open the ruler', 'Opens ⟐TimeDataRuler.')}>Open ruler</button></div>
      <div class="oss-dim">Times use your local calendar: on a daylight-saving day the day window is 23 or 25 real hours long.</div>`
    body.addEventListener('input', (e) => {
      const t = e.target; const k = t.dataset?.k
      if (!k) return
      if (t.type === 'range') this._apply({ [k]: Number(t.value) })
      else if (t.type === 'color') this._apply({ [k]: t.value })
    })
    body.addEventListener('change', (e) => {
      const t = e.target; const k = t.dataset?.k
      if (k) {
        if (t.type === 'checkbox') this._apply({ [k]: !!t.checked })
        else if (t.type !== 'range' && t.type !== 'color') this._apply({ [k]: t.value })
        return
      }
      if (t.dataset?.ref === 'date' || t.dataset?.ref === 'time') this.applyInputs()
    })
    body.addEventListener('click', (e) => {
      const b = e.target.closest?.('button'); if (!b) return
      switch (b.dataset.act) {
        case 'apply': this.applyInputs(); break
        case 'now': this.setBaseline(Math.floor(this.now() / 1000) * 1000, 'Baseline is now.'); break
        case 'session': this.setBaseline(S.sessionStartMs(this.now()), 'Baseline is the session start.'); break
        case 'auto': this._apply({ baselineMs: null }); this.say('Baseline is local midnight of today (automatic).'); break
        case 'reset': S.resetSettings(); this.say('Ruler settings reset.'); break
        case 'open': window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐TimeDataRuler' } })); break
        default:
      }
    })
    this._sync()
  }

  refresh () { this._settings = S.getSettings(); this._sync() }

  _apply (patch) {
    const r = S.updateSettings(patch)
    if (r.rejected.length) this.say(`Refused: ${r.rejected.join(', ')}.`, true)
    return r
  }

  /** Reads the date + time fields; invalid input is refused with a message and nothing changes. */
  applyInputs () {
    const d = this.body?.querySelector('[data-ref="date"]'), t = this.body?.querySelector('[data-ref="time"]')
    if (!d || !t) return { ok: false }
    const r = parseBaselineInput(d.value, t.value)
    if (!r.ok) { this.say(r.error, true); return r }
    this.setBaseline(r.ts, `Baseline set to ${formatStamp(r.ts)}.`)
    return r
  }
  setBaseline (ts, okMsg) {
    const r = this._apply({ baselineMs: ts })
    if (r.applied.includes('baselineMs')) this.say(okMsg)
    else this.say('That moment cannot be used as a baseline.', true)
    return r
  }

  _sync () {
    const body = this.body; if (!body) return
    const s = this._settings
    const set = (sel, v) => { const el = body.querySelector(sel); if (el && el !== document.activeElement && String(el.value) !== String(v)) el.value = v }
    const b = S.resolveBaseline(s, this.now()), inp = baselineInputs(b)
    if (inp) { set('[data-ref="date"]', inp.date); set('[data-ref="time"]', inp.time) }
    const cur = body.querySelector('[data-ref="current"]')
    if (cur) cur.textContent = `Baseline now: ${formatStamp(b)}${S.baselineMode(s) === 'auto' ? ' (automatic: today 00:00)' : ' (chosen)'}`
    for (const k of ['weekMode', 'minorDensity', 'rollover']) set(`[data-k="${k}"]`, s[k])
    for (const [k] of TOGGLES) { const el = body.querySelector(`[data-k="${k}"]`); if (el) el.checked = !!s[k] }
    const an = body.querySelector('[data-k="animate"]'); if (an) an.checked = !!s.animate
    set('[data-k="lineColor"]', s.lineColor); set('[data-k="accentColor"]', s.accentColor)
    set('[data-k="pastOpacity"]', s.pastOpacity); set('[data-k="lineOpacity"]', s.lineOpacity)
    const o1 = body.querySelector('[data-out="pastOpacity"]'); if (o1) o1.textContent = `${s.pastOpacity}%`
    const o2 = body.querySelector('[data-out="lineOpacity"]'); if (o2) o2.textContent = `${s.lineOpacity}%`
  }
}
