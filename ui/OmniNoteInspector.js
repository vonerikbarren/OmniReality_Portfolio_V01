/**
 * ui/OmniNoteInspector.js (V213) — the Inspector block of a NoteNode: title, word count, and "Open ⟐OmniNote". Read through Extra.SERVICES.note only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { wordCount } from '../utils/OmniNoteModel.js'
import { esc } from './OmniSoundFields.js'
import { COLOR_NAMES, STICKY_COLORS } from '../utils/OmniStickyModel.js'

const NAV_ITEM = '⟐OmniNote'
export function runNoteAction (act, id) {
  const s = SERVICES.note; if (!s) return { ok: false, text: 'The note system is not running.' }
  if (!s.getNote(id)) return { ok: false, text: 'This node has no note.' }
  if (act === 'stick') { return { ok: false, text: 'Select the node to stick it on, then use: Omni Sticky attach id(' + id + ') on(node)' } }
  if (act === 'unstick') { const st = SERVICES.sticky; return st?.detach(id) ? { ok: true, text: 'Unstuck. The note stays where it is.' } : { ok: false, text: 'It is not stuck on anything.' } }
  if (act.startsWith('color:')) { const st = SERVICES.sticky; try { st.setColor(id, act.slice(6)); return { ok: true, text: 'Recoloured.' } } catch (err) { return { ok: false, text: String(err?.message ?? err) } } }
  if (act === 'open') { window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } })); window.dispatchEvent(new CustomEvent('omni:node-selected', { detail: { node: s.getNodeData(id) } })); return { ok: true, text: 'Opening ⟐OmniNote…' } }
  return { ok: false, text: 'Unknown action.' }
}
export function noteKindBlockHTML (data) {
  const n = SERVICES.note?.getNote(data.id)
  const text = n ? `${esc(n.title)} · ${wordCount(n.html)} words · ${n.fit === 'grow' ? 'grows with the text' : 'fixed shape'}` : 'The note system is not running.'
  return `<div class="oi-custom-section" id="oi-custom-note" data-kind="noteNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Note node</div>
    <div style="font-size:10px;opacity:.8;margin:4px 0" data-testid="oinote-state">${text}</div>
    <div style="margin:4px 0"><button class="oi-btn-small" data-oinotea="open">✎ Open ⟐OmniNote</button></div>
    <div style="margin:4px 0;display:flex;flex-wrap:wrap;gap:4px;align-items:center" data-testid="oinote-sticky"><span style="font-size:10px;opacity:.8">❏ Sticky colour</span>${COLOR_NAMES.map(c => `<button class="oi-btn-small" data-oinotea="color:${c}" title="${c}" aria-label="Colour ${c}" style="background:${STICKY_COLORS[c]};min-width:22px;min-height:22px;padding:0;border:1px solid rgba(0,0,0,.4)"></button>`).join('')}${SERVICES.sticky?.attachOf(data.id) ? '<button class="oi-btn-small" data-oinotea="unstick">Unstick</button>' : ''}</div>
    <div style="font-size:9.5px;opacity:.75;line-height:1.4">A rich-text note: headings, lists, tables, pictures, fonts and colours. What you write shows on the sheet.</div>
  </div>`
}
export function wireNoteKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-note'); if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oinotea]'); if (b) { const r = runNoteAction(b.dataset.oinotea, data.id); const st = sec.querySelector('[data-testid="oinote-state"]'); if (st && r && r.text && b.dataset.oinotea !== 'open') st.textContent = r.text } })
}
