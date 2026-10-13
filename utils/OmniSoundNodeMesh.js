/**
 * utils/OmniSoundNodeMesh.js — the GEOMETRY system of the SoundNode (V194): the mesh, and what it does every frame.
 *
 * The node mesh is a small speaker-bell (a lathe shell, double sided, so the node's normal raycast / selection / colour / move / StrictAlign work as for
 * any node) with VISUAL children that react to the sound:
 *   core        a glowing icosahedron: scale + brightness follow the level (loudness); it breathes slowly when the sound is silent
 *   ring low    a ring: scale + opacity follow the sub + bass band
 *   ring mid    low-mid + mid
 *   ring high   high-mid + presence + brilliance
 *   glyphs      a small play triangle (idle) or pause bars (playing), above the bell
 * Colour: the sound's own colour (META `color`) when it has one, else a hue from the pitch (the note class round the colour wheel).
 * Dimmed: a sound that is disabled (very dim, no glyph) or muted (half).
 *
 * The children are not hit-tested (OmniNode raycasts the node meshes non-recursively), so they never change selection. Geometries are shared
 * (never disposed with a node); each node owns its materials, which releaseSoundMesh() disposes. No DOM, no storage, no audio here: the engine's
 * analysis is passed IN to reactSoundMesh(), so the reaction is testable with a fake analysis, allocates nothing per frame and is safe with null.
 */

import * as THREE from 'three'

export const SOUND_NODE_RADIUS = 0.55
const BAND_LOW = ['sub', 'bass']
const BAND_MID = ['lowMid', 'mid']
const BAND_HIGH = ['highMid', 'presence', 'brilliance']

/** Every sound node mesh alive (the runtime iterates this set each frame; nothing is allocated for it). */
export const SOUND_LIVE = new Set()
export const liveSoundMeshes = () => SOUND_LIVE

const G = {}
function shared () {
  if (G.shell) return G
  const prof = [[0.07, -0.42], [0.2, -0.38], [0.3, -0.2], [0.42, 0.08], [0.55, 0.42], [0.5, 0.44], [0.37, 0.1], [0.26, -0.18], [0.14, -0.3], [0.05, -0.34]]
  G.shell = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 20)
  G.core = new THREE.IcosahedronGeometry(0.2, 1)
  G.ring = [0.66, 0.82, 1.0].map(r => new THREE.TorusGeometry(r, 0.014, 6, 48))
  const tri = new THREE.Shape(); tri.moveTo(-0.07, -0.1); tri.lineTo(0.11, 0); tri.lineTo(-0.07, 0.1); tri.closePath()
  G.play = new THREE.ShapeGeometry(tri)
  const bar = (x) => { const s = new THREE.Shape(); s.moveTo(x, -0.1); s.lineTo(x + 0.055, -0.1); s.lineTo(x + 0.055, 0.1); s.lineTo(x, 0.1); s.closePath(); return s }
  G.pause = new THREE.ShapeGeometry([bar(-0.1), bar(0.045)])
  return G
}

const WHITE = new THREE.Color(1, 1, 1)
const SCRATCH = new THREE.Color()
const c01 = (v) => (v > 0 ? (v < 1 ? v : 1) : 0)
const HEX = /^#[0-9a-fA-F]{6}$/

/** The pitch class of a frequency as a hue 0..1 (an octave up gives the same hue). 440 Hz when the frequency is unusable. */
export function pitchHue (freq) {
  const f = Number.isFinite(freq) && freq > 0 ? freq : 440
  const o = Math.log2(f / 261.6256)
  return ((o % 1) + 1) % 1
}

/** Build the SoundNode mesh (shell + children). `color` is the node's colour (CSS / number). Never throws. */
export function buildSoundNodeMesh (color) {
  const g = shared()
  const col = new THREE.Color(color ?? 0xffffff)
  const mesh = new THREE.Mesh(g.shell, new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.35, emissive: 0x0a1418, side: THREE.DoubleSide }))
  const basic = (opacity) => new THREE.MeshBasicMaterial({ color: col.clone(), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
  const coreMat = basic(0.6)
  const core = new THREE.Mesh(g.core, coreMat); core.position.y = 0.05; core.raycast = () => {}
  const ringMats = [basic(0.4), basic(0.4), basic(0.4)]
  const rings = g.ring.map((geo, i) => { const r = new THREE.Mesh(geo, ringMats[i]); r.rotation.x = Math.PI / 2; r.position.y = -0.05 + i * 0.07; r.raycast = () => {}; return r })
  const glyphMat = basic(0.85)
  const playG = new THREE.Mesh(g.play, glyphMat); playG.position.y = 0.72; playG.raycast = () => {}
  const pauseG = new THREE.Mesh(g.pause, glyphMat); pauseG.position.y = 0.72; pauseG.raycast = () => {}; pauseG.visible = false
  mesh.add(core, ...rings, playG, pauseG)
  mesh.userData.snv = {
    core, rings, playG, pauseG, coreMat, ringMats, glyphMat,
    base: col.clone(), soundRef: undefined, enabled: true, hueFreq: 440, tint: col.clone(),
    level: 0, low: 0, mid: 0, high: 0, phase: Math.random() * 6.283, age: 0, glyph: 0,
  }
  SOUND_LIVE.add(mesh)
  return mesh
}

/** Dispose the per-node materials of the children and forget the mesh. Idempotent. The shell material is disposed by OmniNode with the node. */
export function releaseSoundMesh (mesh) {
  const s = mesh?.userData?.snv
  SOUND_LIVE.delete(mesh)
  if (!s) return
  s.coreMat.dispose(); s.ringMats.forEach(m => m.dispose()); s.glyphMat.dispose()
  mesh.remove(s.core, ...s.rings, s.playG, s.pauseG)
  delete mesh.userData.snv
}

const bandAvg = (b, keys) => {
  let t = 0
  for (let i = 0; i < keys.length; i++) t += c01(b[keys[i]])
  return t / keys.length
}

/** Work out the tint for a sound (its colour, else the pitch hue). Called when the sound object changed, not every frame. */
function retint (s, sound, freqOf) {
  s.soundRef = sound
  s.enabled = !!sound && sound.enabled !== false
  if (sound && typeof sound.color === 'string' && HEX.test(sound.color)) s.tint.set(sound.color)
  else {
    let f = 440
    try { const r = freqOf ? freqOf(sound) : 440; if (Number.isFinite(r) && r > 0) f = r } catch (_) { /* keep 440 */ }
    s.hueFreq = f
    s.tint.setHSL(pitchHue(f), 0.75, 0.58)
  }
}

/**
 * One frame of reaction for ONE sound node mesh. Allocates nothing.
 *  a      the engine's analysis for the node (or null / undefined: nothing is playing / no engine)
 *  sound  the node's data.sound (or undefined: the node carries no sound, it is shown idle and dim)
 *  dt     seconds since the last call   t  seconds clock (for the idle breathing)
 *  opts   { muted:boolean, freqOf:(sound)=>Hz }
 * Returns the smoothed level (0..1).
 */
export function reactSoundMesh (mesh, a, sound, dt, t, opts) {
  const s = mesh?.userData?.snv
  if (!s) return 0
  if (s.soundRef !== sound) retint(s, sound, opts?.freqOf)
  const k = 1 - Math.exp(-(dt > 0 ? (dt < 0.25 ? dt : 0.25) : 0.016) * 14)
  const playing = !!a && a.playing === true && s.enabled
  let lv = 0; let lo = 0; let mi = 0; let hi = 0
  if (playing) {
    lv = c01(a.level)
    const b = a.bands
    if (b && typeof b === 'object') { lo = bandAvg(b, BAND_LOW); mi = bandAvg(b, BAND_MID); hi = bandAvg(b, BAND_HIGH) }
  }
  s.level += (lv - s.level) * k; s.low += (lo - s.low) * k; s.mid += (mi - s.mid) * k; s.high += (hi - s.high) * k
  const dim = !s.enabled ? 0.22 : opts?.muted ? 0.5 : 1
  const breath = playing ? 0 : 0.5 + 0.5 * Math.sin(t * 1.7 + s.phase)
  // core: bigger and brighter with the level; breathes when silent
  s.core.scale.setScalar(0.85 + s.level * 1.5 + breath * 0.12 * dim)
  SCRATCH.copy(s.tint).lerp(WHITE, s.level * 0.65)
  s.coreMat.color.copy(SCRATCH)
  s.coreMat.opacity = dim * (0.32 + breath * 0.18 + s.level * 0.5)
  // rings: scale + opacity per band group
  for (let i = 0; i < 3; i++) {
    const v = i === 0 ? s.low : i === 1 ? s.mid : s.high
    const r = s.rings[i]
    r.scale.setScalar(1 + v * 0.38 + breath * 0.02)
    s.ringMats[i].color.copy(s.tint)
    s.ringMats[i].opacity = dim * (0.16 + breath * 0.06 + v * 0.8)
  }
  // glyph: play triangle when idle, pause bars when playing, none when the sound is off
  s.playG.visible = s.enabled && !playing
  s.pauseG.visible = s.enabled && playing
  s.glyphMat.color.copy(s.tint)
  s.glyphMat.opacity = dim * 0.85
  return s.level
}
