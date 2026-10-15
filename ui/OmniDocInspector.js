/**
 * ui/OmniDocInspector.js — the Inspector block of a DocNode (V203), shown in Appearance next to the other kinds' blocks (ui/OmniExtraKindInspector.js).
 * A state line (document, page), previous / next page, width and 'Open ⟐OmniDoc'. Everything is read and written through Extra.SERVICES.doc (systems/OmniDocNodes.js),
 * so this file imports no system. User-facing: imports no Dev* module.
 */

import { SERVICES } from '../utils/OmniExtraKinds.js'
import { describeDoc, setWidth, ZOOM_MIN, ZOOM_MAX } from '../utils/OmniDocModel.js'
import { esc } from './OmniSoundFields.js'

const NAV_ITEM = '⟐OmniDoc'
const svc = () => SERVICES.doc
const STYLES = `
.oidc-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.oidc-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.oidc-row .oidc-in { flex: 0 0 64px; min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.oidc-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.oidc-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .oidc-msg.is-err { color: #ff9c9c; }
@media (max-width: 700px) { .oidc-row .oi-btn-small, .oidc-row .oidc-in { min-height: 40px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oidc-styles')) return
  const s = document.createElement('style'); s.id = 'oidc-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const openPanel = () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } }))

function stateText (id) {
  const s = svc(); if (!s) return 'The document system is not running.'
  const d = s.getDoc(id); if (!d) return 'This node has no document.'
  const st = s.getStatus?.(id)
  return describeDoc(d) + (st && st.text ? ' ' + st.text : '')
}

/** Run one action; returns { ok, text }. Exported so the tests call the same code the buttons do. */
export function runDocAction (act, id, arg = null) {
  const s = svc()
  if (!s) return { ok: false, text: 'The document system is not running.' }
  const d = s.getDoc(id); if (!d) return { ok: false, text: 'This node has no document.' }
  switch (act) {
    case 'prev': case 'next': { const r = s.turn(id, act === 'prev' ? -1 : 1); return r.ok ? { ok: true, text: r.same ? (act === 'prev' ? 'This is the first page.' : 'This is the last page.') : `Page ${s.getDoc(id).page}.` } : { ok: false, text: r.error || 'Could not turn the page.' } }
    case 'width': { const r = s.edit(id, 'width', (m) => setWidth(m, Number(arg)), 'width'); return r.ok ? { ok: true, text: `Width ${s.getDoc(id).width}.` } : { ok: false, text: r.error } }
    case 'spread': { const r = s.setSpread(id, String(arg)); return r.ok ? { ok: true, text: s.getDoc(id).spread === 'double' ? 'Two pages.' : 'One page.' } : { ok: false, text: r.error } }
    case 'zoom': { const r = s.setZoom(id, Number(arg)); return r.ok ? { ok: true, text: `Zoom ${s.getDoc(id).zoom}%.` } : { ok: false, text: r.error } }
    case 'open': openPanel(); return { ok: true, text: 'Opening ⟐OmniDoc…' }
    default: return { ok: false, text: 'Unknown action.' }
  }
}

export function docKindBlockHTML (data) {
  injectStyles(); bindLive()
  const d = svc()?.getDoc(data.id)
  return `<div class="oi-custom-section" id="oi-custom-doc" data-oidc-root data-kind="docNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Doc node</div>
    <div class="oidc-row"><span class="oidc-note" style="margin:0;flex:1 1 100%" data-testid="oidc-state">${esc(stateText(data.id))}</span></div>
    <div class="oidc-row"><button class="oi-btn-small" data-oidca="prev" aria-label="Page up (previous page)">▲ Page up</button><button class="oi-btn-small" data-oidca="next" aria-label="Page down (next page)">▼ Page down</button></div>
    <div class="oidc-row"><span class="oi-label">Pages</span><select class="oidc-in" data-oidc="spread" aria-label="One page or two pages" style="flex:1 1 auto"><option value="single"${d?.spread !== 'double' ? ' selected' : ''}>One page</option><option value="double"${d?.spread === 'double' ? ' selected' : ''}>Two pages</option></select></div>
    <div class="oidc-row"><span class="oi-label">Zoom %</span><input class="oidc-in" type="number" data-oidc="zoom" min="${ZOOM_MIN}" max="${ZOOM_MAX}" step="25" value="${d?.zoom ?? 100}" aria-label="Zoom percent"></div>
    <div class="oidc-row"><span class="oi-label">Width</span><input class="oidc-in" type="number" data-oidc="width" min="0.5" max="60" step="0.5" value="${d?.width ?? 4}" aria-label="Sheet width"></div>
    <div class="oidc-row"><button class="oi-btn-small" data-oidca="open">⚙ Open ⟐OmniDoc</button></div>
    <div class="oidc-msg" role="status" aria-live="polite" data-ref="oidc-msg"></div>
    <div class="oidc-note">A doc node shows a PDF, markdown, text, image or guide page as a flat sheet. It is drawn only as sharp as its distance needs, and not at all when it is off screen.</div>
  </div>`
}

export function wireDocKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-doc')
  if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-oidca]'); if (!b || b.disabled) return
    say(sec, runDocAction(b.dataset.oidca, data.id)); setTimeout(() => refreshLive(sec), 0)
  })
  sec.addEventListener('change', (e) => {
    const el = e.target; const k = el.dataset?.oidc; if (!k) return
    if (k === 'spread') { say(sec, runDocAction('spread', data.id, el.value)); refreshLive(sec, el); return }
    if (!Number.isFinite(Number(el.value))) return
    if (k === 'zoom') { say(sec, runDocAction('zoom', data.id, Number(el.value))); refreshLive(sec, el); return }
    if (k !== 'width') return
    say(sec, runDocAction('width', data.id, Number(el.value))); refreshLive(sec, el)
  })
}

function say (root, r) {
  const m = root.querySelector('[data-ref="oidc-msg"]'); if (!m) return
  m.textContent = r.text; m.className = 'oidc-msg' + (r.ok ? '' : ' is-err')
}
function refreshLive (root, skip = null) {
  const id = root.dataset.nodeId; const s = svc(); if (!id || !s) return
  const d = s.getDoc(id); if (!d) return
  const st = root.querySelector('[data-testid="oidc-state"]'); if (st) st.textContent = stateText(id)
  root.querySelectorAll('[data-oidc]').forEach(el => { if (el === skip || document.activeElement === el) return; const k = el.dataset.oidc; el.value = String(k === 'width' ? d.width : k === 'zoom' ? d.zoom : d.spread) })
}

let LIVE_BOUND = false
function bindLive () {
  if (LIVE_BOUND || typeof window === 'undefined') return
  LIVE_BOUND = true
  const h = () => { if (typeof document !== 'undefined') document.querySelectorAll('[data-oidc-root][data-node-id]').forEach(r => refreshLive(r)) }
  window.addEventListener('omni:doc-changed', h)
  window.addEventListener('omni:doc-status', h)
}
