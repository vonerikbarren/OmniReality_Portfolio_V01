/**
 * ui/OmniCurveEditor.js (V246) — a small draggable curve editor on a 2D canvas (no WebGL, no dependencies). Maths: utils/OmniCurveModel.js.
 *   const ed = createCurveEditor({ points, beat, grid, onChange })      ed.el (the element)   ed.set(points, beat)   ed.setGrid('1/8')   ed.destroy()
 *   Drag a point to move it. Tap empty space to add a point. Select a point and press Delete / the Delete button to remove it (the two ends cannot be removed; they move together, up and down).
 *   `beat` (0..1) draws the BEAT marker: where in the loop the beat falls. `grid` is 'off' | '1/4' | '1/8' | '1/16': points snap to it while dragging.
 * Works with mouse, touch and pen (pointer events). onChange(points) fires on every change.
 */
import { sanitizeCurve, movePoint, addPoint, removePoint, nearest } from '../utils/OmniCurveModel.js'

export const GRIDS = Object.freeze({ off: { x: 0, y: 0 }, '1/4': { x: 1 / 4, y: 0.25 }, '1/8': { x: 1 / 8, y: 0.125 }, '1/16': { x: 1 / 16, y: 0.0625 } })
const W = 280; const H = 130; const PAD = 10

export function createCurveEditor ({ points, beat = null, grid = '1/8', onChange = () => {} } = {}) {
  const el = document.createElement('div'); el.className = 'ocv'
  el.innerHTML = '<canvas class="ocv-cv" tabindex="0" aria-label="Curve editor: drag points, tap to add"></canvas><div class="ocv-bar"><label>Snap <select class="oss-select ocv-grid"></select></label><button type="button" class="oss-btn ocv-del">Delete point</button></div>'
  const cv = el.querySelector('canvas'); const sel = el.querySelector('select'); const del = el.querySelector('.ocv-del')
  sel.innerHTML = Object.keys(GRIDS).map(g => `<option value="${g}">${g}</option>`).join(''); sel.value = GRIDS[grid] ? grid : '1/8'
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
  cv.width = W * dpr; cv.height = H * dpr; cv.style.cssText = `width:100%;max-width:${W}px;aspect-ratio:${W}/${H};touch-action:none;display:block;background:rgba(0,0,0,.35);border-radius:6px`
  let pts = sanitizeCurve(points); let beatAt = beat; let sel_i = -1; let drag = false
  const gridOf = () => GRIDS[sel.value] ?? GRIDS.off
  const toPx = (x, y) => [PAD + x * (W - 2 * PAD), PAD + (1 - (y + 1) / 2) * (H - 2 * PAD)]
  const fromEv = (e) => { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; const py = (e.clientY - r.top) / r.height * H; return [(px - PAD) / (W - 2 * PAD), 1 - 2 * ((py - PAD) / (H - 2 * PAD))] }
  function draw () {
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H)
    const g = gridOf(); c.lineWidth = 1
    const gx = g.x || 0.25; const gy = g.y || 0.5
    c.strokeStyle = 'rgba(255,255,255,.10)'
    for (let x = 0; x <= 1 + 1e-9; x += gx) { const [px] = toPx(x, 0); c.beginPath(); c.moveTo(px, PAD); c.lineTo(px, H - PAD); c.stroke() }
    for (let y = -1; y <= 1 + 1e-9; y += gy) { const [, py] = toPx(0, y); c.beginPath(); c.moveTo(PAD, py); c.lineTo(W - PAD, py); c.stroke() }
    c.strokeStyle = 'rgba(255,255,255,.3)'; { const [, z] = toPx(0, 0); c.beginPath(); c.moveTo(PAD, z); c.lineTo(W - PAD, z); c.stroke() }
    if (beatAt !== null && beatAt !== undefined) { const [bx] = toPx(beatAt, 0); c.strokeStyle = '#ffd36b'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(bx, PAD - 4); c.lineTo(bx, H - PAD + 4); c.stroke(); c.setLineDash([]); c.fillStyle = '#ffd36b'; c.font = '9px system-ui'; c.fillText('beat', Math.min(W - 28, bx + 3), 9) }
    c.strokeStyle = '#7ec8ff'; c.lineWidth = 2; c.beginPath()
    for (let i = 0; i <= 120; i++) { const u = i / 120; let k = 0; while (k < pts.length - 2 && u > pts[k + 1][0]) k++; const a = pts[k]; const b = pts[k + 1]; const f = Math.min(1, Math.max(0, (u - a[0]) / ((b[0] - a[0]) || 1))); const y = a[1] + (b[1] - a[1]) * ((1 - Math.cos(f * Math.PI)) / 2); const [px, py] = toPx(u, y); if (i) c.lineTo(px, py); else c.moveTo(px, py) }
    c.stroke()
    pts.forEach((p, i) => { const [px, py] = toPx(p[0], p[1]); c.beginPath(); c.arc(px, py, i === sel_i ? 6 : 4.5, 0, Math.PI * 2); c.fillStyle = i === sel_i ? '#ffd36b' : '#fff'; c.fill(); c.strokeStyle = '#102030'; c.lineWidth = 1.5; c.stroke() })
  }
  const emit = () => { draw(); try { onChange(pts.map(p => p.slice())) } catch (_) { /* the owner's handler failed */ } }
  const down = (e) => {
    cv.setPointerCapture?.(e.pointerId); const [x, y] = fromEv(e)
    const i = nearest(pts, x, y, 14 / (W - 2 * PAD) * 1.0 + 0.02, 0.2)
    if (i >= 0) { sel_i = i; drag = true } else { const n = addPoint(pts, x, y, gridOf()); if (n !== pts) { pts = n; sel_i = pts.findIndex(p => Math.abs(p[0] - Math.min(Math.max(x, 0.01), 0.99)) < 0.07); drag = true; emit(); return } sel_i = -1 }
    draw(); e.preventDefault()
  }
  const move = (e) => { if (!drag || sel_i < 0) return; const [x, y] = fromEv(e); const before = pts; pts = movePoint(pts, sel_i, x, y, gridOf()); if (pts !== before) emit() }
  const up = () => { drag = false }
  const key = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel_i > 0) { pts = removePoint(pts, sel_i); sel_i = -1; emit(); e.preventDefault() } }
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('keydown', key)
  del.addEventListener('click', () => { if (sel_i > 0) { pts = removePoint(pts, sel_i); sel_i = -1; emit() } })
  sel.addEventListener('change', draw)
  draw()
  return {
    el, setBeat (b) { beatAt = b; draw() }, set (p, b = beatAt) { pts = sanitizeCurve(p); beatAt = b; sel_i = -1; draw() }, setGrid (g) { if (GRIDS[g]) { sel.value = g; draw() } }, points: () => pts.map(p => p.slice()),
    destroy () { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); cv.removeEventListener('keydown', key) },
  }
}
export default createCurveEditor
