/**
 * ui/OmniTimePadBoard.js (V260) — the OmniTimePad on screen: a board of big buttons, like a sound board but for events.
 * Press a button and its list of timed actions runs on the TimeCubes. ✎ Edit switches to editing: pick a button, rename it, colour it, add/remove actions.
 * All work goes through SERVICES.timenodes (systems/OmniTimeNodes.js). Opened with the ribbon's Time > TimePad, `Omni Time board`, or omni:timepad-board { action: 'toggle'|'open'|'close' }.
 * #omni-ui ignores the pointer, so the board sets pointer-events itself.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { OPS } from '../utils/OmniTimePadModel.js'
import { esc } from './OmniSoundFields.js'

const CSS = `
#omni-timepad { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 62; display: none; width: min(560px, calc(100vw - 16px)); max-height: 70vh; overflow: auto; box-sizing: border-box;
  padding: 8px; border-radius: 12px; background: rgba(10,12,18,.9); border: 1px solid rgba(255,255,255,.22); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font: 11px "Courier New", monospace; color: rgba(255,255,255,.88); pointer-events: auto; user-select: none; touch-action: manipulation; }
#omni-timepad.is-on { display: block; }
#omni-timepad .tpb-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 6px; }
#omni-timepad .tpb-title { flex: 1 1 auto; letter-spacing: .06em; opacity: .75; }
#omni-timepad select, #omni-timepad input { min-height: 28px; box-sizing: border-box; font: inherit; color: inherit; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.25); border-radius: 6px; padding: 2px 6px; }
#omni-timepad button.tpb-small { min-height: 28px; padding: 0 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.08); color: inherit; font: inherit; cursor: pointer; }
#omni-timepad button.tpb-small:hover { background: rgba(255,255,255,.18); }
#omni-timepad .tpb-grid { display: grid; gap: 6px; }
#omni-timepad button.tpb-pad { min-height: 64px; border-radius: 10px; border: 2px solid rgba(255,255,255,.3); color: #fff; font: bold 12px "Courier New", monospace; cursor: pointer; text-shadow: 0 1px 2px rgba(0,0,0,.6); word-break: break-word; }
#omni-timepad button.tpb-pad:active, #omni-timepad button.tpb-pad.is-hit { filter: brightness(1.6); transform: scale(.97); }
#omni-timepad button.tpb-pad.is-sel { outline: 2px solid #fff; }
#omni-timepad .tpb-edit { margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,.15); }
#omni-timepad .tpb-act { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 3px 0; }
#omni-timepad .tpb-note { opacity: .65; font-size: 10px; margin: 4px 0; }
#omni-timepad .tpb-msg { min-height: 12px; font-size: 10px; color: #8cffb4; } #omni-timepad .tpb-msg.is-err { color: #ff9c9c; }
@media (max-width: 700px) { #omni-timepad button.tpb-pad { min-height: 72px; } #omni-timepad button.tpb-small, #omni-timepad select, #omni-timepad input { min-height: 40px; } }
`
export default class OmniTimePadBoard {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._el = null; this._bound = []; this._pad = ''; this._btn = ''; this._edit = false; this._msg = null; this._inited = false }
  init () {
    if (this._inited || typeof document === 'undefined') return; this._inited = true
    if (!document.getElementById('omni-timepad-css')) { const s = document.createElement('style'); s.id = 'omni-timepad-css'; s.textContent = CSS; document.head.appendChild(s) }
    const el = this._el = document.createElement('div'); el.id = 'omni-timepad'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'OmniTimePad'); document.body.appendChild(el)
    el.addEventListener('click', (e) => this._click(e)); el.addEventListener('change', (e) => this._change(e))
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:timepad-board', (d) => { if (d.action === 'close') this.close(); else if (d.action === 'open') this.open(); else this.toggle() })
    on('omni:timepad-changed', () => { if (this.isOpen) this.render() }); on('omni:node-deleted', () => { if (this.isOpen) setTimeout(() => this.render(), 50) })
    this._key = (e) => { if (e.key === 'Escape' && this.isOpen && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) this.close() }; document.addEventListener('keydown', this._key)
    SERVICES.timepadboard = this
  }
  destroy () { document.removeEventListener('keydown', this._key); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; this._el?.remove(); this._el = null; if (SERVICES.timepadboard === this) SERVICES.timepadboard = null; this._inited = false }
  update () {} onResize () {}
  get isOpen () { return !!this._el?.classList.contains('is-on') }
  open () { if (!this._el) return false; this._el.classList.add('is-on'); this.render(); return true }
  close () { this._el?.classList.remove('is-on'); return true }
  toggle () { return this.isOpen ? this.close() : this.open() }
  get svc () { return SERVICES.timenodes }
  _say (text, err = false) { this._msg = { text, err }; const m = this._el?.querySelector('.tpb-msg'); if (m) { m.textContent = text; m.className = 'tpb-msg' + (err ? ' is-err' : '') } }
  _cubes () { const s = this.svc; return (s?.list?.() ?? []).map(id => ({ id, title: s.entry(id)?.title || id })) }
  render () {
    const s = this.svc; if (!this._el) return
    if (!s) { this._el.innerHTML = '<div class="tpb-note">The time system is not running.</div>'; return }
    const pads = s.pads(); if (!pads.find(p => p.id === this._pad)) this._pad = pads[0]?.id ?? ''
    const pad = pads.find(p => p.id === this._pad)
    const opts = pads.map(p => `<option value="${esc(p.id)}"${p.id === this._pad ? ' selected' : ''}>${esc(p.name)}</option>`).join('')
    const grid = pad ? `<div class="tpb-grid" style="grid-template-columns:repeat(${pad.columns},1fr)">${pad.buttons.map(b => `<button type="button" class="tpb-pad${b.id === this._btn && this._edit ? ' is-sel' : ''}" data-btn="${esc(b.id)}" style="background:${esc(b.color)}" title="${b.actions.length} action(s)">${esc(b.label)}</button>`).join('')}</div>` : '<div class="tpb-note">No pad yet. Press ＋ Pad.</div>'
    this._el.innerHTML = `<div class="tpb-bar"><span class="tpb-title">⏱ OMNITIMEPAD</span>${pads.length ? `<select data-f="pad" aria-label="Pad">${opts}</select>` : ''}
      <button type="button" class="tpb-small" data-a="newpad">＋ Pad</button>${pad ? '<button type="button" class="tpb-small" data-a="newbtn">＋ Button</button>' : ''}${pad ? `<button type="button" class="tpb-small" data-a="edit" aria-pressed="${this._edit}">${this._edit ? '✓ Done' : '✎ Edit'}</button>` : ''}<button type="button" class="tpb-small" data-a="close" aria-label="Close">✕</button></div>${grid}${this._edit && pad ? this._editHTML(pad) : ''}<div class="tpb-msg" role="status" aria-live="polite"></div>`
    if (this._msg) this._say(this._msg.text, this._msg.err)
  }
  _editHTML (pad) {
    const b = pad.buttons.find(x => x.id === this._btn)
    if (!b) return `<div class="tpb-edit"><div class="tpb-note">Pick a button to edit its actions. <button type="button" class="tpb-small" data-a="delpad">Delete this pad</button></div></div>`
    const cubes = this._cubes(); const co = cubes.map(c => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')
    const oo = OPS.map(o => `<option value="${o}">${o}</option>`).join('')
    const acts = b.actions.map((a, i) => `<div class="tpb-act"><span>after ${a.at} ms</span><b>${esc(a.op)}</b><span>${esc(this.svc.entry(a.target)?.title || a.target)}</span><button type="button" class="tpb-small" data-a="delact" data-i="${i}" aria-label="Remove action">✕</button></div>`).join('') || '<div class="tpb-note">No actions yet.</div>'
    return `<div class="tpb-edit"><div class="tpb-act"><input data-f="label" value="${esc(b.label)}" aria-label="Button name" style="flex:1 1 120px"><input type="color" data-f="color" value="${esc(b.color)}" aria-label="Button colour" style="width:44px;padding:0"><button type="button" class="tpb-small" data-a="delbtn">Delete button</button></div>
      ${acts}<div class="tpb-act">${cubes.length ? `<select data-f="op" aria-label="Action">${oo}</select><select data-f="target" aria-label="Cube">${co}</select><input type="number" data-f="at" min="0" value="0" style="width:84px" aria-label="Milliseconds after the press"><button type="button" class="tpb-small" data-a="addact">＋ Action</button>` : '<span class="tpb-note">Make a TimeCube first (Create &gt; TimeNode).</span>'}</div></div>`
  }
  _click (e) {
    const s = this.svc; if (!s) return
    const pb = e.target.closest?.('[data-btn]')
    if (pb) { if (this._edit) { this._btn = pb.dataset.btn; this.render() } else { const r = s.pressButton(this._pad, pb.dataset.btn); pb.classList.add('is-hit'); setTimeout(() => pb.classList.remove('is-hit'), 150); this._say(r.ok ? `Pressed (${r.scheduled} action${r.scheduled === 1 ? '' : 's'})` : r.error, !r.ok) } return }
    const a = e.target.closest?.('[data-a]')?.dataset?.a; if (!a) return
    const out = (r) => { if (r?.ok === false) this._say(r.error, true); return r }
    switch (a) {
      case 'close': this.close(); break
      case 'edit': this._edit = !this._edit; this.render(); break
      case 'newpad': { const r = out(s.createPad('Pad ' + (s.pads().length + 1))); if (r.ok) { this._pad = r.pad.id; this._btn = '' } break }
      case 'newbtn': { const n = (s.pads().find(p => p.id === this._pad)?.buttons.length ?? 0) + 1; const r = out(s.addPadButton(this._pad, { label: 'Button ' + n })); if (r.ok) { this._btn = r.pad.buttons[r.pad.buttons.length - 1].id; this._edit = true; this.render() } break }
      case 'delpad': s.deletePad(this._pad); this._pad = ''; this._btn = ''; this.render(); break
      case 'delbtn': out(s.removePadButton(this._pad, this._btn)); this._btn = ''; break
      case 'addact': { const g = (f) => this._el.querySelector(`[data-f="${f}"]`)?.value; out(s.addPadAction(this._pad, this._btn, { op: g('op'), target: g('target'), at: Number(g('at') || 0) })); break }
      case 'delact': { const i = Number(e.target.closest('[data-i]').dataset.i); const pad = s.pads().find(p => p.id === this._pad); const b = pad?.buttons.find(x => x.id === this._btn); if (b) { const keep = b.actions.filter((_, k) => k !== i); s._padEdit(this._pad, (p) => ({ ...p, buttons: p.buttons.map(x => (x.id === this._btn ? { ...x, actions: keep } : x)) })) } break }
      default: break
    }
  }
  _change (e) {
    const s = this.svc; const f = e.target?.dataset?.f; if (!s || !f) return
    if (f === 'pad') { this._pad = e.target.value; this._btn = ''; this.render() }
    else if (f === 'label' || f === 'color') { s._padEdit(this._pad, (p) => ({ ...p, buttons: p.buttons.map(b => (b.id === this._btn ? { ...b, [f]: e.target.value } : b)) })) }
  }
}
