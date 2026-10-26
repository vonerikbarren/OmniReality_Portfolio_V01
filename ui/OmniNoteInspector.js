/**
 * ui/OmniNoteInspector.js (V213) — the Inspector block of a NoteNode: title, word count, and "Open ⟐OmniNote". Read through Extra.SERVICES.note only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { wordCount } from '../utils/OmniNoteModel.js'
import { esc } from './OmniSoundFields.js'

const NAV_ITEM = '⟐OmniNote'
export function runNoteAction (act, id) {
  const s = SERVICES.note; if (!s) return { ok: false, text: 'The note system is not running.' }
  if (!s.getNote(id)) return { ok: false, text: 'This node has no note.' }
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
    <div style="font-size:9.5px;opacity:.75;line-height:1.4">A rich-text note: headings, lists, tables, pictures, fonts and colours. What you write shows on the sheet.</div>
  </div>`
}
export function wireNoteKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-note'); if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oinotea]'); if (b) runNoteAction(b.dataset.oinotea, data.id) })
}
