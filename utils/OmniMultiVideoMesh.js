/**
 * utils/OmniMultiVideoMesh.js (V286) — the body of a MultiVideoNode: one plane that shows TWO videos at once through a transition shader
 * (cut / fade / dip / wipe / slide, each clip with its own chroma key and alpha), plus a thin text plane in front that is part of the same group.
 * Model: utils/OmniMultiVideoModel.js. Runtime: systems/OmniMultiVideo.js. The node owns its materials and textures (releaseMultiVideoMesh).
 *   mesh.userData.mvv = { setLook(mv), show(frame), setText(textState), setVideos(elA, elB), aspect }
 */
import * as THREE from 'three'
import { hexToRgb } from './OmniStoredVideoModel.js'

export const MV_LIVE = new Set()
const KIND_INDEX = { cut: 0, fade: 1, dip: 2, wipe: 3, slide: 4 }
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D mapA; uniform sampler2D mapB; uniform float hasA; uniform float hasB; uniform float alphaA; uniform float alphaB;
uniform float p; uniform float kind; uniform float blankA; uniform float blankB;
uniform vec4 keyA; uniform vec3 keyRgbA; uniform vec4 keyB; uniform vec3 keyRgbB;   // key: (on, similarity, smoothness, spill)
vec2 chroma(vec3 c){ return vec2(-0.168736*c.r - 0.331264*c.g + 0.5*c.b, 0.5*c.r - 0.418688*c.g - 0.081312*c.b); }
vec4 pick(sampler2D m, float has, float blank, vec2 uv, vec4 k, vec3 kr){
  if (uv.x < 0.0 || uv.x > 1.0) return vec4(0.0);
  if (has < 0.5) { if (blank < 0.5) return vec4(0.0); return vec4(vec3(0.16, 0.18, 0.24) + 0.04 * step(0.5, fract((uv.x + uv.y) * 6.0)), 1.0); }
  vec3 c = texture2D(m, uv).rgb; float a = 1.0;
  if (k.x > 0.5) {
    float d = distance(chroma(c), chroma(kr)); a = smoothstep(k.y * 0.7, k.y * 0.7 + max(0.0001, k.z * 0.7), d);
    if (k.w > 0.0) { float ch = kr.g >= kr.r && kr.g >= kr.b ? 1.0 : (kr.r >= kr.b ? 0.0 : 2.0); float v = ch < 0.5 ? c.r : (ch < 1.5 ? c.g : c.b); float o = ch < 0.5 ? (c.g + c.b) * 0.5 : (ch < 1.5 ? (c.r + c.b) * 0.5 : (c.r + c.g) * 0.5); float nv = v > o ? v - (v - o) * k.w : v; if (ch < 0.5) c.r = nv; else if (ch < 1.5) c.g = nv; else c.b = nv; }
  }
  return vec4(c, a);
}
void main(){
  vec2 uvA = vUv, uvB = vUv; float wa = alphaA, wb = alphaB; float dipK = 1.0;
  if (kind > 3.5) { uvA.x = vUv.x + p; uvB.x = vUv.x - (1.0 - p); }                       // slide: B pushes A out to the left
  else if (kind > 2.5) { wb = vUv.x < p ? alphaB : 0.0; }                                  // wipe: B appears from the left
  else if (kind > 1.5) { wa = alphaA * clamp(1.0 - p * 2.0, 0.0, 1.0); wb = alphaB * clamp(p * 2.0 - 1.0, 0.0, 1.0); }   // dip: through nothing
  else if (kind > 0.5) { wa = alphaA * (1.0 - p); wb = alphaB * p; }                       // fade: cross dissolve
  vec4 A = pick(mapA, hasA, blankA, uvA, keyA, keyRgbA); vec4 B = pick(mapB, hasB, blankB, uvB, keyB, keyRgbB);
  float aa = A.a * wa, ab = B.a * wb;
  float ao = ab + aa * (1.0 - ab);
  if (ao < 0.01) discard;
  vec3 col = (B.rgb * ab + A.rgb * aa * (1.0 - ab)) / ao;
  gl_FragColor = vec4(col, ao);
}`

export function buildMultiVideoMesh (mv) {
  const group = new THREE.Group()
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: {
    mapA: { value: null }, mapB: { value: null }, hasA: { value: 0 }, hasB: { value: 0 }, alphaA: { value: 1 }, alphaB: { value: 1 }, p: { value: 0 }, kind: { value: 0 }, blankA: { value: 1 }, blankB: { value: 0 },
    keyA: { value: new THREE.Vector4(0, 0.4, 0.08, 0.1) }, keyRgbA: { value: new THREE.Vector3(0, 1, 0) }, keyB: { value: new THREE.Vector4(0, 0.4, 0.08, 0.1) }, keyRgbB: { value: new THREE.Vector3(0, 1, 0) } } })
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); plane.name = 'MultiVideoPlane'; group.add(plane)
  // the text layer: a canvas on its own plane, a child of the group (so it moves with the node)
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (cv) { cv.width = 1024; cv.height = 256 }
  const ttex = cv ? new THREE.CanvasTexture(cv) : null; if (ttex) ttex.colorSpace = THREE.SRGBColorSpace
  const tmat = new THREE.MeshBasicMaterial({ map: ttex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 })
  const tplane = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), tmat); tplane.name = 'MultiVideoText'; tplane.visible = false; tplane.renderOrder = 2; group.add(tplane)
  const st = { aspect: 9 / 16, width: 6, texA: null, texB: null, elA: null, elB: null, textSig: '', texCache: new Map() }
  const texFor = (el) => { if (!el) return null; let t = st.texCache.get(el); if (!t) { t = new THREE.VideoTexture(el); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; st.texCache.set(el, t) } return t }
  const size = () => { plane.scale.set(st.width, st.width * st.aspect, 1) }
  const api = {
    setLook (m) { st.width = m.width; size(); const tw = st.width * m.text.width; tplane.scale.set(tw, tw, 1); tplane.geometry.dispose(); tplane.geometry = new THREE.PlaneGeometry(1, 0.25) },
    /** frame = { a:{key,hasVideo,alpha}|null, b:..., p, kind } */
    show (f) {
      const u = mat.uniforms; const A = f?.a, B = f?.b
      u.hasA.value = A && st.elA ? 1 : 0; u.hasB.value = B && st.elB ? 1 : 0; u.blankA.value = A ? 1 : 0; u.blankB.value = B ? 1 : 0
      u.alphaA.value = A ? A.alpha : 0; u.alphaB.value = B ? B.alpha : 0; u.p.value = f?.p ?? 0; u.kind.value = KIND_INDEX[f?.kind] ?? 0
      for (const [k, kr, c] of [[u.keyA.value, u.keyRgbA.value, A?.key], [u.keyB.value, u.keyRgbB.value, B?.key]]) { if (c) { k.set(c.enabled ? 1 : 0, c.similarity, c.smoothness, c.spill); kr.set(...hexToRgb(c.color)) } else k.set(0, 0.4, 0.08, 0.1) }
      plane.visible = !!(A || B)
    },
    setVideos (elA, elB) {
      if (elA !== st.elA) { st.elA = elA; mat.uniforms.mapA.value = texFor(elA); if (elA?.videoWidth > 0) st.aspect = elA.videoHeight / elA.videoWidth; size() }
      if (elB !== st.elB) { st.elB = elB; mat.uniforms.mapB.value = texFor(elB) }
    },
    /** state = { item, alpha, offset:[x,y,z] } or null */
    setText (s) {
      if (!s || !s.item || !cv) { tplane.visible = false; return }
      const it = s.item; const sig = JSON.stringify([it.text, it.size, it.color, it.bg, it.align])
      if (sig !== st.textSig) { st.textSig = sig; drawText(cv, it); ttex.needsUpdate = true }
      tplane.visible = true; tmat.opacity = s.alpha; tplane.position.set(...s.offset)
    },
    get aspect () { return st.aspect },
    dispose () { for (const t of st.texCache.values()) t.dispose(); st.texCache.clear(); ttex?.dispose(); tmat.dispose(); mat.dispose(); plane.geometry.dispose(); tplane.geometry.dispose() },
  }
  group.userData.mvv = api; MV_LIVE.add(group); api.setLook(mv)
  return group
}

function drawText (cv, it) {
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height)
  const px = Math.round(Math.max(18, Math.min(110, it.size * 90))); g.font = `600 ${px}px system-ui, sans-serif`; g.textBaseline = 'middle'
  const words = it.text.split(/\s+/), lines = []; let cur = ''
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > cv.width - 60 && cur) { lines.push(cur); cur = w } else cur = t }
  if (cur) lines.push(cur)
  const shown = lines.slice(0, Math.max(1, Math.floor(cv.height / (px * 1.15)))); const lh = px * 1.15; const y0 = cv.height / 2 - ((shown.length - 1) * lh) / 2
  if (it.bg) { g.fillStyle = it.bg; const w = Math.min(cv.width, Math.max(...shown.map(l => g.measureText(l).width)) + 50); const x = it.align === 'left' ? 0 : it.align === 'right' ? cv.width - w : (cv.width - w) / 2; g.globalAlpha = 0.65; g.fillRect(x, y0 - lh / 2 - 8, w, shown.length * lh + 16); g.globalAlpha = 1 }
  g.fillStyle = it.color; g.textAlign = it.align; const x = it.align === 'left' ? 30 : it.align === 'right' ? cv.width - 30 : cv.width / 2
  shown.forEach((l, i) => g.fillText(l, x, y0 + i * lh))
}

export function releaseMultiVideoMesh (group) {
  MV_LIVE.delete(group); try { group.userData.mvv?.dispose() } catch (_) { /* already gone */ }
}
