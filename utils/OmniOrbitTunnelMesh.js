/**
 * utils/OmniOrbitTunnelMesh.js (V283) — the 3D body of one OrbitTunnel: a torus tube (wireframe or solid, optional image / video
 * on the inside wall) plus a stream of particles that flows round the ring. Model: utils/OmniOrbitTunnelModel.js.
 *   const body = buildOrbitTunnel(spec); scene.add(body.group); body.update(dt); body.apply(newSpec); body.dispose()
 * One THREE.Mesh + one THREE.Points per tunnel; no renderer, no extra WebGL context. Video uses one <video> element.
 */
import * as THREE from 'three'
import { sanitizeOrbitTunnel, localFrame, TAU } from './OmniOrbitTunnelModel.js'

const BASE_SPEED = 600   // world units / second at 1x, the same base as the regular tunnels' particles

function rng (seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export function buildOrbitTunnel (specIn, { localMedia = null } = {}) {
  let spec = sanitizeOrbitTunnel(specIn)
  const group = new THREE.Group(); group.name = 'OmniOrbitTunnel:' + spec.id
  let mesh = null, geoKey = '', tex = null, video = null, mediaKey = '', disposed = false
  let pts = null, pAttr = null, P = null

  const wireMat = new THREE.MeshBasicMaterial({ color: spec.color, wireframe: true, transparent: true, opacity: spec.opacity, side: THREE.DoubleSide, depthWrite: false })
  const solidMat = new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: spec.opacity, side: THREE.BackSide, depthWrite: false })

  function clearMedia () {
    if (tex) { tex.dispose(); tex = null }
    if (video) { try { video.pause(); video.removeAttribute('src'); video.load() } catch (_) { /* gone */ } video = null }
    solidMat.map = null; solidMat.needsUpdate = true; mediaKey = ''
  }
  function setMedia (url, kind) {
    const key = kind + '|' + url; if (key === mediaKey) return
    clearMedia(); if (!url || kind === 'none') return
    mediaKey = key
    if (kind === 'image') {
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(url, (t) => { if (disposed || mediaKey !== key) { t.dispose(); return } t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; tex = t; solidMat.map = t; solidMat.needsUpdate = true; repeat() }, undefined, () => { /* unreachable image: keep the plain colour */ })
    } else {
      video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; video.src = url
      const play = video.play?.(); if (play && play.catch) play.catch(() => {})
      tex = new THREE.VideoTexture(video); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; solidMat.map = tex; solidMat.needsUpdate = true; repeat()
    }
  }
  function repeat () { if (tex) tex.repeat.set(spec.media.repeatU, spec.media.repeatV) }

  function buildGeo () {
    const key = spec.radius + '|' + spec.tube; if (key === geoKey && mesh) return
    geoKey = key; const g = new THREE.TorusGeometry(spec.radius, spec.tube, 20, 160)
    if (!mesh) { mesh = new THREE.Mesh(g, wireMat); mesh.frustumCulled = false; mesh.renderOrder = 1; group.add(mesh) } else { mesh.geometry.dispose(); mesh.geometry = g }
    mesh.rotation.x = spec.id === 'horizontal' ? Math.PI / 2 : 0   // TorusGeometry lies in X-Y: the horizontal ring is laid flat
  }

  function buildParticles () {
    if (pts) { group.remove(pts); pts.geometry.dispose(); pts.material.dispose(); pts = null; P = null }
    const n = spec.particles.count; if (!n) return
    const r = rng(spec.id === 'vertical' ? 2832 : 2831)
    P = { th: new Float32Array(n), ph: new Float32Array(n), fr: new Float32Array(n), dr: new Float32Array(n), pos: new Float32Array(n * 3) }
    for (let i = 0; i < n; i++) { P.th[i] = r() * TAU; P.ph[i] = r() * TAU; P.fr[i] = 0.12 + Math.sqrt(r()) * 0.78; P.dr[i] = 0.6 + r() * 0.8 }
    const geo = new THREE.BufferGeometry(); pAttr = new THREE.BufferAttribute(P.pos, 3); geo.setAttribute('position', pAttr)
    pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: spec.color, size: Math.max(3, spec.tube / 90), sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }))
    pts.frustumCulled = false; pts.name = 'OmniOrbitParticles'; group.add(pts); write()
  }
  function write () {
    if (!P) return
    const n = P.th.length
    for (let i = 0; i < n; i++) {
      const f = localFrame(spec.id, P.th[i]); const rr = spec.tube * P.fr[i], co = Math.cos(P.ph[i]) * rr, si = Math.sin(P.ph[i]) * rr
      P.pos[i * 3] = f.out[0] * (spec.radius + 0) + f.out[0] * co + f.up[0] * si
      P.pos[i * 3 + 1] = f.out[1] * spec.radius + f.out[1] * co + f.up[1] * si
      P.pos[i * 3 + 2] = f.out[2] * spec.radius + f.out[2] * co + f.up[2] * si
    }
    pAttr.needsUpdate = true
  }

  function apply (next) {
    const prev = spec; spec = sanitizeOrbitTunnel(next)
    buildGeo()
    group.visible = spec.visible; group.rotation.y = (spec.yaw * Math.PI) / 180
    const lm = localMedia?.get?.(spec.id); const url = lm?.url || spec.media.url; const kind = lm?.kind || spec.media.kind   // a file picked this session wins over the saved link
    setMedia(spec.mode === 'solid' ? url : '', kind)
    repeat()
    mesh.material = spec.mode === 'solid' ? solidMat : wireMat
    wireMat.color.setHex(spec.color); wireMat.opacity = spec.opacity; solidMat.color.setHex(solidMat.map ? 0xffffff : spec.color); solidMat.opacity = solidMat.map ? Math.max(spec.opacity, 0.85) : spec.opacity
    if (!prev || prev.particles.count !== spec.particles.count || prev.radius !== spec.radius || prev.tube !== spec.tube || !pts) buildParticles()
    if (pts) { pts.visible = spec.particles.on && spec.particles.count > 0; pts.material.color.setHex(spec.color) }
  }

  function update (dt, timeScale = 1) {
    if (disposed || !pts || !pts.visible || !P) return
    const d = Math.min(0.1, Math.max(0, dt)) * (Number.isFinite(timeScale) ? timeScale : 1); if (!d) return
    const dth = (BASE_SPEED * spec.particles.speed * d) / spec.radius
    for (let i = 0; i < P.th.length; i++) { P.th[i] = (P.th[i] + dth * P.dr[i]) % TAU }
    write()
  }

  function dispose () {
    disposed = true; clearMedia()
    mesh?.geometry.dispose(); wireMat.dispose(); solidMat.dispose()
    if (pts) { pts.geometry.dispose(); pts.material.dispose() }
    group.removeFromParent(); group.clear()
  }
  apply(spec)
  return { group, update, apply, dispose, get spec () { return spec } }
}
