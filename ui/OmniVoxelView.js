/**
 * ui/OmniVoxelView.js — ⟐OmniVoxel: the controls of the voxel rooms (V210). DOM only (DOM first, 3D second).
 * Rooms (add here / at the selected node / at x,y,z / next to the selected room in any of six directions), the selected room (name, links, subdivision 1..256 with sub-rooms
 * split again), points (on the lattice, at the camera), lines (walk / ride / fast ride), a node's own shape as traversable points, routes, and the layers shown.
 * Everything goes through systems/OmniVoxelSpace.js (Extra.SERVICES.voxel).
 */
import * as VG from '../utils/OmniVoxelGrid.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const NAV_ITEM = '⟐OmniVoxel'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const ROOM_LIST_MAX = 200

export function injectVoxelStyles () {
  if (typeof document === 'undefined' || document.getElementById('ovx-styles')) return
  const s = document.createElement('style'); s.id = 'ovx-styles'
  s.textContent = `
.ovx { display: flex; flex-direction: column; gap: 8px; font-size: 11px; }
.ovx button, .ovx select, .ovx input { font: inherit; color: inherit; }
.ovx button { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 3px 8px; cursor: pointer; min-height: 26px; }
.ovx button:hover:not(:disabled) { background: rgba(255,255,255,.15); } .ovx button:disabled { opacity: .4; cursor: default; }
.ovx button.is-on { background: rgba(255,211,107,.3); border-color: rgba(255,211,107,.85); }
.ovx select, .ovx input[type=text], .ovx input[type=number] { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; padding: 2px 5px; min-height: 26px; box-sizing: border-box; }
.ovx select option { color: #111; background: #fff; } .ovx input[type=number] { width: 62px; } .ovx input[type=text] { width: 130px; }
.ovx-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ovx-box { border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; }
.ovx-box > b { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
.ovx-list { display: flex; flex-wrap: wrap; gap: 4px; max-height: 130px; overflow: auto; }
.ovx-note { font-size: 9.5px; opacity: .75; line-height: 1.4; } .ovx-msg { min-height: 14px; } .ovx-msg.is-err { color: #ff9c9c; }
.ovx-dirs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.ovx-item { display: flex; gap: 6px; align-items: center; justify-content: space-between; padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,.08); }
@media (max-width: 700px) { .ovx button, .ovx select, .ovx input { min-height: 40px; } .ovx-dirs { grid-template-columns: repeat(2, 1fr); } }
`
  document.head.appendChild(s)
}

export default class OmniVoxelView {
  constructor (host, opts = {}) { this.host = host; this.opts = opts; this._bound = []; this._msg = ''; this._err = false; this._from = ''; this._to = ''; this._lineA = ''; this._lineB = ''; this._lineMode = 'walk'; this._routeText = ''; this._avPoint = '' }
  get svc () { return this.opts.svc ?? SERVICES.voxel }

  mount () {
    injectVoxelStyles()
    this.host.innerHTML = '<div class="ovx" data-ref="root"></div>'
    const on = (t, n, f) => { t.addEventListener(n, f); this._bound.push([t, n, f]) }
    on(this.host, 'click', (e) => this._click(e))
    on(this.host, 'change', (e) => this._change(e))
    const ev = (name, fn) => { const f = (e) => fn(e.detail ?? {}); window.addEventListener(name, f); this._bound.push([window, name, f]) }
    ev('omni:voxel-changed', () => this.refresh())
    ev('omni:avatar-changed', () => this._avatarRefresh()); ev('omni:avatar-follow-changed', () => this._avatarRefresh())
    this.refresh()
  }
  destroy () { for (const [t, n, f] of this._bound) { try { t.removeEventListener(n, f) } catch (_) { /* gone */ } } this._bound = []; this.host.innerHTML = '' }
  onOpened () { this.refresh() }
  onResize () {}
  say (text, err = false) { this._msg = text; this._err = err; const m = this.host.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'ovx-msg' + (err ? ' is-err' : '') } }
  _do (r, okText) { if (r && r.ok === false) this.say(r.error || 'That did not work.', true); else if (okText) this.say(okText) ; return r }

  refresh () {
    const root = this.host.querySelector('[data-ref="root"]'); if (!root) return
    const s = this.svc
    if (!s) { root.innerHTML = '<div class="ovx-box">The voxel system is not running.</div>'; return }
    const act = document.activeElement; const keep = act && this.host.contains(act) ? act.getAttribute('data-keep') : null
    root.innerHTML = this._html(s)
    if (keep) { const el = root.querySelector(`[data-keep="${keep}"]`); if (el) { el.focus(); try { el.setSelectionRange?.(el.value.length, el.value.length) } catch (_) { /* not text */ } } }
  }

  _pointLabel (p) {
    if (p.kind === 'centre') return `centre ${p.cell}${p.label ? ' · ' + p.label : ''}`
    if (p.kind === 'door') return `door ${p.id.slice(2)}`
    if (p.kind === 'user') return `${p.label || 'point'} (${p.cell})`
    return `shape ${p.id.slice(2)}`
  }
  _html (s) {
    const g = s.grid, sm = s.summary()
    const sel = s.selected && g.getCell(s.selected)
    const pts = g.listPoints()
    const opts = (cur) => `<option value="">—</option>` + pts.map(p => `<option value="${esc(p.id)}"${p.id === cur ? ' selected' : ''}>${esc(this._pointLabel(p))}</option>`).join('')
    const cells = g.listCells().slice(0, ROOM_LIST_MAX)
    const dirsHtml = sel ? VG.DIRS.map(d => {
      const n = g.neighbors(sel.key).find(x => x.dir === d.id)
      if (!n) return `<button data-act="nb" data-dir="${d.id}" aria-label="Add a room ${d.label}">+ ${d.label}</button>`
      return n.linked ? `<button data-act="cut" data-dir="${d.id}" aria-label="Cut the link ${d.label}" title="Linked. Press to cut the link.">${d.label} ✓ cut</button>` : `<button data-act="restore" data-dir="${d.id}" aria-label="Restore the link ${d.label}" title="Cut. Press to link again.">${d.label} ✗ link</button>`
    }).join('') : ''
    const level = sel ? g.levelOf(sel.key, s.path) : 1
    const step = sel ? g.stepOf(sel.key, s.path) : 256
    const crumb = sel ? ['Room ' + sel.key, ...s.path.map(p => `(${p.join(',')})`)].join(' › ') : ''
    const userPts = [...g.points.values()]
    const userLines = [...g.lines.values()]
    const idx = new Map(pts.map(p => [p.id, p]))
    const lbl = (id) => esc(idx.get(id) ? this._pointLabel(idx.get(id)) : id)
    return `
      <div class="ovx-note"><b>${sm.rooms}</b> rooms · <b>${sm.points}</b> points · <b>${sm.lines}</b> lines · ${sm.shapes} shapes. One room = ${VG.ROOM_SIZE} units a side; every position is a whole number 0–${VG.SUB} inside it.</div>
      <div class="ovx-msg${this._err ? ' is-err' : ''}" data-ref="msg" role="status" aria-live="polite">${esc(this._msg)}</div>

      <div class="ovx-box"><b>Rooms</b>
        <div class="ovx-row"><button data-act="here">+ Room here</button><button data-act="atnode"${s.nodeId ? '' : ' disabled'}>+ Room at selected node</button></div>
        <div class="ovx-row">x<input type="number" step="1" min="-512" max="512" value="0" data-ref="rx" aria-label="Room x"> y<input type="number" step="1" min="-512" max="512" value="0" data-ref="ry" aria-label="Room y"> z<input type="number" step="1" min="-512" max="512" value="0" data-ref="rz" aria-label="Room z"><button data-act="atxyz">+ Room</button></div>
        <div class="ovx-list" role="list">${cells.map(c => `<button role="listitem" data-act="pick" data-key="${esc(c.key)}"${c.key === s.selected ? ' class="is-on"' : ''}>${esc(c.label || c.key)}</button>`).join('') || '<span class="ovx-note">No rooms yet. Add one.</span>'}</div>
      </div>

      ${sel ? `<div class="ovx-box"><b>Selected room ${esc(sel.key)}</b>
        <div class="ovx-row"><input type="text" maxlength="${VG.LIMITS.label}" value="${esc(sel.label)}" data-act="rename" data-keep="rename" placeholder="Name" aria-label="Room name"><button data-act="remove">Remove room</button></div>
        <div class="ovx-note">Next rooms and links (no diagonals). ✓ = linked, press to cut.</div>
        <div class="ovx-dirs">${dirsHtml}</div>
        <div class="ovx-note">Subdivision of <b>${esc(crumb)}</b>: ${level === 1 ? 'whole' : level + ' per side'} · lattice step ${step} unit${step === 1 ? '' : 's'} (${(step / VG.SUB * VG.ROOM_SIZE).toFixed(3)} world units)</div>
        <div class="ovx-row"><select data-act="level" aria-label="Divisions per side">${VG.LEVELS.map(n => `<option value="${n}"${n === level ? ' selected' : ''}>${n === 1 ? 'Whole (1)' : n === 2 ? 'Half (2)' : n}</option>`).join('')}</select>
          <button data-act="subout"${s.path.length ? '' : ' disabled'}>‹ Back out</button>
          <span>into sub-room</span><input type="number" min="0" step="1" value="0" data-ref="si" aria-label="Sub-room i"><input type="number" min="0" step="1" value="0" data-ref="sj" aria-label="Sub-room j"><input type="number" min="0" step="1" value="0" data-ref="sk" aria-label="Sub-room k"><button data-act="subin"${level > 1 ? '' : ' disabled'}>Enter</button></div>
        <div class="ovx-note">Split a sub-room again by going into it and choosing a level. You can go down to one unit (1/256 of a room). Points snap to the lattice of the room or sub-room you are in.</div>
      </div>` : ''}

      <div class="ovx-box"><b>Points (stops)</b>
        <div class="ovx-note">Centres and doors exist by themselves. Add your own on the lattice of the selected room.</div>
        <div class="ovx-row">u<input type="number" min="0" max="${VG.SUB}" step="1" value="128" data-ref="pu" aria-label="Point u"> v<input type="number" min="0" max="${VG.SUB}" step="1" value="0" data-ref="pv" aria-label="Point v"> w<input type="number" min="0" max="${VG.SUB}" step="1" value="128" data-ref="pw" aria-label="Point w"><input type="text" maxlength="${VG.LIMITS.label}" placeholder="Name" data-ref="pl" aria-label="Point name"><button data-act="addpt"${sel ? '' : ' disabled'}>Add point</button><button data-act="ptcam">At camera</button></div>
        ${userPts.length ? userPts.map(p => `<div class="ovx-item"><span>${esc(p.label || 'point')} · ${esc(p.cell)} · ${p.u.join(', ')}</span><button data-act="rmpt" data-id="${esc(p.id)}" aria-label="Remove point">×</button></div>`).join('') : '<span class="ovx-note">No points of your own yet.</span>'}
      </div>

      <div class="ovx-box"><b>Lines</b>
        <div class="ovx-row"><select data-ref="la" aria-label="Line from">${opts(this._lineA)}</select>→<select data-ref="lb" aria-label="Line to">${opts(this._lineB)}</select>
          <select data-ref="lm" aria-label="Line mode">${Object.entries(VG.MODES).map(([k, m]) => `<option value="${k}"${k === this._lineMode ? ' selected' : ''}>${m.label} ×${m.speed}</option>`).join('')}</select><button data-act="addline">Add line</button></div>
        ${userLines.length ? userLines.map(l => `<div class="ovx-item"><span>${lbl(l.a)} → ${lbl(l.b)} · ${esc(VG.MODES[l.mode].label)}</span><button data-act="rmline" data-id="${esc(l.id)}" aria-label="Remove line">×</button></div>`).join('') : '<span class="ovx-note">No lines of your own yet. Rooms already link to each other.</span>'}
      </div>

      <div class="ovx-box"><b>Shapes</b>
        <div class="ovx-note">Every point of a node's own shape (a sphere has them too) becomes a stop you can travel to. Select a node, then:</div>
        <div class="ovx-row"><button data-act="shape"${s.nodeId ? '' : ' disabled'}>Use selected node's shape</button></div>
        ${[...g.geo.entries()].map(([id, v]) => `<div class="ovx-item"><span>${esc(id)} · ${v.points.length} points</span><button data-act="dropshape" data-id="${esc(id)}" aria-label="Stop using this shape">×</button></div>`).join('')}
      </div>

      <div class="ovx-box"><b>Avatar</b>
        ${this._avatarHTML(opts)}
      </div>

      <div class="ovx-box"><b>Route</b>
        <div class="ovx-row"><select data-ref="rf" aria-label="Route from">${opts(this._from)}</select>→<select data-ref="rt" aria-label="Route to">${opts(this._to)}</select><button data-act="route">Find route</button><button data-act="clearroute"${s.routeIds.length ? '' : ' disabled'}>Clear</button></div>
        <div class="ovx-note" data-ref="routeout" role="status">${esc(this._routeText)}</div>
      </div>

      <div class="ovx-box"><b>Layers</b>
        <div class="ovx-row">${['rooms', 'points', 'lines', 'lattice'].map(k => `<label><input type="checkbox" data-act="layer" data-layer="${k}"${s.layers[k] ? ' checked' : ''}> ${k}</label>`).join(' ')}</div>
      </div>`
  }

  get avatar () { return this.opts.avatar ?? SERVICES.avatar }
  _avatarText (a) {
    const st = a?.status?.(); if (!st) return 'The avatar is not running.'
    if (!st.placed) return 'Not placed yet. Choose a point and press Place.'
    const dest = st.destination ? ` → ${st.destination}` : ''
    return `${st.moving ? 'Travelling' : 'Standing'} at ${st.pointId}${dest}. Camera: ${st.follow ? 'following the avatar' : 'free (you moved it)'}.`
  }
  _avatarHTML (opts) {
    const a = this.avatar; const st = a?.status?.()
    return `<div class="ovx-note" data-ref="avtext" role="status">${esc(this._avatarText(a))}</div>
        <div class="ovx-row"><select data-ref="ap" aria-label="Avatar point">${opts(this._avPoint)}</select><button data-act="avplace">Place</button><button data-act="avgo">Go</button><button data-act="avstop"${st?.moving ? '' : ' disabled'}>Stop</button>
          <button data-act="avfollow"${st?.follow ? ' class="is-on"' : ''}${st?.placed ? '' : ' disabled'} aria-pressed="${st?.follow ? 'true' : 'false'}">Follow avatar</button></div>
        <div class="ovx-note">The avatar travels along the lines and only stops at points. The camera follows it until you move the camera yourself; press Follow avatar to bring it back.</div>`
  }
  _avatarRefresh () { const t = this.host.querySelector('[data-ref="avtext"]'); if (t) t.textContent = this._avatarText(this.avatar); const f = this.host.querySelector('[data-act="avfollow"]'); const st = this.avatar?.status?.(); if (f && st) { f.classList.toggle('is-on', !!st.follow); f.setAttribute('aria-pressed', String(!!st.follow)); f.disabled = !st.placed } const sp = this.host.querySelector('[data-act="avstop"]'); if (sp && st) sp.disabled = !st.moving }
  _num (ref) { const el = this.host.querySelector(`[data-ref="${ref}"]`); return el ? Number(el.value) : NaN }
  _val (ref) { const el = this.host.querySelector(`[data-ref="${ref}"]`); return el ? el.value : '' }

  _click (e) {
    const b = e.target.closest('[data-act]'); if (!b) return
    const s = this.svc; if (!s) return
    const act = b.dataset.act
    switch (act) {
      case 'here': this._do(s.addRoomHere(), 'Room added.'); break
      case 'atnode': this._do(s.addRoomAtNode(), 'Room added at the node.'); break
      case 'atxyz': this._do(s.addRoom(this._num('rx'), this._num('ry'), this._num('rz')), 'Room added.'); break
      case 'pick': this._do(s.selectRoom(b.dataset.key)); break
      case 'nb': this._do(s.addNeighbor(b.dataset.dir), 'Room added next to it.'); break
      case 'cut': this._do(s.cutLink(b.dataset.dir), 'Link cut.'); break
      case 'restore': this._do(s.restoreLink(b.dataset.dir), 'Linked again.'); break
      case 'remove': this._do(s.removeRoom(), 'Room removed.'); break
      case 'subin': this._do(s.enterSub([this._num('si'), this._num('sj'), this._num('sk')])); break
      case 'subout': this._do(s.enterSub(null)); break
      case 'addpt': this._do(s.addPoint([this._num('pu'), this._num('pv'), this._num('pw')], this._val('pl')), 'Point added (snapped to the lattice).'); break
      case 'ptcam': this._do(s.addPointAtCamera(this._val('pl')), 'Point added where you are looking.'); break
      case 'rmpt': this._do(s.removePoint(b.dataset.id), 'Point removed.'); break
      case 'addline': { this._lineA = this._val('la'); this._lineB = this._val('lb'); this._lineMode = this._val('lm') || 'walk'; this._do(s.addLine(this._lineA, this._lineB, this._lineMode), 'Line added.'); break }
      case 'rmline': this._do(s.removeLine(b.dataset.id), 'Line removed.'); break
      case 'shape': this._do(s.useNodeShape(), 'The shape\'s points are now stops.'); break
      case 'dropshape': this._do(s.dropNodeShape(b.dataset.id), 'Shape removed.'); break
      case 'avplace': case 'avgo': {
        const a = this.avatar; if (!a) { this.say('The avatar is not running.', true); break }
        this._avPoint = this._val('ap') || this._avPoint || ''
        if (!this._avPoint) { this.say('Choose a point first.', true); break }
        const r = act === 'avplace' ? a.placeAt(this._avPoint) : a.goTo(this._avPoint)
        this._do(r, act === 'avplace' ? 'Avatar placed.' : (r.same ? 'Already there.' : 'On the way.')); this._avatarRefresh(); break
      }
      case 'avstop': this.avatar?.stop(); this.say('It will stop at the next point.'); break
      case 'avfollow': { const a = this.avatar; if (!a) break; if (a.follow) a.releaseFollow('button'); else a.followMe(); this._avatarRefresh(); break }
      case 'route': {
        this._from = this._val('rf'); this._to = this._val('rt')
        const r = s.findRoute(this._from, this._to)
        this._routeText = r.ok ? `${r.ids.length} stops · ${r.length.toFixed(1)} units · ${r.time.toFixed(1)} time units` : r.error
        this._err = !r.ok; this._msg = r.ok ? 'Route found. It is highlighted in the space.' : r.error; this.refresh(); break
      }
      case 'clearroute': this._routeText = ''; s.clearRoute(); break
      default: break
    }
  }
  _change (e) {
    const t = e.target, act = t?.dataset?.act; const s = this.svc; if (!s || !act) return
    if (act === 'level') this._do(s.setLevel(Number(t.value)), 'Subdivision set.')
    else if (act === 'rename') this._do(s.renameRoom(t.value))
    else if (act === 'layer') s.setLayer(t.dataset.layer, t.checked)
  }
}
