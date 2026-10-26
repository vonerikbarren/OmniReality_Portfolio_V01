/**
 * modules/OmniLandingRoom.js — ⟐OmniLandingRoom
 *
 * The hardcoded Cross-formation room for the landing page. Reuses
 * the real, existing Cross positions (`ui/OmniSystemCreatorPanel.js`'s
 * own `crossDefs()`) rather than duplicating that math — this is a
 * fixed, specific instance of Cross, not a new formation.
 *
 * Each of the 7 nodes (center + 6 arms) is its own panel: semi-
 * transparent by default, with independent color/alpha/texture —
 * the same OmniDraw-style customization OmniBrowserSpace's own faces
 * already use. Geometry is deliberately different per node right
 * now — "make it possible" for each node to look noticeably
 * distinct before any real content exists to fill them.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { crossDefs } from '../ui/OmniSystemCreatorPanel.js'

const NODE_DISTANCE = 16   // room-scale radius from center to each arm
const PANEL_SIZE = 5       // each node's own panel size

// Specific assignments, per the request — "gridbox system" for Down
// reads as a real subdivided box (matching Grid formation's own
// default node shape), not a plain, unsubdivided cube.
const FIXED_GEOMETRY = {
  down:    'BoxGeometry',       // "the gridbox system"
  center:  'SphereGeometry',
  up:      'OctahedronGeometry',
  back:    'TorusGeometry',
}

// A safe, simple subset for random assignment — shapes that render
// correctly from just a radius, no special path/curve data needed
// (unlike Extrude/Lathe/Shape/Tube, which would silently look wrong
// or error without that extra data).
const RANDOM_GEOMETRY_POOL = [
  'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry',
  'TorusGeometry', 'TorusKnotGeometry', 'OctahedronGeometry',
  'TetrahedronGeometry', 'IcosahedronGeometry', 'DodecahedronGeometry',
]

function buildGeometry (type, size) {
  switch (type) {
    case 'BoxGeometry':          return new THREE.BoxGeometry(size, size, size, 6, 6, 6)   // subdivided — the actual "gridbox" look
    case 'SphereGeometry':       return new THREE.SphereGeometry(size * 0.6, 24, 16)
    case 'CylinderGeometry':     return new THREE.CylinderGeometry(size * 0.5, size * 0.5, size, 20)
    case 'ConeGeometry':         return new THREE.ConeGeometry(size * 0.6, size, 20)
    case 'TorusGeometry':        return new THREE.TorusGeometry(size * 0.6, size * 0.22, 12, 36)
    case 'TorusKnotGeometry':    return new THREE.TorusKnotGeometry(size * 0.5, size * 0.15, 100, 12)
    case 'OctahedronGeometry':   return new THREE.OctahedronGeometry(size * 0.65)
    case 'TetrahedronGeometry':  return new THREE.TetrahedronGeometry(size * 0.65)
    case 'IcosahedronGeometry':  return new THREE.IcosahedronGeometry(size * 0.6)
    case 'DodecahedronGeometry': return new THREE.DodecahedronGeometry(size * 0.6)
    default:                     return new THREE.BoxGeometry(size, size, size)
  }
}

export default class OmniLandingRoom {
  constructor (context) {
    this.ctx = context
    this.group = null
    this.nodes = []   // [{ key, label, geometryType, mesh, position }]
  }

  init () {
    this.group = new THREE.Group()
    this.ctx.scene.add(this.group)

    const defs = crossDefs()
    defs.forEach(def => {
      const geometryType = FIXED_GEOMETRY[def.key] ?? this._randomGeometry()
      const position = new THREE.Vector3(...def.pos(def.isCenter ? 0 : NODE_DISTANCE))

      const geo = buildGeometry(geometryType, PANEL_SIZE)
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8cc4ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, roughness: 0.4,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(position)
      mesh.userData.omniLandingNode = { key: def.key, label: def.label, geometryType }
      this.group.add(mesh)

      this.nodes.push({ key: def.key, label: def.label, geometryType, mesh, position })
    })
  }

  update () {}
  onResize () {}

  destroy () {
    this.nodes.forEach(n => {
      n.mesh.geometry.dispose()
      n.mesh.material.dispose()
    })
    this.nodes = []
    if (this.group) this.ctx.scene.remove(this.group)
  }

  /** Real lookup by key — for NavMapPanel's fast-travel and for
   *  anything later that needs a specific node's real position. */
  getNode (key) {
    return this.nodes.find(n => n.key === key) ?? null
  }

  _randomGeometry () {
    return RANDOM_GEOMETRY_POOL[Math.floor(Math.random() * RANDOM_GEOMETRY_POOL.length)]
  }
}
