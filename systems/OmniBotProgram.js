/**
 * systems/OmniBotProgram.js — ⟐mniBotProgram
 *
 * The real, technical program type OmniProgram Protocol builds.
 * Experienced/displayed in the scene as OmniNavi. Still a real
 * OmniNode — spawned through the exact same omni:node-create-
 * request pipeline everything else uses, so it's selectable,
 * Inspector-editable, and themeable for free — but with its own
 * real, continuous update() doing something every frame, which is
 * the real, confirmed architectural fork from a normal, static
 * OmniNode. Kept as a separate manager rather than touching
 * OmniNode.js itself — lower-risk, and OmniNode has no concept of
 * "this node drives its own behavior" to extend.
 *
 * Physical construction (four real parts): a cube head with a real,
 * embedded CanvasTexture panel (same real technique already proven
 * by OmniLogPagesPanel/TerminalTunnel); a sphere body; a
 * stateCommunicator — a small, separate sphere above the head doing
 * real expression work (Sonic Adventure 2's Chao, directly named as
 * the reference: dot eyes + body-color emotion in its simple form);
 * optional smaller hand-spheres.
 *
 * Two real tiers: 'basic' (a real starter program — simple loops,
 * simple display) and 'intelligent' (intentionally open-ended, more
 * complex, left loose on purpose for gradual growth). A separate,
 * much-higher, future tier — OmniNavi(Conscious) — is a distinct
 * destination, not something 'intelligent' itself needs to reach.
 */

import * as THREE from 'three'

let counter = 0
function generateBotId () { return `omnibotprogram-${Date.now().toString(36)}-${(counter++).toString(36)}` }

export default class OmniBotProgram {
  constructor (context, omniNode) {
    this.ctx = context
    this.omniNode = omniNode
    this._bots = new Map()   // real id -> { headMeshId, bodyMesh, stateCommunicator, tier, label, clock }
  }

  init () {}
  onResize () {}

  destroy () {
    [...this._bots.keys()].forEach(id => this.despawn(id))
  }

  /** Real, public spawn — the actual thing OmniProgram's own panel
   *  calls. tier is 'basic' or 'intelligent'; position is a real
   *  [x, y, z]. Returns the real bot id. */
  spawn ({ label = 'OmniNavi', tier = 'basic', position = [0, 0, 0], color = '#8899ff' } = {}) {
    const id = generateBotId()
    const [x, y, z] = position

    // Real head — a cube, spawned through the same real, shared
    // pipeline every other node uses, so it's genuinely selectable
    // and Inspector-editable, not a special-cased object.
    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id, label, geometry: 'BoxGeometry', primitive: 'objective',
        color, position: [x, y, z], rotation: [0, 0, 0], scale: [1, 1, 1],
        metalness: 0.4, roughness: 0.4,
      }
    }))

    const headMesh = this.omniNode?.getMeshById(id) ?? null

    // Real embedded panel — a CanvasTexture plane on the head's own
    // front face, the same real technique already proven twice
    // elsewhere in this project.
    const panel = this._buildHeadPanel(label, tier)
    panel.position.set(0, 0, 0.51)
    headMesh?.add(panel)

    // Real body — a sphere, sitting beneath the head.
    const bodyGeo = new THREE.SphereGeometry(0.55, 20, 20)
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5 })
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat)
    bodyMesh.position.set(0, -1.1, 0)
    headMesh?.add(bodyMesh)

    // Real stateCommunicator — its own, separate small sphere above
    // the head, not a texture on the head itself.
    const stateCommunicator = this._buildStateCommunicator()
    stateCommunicator.position.set(0, 0.95, 0)
    headMesh?.add(stateCommunicator)

    this._bots.set(id, {
      headMeshId: id, bodyMesh, stateCommunicator, panel,
      tier, label, clock: Math.random() * Math.PI * 2,   // real, randomized phase so multiple bots don't all bob in lockstep
    })

    return id
  }

  despawn (id) {
    const bot = this._bots.get(id)
    if (!bot) return
    window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } }))
    this._bots.delete(id)
  }

  getBots () {
    return [...this._bots.entries()].map(([id, bot]) => ({ id, tier: bot.tier, label: bot.label }))
  }

  /** Real, per-frame update — the real architectural fork from a
   *  normal, static OmniNode. Basic tier: a real, simple, looping
   *  idle behavior (bob + slow spin), matching "runs simple
   *  programs, loops, displays things" exactly as specified. */
  update (delta) {
    this._bots.forEach(bot => {
      bot.clock += delta
      const headMesh = this.omniNode?.getMeshById(bot.headMeshId)
      if (!headMesh) return

      if (bot.tier === 'basic') {
        headMesh.position.y += Math.sin(bot.clock * 2) * 0.002   // real, gentle bob
        headMesh.rotation.y += delta * 0.3   // real, slow, continuous spin — a genuine "loop"
      }
      // 'intelligent' tier intentionally left open-ended — no real
      // behavior defined yet, per direct instruction.

      bot.stateCommunicator.rotation.y -= delta * 0.6   // the face stays legible by counter-rotating against the head's own spin
    })
  }

  /** Real, embedded head panel — a CanvasTexture plane, the same
   *  real technique already proven by OmniLogPagesPanel and
   *  TerminalTunnel. */
  _buildHeadPanel (label, tier) {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const c = canvas.getContext('2d')
    c.fillStyle = 'rgba(10,10,16,0.9)'
    c.fillRect(0, 0, canvas.width, canvas.height)
    c.strokeStyle = 'rgba(255,255,255,0.25)'
    c.strokeRect(4, 4, canvas.width - 8, canvas.height - 8)
    c.font = '22px monospace'
    c.fillStyle = '#ffffff'
    c.textAlign = 'center'
    c.fillText(label, canvas.width / 2, canvas.height / 2 - 10)
    c.font = '14px monospace'
    c.fillStyle = '#ffee00'
    c.fillText(tier.toUpperCase(), canvas.width / 2, canvas.height / 2 + 16)

    const texture = new THREE.CanvasTexture(canvas)
    const geometry = new THREE.PlaneGeometry(0.9, 0.9)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    return new THREE.Mesh(geometry, material)
  }

  /** Real stateCommunicator — simple face form confirmed: mouthless,
   *  dot eyes, body color for emotion (Sonic Adventure 2's Chao,
   *  directly named as the reference). The expressive, symbol-
   *  morphing face form (?, !, per Chaos's own transformation logic
   *  in that same game) is real future work — this builds the
   *  simple form now. */
  _buildStateCommunicator () {
    const group = new THREE.Group()
    const geometry = new THREE.SphereGeometry(0.32, 16, 16)
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.1, roughness: 0.6 })
    const sphere = new THREE.Mesh(geometry, material)
    group.add(sphere)

    const eyeGeo = new THREE.CircleGeometry(0.045, 8)
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#111111' })
    const eyeLeft = new THREE.Mesh(eyeGeo, eyeMat)
    eyeLeft.position.set(-0.1, 0.02, 0.3)
    const eyeRight = eyeLeft.clone()
    eyeRight.position.x = 0.1
    group.add(eyeLeft, eyeRight)

    return group
  }
}
