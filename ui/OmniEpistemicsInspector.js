/**
 * ui/OmniEpistemicsInspector.js (V271) — the Inspector block of an OmniEpistemicsNode: layer, text, the layer's attributes (sliders), what it was derived from, the numbers behind it,
 * and the "next layer" buttons. Read and written through SERVICES.epistemics only. Attribute rows are rebuilt when the layer changes.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { LAYERS, LAYER_INFO, nextSteps } from '../utils/OmniEpistemicsModel.js'
import { effectiveTrust } from '../utils/OmniSourceModel.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const pct = (v) => Math.round((Number(v) || 0) * 100) + '%'

function attrRows (e) {
  return LAYER_INFO[e.layer].attrs.map(a => a.type === 'unit'
    ? `<label style="display:flex;align-items:center;gap:6px;font-size:10px;margin:2px 0" title="${esc(a.tip)}"><span style="width:104px;opacity:.85">${esc(a.label)}</span><input type="range" min="0" max="1" step="0.01" value="${e.attrs[a.key]}" data-oiepa="${a.key}" style="flex:1"><span data-oiepv="${a.key}" style="width:30px;text-align:right">${pct(e.attrs[a.key])}</span></label>`
    : `<label style="display:flex;align-items:center;gap:6px;font-size:10px;margin:2px 0" title="${esc(a.tip)}"><span style="width:104px;opacity:.85">${esc(a.label)}</span><input type="text" maxlength="80" value="${esc(e.attrs[a.key])}" data-oiepa="${a.key}" style="flex:1;font-size:10px"></label>`).join('')
}
function facts (id) {
  try {
    const r = SERVICES.epistemics.report(id); const bits = [`certainty ${pct(r.certainty)}`]
    if (r.confidence != null) bits.push(`from its claim ${pct(r.confidence)}`)
    if (r.rumorStrength != null) bits.push(`rumour strength ${pct(r.rumorStrength)}`)
    if (r.belief != null) bits.push(`belief ${pct(r.belief)}`, `reality resists ${pct(r.realityResistance)}`, `stability ${pct(r.narrativeStability)}`)
    else if (r.realityResistance != null) bits.push(`reality resists ${pct(r.realityResistance)}`)
    return bits.join(' · ')
  } catch (_) { return '' }
}
export function runEpistemicsAction (act, id, arg) {
  const s = SERVICES.epistemics; if (!s) return { ok: false, text: 'The epistemics system is not running.' }
  try {
    if (act === 'derive') { const r = s.derive(id, arg); return r.ok ? { ok: true, text: 'Made the ' + r.layer + ' node.' } : { ok: false, text: r.error } }
    if (act === 'lift') { const r = SERVICES.sources?.liftFrom(id); return r?.ok ? { ok: true, text: r.already ? 'Already linked to a source node.' : (r.merged ? 'Linked to the matching source node.' : 'Made a source node and linked it.') } : { ok: false, text: r?.error || 'The source system is not running.' } }
    if (act === 'unlink') { const r = SERVICES.sources?.unlink(id); return r?.ok ? { ok: true, text: 'Unlinked.' } : { ok: false, text: r?.error || 'The source system is not running.' } }
    if (act === 'trace') { const e = s.get(id); const r = s.trace(e?.claimId || id); return r.ok ? { ok: true, text: `Traced: ${r.observations} observation(s), ${r.absences} absence(s), ${r.whatIfs} what-if(s).` } : { ok: false, text: r.error } }
  } catch (err) { return { ok: false, text: String(err?.message ?? err) } }
  return { ok: false, text: 'Unknown action.' }
}
function sourceSectionHTML (e) {
  const S = SERVICES.sources; const src = e.sourceId ? S?.get(e.sourceId) : null
  const line = src ? `${esc(src.title || e.sourceId)} · ${Math.round(effectiveTrust(src) * 100)}%${src.status !== 'live' ? ' · ' + esc(src.status) : ''}` : (e.sourceId ? esc(e.sourceId) + ' (not found)' : 'not linked to a source node')
  return `<div style="margin:4px 0;border-top:1px solid rgba(255,255,255,.12);padding-top:4px" data-oiep-src>
    <label style="display:flex;gap:6px;align-items:center;font-size:10px;margin:2px 0"><span style="width:104px">Source</span><input type="text" maxlength="80" data-oiep="source" value="${esc(e.source)}" placeholder="short label" style="flex:1;font-size:10px"></label>
    <div style="font-size:9.5px;opacity:.8;margin:2px 0" data-testid="oiepi-srcline">${line}</div>
    <label style="display:flex;gap:6px;align-items:center;font-size:10px;margin:2px 0"><span style="width:104px">Page / part</span><input type="text" maxlength="40" data-oiep="citepage" value="${esc(e.cite?.page)}" style="flex:1;font-size:10px"></label>
    <label style="display:flex;gap:6px;align-items:center;font-size:10px;margin:2px 0"><span style="width:104px">Quote</span><input type="text" maxlength="300" data-oiep="citequote" value="${esc(e.cite?.quote)}" style="flex:1;font-size:10px"></label>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin:2px 0"><button class="oi-btn-small" data-oiepa-act="lift" title="Make a source node from this label and address (or reuse a matching one) and link it">Make source node</button>${e.sourceId ? '<button class="oi-btn-small" data-oiepa-act="unlink" title="Remove the link to the source node">Unlink source</button>' : ''}</div></div>`
}
export function epistemicsKindBlockHTML (data) {
  const s = SERVICES.epistemics; const e = s?.get(data.id); if (!e) return `<div class="oi-custom-section" id="oi-custom-epi" data-kind="epistemicsNode" data-node-id="${esc(data.id)}"><div class="oi-custom-title">⟐ Epistemics node</div><div style="font-size:10px;opacity:.8">The epistemics system is not running.</div></div>`
  const next = nextSteps(e.layer)
  return `<div class="oi-custom-section" id="oi-custom-epi" data-kind="epistemicsNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Epistemics node</div>
    <label style="display:flex;gap:6px;align-items:center;font-size:10px;margin:4px 0"><span style="width:104px">Layer</span><select data-oiep="layer" style="flex:1">${LAYERS.map(l => `<option value="${l}"${l === e.layer ? ' selected' : ''}>${LAYER_INFO[l].glyph} ${LAYER_INFO[l].label}</option>`).join('')}</select></label>
    <div style="font-size:9.5px;opacity:.75;margin:2px 0">${esc(LAYER_INFO[e.layer].summary)}</div>
    <textarea data-oiep="text" maxlength="300" rows="3" style="width:100%;font-size:11px;box-sizing:border-box" placeholder="What does this node say?">${esc(e.text)}</textarea>
    <div data-oiep="attrs" style="margin:4px 0">${attrRows(e)}</div>
    <div style="font-size:10px;opacity:.85;margin:4px 0" data-testid="oiepi-facts">${esc(facts(data.id))}</div>
    ${e.derivedFrom.length ? `<div style="font-size:9.5px;opacity:.7">made from ${e.derivedFrom.map(esc).join(', ')}</div>` : ''}
    <label style="display:flex;gap:6px;align-items:center;font-size:10px;margin:4px 0"><span style="width:104px">Linked claim</span><input type="text" maxlength="64" data-oiep="claim" value="${esc(e.claimId)}" placeholder="claim node id (its testimonies set the certainty)" style="flex:1;font-size:10px"></label>
    ${sourceSectionHTML(e)}
    <div style="margin:4px 0;display:flex;flex-wrap:wrap;gap:4px">${next.map(n => `<button class="oi-btn-small" data-oiepa-act="derive" data-arg="${n.transform}" title="Make the next layer from this node">→ ${esc(LAYER_INFO[n.to].label)}</button>`).join('')}<button class="oi-btn-small" data-oiepa-act="trace" title="Lay the linked claim out as event, observations, absences and what-ifs">⟐ Trace the claim</button></div>
    <div style="font-size:10px;opacity:.8" data-testid="oiepi-msg"></div>
  </div>`
}
export function wireEpistemicsKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-epi'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const s = () => SERVICES.epistemics; const msg = (t) => { const m = sec.querySelector('[data-testid="oiepi-msg"]'); if (m) m.textContent = t || '' }
  const refresh = () => { const f = sec.querySelector('[data-testid="oiepi-facts"]'); if (f) f.textContent = facts(data.id) }
  sec.addEventListener('change', (e) => {
    const t = e.target; const k = t.dataset?.oiep; if (!s()) return
    try {
      if (k === 'layer') { s().setLayer(data.id, t.value); const ep = s().get(data.id); sec.querySelector('[data-oiep="attrs"]').innerHTML = attrRows(ep); sec.querySelector('.oi-custom-title').nextElementSibling.nextElementSibling.textContent = LAYER_INFO[ep.layer].summary; refresh() }
      else if (k === 'text') { s().set(data.id, { text: t.value }); refresh() }
      else if (k === 'source') { s().set(data.id, { source: t.value }) }
      else if (k === 'citepage' || k === 'citequote') { const c = s().get(data.id).cite; s().set(data.id, { cite: { ...c, [k === 'citepage' ? 'page' : 'quote']: t.value } }) }
      else if (k === 'claim') { s().link(data.id, t.value.trim()); refresh() }
      else if (t.dataset?.oiepa) { s().setAttr(data.id, t.dataset.oiepa, t.type === 'range' ? Number(t.value) : t.value); refresh() }
    } catch (err) { msg(String(err?.message ?? err)) }
  })
  sec.addEventListener('input', (e) => { const t = e.target; if (t.type === 'range' && t.dataset?.oiepa) { const v = sec.querySelector(`[data-oiepv="${t.dataset.oiepa}"]`); if (v) v.textContent = pct(t.value) } })
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oiepa-act]'); if (!b) return; const r = runEpistemicsAction(b.dataset.oiepaAct, data.id, b.dataset.arg); msg(r.text); if (r.ok && (b.dataset.oiepaAct === 'lift' || b.dataset.oiepaAct === 'unlink')) { const h = sec.querySelector('[data-oiep-src]'); const ep = s().get(data.id); if (h && ep) { const tmp = document.createElement('div'); tmp.innerHTML = sourceSectionHTML(ep); h.replaceWith(tmp.firstElementChild) } } })
}
