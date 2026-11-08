/**
 * ui/OmniEdgeNodeInspector.js (V278) — the Inspector block of an EdgeNode: its two nodes, the way you travel (line, tunnel, torus, orbit), the control points
 * (where the route bends: how far along, how far to the side, how far up), speed, rider settings and a Ride button. Read and written through SERVICES.edgenodes only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { MODES, LOOKS, LIMITS } from '../utils/OmniEdgeNodeModel.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const LABEL = { line: 'Line (ride along it)', tunnel: 'Tunnel (go through it)', torus: 'Torus (loop a ring first)', orbit: 'Orbit (circle the end)' }
const row = (label, inner, tip = '') => `<label style="display:flex;align-items:center;gap:6px;font-size:10px;margin:3px 0" title="${esc(tip)}"><span style="width:82px;opacity:.85">${esc(label)}</span>${inner}</label>`
const num = (k, v, min, max, step) => `<input type="number" data-oien="${k}" min="${min}" max="${max}" step="${step}" value="${v}" style="width:70px">`

function pointRows (s) {
  if (!s.points.length) return '<div style="font-size:9.5px;opacity:.7">No control points: the route is a straight line. Add one to bend it.</div>'
  return s.points.map((p, i) => `<div style="display:flex;gap:4px;align-items:center;font-size:10px;margin:2px 0">
    <span style="width:14px">${i + 1}</span>
    <input type="number" data-oiep="${i}" data-k="t" min="0.01" max="0.99" step="0.01" value="${p.t}" style="width:56px" title="How far along the edge (0.01 start, 0.99 end)" aria-label="Point ${i + 1} along">
    <input type="number" data-oiep="${i}" data-k="side" step="0.5" value="${p.side}" style="width:56px" title="Sideways, world units" aria-label="Point ${i + 1} side">
    <input type="number" data-oiep="${i}" data-k="up" step="0.5" value="${p.up}" style="width:56px" title="Up, world units" aria-label="Point ${i + 1} up">
    <button class="oi-btn-small" data-oien-act="del" data-i="${i}" aria-label="Remove point ${i + 1}">×</button></div>`).join('')
}
const label = (id) => { try { return SERVICES.lineup?.omniNode?.getNodeData?.(id)?.label || id || '(none)' } catch (_) { return id || '(none)' } }
export function edgeNodeKindBlockHTML (data) {
  const s = SERVICES.edgenodes; const e = s?.get(data.id)
  if (!e) return `<div class="oi-custom-section" id="oi-custom-en" data-kind="edgeNode" data-node-id="${esc(data.id)}"><div class="oi-custom-title">⟷ Edge node</div><div style="font-size:10px;opacity:.8">The edge node system is not running.</div></div>`
  const live = !!s.pathOf(data.id)
  return `<div class="oi-custom-section" id="oi-custom-en" data-kind="edgeNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟷ Edge node</div>
    <div style="font-size:10px;margin:2px 0" data-testid="oien-ends">${esc(label(e.from))} → ${esc(label(e.to))}${live ? '' : ' (one of the nodes is gone)'}</div>
    ${row('Way', `<select data-oien="mode" style="flex:1">${MODES.map(m => `<option value="${m}"${m === e.mode ? ' selected' : ''}>${esc(LABEL[m])}</option>`).join('')}</select>`)}
    ${row('Ring radius', num('radius', e.radius, LIMITS.radius[0], LIMITS.radius[1], 0.5), 'Tunnel, torus and orbit: how wide')}
    ${row('Turns', num('turns', e.turns, LIMITS.turns[0], LIMITS.turns[1], 0.25), 'Torus and orbit: how many times round')}
    ${row('Speed', num('speed', e.speed, LIMITS.speed[0], LIMITS.speed[1], 0.5), 'World units per second')}
    ${row('Look', `<select data-oien="look" style="flex:1">${LOOKS.map(l => `<option value="${l}"${l === e.look ? ' selected' : ''}>${l === 'forward' ? 'Forward (along the route)' : 'At the destination'}</option>`).join('')}</select>`)}
    ${row('Two ways', `<input type="checkbox" data-oien="twoWay"${e.twoWay ? ' checked' : ''}>`, 'May the ride go from the second node back to the first?')}
    ${row('Loop ride', `<input type="checkbox" data-oien="loop"${e.loop ? ' checked' : ''}>`, 'Keep riding until stopped')}
    ${row('Colour', `<input type="color" data-oien="color" value="${esc(e.color)}">`)}
    <div style="font-size:10px;margin:6px 0 2px;opacity:.85">Control points <span style="opacity:.6">(along · side · up)</span></div>
    <div data-oien-points>${pointRows(e)}</div>
    <div style="margin:4px 0;display:flex;gap:4px;flex-wrap:wrap"><button class="oi-btn-small" data-oien-act="add">Add point</button><button class="oi-btn-small" data-oien-act="ride">Ride</button><button class="oi-btn-small" data-oien-act="back">Ride back</button><button class="oi-btn-small" data-oien-act="stop">Stop</button></div>
    <div style="font-size:10px;opacity:.8" data-testid="oien-msg"></div>
  </div>`
}
export function wireEdgeNodeKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-en'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const s = () => SERVICES.edgenodes; const msg = (t) => { const m = sec.querySelector('[data-testid="oien-msg"]'); if (m) m.textContent = t || '' }
  const redrawPoints = () => { const h = sec.querySelector('[data-oien-points]'); const e = s()?.get(data.id); if (h && e) h.innerHTML = pointRows(e) }
  sec.addEventListener('change', (ev) => {
    const t = ev.target; if (!s()) return
    try {
      if (t.dataset.oiep !== undefined) { const r = s().setPoint(data.id, Number(t.dataset.oiep), { [t.dataset.k]: Number(t.value) }); msg(r.ok ? '' : r.error); redrawPoints(); return }
      const k = t.dataset.oien; if (!k) return
      const v = t.type === 'checkbox' ? t.checked : (t.type === 'number' ? Number(t.value) : t.value)
      const r = k === 'mode' ? s().setMode(data.id, v) : s().set(data.id, { [k]: v }); msg(r.ok ? '' : r.error)
    } catch (err) { msg(String(err?.message ?? err)) }
  })
  sec.addEventListener('click', async (ev) => {
    const b = ev.target.closest?.('[data-oien-act]'); if (!b || !s()) return; const a = b.dataset.oienAct
    try {
      if (a === 'add') { const r = s().addPoint(data.id); msg(r.ok ? '' : r.error); redrawPoints() }
      else if (a === 'del') { s().removePoint(data.id, Number(b.dataset.i)); redrawPoints() }
      else if (a === 'stop') s().stop()
      else if (a === 'ride' || a === 'back') { msg('Riding...'); const r = await s().ride(data.id, { reverse: a === 'back' }); msg(r.ok ? '' : r.error) }
    } catch (err) { msg(String(err?.message ?? err)) }
  })
}
