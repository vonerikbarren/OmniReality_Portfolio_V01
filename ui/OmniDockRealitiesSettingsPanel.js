/**
 * ui/OmniDockRealitiesSettingsPanel.js — ⟐OmniDockRealitiesSettings: the USER's panel for the OmniDock_Realities strip (V191)
 *
 * User side of the `<System>Settings` / `Dev<System>Settings` convention: it imports only utils/OmniDockRealitiesSettings.js (data)
 * and utils/OmniGeometryCensus.js; there is no Dev counterpart yet and nothing here imports a Dev* module.
 *
 *   Row        show / hide the strip, icon size (S / M / L presets + a 60..160 % slider), opacity, hide shapes with 0 nodes
 *   Per shape  a colour input + an opacity slider + a reset button for each of the 20 main geometries
 *   Compass    "Dock compass" puts the userCompass back at the left end of the row (omni:user-compass-set { resetPos:true })
 *   Reset      everything back to the defaults
 *
 * Every control sends `omni:dock-realities-set` and applies at once (the dock is the authority: it validates, clamps and saves
 * 'omni:dock-realities-v1', then answers with `omni:dock-realities-changed`, which this panel and the Admin block follow).
 * Opened by the nav item '⟐OmniDockRealitiesSettings', by the ⚙ on the strip (omni:dock-realities-open-settings) and by the Admin block.
 * Window-chrome class A (via OmniSettingsPanelBase -> WindowManager.register). Also exports the small Admin > UI Settings block
 * (adminRowsHtml / bindAdminRows) so ui/AdminPanel.js only needs two lines.
 */

import OmniSettingsPanelBase, { esc } from './OmniSettingsPanelBase.js'
import * as S from '../utils/OmniDockRealitiesSettings.js'
import { GEOMETRIES, wireframeOf, projectWireframe, toPathData } from '../utils/OmniGeometryCensus.js'

export const PANEL_ID = 'omnidockrealitiessettings'
export const NAV_ITEM = '⟐OmniDockRealitiesSettings'
const COMPASS_SET_EVENT = 'omni:user-compass-set'      // utils/OmniUserCompassSettings.js SET_EVENT (kept literal: no cross import needed here)

const EXTRA_STYLES = `
.odrs-geo { display: grid; grid-template-columns: 26px 1fr 34px 84px 26px; gap: 6px; align-items: center; margin: 3px 0; }
.odrs-geo svg { width: 26px; height: 26px; } .odrs-geo svg path { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.odrs-geo input[type=color] { width: 34px; height: 26px; padding: 0; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); border-radius: 5px; background: none; cursor: pointer; }
.odrs-geo input[type=range], .odrs-row input[type=range] { width: 100%; min-width: 0; accent-color: var(--omni-theme-accent, #fff); }
.odrs-geo .oss-btn { min-height: 26px; padding: 0 6px; }
.odrs-seg { display: inline-flex; gap: 4px; }
@media (max-width: 700px) { .odrs-geo { grid-template-columns: 26px 1fr 40px 70px 34px; } .odrs-geo input[type=color] { height: 34px; width: 40px; } .odrs-geo .oss-btn { min-height: 34px; } }
`

const send = (detail) => window.dispatchEvent(new CustomEvent(S.SET_EVENT, { detail }))
const tip = (name, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="—" data-omni-tip-desc="${esc(desc)}"`

export default class OmniDockRealitiesSettingsPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐D', navItems: [NAV_ITEM], className: 'odrs-panel', wide: true })
    this._settings = S.resolveSettings(S.loadOverrides())
    this._h = {}
  }

  onInit () {
    if (typeof document !== 'undefined' && !document.getElementById('odrs-styles')) {
      const st = document.createElement('style'); st.id = 'odrs-styles'; st.textContent = EXTRA_STYLES; document.head.appendChild(st)
    }
    this._h.changed = (e) => { if (e.detail?.settings) { this._settings = e.detail.settings; if (this._isOpen) this._sync() } }
    this._h.open = () => this.open()
    window.addEventListener(S.CHANGED_EVENT, this._h.changed)
    window.addEventListener(S.OPEN_SETTINGS_EVENT, this._h.open)
  }

  onDestroy () {
    window.removeEventListener(S.CHANGED_EVENT, this._h.changed)
    window.removeEventListener(S.OPEN_SETTINGS_EVENT, this._h.open)
    document.getElementById('odrs-styles')?.remove()
  }

  buildBody (body) {
    const s = this._settings
    body.innerHTML = `
      <div class="oss-sec">The strip</div>
      <div class="oss-row odrs-row"><label for="odrs-show">Show OmniDock_Realities</label><input id="odrs-show" type="checkbox" data-k="show" ${tip('Show the strip', 'Hides the dock completely, or shows it again where you put it.')}></div>
      <div class="oss-row odrs-row"><label for="odrs-edge">Where it sits</label><select id="odrs-edge" data-k="edge" aria-label="Where the dock sits">${S.EDGES.map(k => `<option value="${k}">${{ bottom: 'Bottom', top: 'Top', left: 'Left', right: 'Right', panel: 'Floating panel' }[k]}</option>`).join('')}</select></div>
      <div class="oss-row odrs-row"><label>Icon size</label>
        <span class="odrs-seg">${Object.keys(S.SIZE_PRESETS).map(k => `<button type="button" class="oss-btn" data-preset="${k}" ${tip('Size ' + k, 'Small / Medium / Large icons. The size also follows the screen width.')}>${k}</button>`).join('')}</span>
        <input type="range" data-k="size" min="${S.SIZE_MIN}" max="${S.SIZE_MAX}" step="1" aria-label="Icon size (percent)" value="${s.size}"><span class="oss-dim" data-out="size"></span></div>
      <div class="oss-row odrs-row"><label>Opacity</label><input type="range" data-k="opacity" min="${S.OPACITY_MIN}" max="${S.OPACITY_MAX}" step="1" aria-label="Opacity (percent)" value="${s.opacity}"><span class="oss-dim" data-out="opacity"></span></div>
      <div class="oss-row odrs-row"><label for="odrs-hide">Hide shapes with 0 nodes</label><input id="odrs-hide" type="checkbox" data-k="hideEmpty"></div>
      <div class="oss-sec">Each shape</div>
      <div data-geos>${GEOMETRIES.map(g => `
        <div class="odrs-geo" data-geo="${g.id}">
          <svg viewBox="0 0 40 40" aria-hidden="true"><path d="${toPathData(projectWireframe(wireframeOf(g.id), { size: 40, pad: 3 }))}"/></svg>
          <span>${esc(g.label)}</span>
          <input type="color" data-gk="color" aria-label="${esc(g.label)} colour" value="${s.geo[g.id].color}">
          <input type="range" data-gk="opacity" min="${S.OPACITY_MIN}" max="${S.OPACITY_MAX}" step="1" aria-label="${esc(g.label)} opacity" value="${s.geo[g.id].opacity}">
          <button type="button" class="oss-btn" data-reset-geo="${g.id}" aria-label="Reset ${esc(g.label)}" ${tip('Reset ' + g.label, 'Puts this shape back to its default colour and opacity.')}>↺</button>
        </div>`).join('')}</div>
      <div class="oss-sec">userCompass</div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="compass" ${tip('Dock compass', 'Puts the userCompass back at the left end of this row (its saved spot is forgotten until you drag it again).')}>Dock compass</button></div>
      <div class="oss-sec">Reset</div>
      <div class="oss-row"><button type="button" class="oss-btn is-danger" data-act="reset" ${tip('Reset OmniDock_Realities', 'Back to the defaults: shown, medium, 90 % opacity and the default colour of every shape.')}>Reset everything</button></div>
      <div class="oss-msg oss-dim">The strip scrolls sideways. Click a shape for the list of its realities; hover (or tap once on a phone) for the number of nodes.</div>`
    body.addEventListener('input', (e) => {
      const t = e.target
      if (t.dataset.k === 'show' || t.dataset.k === 'hideEmpty' || t.dataset.k === 'edge') return
      if (t.dataset.k) send({ patch: { [t.dataset.k]: Number(t.value) } })
      else if (t.dataset.gk) send({ geo: { id: t.closest('[data-geo]').dataset.geo, [t.dataset.gk]: t.dataset.gk === 'opacity' ? Number(t.value) : t.value } })
    })
    body.addEventListener('change', (e) => {
      const t = e.target
      if (t.dataset.k === 'show' || t.dataset.k === 'hideEmpty') send({ patch: { [t.dataset.k]: !!t.checked } })
      else if (t.dataset.k === 'edge') send({ patch: { edge: t.value } })
    })
    body.addEventListener('click', (e) => {
      const b = e.target.closest?.('button'); if (!b) return
      if (b.dataset.preset) send({ patch: { size: S.SIZE_PRESETS[b.dataset.preset] } })
      else if (b.dataset.resetGeo) send({ resetGeo: b.dataset.resetGeo })
      else if (b.dataset.act === 'reset') send({ reset: true })
      else if (b.dataset.act === 'compass') window.dispatchEvent(new CustomEvent(COMPASS_SET_EVENT, { detail: { resetPos: true } }))
    })
    this._sync()
  }

  refresh () { this._settings = S.resolveSettings(S.loadOverrides()); this._sync() }

  /** Controls -> follow the settings the dock reports. */
  _sync () {
    const body = this.body; if (!body) return
    const s = this._settings
    const set = (sel, v) => { const el = body.querySelector(sel); if (el && el !== document.activeElement && String(el.value) !== String(v)) el.value = v }
    body.querySelector('[data-k="show"]').checked = !!s.show
    body.querySelector('[data-k="hideEmpty"]').checked = !!s.hideEmpty
    set('[data-k="edge"]', s.edge)
    set('[data-k="size"]', s.size); set('[data-k="opacity"]', s.opacity)
    body.querySelector('[data-out="size"]').textContent = `${s.size}%${S.presetFor(s.size) ? ' · ' + S.presetFor(s.size) : ''}`
    body.querySelector('[data-out="opacity"]').textContent = `${s.opacity}%`
    body.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('is-on', S.presetFor(s.size) === b.dataset.preset))
    for (const row of body.querySelectorAll('[data-geo]')) {
      const g = s.geo[row.dataset.geo]
      set(`[data-geo="${row.dataset.geo}"] [data-gk="color"]`, g.color); set(`[data-geo="${row.dataset.geo}"] [data-gk="opacity"]`, g.opacity)
      row.style.color = g.color
    }
  }
}

// ── Admin > UI Settings block ────────────────────────────────────────────────────────────────────────────────────────────────

/** HTML of the small OmniDock_Realities block for Admin > UI Settings (uses the Admin panel's own ap-* classes). */
export function adminRowsHtml () {
  const s = S.resolveSettings(S.loadOverrides())
  return `
        <div class="ap-subhead" data-odr-section="1">OmniDock_Realities</div>
        <div class="ap-row"><span class="ap-row-label">Show</span><button class="ap-toggle ${s.show ? 'is-on' : ''}" data-odr="show" role="switch" aria-checked="${s.show}" aria-label="Show OmniDock_Realities" ${tip('Show OmniDock_Realities', 'Shows or hides the row of wireframe shapes above the Dock.')}></button></div>
        <div class="ap-row"><span class="ap-row-label">Settings</span><button class="ap-file-btn" id="ap-odr-open" type="button" ${tip('OmniDock_Realities settings', 'Icon size, opacity and a colour for every shape.')}>Open settings</button></div>
        <div class="ap-row"><span class="ap-row-label">Dock compass</span><button class="ap-file-btn" id="ap-odr-compass" type="button" ${tip('Dock compass', 'Puts the userCompass back at the left end of the OmniDock_Realities row.')}>Dock compass</button></div>`
}

/** Wires the block; returns an unbind function. */
export function bindAdminRows (body) {
  const t = body.querySelector('[data-odr="show"]')
  t?.addEventListener('click', (e) => send({ patch: { show: !e.currentTarget.classList.contains('is-on') } }))
  body.querySelector('#ap-odr-open')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent(S.OPEN_SETTINGS_EVENT)))
  body.querySelector('#ap-odr-compass')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent(COMPASS_SET_EVENT, { detail: { resetPos: true } })))
  const on = (e) => { const c = e.detail?.settings; if (c && t) { t.classList.toggle('is-on', !!c.show); t.setAttribute('aria-checked', String(!!c.show)) } }
  window.addEventListener(S.CHANGED_EVENT, on)
  return () => window.removeEventListener(S.CHANGED_EVENT, on)
}
