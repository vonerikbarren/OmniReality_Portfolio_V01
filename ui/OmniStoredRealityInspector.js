/**
 * ui/OmniStoredRealityInspector.js (V277) — the Inspector block of a StoredRealityNode: name, summary, what is inside (counts, kinds, first labels),
 * Store / Expand, and the voxel room it lives in. Read and written through SERVICES.storedreality only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
function facts (id) {
  const i = SERVICES.storedreality?.info(id); if (!i) return ''
  const kinds = Object.entries(i.kinds).map(([k, n]) => `${n} ${k}`).join(', ')
  return `${i.state === 'stored' ? 'Stored' : 'Expanded'}: ${i.count} node(s), ${i.edges} line(s)${kinds ? ' · ' + kinds : ''}${i.room ? ' · room ' + i.room : ''}`
}
export function storedRealityKindBlockHTML (data) {
  const s = SERVICES.storedreality; const v = s?.get(data.id)
  if (!v) return `<div class="oi-custom-section" id="oi-custom-sr" data-kind="storedRealityNode" data-node-id="${esc(data.id)}"><div class="oi-custom-title">▣ Stored reality node</div><div style="font-size:10px;opacity:.8">The stored reality system is not running.</div></div>`
  const i = s.info(data.id)
  return `<div class="oi-custom-section" id="oi-custom-sr" data-kind="storedRealityNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">▣ Stored reality node</div>
    <label style="display:flex;gap:6px;align-items:center;font-size:10px;margin:3px 0"><span style="width:70px">Name</span><input type="text" maxlength="60" data-oisr="name" value="${esc(v.name)}" style="flex:1"></label>
    <textarea data-oisr="summary" maxlength="400" rows="3" style="width:100%;font-size:11px;box-sizing:border-box" placeholder="What is this course about?">${esc(v.summary)}</textarea>
    <label style="display:flex;gap:6px;align-items:center;font-size:10px;margin:3px 0"><span style="width:70px">Box size</span><input type="range" min="1" max="18" step="0.5" value="${v.scale}" data-oisr="scale" style="flex:1"></label>
    <div style="font-size:10px;opacity:.85;margin:4px 0" data-testid="oisr-facts">${esc(facts(data.id))}</div>
    ${i.labels.length ? `<div style="font-size:9.5px;opacity:.7">${i.labels.map(esc).join(' · ')}</div>` : ''}
    <div style="margin:4px 0;display:flex;flex-wrap:wrap;gap:4px">
      <button class="oi-btn-small" data-oisr-act="${v.state === 'stored' ? 'expand' : 'store'}" title="${v.state === 'stored' ? 'Lay the whole course out in the scene' : 'Keep the course inside this node again'}">${v.state === 'stored' ? 'Expand' : 'Store'}</button>
      ${v.state === 'stored' && !v.payload.nodes.length ? '<button class="oi-btn-small" data-oisr-act="store" title="Store the nodes inside the box (or the selected node)">Store nodes in the box</button>' : ''}
      <input type="text" data-oisr="room" placeholder="room 0,0,0" value="${esc(v.room ?? '')}" style="width:80px;font-size:10px" title="A voxel room (x,y,z): moves the box to the centre of it">
    </div>
    <div style="font-size:10px;opacity:.8" data-testid="oisr-msg"></div>
  </div>`
}
export function wireStoredRealityKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-sr'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const s = () => SERVICES.storedreality; const msg = (t) => { const m = sec.querySelector('[data-testid="oisr-msg"]'); if (m) m.textContent = t || '' }
  const redraw = () => { try { const host = sec.parentElement; if (!host) return; const tmp = document.createElement('div'); tmp.innerHTML = storedRealityKindBlockHTML(data); sec.replaceWith(tmp.firstElementChild); wireStoredRealityKindBlock(host, data) } catch (_) { /* ignore */ } }
  sec.addEventListener('change', (e) => {
    const t = e.target, k = t.dataset?.oisr; if (!k || !s()) return
    try {
      if (k === 'name') s().set(data.id, { name: t.value }); else if (k === 'summary') s().set(data.id, { summary: t.value }); else if (k === 'scale') s().set(data.id, { scale: Number(t.value) })
      else if (k === 'room') { if (!t.value.trim()) return; const r = s().placeInRoom(data.id, t.value.trim()); msg(r.ok ? 'Moved to room ' + r.room : r.error) }
    } catch (err) { msg(String(err?.message ?? err)) }
  })
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-oisr-act]'); if (!b || !s()) return
    const r = b.dataset.oisrAct === 'expand' ? s().expand(data.id) : s().store(data.id)
    if (!r.ok) { msg(r.error); return }
    redraw()
  })
}
