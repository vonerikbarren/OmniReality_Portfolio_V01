/**
 * ui/OmniPolyView.js — ⟐OmniPoly: the controls of a PolyNode (V204). DOM only (DOM first, 3D second).
 * Shape (cube, tetra, octa, dodeca, icosa, plane, strip, ring + size, sides, count, fold), the face list, and for the chosen face: label, colour, tags, event, hole, and its content
 * (nothing, pattern, text, image, document, sound). Everything is read and written through systems/OmniPolyNodes.js (Extra.SERVICES.poly): each edit is one immutable model op = one undo step.
 */
import * as P from '../utils/OmniPolyModel.js'
import { SHAPE_INFO, GEOM_LIMITS } from '../utils/OmniPolyGeom.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const NAV_ITEM = '⟐OmniPoly'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const ACCEPT = '.pdf,.md,.markdown,.txt,.text,image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown'

export function injectPolyStyles () {
  if (typeof document === 'undefined' || document.getElementById('opy-styles')) return
  const s = document.createElement('style'); s.id = 'opy-styles'
  s.textContent = `
.opy { display: flex; flex-direction: column; gap: 8px; font-size: 11px; }
.opy button, .opy select, .opy input, .opy textarea { font: inherit; color: inherit; }
.opy button { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 3px 8px; cursor: pointer; min-height: 26px; }
.opy button:hover:not(:disabled) { background: rgba(255,255,255,.15); } .opy button:disabled { opacity: .4; cursor: default; }
.opy button.is-on { background: rgba(120,190,255,.35); border-color: rgba(120,190,255,.8); }
.opy button.is-hole { opacity: .55; text-decoration: line-through; }
.opy select, .opy input[type=text], .opy input[type=number], .opy textarea { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; padding: 2px 5px; min-height: 26px; box-sizing: border-box; }
.opy select option { color: #111; background: #fff; }
.opy input[type=number] { width: 64px; } .opy textarea { width: 100%; min-height: 70px; resize: vertical; }
.opy-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.opy-faces { display: flex; gap: 4px; flex-wrap: wrap; }
.opy-box { border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; }
.opy-note { font-size: 9.5px; opacity: .75; line-height: 1.4; }
.opy-msg { min-height: 14px; opacity: .9; } .opy-msg.is-err { color: #ff9c9c; }
.opy-notice { padding: 8px; border: 1px dashed rgba(255,255,255,.35); border-radius: 8px; line-height: 1.45; }
@media (max-width: 700px) { .opy button, .opy select, .opy input, .opy textarea { min-height: 40px; } }
`
  document.head.appendChild(s)
}

export default class OmniPolyView {
  constructor (host, opts = {}) { this.host = host; this.opts = opts; this.nodeId = null; this.face = 0; this._bound = []; this._sig = ''; this._msg = ''; this._err = false; this._clips = []; this._loaded = false }
  get svc () { return this.opts.svc ?? SERVICES.poly }

  mount () {
    injectPolyStyles()
    this.host.innerHTML = '<div class="opy" data-ref="root"></div>'
    const on = (t, n, f) => { t.addEventListener(n, f); this._bound.push([t, n, f]) }
    on(this.host, 'click', (e) => this._click(e))
    on(this.host, 'change', (e) => this._change(e))
    const ev = (name, fn) => { const f = (e) => fn(e.detail ?? {}); window.addEventListener(name, f); this._bound.push([window, name, f]) }
    ev('omni:poly-changed', (d) => { if (d.nodeId === this.nodeId) this._sync() })
    ev('omni:poly-face-selected', (d) => { if (d.nodeId) { if (d.nodeId !== this.nodeId) this.nodeId = d.nodeId; this.face = d.index ?? 0; this.refresh() } })
    ev('omni:node-selected', (d) => { const id = d.node?.id; if (id && d.node?.nodeKind === 'polyNode' && id !== this.nodeId) this.setNode(id) })
    ev('omni:node-created', () => this._sync(true))
    ev('omni:node-deleted', (d) => { if (d.id === this.nodeId) this.setNode(null); else this._sync(true) })
    this._loadLists()
    this.refresh()
  }
  async _loadLists () { try { await this.svc?.loadSources?.(); this._clips = await this.svc?.listClips?.() ?? [] } catch (_) { /* none */ } this._loaded = true; this._sync(true) }
  destroy () { for (const [t, n, f] of this._bound) { try { t.removeEventListener(n, f) } catch (_) { /* gone */ } } this._bound = []; this.host.innerHTML = '' }
  onOpened () { this._loadLists() }
  onResize () {}
  setNode (id) { this.nodeId = id && this.svc?.isPolyNode?.(id) ? id : null; this.face = 0; this._sig = ''; this.refresh() }
  _pick () {
    const s = this.svc; if (!s) return
    if (this.nodeId && s.isPolyNode(this.nodeId)) return
    const sel = s.selectedId
    if (sel && s.isPolyNode(sel)) { this.nodeId = sel; return }
    this.nodeId = s.listPolyNodes()[0] ?? null
  }
  refresh () { this._sig = ''; this._sync(true) }
  _poly () { return this.nodeId ? this.svc?.getPoly?.(this.nodeId) ?? null : null }
  say (text, err = false) { this._msg = text; this._err = err; const m = this.host.querySelector('[data-ref=msg]'); if (m) { m.textContent = text; m.className = 'opy-msg' + (err ? ' is-err' : '') } }
  _sync (force = false) {
    const root = this.host.querySelector('[data-ref=root]'); if (!root) return
    this._pick()
    const svc = this.svc; const poly = this._poly()
    if (poly && this.face >= poly.faces.length) this.face = Math.max(0, poly.faces.length - 1)
    const sig = JSON.stringify([this.nodeId, poly, this.face, svc?.listPolyNodes?.() ?? [], svc?.listSources?.() ?? null, svc?.canUndo?.(this.nodeId), svc?.canRedo?.(this.nodeId), this._msg, this._clips.length])
    if (!force && sig === this._sig) return
    const a = document.activeElement
    if (!force && a && (a.type === 'text' || a.tagName === 'TEXTAREA') && this.host.contains(a)) { this._sig = sig; return }
    this._sig = sig
    root.innerHTML = this._html(svc, poly)
  }
  _html (svc, poly) {
    if (!svc) return '<div class="opy-notice">The poly system is not available.</div>'
    if (!this.nodeId || !poly) return '<div class="opy-notice">No poly node yet. A poly node is a solid (cube, tetrahedron, octahedron, dodecahedron, icosahedron), a plane, a folded strip or a ring whose every face holds its own colour, picture, text, document or sound. Tap a face in the space to choose what to do with it.<div class="opy-row" style="margin-top:6px"><button data-act="create">Create a poly node</button></div></div>'
    const nodes = svc.listPolyNodes(); const f = poly.faces[this.face] ?? poly.faces[0]; const c = f.content
    const info = SHAPE_INFO[poly.shape]
    const sel = `<select data-act="pick" aria-label="Poly node">${nodes.map(id => `<option value="${esc(id)}"${id === this.nodeId ? ' selected' : ''}>${esc(svc.getNodeData(id)?.label || id)}</option>`).join('')}</select>`
    const shapes = Object.keys(SHAPE_INFO).map(k => `<option value="${k}"${poly.shape === k ? ' selected' : ''}>${esc(SHAPE_INFO[k].name)}</option>`).join('')
    const multi = poly.shape === 'strip' || poly.shape === 'ring'
    const faceBtns = poly.faces.map((x, i) => `<button data-act="face" data-i="${i}" class="${i === this.face ? 'is-on' : ''}${x.hidden ? ' is-hole' : ''}" aria-label="Face ${i + 1}${x.hidden ? ' (removed)' : ''}">${i + 1}</button>`).join('')
    const types = P.CONTENT_TYPES.map(t => `<option value="${t}"${c.type === t ? ' selected' : ''}>${{ none: 'nothing', pattern: 'pattern', text: 'text', image: 'image', doc: 'document', sound: 'sound' }[t]}</option>`).join('')
    return `<div class="opy-row">${sel}<button data-act="create">+ Poly</button><button data-act="undo" ${svc.canUndo(this.nodeId) ? '' : 'disabled'}>Undo</button><button data-act="redo" ${svc.canRedo(this.nodeId) ? '' : 'disabled'}>Redo</button></div>
      <div class="opy-box"><div class="opy-row"><b>Shape</b><select data-act="shape" aria-label="Shape">${shapes}</select>
        <label>edge <input type="number" data-act="edge" min="${GEOM_LIMITS.edgeMin}" max="${GEOM_LIMITS.edgeMax}" step="0.5" value="${poly.edge}"></label>
        ${multi ? `<label>sides <input type="number" data-act="sides" min="${GEOM_LIMITS.sidesMin}" max="${GEOM_LIMITS.sidesMax}" value="${poly.sides}"></label><label>faces <input type="number" data-act="count" min="${GEOM_LIMITS.countMin}" max="${GEOM_LIMITS.countMax}" value="${poly.count}"></label><label>fold° <input type="number" data-act="fold" min="${GEOM_LIMITS.foldMin}" max="${GEOM_LIMITS.foldMax}" step="5" value="${poly.fold}"></label>` : ''}</div>
        <div class="opy-note">${esc(info.name)}: ${esc(P.describePoly(poly))} Every face shows on both sides.</div></div>
      <div class="opy-box"><div class="opy-row"><b>Faces</b><button data-act="addface">+ Face / restore</button></div><div class="opy-faces">${faceBtns}</div>
        <div class="opy-row"><label>label <input type="text" data-act="label" value="${esc(f.label)}" maxlength="40" style="width:110px"></label>
          <label>colour <input type="color" data-act="color" value="${esc(f.color || '#ffffff')}"></label><button data-act="nocolor">Node colour</button>
          <label>tags <input type="text" data-act="tags" value="${esc(f.tags.join(', '))}" style="width:130px" placeholder="a, b"></label>
          <label>event <input type="text" data-act="event" value="${esc(f.event)}" maxlength="48" style="width:110px" placeholder="name"></label></div>
        <div class="opy-row"><button data-act="hole">${f.hidden ? 'Restore this face' : 'Remove this face'}</button>
          <button data-act="tagcolor" ${f.tags.length ? '' : 'disabled'} title="Give every face that shares this face's first tag its colour">Colour all tagged ${esc(f.tags[0] ?? '')}</button></div>
        <div class="opy-row"><b>Content</b><select data-act="ctype" aria-label="Content type">${types}</select>${this._contentControls(svc, f)}</div>
        ${c.type === 'doc' ? `<div class="opy-row"><button data-act="pprev" ${c.page <= 1 ? 'disabled' : ''}>◀</button><span>page ${c.page}</span><button data-act="pnext">▶</button></div>` : ''}
        <div class="opy-note">Tap a face in the space and choose from the menu, or pick it here.</div></div>
      <div class="opy-msg ${this._err ? 'is-err' : ''}" role="status" aria-live="polite" data-ref="msg">${esc(this._msg)}</div>`
  }
  _contentControls (svc, f) {
    const c = f.content; const src = svc.listSources()
    if (c.type === 'pattern') return `<select data-act="pkind">${P.PATTERNS.map(k => `<option${c.pattern.kind === k ? ' selected' : ''}>${k}</option>`).join('')}</select><input type="color" data-act="pa" value="${esc(c.pattern.a)}"><input type="color" data-act="pb" value="${esc(c.pattern.b)}">`
    if (c.type === 'text') return `<textarea data-act="ptext" maxlength="${P.POLY_LIMITS.textMax}" placeholder="Text on this face">${esc(c.text)}</textarea>`
    const cur = c.source.type + ':' + c.source.id
    if (c.type === 'image') { const o = src.library.filter(l => l.type === 'image').map(l => `<option value="image:${esc(l.id)}"${cur === 'image:' + l.id ? ' selected' : ''}>${esc(l.name)}</option>`).join(''); return `<select data-act="psrc"><option value="none:">— choose —</option>${o}</select><button data-act="import">Import…</button><input type="file" data-ref="file" accept="${ACCEPT}" hidden>` }
    if (c.type === 'doc') { const g = src.guide.map(x => `<option value="guide:${esc(x.id)}"${cur === 'guide:' + x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join(''); const l = src.library.filter(x => x.type !== 'image').map(x => `<option value="${esc(x.type)}:${esc(x.id)}"${cur === x.type + ':' + x.id ? ' selected' : ''}>${esc(x.name)} (${esc(x.type)})</option>`).join(''); return `<select data-act="psrc"><option value="none:">— choose —</option><optgroup label="Guide pages">${g}</optgroup><optgroup label="Your documents">${l}</optgroup></select><button data-act="import">Import…</button><input type="file" data-ref="file" accept="${ACCEPT}" hidden>` }
    if (c.type === 'sound') { const sn = svc.listSoundNodes().map(n => `<option value="soundNode:${esc(n.id)}"${cur === 'soundNode:' + n.id ? ' selected' : ''}>${esc(n.label)}</option>`).join(''); const cl = this._clips.map(n => `<option value="audio:${esc(n.id)}"${cur === 'audio:' + n.id ? ' selected' : ''}>${esc(n.name)}</option>`).join(''); return `<select data-act="psrc"><option value="none:">— choose —</option><optgroup label="Sound nodes">${sn}</optgroup><optgroup label="Audio library">${cl}</optgroup></select><button data-act="playtest">▶ Play</button>` }
    return ''
  }
  _res (r) { if (r && r.ok === false) this.say(r.error || 'That did not work.', true); else this.say(''); return r }
  _content (patch) { const s = this.svc; const poly = this._poly(); const cur = poly?.faces[this.face]?.content; if (!cur) return; return this._res(s.setContent(this.nodeId, this.face, { ...cur, ...patch })) }
  _click (e) {
    const b = e.target.closest?.('[data-act]'); if (!b || b.disabled) return
    const s = this.svc; const id = this.nodeId; const a = b.dataset.act
    switch (a) {
      case 'create': { const r = s?.createPolyNode({ select: true }); if (r?.ok) { this.nodeId = r.nodeId; this.face = 0; this.refresh() } else this.say(r?.error || 'Could not create.', true); break }
      case 'undo': s?.undo(id); break
      case 'redo': s?.redo(id); break
      case 'face': this.face = Number(b.dataset.i) || 0; this.refresh(); break
      case 'addface': this._res(s.addFace(id)); break
      case 'hole': { const f = this._poly()?.faces[this.face]; this._res(f?.hidden ? s.setFace(id, this.face, { hidden: false }) : s.removeFace(id, this.face)); break }
      case 'nocolor': this._res(s.setFace(id, this.face, { color: '' })); break
      case 'tagcolor': { const f = this._poly()?.faces[this.face]; if (f?.tags[0]) this._res(s.applyToTag(id, f.tags[0], { color: f.color })); break }
      case 'pprev': this._res(s.turn(id, this.face, -1)); break
      case 'pnext': this._res(s.turn(id, this.face, 1)); break
      case 'playtest': this._res(s.playFace(id, this.face)); break
      case 'import': this.host.querySelector('[data-ref=file]')?.click(); break
      default: break
    }
  }
  async _import (file) { this.say('Importing…'); const r = await this.svc.attachFile(this.nodeId, this.face, file); this.say(r.ok ? `Added “${r.meta.name}”.` : (r.error?.message ?? 'Could not import that file.'), !r.ok); this.refresh() }
  _change (e) {
    const el = e.target; const a = el.dataset?.act; const s = this.svc; const id = this.nodeId
    if (el.dataset?.ref === 'file') { const f = el.files?.[0]; if (f) this._import(f); el.value = ''; return }
    if (!a || !s) return
    switch (a) {
      case 'pick': this.setNode(el.value); break
      case 'shape': this._res(s.setShape(id, { shape: el.value })); break
      case 'edge': case 'sides': case 'count': case 'fold': this._res(s.setShape(id, { [a]: Number(el.value) })); break
      case 'label': this._res(s.setFace(id, this.face, { label: el.value }, 'label')); break
      case 'color': this._res(s.setFace(id, this.face, { color: el.value }, 'fcolor')); break
      case 'tags': this._res(s.setTags(id, this.face, el.value)); break
      case 'event': this._res(s.setFace(id, this.face, { event: el.value })); break
      case 'ctype': this._res(s.setContent(id, this.face, { ...P.defaultContent(), type: el.value })); break
      case 'pkind': this._content({ pattern: { ...this._poly().faces[this.face].content.pattern, kind: el.value } }); break
      case 'pa': this._content({ pattern: { ...this._poly().faces[this.face].content.pattern, a: el.value } }); break
      case 'pb': this._content({ pattern: { ...this._poly().faces[this.face].content.pattern, b: el.value } }); break
      case 'ptext': this._content({ text: el.value }); break
      case 'psrc': { const i = el.value.indexOf(':'); const type = el.value.slice(0, i); const sid = el.value.slice(i + 1); this._content({ source: type === 'none' ? { type: 'none', id: '' } : { type, id: sid }, page: 1 }); break }
      default: break
    }
  }
}
