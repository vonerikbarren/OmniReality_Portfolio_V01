/**
 * systems/OmniOrbNodes.js (V234) — orbs SUMMONED INTO THE SCENE. An orb node is a normal node (a glowing core you can select, move or delete) with
 * the words you chose orbiting it on tilted rings, looping: a small galaxy of that hand's potentials. What a combination of words DOES in the
 * scene is not built yet; for now the orb shows and loops them.
 *
 *   SERVICES.orbnodes.summon({ hand, words, scale, pos })   -> { id, hand, words }   (pos [x,y,z]; default 8 units in front of the camera)
 *   .list()  .remove(id)  .clear()          at most 12 orb nodes; 1..12 words each
 * Events: omni:orbnode-summon { hand, words, scale?, pos? } in (the orb panel and `Omni Orb summon`; the handler sets detail.out or detail.error).
 * Orb nodes are not saved with the scene yet (the core node is; the orbiting words are not). Module contract: constructor / init / update / destroy / onResize.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { HANDS } from '../utils/OmniOrbPotentials.js'
import { wordPositions } from '../utils/OmniOrbModel.js'
import { hueColor } from '../utils/OmniConstructionModel.js'

export const MAX_ORBS = 12
export const MAX_WORDS = 12
const RADIUS = 3

export default class OmniOrbNodes {
  constructor (context, omniNode) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this.orbs = new Map(); this._tex = new Map(); this._bound = []; this._n = 0 }
  init () {
    SERVICES.orbnodes = this
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:orbnode-summon', (d) => { try { d.out = this.summon(d) } catch (e) { d.error = e.message } })
    on('omni:node-deleted', (d) => { if (this.orbs.has(d.id)) this._drop(d.id) })
    on('omni:scene-clear-request', () => this.clear())
  }
  list () { return [...this.orbs.entries()].map(([id, o]) => ({ id, hand: o.hand, words: [...o.words] })) }

  _texture (word, color) {
    const key = word + '|' + color; let t = this._tex.get(key); if (t) return t
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64
    const g = cv.getContext('2d'); g.font = "600 30px 'Noto Sans', 'Noto Sans CJK SC', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.shadowColor = color; g.shadowBlur = 8; g.fillStyle = color; g.fillText(word, 128, 34)
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace
    t = { tex, aspect: Math.min(4, Math.max(1.2, (g.measureText?.(word)?.width ?? 120) / 40 + 0.6)) }; this._tex.set(key, t); return t
  }
  _frontOfCamera (dist = 8) {
    const cam = this.context?.camera; if (!cam) return [0, 2, -dist]
    const v = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(dist).add(cam.position); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]
  }

  summon (o = {}) {
    const hand = String(o.hand ?? 'lh'); const H = HANDS[hand]; if (!H) throw new Error('hand is one of: ' + Object.keys(HANDS).join(', '))
    const words = [...new Set((Array.isArray(o.words) ? o.words : []).map(w => String(w).trim().slice(0, 28)).filter(Boolean))].slice(0, MAX_WORDS)
    if (!words.length) throw new Error('choose some words first (click them in the orb)')
    if (this.orbs.size >= MAX_ORBS) throw new Error(`the scene holds at most ${MAX_ORBS} orbs; Omni Orb clear first`)
    const on = this.omniNode; if (!on) throw new Error('the node system is not available here')
    let pos = o.pos; if (pos !== undefined && !(Array.isArray(pos) && pos.length === 3 && pos.every(Number.isFinite))) throw new Error('pos needs x, y, z')
    pos = pos ?? this._frontOfCamera()
    const scale = Math.max(0.5, Math.min(3, Number(o.scale) || 1)), id = 'orb_' + hand + '_' + (++this._n).toString(36) + Math.random().toString(36).slice(2, 5)
    window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: { id, label: `Orb · ${hand.toUpperCase()} · ${words.slice(0, 3).join(', ')}`, geometry: 'SphereGeometry', primitive: 'objective', color: H.palette.core, position: pos, scale: [0.8, 0.8, 0.8], rotation: [0, 0, 0], noParent: true, noSelect: true } }))
    const mesh = on.getMeshById?.(id); if (!mesh) throw new Error('the orb node could not be created')
    const group = new THREE.Group(); group.name = 'orbnode-words'; group.scale.setScalar(scale / 0.8)
    const sprites = words.map((w, i) => {
      const color = hand === 'rh' ? hueColor((i * 360) / words.length) : H.palette.text, { tex, aspect } = this._texture(w, color)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(0.5 * aspect, 0.5, 1); group.add(sp); return sp
    })
    for (const [k, tilt] of [[1, 0.35], [0.86, -0.5], [0.7, 0.1]]) {   // the three faint rings
      const pts = []; for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * RADIUS * k, Math.sin(t) * RADIUS * k * 0.42, 0)) }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: H.palette.ring, transparent: true, opacity: 0.35 })); line.rotation.z = tilt; group.add(line)
    }
    mesh.add(group)
    this.orbs.set(id, { hand, words, group, sprites, t: Math.random() * 10 })
    return { id, hand, words, pos }
  }
  _drop (id) {
    const o = this.orbs.get(id); if (!o) return
    o.group.parent?.remove(o.group); o.group.traverse(n => { if (n.geometry) n.geometry.dispose?.(); if (n.material) { n.material.dispose?.() } })
    this.orbs.delete(id)
  }
  remove (id) { if (!this.orbs.has(id)) throw new Error(`"${id}" is not an orb`); this._drop(id); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); return true }
  clear () { const ids = [...this.orbs.keys()]; for (const id of ids) { this._drop(id); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })) } return ids.length }

  update (delta) {
    for (const o of this.orbs.values()) {
      o.t += delta; o.group.rotation.y += delta * 0.25
      const p = wordPositions(o.words, o.t, 1)
      p.forEach((w, i) => { const sp = o.sprites[i]; sp.position.set(w.x * RADIUS, w.y * RADIUS, w.z * RADIUS * 0.6); sp.material.opacity = 0.35 + 0.65 * (w.z + 1) / 2 })
    }
  }
  onResize () {}
  destroy () {
    for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []
    for (const id of [...this.orbs.keys()]) this._drop(id)
    for (const { tex } of this._tex.values()) tex.dispose?.(); this._tex.clear()
    if (SERVICES.orbnodes === this) SERVICES.orbnodes = null
  }
}
