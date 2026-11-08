/**
 * utils/OmniStoredVideoNodeMesh.js (V277) — the GEOMETRY of a StoredVideoNode: one flat plane that shows a video through a chroma-key shader.
 * The shader is the GPU twin of keyAlpha() in OmniStoredVideoModel.js (same chroma distance, same smoothstep, same spill rule).
 * Until a video is loaded the plane shows a dim placeholder card, so the node can be found and selected. Each node owns its material and texture (releaseStoredVideoMesh).
 */
import * as THREE from 'three'
import { hexToRgb, planeSize } from './OmniStoredVideoModel.js'

export const SV_LIVE = new Set()
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D map; uniform float hasMap; uniform float keyOn; uniform vec3 keyRgb;
uniform float similarity; uniform float smoothness; uniform float spill; uniform float flipX; uniform float opacity;
vec2 chroma(vec3 c){ return vec2(-0.168736*c.r - 0.331264*c.g + 0.5*c.b, 0.5*c.r - 0.418688*c.g - 0.081312*c.b); }
void main(){
  vec2 uv = vec2(flipX > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
  vec3 c = hasMap > 0.5 ? texture2D(map, uv).rgb : vec3(0.18, 0.2, 0.26) + 0.04 * step(0.5, fract((uv.x + uv.y) * 6.0));
  float a = 1.0;
  if (keyOn > 0.5 && hasMap > 0.5) {
    float d = distance(chroma(c), chroma(keyRgb));
    a = smoothstep(similarity * 0.7, similarity * 0.7 + max(0.0001, smoothness * 0.7), d);
    if (spill > 0.0) {
      float ch = keyRgb.g >= keyRgb.r && keyRgb.g >= keyRgb.b ? 1.0 : (keyRgb.r >= keyRgb.b ? 0.0 : 2.0);
      float v = ch < 0.5 ? c.r : (ch < 1.5 ? c.g : c.b);
      float o = ch < 0.5 ? (c.g + c.b) * 0.5 : (ch < 1.5 ? (c.r + c.b) * 0.5 : (c.r + c.g) * 0.5);
      float nv = v > o ? v - (v - o) * spill : v;
      if (ch < 0.5) c.r = nv; else if (ch < 1.5) c.g = nv; else c.b = nv;
    }
  }
  if (a * opacity < 0.01) discard;
  gl_FragColor = vec4(c, a * opacity);
}`

export function buildStoredVideoNodeMesh (width = 6) {
  const sz = planeSize(width, 16, 9)
  const geo = new THREE.PlaneGeometry(1, 1)
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { map: { value: null }, hasMap: { value: 0 }, keyOn: { value: 1 }, keyRgb: { value: new THREE.Vector3(0, 1, 0) }, similarity: { value: 0.4 }, smoothness: { value: 0.08 }, spill: { value: 0.1 }, flipX: { value: 0 }, opacity: { value: 1 } }
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.scale.set(sz.w, sz.h, 1)
  mesh.userData.svv = { sig: '', tex: null, aspect: 9 / 16 }
  SV_LIVE.add(mesh)
  return mesh
}

/** Push settings (a sanitized storedVideo) to the material. */
export function applyStoredVideoLook (mesh, sv) {
  const v = mesh?.userData?.svv; if (!v || !sv) return false
  const sig = JSON.stringify([sv.key, sv.width, sv.flip, v.aspect]); if (sig === v.sig) return false
  v.sig = sig
  const u = mesh.material.uniforms, k = sv.key
  u.keyOn.value = k.enabled ? 1 : 0; u.keyRgb.value.set(...hexToRgb(k.color)); u.similarity.value = k.similarity; u.smoothness.value = k.smoothness; u.spill.value = k.spill; u.flipX.value = sv.flip ? 1 : 0
  const s = planeSize(sv.width, 1, v.aspect); mesh.scale.set(s.w, s.h, 1)
  return true
}

/** Hand the material a video element (null = back to the placeholder). The node owns the texture it makes here. */
export function setStoredVideoElement (mesh, el) {
  const v = mesh?.userData?.svv; if (!v) return
  if (v.tex) { v.tex.dispose(); v.tex = null }
  const u = mesh.material.uniforms
  if (el) {
    const t = new THREE.VideoTexture(el); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false
    v.tex = t; u.map.value = t; u.hasMap.value = 1
    if (el.videoWidth > 0) { v.aspect = el.videoHeight / el.videoWidth }
  } else { u.map.value = null; u.hasMap.value = 0; v.aspect = 9 / 16 }
  v.sig = ''
}
export function releaseStoredVideoMesh (mesh) {
  const v = mesh?.userData?.svv; SV_LIVE.delete(mesh); if (!v) return
  try { v.tex?.dispose(); mesh.material.dispose(); mesh.geometry.dispose() } catch (_) { /* already gone */ }
}
