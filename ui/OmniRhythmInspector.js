/**
 * ui/OmniRhythmInspector.js (V270) — the Inspector block of a RhythmNode: tempo, steps, what it drives, and the Start / Edit buttons. Read through SERVICES.rhythm / SERVICES.rhythmui only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { patternText } from '../utils/OmniRhythmModel.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export function runRhythmAction (act, id) {
  const s = SERVICES.rhythm; if (!s) return { ok: false, text: 'The rhythm system is not running.' }
  try {
    if (act === 'toggle') return { ok: true, text: s.toggle(id) ? 'Running.' : 'Stopped.' }
    if (act === 'tap') return { ok: true, text: 'Tempo ' + s.tap(id) + ' BPM.' }
    if (act === 'edit') { if (!SERVICES.rhythmui) return { ok: false, text: 'The rhythm panel is not running.' }; SERVICES.rhythmui.open(id); return { ok: true, text: 'Panel open.' } }
  } catch (err) { return { ok: false, text: String(err?.message ?? err) } }
  return { ok: false, text: 'Unknown action.' }
}
export function rhythmKindBlockHTML (data) {
  const r = SERVICES.rhythm?.getRhythm(data.id)
  const text = r ? `${esc(r.title)} · ${r.tempo} BPM · ${esc(patternText(r.steps))} · drives ${r.bindings.length} · ${SERVICES.rhythm.isRunning(data.id) ? 'running' : 'stopped'}${r.follow ? ' · follows a music node' : ''}` : 'The rhythm system is not running.'
  return `<div class="oi-custom-section" id="oi-custom-rhythm" data-kind="rhythmNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ Rhythm node</div>
    <div style="font-size:10px;opacity:.8;margin:4px 0;word-break:break-all" data-testid="oirhythm-state">${text}</div>
    <div style="margin:4px 0;display:flex;flex-wrap:wrap;gap:4px"><button class="oi-btn-small" data-oirhythma="toggle">▶ Start / ■ Stop</button><button class="oi-btn-small" data-oirhythma="tap">Tap tempo</button><button class="oi-btn-small" data-oirhythma="edit">✎ Edit rhythm</button></div>
    <div style="font-size:9.5px;opacity:.75;line-height:1.4">A beat source. Every beat can pulse, bounce, spin, flash... any node you bind to it. Bind from the panel or from a node's tooltip menu ("Put this on a beat").</div>
  </div>`
}
export function wireRhythmKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-rhythm'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oirhythma]'); if (!b) return; const r = runRhythmAction(b.dataset.oirhythma, data.id); const st = sec.querySelector('[data-testid="oirhythm-state"]'); if (st && r?.text) st.textContent = r.text })
}
