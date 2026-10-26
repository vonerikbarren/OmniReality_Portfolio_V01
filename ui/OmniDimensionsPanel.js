/**
 * ui/OmniDimensionsPanel.js — ⟐OmniDimensions (V217): the Axiom (OmniHand's) and Perspective (ConsciousHand's) controls in one place, plus Dimensional Nodes and
 * Dimensional Spaces / Planes. Reads Extra.SERVICES.axioms / dimensional / spaces only. Opened by omni:nav-select '⟐OmniDimensions' (ribbon, OmniStarLight).
 */
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { AXIOMS, getAxiom } from '../data/OmniAxiomData.js'
import { dimPerspectiveOptions } from './OmniDimensionalNodeInspector.js'

export const NAV_ITEM = '⟐OmniDimensions'
export const PANEL_ID = 'omnidimensions'
const STYLES = `
.oss-panel.odm-panel, .oss-panel.odm-panel.is-wide { width: 370px; max-width: calc(100vw - 16px); max-height: calc(100vh - 120px); }
.odm-ax { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
.odm-ax .oss-btn { flex: 1 1 28%; }
.odm-ax .oss-btn.is-on { outline: 2px solid currentColor; }
.odm-h { font-weight: 600; margin: 10px 0 4px; font-size: 11px; opacity: .9; }
.odm-note { font-size: 10px; opacity: .72; margin: 3px 0; line-height: 1.4; }
.odm-sp { border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); border-radius: 8px; padding: 6px; margin: 6px 0; }
.odm-pl { display: flex; gap: 4px; align-items: center; margin: 3px 0; font-size: 11px; }
.odm-pl span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.odm-panel, .oss-panel.odm-panel.is-wide { width: 100%; max-height: 62vh; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('odm-panel-styles')) return
  const s = document.createElement('style'); s.id = 'odm-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default class OmniDimensionsPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: '⟐OmniDimensions', iconLabel: '⟐◇', navItems: [NAV_ITEM], className: 'odm-panel' })
    this._els = {}; this._sel = null; this._evs = []
  }
  onInit () {
    injectStyles()
    const on = (t, fn) => { window.addEventListener(t, fn); this._evs.push([t, fn]) }
    on('omni:node-selected', (e) => { this._sel = e.detail?.node?.id ?? e.detail?.mesh?.userData?.nodeId ?? null; if (this.isOpen) this._renderSpaces() })
    for (const t of ['omni:axiom-changed', 'omni:time-scale-changed']) on(t, () => { if (this.isOpen) this._renderAxioms() })
    for (const t of ['omni:spaces-changed', 'omni:dimensional-changed', 'omni:node-created', 'omni:node-deleted']) on(t, () => { if (this.isOpen) { this._renderNodes(); this._renderSpaces() } })
  }
  buildBody (body) {
    body.innerHTML = `
      <div class="odm-h">Axiom <span class="oss-dim">(the OmniHand's setting)</span></div>
      <div class="odm-ax" data-ref="axioms"></div>
      <div class="odm-h">Perspective <span class="oss-dim">(the ConsciousHand's setting)</span></div>
      <div class="odm-ax" data-ref="persp"></div>
      <div data-ref="mult"></div>
      <div class="odm-note" data-ref="axnote"></div>
      <div class="odm-h">Dimensional nodes</div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="dn-create">+ At the camera</button>
        <button type="button" class="oss-btn" data-act="dn-demo">Scatter demo</button>
        <button type="button" class="oss-btn" data-act="dn-undemo">Remove demo</button></div>
      <div class="odm-note" data-ref="dnnote"></div>
      <div class="odm-h">Dimensional spaces</div>
      <div class="oss-row"><input class="oss-input is-wide" data-ref="spname" placeholder="Name a new space" maxlength="30"><button type="button" class="oss-btn" data-act="sp-create">+ Space</button></div>
      <div data-ref="spaces"></div>
      <div class="oss-msg oss-dim" data-ref="msg"></div>`
    const q = (r) => body.querySelector(`[data-ref="${r}"]`)
    this._els = { body, axioms: q('axioms'), persp: q('persp'), mult: q('mult'), axnote: q('axnote'), dnnote: q('dnnote'), spname: q('spname'), spaces: q('spaces'), msg: q('msg') }
    body.addEventListener('click', (e) => this._click(e))
    body.addEventListener('change', (e) => this._change(e))
    this.refresh()
  }
  _say (t, err) { const m = this._els.msg; if (m) { m.textContent = t; m.classList.toggle('is-err', !!err) } }
  refresh () { if (!this._els.axioms) return; this._renderAxioms(); this._renderNodes(); this._renderSpaces() }

  _renderAxioms () {
    const ax = SERVICES.axioms, e = this._els; if (!e.axioms) return
    if (!ax) { e.axioms.innerHTML = '<span class="oss-dim">The axiom system is not running.</span>'; e.persp.innerHTML = ''; e.mult.innerHTML = ''; return }
    e.axioms.innerHTML = AXIOMS.map(a => `<button type="button" class="oss-btn${a.id === ax.axiom ? ' is-on' : ''}" style="color:${a.color}" data-act="axiom" data-id="${a.id}" aria-pressed="${a.id === ax.axiom}" title="${esc(a.view)}">${a.symbol} ${esc(a.name)}</button>`).join('')
    const a = ax.axiomDef
    e.persp.innerHTML = a.perspectives.map(p => `<button type="button" class="oss-btn${p.id === ax.perspective ? ' is-on' : ''}" style="color:${a.color}" data-act="persp" data-id="${p.id}" aria-pressed="${p.id === ax.perspective}" title="${esc(p.view)}">${esc(p.name)}</button>`).join('')
    const pd = ax.perspectiveDef
    e.mult.innerHTML = pd?.mult ? `<div class="oss-row"><label>${pd.mult.kind === 'loop' ? 'Loop length (s)' : 'Multiplier (×)'}</label><input class="oss-input" type="number" data-act="mult" min="${pd.mult.min}" max="${pd.mult.max}" step="0.5" value="${ax.mult}"></div>` : ''
    const te = ax.timeEffect()
    e.axnote.textContent = `${a.view} ${pd ? '— ' + pd.view : ''}` + (ax.axiom === 'time' ? ` Motion now runs at ×${+te.scale.toFixed(3)}${te.loop ? `, looping every ${te.loop}s` : ''}.` : ' (Only Time changes how things move so far.)')
  }
  _renderNodes () {
    const dn = SERVICES.dimensional, e = this._els; if (!e.dnnote) return
    if (!dn) { e.dnnote.textContent = 'The dimensional node system is not running.'; return }
    const all = dn.list(), shown = all.filter(id => dn.isRevealed(id)).length
    e.dnnote.textContent = `${all.length} dimensional node${all.length === 1 ? '' : 's'} (${dn.demoCount()} demo), ${shown} revealed by this view. Change the axiom or the perspective and watch the cubes open.`
  }
  _renderSpaces () {
    const sp = SERVICES.spaces, e = this._els; if (!e.spaces) return
    if (!sp) { e.spaces.innerHTML = '<span class="oss-dim">The spaces system is not running.</span>'; return }
    const chOpts = (c) => `<option value="">No default channel</option>` + AXIOMS.map(a => `<option value="${a.id}"${c?.axiom === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')
    e.spaces.innerHTML = sp.spaces.length ? sp.spaces.map(s => `<div class="odm-sp" data-sid="${esc(s.id)}">
      <div class="oss-row"><input class="oss-input is-wide" data-act="sp-name" value="${esc(s.name)}" maxlength="30"><button type="button" class="oss-btn" data-act="sp-del" title="Delete this space">×</button></div>
      <div class="oss-row"><label>Default channel</label><select class="oss-select" data-act="sp-ch">${chOpts(s.channel)}</select>
        ${s.channel ? `<select class="oss-select" data-act="sp-chp">${dimPerspectiveOptions(s.channel.axiom, s.channel.perspective)}</select>` : ''}</div>
      ${s.planes.map(p => `<div class="odm-pl" data-pid="${esc(p.id)}"><span>${esc(p.name)} · ${Object.values(s.members).filter(v => v === p.id).length}</span>
        <button type="button" class="oss-btn${p.visible ? ' is-on' : ''}" data-act="pl-vis" aria-pressed="${p.visible}" title="Show or hide this plane's nodes">${p.visible ? '👁' : '—'}</button>
        <button type="button" class="oss-btn${p.locked ? ' is-on' : ''}" data-act="pl-lock" aria-pressed="${p.locked}" title="Lock: behaviours stop moving this plane's nodes">${p.locked ? '🔒' : '🔓'}</button>
        <button type="button" class="oss-btn" data-act="pl-add-sel" title="Put the selected node on this plane" ${this._sel ? '' : 'disabled'}>+ node</button>
        <button type="button" class="oss-btn" data-act="pl-del" title="Delete this plane" ${s.planes.length > 1 ? '' : 'disabled'}>×</button></div>`).join('')}
      <div class="oss-row"><button type="button" class="oss-btn" data-act="pl-create">+ Plane</button>
        <button type="button" class="oss-btn" data-act="sp-unassign" ${this._sel && sp.spaceOf(this._sel)?.space.id === s.id ? '' : 'disabled'}>Take selected node out</button></div>
    </div>`).join('') : '<div class="odm-note">No spaces yet. A space holds planes (layers) of nodes; a plane can be hidden or locked.</div>'
  }

  _click (e) {
    const b = e.target.closest?.('[data-act]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return
    const a = b.dataset.act, ax = SERVICES.axioms, dn = SERVICES.dimensional, sp = SERVICES.spaces
    const sid = b.closest('[data-sid]')?.dataset.sid, pid = b.closest('[data-pid]')?.dataset.pid
    if (a === 'axiom') ax?.setAxiom(b.dataset.id)
    else if (a === 'persp') ax?.setPerspective(b.dataset.id)
    else if (a === 'dn-create') { const r = dn?.create({ select: true }); this._say(r?.ok ? 'Created in front of you, tuned to your current axiom.' : (r?.error ?? 'Not available.'), !r?.ok) }
    else if (a === 'dn-demo') this._say(`${dn?.spawnDemo() ?? 0} demo nodes scattered. Try each axiom, and the Time perspectives.`)
    else if (a === 'dn-undemo') this._say(`${dn?.removeDemo() ?? 0} demo nodes removed.`)
    else if (a === 'sp-create') { const s = sp?.createSpace(this._els.spname.value); if (s) this._els.spname.value = ''; this._say(s ? `Created “${s.name}”.` : 'Could not create a space.', !s) }
    else if (a === 'sp-del') sp?.deleteSpace(sid)
    else if (a === 'pl-create') sp?.addPlane(sid)
    else if (a === 'pl-del') sp?.removePlane(sid, pid)
    else if (a === 'pl-vis') { const p = sp?.space(sid)?.planes.find(x => x.id === pid); if (p) sp.setPlane(sid, pid, { visible: !p.visible }) }
    else if (a === 'pl-lock') { const p = sp?.space(sid)?.planes.find(x => x.id === pid); if (p) sp.setPlane(sid, pid, { locked: !p.locked }) }
    else if (a === 'pl-add-sel') { if (this._sel) this._say(sp?.assign(this._sel, sid, pid) ? 'Added to the plane.' : 'Could not add that node.') }
    else if (a === 'sp-unassign') { if (this._sel) sp?.unassign(this._sel) }
  }
  _change (e) {
    const t = e.target, a = t.dataset?.act; if (!a) return
    const ax = SERVICES.axioms, sp = SERVICES.spaces, sid = t.closest('[data-sid]')?.dataset.sid
    if (a === 'mult') ax?.setMult(t.value)
    else if (a === 'sp-name') sp?.renameSpace(sid, t.value)
    else if (a === 'sp-ch') sp?.setChannel(sid, t.value ? { axiom: t.value, perspective: '*' } : null)
    else if (a === 'sp-chp') { const s = sp?.space(sid); if (s?.channel) sp.setChannel(sid, { axiom: s.channel.axiom, perspective: t.value }) }
  }
  onOpened () { this.refresh() }
  onDestroy () { for (const [t, h] of this._evs) window.removeEventListener(t, h); this._evs = [] }
}
