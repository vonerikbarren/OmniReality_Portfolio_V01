/**
 * ui/OmniStoredVideoInspector.js (V277) — the Inspector block of a StoredVideoNode: pick a library video (or add a file), key colour, similarity / smoothness / spill, size, loop, sound, play.
 * Read and written through SERVICES.storedvideo only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { KEY_PRESETS } from '../utils/OmniStoredVideoModel.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const row = (label, inner, tip = '') => `<label style="display:flex;align-items:center;gap:6px;font-size:10px;margin:3px 0" title="${esc(tip)}"><span style="width:92px;opacity:.85">${esc(label)}</span>${inner}</label>`
const slider = (k, v, tip) => row(({ similarity: 'Similarity', smoothness: 'Smoothness', spill: 'Spill removal' })[k], `<input type="range" min="0" max="1" step="0.01" value="${v}" data-oisv-key="${k}" style="flex:1">`, tip)

export function storedVideoKindBlockHTML (data) {
  const s = SERVICES.storedvideo; const v = s?.get(data.id)
  if (!v) return `<div class="oi-custom-section" id="oi-custom-sv" data-kind="storedVideoNode" data-node-id="${esc(data.id)}"><div class="oi-custom-title">▭ Stored video node</div><div style="font-size:10px;opacity:.8">The stored video system is not running.</div></div>`
  return `<div class="oi-custom-section" id="oi-custom-sv" data-kind="storedVideoNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">▭ Stored video node</div>
    ${row('Video', '<select data-oisv="source" style="flex:1"><option value="">(none)</option></select>', 'A video from the document library')}
    <div style="margin:3px 0"><input type="file" accept="video/*" data-oisv="file" style="font-size:10px;max-width:100%"></div>
    ${row('Key out', `<input type="checkbox" data-oisv-key="enabled"${v.key.enabled ? ' checked' : ''}>`, 'Remove the backdrop colour')}
    ${row('Key colour', `<input type="color" data-oisv-key="color" value="${esc(v.key.color)}"><span style="display:flex;gap:3px">${Object.entries(KEY_PRESETS).map(([n, c]) => `<button class="oi-btn-small" data-oisv-preset="${c}" title="${n} screen">${n}</button>`).join('')}</span>`)}
    ${slider('similarity', v.key.similarity, 'How far from the key colour still counts as backdrop')}
    ${slider('smoothness', v.key.smoothness, 'The soft edge around the person')}
    ${slider('spill', v.key.spill, 'Pulls the green tint out of the edges that stay')}
    ${row('Width', `<input type="range" min="0.5" max="40" step="0.1" value="${v.width}" data-oisv="width" style="flex:1">`, 'World units; the height follows the video')}
    ${row('Loop', `<input type="checkbox" data-oisv="loop"${v.loop ? ' checked' : ''}>`)}
    ${row('Sound', `<input type="checkbox" data-oisv="sound"${v.muted ? '' : ' checked'}>`, 'Off by default (browsers block sound until a click)')}
    ${row('Mirror', `<input type="checkbox" data-oisv="flip"${v.flip ? ' checked' : ''}>`)}
    <div style="margin:4px 0;display:flex;gap:4px"><button class="oi-btn-small" data-oisv-act="play">Play</button><button class="oi-btn-small" data-oisv-act="pause">Pause</button></div>
    <div style="font-size:10px;opacity:.8" data-testid="oisv-msg"></div>
  </div>`
}
export function wireStoredVideoKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-sv'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const s = () => SERVICES.storedvideo; const msg = (t) => { const m = sec.querySelector('[data-testid="oisv-msg"]'); if (m) m.textContent = t || '' }
  const fill = async () => {
    try {
      const sel = sec.querySelector('[data-oisv="source"]'); const list = await s().listVideos(); const cur = s().get(data.id)?.source?.id ?? ''
      sel.innerHTML = '<option value="">(none)</option>' + list.map(x => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('')
    } catch (_) { /* no library */ }
  }
  fill()
  sec.addEventListener('change', async (e) => {
    const t = e.target; if (!s()) return
    try {
      if (t.dataset.oisvKey) { const k = t.dataset.oisvKey; s().setKey(data.id, { [k]: t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value }); return }
      const k = t.dataset.oisv
      if (k === 'source') { s().setSource(data.id, t.value || null); msg(t.value ? 'Loading...' : ''); if (t.value) { const r = await s().play(data.id); msg(r.ok ? '' : r.error) } }
      else if (k === 'file' && t.files?.[0]) { msg('Adding...'); const r = await s().attachFile(data.id, t.files[0]); msg(r.ok ? '' : (r.error?.message ?? r.error ?? 'Could not add it.')); await fill(); if (r.ok) { const p = await s().play(data.id); if (!p.ok) msg(p.error) } }
      else if (k === 'width') s().set(data.id, { width: Number(t.value) })
      else if (k === 'loop') s().set(data.id, { loop: t.checked })
      else if (k === 'sound') s().set(data.id, { muted: !t.checked })
      else if (k === 'flip') s().set(data.id, { flip: t.checked })
    } catch (err) { msg(String(err?.message ?? err)) }
  })
  sec.addEventListener('input', (e) => { const t = e.target; if (t.type === 'range' && s()) { try { if (t.dataset.oisvKey) s().setKey(data.id, { [t.dataset.oisvKey]: Number(t.value) }); else if (t.dataset.oisv === 'width') s().set(data.id, { width: Number(t.value) }) } catch (_) { /* ignore */ } } })
  sec.addEventListener('click', async (e) => {
    const b = e.target.closest?.('button'); if (!b || !s()) return
    if (b.dataset.oisvPreset) { s().setKey(data.id, { color: b.dataset.oisvPreset }); const c = sec.querySelector('[data-oisv-key="color"]'); if (c) c.value = b.dataset.oisvPreset; return }
    if (b.dataset.oisvAct === 'play') { const r = await s().play(data.id); msg(r.ok ? '' : r.error) }
    if (b.dataset.oisvAct === 'pause') s().pause(data.id)
  })
}
