/**
 * ui/OmniFlashInspector.js (V269) — the Inspector block of a Flashcards node: title, card count, round progress, and the Study / Edit buttons. Read through SERVICES.flash / SERVICES.flashui only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export function runFlashAction (act, id) {
  const ui = SERVICES.flashui; if (!ui || !SERVICES.flash) return { ok: false, text: 'The flashcards system is not running.' }
  try {
    if (act === 'study') { ui.openStudy(id); return { ok: true, text: 'Study bar open (Space flips, 1 again, 2 got it).' } }
    if (act === 'edit') { ui.openEditor(id); return { ok: true, text: 'Editor open.' } }
    if (act === 'add') { SERVICES.flash.addCard(id, '', ''); ui.openEditor(id); return { ok: true, text: 'Card added.' } }
  } catch (err) { return { ok: false, text: String(err?.message ?? err) } }
  return { ok: false, text: 'Unknown action.' }
}
export function flashKindBlockHTML (data) {
  const k = SERVICES.flash?.getDeck(data.id); const p = k ? SERVICES.flash.progress(data.id) : null
  const text = k ? `${esc(k.title)} · ${p.total} card${p.total === 1 ? '' : 's'} · ${p.done ? 'round done' : p.left + ' left in this round'}${k.speak ? ' · reads aloud' : ''}` : 'The flashcards system is not running.'
  return `<div class="oi-custom-section" id="oi-custom-flash" data-kind="flashNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Flashcards node</div>
    <div style="font-size:10px;opacity:.8;margin:4px 0" data-testid="oiflash-state">${text}</div>
    <div style="margin:4px 0;display:flex;flex-wrap:wrap;gap:4px"><button class="oi-btn-small" data-oiflasha="study">▶ Study</button><button class="oi-btn-small" data-oiflasha="edit">✎ Edit cards</button><button class="oi-btn-small" data-oiflasha="add">＋ Add card</button></div>
    <div style="font-size:9.5px;opacity:.75;line-height:1.4">A deck of cards in one node. Cards can have text, a picture and a sound on each side. Study: Space flips, 1 = again, 2 = got it.</div>
  </div>`
}
export function wireFlashKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-flash'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oiflasha]'); if (!b) return; const r = runFlashAction(b.dataset.oiflasha, data.id); const st = sec.querySelector('[data-testid="oiflash-state"]'); if (st && r?.text) st.textContent = r.text })
}
