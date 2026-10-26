/**
 * ui/OmniStoreMoneyUI.js — the "Money" tab of the USER's ⟐OmniStoreSettings panel (V208)
 *
 * Turn world currencies on or off for the sandbox. A currency that is ON is a normal value type: it shows in the wallet and in the exchange wheel,
 * can be used to price a catalog product and to pay for one (anything convertible goes through USD (sim)). Imports only the model and utils/OmniCurrencies.js.
 * Rates are starter values, not live; an ON currency's rate can be edited here. Nothing is real money.
 */
import * as Val from '../utils/OmniValueModel.js'
import * as Cur from '../utils/OmniCurrencies.js'
import { esc } from './OmniSettingsPanelBase.js'

const STYLES = `
.omy .omy-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 5px 4px; border-bottom: 1px solid rgba(255,255,255,.1); }
.omy .omy-row.is-on { background: rgba(255,255,255,.07); border-radius: 8px; }
.omy .omy-em { flex: 0 0 auto; width: 28px; text-align: center; font-size: 20px; line-height: 1; }
.omy .omy-main { flex: 1 1 130px; min-width: 0; } .omy .omy-main b { font-weight: bold; } .omy .omy-sub { display: block; font-size: 10px; opacity: .72; }
.omy .omy-rate { width: 96px; } .omy [hidden] { display: none; }
@media (max-width: 700px) { .omy .oss-btn { min-height: 36px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omy-styles')) return
  const s = document.createElement('style'); s.id = 'omy-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const fmtRate = (x) => String(+(+x).toPrecision(6))

export default class OmniStoreMoneyUI {
  constructor () { this.root = null; this.s = { filter: '', msg: '', cls: '' }; this._onChanged = (e) => { if (this.root && e?.detail?.kind !== 'grant') this.render() }; this._inited = false }

  mount (container) {
    injectStyles()
    this.root = document.createElement('div'); this.root.className = 'omy'
    container.appendChild(this.root)
    this.root.addEventListener('click', (e) => this._click(e))
    this.root.addEventListener('input', (e) => { if (e.target?.dataset?.field === 'filter') { this.s.filter = e.target.value; this.render(true) } })
    this.root.addEventListener('change', (e) => { const t = e.target; if (t?.dataset?.field === 'rate') this._rate(t.dataset.code, t.value) })
    window.addEventListener(Val.CHANGED_EVENT, this._onChanged); this._inited = true
    this.render()
  }
  destroy () { if (this._inited) window.removeEventListener(Val.CHANGED_EVENT, this._onChanged); this._inited = false; this.root?.remove(); this.root = null }
  refresh () { if (this.root) this.render() }
  say (text, cls = '') { this.s.msg = text; this.s.cls = cls; const m = this.root?.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'oss-msg ' + cls } }

  _click (e) {
    const b = e.target.closest('[data-act]'); if (!b) return
    const act = b.dataset.act, code = b.dataset.code
    if (act === 'cur-toggle') {
      const c = Cur.find(code); if (!c) return
      const r = Cur.isEnabled(code) ? Cur.disable(code) : Cur.enable(code)
      this.render(); this.say(r.ok ? `${c.name} is ${Cur.isEnabled(code) ? 'on' : 'off'}.` : r.error, r.ok ? 'is-ok' : 'is-err')
    } else if (act === 'cur-main') { const r = Cur.enableMany(Cur.MAIN); this.render(); this.say(r.failed.length ? `Turned on ${r.on}; ${r.failed.length} could not be added.` : 'The ten main currencies are on.', r.failed.length ? 'is-err' : 'is-ok') }
    else if (act === 'cur-off') { let off = 0, held = 0; for (const k of Cur.enabledCodes()) { const r = Cur.disable(k); if (r.ok) off++; else held++ } this.render(); this.say(`Turned off ${off}${held ? `; ${held} stay on because your wallet holds some` : ''}.`, held ? '' : 'is-ok') }
  }
  _rate (code, v) {
    const ok = Cur.setRate(code, Number(v)); const c = Cur.find(code)
    this.render(); this.say(ok ? `${c.name}: 1 USD = ${fmtRate(Cur.perUsd(code))} ${code.toUpperCase()}.` : 'That rate is not valid.', ok ? 'is-ok' : 'is-err')
  }

  render (keepFocus = false) {
    if (!this.root) return
    const f = this.s.filter.trim().toLowerCase()
    const on = Cur.enabledCodes()
    const rows = (group) => Cur.CURRENCIES.filter(c => c.group === group && (!f || c.code.includes(f) || c.name.toLowerCase().includes(f))).map(c => {
      const isOn = Cur.isEnabled(c.code); const held = isOn ? Val.getBalance(Cur.typeId(c.code)) : 0
      return `<div class="omy-row${isOn ? ' is-on' : ''}" role="listitem" data-cur="${c.code}">
        <span class="omy-em" aria-hidden="true">${esc(c.emoji)}</span>
        <span class="omy-main"><b>${esc(c.name)}</b> <span class="oss-dim">${c.code.toUpperCase()} ${esc(c.symbol)}</span>
          <span class="omy-sub">${isOn ? `1 USD = ${fmtRate(Cur.perUsd(c.code))} ${c.code.toUpperCase()}${held > 0 ? ` · you hold ${esc(Cur.format(c.code, held))}` : ''}` : `starts at 1 USD = ${fmtRate(c.per[0] / c.per[1])} ${c.code.toUpperCase()}`}</span></span>
        ${isOn ? `<input class="oss-input omy-rate" type="number" min="0.000001" step="any" value="${fmtRate(Cur.perUsd(c.code))}" data-field="rate" data-code="${c.code}" aria-label="${esc(c.name)} per 1 USD">` : ''}
        <button type="button" class="oss-btn${isOn ? ' is-on' : ''}" role="switch" aria-checked="${isOn}" data-act="cur-toggle" data-code="${c.code}" aria-label="${esc(c.name)} ${isOn ? 'on' : 'off'}">${isOn ? 'On' : 'Off'}</button></div>`
    }).join('')
    const fiat = rows('fiat'), dig = rows('digital')
    const active = document.activeElement
    const hadFilter = keepFocus && active?.dataset?.field === 'filter'
    this.root.innerHTML = `
      <div class="oss-dim">Choose which world currencies exist in your sandbox. ${esc(Cur.RATE_NOTE)}</div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="cur-main">Turn on the main 10</button><button type="button" class="oss-btn" data-act="cur-off"${on.length ? '' : ' disabled'}>Turn all off</button><span class="oss-dim">${on.length} on</span></div>
      <div class="oss-row"><input class="oss-input is-wide" type="search" data-field="filter" placeholder="Search currencies" value="${esc(this.s.filter)}" aria-label="Search currencies"></div>
      <div class="oss-msg ${this.s.cls}" data-ref="msg" role="status" aria-live="polite">${esc(this.s.msg)}</div>
      ${fiat ? `<div class="oss-sec">${Cur.GROUPS.fiat}</div><div role="list">${fiat}</div>` : ''}
      ${dig ? `<div class="oss-sec">${Cur.GROUPS.digital}</div><div role="list">${dig}</div>` : ''}
      ${!fiat && !dig ? '<div class="oss-dim">No currency matches.</div>' : ''}
      <div class="oss-dim" style="font-size:10px">A currency that is on appears in your wallet and the exchange wheel. Get some by converting from another form, or price a catalog product in it (Catalog tab). Turning one off needs an empty balance. Sandbox only.</div>`
    if (hadFilter) { const el = this.root.querySelector('[data-field="filter"]'); el?.focus(); try { el.setSelectionRange(el.value.length, el.value.length) } catch (_) {} }
  }
}
