/** ui/OmniDimensionalNodeInspector.js (V217) — the Inspector block of the Dimensional Node: which channel it is tuned to, its signature, reveal mode, and the two tuning buttons. */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { AXIOMS, getAxiom } from '../data/OmniAxiomData.js'
import { channelLabel, sanitizeDimensional } from '../utils/OmniDimensionalModel.js'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const opts = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')

export function dimPerspectiveOptions (axiom, cur) {
  const a = getAxiom(axiom); if (!a) return opts([['*', 'Any']], '*')
  return opts([['*', 'Any perspective'], ...a.perspectives.map(p => [p.id, p.name])], cur)
}
export function dimKindBlockHTML (data) {
  const d = sanitizeDimensional(data.dimensional)
  const revealed = SERVICES.dimensional?.isRevealed?.(data.id)
  return `<div class="oi-custom-section" id="oi-custom-dimensional" data-kind="dimensionalNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Dimensional node</div>
    <div style="font-size:10px;opacity:.85;margin:4px 0" data-testid="oidn-state">${esc(channelLabel(d))} · ${revealed ? 'revealed now' : 'veiled now'}</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 6px;align-items:center;font-size:10px">
      <label>Axiom</label><select data-oidn="axiom">${opts([['', 'Inherit from its Space'], ...AXIOMS.map(a => [a.id, a.name])], d.axiom)}</select>
      <label>Perspective</label><select data-oidn="perspective">${dimPerspectiveOptions(d.axiom, d.perspective)}</select>
      <label>Signature</label><input data-oidn="signature" maxlength="60" value="${esc(d.signature)}">
      <label>Shows</label><select data-oidn="mode">${opts([['xray', 'X-ray + signature'], ['signature', 'Signature only']], d.mode)}</select>
    </div>
    <div style="margin:6px 0"><button class="oi-btn-small" data-oidn-act="tune">⟲ Tune to what I am viewing</button> <button class="oi-btn-small" data-oidn-act="view">◉ Tune my view to this node</button></div>
    <div style="font-size:9.5px;opacity:.75;line-height:1.4">Veiled until your view matches: the OmniHand's axiom and the ConsciousHand's perspective (⟐OmniDimensions). Change either and it shows its inside and signature.</div>
  </div>`
}
export function wireDimKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-dimensional'); if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  const refresh = () => { const d = sanitizeDimensional(data.dimensional); sec.querySelector('[data-testid="oidn-state"]').textContent = `${channelLabel(d)} · ${SERVICES.dimensional?.isRevealed?.(data.id) ? 'revealed now' : 'veiled now'}`
    const ps = sec.querySelector('[data-oidn="perspective"]'); ps.innerHTML = dimPerspectiveOptions(d.axiom, d.perspective) }
  sec.addEventListener('change', (e) => {
    const f = e.target?.dataset?.oidn; if (!f) return
    SERVICES.dimensional?.tune(data.id, { [f]: e.target.value, ...(f === 'axiom' ? { perspective: '*' } : {}) }); refresh()
  })
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-oidn-act]'); if (!b) return
    if (b.dataset.oidnAct === 'tune') { SERVICES.dimensional?.tuneToView(data.id); const d = sanitizeDimensional(data.dimensional); sec.querySelector('[data-oidn="axiom"]').value = d.axiom; refresh() }
    else { const d = sanitizeDimensional(data.dimensional); const ax = SERVICES.axioms; if (ax && d.axiom) { ax.setAxiom(d.axiom); if (d.perspective !== '*') ax.setPerspective(d.perspective) } refresh() }
  })
  window.addEventListener('omni:axiom-changed', refresh, { once: true })
}
