/**
 * ui/OmniScanPanel.js — ⟐OmniScan (V212): a tall inspector-style panel that tells you about whatever sits in the middle circle.
 * Text for people, JSON for developers (the full node record). Pin holds one node; the circle size is adjustable. Reads Extra.SERVICES.scan only.
 * Opened by omni:nav-select '⟐OmniScan' (ribbon, OmniStarLight). Class-A window panel, a bottom sheet on phones.
 */
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { toText, toJSON } from '../utils/OmniScanModel.js'
import { isDevMode } from '../utils/OmniStarLightSites.js'

export const NAV_ITEM = '⟐OmniScan'
export const PANEL_ID = 'omniscan'
const FORMAT_KEY = 'omni:scan:format-v1'
const STYLES = `
.oss-panel.osc-panel, .oss-panel.osc-panel.is-wide { width: 330px; max-width: calc(100vw - 16px); max-height: calc(100vh - 140px); }
.osc-src { font-size: 9.5px; opacity: .75; margin: 2px 0 6px; }
.osc-out { width: 100%; box-sizing: border-box; min-height: 220px; max-height: 52vh; overflow: auto; margin: 4px 0; padding: 8px; border-radius: 6px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); font-size: 10.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; user-select: text; }
.osc-row { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin: 4px 0; }
.osc-row .oss-btn { flex: 1 1 auto; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.osc-panel, .oss-panel.osc-panel.is-wide { width: 100%; max-height: 60vh; } .osc-out { min-height: 120px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('osc-panel-styles')) return
  const s = document.createElement('style'); s.id = 'osc-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const SOURCE_TEXT = { pinned: 'Pinned', circle: 'In the circle', selected: 'Selected (nothing in the circle)' }

export default class OmniScanPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: '⟐OmniScan', iconLabel: '⟐◎', navItems: [NAV_ITEM], className: 'osc-panel' })
    this._fmt = 'text'; this._dev = false; this._on = null; this._els = {}
  }
  onInit () {
    injectStyles(); this._dev = isDevMode()
    try { const f = localStorage.getItem(FORMAT_KEY); this._fmt = f === 'json' || f === 'text' ? f : (this._dev ? 'json' : 'text') } catch (_) { this._fmt = this._dev ? 'json' : 'text' }
    this._on = () => { if (this.isOpen) this.refresh() }
    window.addEventListener('omni:scan-changed', this._on); window.addEventListener('omni:node-updated', this._on)
  }
  buildBody (body) {
    body.innerHTML = `
      <div class="osc-src" data-ref="src"></div>
      <div class="osc-row">
        <button type="button" class="oss-btn" data-act="text" aria-pressed="false">Text</button>
        <button type="button" class="oss-btn" data-act="json" aria-pressed="false">JSON</button>
        <button type="button" class="oss-btn" data-act="pin">Pin</button>
        <button type="button" class="oss-btn" data-act="copy">Copy</button>
      </div>
      <pre class="osc-out" data-ref="out" tabindex="0" aria-live="polite"></pre>
      <div class="oss-row"><label for="osc-r">Circle size</label><input id="osc-r" class="oss-input" type="range" min="3" max="50" step="1" data-ref="r"><span class="oss-dim" data-ref="rv"></span></div>
      <div class="oss-msg oss-dim" data-ref="msg"></div>`
    const q = (r) => body.querySelector(`[data-ref="${r}"]`)
    this._els = { src: q('src'), out: q('out'), r: q('r'), rv: q('rv'), msg: q('msg'), body }
    body.addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-act]'); if (!b) return
      const s = SERVICES.scan
      if (b.dataset.act === 'text' || b.dataset.act === 'json') { this._fmt = b.dataset.act; try { localStorage.setItem(FORMAT_KEY, this._fmt) } catch (_) {}; this.refresh() }
      else if (b.dataset.act === 'pin') { if (!s) return; if (s.pinned) s.unpin(); else if (!s.pin()) this._say('Nothing to pin yet.', true); this.refresh() }
      else if (b.dataset.act === 'copy') this._copy()
    })
    this._els.r.addEventListener('input', () => { SERVICES.scan?.setRadius(Number(this._els.r.value) / 100); this.refresh() })
    this.refresh()
  }
  /** which text is shown right now (also used by tests) */
  currentText () {
    const s = SERVICES.scan; const cur = s?.current?.(); const info = cur?.info
    if (!s) return 'The scan system is not running.'
    if (!info) return 'Nothing in the circle. Look at a node, or select one.'
    return this._fmt === 'json' ? toJSON(this._dev ? info.developer : info.regular) : toText(this._dev ? info.developer : info.regular)
  }
  refresh () {
    const e = this._els; if (!e.out) return
    const s = SERVICES.scan; const cur = s?.current?.()
    e.out.textContent = this.currentText()
    e.src.textContent = !s ? '' : cur?.id ? `${SOURCE_TEXT[cur.source] ?? ''}${s.pinned ? ' · tap Pin to release' : ''}` : 'Waiting for a node'
    const pin = e.body.querySelector('[data-act="pin"]'); if (pin) { pin.textContent = s?.pinned ? 'Unpin' : 'Pin'; pin.classList.toggle('is-on', !!s?.pinned) }
    for (const f of ['text', 'json']) { const b = e.body.querySelector(`[data-act="${f}"]`); if (b) { b.classList.toggle('is-on', this._fmt === f); b.setAttribute('aria-pressed', String(this._fmt === f)) } }
    if (s && document.activeElement !== e.r) e.r.value = String(Math.round(s.radius * 100))
    e.rv.textContent = s ? `${Math.round(s.radius * 100)}%` : ''
  }
  _say (t, err) { const m = this._els.msg; if (m) { m.textContent = t; m.classList.toggle('is-err', !!err) } }
  async _copy () { try { await navigator.clipboard.writeText(this.currentText()); this._say('Copied.') } catch (_) { this._say('Copy is not available here; select the text instead.', true) } }
  onOpened () { this.refresh() }
  onDestroy () { window.removeEventListener('omni:scan-changed', this._on); window.removeEventListener('omni:node-updated', this._on) }
}
