/**
 * systems/OmniNodeBehavior.js — ⟐OmniNodeBehavior
 *
 * The behaviour engine for OmniDraw(BehaviorNode). A node can carry
 *
 *     data.behavior = { type, params, enabled, targets: [nodeId…], role }
 *
 * and this system animates it. Two honest tiers (see
 * docs/omniproducts/OMNI_NODE_BEHAVIOR_DESIGN.md):
 *
 *   Tier A — real motion / rotation / scale on real scene nodes:
 *            Orbit Drift Anchor Align Traverse Oscillate · Attract Repel
 *            Follow Follower Leader Mirror Bind · Delay Pulse Sync Schedule
 *            Cascade · Coalesce Diffuse Compete Cooperate Adapt Emerge
 *   Tier B — a VISUAL SIGNAL METAPHOR. The project has no signal/data layer
 *            yet, so Transform Amplify Dampen Filter Encode Decode Store
 *            Release Gate Mediate animate "beads" travelling along tethers.
 *            They compute nothing; they illustrate the idea.
 *
 * Why this is its own system (and not code inside OmniNode / NodeLoader):
 * the project has TWO node registries — OmniNode._nodes and NodeLoader's
 * _registry (Create-System formations). A feature wired into one silently
 * does nothing on the other (the Auto-Rotate bug). This engine therefore
 * never reads either registry directly. It learns nodes from the events
 * BOTH already dispatch (omni:node-created / omni:node-restored with
 * { node, mesh }, omni:node-deleted, omni:nodes-updated) plus a scene scan
 * for userData.nodeId (both registries set it), and it persists through the
 * SAME event the Inspector's Auto-Rotate section uses
 * (omni:node-rotation-automation-set { id, ...patch }), which BOTH
 * registries already merge into their saved data.
 *
 * Adding a behaviour = one row in BEHAVIOR_TABLE (defaults + schema + an
 * update function). The parameter forms (Inspector, OmniDraw(BehaviorNode))
 * are generated from the table.
 *
 * Events consumed (window):
 *   omni:node-behavior-set          { nodeId, behavior|null }
 *   omni:node-behavior-master-set   { enabled }
 *   omni:node-created / -restored / -deleted, omni:nodes-updated,
 *   omni:reality-grabbed, omni:scene-clear-request
 * Events dispatched (window):
 *   omni:node-rotation-automation-set { id, behavior }   (persistence)
 *   omni:node-behavior-changed        { nodeId, behavior }
 *   omni:node-behavior-master-changed { enabled }
 *   omni:node-behavior-pulse          { nodeId, type, count, … }
 *   omni:node-behavior-cascade-hit    { nodeId, hostId, index, wave }
 *   omni:node-behavior-event          { nodeId, hostId, type, kind, … }
 *   omni:node-behavior-capped / -error
 *
 * Rules: moved nodes keep their saved transform as the REST pose (OmniNode
 * saves mesh.userData.restPosition while a behaviour has the node); on stop
 * the rest pose is restored unless the behaviour's "restore" param is off.
 * A node already moved by another behaviour this frame is skipped (first
 * wins). Grabbed / hidden / userData.behaviorLocked nodes are never moved.
 * Positions are mesh.position (top-level scene coordinates).
 *
 * Module contract: constructor(context) / init / update(delta) / destroy / onResize.
 */

import * as THREE from 'three'

// ── Limits & constants ───────────────────────────────────────────────────────

export const MAX_ACTIVE   = 64     // simultaneously running behaviours
export const MAX_BEADS    = 256    // Tier-B beads across the whole scene
export const MAX_SEGS     = 12000  // line segments (rings/tethers/outlines) per frame
export const MAX_TARGETS  = 32
const MAX_SUB  = MAX_TARGETS + 1
const DT_MAX   = 0.05
const WARMUP   = 1.0               // s after a node is created (entry scale-in) before its behaviour starts
const STORE_MASTER = 'omni:behavior-master-v1'
const TAU = Math.PI * 2
const DEG = Math.PI / 180

export const BEHAVIOR_CLASSES = ['Mechanic', 'Relational', 'Transformational', 'Temporal', 'Emergent']
// Mid-saturation so they read on white AND black; lines/beads also get a dark outline.
export const CLASS_COLORS = {
  Mechanic: 0xe08a2e, Relational: 0xd44f8c, Transformational: 0x2fa39a, Temporal: 0x7a5bd1, Emergent: 0x4aa84a,
}
const BEAD_HEX   = [0xe0555a, 0xe0a030, 0x3fae6b, 0x4a86d8]
const BEAD_NAMES = ['red', 'amber', 'green', 'blue']
const OUTLINE_HEX = 0x14141c

const COS = new Float32Array(32), SIN = new Float32Array(32)
for (let i = 0; i < 32; i++) { COS[i] = Math.cos(i / 32 * TAU); SIN[i] = Math.sin(i / 32 * TAU) }

// scratch (no per-frame allocation in hot paths)
const _a = new THREE.Vector3(), _s = new THREE.Vector3(), _m4 = new THREE.Matrix4()
const _q1 = new THREE.Quaternion(), _qI = new THREE.Quaternion()
const _UP = new THREE.Vector3(0, 1, 0)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const ease  = (b) => b * b * (3 - 2 * b)
const hexR = (h) => ((h >> 16) & 255) / 255
const hexG = (h) => ((h >> 8) & 255) / 255
const hexB = (h) => (h & 255) / 255

function hash32 (str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry (seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ── Table helpers ────────────────────────────────────────────────────────────

const N = (key, label, min, max, step) => ({ key, label, type: 'number', min, max, step })
const S = (key, label, options) => ({ key, label, type: 'select', options })
const Bo = (key, label) => ({ key, label, type: 'bool' })
const COMMON_SCHEMA = [Bo('restore', 'Restore on stop')]
const COMMON_DEFAULTS = { restore: true }
const SIGNAL_SCHEMA = [N('emitEvery', 'Emit every (s)', 0.2, 5, 0.1), N('speed', 'Bead speed', 0.5, 10, 0.1)]
const SIGNAL_DEFAULTS = { emitEvery: 0.9, speed: 3 }

// ═════════════════════════════════════════════════════════════════════════════
//  BEHAVIOR_TABLE — name → { cls, tier, defaults, schema, init?, update, … }
//  Row fields: cls, tier 'A'|'B', needs ('self'|'target'|'targets'; UI hint),
//  hint (UI text), field (acts on nearby nodes when there are no targets),
//  moves (false = never moves nodes → no "restore" param), role,
//  init(st,E) once the node has settled, update(st,dt,E) per frame,
//  arrive(st,bead,E) [Tier B]
// ═════════════════════════════════════════════════════════════════════════════

const AXES = {   // [u, v, normal]
  x: [0, 1, 0, 0, 0, 1, 1, 0, 0],
  y: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  z: [1, 0, 0, 0, 1, 0, 0, 0, 1],
}

function tri (x) { return (2 / Math.PI) * Math.asin(Math.sin(x)) }
function sqr (x) { return clamp(Math.sin(x) * 6, -1, 1) }

/** The rest record of an acquired mesh ({ p, q, s }). */
const R = (mesh) => mesh.userData.__brest

/** Smooth pseudo-noise in [-1,1] (two sines per axis, seeded phases in st.ph). */
function noise (st, k, t) {
  const p = st.ph
  return (Math.sin(t * p[k * 4] + p[k * 4 + 1]) + 0.5 * Math.sin(t * p[k * 4 + 2] * 2.3 + p[k * 4 + 3])) / 1.5
}

/** Damped spring of subject slot i (velocity in st.v) toward a point. */
function spring (st, i, mesh, tx, ty, tz, k, dt) {
  const v = st.v, o = i * 3, p = mesh.position
  const c = 1.8 * Math.sqrt(k)
  v[o]     += (k * (tx - p.x) - c * v[o])     * dt
  v[o + 1] += (k * (ty - p.y) - c * v[o + 1]) * dt
  v[o + 2] += (k * (tz - p.z) - c * v[o + 2]) * dt
  p.x += v[o] * dt; p.y += v[o + 1] * dt; p.z += v[o + 2] * dt
}

/** Same spring with velocity feed-forward (tvx..): tracks a moving target without steady-state lag. */
function springV (st, i, mesh, tx, ty, tz, tvx, tvy, tvz, k, dt) {
  const v = st.v, o = i * 3, p = mesh.position
  const c = 1.8 * Math.sqrt(k)
  v[o]     += (k * (tx - p.x) + c * (tvx - v[o]))     * dt
  v[o + 1] += (k * (ty - p.y) + c * (tvy - v[o + 1])) * dt
  v[o + 2] += (k * (tz - p.z) + c * (tvz - v[o + 2])) * dt
  p.x += v[o] * dt; p.y += v[o + 1] * dt; p.z += v[o + 2] * dt
}

/** Move a mesh toward a point at most speed*dt; returns the remaining distance. */
function stepToward (mesh, tx, ty, tz, speed, dt) {
  const p = mesh.position
  const dx = tx - p.x, dy = ty - p.y, dz = tz - p.z
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (d < 1e-6) return 0
  const step = Math.min(d, speed * dt)
  const s = step / d
  p.x += dx * s; p.y += dy * s; p.z += dz * s
  return d - step
}

const BEHAVIOR_TABLE = {}
function def (name, cls, tier, row) {
  BEHAVIOR_TABLE[name] = { name, cls, tier, needs: 'self', hint: '', moves: tier === 'A', ...row }
}

// ── Tier A · Mechanic ────────────────────────────────────────────────────────

def('Orbit', 'Mechanic', 'A', {
  needs: 'target', hint: 'This node revolves around the first target (or around its own rest spot with no target).',
  defaults: { radius: 3, speed: 1, axis: 'y', tilt: 0, phase: 0 },
  schema: [N('radius', 'Radius', 0.2, 30, 0.1), N('speed', 'Speed (rad/s)', -6, 6, 0.05), S('axis', 'Axis', ['x', 'y', 'z']),
           N('tilt', 'Tilt (deg)', -90, 90, 1), N('phase', 'Phase (deg)', 0, 360, 1)],
  init (st) { st.ang = st.params.phase * DEG },
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (!E.move(st, m)) return
    const c = st.nV > 0 ? st.V[0].mesh.position : R(m).p
    st.ang += p.speed * dt
    const ax = AXES[p.axis] ?? AXES.y
    const ct = Math.cos(p.tilt * DEG), sn = Math.sin(p.tilt * DEG)
    const vx = ax[3] * ct + ax[6] * sn, vy = ax[4] * ct + ax[7] * sn, vz = ax[5] * ct + ax[8] * sn
    const cs = Math.cos(st.ang) * p.radius, sv = Math.sin(st.ang) * p.radius
    E.place(st, m, c.x + ax[0] * cs + vx * sv, c.y + ax[1] * cs + vy * sv, c.z + ax[2] * cs + vz * sv)
  },
})

def('Drift', 'Mechanic', 'A', {
  hint: 'This node wanders with smooth noise around its rest spot.',
  defaults: { range: 1.5, speed: 0.4, yScale: 0.5 },
  schema: [N('range', 'Range', 0.1, 20, 0.1), N('speed', 'Speed', 0.05, 3, 0.05), N('yScale', 'Vertical share', 0, 1, 0.05)],
  init (st) { st.ph = new Float32Array(12); for (let i = 0; i < 12; i++) st.ph[i] = st.rng() * TAU },
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (!E.move(st, m)) return
    const rp = R(m).p, t = st.t * p.speed
    E.place(st, m, rp.x + p.range * noise(st, 0, t), rp.y + p.range * p.yScale * noise(st, 1, t), rp.z + p.range * noise(st, 2, t))
  },
})

def('Anchor', 'Mechanic', 'A', {
  needs: 'target', hint: 'This node holds an offset from the first target (the frame), on a spring. No target: offset from its rest spot.',
  defaults: { ox: 2, oy: 1, oz: 0, stiffness: 40, inherit: false },
  schema: [N('ox', 'Offset X', -20, 20, 0.1), N('oy', 'Offset Y', -20, 20, 0.1), N('oz', 'Offset Z', -20, 20, 0.1),
           N('stiffness', 'Spring', 2, 120, 1), Bo('inherit', 'Rotate offset with frame')],
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (!E.move(st, m)) return
    const f = st.nV > 0 ? st.V[0].mesh : null
    _a.set(p.ox, p.oy, p.oz)
    if (f && p.inherit) _a.applyQuaternion(f.quaternion)
    const b = f ? f.position : R(m).p
    spring(st, 0, m, b.x + _a.x, b.y + _a.y, b.z + _a.z, p.stiffness, dt)
  },
})

def('Align', 'Mechanic', 'A', {
  needs: 'target', hint: 'This node turns to match (or face) the first target. Needs a target.',
  defaults: { mode: 'match', rate: 4 },
  schema: [S('mode', 'Mode', ['match', 'face']), N('rate', 'Turn rate', 0.5, 20, 0.5)],
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (st.nV === 0 || !E.move(st, m)) return
    const t = st.V[0].mesh
    if (p.mode === 'face') {
      _m4.lookAt(t.position, m.position, _UP)   // Object3D.lookAt convention for non-cameras
      _q1.setFromRotationMatrix(_m4)
    } else _q1.copy(t.quaternion)
    m.quaternion.slerp(_q1, 1 - Math.exp(-p.rate * dt))
  },
})

def('Traverse', 'Mechanic', 'A', {
  needs: 'targets', hint: 'This node travels a path through the targets in order (no targets: a small square loop).',
  defaults: { speed: 2, mode: 'loop', size: 3, showPath: true },
  schema: [N('speed', 'Speed (u/s)', 0.1, 20, 0.1), S('mode', 'Mode', ['loop', 'pingpong', 'once']), N('size', 'Loop size', 0.5, 20, 0.1), Bo('showPath', 'Draw path')],
  init (st) { st.wp = new Float32Array(MAX_SUB * 3 + 3); st.s = 0; st.dir = 1; st.n = 0 },
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (!E.move(st, m)) return
    const w = st.wp; let n = 0
    const rs = R(m).p
    if (st.nV === 0) {
      const z = p.size
      w[0] = rs.x + z; w[1] = rs.y; w[2] = rs.z + z
      w[3] = rs.x - z; w[4] = rs.y; w[5] = rs.z + z
      w[6] = rs.x - z; w[7] = rs.y; w[8] = rs.z - z
      w[9] = rs.x + z; w[10] = rs.y; w[11] = rs.z - z
      n = 4
    } else {
      if (st.nV === 1) { w[0] = rs.x; w[1] = rs.y; w[2] = rs.z; n = 1 }
      for (let i = 0; i < st.nV; i++) { const q = st.V[i].mesh.position; w[n * 3] = q.x; w[n * 3 + 1] = q.y; w[n * 3 + 2] = q.z; n++ }
    }
    st.n = n
    const closed = p.mode === 'loop' && n > 2
    let L = 0
    for (let i = 0; i < n - 1; i++) L += Math.hypot(w[i * 3 + 3] - w[i * 3], w[i * 3 + 4] - w[i * 3 + 1], w[i * 3 + 5] - w[i * 3 + 2])
    const Lopen = L
    if (closed) L += Math.hypot(w[0] - w[n * 3 - 3], w[1] - w[n * 3 - 2], w[2] - w[n * 3 - 1])
    if (L < 1e-6) return
    st.s += st.dir * p.speed * dt
    if (p.mode === 'pingpong') {
      if (st.s > Lopen) { st.s = Lopen - (st.s - Lopen); st.dir = -1 }
      if (st.s < 0) { st.s = -st.s; st.dir = 1 }
    } else if (p.mode === 'once') st.s = clamp(st.s, 0, Lopen)
    else { st.s %= L; if (st.s < 0) st.s += L }
    let rem = st.s, px = w[0], py = w[1], pz = w[2]
    const segs = closed ? n : n - 1
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n
      const ax = w[i * 3], ay = w[i * 3 + 1], az = w[i * 3 + 2], bx = w[j * 3], by = w[j * 3 + 1], bz = w[j * 3 + 2]
      const sl = Math.hypot(bx - ax, by - ay, bz - az)
      if (rem <= sl || i === segs - 1) {
        const f = sl > 1e-9 ? clamp(rem / sl, 0, 1) : 0
        px = ax + (bx - ax) * f; py = ay + (by - ay) * f; pz = az + (bz - az) * f
        break
      }
      rem -= sl
    }
    if (p.showPath) for (let i = 0; i < segs; i++) { const j = (i + 1) % n; E.line(w[i * 3], w[i * 3 + 1], w[i * 3 + 2], w[j * 3], w[j * 3 + 1], w[j * 3 + 2], st.hex, 0.45) }
    E.place(st, m, px, py, pz)
  },
})

def('Oscillate', 'Mechanic', 'A', {
  hint: 'This node swings back and forth about its rest spot.',
  defaults: { axis: 'y', amplitude: 1.5, frequency: 0.5, wave: 'sine', phase: 0 },
  schema: [S('axis', 'Axis', ['x', 'y', 'z', 'diagonal']), N('amplitude', 'Amplitude', 0.05, 20, 0.05), N('frequency', 'Frequency (Hz)', 0.05, 5, 0.05),
           S('wave', 'Wave', ['sine', 'triangle', 'square']), N('phase', 'Phase (deg)', 0, 360, 1)],
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (!E.move(st, m)) return
    const x = TAU * p.frequency * st.t + p.phase * DEG
    const w = p.wave === 'triangle' ? tri(x) : p.wave === 'square' ? sqr(x) : Math.sin(x)
    const d = p.amplitude * w, rs = R(m).p
    if (p.axis === 'x') E.place(st, m, rs.x + d, rs.y, rs.z)
    else if (p.axis === 'z') E.place(st, m, rs.x, rs.y, rs.z + d)
    else if (p.axis === 'diagonal') { const k = d * 0.57735; E.place(st, m, rs.x + k, rs.y + k, rs.z + k) }
    else E.place(st, m, rs.x, rs.y + d, rs.z)
  },
})

// ── Tier A · Relational ──────────────────────────────────────────────────────

function attractRepel (sign) {
  return function (st, dt, E) {
    const h = st.host.mesh.position, p = st.params
    const soft2 = p.softening * p.softening, drag = Math.exp(-p.drag * dt), maxS = p.maxSpeed
    for (let i = 0; i < st.nS; i++) {
      const m = st.S[i].mesh
      if (!E.move(st, m)) continue
      const o = (i + 1) * 3, v = st.v, q = m.position
      const dx = h.x - q.x, dy = h.y - q.y, dz = h.z - q.z
      const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2)
      if (sign > 0 && r < p.minDist) {
        // stop distance acts as a soft collision: ease the node back out to minDist
        if (r > 1e-5) { const k = -p.strength * (p.minDist - r) / r; v[o] += dx * k * dt; v[o + 1] += dy * k * dt; v[o + 2] += dz * k * dt }
        else v[o] += p.strength * 0.1 * dt
      } else if (r < p.radius) {
        const w = Math.pow(1 - r / p.radius, p.falloff)
        const a = sign * p.strength * w / Math.sqrt(r2 + soft2)
        if (r > 1e-5) { v[o] += dx * a * dt; v[o + 1] += dy * a * dt; v[o + 2] += dz * a * dt }
        else v[o] -= sign * Math.abs(a) * dt * 0.3     // coincident with the source: nudge along -x so repel can separate
      }
      v[o] *= drag; v[o + 1] *= drag; v[o + 2] *= drag
      const sp = Math.sqrt(v[o] * v[o] + v[o + 1] * v[o + 1] + v[o + 2] * v[o + 2])
      if (sp > maxS) { const k = maxS / sp; v[o] *= k; v[o + 1] *= k; v[o + 2] *= k }
      q.x += v[o] * dt; q.y += v[o + 1] * dt; q.z += v[o + 2] * dt
      // bounds: never leave a sphere of `bound` around the source
      const ex = q.x - h.x, ey = q.y - h.y, ez = q.z - h.z
      const e = Math.sqrt(ex * ex + ey * ey + ez * ez)
      if (e > p.bound) { const k = p.bound / e; q.x = h.x + ex * k; q.y = h.y + ey * k; q.z = h.z + ez * k; v[o] *= 0.2; v[o + 1] *= 0.2; v[o + 2] *= 0.2 }
      E.line(h.x, h.y, h.z, q.x, q.y, q.z, st.hex, 0.1 + 0.25 * (1 - Math.min(1, r / p.radius)))
    }
  }
}
const FIELD_SCHEMA = [N('radius', 'Influence radius', 1, 60, 0.5), N('strength', 'Strength', 0.5, 200, 0.5), N('falloff', 'Falloff power', 0.5, 5, 0.1),
  N('softening', 'Softening', 0.1, 5, 0.1), N('minDist', 'Stop distance', 0, 10, 0.1), N('maxSpeed', 'Max speed', 0.5, 30, 0.5),
  N('drag', 'Drag', 0, 8, 0.1), N('bound', 'Bound radius', 2, 100, 1)]
const FIELD_DEFAULTS = { radius: 12, strength: 30, falloff: 2, softening: 0.6, minDist: 0.8, maxSpeed: 5, drag: 1.5, bound: 20 }

def('Attract', 'Relational', 'A', {
  needs: 'targets', field: true, hint: 'Pulls the targets toward this node. No targets: pulls nearby nodes.',
  defaults: FIELD_DEFAULTS, schema: FIELD_SCHEMA, update: attractRepel(+1),
})
def('Repel', 'Relational', 'A', {
  needs: 'targets', field: true, hint: 'Pushes the targets away from this node (clamped by max speed and bound). No targets: pushes nearby nodes.',
  defaults: { ...FIELD_DEFAULTS, minDist: 0 }, schema: FIELD_SCHEMA, update: attractRepel(-1),
})

function followUpdate (st, dt, E) {
  const m = st.host.mesh, p = st.params
  if (st.nV === 0 || !E.move(st, m)) return
  const t = st.V[0].mesh.position, q = m.position, v = st.v
  let dx = q.x - t.x, dy = q.y - t.y, dz = q.z - t.z
  let r = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (r < 1e-4) { dx = 1; dy = 0; dz = 0; r = 1 }
  const gx = t.x + dx / r * p.followDistance, gy = t.y + dy / r * p.followDistance, gz = t.z + dz / r * p.followDistance
  const ex = gx - q.x, ey = gy - q.y, ez = gz - q.z
  const d = Math.sqrt(ex * ex + ey * ey + ez * ez)
  let vx = 0, vy = 0, vz = 0
  if (d > 1e-5) { const s = p.maxSpeed * Math.min(1, d / p.arrive) / d; vx = ex * s; vy = ey * s; vz = ez * s }
  const k = Math.min(1, p.accel * dt)
  v[0] += (vx - v[0]) * k; v[1] += (vy - v[1]) * k; v[2] += (vz - v[2]) * k
  q.x += v[0] * dt; q.y += v[1] * dt; q.z += v[2] * dt
  E.line(q.x, q.y, q.z, t.x, t.y, t.z, st.hex, 0.3)
}
const FOLLOW_SCHEMA = [N('followDistance', 'Follow distance', 0.3, 30, 0.1), N('maxSpeed', 'Max speed', 0.5, 30, 0.5), N('arrive', 'Arrive radius', 0.5, 20, 0.5), N('accel', 'Responsiveness', 0.5, 20, 0.5)]
const FOLLOW_DEFAULTS = { followDistance: 2.5, maxSpeed: 6, arrive: 3, accel: 4 }
def('Follow', 'Relational', 'A', { needs: 'target', hint: 'This node pursues the first target and settles at the follow distance.', defaults: FOLLOW_DEFAULTS, schema: FOLLOW_SCHEMA, update: followUpdate })
def('Follower', 'Relational', 'A', { needs: 'target', role: 'Follower', hint: 'Declared follower: pursues its leader (the first target) — sugar over Follow.', defaults: FOLLOW_DEFAULTS, schema: FOLLOW_SCHEMA, update: followUpdate })

def('Leader', 'Relational', 'A', {
  needs: 'targets', role: 'Leader', hint: 'This node wanders a smooth path; the targets are its followers and keep formation behind it.',
  defaults: { range: 4, speed: 0.5, followDistance: 1.8, formation: 'vee', stiffness: 30 },
  schema: [N('range', 'Wander range', 0.5, 30, 0.5), N('speed', 'Wander speed', 0.05, 3, 0.05), N('followDistance', 'Formation spacing', 0.3, 10, 0.1),
           S('formation', 'Formation', ['line', 'vee', 'ring']), N('stiffness', 'Follower spring', 4, 120, 1)],
  init (st) { st.hv = new THREE.Vector3(); st.dir = new THREE.Vector3(0, 0, 1); st.last = new THREE.Vector3(); st.hasLast = false; st.slot = new Float32Array(MAX_SUB * 3); st.slotPrev = new Float32Array(MAX_SUB * 3); st.slotOk = new Uint8Array(MAX_SUB) },
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (E.move(st, m)) {
      const t = st.t * p.speed, rp = R(m).p
      E.place(st, m, rp.x + p.range * Math.sin(t), rp.y + p.range * 0.25 * Math.sin(0.61 * t + 0.4), rp.z + p.range * 0.8 * Math.sin(1.37 * t + 1.3))
    }
    const h = m.position
    if (st.hasLast) {
      st.hv.set((h.x - st.last.x) / dt, (h.y - st.last.y) / dt, (h.z - st.last.z) / dt)
      const sp = st.hv.length()
      if (sp > 1e-3) st.dir.copy(st.hv).multiplyScalar(1 / sp)
    }
    st.last.copy(h); st.hasLast = true
    const d = st.dir, dd = p.followDistance
    for (let i = 0; i < st.nV; i++) {
      const f = st.V[i].mesh
      if (!E.move(st, f)) continue
      let tx, ty, tz
      if (p.formation === 'ring') {
        const a = i / st.nV * TAU + st.t * 0.4
        tx = h.x + Math.cos(a) * dd * 1.5; ty = h.y; tz = h.z + Math.sin(a) * dd * 1.5
      } else if (p.formation === 'vee') {
        const rank = Math.floor(i / 2) + 1, side = (i % 2) * 2 - 1
        const l = Math.hypot(d.x, d.z) || 1, px = d.z / l, pz = -d.x / l
        tx = h.x - d.x * dd * rank + px * side * dd * 0.8 * rank; ty = h.y - d.y * dd * rank; tz = h.z - d.z * dd * rank + pz * side * dd * 0.8 * rank
      } else { tx = h.x - d.x * dd * (i + 1); ty = h.y - d.y * dd * (i + 1); tz = h.z - d.z * dd * (i + 1) }
      const o = i * 3, sl = st.slot, sp = st.slotPrev
      const svx = st.slotOk[i] ? (tx - sp[o]) / dt : st.hv.x, svy = st.slotOk[i] ? (ty - sp[o + 1]) / dt : st.hv.y, svz = st.slotOk[i] ? (tz - sp[o + 2]) / dt : st.hv.z   // slot velocity feed-forward
      sl[o] = tx; sl[o + 1] = ty; sl[o + 2] = tz; sp[o] = tx; sp[o + 1] = ty; sp[o + 2] = tz; st.slotOk[i] = 1
      springV(st, i + 1, f, tx, ty, tz, svx, svy, svz, p.stiffness, dt)
      E.line(h.x, h.y, h.z, f.position.x, f.position.y, f.position.z, st.hex, 0.25)
    }
  },
})

def('Mirror', 'Relational', 'A', {
  needs: 'target', hint: 'This node copies the first target across a plane (position, rotation). Inverted = also conjugates the rotation.',
  defaults: { plane: 'x', planeOffset: 0, ox: 0, oy: 0, oz: 0, invert: false, copyScale: false },
  schema: [S('plane', 'Plane normal', ['x', 'y', 'z']), N('planeOffset', 'Plane offset', -30, 30, 0.1), N('ox', 'Offset X', -20, 20, 0.1), N('oy', 'Offset Y', -20, 20, 0.1), N('oz', 'Offset Z', -20, 20, 0.1),
           Bo('invert', 'Inverted'), Bo('copyScale', 'Copy scale')],
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (st.nV === 0 || !E.move(st, m)) return
    const t = st.V[0].mesh, rp = R(m).p
    let x = t.position.x, y = t.position.y, z = t.position.z
    const q = t.quaternion
    let qx = q.x, qy = q.y, qz = q.z
    if (p.plane === 'x') { x = 2 * (rp.x + p.planeOffset) - x; qy = -qy; qz = -qz }
    else if (p.plane === 'y') { y = 2 * (rp.y + p.planeOffset) - y; qx = -qx; qz = -qz }
    else { z = 2 * (rp.z + p.planeOffset) - z; qx = -qx; qy = -qy }
    if (p.invert) { qx = -qx; qy = -qy; qz = -qz }
    E.place(st, m, x + p.ox, y + p.oy, z + p.oz)
    m.quaternion.set(qx, qy, qz, q.w)
    if (p.copyScale) m.scale.copy(t.scale)
  },
})

def('Bind', 'Relational', 'A', {
  needs: 'target', hint: 'A persistent spring tether (drawn as a line) between this node and the first target.',
  defaults: { length: 3, stiffness: 30, damping: 3, mutual: false },
  schema: [N('length', 'Rest length', 0.3, 30, 0.1), N('stiffness', 'Stiffness', 1, 80, 1), N('damping', 'Damping', 0, 10, 0.1), Bo('mutual', 'Pull the target too')],
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (st.nV === 0) return
    const t = st.V[0].mesh, q = m.position, tp = t.position, v = st.v
    const dx = tp.x - q.x, dy = tp.y - q.y, dz = tp.z - q.z
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const tens = clamp(Math.abs(r - p.length) / Math.max(p.length, 0.5), 0, 1)
    E.line(q.x, q.y, q.z, tp.x, tp.y, tp.z, st.hex, 0.55 + 0.45 * tens)
    if (r < 1e-5) return
    const f = Math.min(p.stiffness * (r - p.length), 400) / r
    const damp = Math.exp(-p.damping * dt)
    if (E.move(st, m)) {
      v[0] = (v[0] + dx * f * dt) * damp; v[1] = (v[1] + dy * f * dt) * damp; v[2] = (v[2] + dz * f * dt) * damp
      q.x += v[0] * dt; q.y += v[1] * dt; q.z += v[2] * dt
    }
    if (p.mutual && E.move(st, t)) {
      v[3] = (v[3] - dx * f * dt) * damp; v[4] = (v[4] - dy * f * dt) * damp; v[5] = (v[5] - dz * f * dt) * damp
      tp.x += v[3] * dt; tp.y += v[4] * dt; tp.z += v[5] * dt
    }
  },
})

// ── Tier A · Temporal ────────────────────────────────────────────────────────

const DELAY_N = 720
def('Delay', 'Temporal', 'A', {
  needs: 'target', hint: 'Echo: this node replays the first target\'s motion shifted forward in time (ring buffer).',
  defaults: { delay: 1, ox: 1.5, oy: 0, oz: 0 },
  schema: [N('delay', 'Delay (s)', 0.05, 8, 0.05), N('ox', 'Offset X', -20, 20, 0.1), N('oy', 'Offset Y', -20, 20, 0.1), N('oz', 'Offset Z', -20, 20, 0.1)],
  init (st) { st.buf = new Float32Array(DELAY_N * 4); st.head = 0; st.count = 0; st.lastS = -1 },
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    if (st.nV === 0) return
    const t = st.V[0].mesh.position, b = st.buf
    if (st.count === 0 || st.t - st.lastS >= 1 / 60 - 1e-4) {
      const o = st.head * 4
      b[o] = st.t; b[o + 1] = t.x; b[o + 2] = t.y; b[o + 3] = t.z
      st.head = (st.head + 1) % DELAY_N; if (st.count < DELAY_N) st.count++
      st.lastS = st.t
    }
    if (!E.move(st, m)) return
    const tq = st.t - p.delay
    let i1 = (st.head - 1 + DELAY_N) % DELAY_N
    let x = 0, y = 0, z = 0, found = false
    for (let k = 0; k < st.count - 1; k++) {
      const i0 = (i1 - 1 + DELAY_N) % DELAY_N
      if (b[i0 * 4] <= tq) {
        const t0 = b[i0 * 4], t1 = b[i1 * 4], f = t1 > t0 ? clamp((tq - t0) / (t1 - t0), 0, 1) : 0
        x = b[i0 * 4 + 1] + (b[i1 * 4 + 1] - b[i0 * 4 + 1]) * f; y = b[i0 * 4 + 2] + (b[i1 * 4 + 2] - b[i0 * 4 + 2]) * f; z = b[i0 * 4 + 3] + (b[i1 * 4 + 3] - b[i0 * 4 + 3]) * f
        found = true; break
      }
      i1 = i0
    }
    if (!found) { const o = ((st.head - st.count + DELAY_N) % DELAY_N) * 4; x = b[o + 1]; y = b[o + 2]; z = b[o + 3] }   // history shorter than the delay: hold the oldest sample
    E.place(st, m, x + p.ox, y + p.oy, z + p.oz)
    E.line(t.x, t.y, t.z, m.position.x, m.position.y, m.position.z, st.hex, 0.25)
  },
})

function emitRing (st) {   // start a ring in the first free slot of st.rings (age array, -1 = free)
  const a = st.rings
  for (let i = 0; i < a.length; i++) if (a[i] < 0) { a[i] = 0; return }
}
function drawRings (st, dt, E, speed, maxR, cx, cy, cz) {
  const a = st.rings
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0) continue
    a[i] += dt
    const r = a[i] * speed
    if (r >= maxR) { a[i] = -1; continue }
    E.ring(cx, cy, cz, r, st.hex, 0.25 + 0.75 * (1 - r / maxR))
  }
}

def('Pulse', 'Temporal', 'A', {
  moves: false, hint: 'Emits a visible ring pulse on a timer and an omni:node-behavior-pulse event.',
  defaults: { interval: 1.5, speed: 3, maxRadius: 5 },
  schema: [N('interval', 'Interval (s)', 0.2, 20, 0.1), N('speed', 'Ring speed', 0.5, 20, 0.5), N('maxRadius', 'Max radius', 1, 30, 0.5)],
  init (st) { st.rings = new Float32Array(8).fill(-1); st.timer = 0; st.count = 0 },
  update (st, dt, E) {
    const p = st.params, h = st.host.mesh.position
    st.timer += dt
    while (st.timer >= p.interval) {
      st.timer -= p.interval; st.count++
      emitRing(st); E.flash(st.host.mesh, st.hex, 0.8)
      E.emit('omni:node-behavior-pulse', { nodeId: st.id, type: 'Pulse', count: st.count })
    }
    drawRings(st, dt, E, p.speed, p.maxRadius, h.x, h.y, h.z)
  },
})

def('Schedule', 'Temporal', 'A', {
  moves: false, hint: 'Fires an action on an interval; a countdown arc shows the time left.',
  defaults: { interval: 3, action: 'pulse' },
  schema: [N('interval', 'Interval (s)', 0.2, 60, 0.1), S('action', 'Action', ['pulse', 'flash', 'event'])],
  init (st) { st.rings = new Float32Array(4).fill(-1); st.timer = 0; st.count = 0; st.remaining = st.params.interval },
  update (st, dt, E) {
    const p = st.params, m = st.host.mesh, h = m.position
    st.timer += dt
    while (st.timer >= p.interval) {
      st.timer -= p.interval; st.count++
      if (p.action === 'pulse') emitRing(st)
      if (p.action !== 'event') E.flash(m, st.hex, 1)
      E.emit('omni:node-behavior-pulse', { nodeId: st.id, type: 'Schedule', action: p.action, count: st.count })
    }
    st.remaining = p.interval - st.timer
    E.arc(h.x, h.y, h.z, E.markerR(m) * 1.45, st.remaining / p.interval, st.hex, 1)
    drawRings(st, dt, E, 3, 4, h.x, h.y, h.z)
  },
})

def('Cascade', 'Temporal', 'A', {
  moves: false, needs: 'targets', hint: 'A pulse hops this node → target 1 → target 2 … in order; each flashes and re-emits.',
  defaults: { stepDelay: 0.5, gap: 1.5, loop: true },
  schema: [N('stepDelay', 'Step delay (s)', 0.05, 5, 0.05), N('gap', 'Gap between waves (s)', 0, 10, 0.1), Bo('loop', 'Loop')],
  init (st) { st.wt = 0; st.hit = 0; st.wave = 0; st.done = false; st.ringAge = new Float32Array(MAX_SUB).fill(-1); st.chain = new Array(MAX_SUB).fill(null) },
  update (st, dt, E) {
    const p = st.params
    let n = 0
    st.chain[n++] = st.host
    for (let i = 0; i < st.nV; i++) st.chain[n++] = st.V[i]
    if (!st.done) st.wt += dt
    while (!st.done && st.hit < n && st.wt >= st.hit * p.stepDelay) {
      const e = st.chain[st.hit]
      E.flash(e.mesh, st.hex, 1); st.ringAge[st.hit] = 0
      E.emit('omni:node-behavior-cascade-hit', { nodeId: e.id, hostId: st.id, index: st.hit, wave: st.wave })
      st.hit++
    }
    if (!st.done && st.hit >= n && st.wt >= (n - 1) * p.stepDelay + p.gap) {
      if (p.loop) { st.wt = 0; st.hit = 0; st.wave++ } else st.done = true
    }
    for (let i = 0; i < n; i++) {
      const q = st.chain[i].mesh.position
      if (i > 0) {
        const a = st.chain[i - 1].mesh.position
        const prog = clamp((st.wt - (i - 1) * p.stepDelay) / p.stepDelay, 0, 1)
        E.line(a.x, a.y, a.z, q.x, q.y, q.z, st.hex, 0.3)
        if (prog > 0 && prog < 1) E.line(a.x, a.y, a.z, a.x + (q.x - a.x) * prog, a.y + (q.y - a.y) * prog, a.z + (q.z - a.z) * prog, st.hex, 1)
      }
      if (st.ringAge[i] >= 0) {
        st.ringAge[i] += dt
        const r = st.ringAge[i] * 3
        if (r > 2.5) st.ringAge[i] = -1
        else E.ring(q.x, q.y, q.z, r, st.hex, 1 - r / 2.5)
      }
    }
  },
})

def('Sync', 'Temporal', 'A', {
  needs: 'targets', hint: 'This node and the targets bob as oscillators and phase-lock (Kuramoto coupling).',
  defaults: { frequency: 0.6, coupling: 2.5, amplitude: 0.6, detune: 0.2 },
  schema: [N('frequency', 'Frequency (Hz)', 0.1, 3, 0.05), N('coupling', 'Coupling', 0, 10, 0.1), N('amplitude', 'Bob amplitude', 0.05, 5, 0.05), N('detune', 'Natural-freq spread', 0, 0.8, 0.05)],
  init (st) {
    st.ph0 = new Float32Array(MAX_SUB); st.om = new Float32Array(MAX_SUB); st.order = 0; st.n = 0
    for (let i = 0; i < MAX_SUB; i++) { st.ph0[i] = st.rng() * TAU; st.om[i] = st.rng() * 2 - 1 }
  },
  update (st, dt, E) {
    const p = st.params
    const n = 1 + st.nV; st.n = n
    const ph = st.ph0, om = st.om, w0 = TAU * p.frequency, nx = st.v   // st.v doubles as the next-phase scratch
    for (let i = 0; i < n; i++) {
      let s = 0
      for (let j = 0; j < n; j++) s += Math.sin(ph[j] - ph[i])
      nx[i] = ph[i] + (w0 * (1 + p.detune * om[i]) + p.coupling / n * s) * dt
    }
    let cx = 0, sx = 0
    for (let i = 0; i < n; i++) { ph[i] = nx[i] % TAU; cx += Math.cos(ph[i]); sx += Math.sin(ph[i]) }
    st.order = Math.hypot(cx, sx) / n
    for (let i = 0; i < n; i++) {
      const m = i === 0 ? st.host.mesh : st.V[i - 1].mesh
      if (!E.move(st, m)) continue
      const rp = R(m).p
      E.place(st, m, rp.x, rp.y + p.amplitude * Math.sin(ph[i]), rp.z)
      E.ring(m.position.x, m.position.y, m.position.z, E.markerR(m) * 0.55, st.hex, 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(ph[i])))
    }
  },
})

// ── Tier A · Emergent ────────────────────────────────────────────────────────

def('Coalesce', 'Emergent', 'A', {
  needs: 'targets', hint: 'This node and the targets drift to their centroid and merge scale-wise (the host grows as they join).',
  defaults: { rate: 1.2, mergeRadius: 0.8, mergeScale: 0.3, growth: 0.25 },
  schema: [N('rate', 'Pull rate', 0.1, 6, 0.1), N('mergeRadius', 'Merge radius', 0.1, 5, 0.1), N('mergeScale', 'Absorbed scale', 0.05, 1, 0.05), N('growth', 'Host growth per node', 0, 1, 0.05)],
  update (st, dt, E) {
    const p = st.params
    const n = 1 + st.nV
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < n; i++) { const q = (i === 0 ? st.host : st.V[i - 1]).mesh.position; cx += q.x; cy += q.y; cz += q.z }
    cx /= n; cy /= n; cz /= n
    st.cx = cx; st.cy = cy; st.cz = cz
    const k = 1 - Math.exp(-p.rate * dt)
    let merged = 0
    for (let i = 1; i < n; i++) { const q = st.V[i - 1].mesh.position; if (Math.hypot(q.x - cx, q.y - cy, q.z - cz) < p.mergeRadius) merged++ }
    st.merged = merged
    for (let i = 0; i < n; i++) {
      const m = (i === 0 ? st.host : st.V[i - 1]).mesh
      if (!E.move(st, m)) continue
      const q = m.position
      q.x += (cx - q.x) * k; q.y += (cy - q.y) * k; q.z += (cz - q.z) * k
      const close = Math.hypot(q.x - cx, q.y - cy, q.z - cz) < p.mergeRadius
      E.scaleTo(m, i === 0 ? 1 + p.growth * merged : (close ? p.mergeScale : 1), dt, 6)
    }
    E.ring(cx, cy, cz, p.mergeRadius, st.hex, 0.5)
  },
})

def('Diffuse', 'Emergent', 'A', {
  needs: 'targets', field: true, hint: 'An influence ring expands from this node, tinting and nudging every node it passes (they spring back). No targets: all nearby nodes.',
  defaults: { maxRadius: 8, speed: 3, band: 1, push: 8, spring: 3 },
  schema: [N('maxRadius', 'Max radius', 1, 40, 0.5), N('speed', 'Expansion speed', 0.5, 20, 0.5), N('band', 'Band width', 0.2, 5, 0.1), N('push', 'Push', 0, 40, 0.5), N('spring', 'Return spring', 0.5, 12, 0.5)],
  update (st, dt, E) {
    const p = st.params, h = st.host.mesh.position
    st.R = (st.t * p.speed) % p.maxRadius
    E.ring(h.x, h.y, h.z, st.R, st.hex, 1)
    E.ring(h.x, h.y, h.z, Math.max(0, st.R - p.band * 0.5), st.hex, 0.4)
    const drag = Math.exp(-2 * dt)
    for (let i = 0; i < st.nS; i++) {
      const m = st.S[i].mesh
      if (!E.move(st, m)) continue
      const q = m.position, rs = R(m).p, v = st.v, o = (i + 1) * 3
      const dx = q.x - h.x, dy = q.y - h.y, dz = q.z - h.z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const off = Math.abs(d - st.R)
      if (off < p.band && d > 1e-4) {
        const w = 1 - off / p.band
        v[o] += dx / d * p.push * w * dt; v[o + 1] += dy / d * p.push * w * dt; v[o + 2] += dz / d * p.push * w * dt
        E.flash(m, st.hex, w)
      }
      v[o] -= p.spring * (q.x - rs.x) * dt; v[o + 1] -= p.spring * (q.y - rs.y) * dt; v[o + 2] -= p.spring * (q.z - rs.z) * dt
      v[o] *= drag; v[o + 1] *= drag; v[o + 2] *= drag
      q.x += v[o] * dt; q.y += v[o + 1] * dt; q.z += v[o + 2] * dt
    }
  },
})

def('Compete', 'Emergent', 'A', {
  needs: 'targets', hint: 'Targets race for this node\'s position (the resource). The winner takes the spot and grows; losers shrink back.',
  defaults: { captureRadius: 0.9, roundTime: 8, holdTime: 2, speed: 2.5 },
  schema: [N('captureRadius', 'Capture radius', 0.2, 4, 0.1), N('roundTime', 'Round time (s)', 2, 30, 0.5), N('holdTime', 'Hold (s)', 0.5, 10, 0.5), N('speed', 'Base speed', 0.5, 12, 0.5)],
  newRound (st) { for (let i = 0; i < MAX_SUB; i++) st.sc[i] = 0.6 + 0.8 * st.rng(); st.winner = -1; st.phase = 0; st.pt = 0; st.round++ },
  init (st) { st.round = 0; st.sc = new Float32Array(MAX_SUB); st.row.newRound(st) },
  update (st, dt, E) {
    const p = st.params, h = st.host.mesh.position
    st.pt += dt
    if (st.phase === 0 && st.pt > p.roundTime) { st.phase = 2; st.pt = 0; st.winner = -1 }
    for (let i = 0; i < st.nV; i++) {
      const m = st.V[i].mesh
      if (!E.move(st, m)) continue
      const rs = R(m)
      if (st.phase === 0) {
        const rem = stepToward(m, h.x, h.y, h.z, p.speed * st.sc[i], dt)
        E.scaleTo(m, 1, dt, 4)
        if (rem < p.captureRadius && st.winner < 0) {
          st.winner = i; st.phase = 1; st.pt = 0
          E.emit('omni:node-behavior-event', { nodeId: st.V[i].id, hostId: st.id, type: 'Compete', kind: 'winner', round: st.round })
        }
      } else if (st.phase === 1) {
        if (i === st.winner) { stepToward(m, h.x, h.y + 0.9, h.z, p.speed * 2, dt); E.scaleTo(m, 1.6, dt, 4) }
        else { stepToward(m, rs.p.x, rs.p.y, rs.p.z, p.speed * 2, dt); E.scaleTo(m, 0.65, dt, 4) }
      } else { stepToward(m, rs.p.x, rs.p.y, rs.p.z, p.speed * 2, dt); E.scaleTo(m, 1, dt, 4) }
    }
    if (st.phase === 1 && st.pt > p.holdTime) { st.phase = 2; st.pt = 0 }
    else if (st.phase === 2 && st.pt > 1.5) st.row.newRound(st)
    E.ring(h.x, h.y, h.z, p.captureRadius, st.hex, 0.6)
  },
})

def('Cooperate', 'Emergent', 'A', {
  needs: 'targets', hint: 'Targets take even slots on a ring around this node and equalise their size (sharing).',
  defaults: { radius: 3, spin: 0.3, rate: 2 },
  schema: [N('radius', 'Ring radius', 0.5, 20, 0.1), N('spin', 'Shared spin (rad/s)', -3, 3, 0.05), N('rate', 'Settle rate', 0.2, 8, 0.1)],
  init (st) { st.ok = new Uint8Array(MAX_SUB) },
  update (st, dt, E) {
    const p = st.params, h = st.host.mesh.position
    const n = st.nV
    if (n === 0) return
    let sBar = 0, c = 0
    for (let i = 0; i < n; i++) { st.ok[i] = E.move(st, st.V[i].mesh) ? 1 : 0; if (st.ok[i]) { sBar += R(st.V[i].mesh).s.x; c++ } }
    if (c === 0) return
    sBar /= c
    st.sBar = sBar
    const k = 1 - Math.exp(-p.rate * dt)
    for (let i = 0; i < n; i++) {
      if (!st.ok[i]) continue
      const m = st.V[i].mesh, q = m.position
      const a = st.t * p.spin + i / n * TAU
      q.x += (h.x + Math.cos(a) * p.radius - q.x) * k; q.y += (h.y - q.y) * k; q.z += (h.z + Math.sin(a) * p.radius - q.z) * k
      E.scaleTo(m, sBar / Math.max(R(m).s.x, 1e-6), dt, p.rate * 2)
    }
    E.ring(h.x, h.y, h.z, p.radius, st.hex, 0.4)
  },
})

def('Adapt', 'Emergent', 'A', {
  needs: 'target', hint: 'Orbits the first target; a feedback loop adapts the orbit radius against a drifting disturbance (watch the two rings).',
  defaults: { goal: 4, gain: 2, disturbance: 1.2, dFreq: 0.7, speed: 0.8, r0: 1.5, adaptive: true },
  schema: [N('goal', 'Goal distance', 0.5, 30, 0.1), N('gain', 'Feedback gain', 0, 8, 0.1), N('disturbance', 'Disturbance', 0, 6, 0.1), N('dFreq', 'Disturbance rate', 0.1, 3, 0.05),
           N('speed', 'Orbit speed', -4, 4, 0.05), N('r0', 'Start radius', 0.3, 30, 0.1), Bo('adaptive', 'Adapt (feedback on)')],
  init (st) { st.r = st.params.r0; st.ang = 0; st.ra = st.r; st.err = 0 },
  update (st, dt, E) {
    const m = st.host.mesh, p = st.params
    const movable = E.move(st, m)
    const c = st.nV > 0 ? st.V[0].mesh.position : (R(m)?.p ?? m.position)
    st.ang += p.speed * dt
    const d = p.disturbance * Math.sin(p.dFreq * st.t)
    st.ra = Math.max(0.2, st.r + d)          // the distance actually realised
    st.err = p.goal - st.ra                  // feedback signal
    if (p.adaptive) st.r = Math.max(0.2, st.r + p.gain * st.err * dt)
    if (movable) E.place(st, m, c.x + Math.cos(st.ang) * st.ra, c.y, c.z + Math.sin(st.ang) * st.ra)
    E.ring(c.x, c.y, c.z, p.goal, st.hex, 0.3)   // goal
    E.ring(c.x, c.y, c.z, st.r, st.hex, 1)       // the adapted parameter, live
  },
})

def('Emerge', 'Emergent', 'A', {
  needs: 'targets', hint: 'Targets flock (separation / alignment / cohesion) around this node — a higher-order pattern from simple rules. Needs 2+ targets.',
  defaults: { separation: 1.2, alignment: 0.8, cohesion: 0.6, maxSpeed: 3, radius: 6, bound: 10 },
  schema: [N('separation', 'Separation', 0, 4, 0.1), N('alignment', 'Alignment', 0, 4, 0.1), N('cohesion', 'Cohesion', 0, 4, 0.1), N('maxSpeed', 'Max speed', 0.5, 12, 0.5), N('radius', 'Neighbour radius', 1, 20, 0.5), N('bound', 'Home bound', 2, 40, 1)],
  init (st) { for (let i = 0; i < st.v.length; i++) st.v[i] = (st.rng() - 0.5) * 0.6; st.spread = 0 },
  update (st, dt, E) {
    const p = st.params, h = st.host.mesh.position, n = st.nV, v = st.v
    if (n < 2) return
    const r2 = p.radius * p.radius, sep2 = 2.25
    let cx = 0, cy = 0, cz = 0
    for (let i = 0; i < n; i++) {
      const mi = st.V[i].mesh
      if (!E.move(st, mi)) continue
      const pi = mi.position, o = i * 3
      let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, qx = 0, qy = 0, qz = 0, c = 0
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const pj = st.V[j].mesh.position
        const dx = pj.x - pi.x, dy = pj.y - pi.y, dz = pj.z - pi.z
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 > r2) continue
        c++
        ax += v[j * 3]; ay += v[j * 3 + 1]; az += v[j * 3 + 2]
        qx += dx; qy += dy; qz += dz
        if (d2 < sep2) { const w = 1 / (d2 + 0.05); sx -= dx * w; sy -= dy * w; sz -= dz * w }
      }
      let axx = 0, ayy = 0, azz = 0
      if (c > 0) {
        axx = p.separation * 3 * sx + p.alignment * 1.5 * (ax / c - v[o]) + p.cohesion * 0.8 * (qx / c)
        ayy = p.separation * 3 * sy + p.alignment * 1.5 * (ay / c - v[o + 1]) + p.cohesion * 0.8 * (qy / c)
        azz = p.separation * 3 * sz + p.alignment * 1.5 * (az / c - v[o + 2]) + p.cohesion * 0.8 * (qz / c)
      }
      const hx = h.x - pi.x, hy = h.y - pi.y, hz = h.z - pi.z, hd = Math.sqrt(hx * hx + hy * hy + hz * hz)
      const hk = hd > p.bound ? 4 : 0.3
      axx += hx * hk; ayy += hy * hk; azz += hz * hk
      v[o] += axx * dt; v[o + 1] += ayy * dt; v[o + 2] += azz * dt
      const sp = Math.sqrt(v[o] * v[o] + v[o + 1] * v[o + 1] + v[o + 2] * v[o + 2])
      if (sp > p.maxSpeed) { const k = p.maxSpeed / sp; v[o] *= k; v[o + 1] *= k; v[o + 2] *= k }
      pi.x += v[o] * dt; pi.y += v[o + 1] * dt; pi.z += v[o + 2] * dt
      cx += pi.x; cy += pi.y; cz += pi.z
      E.line(pi.x, pi.y, pi.z, pi.x + v[o] * 0.4, pi.y + v[o + 1] * 0.4, pi.z + v[o + 2] * 0.4, st.hex, 0.7)
    }
    cx /= n; cy /= n; cz /= n
    let spread = 0
    for (let i = 0; i < n; i++) { const q = st.V[i].mesh.position; spread += Math.hypot(q.x - cx, q.y - cy, q.z - cz) }
    st.spread = spread / n
    E.ring(cx, cy, cz, st.spread + 0.4, st.hex, 0.7)
  },
})

// ── Tier B · signal / bead METAPHOR ──────────────────────────────────────────
// A bead travels source → host (leg 1) → sink (leg 2). Source = first target (else a
// virtual point left of the host), sink = second target (else a virtual point right).
// These animate an IDEA of signal handling; nothing here computes real data.

function sigUpdate (st, dt, E) {
  const m = st.host.mesh, h = m.position, p = st.params, row = st.row
  st.vin.set(h.x - 2.5, h.y, h.z); st.vout.set(h.x + 2.5, h.y, h.z)
  st.src = st.nV > 0 ? st.V[0].mesh.position : st.vin
  st.snk = st.nV > 1 ? st.V[1].mesh.position : st.vout
  if (row.sigIn !== false) E.line(st.src.x, st.src.y, st.src.z, h.x, h.y, h.z, st.hex, 0.45)
  if (row.sigOut !== false) E.line(h.x, h.y, h.z, st.snk.x, st.snk.y, st.snk.z, st.hex, 0.45)
  if (row.emits !== false) {
    st.timer += dt
    while (st.timer >= p.emitEvery) {
      st.timer -= p.emitEvery
      E.spawnBead(st, st.src, h, st.seq++ & 3, row.emitShape ?? 0, row.emitSize ?? 0.2, p.speed, 1)
    }
  }
  if (row.tick) row.tick(st, dt, E, E.markerR(m))
}
function pass (st, b, E) { E.redirect(b, st.host.mesh.position, st.snk, 2) }

function defB (name, cls, extraDefaults, extraSchema, row) {
  def(name, cls, 'B', {
    needs: 'targets',
    defaults: (({ emitEvery, ...rest }) => (row.emits === false ? rest : { emitEvery, ...rest }))({ ...SIGNAL_DEFAULTS, ...extraDefaults }),   // a node that does not emit has no emit interval
    schema: [...(row.emits === false ? SIGNAL_SCHEMA.slice(1) : SIGNAL_SCHEMA), ...extraSchema],
    init (st) {
      st.vin = new THREE.Vector3(); st.vout = new THREE.Vector3(); st.src = st.vin; st.snk = st.vout
      st.timer = 0; st.seq = 0; st.processed = 0; st.rejected = 0
      if (row.start) row.start(st)
    },
    update: sigUpdate, ...row,
  })
}
const TF = 'Transformational'

defB('Transform', TF, {}, [], {
  hint: 'METAPHOR: a bead arrives, changes colour and shape, and leaves.',
  arrive (st, b, E) { if (b.leg === 1) { b.col = (b.col + 1) & 3; b.shape = 1 - b.shape; st.processed++; E.flash(st.host.mesh, BEAD_HEX[b.col], 0.7); pass(st, b, E) } else E.kill(b) },
})
defB('Amplify', TF, { gain: 2 }, [N('gain', 'Gain', 1.1, 4, 0.1)], {
  hint: 'METAPHOR: beads grow as they pass through.',
  arrive (st, b, E) { if (b.leg === 1) { b.size = Math.min(0.7, b.size * st.params.gain); st.processed++; E.flash(st.host.mesh, st.hex, 0.6); pass(st, b, E) } else E.kill(b) },
})
defB('Dampen', TF, { damp: 0.5 }, [N('damp', 'Keep fraction', 0.1, 0.95, 0.05)], {
  hint: 'METAPHOR: beads shrink as they pass through.', emitSize: 0.35,
  arrive (st, b, E) { if (b.leg === 1) { b.size = Math.max(0.04, b.size * st.params.damp); st.processed++; pass(st, b, E) } else E.kill(b) },
})
defB('Filter', TF, { pass: 'green' }, [S('pass', 'Pass colour', BEAD_NAMES)], {
  hint: 'METAPHOR: only beads of the chosen colour pass; others are rejected.',
  arrive (st, b, E) {
    if (b.leg !== 1) { E.kill(b); return }
    if (BEAD_NAMES[b.col] === st.params.pass) { st.processed++; pass(st, b, E) }
    else { st.rejected++; st.rej = 1; E.kill(b) }
  },
  tick (st, dt, E, R0) {
    if (st.rej > 0) { st.rej = Math.max(0, st.rej - dt * 3); const h = st.host.mesh.position; E.ring(h.x, h.y, h.z, R0 * (1.2 + (1 - st.rej)), 0xd04040, st.rej) }
  },
})
defB('Encode', TF, {}, [], {
  hint: 'METAPHOR: beads compress into small cubes.',
  arrive (st, b, E) { if (b.leg === 1) { b.shape = 1; b.size = Math.max(0.06, b.size * 0.5); st.processed++; pass(st, b, E) } else E.kill(b) },
})
defB('Decode', TF, {}, [], {
  hint: 'METAPHOR: cubes expand into spheres.', emitShape: 1, emitSize: 0.1,
  arrive (st, b, E) { if (b.leg === 1) { b.shape = 0; b.size = Math.min(0.5, b.size * 2.2); st.processed++; pass(st, b, E) } else E.kill(b) },
})
defB('Store', TF, { capacity: 8 }, [N('capacity', 'Capacity', 1, 32, 1)], {
  hint: 'METAPHOR: the node absorbs beads; a level ring fills and glows. Nothing leaves.', sigOut: false,
  start (st) { st.level = 0 },
  arrive (st, b, E) {
    if (b.leg === 1 && st.level < st.params.capacity) { st.level++; st.processed++; E.flash(st.host.mesh, st.hex, 0.8) }
    else if (b.leg === 1) st.rejected++
    E.kill(b)
  },
  tick (st, dt, E, R0) { const h = st.host.mesh.position; E.arc(h.x, h.y, h.z, R0 * 1.7, st.level / st.params.capacity, st.hex, 1) },
})
defB('Release', TF, { releaseEvery: 0.8, stock: 6, refill: true }, [N('releaseEvery', 'Release every (s)', 0.2, 5, 0.1), N('stock', 'Stock', 1, 32, 1), Bo('refill', 'Refill when empty')], {
  hint: 'METAPHOR: the node holds a stock and lets beads out one at a time.', sigIn: false, emits: false,
  start (st) { st.level = st.params.stock; st.rt = 0; st.wait = 0 },
  arrive (st, b, E) { E.kill(b) },
  tick (st, dt, E, R0) {
    const p = st.params, h = st.host.mesh.position
    if (st.level > 0) {
      st.rt += dt
      if (st.rt >= p.releaseEvery) { st.rt = 0; st.level--; st.processed++; E.spawnBead(st, h, st.snk, st.seq++ & 3, 0, 0.2, p.speed, 2); E.flash(st.host.mesh, st.hex, 0.5) }
    } else if (p.refill) { st.wait += dt; if (st.wait > 2) { st.wait = 0; st.level = p.stock } }
    E.arc(h.x, h.y, h.z, R0 * 1.7, st.level / Math.max(1, p.stock), st.hex, 1)
  },
})
defB('Gate', 'Relational', { period: 3, open: true, auto: true }, [N('period', 'Toggle period (s)', 0.5, 20, 0.5), Bo('open', 'Open (manual / start)'), Bo('auto', 'Toggle on timer')], {
  hint: 'METAPHOR: a paddle that lets beads through when open and blocks them when closed.',
  start (st) { st.open = st.params.open; st.gt = 0; st.blocked = 0 },
  arrive (st, b, E) {
    if (b.leg === 1) { if (st.open) { st.processed++; pass(st, b, E) } else { st.blocked++; E.redirect(b, st.host.mesh.position, st.src, 3) } }
    else E.kill(b)
  },
  tick (st, dt, E, R0) {
    const p = st.params, h = st.host.mesh.position
    if (p.auto) { st.gt += dt; if (st.gt >= p.period) { st.gt = 0; st.open = !st.open } } else st.open = p.open
    if (st.open) E.ring(h.x, h.y, h.z, R0 * 1.3, st.hex, 0.5)
    else { E.ring(h.x, h.y, h.z, R0 * 1.3, 0xd04040, 1); E.line(h.x - R0 * 1.3, h.y, h.z, h.x + R0 * 1.3, h.y, h.z, 0xd04040, 1) }
  },
})
defB('Mediate', 'Relational', { rate: 1, queueMax: 8, emitEvery: 0.4 }, [N('rate', 'Pass rate (/s)', 0.2, 6, 0.1), N('queueMax', 'Queue max', 1, 32, 1)], {
  hint: 'METAPHOR: sits between two nodes and meters the bead flow to a fixed rate.',
  start (st) { st.q = 0; st.mt = 0; st.dropped = 0; st.qcol = new Int8Array(64); st.qh = 0; st.out = 0 },
  arrive (st, b, E) {
    if (b.leg === 1) {
      if (st.q < st.params.queueMax) { st.qcol[(st.qh + st.q) & 63] = b.col; st.q++ } else st.dropped++
    }
    E.kill(b)
  },
  tick (st, dt, E, R0) {
    const p = st.params, h = st.host.mesh.position
    st.mt += dt
    const per = 1 / p.rate
    if (st.q > 0 && st.mt >= per) {
      st.mt = 0
      const col = st.qcol[st.qh & 63]; st.qh = (st.qh + 1) & 63; st.q--; st.out++; st.processed++
      E.spawnBead(st, h, st.snk, col, 0, 0.2, p.speed, 2)
    } else if (st.q === 0) st.mt = Math.min(st.mt, per)
    E.ring(h.x, h.y, h.z, R0 * (1 + 0.12 * st.q), st.hex, 0.9)
  },
})

// Finalise: every table row gets the common params its kind needs.
for (const r of Object.values(BEHAVIOR_TABLE)) {
  r.defaults = { ...(r.moves ? COMMON_DEFAULTS : {}), ...r.defaults }
  r.schema = r.moves ? [...r.schema, ...COMMON_SCHEMA] : [...r.schema]
}

export { BEHAVIOR_TABLE, BEAD_NAMES }

export function behaviorNames () { return Object.keys(BEHAVIOR_TABLE) }
export function behaviorDefaults (type) { return { ...(BEHAVIOR_TABLE[type]?.defaults ?? {}) } }
export function behaviorSchema (type) { return BEHAVIOR_TABLE[type]?.schema ?? [] }
export function behaviorClassColorHex (type) { return '#' + (CLASS_COLORS[BEHAVIOR_TABLE[type]?.cls] ?? 0xffffff).toString(16).padStart(6, '0') }

/** Validate / coerce a behaviour config. Returns a fresh object or null. */
export function normalizeBehavior (raw, hostId = null) {
  if (!raw || typeof raw !== 'object') return null
  const row = BEHAVIOR_TABLE[raw.type]
  if (!row) return null
  const params = behaviorDefaults(raw.type)
  const given = raw.params && typeof raw.params === 'object' ? raw.params : {}
  for (const f of row.schema) {
    if (!(f.key in given)) continue
    const v = given[f.key]
    if (f.type === 'number') { const n = Number(v); if (Number.isFinite(n)) params[f.key] = clamp(n, f.min, f.max) }
    else if (f.type === 'select') { if (f.options.includes(v)) params[f.key] = v }
    else if (f.type === 'bool') params[f.key] = !!v
  }
  const targets = []
  if (Array.isArray(raw.targets)) for (const t of raw.targets) if (typeof t === 'string' && t !== hostId && !targets.includes(t) && targets.length < MAX_TARGETS) targets.push(t)
  // V165: optional provenance tag. User-authored behaviours have none; a behaviour fired by a
  // hand's Activation carries 'hand:lh' | 'hand:rh' (systems/OmniHandAmmo.js).
  const source = typeof raw.source === 'string' && raw.source ? raw.source.slice(0, 32) : null
  return { type: raw.type, params, enabled: raw.enabled !== false, targets, role: raw.role ?? row.role ?? null, ...(source ? { source } : {}) }
}

// ═════════════════════════════════════════════════════════════════════════════
//  The engine
// ═════════════════════════════════════════════════════════════════════════════

export default class OmniNodeBehavior {
  constructor (context) {
    this.ctx = context
    this._reg = new Map()        // nodeId -> { id, mesh, data }
    this._cfg = new Map()        // nodeId -> last known config (running or not)
    this._active = []            // running states
    this._byId = new Map()       // nodeId -> state
    this._blocked = []           // ids waiting for a free slot
    this._pending = new Map()    // nodeId -> cfg waiting for a mesh
    this._rest = new Map()       // mesh -> rest record
    this._flash = new Map()      // mesh -> { amt, hex, e0, i0 }
    this._grabbed = null
    this._frame = 0
    this.time = 0
    this.master = true
    this._ln = 0
    this._rx = 1; this._ry = 0; this._rz = 0; this._ux = 0; this._uy = 1; this._uz = 0; this._ol = 0.014
    this._fieldT = 0
    this.group = null
    this._bound = []
  }

  // ── module contract ─────────────────────────────────────────────────────

  init () {
    try { this.master = localStorage.getItem(STORE_MASTER) !== '0' } catch (_) {}
    this._build()
    const on = (name, fn) => { window.addEventListener(name, fn); this._bound.push([name, fn]) }
    on('omni:node-created',  (e) => this._onNode(e, WARMUP))
    on('omni:node-restored', (e) => this._onNode(e, 0))
    on('omni:node-deleted',  (e) => this._onDeleted(e.detail?.id))
    on('omni:nodes-updated', (e) => this._onNodesUpdated(e.detail))
    on('omni:node-behavior-set', (e) => { const d = e.detail ?? {}; this.setBehavior(d.nodeId, d.behavior ?? null) })
    on('omni:node-behavior-master-set', (e) => this.setMaster(e.detail?.enabled !== false))
    on('omni:reality-grabbed', (e) => { this._grabbed = e.detail?.mesh ?? null })
    on('mouseup', () => { if (this._grabbed) setTimeout(() => { this._grabbed = null }, 400) })
    on('omni:scene-clear-request', () => this._clearAll())
    this._scanScene()
    window.dispatchEvent(new CustomEvent('omni:nodes-request'))
  }

  onResize () {}

  update (delta) {
    if (typeof document !== 'undefined' && document.hidden) return
    const dt = Math.min(delta, DT_MAX)
    if (!(dt > 0)) return
    this._frame++
    this.time += dt
    this._camBasis()
    this._ln = 0
    this._fieldT -= dt
    const act = this._active
    for (let i = 0; i < act.length; i++) {
      const st = act[i]
      if (!st.alive) continue
      const e = this._reg.get(st.id)
      if (!e || !e.mesh || !e.mesh.parent) continue          // dehydrated / removed: pause
      st.host = e
      if (st.warm > 0) { st.warm -= dt; continue }
      if (!st.started) { st.started = true; if (st.row.init) st.row.init(st) }
      this._resolve(st)
      st.t += dt
      if (st.blend < 1) st.blend = Math.min(1, st.blend + dt / 0.6)
      try { st.row.update(st, dt, this) } catch (err) { this._fail(st, err); continue }
      this.ring(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, this.markerR(e.mesh), st.hex, 0.85)
    }
    this._stepBeads(dt)
    this._stepFlash(dt)
    this._commit()
  }

  destroy () {
    for (const [n, fn] of this._bound) window.removeEventListener(n, fn)
    this._bound.length = 0
    this._clearAll()
    for (const mesh of [...this._flash.keys()]) this._unflash(mesh)
    this._flash.clear()
    if (this.group) {
      this.ctx.scene.remove(this.group)
      this.group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); o.dispose?.() })
      this.group = null
    }
    this._reg.clear(); this._cfg.clear()
  }

  // ── public API ──────────────────────────────────────────────────────────

  /** Register a node (also done automatically from events). */
  registerNode (id, mesh, data) {
    if (!id || !mesh) return
    this._reg.set(id, { id, mesh, data: data ?? null })
  }

  /** Set (cfg) or remove (null) a node's behaviour: persists, restarts, notifies. */
  setBehavior (id, raw, opts = {}) {
    if (!id) return null
    const cfg = raw == null ? null : normalizeBehavior(raw, id)
    if (raw != null && !cfg) return null
    // Live tweak: same type, same targets, still enabled -> swap the params in place (no
    // restart, no snap back to rest) so Inspector sliders animate smoothly. Rows read
    // st.params every frame; values captured once in init() (e.g. Orbit's start phase,
    // Release's stock) apply on the next restart.
    const old = this._byId.get(id)
    if (cfg && old && cfg.enabled !== false && old.cfg.type === cfg.type
        && old.cfg.targets.length === cfg.targets.length && old.cfg.targets.every((t, i) => t === cfg.targets[i])) {
      old.cfg = cfg; old.params = cfg.params
      this._cfg.set(id, cfg)
      const e0 = this._reg.get(id); if (e0?.data) e0.data.behavior = cfg
      if (opts.persist !== false) window.dispatchEvent(new CustomEvent('omni:node-rotation-automation-set', { detail: { id, behavior: JSON.parse(JSON.stringify(cfg)) } }))
      window.dispatchEvent(new CustomEvent('omni:node-behavior-changed', { detail: { nodeId: id, behavior: cfg } }))
      return cfg
    }
    this._stop(id, true)
    this._pending.delete(id)
    const bi = this._blocked.indexOf(id); if (bi >= 0) this._blocked.splice(bi, 1)
    if (cfg) this._cfg.set(id, cfg); else this._cfg.delete(id)
    const e = this._reg.get(id)
    if (e?.data) e.data.behavior = cfg
    if (opts.persist !== false) {
      window.dispatchEvent(new CustomEvent('omni:node-rotation-automation-set', { detail: { id, behavior: cfg ? JSON.parse(JSON.stringify(cfg)) : null } }))
    }
    if (cfg) this._start(id, cfg, opts.warmup ?? 0)
    window.dispatchEvent(new CustomEvent('omni:node-behavior-changed', { detail: { nodeId: id, behavior: cfg } }))
    return cfg
  }

  getBehavior (id) { return this._cfg.get(id) ?? null }
  getState (id) { return this._byId.get(id) ?? null }
  get activeCount () { return this._active.length }
  get beadCount () { let n = 0; for (let i = 0; i < MAX_BEADS; i++) if (this._beads[i].alive) n++; return n }

  setMaster (enabled) {
    this.master = !!enabled
    try { localStorage.setItem(STORE_MASTER, this.master ? '1' : '0') } catch (_) {}
    if (!this.master) { for (const st of this._active.slice()) this._stop(st.id, true) }
    else for (const [id, cfg] of this._cfg) if (cfg.enabled !== false && !this._byId.has(id)) this._start(id, cfg, 0)
    window.dispatchEvent(new CustomEvent('omni:node-behavior-master-changed', { detail: { enabled: this.master } }))
  }

  // ── event handlers ──────────────────────────────────────────────────────

  _onNode (e, warm) {
    const { node, mesh } = e.detail ?? {}
    if (!node?.id || !mesh) return
    this.registerNode(node.id, mesh, node)
    const known = this._byId.get(node.id)
    if (known && known.host?.mesh !== mesh) { this._stop(node.id, true); this._startFromData(node, warm) }   // re-hydrated with a new mesh
    else if (!known) this._startFromData(node, warm)
  }

  _onDeleted (id) {
    if (!id) return
    this._stop(id, true)
    this._pending.delete(id); this._cfg.delete(id)
    const e = this._reg.get(id)
    if (e) { this._rest.delete(e.mesh); this._flash.delete(e.mesh) }
    this._reg.delete(id)
  }

  _onNodesUpdated (d) {
    const nodes = d?.nodes
    if (!Array.isArray(nodes)) return
    let scanned = false
    for (const n of nodes) {
      if (!n?.id || !n.behavior || this._byId.has(n.id) || this._pending.has(n.id) || this._cfg.has(n.id)) continue
      if (!this._reg.has(n.id) && !scanned) { this._scanScene(); scanned = true }
      const e = this._reg.get(n.id)
      if (e && !e.data) e.data = n
      this._startFromData(n, 0)
    }
  }

  _startFromData (node, warm) {
    const cfg = normalizeBehavior(node.behavior, node.id)
    if (!cfg) return
    this._cfg.set(node.id, cfg)
    this._start(node.id, cfg, warm)
  }

  _scanScene () {
    const kids = this.ctx.scene?.children
    if (!kids) return
    for (let i = 0; i < kids.length; i++) {
      const id = kids[i].userData?.nodeId
      if (id && !this._reg.has(id)) this._reg.set(id, { id, mesh: kids[i], data: null })
    }
    for (const [id, cfg] of [...this._pending]) {
      if (this._reg.has(id) && !this._byId.has(id)) { this._pending.delete(id); this._start(id, cfg, 0) }
    }
  }

  // ── lifecycle of one behaviour ──────────────────────────────────────────

  _start (id, cfg, warm) {
    if (!cfg || cfg.enabled === false || !this.master) return null
    const row = BEHAVIOR_TABLE[cfg.type]
    if (!row) return null
    const e = this._reg.get(id)
    if (!e) { this._pending.set(id, cfg); return null }
    if (this._byId.has(id)) return this._byId.get(id)
    if (this._active.length >= MAX_ACTIVE) {
      if (!this._blocked.includes(id)) this._blocked.push(id)
      console.warn(`⟐NodeBehavior — ${MAX_ACTIVE} behaviours already running; "${cfg.type}" on ${id} waits for a free slot.`)
      window.dispatchEvent(new CustomEvent('omni:node-behavior-capped', { detail: { nodeId: id, max: MAX_ACTIVE } }))
      return null
    }
    const st = {
      id, cfg, params: cfg.params, row, cls: row.cls, hex: CLASS_COLORS[row.cls] ?? 0xffffff,
      host: e, alive: true, started: false, warm, t: 0, blend: 0,
      V: new Array(MAX_TARGETS).fill(null), nV: 0, F: new Array(MAX_TARGETS).fill(null), nF: 0, S: null, nS: 0,
      v: new Float32Array(MAX_SUB * 6), acq: [], rng: mulberry(hash32(id)),
    }
    st.S = st.V
    this._active.push(st)
    this._byId.set(id, st)
    return st
  }

  _stop (id, restore) {
    const st = this._byId.get(id)
    if (!st) return
    st.alive = false
    this._byId.delete(id)
    const i = this._active.indexOf(st)
    if (i >= 0) this._active.splice(i, 1)
    for (let b = 0; b < MAX_BEADS; b++) if (this._beads[b].alive && this._beads[b].owner === st) this.kill(this._beads[b])
    const doRestore = restore && st.params.restore !== false
    for (let k = 0; k < st.acq.length; k++) this._release(st.acq[k], doRestore)
    st.acq.length = 0
    this._fillBlocked()
  }

  _fillBlocked () {
    while (this._blocked.length && this._active.length < MAX_ACTIVE) {
      const id = this._blocked.shift()
      const c = this._cfg.get(id)
      if (c) this._start(id, c, 0)
    }
  }

  _clearAll () {
    for (const st of this._active.slice()) this._stop(st.id, true)
    this._pending.clear(); this._blocked.length = 0; this._cfg.clear()
  }

  _fail (st, err) {
    console.error(`⟐NodeBehavior — ${st.cfg.type} on ${st.id} threw; stopped.`, err)
    window.dispatchEvent(new CustomEvent('omni:node-behavior-error', { detail: { nodeId: st.id, type: st.cfg.type, message: String(err?.message ?? err) } }))
    this._stop(st.id, true)
  }

  _resolve (st) {
    const ids = st.cfg.targets
    let n = 0
    for (let i = 0; i < ids.length; i++) {
      const e = this._reg.get(ids[i])
      if (e && e.mesh && e.mesh.parent && e !== st.host) st.V[n++] = e
    }
    st.nV = n
    if (n === 0 && st.row.field) {
      if (this._fieldT <= 0 || st.nF === 0) this._refreshField(st)
      st.S = st.F; st.nS = st.nF
    } else { st.S = st.V; st.nS = n }
  }

  _refreshField (st) {
    let n = 0
    for (const e of this._reg.values()) {
      if (n >= MAX_TARGETS) break
      if (e === st.host || !e.mesh || !e.mesh.parent || !e.mesh.visible) continue
      if (this._byId.has(e.id)) continue          // never shove another behaviour's host
      st.F[n++] = e
    }
    st.nF = n
    this._fieldT = 0.5
  }

  // ── rest pose / ownership ───────────────────────────────────────────────

  /** Claim a mesh for this behaviour this frame. false = skip it (grabbed, hidden, locked, or already moved this frame). */
  move (st, mesh) {
    if (!mesh || !mesh.parent || !mesh.visible || mesh === this._grabbed || mesh.userData.behaviorLocked) return false
    if (mesh.userData.__bClaim === this._frame) return false
    mesh.userData.__bClaim = this._frame
    if (st.acq.indexOf(mesh) < 0) this._acquire(st, mesh)
    return true
  }

  _acquire (st, mesh) {
    let r = this._rest.get(mesh)
    if (!r) {
      r = { p: mesh.position.clone(), q: mesh.quaternion.clone(), s: mesh.scale.clone(), refs: 0 }
      this._rest.set(mesh, r)
      mesh.userData.__brest = r
      mesh.userData.restPosition = r.p      // OmniNode._save writes this instead of the displaced position
    }
    r.refs++
    st.acq.push(mesh)
  }

  _release (mesh, restore) {
    const r = this._rest.get(mesh)
    if (!r) return
    if (--r.refs > 0) return
    if (restore) { mesh.position.copy(r.p); mesh.quaternion.copy(r.q); mesh.scale.copy(r.s) }
    this._rest.delete(mesh)
    delete mesh.userData.__brest
    delete mesh.userData.restPosition
    delete mesh.userData.__bClaim
  }

  /** Absolute placement with an ease-in from the rest pose over the first ~0.6 s. */
  place (st, mesh, x, y, z) {
    if (st.blend >= 1) { mesh.position.set(x, y, z); return }
    const r = R(mesh).p, b = ease(st.blend)
    mesh.position.set(r.x + (x - r.x) * b, r.y + (y - r.y) * b, r.z + (z - r.z) * b)
  }

  /** Smoothly scale toward rest.scale * f. */
  scaleTo (mesh, f, dt, rate) {
    const r = R(mesh)
    if (!r) return
    const k = 1 - Math.exp(-rate * dt)
    mesh.scale.x += (r.s.x * f - mesh.scale.x) * k
    mesh.scale.y += (r.s.y * f - mesh.scale.y) * k
    mesh.scale.z += (r.s.z * f - mesh.scale.z) * k
  }

  markerR (mesh) { return 0.75 * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) + 0.25 }

  emit (name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })) }

  // ── emissive flash ──────────────────────────────────────────────────────

  flash (mesh, hex, amt) {
    const mat = mesh.material
    if (!mat || Array.isArray(mat) || !mat.emissive) return
    let f = this._flash.get(mesh)
    if (!f) { f = { amt: 0, hex, e0: mat.emissive.getHex(), i0: mat.emissiveIntensity ?? 1 }; this._flash.set(mesh, f) }
    f.hex = hex
    if (amt > f.amt) f.amt = amt
  }

  _stepFlash (dt) {
    if (this._flash.size === 0) return
    for (const [mesh, f] of this._flash) {
      f.amt -= dt * 2.5
      const mat = mesh.material
      if (f.amt <= 0.01 || !mat || !mat.emissive) { this._unflash(mesh); this._flash.delete(mesh); continue }
      mat.emissive.setHex(f.hex)
      mat.emissiveIntensity = Math.max(f.i0, f.amt * 1.4)
    }
  }

  _unflash (mesh) {
    const f = this._flash.get(mesh)
    const mat = mesh.material
    if (f && mat && mat.emissive) { mat.emissive.setHex(f.e0); mat.emissiveIntensity = f.i0 }
  }

  // ── drawing: one group, one line batch, four instanced bead meshes ──────

  _build () {
    this.group = new THREE.Group()
    this.group.name = 'OmniNodeBehavior'
    this._lp = new Float32Array(MAX_SEGS * 6)
    this._lc = new Float32Array(MAX_SEGS * 8)
    const g = new THREE.BufferGeometry()
    this._lpa = new THREE.BufferAttribute(this._lp, 3); this._lpa.setUsage(THREE.DynamicDrawUsage)
    this._lca = new THREE.BufferAttribute(this._lc, 4); this._lca.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', this._lpa); g.setAttribute('color', this._lca)
    g.setDrawRange(0, 0)
    this._lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }))
    this._lines.frustumCulled = false
    this._lines.renderOrder = 20
    this.group.add(this._lines)
    const sph = new THREE.SphereGeometry(0.5, 10, 8), box = new THREE.BoxGeometry(1, 1, 1)
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, MAX_BEADS); m.count = 0; m.frustumCulled = false; m.renderOrder = 21; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m }
    this._bs = mk(sph, new THREE.MeshBasicMaterial({ color: 0xffffff }))
    this._bb = mk(box, new THREE.MeshBasicMaterial({ color: 0xffffff }))
    const ol = () => new THREE.MeshBasicMaterial({ color: OUTLINE_HEX, side: THREE.BackSide })
    this._os = mk(sph, ol()); this._ob = mk(box, ol())
    this._bs.setColorAt(0, new THREE.Color(0xffffff)); this._bb.setColorAt(0, new THREE.Color(0xffffff))
    this._bc = BEAD_HEX.map(h => new THREE.Color(h))
    this.group.add(this._os, this._ob, this._bs, this._bb)
    this.ctx.scene.add(this.group)
    this._beads = []; this._free = []
    for (let i = MAX_BEADS - 1; i >= 0; i--) this._free.push(i)
    for (let i = 0; i < MAX_BEADS; i++) this._beads.push({ alive: false, a: null, b: null, t: 0, spd: 1, size: 0.2, col: 0, shape: 0, owner: null, leg: 1, i })
  }

  _camBasis () {
    const cam = this.ctx.camera
    if (!cam) return
    const e = cam.matrixWorld.elements
    this._rx = e[0]; this._ry = e[1]; this._rz = e[2]
    this._ux = e[4]; this._uy = e[5]; this._uz = e[6]
  }

  _seg (ax, ay, az, bx, by, bz, r, g, b, a) {
    const i = this._ln++
    const p = this._lp, c = this._lc, o = i * 6, k = i * 8
    p[o] = ax; p[o + 1] = ay; p[o + 2] = az; p[o + 3] = bx; p[o + 4] = by; p[o + 5] = bz
    c[k] = r; c[k + 1] = g; c[k + 2] = b; c[k + 3] = a; c[k + 4] = r; c[k + 5] = g; c[k + 6] = b; c[k + 7] = a
  }

  /** A line with a thin dark twin underneath (so it reads on white and black). */
  line (ax, ay, az, bx, by, bz, hex, alpha = 1) {
    if (this._ln >= MAX_SEGS - 2) return
    const o = this._ol, ox = this._ux * o, oy = this._uy * o, oz = this._uz * o
    this._seg(ax + ox, ay + oy, az + oz, bx + ox, by + oy, bz + oz, 0.08, 0.08, 0.11, alpha * 0.85)
    this._seg(ax, ay, az, bx, by, bz, hexR(hex), hexG(hex), hexB(hex), alpha)
  }

  /** Camera-facing ring. */
  ring (cx, cy, cz, r, hex, alpha = 1) { this.arc(cx, cy, cz, r, 1, hex, alpha) }

  /** Camera-facing arc from 12 o'clock, clockwise, covering `frac` of the circle. */
  arc (cx, cy, cz, r, frac, hex, alpha = 1) {
    if (!(r > 0) || !(frac > 0)) return
    const n = Math.max(1, Math.round(32 * Math.min(1, frac)))
    const rx = this._rx * r, ry = this._ry * r, rz = this._rz * r, ux = this._ux * r, uy = this._uy * r, uz = this._uz * r
    let px = cx + ux, py = cy + uy, pz = cz + uz            // angle index 8 = top (cos 0, sin 1)
    for (let i = 1; i <= n; i++) {
      const k = (8 - i + 64) & 31                           // clockwise
      const c = COS[k], s = SIN[k]
      const nx = cx + rx * c + ux * s, ny = cy + ry * c + uy * s, nz = cz + rz * c + uz * s
      this.line(px, py, pz, nx, ny, nz, hex, alpha)
      px = nx; py = ny; pz = nz
    }
  }

  // ── beads ───────────────────────────────────────────────────────────────

  spawnBead (st, a, b, col, shape, size, spd, leg) {
    if (!this._free.length) return null
    const bead = this._beads[this._free.pop()]
    bead.alive = true; bead.a = a; bead.b = b; bead.t = 0; bead.spd = spd; bead.size = size; bead.col = col & 3; bead.shape = shape; bead.owner = st; bead.leg = leg
    return bead
  }
  redirect (bead, a, b, leg) { bead.a = a; bead.b = b; bead.t = 0; bead.leg = leg }
  kill (bead) { if (!bead.alive) return; bead.alive = false; bead.owner = null; bead.a = bead.b = null; this._free.push(bead.i) }

  _stepBeads (dt) {
    let ns = 0, nb = 0
    for (let i = 0; i < MAX_BEADS; i++) {
      const b = this._beads[i]
      if (!b.alive) continue
      const st = b.owner
      if (!st || !st.alive) { this.kill(b); continue }
      const len = b.a.distanceTo(b.b)
      b.t += (b.spd * dt) / (len > 0.05 ? len : 0.05)
      if (b.t >= 1) {
        b.t = 1
        try { st.row.arrive(st, b, this) } catch (err) { this._fail(st, err); continue }
        if (!b.alive) continue
      }
      const t = b.t, sz = b.size
      _a.set(b.a.x + (b.b.x - b.a.x) * t, b.a.y + (b.b.y - b.a.y) * t, b.a.z + (b.b.z - b.a.z) * t)
      _s.setScalar(sz); _m4.compose(_a, _qI, _s)
      if (b.shape === 1) {
        this._bb.setMatrixAt(nb, _m4); this._bb.setColorAt(nb, this._bc[b.col])
        _s.setScalar(sz * 1.5); _m4.compose(_a, _qI, _s); this._ob.setMatrixAt(nb, _m4); nb++
      } else {
        this._bs.setMatrixAt(ns, _m4); this._bs.setColorAt(ns, this._bc[b.col])
        _s.setScalar(sz * 1.5); _m4.compose(_a, _qI, _s); this._os.setMatrixAt(ns, _m4); ns++
      }
    }
    this._bs.count = this._os.count = ns
    this._bb.count = this._ob.count = nb
    this._bs.instanceMatrix.needsUpdate = this._os.instanceMatrix.needsUpdate = true
    this._bb.instanceMatrix.needsUpdate = this._ob.instanceMatrix.needsUpdate = true
    if (this._bs.instanceColor) this._bs.instanceColor.needsUpdate = true
    if (this._bb.instanceColor) this._bb.instanceColor.needsUpdate = true
  }

  _commit () {
    this._lines.geometry.setDrawRange(0, this._ln * 2)
    this._lpa.needsUpdate = true
    this._lca.needsUpdate = true
  }
}
