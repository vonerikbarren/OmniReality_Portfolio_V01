/**
 * ui/OmniMultiVideoEditor.js (V286) — the editor of a MultiVideoNode: its own floating panel, opened from the Inspector (or Omni MultiVideo edit).
 *   Transport + timeline strip (clips as bars, key coordinates as flags, captions as ticks; click to scrub), then four tabs: Clips, Keys, Text, Node.
 *   It edits through SERVICES.multivideo.change(id, mv => ...) with the pure helpers of utils/OmniMultiVideoModel.js, so every change is sanitized, saved and shown on the node at once. Non-destructive: nothing is rendered to a file.
 *   SERVICES.multivideoui: open(id) close() isOpen() current()
 */
import * as M from '../utils/OmniMultiVideoModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const f1 = (n) => String(Math.round(n * 100) / 100)
const STYLES = `
.omve { position: fixed; z-index: 62; right: 14px; top: 64px; width: min(560px, calc(100vw - 20px)); max-height: calc(100vh - 140px); display: none; flex-direction: column; background: rgba(255,255,255,.97); color: #111; border: 1px solid rgba(0,0,0,.25); border-radius: 10px; box-shadow: 0 6px 30px rgba(0,0,0,.3); font: 12px system-ui, sans-serif; }
.omve.is-open { display: flex; }
.omve-head { display: flex; gap: 6px; align-items: center; padding: 6px 10px; border-bottom: 1px solid rgba(0,0,0,.15); cursor: move; }
.omve-head b { flex: 1; font-size: 12px; letter-spacing: .06em; }
.omve button, .omve select, .omve input { font: inherit; font-size: 11px; }
.omve button { background: #f2f2f2; border: 1px solid rgba(0,0,0,.25); border-radius: 6px; padding: 2px 8px; cursor: pointer; } .omve button.on { background: #111; color: #fff; }
.omve-bar { display: flex; gap: 6px; align-items: center; padding: 6px 10px; } .omve-bar input[type=range] { flex: 1; }
.omve-strip { position: relative; height: 54px; margin: 0 10px; background: #eee; border-radius: 6px; cursor: pointer; overflow: hidden; }
.omve-clip { position: absolute; top: 14px; height: 22px; background: #8fb7ff; border: 1px solid #3b6fd6; border-radius: 4px; font-size: 9px; overflow: hidden; white-space: nowrap; padding: 2px 3px; box-sizing: border-box; }
.omve-clip.is-sel { background: #ffd27a; border-color: #b57b00; } .omve-key { position: absolute; top: 0; width: 2px; height: 12px; background: #d6336c; } .omve-cap { position: absolute; bottom: 0; width: 6px; height: 8px; background: #2b8a3e; } .omve-head-line { position: absolute; top: 0; bottom: 0; width: 2px; background: #000; }
.omve-tabs { display: flex; gap: 4px; padding: 6px 10px 0; } .omve-body { overflow: auto; padding: 6px 10px 10px; }
.omve-card { border: 1px solid rgba(0,0,0,.18); border-radius: 8px; padding: 6px 8px; margin: 6px 0; } .omve-card.is-sel { border-color: #b57b00; }
.omve-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 3px 0; } .omve-row label { display: flex; gap: 4px; align-items: center; } .omve-row input[type=number] { width: 62px; } .omve-row input[type=text] { width: 200px; }
.omve-msg { font-size: 11px; opacity: .8; padding: 0 10px 6px; min-height: 14px; }
`
const num = (k, v, step = 0.1, w = '') => `<input type="number" data-k="${k}" value="${f1(v)}" step="${step}" ${w}>`
const sel = (k, opts, v) => `<select data-k="${k}">${opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`

export default class OmniMultiVideoEditor {
  constructor (context) { this.ctx = context; this._id = null; this._el = null; this._tab = 'clips'; this._sel = null; this._bound = []; this._lastRender = 0 }
  init () {
    if (this._inited) return; this._inited = true; SERVICES.multivideoui = this
    const on = (n, f) => { const h = (e) => f(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:multivideo-changed', (d) => { if (d.nodeId === this._id) this._render() }); on('omni:multivideo-state', (d) => { if (d.nodeId === this._id) this._tick(d) })
    on('omni:node-deleted', (d) => { if (d.id === this._id) this.close() }); on('omni:multivideo-open', (d) => d.nodeId && this.open(d.nodeId))
  }
  update () {} onResize () {}
  destroy () { for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; this._el?.remove(); this._el = null; if (SERVICES.multivideoui === this) SERVICES.multivideoui = null }
  isOpen () { return !!this._el?.classList.contains('is-open') }
  current () { return this._id }
  open (id) {
    if (!SERVICES.multivideo?.get(id)) return { ok: false, error: 'That is not a MultiVideo node.' }
    this._id = id; this._build(); this._el.classList.add('is-open'); this._render(); return { ok: true }
  }
  close () { this._el?.classList.remove('is-open'); this._id = null }
  _mv () { return SERVICES.multivideo?.get(this._id) }
  _ed (fn, reason) { return SERVICES.multivideo?.change(this._id, fn, reason) }
  _msg (t) { const m = this._el?.querySelector('.omve-msg'); if (m) m.textContent = t || '' }

  _build () {
    if (this._el) return
    if (!document.getElementById('omve-styles')) { const s = document.createElement('style'); s.id = 'omve-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const el = document.createElement('div'); el.className = 'omve'; el.id = 'omni-multivideo-editor'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'MultiVideo editor')
    el.innerHTML = '<div class="omve-head"><b>▤ MULTIVIDEO EDITOR</b><button data-a="close" title="Close">\u2715</button></div><div class="omve-bar"></div><div class="omve-strip"></div><div class="omve-tabs"></div><div class="omve-msg"></div><div class="omve-body"></div>'
    document.body.appendChild(el); this._el = el
    el.addEventListener('click', (e) => this._click(e)); el.addEventListener('change', (e) => this._change(e))
    const strip = el.querySelector('.omve-strip'); strip.addEventListener('click', (e) => { const r = strip.getBoundingClientRect(); const dur = SERVICES.multivideo.duration(this._id) || 1; SERVICES.multivideo.seek(this._id, ((e.clientX - r.left) / r.width) * dur) })
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); e.stopPropagation() })
    let drag = null; const head = el.querySelector('.omve-head')
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; const r = el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; head.setPointerCapture?.(e.pointerId) })
    head.addEventListener('pointermove', (e) => { if (!drag) return; el.style.left = Math.max(0, e.clientX - drag.dx) + 'px'; el.style.top = Math.max(0, e.clientY - drag.dy) + 'px'; el.style.right = 'auto' }); head.addEventListener('pointerup', () => { drag = null })
  }

  _tick (d) {
    const el = this._el; if (!el?.classList.contains('is-open')) return; const dur = SERVICES.multivideo.duration(this._id)
    const rng = el.querySelector('[data-k="scrub"]'); if (rng && document.activeElement !== rng) rng.value = String(d.t); const t = el.querySelector('.omve-time'); if (t) t.textContent = `${d.t.toFixed(1)} / ${dur.toFixed(1)} s`
    const ph = el.querySelector('.omve-head-line'); if (ph) ph.style.left = (dur ? (d.t / dur) * 100 : 0) + '%'; const pb = el.querySelector('[data-a="playpause"]'); if (pb) pb.textContent = d.playing ? 'Pause' : 'Play'
  }
  _render () {
    const el = this._el, mv = this._mv(); if (!el || !mv) return
    const S = SERVICES.multivideo, st = S.state(this._id), dur = Math.max(S.duration(this._id), 0.1), lay = M.layout(mv.clips)
    el.querySelector('.omve-bar').innerHTML = `<button data-a="playpause">${st.playing ? 'Pause' : 'Play'}</button><button data-a="stop">Stop</button><input type="range" data-k="scrub" min="0" max="${dur}" step="0.01" value="${st.t}"><span class="omve-time">${st.t.toFixed(1)} / ${dur.toFixed(1)} s</span>`
    el.querySelector('.omve-strip').innerHTML = lay.map((l, i) => `<div class="omve-clip${mv.clips[i].id === this._sel ? ' is-sel' : ''}" style="left:${(l.start / dur) * 100}%;width:${Math.max(1, ((l.end - l.start) / dur) * 100)}%" title="${esc(mv.clips[i].name || 'clip')}">${esc(mv.clips[i].name || 'clip ' + (i + 1))}</div>`).join('') +
      mv.keys.map(k => `<div class="omve-key" style="left:${(k.t / dur) * 100}%" title="key ${f1(k.t)} s"></div>`).join('') + mv.text.items.map(i => `<div class="omve-cap" style="left:${(i.t0 / dur) * 100}%" title="${esc(i.text)}"></div>`).join('') + `<div class="omve-head-line" style="left:${(st.t / dur) * 100}%"></div>`
    el.querySelector('.omve-tabs').innerHTML = ['clips', 'keys', 'text', 'node'].map(t => `<button data-tab="${t}" class="${t === this._tab ? 'on' : ''}">${({ clips: 'Clips', keys: 'Key coordinates', text: 'Text', node: 'Node' })[t]}</button>`).join('')
    const body = el.querySelector('.omve-body'); const scroll = body.scrollTop; body.innerHTML = this[`_${this._tab}`](mv, st); body.scrollTop = scroll; if (this._tab === 'clips') this._fillLib()
  }

  // ── tabs ──
  _clips (mv) {
    const cards = mv.clips.map((c, i) => `<div class="omve-card${c.id === this._sel ? ' is-sel' : ''}" data-id="${c.id}">
      <div class="omve-row"><b>${i + 1}.</b><input type="text" data-k="name" value="${esc(c.name)}" placeholder="clip name"><button data-a="up">↑</button><button data-a="down">↓</button><button data-a="del">Remove</button><button data-a="sel">Select</button></div>
      <div class="omve-row"><label>in ${num('in', c.in, 0.1)}</label><label>out ${num('out', c.out, 0.1)}</label><label title="the length of the source video">length ${num('dur', c.dur, 0.1)}</label><label>speed ${num('speed', c.speed, 0.05)}</label><label>volume ${num('volume', c.volume, 0.05)}</label><label>opacity ${num('opacity', c.opacity, 0.05)}</label></div>
      <div class="omve-row"><label>fade in ${num('fadeIn', c.fadeIn, 0.1)}</label><label>fade out ${num('fadeOut', c.fadeOut, 0.1)}</label>${i > 0 ? `<label>transition ${sel('tkind', M.KINDS, c.transition.kind)}</label><label>over ${num('tdur', c.transition.dur, 0.1)} s</label>` : '<span style="opacity:.6">first clip</span>'}</div>
      <div class="omve-row"><label><input type="checkbox" data-k="kenabled"${c.key.enabled ? ' checked' : ''}> key out</label><input type="color" data-k="kcolor" value="${esc(c.key.color)}"><label>similarity ${num('ksim', c.key.similarity, 0.01)}</label><label>smooth ${num('ksmooth', c.key.smoothness, 0.01)}</label><label>spill ${num('kspill', c.key.spill, 0.01)}</label></div>
      <div class="omve-row" style="opacity:.75">${c.source ? 'video: ' + esc(c.source.id) : 'no video yet (a placeholder you can time and key against)'}</div></div>`).join('')
    return `<div class="omve-row"><select data-k="lib"><option value="">Add from the library...</option></select><label>or a file <input type="file" accept="video/*" data-k="file"></label><button data-a="addblank">Add placeholder clip</button><button data-a="split" title="Cut the clip under the playhead in two">Split at playhead</button></div>${cards || '<div style="opacity:.7;padding:6px">No clips yet.</div>'}`
  }
  _keys (mv) {
    const rows = mv.keys.map((k, i) => `<div class="omve-card" data-id="${k.id}"><div class="omve-row"><b>${i + 1}.</b><label>at ${num('t', k.t, 0.1)} s</label><label>moves ${sel('target', M.TARGETS, k.target)}</label><label>ease ${sel('ease', M.EASES, k.ease)}</label><button data-a="del">Remove</button></div>
      <div class="omve-row"><label>x ${num('px', k.pos[0], 0.5)}</label><label>y ${num('py', k.pos[1], 0.5)}</label><label>z ${num('pz', k.pos[2], 0.5)}</label><button data-a="here" title="Fill in the camera's current position">Use camera position</button></div>
      <div class="omve-row"><label><input type="checkbox" data-k="haslook"${k.look ? ' checked' : ''}> camera looks at</label>${k.look ? `<label>x ${num('lx', k.look[0], 0.5)}</label><label>y ${num('ly', k.look[1], 0.5)}</label><label>z ${num('lz', k.look[2], 0.5)}</label>` : '<span style="opacity:.6">(the node)</span>'}</div></div>`).join('')
    return `<div class="omve-row"><button data-a="addkey">Add key at playhead</button><span style="opacity:.7">Each key says where the node and / or the camera goes. The ease is the GSAP ease of the move into that key.</span></div>${rows || '<div style="opacity:.7;padding:6px">No keys yet.</div>'}`
  }
  _text (mv) {
    const items = mv.text.items.map((c, i) => `<div class="omve-card" data-id="${c.id}"><div class="omve-row"><b>${i + 1}.</b><input type="text" data-k="text" value="${esc(c.text)}"><button data-a="del">Remove</button></div>
      <div class="omve-row"><label>from ${num('t0', c.t0, 0.1)}</label><label>to ${num('t1', c.t1, 0.1)} <small>(0 = end)</small></label><label>size ${num('size', c.size, 0.05)}</label><label>align ${sel('align', ['left', 'center', 'right'], c.align)}</label></div>
      <div class="omve-row"><label>colour <input type="color" data-k="color" value="${esc(c.color)}"></label><label><input type="checkbox" data-k="hasbg"${c.bg ? ' checked' : ''}> backing</label>${c.bg ? `<input type="color" data-k="bg" value="${esc(c.bg)}">` : ''}<label>fade in ${num('fadeIn', c.fadeIn, 0.1)}</label><label>fade out ${num('fadeOut', c.fadeOut, 0.1)}</label></div></div>`).join('')
    const mo = mv.text.motion.map((m, i) => `<div class="omve-card" data-id="${m.id}"><div class="omve-row"><b>${i + 1}.</b><label>at ${num('t', m.t, 0.1)} s</label><label>mode ${sel('mode', ['cardinal', 'spherical'], m.mode)}</label><label>ease ${sel('ease', M.EASES, m.ease)}</label><button data-a="del">Remove</button></div>` +
      (m.mode === 'cardinal' ? `<div class="omve-row"><label>x ${num('cx', m.cardinal[0], 0.1)}</label><label>y ${num('cy', m.cardinal[1], 0.1)}</label><label>z ${num('cz', m.cardinal[2], 0.1)}</label>${Object.keys(M.CARDINAL).map(d => `<button data-a="dir" data-dir="${d}" title="push it ${d} by 1">${d}</button>`).join('')}</div>`
        : `<div class="omve-row"><label>radius ${num('sr', m.spherical[0], 0.1)}</label><label>azimuth° ${num('sa', m.spherical[1], 5)}</label><label>elevation° ${num('se', m.spherical[2], 5)}</label></div>`) + '</div>').join('')
    return `<div class="omve-row"><label><input type="checkbox" data-k="texton"${mv.text.on ? ' checked' : ''}> text layer on</label><label>base x ${num('bx', mv.text.base[0], 0.1)}</label><label>y ${num('by', mv.text.base[1], 0.1)}</label><label>z ${num('bz', mv.text.base[2], 0.05)}</label><label>width ${num('twidth', mv.text.width, 0.05)}</label></div>
      <div class="omve-row"><button data-a="addcap">Add caption at playhead</button></div>${items || '<div style="opacity:.7;padding:6px">No captions yet.</div>'}
      <div class="omve-row" style="margin-top:10px"><b>Text motion</b><button data-a="addmotion">Add motion key at playhead</button><span style="opacity:.7">cardinal = simple moves; spherical = round the node</span></div>${mo || '<div style="opacity:.7;padding:6px">The text stays at its base.</div>'}`
  }
  _node (mv) {
    return `<div class="omve-row"><label>width ${num('width', mv.width, 0.5)}</label><label><input type="checkbox" data-k="loop"${mv.loop ? ' checked' : ''}> loop</label><label><input type="checkbox" data-k="sound"${mv.muted ? '' : ' checked'}> sound</label><label>volume ${num('volume', mv.volume, 0.05)}</label></div>
      <div class="omve-row" style="opacity:.75">The edit lives in the node and is saved with the scene. Nothing is exported: it plays live.</div>`
  }

  // ── events ──
  _item (e, list) { const id = e.target.closest('[data-id]')?.dataset.id; return id ? { id, it: list.find(x => x.id === id) } : { id: null, it: null } }
  async _click (e) {
    const b = e.target.closest('button'); if (!b) return; const S = SERVICES.multivideo, mv = this._mv(), a = b.dataset.a
    if (b.dataset.tab) { this._tab = b.dataset.tab; return this._render() }
    if (a === 'close') return this.close()
    if (a === 'playpause') { const r = S.isPlaying(this._id) ? S.pause(this._id) : await S.play(this._id); if (r.ok === false) this._msg(r.error); return this._render() }
    if (a === 'stop') { S.stop(this._id); return this._render() }
    const card = e.target.closest('[data-id]')?.dataset.id; const t = S.time(this._id)
    if (this._tab === 'clips') {
      if (a === 'addblank') return this._ed(m => M.addClip(m, { name: 'Clip ' + (m.clips.length + 1), dur: 5 }), 'clip')
      if (a === 'split') { const r = this._ed(m => M.splitClip(m, t), 'clip'); return this._msg(r.ok && r.multiVideo.clips.length === mv.clips.length ? 'The playhead is not inside a clip.' : '') }
      if (a === 'del') return this._ed(m => M.removeClip(m, card), 'clip'); if (a === 'up') return this._ed(m => M.moveClip(m, card, -1), 'clip'); if (a === 'down') return this._ed(m => M.moveClip(m, card, 1), 'clip')
      if (a === 'sel') { this._sel = card; return this._render() }
    } else if (this._tab === 'keys') {
      const cam = this.ctx?.camera
      if (a === 'addkey') { const p = cam ? cam.position.toArray() : [0, 0, 0]; return this._ed(m => M.addKeyCoord(m, { t, target: 'both', pos: p }), 'key') }
      if (a === 'del') return this._ed(m => M.removeKeyCoord(m, card), 'key')
      if (a === 'here' && cam) return this._ed(m => M.updateKeyCoord(m, card, { pos: cam.position.toArray() }), 'key')
    } else if (this._tab === 'text') {
      if (a === 'addcap') return this._ed(m => M.addTextItem(m, { text: 'Caption', t0: t, t1: 0 }), 'text')
      if (a === 'addmotion') return this._ed(m => M.addMotionKey(m, { t, mode: 'cardinal' }), 'text')
      if (a === 'del') return this._ed(m => (m.text.items.some(x => x.id === card) ? M.removeTextItem(m, card) : M.removeMotionKey(m, card)), 'text')
      if (a === 'dir') { const m0 = mv.text.motion.find(x => x.id === card); if (m0) { const v = M.cardinalVec(b.dataset.dir, 1); return this._ed(m => M.updateMotionKey(m, card, { cardinal: [m0.cardinal[0] + v[0], m0.cardinal[1] + v[1], m0.cardinal[2] + v[2]] }), 'text') } }
    }
  }
  async _change (e) {
    const t = e.target, k = t.dataset.k; if (!k) return; const S = SERVICES.multivideo; const val = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.type === 'range' ? Number(t.value) : t.value
    if (k === 'scrub') { S.seek(this._id, val); return }
    const mv = this._mv(), id = t.closest('[data-id]')?.dataset.id
    if (this._tab === 'clips') {
      if (k === 'lib') { if (t.value) { const r = await S.addClip(this._id, { sourceId: t.value }); this._msg(r.ok ? '' : r.error) } return }
      if (k === 'file') { if (t.files?.[0]) { this._msg('Adding...'); const r = await S.addClipFile(this._id, t.files[0]); this._msg(r.ok ? '' : (r.error?.message ?? r.error ?? 'Could not add it.')) } return }
      const c = mv.clips.find(x => x.id === id); if (!c) return
      const patch = { name: { name: val }, in: { in: val }, out: { out: val }, dur: { dur: val }, speed: { speed: val }, volume: { volume: val }, opacity: { opacity: val }, fadeIn: { fadeIn: val }, fadeOut: { fadeOut: val },
        tkind: { transition: { ...c.transition, kind: val } }, tdur: { transition: { ...c.transition, dur: val } }, kenabled: { key: { ...c.key, enabled: val } }, kcolor: { key: { ...c.key, color: val } }, ksim: { key: { ...c.key, similarity: val } }, ksmooth: { key: { ...c.key, smoothness: val } }, kspill: { key: { ...c.key, spill: val } } }[k]
      if (patch) this._ed(m => M.updateClip(m, id, patch), 'clip')
    } else if (this._tab === 'keys') {
      const kk = mv.keys.find(x => x.id === id); if (!kk) return
      const patch = { t: { t: val }, target: { target: val }, ease: { ease: val }, px: { pos: [val, kk.pos[1], kk.pos[2]] }, py: { pos: [kk.pos[0], val, kk.pos[2]] }, pz: { pos: [kk.pos[0], kk.pos[1], val] },
        haslook: { look: val ? [...kk.pos] : null }, lx: { look: [val, ...(kk.look ?? [0, 0, 0]).slice(1)] }, ly: { look: [kk.look?.[0] ?? 0, val, kk.look?.[2] ?? 0] }, lz: { look: [kk.look?.[0] ?? 0, kk.look?.[1] ?? 0, val] } }[k]
      if (patch) this._ed(m => M.updateKeyCoord(m, id, patch), 'key')
    } else if (this._tab === 'text') {
      if (['texton', 'bx', 'by', 'bz', 'twidth'].includes(k)) { return void this._ed(m => ({ ...m, text: { ...m.text, ...(k === 'texton' ? { on: val } : k === 'twidth' ? { width: val } : { base: m.text.base.map((v, i) => (i === 'xyz'.indexOf(k[1]) ? val : v)) }) } }), 'text') }
      const it = mv.text.items.find(x => x.id === id)
      if (it) { const patch = { text: { text: val }, t0: { t0: val }, t1: { t1: val }, size: { size: val }, align: { align: val }, color: { color: val }, hasbg: { bg: val ? '#000000' : '' }, bg: { bg: val }, fadeIn: { fadeIn: val }, fadeOut: { fadeOut: val } }[k]; if (patch) this._ed(m => M.updateTextItem(m, id, patch), 'text'); return }
      const mo = mv.text.motion.find(x => x.id === id); if (!mo) return
      const patch = { t: { t: val }, mode: { mode: val }, ease: { ease: val }, cx: { cardinal: [val, mo.cardinal[1], mo.cardinal[2]] }, cy: { cardinal: [mo.cardinal[0], val, mo.cardinal[2]] }, cz: { cardinal: [mo.cardinal[0], mo.cardinal[1], val] },
        sr: { spherical: [val, mo.spherical[1], mo.spherical[2]] }, sa: { spherical: [mo.spherical[0], val, mo.spherical[2]] }, se: { spherical: [mo.spherical[0], mo.spherical[1], val] } }[k]
      if (patch) this._ed(m => M.updateMotionKey(m, id, patch), 'text')
    } else if (this._tab === 'node') {
      this._ed(m => ({ ...m, ...({ width: { width: val }, loop: { loop: val }, sound: { muted: !val }, volume: { volume: val } }[k] ?? {}) }), 'node')
    }
  }
  async _fillLib () { try { const s = this._el.querySelector('[data-k="lib"]'); if (!s) return; const l = await SERVICES.multivideo.listVideos(); s.innerHTML = '<option value="">Add from the library...</option>' + l.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('') } catch (_) { /* no library */ } }
}
