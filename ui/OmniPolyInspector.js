/**
 * ui/OmniPolyInspector.js — the Inspector block of a PolyNode (V204), shown in Appearance next to the other kinds' blocks (ui/OmniExtraKindInspector.js).
 * A state line, the shape, the edge size and 'Open ⟐OmniPoly'. Everything is read and written through Extra.SERVICES.poly (systems/OmniPolyNodes.js), so this file imports no system.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { describePoly } from '../utils/OmniPolyModel.js'
import { SHAPE_INFO } from '../utils/OmniPolyGeom.js'
import { esc } from './OmniSoundFields.js'

const NAV_ITEM = '⟐OmniPoly'
const svc = () => SERVICES.poly
const STYLES = `
.oipy-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.oipy-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.oipy-in { min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.oipy-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.oipy-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .oipy-msg.is-err { color: #ff9c9c; }
@media (max-width: 700px) { .oipy-row .oi-btn-small, .oipy-in { min-height: 40px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oipy-styles')) return
  const s = document.createElement('style'); s.id = 'oipy-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const openPanel = () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } }))
function stateText (id) { const s = svc(); if (!s) return 'The poly system is not running.'; const p = s.getPoly(id); return p ? describePoly(p) : 'This node has no shape data.' }

/** Run one action; returns { ok, text }. Exported so the tests call the same code the buttons do. */
export function runPolyAction (act, id, arg = null) {
  const s = svc()
  if (!s) return { ok: false, text: 'The poly system is not running.' }
  const p = s.getPoly(id); if (!p) return { ok: false, text: 'This node has no shape data.' }
  switch (act) {
    case 'shape': { const r = s.setShape(id, { shape: String(arg) }); return r.ok ? { ok: true, text: describePoly(s.getPoly(id)) } : { ok: false, text: r.error } }
    case 'edge': { const r = s.setShape(id, { edge: Number(arg) }); return r.ok ? { ok: true, text: `Edge ${s.getPoly(id).edge}.` } : { ok: false, text: r.error } }
    case 'open': openPanel(); return { ok: true, text: 'Opening ⟐OmniPoly…' }
    default: return { ok: false, text: 'Unknown action.' }
  }
}

export function polyKindBlockHTML (data) {
  injectStyles(); bindLive()
  const p = svc()?.getPoly(data.id)
  const opts = Object.keys(SHAPE_INFO).map(k => `<option value="${k}"${p?.shape === k ? ' selected' : ''}>${esc(SHAPE_INFO[k].name)}</option>`).join('')
  return `<div class="oi-custom-section" id="oi-custom-poly" data-oipy-root data-kind="polyNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Poly node</div>
    <div class="oipy-row"><span class="oipy-note" style="margin:0;flex:1 1 100%" data-testid="oipy-state">${esc(stateText(data.id))}</span></div>
    <div class="oipy-row"><span class="oi-label">Shape</span><select class="oipy-in" data-oipy="shape" aria-label="Shape">${opts}</select></div>
    <div class="oipy-row"><span class="oi-label">Edge</span><input class="oipy-in" type="number" data-oipy="edge" min="0.2" max="40" step="0.5" value="${p?.edge ?? 2}" style="width:64px" aria-label="Edge length"></div>
    <div class="oipy-row"><button class="oi-btn-small" data-oipya="open">⚙ Open ⟐OmniPoly</button></div>
    <div class="oipy-msg" role="status" aria-live="polite" data-ref="oipy-msg"></div>
    <div class="oipy-note">Every face holds its own colour, picture, text, document or sound, on both sides. Tap a face in the space for its menu.</div>
  </div>`
}

export function wirePolyKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-poly')
  if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oipya]'); if (!b || b.disabled) return; say(sec, runPolyAction(b.dataset.oipya, data.id)) })
  sec.addEventListener('change', (e) => {
    const el = e.target; const a = el.dataset?.oipy; if (!a) return
    say(sec, runPolyAction(a, data.id, el.value)); refreshLive(sec, el)
  })
}
function say (root, r) { const m = root.querySelector('[data-ref="oipy-msg"]'); if (!m) return; m.textContent = r.text; m.className = 'oipy-msg' + (r.ok ? '' : ' is-err') }
function refreshLive (root, skip = null) {
  const id = root.dataset.nodeId; const s = svc(); if (!id || !s) return
  const p = s.getPoly(id); if (!p) return
  const st = root.querySelector('[data-testid="oipy-state"]'); if (st) st.textContent = stateText(id)
  root.querySelectorAll('[data-oipy]').forEach(el => { if (el === skip || document.activeElement === el) return; el.value = String(el.dataset.oipy === 'shape' ? p.shape : p.edge) })
}
let LIVE_BOUND = false
function bindLive () {
  if (LIVE_BOUND || typeof window === 'undefined') return
  LIVE_BOUND = true
  window.addEventListener('omni:poly-changed', () => { if (typeof document !== 'undefined') document.querySelectorAll('[data-oipy-root][data-node-id]').forEach(r => refreshLive(r)) })
}
