/**
 * systems/OmniFlashcards.js (V269) — the runtime of the Flashcards node: one node = one deck. Model: utils/OmniFlashcardModel.js.
 *   CREATING  omni:flash-node-create { title?, cards?, position?, select?, id? } (answer in detail.out { ok, nodeId })
 *   DRAWING   the card in front is drawn into the node's sheet (the same thin double-sided sheet as the DocNode / NoteNode) only when it changed and the node is near.
 *   STUDY     flip / next / prev / mark(got|again) / restart; if the deck's "read aloud" is on, the side that appears is spoken (and its sound clip played).
 *   FILES     exportText(id, 'json'|'csv') · importText(id, text, 'json'|'csv', 'replace'|'merge')
 *   SERVICES.flash: create getDeck setDeck isFlashNode list addCard updateCard removeCard moveCard setMeta flip next prev mark restart play exportText importText progress
 *   Events out: omni:flash-changed { nodeId, reason }.   Commands: Omni Flash ...    UI: ui/OmniFlashUI.js (study bar + editor), ui/OmniFlashInspector.js
 */
import * as THREE from 'three'
import * as F from '../utils/OmniFlashcardModel.js'
import { KIND_FLASH, GEO_FLASH, SERVICES } from '../utils/OmniExtraKinds.js'
import { applyDocLook, setPageCanvas, clearPage, DOC_LIVE } from '../utils/OmniDocNodeMesh.js'

const PIN_DISTANCE = 7, PERSIST_MS = 300, LOD_INTERVAL = 0.25, FAR = 300, NODE_COLOR = '#7fd6a2', PW = 640, PH = 400
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }

export default class OmniFlashcards {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._sane = new WeakMap(); this._persist = new Map(); this._state = new Map(); this._images = new Map(); this._lodT = 0; this._dirty = true; this._audio = null }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:flash-node-create', (d, e) => { const out = this.create(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node)); on('omni:node-deleted', (d) => { clearTimeout(this._persist.get(d.id)); this._persist.delete(d.id); this._state.delete(d.id) })
    on('omni:extra-mesh-released', (d) => { if (d.kind === KIND_FLASH) this._state.delete(d.mesh?.userData?.nodeId) })
    this._syncAll(); SERVICES.flash = this
  }
  destroy () { if (!this._inited) return; for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); this._state.clear(); this._images.clear(); this.stopAudio(); if (SERVICES.flash === this) SERVICES.flash = null; this._inited = false }
  onResize () { this._dirty = true }

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isFlashNode (id) { return this._data(id)?.nodeKind === KIND_FLASH }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_FLASH).map(d => d.id) } catch (_) { return [] } }
  getDeck (id) {
    const d = this._data(id); if (!d || d.nodeKind !== KIND_FLASH) return null
    const raw = d.flash; if (!raw || typeof raw !== 'object') { const m = F.defaultDeck(); this._sane.set(m, m); d.flash = m; return m }
    let m = this._sane.get(raw); if (!m) { m = F.sanitizeDeck(raw); this._sane.set(raw, m); this._sane.set(m, m) }
    return m
  }
  setDeck (id, deck, reason = 'edit') {
    const d = this._data(id); if (!d || d.nodeKind !== KIND_FLASH) return { ok: false, error: 'That is not a flashcards node.' }
    const next = F.sanitizeDeck(deck); this._sane.set(next, next); d.flash = next; this._dirty = true
    send('omni:flash-changed', { nodeId: id, reason }); this._persistSoon(id); return { ok: true, deck: next }
  }
  _need (id) { const k = this.getDeck(id); if (!k) throw new Error('That is not a flashcards node.'); return k }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) } const d = id ? this._data(id) : null; if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { node: d }); return true }

  // ── creating ──
  _facing () {
    try { const cam = this.ctx.camera; cam.updateMatrixWorld?.(true); const e = cam.matrixWorld.elements
      const z = new THREE.Vector3(e[8], e[9], e[10]).normalize(), y = new THREE.Vector3(e[4], e[5], e[6]).normalize(); const x = new THREE.Vector3().crossVectors(y, z).normalize(), yy = new THREE.Vector3().crossVectors(z, x).normalize()
      const eu = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yy, z)), 'XYZ'); return [eu.x, eu.y, eu.z].map(v => (Number.isFinite(v) ? v : 0)) } catch (_) { return [0, 0, 0] }
  }
  _positionFor (o) {
    const p = o.position; if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}; let deck = F.sanitizeDeck({ title: o.title })
      for (const c of (Array.isArray(o.cards) ? o.cards : [])) deck = F.addCard(deck, F.newCard(c?.front?.text ?? c?.front ?? '', c?.back?.text ?? c?.back ?? ''))
      deck = { ...deck, queue: deck.cards.map(c => c.id) }
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      send('omni:node-create-request', { nodeKind: KIND_FLASH, flash: deck, id: nodeId, label: String(o.title || 'Flashcards').slice(0, 40), geometry: GEO_FLASH, primitive: 'objective', color: NODE_COLOR, position: this._positionFor(o), rotation: this._facing(), scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The flashcards node could not be created.' }
      this._dirty = true; return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_FLASH) return; if (!d.flash || typeof d.flash !== 'object' || Array.isArray(d.flash)) { d.flash = F.defaultDeck(); this._persistSoon(d.id) } this._dirty = true }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }

  // ── editing ──
  addCard (id, front = '', back = '') { const k = this._need(id); const card = F.newCard(front, back); const r = this.setDeck(id, F.addCard(k, card), 'add'); return r.ok ? card.id : null }
  updateCard (id, cardId, patch) { return this.setDeck(id, F.updateCard(this._need(id), cardId, patch), 'edit').ok }
  removeCard (id, cardId) { return this.setDeck(id, F.removeCard(this._need(id), cardId), 'remove').ok }
  moveCard (id, cardId, to) { return this.setDeck(id, F.moveCard(this._need(id), cardId, to), 'move').ok }
  setMeta (id, patch) { const k = this._need(id); const p = patch && typeof patch === 'object' ? patch : {}; const nxt = { ...k }; for (const key of ['title', 'speak', 'paper', 'width']) if (p[key] !== undefined) nxt[key] = p[key]; if (nxt.title !== k.title && this._data(id)) this._data(id).label = String(nxt.title).slice(0, 40); return this.setDeck(id, nxt, 'meta').ok }

  // ── studying ──
  progress (id) { return F.progress(this._need(id)) }
  _study (id, fn, reason, say = true) { const k = this._need(id); const nx = fn(k); this.setDeck(id, nx, reason); if (say && nx.speak && nx.queue.length) this.play(id); return F.progress(nx) }
  flip (id) { return this._study(id, F.flip, 'flip') }
  next (id) { return this._study(id, F.next, 'next') }
  prev (id) { return this._study(id, F.prev, 'prev') }
  mark (id, how) { if (how !== 'got' && how !== 'again') throw new Error('mark must be got or again'); return this._study(id, (k) => F.mark(k, how), how) }
  restart (id, shuffle = false) { return this._study(id, (k) => F.restart(k, shuffle), shuffle ? 'shuffle' : 'restart') }
  stopAudio () { try { this._audio?.pause?.() } catch (_) { /* nothing playing */ } this._audio = null; try { globalThis.speechSynthesis?.cancel?.() } catch (_) { /* no speech */ } }
  /** play the sound clip of the side now showing; with no clip, speak its text (when the deck reads aloud or `force`) */
  play (id, force = false) {
    const k = this._need(id); const c = F.current(k); if (!c) return false; const side = c[k.side]; this.stopAudio()
    try {
      if (side.snd && typeof Audio !== 'undefined') { this._audio = new Audio(side.snd); this._audio.play?.().catch?.(() => {}); return true }
      if ((k.speak || force) && side.text && globalThis.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') { globalThis.speechSynthesis.speak(new SpeechSynthesisUtterance(side.text)); return true }
    } catch (_) { /* audio blocked */ }
    return false
  }

  // ── files ──
  exportText (id, format = 'json') { const k = this._need(id); if (format === 'csv') return F.toCSV(k); if (format === 'json') return F.toJSON(k); throw new Error('format must be json or csv') }
  importText (id, text, format = 'json', mode = 'replace') {
    const k = this._need(id); const inc = format === 'csv' ? F.fromCSV(text) : format === 'json' ? F.fromJSON(text) : null; if (!inc) throw new Error('format must be json or csv')
    let deck = k
    if (mode === 'replace') deck = { ...k, title: format === 'json' ? inc.title : k.title, speak: format === 'json' ? inc.speak : k.speak, cards: inc.cards, queue: inc.cards.map(c => c.id), side: 'front', got: 0, again: 0 }
    else for (const c of inc.cards) deck = F.addCard(deck, c)
    const r = this.setDeck(id, deck, 'import'); if (!r.ok) throw new Error(r.error)
    if (mode === 'replace' && this._data(id)) this._data(id).label = String(r.deck.title).slice(0, 40)
    return { ok: true, cards: r.deck.cards.length, added: inc.cards.length }
  }

  // ── drawing ──
  _image (src) {
    let im = this._images.get(src); if (im) return im
    im = { el: null, ready: false }; this._images.set(src, im); if (typeof Image === 'undefined') return im
    const el = new Image(); el.onload = () => { im.el = el; im.ready = true; this._dirty = true; for (const st of this._state.values()) st.key = '' }; el.onerror = () => { im.ready = false }; el.src = src; return im
  }
  _wrap (g, text, maxW) {
    const out = []; for (const para of String(text).split('\n')) { let line = ''; for (const w of para.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w } } out.push(line) } return out
  }
  render (mesh, k) {
    const v = mesh.userData.dnv; if (!v?.canvas) return false
    v.canvas.width = PW; v.canvas.height = PH; const g = v.canvas.getContext?.('2d'); if (!g) return false
    const c = F.current(k), p = F.progress(k), back = k.side === 'back'
    g.fillStyle = back ? '#eef6ff' : k.paper; g.fillRect(0, 0, PW, PH); g.strokeStyle = back ? '#9ac2ee' : '#d8cfa8'; g.lineWidth = 6; g.strokeRect(3, 3, PW - 6, PH - 6)
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1b2230'
    if (!k.cards.length) { g.font = '600 34px system-ui, sans-serif'; g.fillText('Empty deck', PW / 2, PH / 2 - 14); g.font = '22px system-ui, sans-serif'; g.fillStyle = '#5a6578'; g.fillText('Open the editor and add cards', PW / 2, PH / 2 + 26); return true }
    if (!c) { g.font = '700 40px system-ui, sans-serif'; g.fillText('Round done', PW / 2, PH / 2 - 40); g.font = '26px system-ui, sans-serif'; g.fillStyle = '#35604a'; g.fillText(`Got it ${p.got}  ·  Again ${p.again}`, PW / 2, PH / 2 + 10); g.fillStyle = '#5a6578'; g.font = '20px system-ui, sans-serif'; g.fillText('Restart to go round again', PW / 2, PH / 2 + 52); return true }
    const side = c[k.side]; const img = side.img ? this._image(side.img) : null
    g.font = '600 15px system-ui, sans-serif'; g.fillStyle = back ? '#4a78b0' : '#8a7a40'; g.textAlign = 'left'; g.fillText(back ? 'BACK' : 'FRONT', 18, 22); g.textAlign = 'right'; g.fillStyle = '#7b8496'; g.fillText(`${p.left} left  ·  got ${p.got}  ·  again ${p.again}`, PW - 18, 22)
    g.textAlign = 'center'; g.fillStyle = '#1b2230'
    const hasImg = !!(img?.ready && img.el), top = 40, bottom = PH - 18; let textTop = top, textBot = bottom
    if (hasImg) { const ih = side.text ? (bottom - top) * 0.55 : (bottom - top); const s = Math.min((PW - 60) / img.el.width, ih / img.el.height, 2); const w = img.el.width * s, h = img.el.height * s; g.drawImage(img.el, (PW - w) / 2, top + (ih - h) / 2, w, h); textTop = top + ih + 6 }
    if (side.text) {
      const maxW = PW - 70, boxH = textBot - textTop; let size = hasImg ? 30 : 48, lines
      for (; size >= 16; size -= 2) { g.font = `600 ${size}px system-ui, sans-serif`; lines = this._wrap(g, side.text, maxW); if (lines.length * size * 1.25 <= boxH) break }
      const lh = size * 1.25, y0 = textTop + boxH / 2 - (lines.length * lh) / 2 + lh / 2; lines.slice(0, Math.max(1, Math.floor(boxH / lh))).forEach((ln, i) => g.fillText(ln, PW / 2, y0 + i * lh))
    } else if (!hasImg) { g.font = 'italic 24px system-ui, sans-serif'; g.fillStyle = '#9aa3b4'; g.fillText('(nothing on this side)', PW / 2, PH / 2) }
    if (side.snd) { g.font = '20px system-ui, sans-serif'; g.textAlign = 'right'; g.fillStyle = '#7b8496'; g.fillText('🔊', PW - 16, PH - 18) }
    this._stats.draws++; return true
  }
  get _stats () { return (this.__stats ??= { draws: 0 }) }
  update (delta) {
    this._lodT += Math.max(0, Number(delta) || 0); if (this._lodT < LOD_INTERVAL && !this._dirty) return
    this._lodT = 0; this._dirty = false; const camPos = this.ctx?.camera?.position
    for (const mesh of DOC_LIVE) {
      const id = mesh.userData?.nodeId; if (!id || !mesh.userData?.dnv) continue
      const k = this.getDeck(id); if (!k) continue
      let st = this._state.get(id); if (!st) { st = { key: '', drawn: false }; this._state.set(id, st) }
      const near = !camPos || mesh.position.distanceTo(camPos) < FAR; if (!near || mesh.visible === false) { if (st.drawn) { clearPage(mesh); st.drawn = false; st.key = '' } continue }
      const cur = F.current(k); const key = JSON.stringify([k.queue[0], k.side, k.got, k.again, k.cards.length, k.paper, k.width, cur ? [cur.front, cur.back].map(s => [s.text, s.img ? s.img.length : 0]) : 0, [...this._images.values()].filter(i => i.ready).length])
      if (key === st.key && st.drawn) continue
      if (!this.render(mesh, k)) continue
      applyDocLook(mesh, { width: k.width, aspect: PH / PW, paper: k.side === 'back' ? '#eef6ff' : k.paper, sides: 'double', frame: true }); setPageCanvas(mesh); st.key = key; st.drawn = true
    }
  }
}
