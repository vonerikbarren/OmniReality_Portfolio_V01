/**
 * ui/OmniSourceInspector.js (V281) — the Inspector block of a SourceNode: title, kind, publisher, author, address (opened by you, never fetched), dates, trust and why, how close it is,
 * its status and archive address, a note, the claims that cite it, and Recheck / Open buttons. Read and written through SERVICES.sources only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { KINDS, PROXIMITY, STATUSES, LIMITS, effectiveTrust, staleness, safeUrl } from '../utils/OmniSourceModel.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const row = (label, inner, tip = '') => `<label style="display:flex;align-items:center;gap:6px;font-size:10px;margin:3px 0" title="${esc(tip)}"><span style="width:82px;opacity:.85">${esc(label)}</span>${inner}</label>`
const text = (k, v, max, ph = '') => `<input type="text" data-oisrc="${k}" maxlength="${max}" value="${esc(v)}" placeholder="${esc(ph)}" style="flex:1;font-size:10px;min-width:0">`
const sel = (k, list, cur) => `<select data-oisrc="${k}" style="flex:1">${list.map(o => `<option value="${o}"${o === cur ? ' selected' : ''}>${o}</option>`).join('')}</select>`
const label = (id) => { try { return SERVICES.lineup?.omniNode?.getNodeData?.(id)?.label || id } catch (_) { return id } }
function facts (s, cites) {
  const age = staleness(s, new Date().toISOString().slice(0, 10))
  const bits = [`counts for ${Math.round(effectiveTrust(s) * 100)}%`, `${cites.length} claim${cites.length === 1 ? '' : 's'} cite it`]
  bits.push(age === null ? 'never checked' : (age === 0 ? 'checked today' : `checked ${age} day${age === 1 ? '' : 's'} ago`))
  return bits.join(' · ')
}
export function sourceKindBlockHTML (data) {
  const S = SERVICES.sources; const s = S?.get(data.id)
  if (!s) return `<div class="oi-custom-section" id="oi-custom-src" data-kind="sourceNode" data-node-id="${esc(data.id)}"><div class="oi-custom-title">❡ Source node</div><div style="font-size:10px;opacity:.8">The source system is not running.</div></div>`
  const cites = S.citedBy(data.id)
  return `<div class="oi-custom-section" id="oi-custom-src" data-kind="sourceNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">❡ Source node</div>
    ${row('Title', text('title', s.title, LIMITS.title, 'What this is'))}
    ${row('Kind', sel('kind', KINDS, s.kind))}
    ${row('Publisher', text('publisher', s.publisher, LIMITS.publisher))}
    ${row('Author', text('author', s.author, LIMITS.author))}
    ${row('Address', text('url', s.url, LIMITS.url, 'https://...'), 'https only. Never fetched: you open it yourself.')}
    ${row('Published', `<input type="date" data-oisrc="published" value="${esc(s.published)}">`)}
    ${row('Checked', `<input type="date" data-oisrc="accessed" value="${esc(s.accessed)}">`, 'The day you last looked at it')}
    ${row('Trust', `<input type="range" min="0" max="1" step="0.05" data-oisrc="trust" value="${s.trust}" style="flex:1"><span data-testid="oisrc-trust" style="width:30px;text-align:right">${Math.round(s.trust * 100)}%</span>`, 'How far the source itself is believed (you decide)')}
    ${row('Why', text('trustWhy', s.trustWhy, LIMITS.trustWhy, 'one line'))}
    ${row('Closeness', sel('proximity', PROXIMITY, s.proximity), 'primary = at the event, tertiary = a summary of a summary')}
    ${row('Status', sel('status', STATUSES, s.status))}
    ${row('Archive', text('archiveUrl', s.archiveUrl, LIMITS.url, 'https://web.archive.org/...'))}
    <textarea data-oisrc="note" maxlength="${LIMITS.note}" rows="2" style="width:100%;font-size:11px;box-sizing:border-box" placeholder="Note">${esc(s.note)}</textarea>
    <div style="font-size:10px;opacity:.85;margin:4px 0" data-testid="oisrc-facts">${esc(facts(s, cites))}</div>
    <div style="font-size:9.5px;opacity:.75;margin:2px 0" data-testid="oisrc-cites">${cites.length ? 'cited by: ' + cites.map(c => esc(label(c))).join('; ') : 'No claim cites this yet.'}</div>
    <div style="margin:4px 0;display:flex;gap:4px;flex-wrap:wrap"><button class="oi-btn-small" data-oisrc-act="recheck" title="Set Checked to today">Checked today</button><button class="oi-btn-small" data-oisrc-act="open" title="Open the address in a new tab">Open</button></div>
    <div style="font-size:10px;opacity:.8" data-testid="oisrc-msg"></div>
  </div>`
}
export function wireSourceKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-src'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const s = () => SERVICES.sources; const msg = (t) => { const m = sec.querySelector('[data-testid="oisrc-msg"]'); if (m) m.textContent = t || '' }
  const refresh = () => { const cur = s()?.get(data.id); if (!cur) return; const f = sec.querySelector('[data-testid="oisrc-facts"]'); if (f) f.textContent = facts(cur, s().citedBy(data.id)) }
  sec.addEventListener('change', (ev) => {
    const t = ev.target; const k = t.dataset?.oisrc; if (!k || !s()) return
    try {
      const r = s().set(data.id, { [k]: t.value }); msg(r.ok ? '' : r.error)
      if (r.ok && (k === 'url' || k === 'archiveUrl') && t.value.trim() && !r.source[k]) msg('Only https addresses are kept.')
      if (r.ok && (k === 'url' || k === 'archiveUrl')) t.value = r.source[k]
      refresh()
    } catch (err) { msg(String(err?.message ?? err)) }
  })
  sec.addEventListener('input', (ev) => { const t = ev.target; if (t.dataset?.oisrc === 'trust') { const v = sec.querySelector('[data-testid="oisrc-trust"]'); if (v) v.textContent = Math.round(Number(t.value) * 100) + '%' } })
  sec.addEventListener('click', (ev) => {
    const b = ev.target.closest?.('[data-oisrc-act]'); if (!b || !s()) return; const a = b.dataset.oisrcAct
    try {
      if (a === 'recheck') { s().recheck(data.id); const d = sec.querySelector('[data-oisrc="accessed"]'); if (d) d.value = s().get(data.id).accessed; refresh() }
      else if (a === 'open') { const u = safeUrl(s().get(data.id)?.url); if (!u) msg('No https address to open.'); else window.open(u, '_blank', 'noopener,noreferrer') }
    } catch (err) { msg(String(err?.message ?? err)) }
  })
}
