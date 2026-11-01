/**
 * utils/OmniTimeNodeMesh.js (V259) — the extra geometry of a TimeCube (the cube itself is the ordinary poly mesh):
 *   RIG    a RING around the cube (a torus whose axis is the z axis: the doorknob rose seen along z) and an ICOSAHEDRON on it, spinning on x, y and z,
 *          that travels round the ring as the cube's time is fulfilled; halted = it stops and glows.
 *   PANEL  the face panel: a thin sheet with the SAME material as the DocNode (an unlit paper-coloured MeshBasicMaterial with a canvas texture, in a frame of the node colour).
 * Everything here is raycast-off so the cube's faces stay the only things you can press.
 */
import * as THREE from 'three'
export const STATUS_COLORS = Object.freeze({ waiting: '#7a8fa8', running: '#35e0ff', halted: '#ffb12b', fulfilled: '#46e08a' })
const noRay = (o) => { o.raycast = () => {} }
export const ringRadius = (edge) => edge * 0.98            // clears the corners of the cube seen along z (half diagonal = edge * 0.707)

export function buildTimeRig (edge = 2) {
  const R = ringRadius(edge); const g = new THREE.Group(); g.name = 'omni-time-rig'; g.userData.omniOverlay = true
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x8aa4c0, metalness: 0.6, roughness: 0.35, emissive: new THREE.Color(0x0a1a28), emissiveIntensity: 0.6 })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, edge * 0.035, 10, 72), ringMat); ring.name = 'omni-time-ring'; noRay(ring)
  const icoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(STATUS_COLORS.waiting), emissive: new THREE.Color(STATUS_COLORS.waiting), emissiveIntensity: 0.3, metalness: 0.3, roughness: 0.3, flatShading: true })
  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(edge * 0.13, 0), icoMat); ico.name = 'omni-time-ico'; noRay(ico)
  g.add(ring, ico); g.userData.time = { edge, R, ring, ico, ringMat, icoMat, spin: 0, status: 'waiting', progress: 0 }
  placeIco(g, 0); return g
}
/** Put the icosahedron on the ring: progress 0 = the top, going clockwise round once at 1. */
export function icoPosition (R, progress) { const a = Math.PI / 2 - Math.max(0, Math.min(1, progress)) * Math.PI * 2; return [R * Math.cos(a), R * Math.sin(a), 0] }
export function placeIco (rig, progress) { const t = rig?.userData?.time; if (!t) return; const [x, y, z] = icoPosition(t.R, progress); t.ico.position.set(x, y, z); t.progress = progress }
/** One frame: spin (unless halted), glow when halted, colour by status. dt in seconds, clock in seconds (for the glow pulse). */
export function updateTimeRig (rig, { status = 'waiting', progress = 0 }, dt, clock = 0) {
  const t = rig?.userData?.time; if (!t) return
  const halted = status === 'halted'
  if (!halted) { t.spin += dt; t.ico.rotation.x += dt * 1.3; t.ico.rotation.y += dt * 1.9; t.ico.rotation.z += dt * 0.8 }   // halted: frozen exactly where it is
  placeIco(rig, progress)
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.waiting; t.icoMat.color.set(c); t.icoMat.emissive.set(c)
  t.icoMat.emissiveIntensity = halted ? 1.4 + 0.9 * Math.sin(clock * 5) : status === 'running' ? 0.55 : status === 'fulfilled' ? 0.8 : 0.25
  t.ringMat.emissive.set(halted ? '#6b4300' : '#0a1a28'); t.status = status
}
export function disposeTimeRig (rig) { if (!rig) return; rig.parent?.remove(rig); rig.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() }) }

// ── the face panel ────────────────────────────────────────────────────────────────────────────────────────────────
export const PANEL_PX = Object.freeze({ w: 640, h: 480 })
export function drawTimePanel (g, info, accent = '#2c7be5', W = PANEL_PX.w, H = PANEL_PX.h) {
  g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, W, H)                      // paper, as the DocNode's
  g.fillStyle = accent; g.fillRect(0, 0, W, 14)
  g.fillStyle = '#5b6573'; g.font = '600 26px sans-serif'; g.textBaseline = 'top'; g.fillText(String(info.label || '').toUpperCase(), 32, 40)
  g.fillStyle = '#10161f'; g.font = '700 74px sans-serif'; const v = String(info.value ?? ''); g.fillText(v.length > 14 ? v.slice(0, 13) + '…' : v, 32, 86)
  g.fillStyle = '#2a323d'; g.font = '30px sans-serif'; let y = 196
  for (const line of (info.lines ?? []).slice(0, 8)) { g.fillText(String(line).slice(0, 44), 32, y); y += 44 }
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(32, H - 52, W - 64, 2); g.fillStyle = '#7a8594'; g.font = '22px sans-serif'; g.fillText('TimeCube · tap the face again to close', 32, H - 40)
}
export function buildFacePanel (edge = 2, color = 0x9ad0ff) {
  const w = edge * 1.7; const h = w * (PANEL_PX.h / PANEL_PX.w); const DEPTH = 0.03
  const root = new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5, metalness: 0.2 }))
  root.name = 'omni-time-panel'; root.userData.omniOverlay = true; noRay(root)
  const canvas = document.createElement('canvas'); canvas.width = PANEL_PX.w; canvas.height = PANEL_PX.h
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })   // the docNode's sheet material
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96), mat); front.position.z = DEPTH / 2 + 0.002; noRay(front)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96), mat); back.position.z = -DEPTH / 2 - 0.002; back.rotation.y = Math.PI; noRay(back)
  root.add(front, back); root.userData.tp = { canvas, tex, mat, w, h, key: '' }; return root
}
export function paintFacePanel (panel, info, accent) { const tp = panel?.userData?.tp; if (!tp) return false; const key = JSON.stringify(info) + accent; if (key === tp.key) return false; tp.key = key; drawTimePanel(tp.canvas.getContext('2d'), info, accent); tp.tex.needsUpdate = true; return true }
export function disposeFacePanel (panel) { if (!panel) return; panel.parent?.remove(panel); const tp = panel.userData?.tp; panel.geometry?.dispose(); panel.material?.dispose(); tp?.tex?.dispose(); tp?.mat?.dispose(); panel.traverse(o => { if (o !== panel) o.geometry?.dispose?.() }) }
