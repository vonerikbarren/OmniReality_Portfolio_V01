/**
 * ui/OmniRhythmPanel.js (V270) — the RhythmNode's panel (DOM, built here; everything goes through SERVICES.rhythm).
 *   Transport: ▶ Start / ■ Stop · Tap tempo · tempo · swing · "start when the scene loads" · "light along the lines"
 *   Steps: one button per step, click cycles rest → soft → accent → rest (every 4th step is marked as a beat)
 *   Follow: take the beats from a MusicNode (and a track) instead of the clock
 *   Drives: each node on the beat — animation, amount, every Nth beat, accents only, what it MEANS — and "Bind a node…" (then click a node) / "Bind selected"
 *   SERVICES.rhythmui: open(id) close() isOpen() · Events in: omni:rhythm-ui-request { action:'edit'|'close', id }
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as R from '../utils/OmniRhythmModel.js'

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const STYLES = `
.orp { position: fixed; z-index: 10034; right: 8px; top: calc(var(--omni-top-offset, 48px) + 8px); bottom: calc(var(--omni-dock-stack-h, 52px) + 8px); width: min(380px, 96vw); overflow-y: auto; padding: 8px 10px; background: var(--omni-theme-bg, rgba(14,18,28,.96)); color: var(--omni-theme-text, #eaf1ff); border: 1px solid var(--omni-theme-border, rgba(255,154,210,.55)); border-radius: 10px; font: 12px var(--omni-theme-font, system-ui, sans-serif); box-shadow: 0 4px 18px rgba(0,0,0,.45); }
.orp h4 { margin: 8px 0 4px; color: var(--omni-theme-accent, #ff9ad2); font-size: 12px; } .orp .orp-row { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin: 4px 0; }
.orp button, .orp select, .orp input { font: inherit; color: inherit; background: var(--omni-theme-input-bg, rgba(255,255,255,.08)); color: var(--omni-theme-text, #eaf1ff); border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,.22)); border-radius: 6px; padding: 4px 8px; min-height: 28px; cursor: pointer; }
.orp button:hover { background: color-mix(in srgb, var(--omni-theme-accent, #ff9ad2) 28%, transparent); } .orp input[type=number], .orp input[type=text] { cursor: text; } .orp input[type=checkbox] { min-height: 0; width: 15px; height: 15px; }
.orp .orp-steps { display: flex; flex-wrap: wrap; gap: 3px; } .orp .orp-step { width: 28px; padding: 0; text-align: center; min-height: 34px; } .orp .orp-step[data-v="1"] { background: var(--omni-theme-accent, #ffd95a); color: #111; } .orp .orp-step[data-v="0.5"] { background: color-mix(in srgb, var(--omni-theme-accent, #e68c46) 55%, transparent); } .orp .orp-step.beat { border-color: var(--omni-theme-accent, #ff9ad2); } .orp .orp-step.head { outline: 2px solid var(--omni-theme-text, #fff); }
.orp .orp-bind { border: 1px solid var(--omni-theme-border, rgba(255,255,255,.15)); border-radius: 8px; padding: 5px 6px; margin: 5px 0; } .orp .orp-bind b { color: var(--omni-theme-text, #ffd0ea); }
.orp .orp-msg { font-size: 10.5px; color: var(--omni-theme-text-dim, inherit); min-height: 14px; } .orp .orp-on { background: color-mix(in srgb, var(--omni-theme-accent, #78dca0) 35%, transparent); border-color: var(--omni-theme-accent, #78dca0); }
@media (pointer: coarse) { .orp button, .orp select, .orp input { min-height: 44px; } .orp .orp-step { width: 38px; min-height: 44px; } .orp input[type=checkbox] { width: 24px; height: 24px; } }
.orp .orp-head { background: var(--omni-theme-header-bg, rgba(255,255,255,.04)); border-radius: 6px; padding: 2px 4px; margin-top: 0; }
`
export default class OmniRhythmPanel {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._el = null; this._id = null; this._bound = []; this._inited = false; this._msg = ''; this._pick = false; this._headT = 0 }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:rhythm-ui-request', (d) => { try { if (d.action === 'close') this.close(); else this.open(d.id) } catch (_) { /* not a rhythm */ } })
    on('omni:rhythm-changed', (d) => { if (d.nodeId === this._id && d.reason !== 'step-typing') this._render() })
    on('omni:node-selected', (d) => { if (this._pick && d.node?.id) this._picked(d.node.id) })
    on('omni:node-deleted', (d) => { if (d.id === this._id) this.close() }); on('omni:scene-clear-request', () => this.close())
    this._key = (e) => { if (this._pick && e.key === 'Escape') { this._pick = false; this._say('Cancelled.'); this._render() } }; document.addEventListener('keydown', this._key)
    SERVICES.rhythmui = this
  }
  destroy () { this.close(); try { document.removeEventListener('keydown', this._key) } catch (_) { /* gone */ } for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.rhythmui === this) SERVICES.rhythmui = null; this._inited = false }
  onResize () {}
  update (delta) { if (!this._el || !this._id) return; this._headT += delta; if (this._headT < 0.12) return; this._headT = 0; this._paintHead() }
  isOpen () { return !!this._el }
  _svc () { if (!SERVICES.rhythm) throw new Error('the rhythm module is not running'); return SERVICES.rhythm }
  open (id) {
    const s = this._svc(); if (!s.isRhythmNode(id)) throw new Error('That is not a rhythm node.')
    if (!document.getElementById('orp-style')) { const st = document.createElement('style'); st.id = 'orp-style'; st.textContent = STYLES; document.head.appendChild(st) }
    this._id = id; if (!this._el) { const el = document.createElement('div'); el.className = 'orp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Rhythm'); this._wire(el); document.body.appendChild(el); this._el = el }
    this._render(); return true
  }
  close () { this._el?.remove(); this._el = null; this._id = null; this._pick = false }
  _say (t) { this._msg = t || ''; const m = this._el?.querySelector('.orp-msg'); if (m) m.textContent = this._msg }
  _label (id) { return this.omniNode?.getNodeData?.(id)?.label || id }
  _render () {
    if (!this._el || !this._id) return; const s = SERVICES.rhythm; const r = s?.getRhythm(this._id); if (!r) { this.close(); return }
    const keep = this._el.scrollTop; const running = s.isRunning(this._id)
    const musics = (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === 'musicNode')
    const fm = r.follow ? this.omniNode?.getNodeData?.(r.follow.nodeId)?.music : null
    this._el.innerHTML = `<div class="orp-row orp-head"><b style="color:var(--omni-theme-accent,#ff9ad2);flex:1">♩ Rhythm</b><button data-a="close" title="Close">✕</button></div>
<input type="text" data-f="title" maxlength="40" value="${esc(r.title)}" aria-label="Title" style="width:100%;box-sizing:border-box">
<div class="orp-row"><button data-a="toggle" class="${running ? 'orp-on' : ''}">${running ? '■ Stop' : '▶ Start'}</button><button data-a="tap" title="Tap along to set the tempo">Tap</button><label>BPM <input type="number" data-f="tempo" min="20" max="300" step="1" value="${r.tempo}" style="width:64px"></label><label>Swing <input type="number" data-f="swing" min="0" max="0.75" step="0.05" value="${r.swing}" style="width:58px"></label></div>
<div class="orp-row"><label><input type="checkbox" data-f="autostart" ${r.autostart ? 'checked' : ''}> Start when the scene loads</label></div>
<div class="orp-row"><label><input type="checkbox" data-f="light" ${r.light ? 'checked' : ''}> Light travels the lines on accents</label></div>
<h4>Steps (${r.steps.length}) — click to cycle rest · soft · accent</h4><div class="orp-steps" role="group" aria-label="Steps">${r.steps.map((v, i) => `<button class="orp-step${i % 4 === 0 ? ' beat' : ''}" data-step="${i}" data-v="${v >= 0.75 ? 1 : v > 0 ? 0.5 : 0}" aria-label="Step ${i + 1}: ${v >= 0.75 ? 'accent' : v > 0 ? 'soft' : 'rest'}">${i + 1}</button>`).join('')}</div>
<div class="orp-row"><label>Length <select data-f="length">${[4, 8, 12, 16, 24, 32].map(n => `<option value="${n}" ${n === r.steps.length ? 'selected' : ''}>${n}</option>`).join('')}</select></label><input type="text" data-f="pattern" placeholder="x...o...x...o..." value="${esc(R.patternText(r.steps))}" aria-label="Pattern as text (x accent, o soft, . rest)" style="flex:1;min-width:120px"></div>
<h4>Follow a music node</h4><div class="orp-row"><select data-f="follow" aria-label="Follow"><option value="">Own clock</option>${musics.map(m => `<option value="${esc(m.id)}" ${r.follow?.nodeId === m.id ? 'selected' : ''}>${esc(m.label || m.id)}</option>`).join('')}</select>${fm ? `<select data-f="track" aria-label="Track"><option value="">Every track</option>${(fm.tracks ?? []).map(t => `<option value="${esc(t.id)}" ${r.follow?.trackId === t.id ? 'selected' : ''}>${esc(t.name || t.id)}</option>`).join('')}</select>` : ''}</div>
<h4>Moves to this beat (${r.bindings.length})</h4><div class="orp-row"><button data-a="pick" class="${this._pick ? 'orp-on' : ''}">${this._pick ? 'Click a node… (Esc cancels)' : '＋ Bind a node…'}</button><button data-a="selected">＋ Bind the selected node</button></div>
${r.bindings.map(b => `<div class="orp-bind" data-b="${esc(b.id)}"><div class="orp-row"><b>${esc(this._label(b.target))}</b><span style="flex:1"></span><label><input type="checkbox" data-bf="on" ${b.on ? 'checked' : ''}> on</label><button data-a="unbind" title="Remove">✕</button></div>
<div class="orp-row"><select data-bf="anim" aria-label="Animation">${R.ANIMS.map(a => `<option value="${a}" ${a === b.anim ? 'selected' : ''} title="${esc(R.ANIM_INFO[a].summary)}">${R.ANIM_INFO[a].label}</option>`).join('')}</select><label>Amount <input type="number" data-bf="amount" min="0" max="2" step="0.1" value="${b.amount}" style="width:56px"></label><label>Every <input type="number" data-bf="every" min="1" max="16" step="1" value="${b.every}" style="width:48px"></label><label><input type="checkbox" data-bf="accentOnly" ${b.accentOnly ? 'checked' : ''}> accents only</label></div>
<div class="orp-row"><label>Decay <input type="number" data-bf="decay" min="0.05" max="3" step="0.05" value="${b.decay}" style="width:58px"></label><select data-bf="ease" aria-label="Ease">${R.EASES.map(x => `<option ${x === b.ease ? 'selected' : ''}>${x}</option>`).join('')}</select><input type="text" data-bf="means" list="orp-means" maxlength="40" placeholder="what it means (heartbeat, tick...)" value="${esc(b.means)}" style="flex:1;min-width:100px"></div></div>`).join('') || '<div style="opacity:.7;padding:4px 0">Nothing is on this beat yet.</div>'}
<datalist id="orp-means">${R.MEANS_PRESETS.map(m => `<option value="${esc(m)}">`).join('')}</datalist>
<div class="orp-msg" role="status" aria-live="polite"></div>`
    this._el.scrollTop = keep; this._say(this._msg); this._paintHead()
  }
  _paintHead () {
    const s = SERVICES.rhythm; if (!this._el || !s) return; const st = s._run?.get(this._id); const head = st?.running ? st.head : -1
    this._el.querySelectorAll('.orp-step').forEach(b => b.classList.toggle('head', Number(b.dataset.step) === head))
    const tg = this._el.querySelector('[data-a="toggle"]'); if (tg) { const run = !!st?.running; tg.textContent = run ? '■ Stop' : '▶ Start'; tg.classList.toggle('orp-on', run) }
  }
  _picked (nodeId) {
    this._pick = false; const s = SERVICES.rhythm
    try { if (nodeId === this._id) this._say('Pick a different node.'); else { s.bind(this._id, nodeId, 'pulse'); if (!s.isRunning(this._id)) s.start(this._id); this._say('Bound ' + this._label(nodeId) + '.') } } catch (err) { this._say(String(err?.message ?? err)) }
    this._render()
  }
  _wire (el) {
    el.addEventListener('keydown', (e) => e.stopPropagation())
    el.addEventListener('click', (e) => {
      const s = SERVICES.rhythm, id = this._id; if (!s || !id) return
      const st = e.target.closest('[data-step]'); if (st) { const i = Number(st.dataset.step); const v = Number(st.dataset.v); try { s.setStep(id, i, v === 0 ? 0.5 : v === 0.5 ? 1 : 0) } catch (err) { this._say(String(err?.message ?? err)) } return }
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a
      try {
        if (a === 'close') return this.close(); if (a === 'toggle') { s.toggle(id); this._paintHead(); return } if (a === 'tap') { const bpm = s.tap(id); this._say('Tempo ' + bpm + ' BPM'); this._render(); return }
        if (a === 'pick') { this._pick = !this._pick; this._say(this._pick ? 'Click a node in the scene to put it on the beat.' : ''); this._render(); return }
        if (a === 'selected') { const sel = this.omniNode?.getSelectedId?.(); if (!sel) throw new Error('Select a node first.'); if (sel === id) throw new Error('That is the rhythm itself: select another node.'); s.bind(id, sel, 'pulse'); if (!s.isRunning(id)) s.start(id); this._say('Bound ' + this._label(sel) + '.'); return }
        if (a === 'unbind') { const bid = b.closest('[data-b]')?.dataset.b; if (bid) s.unbind(id, bid); this._say('Removed.') }
      } catch (err) { this._say(String(err?.message ?? err)) }
    })
    const field = (e) => {
      const s = SERVICES.rhythm, id = this._id, t = e.target; if (!s || !id) return
      try {
        if (t.dataset.bf) { const bid = t.closest('[data-b]')?.dataset.b; if (!bid) return; const k = t.dataset.bf; const val = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; s.updateBinding(id, bid, { [k]: val }); return }
        const k = t.dataset.f; if (!k) return
        if (k === 'title') s.setRhythm(id, { title: t.value }, 'step-typing')
        else if (k === 'tempo') s.setTempo(id, t.value); else if (k === 'swing') s.setRhythm(id, { swing: Number(t.value) }, 'swing')
        else if (k === 'autostart') s.setRhythm(id, { autostart: t.checked }, 'autostart'); else if (k === 'light') s.setRhythm(id, { light: t.checked }, 'light')
        else if (k === 'length') { const n = Number(t.value); const r = s.getRhythm(id); const steps = r.steps.slice(0, n); while (steps.length < n) steps.push(0); s.setRhythm(id, { steps }, 'length') }
        else if (k === 'pattern') s.setPattern(id, t.value)
        else if (k === 'follow') s.follow(id, t.value || null, null)
        else if (k === 'track') s.follow(id, s.getRhythm(id).follow?.nodeId ?? null, t.value || null)
      } catch (err) { this._say(String(err?.message ?? err)); if (t.dataset.f === 'pattern') return }
    }
    el.addEventListener('change', field)
    el.addEventListener('input', (e) => { if (e.target.dataset?.f === 'title') field(e) })
  }
}
