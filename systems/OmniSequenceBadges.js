/**
 * systems/OmniSequenceBadges.js (V255) — a small round number above every node that is in a lineup: its place in the sequence.
 *   SERVICES.badges.set({ on, showTotal }) / get() / toggle()      Command: Omni Lineup numbers [on|off|toggle] [total(true|false)]
 * The badges are sprites in the scene (not children of the nodes), so they never touch what a node saves. They follow the nodes every frame,
 * keep a steady size on screen, and show through other things. Preference saved in localStorage 'omni:badges:v1'.
 * Events in: omni:lineup-changed (rebuild), omni:badges-request { action: 'toggle'|'on'|'off'|'total', value }. Out: omni:badges-changed { prefs }.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as B from '../utils/OmniSequenceBadgeModel.js'

export const STORE_KEY = 'omni:badges:v1'
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }

export default class OmniSequenceBadges {
  constructor (context, omniNode = null) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._items = new Map(); this._tex = new Map(); this._bound = []; this._inited = false; this._prefs = { ...B.DEFAULT_PREFS }; this._list = [] }
  init () {
    if (this._inited) return; this._inited = true
    try { this._prefs = B.sanitizePrefs(JSON.parse(localStorage.getItem(STORE_KEY))) } catch (_) { this._prefs = { ...B.DEFAULT_PREFS } }
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:lineup-changed', (d) => this._rebuild(d.state))
    on('omni:node-deleted', () => this._rebuild())
    on('omni:badges-request', (d) => { try { if (d.action === 'toggle') this.toggle(); else if (d.action === 'on') this.set({ on: true }); else if (d.action === 'off') this.set({ on: false }); else if (d.action === 'total') this.set({ showTotal: d.value !== undefined ? !!d.value : !this._prefs.showTotal }) } catch (_) { /* ignore a bad request */ } })
    SERVICES.badges = this
    setTimeout(() => this._rebuild(), 400)   // lineups load from storage in their own init
  }
  destroy () { this._clear(); for (const t of this._tex.values()) t.dispose(); this._tex.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.badges === this) SERVICES.badges = null; this._inited = false }
  onResize () {}
  get () { return { ...this._prefs } }
  set (patch = {}) { this._prefs = B.sanitizePrefs({ ...this._prefs, ...patch }); try { localStorage.setItem(STORE_KEY, JSON.stringify(this._prefs)) } catch (_) { /* full */ } this._rebuild(); send('omni:badges-changed', { prefs: this.get() }); return this.get() }
  toggle () { return this.set({ on: !this._prefs.on }) }
  /** What is showing right now: [{ nodeId, text }] (for tests and the command). */
  shown () { return [...this._items.entries()].map(([nodeId, it]) => ({ nodeId, text: it.text, visible: it.sprite.visible })) }

  _clear () { for (const it of this._items.values()) { it.sprite.parent?.remove(it.sprite); it.sprite.material.dispose() } this._items.clear() }
  _texture (text) {
    let t = this._tex.get(text); if (t) return t
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d')
    g.fillStyle = 'rgba(8,16,28,.88)'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill()
    g.lineWidth = 6; g.strokeStyle = '#7ec8ff'; g.stroke()
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${text.length > 3 ? 40 : text.length > 1 ? 52 : 70}px sans-serif`; g.fillText(text, 64, 68)
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this._tex.set(text, t); if (this._tex.size > 200) { const k = this._tex.keys().next().value; this._tex.get(k).dispose(); this._tex.delete(k) }
    return t
  }
  _rebuild (state = null) {
    this._clear(); const scene = this.context?.scene; if (!scene || !this._prefs.on) return
    const st = state ?? SERVICES.lineup?.state?.(); this._list = B.badgesFor(st, { showTotal: this._prefs.showTotal })
    for (const b of this._list) {
      if (!this.omniNode?.getNodeData?.(b.nodeId)) continue
      const mat = new THREE.SpriteMaterial({ map: this._texture(b.text), transparent: true, depthTest: false, depthWrite: false })
      const sprite = new THREE.Sprite(mat); sprite.renderOrder = 999; sprite.name = 'omni-seq-badge'; sprite.userData.omniOverlay = true; sprite.raycast = () => {}   // never picked
      scene.add(sprite); this._items.set(b.nodeId, { sprite, text: b.text })
    }
  }
  update () {
    if (!this._items.size) return
    const cam = this.context?.camera; if (!cam) return
    for (const [id, it] of this._items) {
      const mesh = this.omniNode?.getMeshById?.(id)
      if (!mesh) { it.sprite.visible = false; continue }
      const g = mesh.geometry; let r = 1
      if (g) { if (!g.boundingSphere) g.computeBoundingSphere?.(); r = g.boundingSphere?.radius ?? 1 }
      const sc = Math.max(mesh.scale?.x ?? 1, mesh.scale?.y ?? 1, mesh.scale?.z ?? 1)
      const wp = mesh.getWorldPosition ? mesh.getWorldPosition(new THREE.Vector3()) : mesh.position
      const dist = cam.position.distanceTo(wp); const size = B.badgeScale(dist, 0.045, cam.fov)
      it.sprite.position.set(wp.x, wp.y + r * sc + size * 0.75, wp.z); it.sprite.scale.set(size, size, 1); it.sprite.visible = true
    }
  }
}
