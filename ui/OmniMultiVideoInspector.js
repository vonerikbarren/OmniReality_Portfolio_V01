/**
 * ui/OmniMultiVideoInspector.js (V286) — the Inspector block of a MultiVideoNode: a summary, Play / Stop, the basics, and the button that opens the editor (ui/OmniMultiVideoEditor.js).
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as M from '../utils/OmniMultiVideoModel.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const row = (label, inner, tip = '') => `<label style="display:flex;align-items:center;gap:6px;font-size:10px;margin:3px 0" title="${esc(tip)}"><span style="width:92px;opacity:.85">${esc(label)}</span>${inner}</label>`

export function multiVideoKindBlockHTML (data) {
  const s = SERVICES.multivideo; const v = s?.get(data.id)
  if (!v) return `<div class="oi-custom-section" id="oi-custom-mv" data-kind="multiVideoNode" data-node-id="${esc(data.id)}"><div class="oi-custom-title">▤ MultiVideo node</div><div style="font-size:10px;opacity:.8">The MultiVideo system is not running.</div></div>`
  const dur = M.totalDuration(v.clips)
  return `<div class="oi-custom-section" id="oi-custom-mv" data-kind="multiVideoNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">▤ MultiVideo node</div>
    <div style="font-size:10px;opacity:.85;margin:2px 0">${v.clips.length} clip${v.clips.length === 1 ? '' : 's'} · ${dur.toFixed(1)} s · ${v.keys.length} key coordinate${v.keys.length === 1 ? '' : 's'} · ${v.text.items.length} caption${v.text.items.length === 1 ? '' : 's'}</div>
    <div style="margin:4px 0;display:flex;gap:4px;flex-wrap:wrap"><button class="oi-btn-small" data-oimv-act="edit" title="The timeline editor: clips, transitions, key coordinates, text">Open editor</button><button class="oi-btn-small" data-oimv-act="play">Play</button><button class="oi-btn-small" data-oimv-act="pause">Pause</button><button class="oi-btn-small" data-oimv-act="stop">Stop</button></div>
    ${row('Width', `<input type="range" min="0.5" max="40" step="0.1" value="${v.width}" data-oimv="width" style="flex:1">`, 'World units; the height follows the video')}
    ${row('Loop', `<input type="checkbox" data-oimv="loop"${v.loop ? ' checked' : ''}>`)}
    ${row('Sound', `<input type="checkbox" data-oimv="sound"${v.muted ? '' : ' checked'}>`, 'Off by default (browsers block sound until a click)')}
    <div style="font-size:10px;opacity:.8" data-testid="oimv-msg"></div>
  </div>`
}
export function wireMultiVideoKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-mv'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const s = () => SERVICES.multivideo; const msg = (t) => { const m = sec.querySelector('[data-testid="oimv-msg"]'); if (m) m.textContent = t || '' }
  sec.addEventListener('change', (e) => { const t = e.target; if (!s() || !t.dataset.oimv) return; const k = t.dataset.oimv; s().change(data.id, mv => ({ ...mv, ...(k === 'loop' ? { loop: t.checked } : k === 'sound' ? { muted: !t.checked } : {}) })) })
  sec.addEventListener('input', (e) => { const t = e.target; if (s() && t.dataset.oimv === 'width') s().change(data.id, mv => ({ ...mv, width: Number(t.value) })) })
  sec.addEventListener('click', async (e) => {
    const b = e.target.closest?.('button'); if (!b || !s()) return; const a = b.dataset.oimvAct
    if (a === 'edit') { if (SERVICES.multivideoui) SERVICES.multivideoui.open(data.id); else msg('The editor is not running.') }
    if (a === 'play') { const r = await s().play(data.id); msg(r.ok ? '' : r.error) }
    if (a === 'pause') s().pause(data.id)
    if (a === 'stop') s().stop(data.id)
  })
}
