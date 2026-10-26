/**
 * utils/OmniSoundParticleModel.js — the model of the SOUND PARTICLES of a sound node (V194). Pure: no DOM, no Three.js, no Web Audio.
 *
 * A node with sound can carry `data.soundParticles` (this model): a cloud of points whose COUNT, FORMATION and MOVEMENT come from the
 * FREQUENCY content of the sound (the 7 bands sub..brilliance + the level the engine reports). The cloud itself is drawn by
 * systems/OmniSoundParticles.js (THREE.Points in the existing scene), looked at by ui/OmniSoundParticleViewerPanel.js, edited by the
 * generated settings panel (agent 2) from PARTICLE_SCHEMA. Contract: docs/architecture/OMNISOUND_CONTRACT.md, design:
 * docs/architecture/OMNISOUNDPARTICLES_DESIGN.md.
 *
 * Exports
 *   PARTICLE_SCHEMA            groups of fields (same shape as SOUND_SCHEMA): count, formation, colour, motion, dynamics, performance
 *   PARTICLE_FIELDS            flat list of every field (key -> field) and PARTICLE_LIMITS (count 0..4000, global cap 20000)
 *   defaultParticles(), sanitizeParticles(raw)   a complete valid object / never throws / ignores unknown keys / safe on __proto__
 *   BAND_IDS, MOTION_TARGETS, bandToMotion(id, p)
 *   FORMATIONS                 [{ id, label, desc, fn }]  fn(i, n, params) -> { x, y, z }   (pure, deterministic, finite, inside radius / height)
 *   formationParams(p)         the formation parameters of a sanitized particles object
 *   createMotionState(), bandsToMotion(bands, mapping, state, dt)   the pure band smoother (attack / release) -> motion amounts
 *   lodCount(p, distance), allocateParticleBudget(requests, cap)    LOD by distance and the shared global cap (nearest nodes win)
 *   pitchHue(hz), particleBand(i, n)
 *
 * USER-facing module: it must never import a Dev* module.
 */

export const BAND_IDS = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'brilliance']
export const BAND_LABELS = { sub: 'Sub', bass: 'Bass', lowMid: 'Low mid', mid: 'Mid', highMid: 'High mid', presence: 'Presence', brilliance: 'Brilliance' }
export const BAND_RANGES = { sub: '20-60 Hz', bass: '60-250 Hz', lowMid: '250-500 Hz', mid: '500-2 kHz', highMid: '2-4 kHz', presence: '4-6 kHz', brilliance: '6-20 kHz' }
export const MOTION_TARGETS = ['none', 'radius', 'height', 'swirl', 'jitter', 'size', 'brightness', 'hue']
const TARGET_LABELS = { none: 'Nothing', radius: 'Radius (breathing)', height: 'Height (lift)', swirl: 'Swirl (spin)', jitter: 'Jitter (shake)', size: 'Size', brightness: 'Brightness', hue: 'Colour shift' }

export const PARTICLE_LIMITS = Object.freeze({ countMax: 4000, globalCap: 20000, globalCapMin: 200, barsColumns: 32 })

const CAP = (id) => id[0].toUpperCase() + id.slice(1)
/** The flat key of a band's mapping target / gain: mapSubTarget, mapBassGain ... */
export const targetKey = (id) => 'map' + CAP(id) + 'Target'
export const gainKey = (id) => 'map' + CAP(id) + 'Gain'

const DEFAULT_MAP = {
  sub: ['radius', 0.7], bass: ['radius', 1], lowMid: ['height', 0.6], mid: ['height', 1],
  highMid: ['swirl', 1], presence: ['brightness', 0.8], brilliance: ['jitter', 1],
}

// ── formations ───────────────────────────────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : (Number.isFinite(Number(v)) && v !== null && v !== '' && typeof v !== 'object' && typeof v !== 'boolean' ? Number(v) : d))
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/** Deterministic hash -> [0, 1). Pure integer mixing (no Math.random anywhere in this module). */
export function hash01 (i, seed = 0, k = 0) {
  let h = Math.imul((i | 0) + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((seed | 0) + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul((k | 0) + 0x165667b1, 0x27d4eb2f)
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

/** Normalised formation parameters (hostile input safe): { radius, height, turns, thickness, seed, layers }. */
export function formationParams (p) {
  const q = p && typeof p === 'object' ? p : {}
  return {
    radius: clamp(fin(q.radius, 2), 0, 1000),
    height: clamp(fin(q.height, 1.5), 0, 1000),
    turns: clamp(fin(q.turns, 3), 0.25, 24),
    thickness: clamp(fin(q.thickness, 0.25), 0, 1),
    seed: Math.round(clamp(fin(q.seed, 7), 0, 99999)),
    layers: Math.round(clamp(fin(q.layers, 3), 1, 12)),
  }
}

/** i and n made safe: n >= 1 integer, 0 <= i < n integer. */
function idx (i, n) {
  const nn = Math.max(1, Math.floor(fin(n, 1)))
  const ii = clamp(Math.floor(fin(i, 0)), 0, nn - 1)
  return [ii, nn]
}
/** Fibonacci sphere direction of particle i of n (unit vector). */
function fib (i, n) {
  const y = n > 1 ? 1 - (2 * (i + 0.5)) / n : 0
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const a = i * GOLDEN
  return [r * Math.cos(a), y, r * Math.sin(a)]
}

const F = {}
F.ring = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const a = (i / n) * TAU
  const r = p.radius * (1 - hash01(i, p.seed, 1) * p.thickness * 0.4)
  return { x: r * Math.cos(a), y: (hash01(i, p.seed, 2) - 0.5) * p.thickness * p.height * 0.4, z: r * Math.sin(a) }
}
F.sphere = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const [dx, dy, dz] = fib(i, n)
  const r = 1 - hash01(i, p.seed, 1) * p.thickness * 0.3
  return { x: dx * p.radius * r, y: dy * p.height * r, z: dz * p.radius * r }
}
F.spiral = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const t = (i + 0.5) / n
  const a = t * p.turns * TAU
  const r = p.radius * t
  return { x: r * Math.cos(a), y: (hash01(i, p.seed, 2) - 0.5) * p.thickness * p.height * 0.3, z: r * Math.sin(a) }
}
F.helix = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const strand = i % 2
  const t = Math.floor(i / 2) / Math.max(1, Math.ceil(n / 2) - 1 || 1)
  const a = t * p.turns * TAU + strand * Math.PI
  const r = p.radius * (1 - hash01(i, p.seed, 1) * p.thickness * 0.25)
  return { x: r * Math.cos(a), y: (n > 2 ? (2 * clamp(t, 0, 1) - 1) : 0) * p.height, z: r * Math.sin(a) }
}
F.galaxy = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const arms = 4
  const rr = Math.pow((i + 0.5) / n, 0.65)
  const r = p.radius * rr
  const a = (i % arms) * (TAU / arms) + rr * p.turns * 1.2 + (hash01(i, p.seed, 1) - 0.5) * p.thickness * 1.6
  const rj = clamp(r + (hash01(i, p.seed, 3) - 0.5) * p.thickness * p.radius * 0.1, 0, p.radius)
  return { x: rj * Math.cos(a), y: (hash01(i, p.seed, 2) - 0.5) * p.height * 0.3 * (1 - rr * 0.6), z: rj * Math.sin(a) }
}
F.lissajous = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const t = (i / n) * TAU
  const a = Math.max(1, Math.round(p.turns)), b = a + 1, c = a + 2
  return { x: p.radius * Math.sin(a * t + Math.PI / 2), y: p.height * Math.sin(c * t), z: p.radius * Math.sin(b * t) }
}
F.wave = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const side = Math.max(1, Math.ceil(Math.sqrt(n)))
  const gx = i % side, gz = Math.floor(i / side)
  const u = side > 1 ? (gx / (side - 1)) * 2 - 1 : 0
  const v = side > 1 ? (gz / (side - 1)) * 2 - 1 : 0
  return { x: u * p.radius, y: p.height * Math.sin(p.turns * Math.PI * u) * Math.cos(p.turns * Math.PI * v), z: v * p.radius }
}
F.bars = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const cols = PARTICLE_LIMITS.barsColumns
  const c = i % cols, r = Math.floor(i / cols)
  const rows = Math.max(1, Math.ceil(n / cols))
  return { x: -p.radius + ((c + 0.5) / cols) * 2 * p.radius, y: -p.height + ((r + 0.5) / rows) * 2 * p.height, z: (hash01(i, p.seed, 1) - 0.5) * p.thickness * p.radius * 0.3 }
}
F.cube = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const s = Math.max(1, Math.ceil(Math.cbrt(n)))
  const gx = i % s, gy = Math.floor(i / s) % s, gz = Math.floor(i / (s * s))
  const m = (g) => (s > 1 ? (g / (s - 1)) * 2 - 1 : 0)
  return { x: m(gx) * p.radius, y: m(gy) * p.height, z: m(gz) * p.radius }
}
F.burst = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const [dx, dy, dz] = fib(i, n)
  const r = 0.12 + 0.88 * Math.pow(hash01(i, p.seed, 1), 1 + p.thickness)
  return { x: dx * p.radius * r, y: dy * p.height * r, z: dz * p.radius * r }
}
F.torus = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const rings = Math.max(3, Math.round(Math.sqrt(n / 2)))
  const u = ((i % rings) / rings) * TAU
  const v = (Math.floor(i / rings) * GOLDEN) % TAU
  const R = p.radius * 0.7, rr = p.radius * 0.3 * (1 - hash01(i, p.seed, 1) * p.thickness * 0.5)
  return { x: (R + rr * Math.cos(v)) * Math.cos(u), y: p.height * 0.43 * Math.sin(v) * (rr / Math.max(1e-9, p.radius * 0.3)), z: (R + rr * Math.cos(v)) * Math.sin(u) }
}
F.cloud = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const [dx, dy, dz] = fib(Math.floor(hash01(i, p.seed, 5) * n), n)
  const r = Math.cbrt(hash01(i, p.seed, 6))
  return { x: dx * p.radius * r, y: dy * p.height * r, z: dz * p.radius * r }
}
F.disc = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const r = p.radius * Math.sqrt((i + 0.5) / n)
  const a = i * GOLDEN
  return { x: r * Math.cos(a), y: (hash01(i, p.seed, 2) - 0.5) * p.thickness * p.height * 0.2, z: r * Math.sin(a) }
}
F.funnel = (i0, n0, p0) => {
  const [i, n] = idx(i0, n0); const p = formationParams(p0)
  const t = (i + 0.5) / n
  const a = t * p.turns * TAU * 2
  const r = p.radius * (1 - t) * (1 - hash01(i, p.seed, 1) * p.thickness * 0.3)
  return { x: r * Math.cos(a), y: p.height * (2 * t - 1), z: r * Math.sin(a) }
}

const FORMATION_META = [
  ['ring', 'Ring', 'A flat circle of particles around the node.'],
  ['sphere', 'Sphere shell', 'An evenly spread shell (Fibonacci sphere); height is the vertical radius.'],
  ['spiral', 'Spiral', 'A flat Archimedean spiral; "turns" is how many times it winds.'],
  ['helix', 'Helix', 'A double helix standing up, height tall.'],
  ['galaxy', 'Galaxy', 'Four spiral arms thickening toward the middle.'],
  ['lissajous', 'Lissajous', 'A looping 3D Lissajous curve; "turns" sets the frequency ratio.'],
  ['wave', 'Wave sheet', 'A square sheet of particles with a standing wave on it.'],
  ['bars', 'Bars (spectrum)', '32 columns that rise and fall with the spectrum, bass on the left.'],
  ['cube', 'Cube lattice', 'A regular 3D grid of particles.'],
  ['burst', 'Burst', 'Rays flying out of the middle with random lengths.'],
  ['torus', 'Torus', 'A doughnut of particles.'],
  ['cloud', 'Cloud', 'A random ball (denser in the middle).'],
  ['disc', 'Disc (sunflower)', 'A flat disc filled the way sunflower seeds are.'],
  ['funnel', 'Funnel', 'A cone winding up from a wide base to a point.'],
]
export const FORMATIONS = FORMATION_META.map(([id, label, desc]) => ({ id, label, desc, fn: F[id] }))
export const FORMATION_IDS = FORMATIONS.map(f => f.id)
export const getFormation = (id) => FORMATIONS.find(f => f.id === id) ?? FORMATIONS[0]
/** Column (0..31) of particle i in the 'bars' formation. */
export const barColumn = (i) => ((Math.floor(fin(i, 0)) % PARTICLE_LIMITS.barsColumns) + PARTICLE_LIMITS.barsColumns) % PARTICLE_LIMITS.barsColumns
/** Which of the 7 bands particle i of n belongs to (by index; bars: by column). Used for the band colouring. */
export function particleBand (i, n, formation = 'ring') {
  const nn = Math.max(1, Math.floor(fin(n, 1))); const ii = clamp(Math.floor(fin(i, 0)), 0, nn - 1)
  if (formation === 'bars') return Math.min(6, Math.floor((barColumn(ii) / PARTICLE_LIMITS.barsColumns) * 7))
  return Math.min(6, Math.floor((ii / nn) * 7))
}
/** Hue 0..1 of a pitch: the position inside its octave on the chromatic circle (A = 0). 0 / NaN -> 0. */
export function pitchHue (hz) {
  const f = fin(hz, 0)
  if (!(f > 0)) return 0
  const s = Math.log2(f / 440) * 12
  return (((s % 12) + 12) % 12) / 12
}

// ── schema ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const num = (key, label, min, max, step, def, desc, unit = '', extra = {}) => ({ key, label, type: 'number', min, max, step, unit, default: def, desc, ...extra })
const bool = (key, label, def, desc) => ({ key, label, type: 'bool', default: def, desc })
const color = (key, label, def, desc) => ({ key, label, type: 'color', default: def, desc })
const enm = (key, label, options, def, desc) => ({ key, label, type: 'enum', options: options.map(o => (typeof o === 'string' ? { value: o, label: o } : { value: o[0], label: o[1] })), default: def, desc })

const mapFields = []
for (const id of BAND_IDS) {
  mapFields.push(enm(targetKey(id), `${BAND_LABELS[id]} drives`, MOTION_TARGETS.map(t => [t, TARGET_LABELS[t]]), DEFAULT_MAP[id][0], `What the ${BAND_LABELS[id].toLowerCase()} band (${BAND_RANGES[id]}) moves in the cloud.`))
  mapFields.push(num(gainKey(id), `${BAND_LABELS[id]} gain`, 0, 4, 0.05, DEFAULT_MAP[id][1], `How strongly the ${BAND_LABELS[id].toLowerCase()} band drives its target (0 = not at all, 1 = normal).`, '×'))
}

export const PARTICLE_SCHEMA = [
  { id: 'count', label: 'Count & Size', desc: 'How many particles, how big, how they look as points.', fields: [
    bool('enabled', 'Particles on', true, 'Switches the particle cloud of this node on or off (the node must have sound enabled).'),
    num('count', 'Particle count', 0, PARTICLE_LIMITS.countMax, 10, 600, 'How many particles this node draws (0 to 4000). Far nodes draw fewer (LOD) and all nodes share a global cap.', '', { int: true }),
    num('countByLevel', 'Count follows level', 0, 1, 0.05, 0, 'At 0 the whole cloud is always there. Higher: only part of the cloud is visible when the sound is quiet, all of it at full level.', ''),
    num('size', 'Particle size', 0.01, 1, 0.01, 0.08, 'Size of one point in scene units (the real size shrinks with distance).', 'units'),
    num('sizeByLevel', 'Size follows level', 0, 3, 0.05, 0.8, 'How much the sound level makes the points bigger (0 = never).', '×'),
    enm('shape', 'Point shape', [['glow', 'Soft glow'], ['disc', 'Disc'], ['square', 'Square']], 'glow', 'Look of one point: a soft glowing orb, a flat disc or a hard square.'),
    num('opacity', 'Opacity', 0.05, 1, 0.05, 0.85, 'How see-through the points are (1 = solid).', ''),
  ] },
  { id: 'formation', label: 'Formation', desc: 'The shape the particles sit in when nothing moves them.', fields: [
    enm('formation', 'Formation', FORMATIONS.map(f => [f.id, f.label]), 'sphere', 'The resting shape of the cloud.'),
    num('radius', 'Spread radius', 0.2, 40, 0.1, 2, 'Half the width of the formation, in scene units.', 'units'),
    num('height', 'Height', 0, 40, 0.1, 1.5, 'Half the height of the formation, in scene units.', 'units'),
    num('turns', 'Turns / waves', 0.25, 12, 0.25, 3, 'Windings of a spiral, helix, galaxy or funnel; waves of the wave sheet; frequency ratio of the Lissajous.', ''),
    num('thickness', 'Thickness / scatter', 0, 1, 0.05, 0.25, 'How much the particles scatter off the perfect shape (0 = exact).', ''),
    num('layers', 'Layers', 1, 12, 1, 3, 'Reserved detail for layered formations (rings, rows).', '', { int: true }),
    num('seed', 'Random seed', 0, 9999, 1, 7, 'Changes the random scatter. The same seed always gives the same cloud.', '', { int: true }),
    num('offsetY', 'Lift above node', -20, 20, 0.1, 0, 'Moves the whole cloud up (or down) relative to the node.', 'units'),
    num('tilt', 'Tilt', -90, 90, 1, 0, 'Tips the cloud forward by this many degrees.', '°'),
  ] },
  { id: 'colour', label: 'Colour & Blend', desc: 'Colours, glow and how the points mix with the scene.', fields: [
    enm('colorMode', 'Colour mode', [['solid', 'Solid colour'], ['band', 'By band (rainbow)'], ['pitch', 'By pitch (note hue)'], ['gradient', 'Gradient']], 'band', 'Solid: one colour. By band: each part of the cloud is a band and glows with it. By pitch: the colour follows the note being played. Gradient: between two colours.'),
    color('color', 'Colour', '#7fd0ff', 'The main colour (solid, pitch brightness base and the first gradient colour).'),
    color('color2', 'Second colour', '#ff7fd0', 'The second colour of the gradient.'),
    enm('blend', 'Blend', [['additive', 'Additive (glow)'], ['normal', 'Normal']], 'additive', 'Additive: overlapping points add light and look like a glow. Normal: points cover each other.'),
    num('brightness', 'Brightness', 0.1, 2, 0.05, 1, 'Base brightness of the points.', '×'),
    num('saturation', 'Saturation', 0, 1, 0.05, 0.8, 'How colourful the by-band and by-pitch colours are.', ''),
    num('hueSpread', 'Hue spread', 0, 360, 5, 280, 'How far around the colour wheel the seven bands spread (by-band mode).', '°'),
    bool('depthTest', 'Hide behind objects', true, 'On: nodes and walls in front hide the particles. Off: the particles always show.'),
  ] },
  { id: 'motion', label: 'Motion mapping', desc: 'Which band of the sound moves which part of the cloud, and how far.', fields: [
    num('radiusAmount', 'Radius swing', 0, 3, 0.05, 0.6, 'How far the cloud breathes out at full signal, as a fraction of the radius.', '×'),
    num('heightAmount', 'Height lift', 0, 20, 0.1, 1.5, 'How high the particles rise at full signal.', 'units'),
    num('swirlAmount', 'Swirl speed', 0, 20, 0.1, 3, 'How fast the particles spin around the node at full signal.', 'rad/s'),
    num('jitterAmount', 'Jitter shake', 0, 5, 0.05, 0.25, 'How far the particles shake at full signal.', 'units'),
    num('sizeAmount', 'Size boost', 0, 6, 0.1, 1.5, 'How much bigger the points get at full signal.', '×'),
    num('brightnessAmount', 'Brightness boost', 0, 4, 0.1, 1, 'How much brighter the points get at full signal.', '×'),
    ...mapFields,
  ] },
  { id: 'dynamics', label: 'Dynamics', desc: 'How quickly the cloud follows the sound, spins and leaves trails.', fields: [
    num('smoothing', 'Input smoothing', 0, 0.99, 0.01, 0.5, 'Calms a jumpy sound before it moves anything (0 = raw, 0.99 = very calm).', ''),
    num('attackMs', 'Attack', 1, 2000, 1, 20, 'How fast the motion rises when a band gets louder.', 'ms', { int: true }),
    num('releaseMs', 'Release', 1, 5000, 1, 250, 'How slowly the motion falls when a band gets quieter.', 'ms', { int: true }),
    num('rotationSpeed', 'Rotation speed', -360, 360, 1, 12, 'Turns the whole cloud (degrees per second; negative turns the other way).', '°/s'),
    enm('rotationAxis', 'Rotation axis', [['y', 'Around (Y)'], ['x', 'Forward (X)'], ['z', 'Sideways (Z)'], ['tumble', 'Tumble']], 'y', 'Which way the cloud turns.'),
    num('noiseAmount', 'Noise', 0, 2, 0.05, 0.15, 'Slow organic wandering of every particle.', 'units'),
    num('noiseSpeed', 'Noise speed', 0, 5, 0.1, 0.6, 'How fast the wandering changes.', '×'),
    num('trail', 'Trails', 0, 0.95, 0.05, 0, 'A fading ghost behind moving particles (0 = none). Costs a second layer of points.', ''),
    bool('respondOnlyWhilePlaying', 'Respond only while playing', true, 'On: the cloud only reacts while the node is making sound. Off: it also follows the release tail and any analysis.'),
    num('idleMotion', 'Idle motion', 0, 1, 0.05, 0, 'How much the cloud keeps drifting and rotating when silent (0 = it rests completely and costs nothing).', ''),
  ] },
  { id: 'performance', label: 'Performance', desc: 'Keeps many sound nodes light: fewer particles far away, pausing when unseen.', fields: [
    bool('lodEnabled', 'Fewer when far (LOD)', true, 'Draw fewer particles as the camera moves away from the node.'),
    num('lodNear', 'Full detail until', 1, 200, 1, 12, 'Distance up to which all particles are drawn.', 'units'),
    num('lodFar', 'Minimum detail from', 2, 400, 1, 60, 'Distance from which only the minimum share is drawn.', 'units'),
    num('lodMinPercent', 'Minimum share', 0, 100, 5, 25, 'The share of the count that is still drawn at the far distance.', '%'),
    num('cullDistance', 'Hide beyond', 0, 1000, 5, 150, 'Beyond this distance the cloud is hidden and paused (0 = never).', 'units'),
    bool('pauseOffscreen', 'Pause when off screen', true, 'Do not move the particles while the node is outside the view.'),
    bool('pauseWhenSilent', 'Pause when silent', true, 'Stop all work for this cloud while it has settled and nothing plays.'),
    enm('updateRate', 'Update rate', [['every', 'Every frame'], ['30', '30 per second'], ['20', '20 per second'], ['15', '15 per second']], 'every', 'How often the particle positions are recomputed (the rest of the frames reuse them).'),
    num('nodeCap', 'Per-node cap', 0, PARTICLE_LIMITS.countMax, 50, PARTICLE_LIMITS.countMax, 'Never draw more than this many particles for this node, whatever the count.', '', { int: true }),
  ] },
]

export const PARTICLE_FIELDS = (() => { const m = {}; for (const g of PARTICLE_SCHEMA) for (const f of g.fields) m[f.key] = f; return m })()
export const PARTICLE_KEYS = Object.keys(PARTICLE_FIELDS)

// ── defaults / sanitize ──────────────────────────────────────────────────────────────────────────────────────────────

export function defaultParticles () {
  const o = {}
  for (const k of PARTICLE_KEYS) o[k] = PARTICLE_FIELDS[k].default
  return o
}

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#[0-9a-f]{6}$/i
function cleanColor (v, d) {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 0xffffff) return '#' + Math.round(v).toString(16).padStart(6, '0')
  if (typeof v !== 'string') return d
  const s = v.trim()
  if (HEX6.test(s)) return s.toLowerCase()
  const m = HEX3.exec(s)
  return m ? ('#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase() : d
}
function cleanField (f, v) {
  switch (f.type) {
    case 'number': {
      let x = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
      if (!Number.isFinite(x)) x = f.default
      x = clamp(x, f.min, f.max)
      if (f.int) x = Math.round(x)
      return x
    }
    case 'bool': return typeof v === 'boolean' ? v : (v === 'true' || v === 1 ? true : (v === 'false' || v === 0 ? false : f.default))
    case 'enum': return typeof v === 'string' && f.options.some(o => o.value === v) ? v : f.default
    case 'color': return cleanColor(v, f.default)
    default: return f.default
  }
}

/** A complete valid particles object from anything. Never throws; unknown keys are dropped; __proto__ / getters / non-objects are harmless. */
export function sanitizeParticles (raw) {
  const out = {}
  const has = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
  for (const k of PARTICLE_KEYS) {
    const f = PARTICLE_FIELDS[k]
    let v
    if (has) { try { v = Object.prototype.hasOwnProperty.call(raw, k) ? raw[k] : undefined } catch (_) { v = undefined } }
    out[k] = v === undefined ? f.default : cleanField(f, v)
  }
  if (out.lodFar <= out.lodNear) out.lodFar = Math.min(400, out.lodNear + 1)
  return out
}

/** { target, gain } of a band in a sanitized particles object. */
export function bandToMotion (id, p) {
  const q = p && typeof p === 'object' ? p : {}
  const t = q[targetKey(id)]
  const g = fin(q[gainKey(id)], DEFAULT_MAP[id]?.[1] ?? 0)
  return { target: MOTION_TARGETS.includes(t) ? t : (DEFAULT_MAP[id]?.[0] ?? 'none'), gain: clamp(g, 0, 4) }
}

// ── the band smoother ────────────────────────────────────────────────────────────────────────────────────────────────

export const MOTION_OUT_MAX = 4

/** The memory of bandsToMotion for one cloud (create once, reuse every frame; nothing is allocated afterwards). */
export function createMotionState () {
  return { lp: new Array(7).fill(0), env: new Array(7).fill(0), levelLp: 0, level: 0, radius: 0, height: 0, swirl: 0, jitter: 0, size: 0, brightness: 0, hue: 0, energy: 0 }
}

const num01 = (v) => { const x = typeof v === 'number' ? v : Number(v); return Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0 }

/**
 * The pure band smoother: bands { sub..brilliance, level? } (0..1 each, null = silence) + mapping (a sanitized particles object) + state
 * (createMotionState) + dt seconds -> the same `state` filled with the motion amounts radius / height / swirl / jitter / size /
 * brightness / hue (each 0..MOTION_OUT_MAX), `level` (0..1, smoothed with the same attack / release) and `energy` (mean of the bands).
 *   1. input smoothing    lp = raw + (lp - raw) * smoothing^(dt * 60)       (frame-rate independent; smoothing 0 = raw)
 *   2. attack / release   env += (lp - env) * (1 - exp(-dt / time))         time = attackMs when rising, releaseMs when falling
 *   3. mapping            motion[target of band] += env[band] * gain of band
 * dt <= 0, NaN, negative bands, a missing mapping: all safe (nothing moves / defaults are used). No allocation.
 */
export function bandsToMotion (bands, mapping, state, dt) {
  const s = state
  const h = fin(dt, 0)
  const d = h < 0 ? 0 : h > 0.25 ? 0.25 : h
  const m = mapping && typeof mapping === 'object' ? mapping : null
  const smoothing = clamp(fin(m?.smoothing, 0.5), 0, 0.99)
  const aMs = clamp(fin(m?.attackMs, 20), 1, 2000) / 1000
  const rMs = clamp(fin(m?.releaseMs, 250), 1, 5000) / 1000
  const kIn = d > 0 ? Math.pow(smoothing, d * 60) : 1
  const kA = d > 0 ? 1 - Math.exp(-d / aMs) : 0
  const kR = d > 0 ? 1 - Math.exp(-d / rMs) : 0
  s.radius = s.height = s.swirl = s.jitter = s.size = s.brightness = s.hue = 0
  let sum = 0
  for (let b = 0; b < 7; b++) {
    const id = BAND_IDS[b]
    const raw = bands ? num01(bands[id]) : 0
    s.lp[b] = d > 0 ? raw + (s.lp[b] - raw) * kIn : s.lp[b]
    s.env[b] += (s.lp[b] - s.env[b]) * (s.lp[b] > s.env[b] ? kA : kR)
    if (!Number.isFinite(s.env[b])) s.env[b] = 0
    sum += s.env[b]
    let target, gain
    if (m) {
      target = m[targetKey(id)]; if (!MOTION_TARGETS.includes(target)) target = DEFAULT_MAP[id][0]
      gain = clamp(fin(m[gainKey(id)], DEFAULT_MAP[id][1]), 0, 4)
    } else { target = DEFAULT_MAP[id][0]; gain = DEFAULT_MAP[id][1] }
    if (target !== 'none') s[target] += s.env[b] * gain
  }
  const lv = bands ? num01(bands.level) : 0
  s.levelLp = d > 0 ? lv + (s.levelLp - lv) * kIn : s.levelLp
  s.level += (s.levelLp - s.level) * (s.levelLp > s.level ? kA : kR)
  if (!Number.isFinite(s.level)) s.level = 0
  s.energy = sum / 7
  s.radius = Math.min(MOTION_OUT_MAX, s.radius); s.height = Math.min(MOTION_OUT_MAX, s.height); s.swirl = Math.min(MOTION_OUT_MAX, s.swirl)
  s.jitter = Math.min(MOTION_OUT_MAX, s.jitter); s.size = Math.min(MOTION_OUT_MAX, s.size); s.brightness = Math.min(MOTION_OUT_MAX, s.brightness); s.hue = Math.min(MOTION_OUT_MAX, s.hue)
  return s
}

// ── LOD and the shared cap ───────────────────────────────────────────────────────────────────────────────────────────

/** The count a node draws at `distance` from the camera: count capped by nodeCap, then thinned by LOD (never below lodMinPercent). Integer >= 0. */
export function lodCount (p, distance) {
  const q = sanitizeParticles(p)
  let n = Math.min(q.count, q.nodeCap)
  if (q.lodEnabled) {
    const d = fin(distance, 0)
    if (d > q.lodNear) {
      const t = clamp((d - q.lodNear) / Math.max(1e-6, q.lodFar - q.lodNear), 0, 1)
      n = n * (1 - t * (1 - q.lodMinPercent / 100))
    }
  }
  return Math.max(0, Math.floor(n + 1e-6))
}

/**
 * Shares the global cap between nodes: requests [{ id, want, distance }], cap -> Map id -> granted. The NEAREST node is served first
 * (ties: the request order), so far nodes lose particles first; the sum never exceeds the cap. Pure.
 */
export function allocateParticleBudget (requests, cap = PARTICLE_LIMITS.globalCap) {
  const out = new Map()
  let left = Math.max(0, Math.floor(clamp(fin(cap, PARTICLE_LIMITS.globalCap), 0, 1e6)))
  const list = Array.isArray(requests) ? requests.map((r, k) => ({ id: r?.id, want: Math.max(0, Math.floor(fin(r?.want, 0))), d: fin(r?.distance, 0), k })) : []
  list.sort((a, b) => (a.d - b.d) || (a.k - b.k))
  for (const r of list) { const g = Math.min(r.want, left); left -= g; out.set(r.id, g) }
  return out
}

// ── layout + displacement kernels (shared by the scene system and the formation viewer, so both always show the same cloud) ──────────────

const rev13 = (v) => { let r = 0; for (let b = 0; b < 13; b++) { r = (r << 1) | (v & 1); v >>= 1 } return r }

/**
 * The resting cloud of a particles object, in IMPORTANCE order: slot s holds formation index order[s], sorted by the bit-reversed
 * index (van der Corput), so that the first k slots are an even, representative subset of the whole shape for every k. LOD, the
 * global cap and "count follows level" therefore only change how many slots are drawn (a draw range), never the layout.
 * Returns { n, pos: Float32Array(3n) (tilt baked), nr (0..1 distance from the axis), rotF (differential swirl factor), band (0..6),
 * bcol (bars column), t (0..1 along the formation), phase: Float32Array(3n) (per-particle noise phases), j: Uint16Array (formation index) }.
 * Deterministic: the same particles object always gives the same arrays. Allocates (call it on a settings change, not per frame).
 */
export function layoutFormation (p0, nOverride) {
  const p = sanitizeParticles(p0)
  const n = Math.max(0, Math.min(PARTICLE_LIMITS.countMax, Math.floor(fin(nOverride, Math.min(p.count, p.nodeCap)))))
  const L = { n, pos: new Float32Array(n * 3), nr: new Float32Array(n), rotF: new Float32Array(n), band: new Uint8Array(n), bcol: new Uint8Array(n), t: new Float32Array(n), phase: new Float32Array(n * 3), j: new Uint16Array(n), formation: p.formation }
  if (n === 0) return L
  const order = new Array(n)
  for (let j = 0; j < n; j++) order[j] = j
  order.sort((a, b) => rev13(a) - rev13(b) || a - b)
  const f = getFormation(p.formation)
  const fp = { radius: p.radius, height: p.height, turns: p.turns, thickness: p.thickness, seed: p.seed, layers: p.layers }
  const tr = (p.tilt * Math.PI) / 180, ct = Math.cos(tr), st = Math.sin(tr)
  const invR = 1 / Math.max(1e-6, p.radius)
  for (let s = 0; s < n; s++) {
    const j = order[s]
    const q = f.fn(j, n, fp)
    const o = s * 3
    L.pos[o] = q.x; L.pos[o + 1] = q.y * ct - q.z * st; L.pos[o + 2] = q.y * st + q.z * ct
    L.phase[o] = hash01(j, p.seed, 11) * TAU; L.phase[o + 1] = hash01(j, p.seed, 12) * TAU; L.phase[o + 2] = hash01(j, p.seed, 13) * TAU
    const nr = clamp(Math.hypot(q.x, q.z) * invR, 0, 1)
    L.nr[s] = nr; L.rotF[s] = 1.25 - 0.5 * nr
    L.band[s] = particleBand(j, n, p.formation)
    L.bcol[s] = barColumn(j)
    L.t[s] = n > 1 ? j / (n - 1) : 0
    L.j[s] = j
  }
  return L
}

/** Memory of the 'bars' formation: the 32 smoothed column values. */
export function createBarState () { return { cols: new Float32Array(PARTICLE_LIMITS.barsColumns), raw: new Float32Array(PARTICLE_LIMITS.barsColumns), bin: null, key: '' } }

/**
 * Updates the 32 'bars' columns (log spaced 30 Hz..18 kHz) from the live spectrum (Uint8Array 0..255) of an analysis, or, without a
 * spectrum, from the smoothed band envelopes `env` (7 numbers). attack / release come from the particles object; dt in seconds.
 */
export function updateBarColumns (bs, analysis, env, p, dt) {
  const COLS = PARTICLE_LIMITS.barsColumns
  const spec = analysis && analysis.spectrum && analysis.spectrum.length > 8 ? analysis.spectrum : null
  if (spec) {
    const bins = (analysis.binCount | 0) || spec.length
    const nyq = (Number(analysis.sampleRate) || 44100) / 2
    const key = bins + '|' + nyq
    if (bs.key !== key || !bs.bin) {
      bs.bin = new Uint16Array(COLS * 2); bs.key = key
      for (let i = 0; i < COLS; i++) {
        const f0 = 30 * Math.pow(18000 / 30, i / COLS), f1 = 30 * Math.pow(18000 / 30, (i + 1) / COLS)
        const b0 = clamp(Math.floor((f0 / nyq) * bins), 0, bins - 1), b1 = clamp(Math.ceil((f1 / nyq) * bins), b0 + 1, bins)
        bs.bin[i * 2] = b0; bs.bin[i * 2 + 1] = b1
      }
    }
    for (let i = 0; i < COLS; i++) {
      let mx = 0
      for (let b = bs.bin[i * 2], e = Math.min(spec.length, bs.bin[i * 2 + 1]); b < e; b++) if (spec[b] > mx) mx = spec[b]
      bs.raw[i] = mx / 255
    }
  } else {
    for (let i = 0; i < COLS; i++) { const f = (i / (COLS - 1)) * 6; const b0 = Math.floor(f), b1 = Math.min(6, b0 + 1), t = f - b0; bs.raw[i] = (env?.[b0] || 0) * (1 - t) + (env?.[b1] || 0) * t }
  }
  const h = clamp(fin(dt, 0), 0, 0.25)
  const kA = 1 - Math.exp(-h / (clamp(fin(p?.attackMs, 20), 1, 2000) / 1000)), kR = 1 - Math.exp(-h / (clamp(fin(p?.releaseMs, 250), 1, 5000) / 1000))
  for (let i = 0; i < COLS; i++) { const r = bs.raw[i]; bs.cols[i] += (r - bs.cols[i]) * (r > bs.cols[i] ? kA : kR) }
}

/**
 * The displacement kernel: writes the first k particles of layout L, moved by the motion amounts m (bandsToMotion output), into out
 * (Float32Array, 3 per particle): radius breathing (all axes), height lift as a wave running out from the axis, differential swirl by
 * `swirlAngle` (radians, accumulated by the caller), slow noise (noise units, already scaled by idle), jitter. 'bars' ignores breathing
 * and lift on Y and sets each column's height from bs.cols. No allocation. t = seconds (for the waves / noise / jitter).
 */
export function displaceParticles (out, L, p, m, k, t, swirlAngle, noise, bs) {
  const base = L.pos, ph = L.phase, rotF = L.rotF, nr = L.nr, bcol = L.bcol
  const bars = p.formation === 'bars' && !!bs
  const rScale = 1 + p.radiusAmount * m.radius
  const lift = p.heightAmount * m.height
  const jit = p.jitterAmount * m.jitter
  const nsp = p.noiseSpeed
  const H = p.height
  const wob = t * 2.2
  const kk = Math.min(k | 0, L.n)
  for (let s = 0; s < kk; s++) {
    const o = s * 3
    let x = base[o] * rScale, y, z = base[o + 2] * rScale
    if (bars) y = -H + (base[o + 1] + H) * (0.08 + 0.92 * clamp(bs.cols[bcol[s]] * 1.1, 0, 1))
    else {
      y = base[o + 1] * rScale
      if (lift !== 0) y += lift * (0.5 + 0.5 * Math.sin(wob + ph[o] + nr[s] * 4))
    }
    if (swirlAngle !== 0) {
      const ang = swirlAngle * rotF[s], cs = Math.cos(ang), sn = Math.sin(ang)
      const nx = x * cs - z * sn; z = x * sn + z * cs; x = nx
    }
    if (noise > 1e-4) {
      const nt = t * nsp
      x += Math.sin(nt + ph[o]) * noise; y += Math.sin(nt * 1.31 + ph[o + 1]) * noise; z += Math.sin(nt * 0.87 + ph[o + 2]) * noise
    }
    if (jit > 1e-4) {
      const jt = t * 29
      x += Math.sin(jt + ph[o] * 5.3) * jit; y += Math.sin(jt * 1.13 + ph[o + 1] * 4.1) * jit; z += Math.sin(jt * 0.91 + ph[o + 2] * 6.7) * jit
    }
    out[o] = x; out[o + 1] = y; out[o + 2] = z
  }
}

/** Colour (0..1 rgb into out[o..o+2]) of band b in 'by band' mode: hue from the base hue `h0` (0..1) spread over hueSpread degrees. */
export function bandColor (b, h0, p, out, o, intensity = 1) {
  hslToRgb(h0 + (clamp(b, 0, 6) / 6) * (p.hueSpread / 360), p.saturation, 0.55, out, o)
  out[o] *= intensity; out[o + 1] *= intensity; out[o + 2] *= intensity
}
export function hexToRgb01 (hex, out) {
  const n = parseInt(String(hex).slice(1), 16) || 0
  out[0] = ((n >> 16) & 255) / 255; out[1] = ((n >> 8) & 255) / 255; out[2] = (n & 255) / 255
  return out
}
export function rgbToHue (r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  if (d < 1e-6) return 0
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h /= 6; return h < 0 ? h + 1 : h
}
export function hslToRgb (h, s, l, out, o) {
  h = ((h % 1) + 1) % 1
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h * 6) % 2 - 1)), m = l - c / 2
  const k = Math.floor(h * 6)
  let r = 0, g = 0, b = 0
  if (k === 0) { r = c; g = x } else if (k === 1) { r = x; g = c } else if (k === 2) { g = c; b = x } else if (k === 3) { g = x; b = c } else if (k === 4) { r = x; b = c } else { r = c; b = x }
  out[o] = r + m; out[o + 1] = g + m; out[o + 2] = b + m
}
