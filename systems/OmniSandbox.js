/**
 * systems/OmniSandbox.js (V226) — the Sandbox: one marked-off area for experiments, kept apart from the portfolio.
 *
 * It is a Dimensional Space called "Sandbox" (systems/OmniDimensionalSpaces.js) plus a spawn point away from the rest of the scene.
 * Everything made here belongs to that space, so it can be hidden, locked, remixed or wiped without touching any other node.
 *
 *   SERVICES.sandbox.spawn({ n, seed, layout, remix })  make n random nodes at the spawn point, in the Sandbox (default 6, at most 24)
 *   .add(id) .remove(id) .ids() .clear() .setShown(bool) .setLocked(bool) .centre([x,y,z]) .remix(opts)
 * Only nodes in the Sandbox are ever deleted by clear(). Cap 60 nodes (the Remix cap). Spawn point saved in localStorage 'omni:sandbox:v1'.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { layoutPositions, makeRng, rollScene, LAYOUTS } from '../utils/OmniRemixModel.js'

export const NAME = 'Sandbox'
export const MAX_NODES = 60
export const MAX_SPAWN = 24
export const STORE_KEY = 'omni:sandbox:v1'
export const DEFAULT_CENTRE = [60, 1, 0]
const SHAPES = ['BoxGeometry', 'SphereGeometry', 'ConeGeometry', 'CylinderGeometry', 'TorusGeometry', 'OctahedronGeometry', 'IcosahedronGeometry', 'DodecahedronGeometry', 'TetrahedronGeometry', 'TorusKnotGeometry']
const send = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))

export default class OmniSandbox {
  constructor (context, omniNode) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._centre = [...DEFAULT_CENTRE] }
  init () {
    try { const c = JSON.parse(localStorage.getItem(STORE_KEY))?.centre; if (Array.isArray(c) && c.length === 3 && c.every(Number.isFinite)) this._centre = c } catch (_) {}
    SERVICES.sandbox = this
  }
  update () {} onResize () {}
  destroy () { if (SERVICES.sandbox === this) SERVICES.sandbox = null }

  get spaces () { if (!SERVICES.spaces) throw new Error('the spaces system is not running'); return SERVICES.spaces }
  /** The Sandbox space, made on first use. */
  space () { const sp = this.spaces; return sp.spaces.find(s => s.name === NAME) ?? sp.createSpace(NAME) }
  ids () {
    const s = this.spaces.spaces.find(x => x.name === NAME); if (!s) return []
    return Object.keys(s.members).filter(id => this.omniNode?.getMeshById?.(id))
  }
  getCentre () { return [...this._centre] }
  centre (c) {
    if (!Array.isArray(c) || c.length !== 3 || !c.every(Number.isFinite)) throw new Error('centre needs x, y, z')
    this._centre = c.map(v => +v.toFixed(2)); try { localStorage.setItem(STORE_KEY, JSON.stringify({ centre: this._centre })) } catch (_) {}
    return this.getCentre()
  }
  add (id) {
    const on = this.omniNode; if (!on?.getMeshById?.(id)) throw new Error(`no node "${id}"`)
    const s = this.space(); if (!s) throw new Error('could not make the Sandbox space')
    if (this.ids().length >= MAX_NODES && !(id in s.members)) throw new Error(`the Sandbox holds at most ${MAX_NODES} nodes`)
    if (!this.spaces.assign(id, s.id)) throw new Error('could not add it to the Sandbox'); return true
  }
  remove (id) { if (!this.ids().includes(id)) throw new Error(`"${id}" is not in the Sandbox`); this.spaces.unassign(id); return true }

  spawn (o = {}) {
    const on = this.omniNode; if (!on) throw new Error('the node system is not available here')
    const room = MAX_NODES - this.ids().length; if (room <= 0) throw new Error(`the Sandbox is full (${MAX_NODES}); Omni Sandbox clear confirm first`)
    const n = Math.max(1, Math.min(MAX_SPAWN, room, Math.floor(Number(o.n ?? 6)) || 6))
    if (o.layout && !LAYOUTS.includes(o.layout)) throw new Error(`layout(...) is one of: ${LAYOUTS.join(', ')}`)
    const seed = o.seed ?? Math.floor(Math.random() * 1e6), rng = makeRng(String(seed) + 'S')
    const pos = layoutPositions(o.layout ?? 'scatter', n, this._centre, rng), made = []
    for (let i = 0; i < n; i++) {
      const id = 'sbx_' + Math.random().toString(36).slice(2, 8)
      send('omni:node-create-request', { id, label: 'Sandbox ' + (this.ids().length + 1), geometry: rng.pick(SHAPES), primitive: 'objective', color: '#ffffff', position: pos[i], scale: [1, 1, 1], rotation: [0, 0, 0], noParent: true, noSelect: true })
      if (!on.getMeshById?.(id)) continue
      this.add(id); made.push(id)
    }
    if (!made.length) throw new Error('no nodes could be created')
    let text = `Sandbox: ${made.length} new node${made.length === 1 ? '' : 's'} at (${this._centre.join(', ')})  seed ${seed}`
    if (o.remix !== false && SERVICES.remix) text += '\n' + SERVICES.remix.roll({ scope: made, seed, scheme: o.scheme, axiom: o.axiom }).text
    return { ids: made, seed, text }
  }
  remix (o = {}) { if (!SERVICES.remix) throw new Error('the remix system is not running'); if (!this.ids().length) throw new Error('the Sandbox is empty: Omni Sandbox spawn'); return SERVICES.remix.roll({ ...o, scope: 'sandbox' }) }
  _plane () { const s = this.space(); return [s, s.planes[0]] }
  setShown (v) { const [s, p] = this._plane(); this.spaces.setPlane(s.id, p.id, { visible: !!v }); return !!v }
  setLocked (v) { const [s, p] = this._plane(); this.spaces.setPlane(s.id, p.id, { locked: !!v }); return !!v }
  /** Deletes only what is in the Sandbox. */
  clear () { const ids = this.ids(); for (const id of ids) send('omni:node-delete-request', { id }); for (const id of ids) { try { this.spaces.unassign(id, true) } catch (_) {} } return ids.length }
}
