/**
 * ui/OmniClaimInspector.js (V260) — the "ClaimNode" section of the Inspector (and the testimony form).
 * A locked private claim shows only its title and a key box. Otherwise: the claim, public / private, the scale, the true / false / undefined shares with a chart,
 * who said what (people, bots, AI, sensors ... kept apart), the testimony form, evidence quality + promotion, theories (staged, confirmed, rejected with reasons) and the undefined items.
 * Everything goes through SERVICES.claims (systems/OmniClaimNodes.js): this file imports no system.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { ENTITY_KINDS, VERDICTS, UNDEFINED_LAYERS, canPromote, independence, conditionDiversity, byEntity } from '../utils/OmniClaimModel.js'
import { esc } from './OmniSoundFields.js'

const svc = () => SERVICES.claims
const STYLES = `
.oicl-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
.oicl-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
.oicl-in { min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.oicl-note { font-size: 9.5px; opacity: .75; line-height: 1.4; margin: 4px 0; }
.oicl-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; } .oicl-msg.is-err { color: #ff9c9c; }
.oicl-bar { display: flex; height: 14px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,.25); }
.oicl-card { border: 1px solid rgba(255,255,255,.15); border-radius: 6px; padding: 4px 6px; margin: 4px 0; font-size: 10px; }
.oicl-t, .oicl-lock { font-size: 10px; } .oicl-sub { font-size: 10px; opacity: .8; margin-top: 6px; letter-spacing: .05em; }
@media (max-width: 700px) { .oicl-row .oi-btn-small, .oicl-in { min-height: 40px; } }
`
function injectStyles () { if (typeof document === 'undefined' || document.getElementById('oicl-styles')) return; const s = document.createElement('style'); s.id = 'oicl-styles'; s.textContent = STYLES; document.head.appendChild(s) }
const pct = (v) => Math.round(v * 1000) / 10 + '%'
const parseKV = (t) => { const o = {}; for (const part of String(t || '').split(/[,\n]/)) { const [k, ...r] = part.split('='); const key = k.trim(); if (key && r.length) { const v = r.join('=').trim(); o[key] = v === 'true' ? true : v === 'false' ? false : (v !== '' && Number.isFinite(Number(v)) ? Number(v) : v) } } return o }
const lines = (t) => String(t || '').split(/[\n;]/).map(x => x.trim()).filter(Boolean)

/** Run one action; returns { ok, text }. Async for the key work. Exported so the tests call the same code the buttons do. */
export async function runClaimAction (act, id, arg = {}) {
  const s = svc(); if (!s) return { ok: false, text: 'The claim system is not running.' }
  if (!s.isClaim(id)) return { ok: false, text: 'This is not a ClaimNode.' }
  try {
    switch (act) {
      case 'text': s.setClaimText(id, String(arg.text ?? '')); return { ok: true, text: 'Saved.' }
      case 'scale': s.setScale(id, Number(arg.scale)); return { ok: true, text: 'Scale ' + s.get(id).state.scale }
      case 'state': { const ch = {}; if (arg.identity) ch.identity = String(arg.identity); if (arg.laws !== undefined) ch.laws = lines(arg.laws); if (arg.conditions !== undefined) ch.conditions = parseKV(arg.conditions); s.setState(id, ch, String(arg.reason ?? '')); return { ok: true, text: 'The old state is closed and kept; a new one begins.' } }
      case 'testify': { const t = { entity: { kind: arg.kind, id: arg.entityId, resolution: Number(arg.resolution || 0) }, observation: arg.observation, interpretation: arg.interpretation, verdict: arg.verdict, region: [Number(arg.from ?? 0), Number(arg.to ?? 1)], weight: Number(arg.weight ?? 1), conditions: parseKV(arg.conditions), sourceKey: arg.sourceKey || '' }; s.testify(id, t); return { ok: true, text: 'Testimony added (' + (t.entity.kind || 'unknown') + ').' } }
      case 'remove-testimony': s.removeTestimony(id, String(arg.id)); return { ok: true, text: 'Removed.' }
      case 'promote': { const before = s.get(id).testimonies.filter(t => t.truthType === 'subjective').length; s.promote(id); const after = s.get(id).testimonies.filter(t => t.truthType === 'subjective').length; return { ok: true, text: after > before ? (after - before) + ' testimonies promoted to subjective truth.' : 'Nothing passes the test yet (needs several independent sources under different conditions).' } }
      case 'stage': s.stage(id, String(arg.statement ?? ''), Array.isArray(arg.support) ? arg.support : s.get(id).testimonies.map(t => t.id)); return { ok: true, text: 'Theory staged.' }
      case 'confirm': case 'reject': s.resolve(id, String(arg.id), act === 'confirm', String(arg.reason ?? '')); return { ok: true, text: act === 'confirm' ? 'Confirmed.' : 'Rejected, and kept with its reason.' }
      case 'unknown': s.addUnknown(id, String(arg.layer), String(arg.text ?? ''), String(arg.by ?? '')); return { ok: true, text: 'Added.' }
      case 'aware': { const list = (t) => String(t ?? '').split(';').map(x => x.trim()).filter(Boolean); s.addAwareness(id, { name: String(arg.name ?? ''), systemType: arg.type, familiarity: list(arg.familiar), scope: list(arg.accepts), resolution: Number(arg.resolution || 0) }); return { ok: true, text: 'Awareness added.' } }
      case 'identify': { const r = s.identify(id, String(arg.subject ?? '')); const aw = s.get(id).awarenesses; return { ok: true, text: r.map(o => (aw.find(a => a.id === o.awareness)?.name ?? '?') + ': ' + o.result).join(' · ') } }
      case 'branch': s.setBranch(id, String(arg.id), String(arg.status), String(arg.reason ?? '')); return { ok: true, text: 'Branch ' + arg.status + '.' }
      case 'grow': { const n = s.growBranch(id, String(arg.id)); return { ok: true, text: 'A new reality grew: ' + n } }
      case 'view': { const v = SERVICES.claimview; if (!v) return { ok: false, text: 'The claim view is not running.' }; v.toggle(id); return { ok: true, text: v.isShown(id) ? 'The rooms are open round the node.' : 'Rooms closed.' } }
      case 'private': await s.makePrivate(id, String(arg.key ?? '')); return { ok: true, text: 'Sealed. Keep the key: it is not saved anywhere.' }
      case 'unlock': await s.unlock(id, String(arg.key ?? '')); return { ok: true, text: 'Unlocked for this session.' }
      case 'lock': await s.lock(id); return { ok: true, text: 'Locked.' }
      case 'public': s.makePublic(id); return { ok: true, text: 'The seal is off: this claim is public.' }
      default: return { ok: false, text: 'Unknown action.' }
    }
  } catch (err) { return { ok: false, text: String(err?.message ?? err) } }
}

function chartSVG (cv, cells) {
  const W = 260; const H = 70; const xs = (i) => 4 + (cv.length < 2 ? 0 : i / (cv.length - 1)) * (W - 8); const ys = (v) => 4 + (1 - v) * (H - 8)
  const line = (k, c) => `<polyline fill="none" stroke="${c}" stroke-width="2" points="${cv.map((p, i) => xs(i).toFixed(1) + ',' + ys(p[k]).toFixed(1)).join(' ')}"/>`
  const n = cells.length; const cw = (W - 8) / Math.max(1, n); const strip = cells.slice(0, 256).map((c, i) => `<rect x="${(4 + i * cw).toFixed(2)}" y="${H + 6}" width="${Math.max(0.5, cw).toFixed(2)}" height="10" fill="${c === 't' ? '#00c800' : c === 'f' ? '#dc0000' : '#e6d200'}"/>`).join('')
  return `<svg viewBox="0 0 ${W} ${H + 20}" width="100%" role="img" aria-label="True, false and undefined share at each scale, and the cells at this scale"><rect x="0" y="0" width="${W}" height="${H}" fill="rgba(255,255,255,.04)"/>${line('truth', '#00c800')}${line('false', '#dc0000')}${line('undefined', '#e6d200')}${strip}</svg>`
}

export function claimKindBlockHTML (data) {
  injectStyles(); const s = svc(); if (!s) return ''
  const id = data.id
  if (s.isLocked(id)) return `<div class="oi-custom-section" id="oi-custom-claim" data-oicl-root data-node-id="${esc(id)}"><div class="oi-custom-title">⟐ ClaimNode 🔒</div>
    <div class="oicl-card"><b>${esc(s.title(id))}</b><div class="oicl-note">This claim is private. Only its title is visible. Enter the key to read or change it.</div></div>
    <div class="oicl-row"><input class="oicl-in" type="password" data-oicl="key" placeholder="Key" aria-label="Key" autocomplete="off" style="flex:1"><button class="oi-btn-small" data-oicla="unlock">Unlock</button></div><div class="oicl-msg" role="status" aria-live="polite" data-ref="oicl-msg"></div></div>`
  const c = s.get(id); if (!c) return ''
  const d = s.data(id); const sh = d.shares; const priv = c.visibility === 'private'
  const kinds = ENTITY_KINDS.map(k => `<option value="${k}">${k}</option>`).join(''); const verds = VERDICTS.map(k => `<option value="${k}">${k}</option>`).join('')
  const who = Object.entries(byEntity(c)).filter(([, v]) => v.accounts).map(([k, v]) => `<div>${esc(k)}: ${v.accounts} (true ${v.true}, false ${v.false}, undefined ${v.undefined})</div>`).join('') || '<div style="opacity:.6">No testimonies yet.</div>'
  const tl = c.testimonies.slice(-8).reverse().map(t => `<div class="oicl-card"><b>${esc(t.entity.kind)}${t.entity.id ? ' ' + esc(t.entity.id) : ''}</b> says <b>${esc(t.verdict)}</b> for ${Math.round(t.region[0] * 100)}–${Math.round(t.region[1] * 100)}% <span style="opacity:.6">(${esc(t.truthType)})</span>${t.observation ? `<div>Saw: ${esc(t.observation)}</div>` : ''}${t.interpretation ? `<div>Means: ${esc(t.interpretation)}</div>` : ''}<button class="oi-btn-small" data-oicla="remove-testimony" data-tid="${esc(t.id)}" aria-label="Remove testimony">✕</button></div>`).join('')
  const can = canPromote(c); const th = c.theories.map(t => `<div class="oicl-card"><b>${esc(t.status)}</b> ${esc(t.statement)}${t.reason ? `<div>Because: ${esc(t.reason)}</div>` : ''}${t.status === 'staged' ? `<div class="oicl-row"><input class="oicl-in" data-oicl="reason-${esc(t.id)}" placeholder="Reason" style="flex:1" aria-label="Reason"><button class="oi-btn-small" data-oicla="confirm" data-tid="${esc(t.id)}">Confirm</button><button class="oi-btn-small" data-oicla="reject" data-tid="${esc(t.id)}">Reject</button></div>` : ''}</div>`).join('')
  const un = ['known_unknown', 'unknown_unknown', 'declined'].map(k => c.items[k].map(i => `<div>${esc(k.replace('_', ' '))}: ${esc(i.text)}${i.by ? ' (' + esc(i.by) + ')' : ''}</div>`).join('')).join('')
  return `<div class="oi-custom-section" id="oi-custom-claim" data-oicl-root data-node-id="${esc(id)}">
    <div class="oi-custom-title">⟐ ClaimNode ${priv ? '🔓 private' : '· public'}</div>
    <div class="oicl-row"><input class="oicl-in" data-oicl="text" value="${esc(c.claim)}" aria-label="The claim" style="flex:1"></div>
    <div class="oicl-row"><span class="oi-label">Scale (cells)</span><input class="oicl-in" type="number" data-oicl="scale" min="1" max="4096" value="${c.state.scale}" style="width:84px" aria-label="Scale"><span class="oicl-note" style="margin:0">${d.objective ? '✔ objective at this scale' : 'not objective here (needs nothing undefined and a Law)'}</span></div>
    <div class="oicl-bar" aria-hidden="true"><div style="flex:${sh.truth};background:${d.objective ? '#fff' : '#00c800'}"></div><div style="flex:${sh.false};background:${d.objective ? '#000' : '#dc0000'}"></div><div style="flex:${sh.undefined};background:${d.objective ? '#808080' : '#e6d200'}"></div></div>
    <div class="oicl-t" data-testid="oicl-shares">True ${pct(sh.truth)} · False ${pct(sh.false)} · Undefined ${pct(sh.undefined)} <span style="opacity:.7">(conflict ${pct(d.undefinedBy.conflict)}, absence ${pct(d.undefinedBy.absence)}, mixed ${pct(d.undefinedBy.mixed)}, too coarse ${pct(d.undefinedBy.known_unknown)})</span></div>
    <div class="oicl-row"><button class="oi-btn-small" data-oicla="view">⌂ Walk in: open / close the three rooms</button></div>
    ${chartSVG(d.curve, d.cells)}
    <div class="oicl-note">Lines: true / false / undefined at scales 1 to 1024. Strip: each cell at this scale. Zoom in (a bigger scale) and mixed cells split; a boundary with real thickness stays undefined at every scale.</div>
    <div class="oicl-sub">IDENTITY, LAWS AND CONDITIONS</div>
    <div class="oicl-row"><input class="oicl-in" data-oicls="identity" value="${esc(c.state.identity)}" aria-label="Identity" placeholder="Identity" style="flex:1 1 100%"><input class="oicl-in" data-oicls="laws" value="${esc(c.state.laws.join('; '))}" aria-label="Laws" placeholder="Laws; separated by semicolons" style="flex:1 1 100%"><input class="oicl-in" data-oicls="conditions" value="${esc(Object.entries(c.state.conditions).map(([k, v]) => k + '=' + v).join(', '))}" aria-label="Conditions" placeholder="conditions: lime=true, temp=20" style="flex:1 1 100%"><input class="oicl-in" data-oicls="reason" aria-label="Why it changed" placeholder="Why is it changing?" style="flex:1"><button class="oi-btn-small" data-oicla="state">Change the state</button></div>
    <div class="oicl-note">${c.stateHistory.length} earlier state(s) are kept; changing never erases.</div>
    <div class="oicl-sub">WHO SAID WHAT</div><div class="oicl-card" data-testid="oicl-who">${who}</div>
    <div class="oicl-sub">ADD A TESTIMONY</div>
    <div class="oicl-row"><select class="oicl-in" data-oicl="kind" aria-label="Who is speaking">${kinds}</select><input class="oicl-in" data-oicl="entityId" placeholder="Name or id" aria-label="Name or id" style="flex:1"><input class="oicl-in" type="number" data-oicl="resolution" min="0" max="1" step="0.01" value="0" style="width:70px" aria-label="Finest detail it can see (0 to 1)" title="Finest cell width it can perceive, 0 to 1"></div>
    <div class="oicl-row"><textarea class="oicl-in" data-oicl="observation" rows="2" placeholder="What was observed" aria-label="Observation" style="flex:1 1 100%"></textarea><textarea class="oicl-in" data-oicl="interpretation" rows="2" placeholder="What it means (interpretation)" aria-label="Interpretation" style="flex:1 1 100%"></textarea></div>
    <div class="oicl-row"><select class="oicl-in" data-oicl="verdict" aria-label="Verdict">${verds}</select><span class="oi-label">from</span><input class="oicl-in" type="number" data-oicl="from" min="0" max="1" step="0.05" value="0" style="width:64px" aria-label="Covers from"><span class="oi-label">to</span><input class="oicl-in" type="number" data-oicl="to" min="0" max="1" step="0.05" value="1" style="width:64px" aria-label="Covers to"><span class="oi-label">weight</span><input class="oicl-in" type="number" data-oicl="weight" min="0" step="0.5" value="1" style="width:60px" aria-label="Weight"></div>
    <div class="oicl-row"><input class="oicl-in" data-oicl="conditions" placeholder="conditions it was seen under: light=day" aria-label="Conditions" style="flex:1"><input class="oicl-in" data-oicl="sourceKey" placeholder="source (same source = counts once)" aria-label="Source" style="flex:1"><button class="oi-btn-small" data-oicla="testify">＋ Testify</button></div>
    ${tl}
    <div class="oicl-sub">EVIDENCE</div>
    <div class="oicl-note">${c.testimonies.length} account(s) · independence ${pct(independence(c))} · condition diversity ${pct(conditionDiversity(c))} · true group ${can.true.ok ? 'passes' : 'not yet'} · false group ${can.false.ok ? 'passes' : 'not yet'}</div>
    <div class="oicl-row"><button class="oi-btn-small" data-oicla="promote">Promote what passes → subjective truth</button></div>
    <div class="oicl-sub">THEORIES</div>${th}
    <div class="oicl-row"><input class="oicl-in" data-oicl="statement" placeholder="A theory this evidence supports" aria-label="Theory" style="flex:1"><button class="oi-btn-small" data-oicla="stage">Stage it</button></div>
    <div class="oicl-sub">UNDEFINED, ON THE RECORD</div>${un}
    <div class="oicl-row"><select class="oicl-in" data-oicl="layer" aria-label="Kind">${['known_unknown', 'unknown_unknown', 'declined'].map(k => `<option value="${k}">${k.replace('_', ' ')}</option>`).join('')}</select><input class="oicl-in" data-oicl="unknownText" placeholder="What is not known, or not answered" aria-label="Text" style="flex:1"><button class="oi-btn-small" data-oicla="unknown">＋ Add</button></div>
    <div class="oicl-sub">AWARENESS: WHAT CAN IDENTIFY IT</div>
    ${c.awarenesses.map(a => `<div class="oicl-card"><b>${esc(a.name)}</b> · ${esc(a.systemType)} · can resolve ${a.familiarity.length}, accepts ${a.scope.length}${a.systemType === 'intentional' ? ' <span style="opacity:.7">(what it declines shows its values)</span>' : ''}</div>`).join('') || '<div class="oicl-note">No awareness yet. An awareness can only identify what it is familiar with, and only keeps what it accepts.</div>'}
    <div class="oicl-row"><input class="oicl-in" data-oicl="awName" placeholder="Name (Camera, Moderator ...)" aria-label="Awareness name" style="flex:1"><select class="oicl-in" data-oicl="awType" aria-label="Natural or intentional"><option value="natural">natural</option><option value="intentional">intentional</option></select></div>
    <div class="oicl-row"><input class="oicl-in" data-oicl="awFamiliar" placeholder="Can resolve: a; b; c" aria-label="Familiar with" style="flex:1"><input class="oicl-in" data-oicl="awAccepts" placeholder="Accepts: a; b" aria-label="Accepts" style="flex:1"><button class="oi-btn-small" data-oicla="aware">＋ Awareness</button></div>
    <div class="oicl-row"><input class="oicl-in" data-oicl="subject" placeholder="Subject to identify" aria-label="Subject" style="flex:1"><button class="oi-btn-small" data-oicla="identify">Identify</button></div>
    ${c.branches.map(b => `<div class="oicl-card"><b>Branch</b> “${esc(b.subject)}” <span style="opacity:.7">(${esc(b.status)}${b.nodes.length ? ', ' + b.nodes.length + ' reality' : ''})</span><div class="oicl-row"><button class="oi-btn-small" data-oicla="grow" data-tid="${esc(b.id)}">Grow a reality</button><button class="oi-btn-small" data-oicla="branch" data-st="dormant" data-tid="${esc(b.id)}">Dormant</button><button class="oi-btn-small" data-oicla="branch" data-st="forked" data-tid="${esc(b.id)}">Fork</button><button class="oi-btn-small" data-oicla="branch" data-st="merged" data-tid="${esc(b.id)}">Merge</button></div></div>`).join('')}
    <div class="oicl-sub">PRIVACY</div>
    ${priv ? '<div class="oicl-row"><button class="oi-btn-small" data-oicla="lock">🔒 Lock</button><button class="oi-btn-small" data-oicla="public">Make public</button></div>' : '<div class="oicl-row"><input class="oicl-in" type="password" data-oicl="newkey" placeholder="Choose a key (4+ characters)" aria-label="New key" autocomplete="new-password" style="flex:1"><button class="oi-btn-small" data-oicla="private">Make private</button></div><div class="oicl-note">The key is never saved. If you lose it, the claim cannot be read again.</div>'}
    <div class="oicl-msg" role="status" aria-live="polite" data-ref="oicl-msg"></div></div>`
}
export function wireClaimKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-claim'); if (!sec || sec.dataset.wired === '1') return; sec.dataset.wired = '1'
  const id = data.id; const q = (k) => sec.querySelector(`[data-oicl="${k}"]`)?.value; const qs = (k) => sec.querySelector(`[data-oicls="${k}"]`)?.value
  const say = (r) => { const m = sec.querySelector('[data-ref="oicl-msg"]'); if (m) { m.textContent = r.text; m.className = 'oicl-msg' + (r.ok ? '' : ' is-err') } }
  const redraw = (msg) => { const h = document.createElement('div'); h.innerHTML = claimKindBlockHTML(data); const fresh = h.firstElementChild; if (!fresh) return; sec.replaceChildren(...fresh.childNodes); if (msg) say(msg) }
  sec.addEventListener('click', async (e) => {
    const b = e.target.closest?.('[data-oicla]'); if (!b || b.disabled) return; const a = b.dataset.oicla; let arg = {}
    if (a === 'unlock') arg = { key: q('key') }; else if (a === 'private') arg = { key: q('newkey') }
    else if (a === 'state') arg = { identity: qs('identity'), laws: qs('laws'), conditions: qs('conditions'), reason: qs('reason') }
    else if (a === 'testify') arg = { kind: q('kind'), entityId: q('entityId'), resolution: q('resolution'), observation: q('observation'), interpretation: q('interpretation'), verdict: q('verdict'), from: q('from'), to: q('to'), weight: q('weight'), conditions: q('conditions'), sourceKey: q('sourceKey') }
    else if (a === 'stage') arg = { statement: q('statement') }
    else if (a === 'confirm' || a === 'reject') arg = { id: b.dataset.tid, reason: q('reason-' + b.dataset.tid) }
    else if (a === 'remove-testimony') arg = { id: b.dataset.tid }
    else if (a === 'unknown') arg = { layer: q('layer'), text: q('unknownText') }
    else if (a === 'aware') arg = { name: q('awName'), type: q('awType'), familiar: q('awFamiliar'), accepts: q('awAccepts') }
    else if (a === 'identify') arg = { subject: q('subject') }
    else if (a === 'grow') arg = { id: b.dataset.tid }
    else if (a === 'branch') arg = { id: b.dataset.tid, status: b.dataset.st, reason: 'from the Inspector' }
    const r = await runClaimAction(a, id, arg); redraw(r)
  })
  sec.addEventListener('change', async (e) => {
    const k = e.target?.dataset?.oicl; if (k !== 'text' && k !== 'scale') return
    const r = await runClaimAction(k, id, { text: e.target.value, scale: e.target.value }); redraw(r)
  })
  if (typeof window !== 'undefined') { const h = (ev) => { if (ev.detail?.nodeId === id && sec.isConnected && !sec.contains(document.activeElement)) redraw(null) }; window.addEventListener('omni:claim-changed', h); window.addEventListener('omni:claim-locked', h); const obs = new MutationObserver(() => { if (!sec.isConnected) { window.removeEventListener('omni:claim-changed', h); window.removeEventListener('omni:claim-locked', h); obs.disconnect() } }); obs.observe(document.body, { childList: true, subtree: true }) }
}
