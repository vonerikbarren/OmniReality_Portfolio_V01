/**
 * utils/OmniPolyFaceDraw.js (V204) — draws ONE face's picture into a square cell of the atlas canvas. Pure: the 2D context is passed in (tests use a recording fake).
 *   drawFace(ctx, x, y, s, face, extra)   extra = { source: canvas|bitmap|null (a rendered image / document page), state: 'loading'|'error'|'' , sourceAspect }
 * pattern  checker / stripes / dots / grid / gradient in two colours      text  wrapped plain text       image / doc  the rendered source, fitted
 * sound    a speaker glyph        none  plain paper (the face colour shows through the vertex colour)    loading / error  a small message
 * Everything is clipped to the cell so nothing can bleed into a neighbour.
 */
const PAPER = '#ffffff'
const INK = '#1a1f2b'

function wrap (ctx, text, maxW) {
  const lines = []
  for (const para of String(text).split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if (!word) continue
      const t = line ? line + ' ' + word : word
      if (ctx.measureText(t).width <= maxW || !line) line = t
      else { lines.push(line); line = word }
    }
    lines.push(line)
    if (lines.length > 60) break
  }
  return lines
}

export function drawPattern (ctx, x, y, s, p) {
  const a = p.a; const b = p.b
  ctx.fillStyle = a; ctx.fillRect(x, y, s, s)
  ctx.fillStyle = b
  if (p.kind === 'checker') { const n = 8; const c = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) ctx.fillRect(x + i * c, y + j * c, c, c) }
  else if (p.kind === 'stripes') { const n = 8; const c = s / n; for (let i = 1; i < n; i += 2) ctx.fillRect(x + i * c, y, c, s) }
  else if (p.kind === 'dots') { const n = 6; const c = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.beginPath(); ctx.arc(x + (i + 0.5) * c, y + (j + 0.5) * c, c * 0.3, 0, Math.PI * 2); ctx.fill() } }
  else if (p.kind === 'grid') { const n = 8; const c = s / n; const w = Math.max(1, s / 64); for (let i = 0; i <= n; i++) { ctx.fillRect(x + i * c - w / 2, y, w, s); ctx.fillRect(x, y + i * c - w / 2, s, w) } }
  else if (p.kind === 'gradient' && ctx.createLinearGradient) { const g = ctx.createLinearGradient(x, y, x + s, y + s); if (g && g.addColorStop) { g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g } ctx.fillRect(x, y, s, s) }
}

function glyphSpeaker (ctx, x, y, s) {
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s / 28)
  const cx = x + s * 0.32; const cy = y + s * 0.5; const r = s * 0.14
  ctx.beginPath(); ctx.moveTo(cx - r, cy - r * 0.6); ctx.lineTo(cx - r * 0.2, cy - r * 0.6); ctx.lineTo(cx + r, cy - r * 1.5); ctx.lineTo(cx + r, cy + r * 1.5); ctx.lineTo(cx - r * 0.2, cy + r * 0.6); ctx.lineTo(cx - r, cy + r * 0.6); ctx.closePath(); ctx.fill()
  for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.arc(cx + r, cy, r * (0.9 + i * 0.7), -0.9, 0.9); ctx.stroke() }
}

export function drawFace (ctx, x, y, s, face, extra = {}) {
  if (!ctx || !(s >= 4)) return false
  const c = face?.content ?? { type: 'none' }
  ctx.save?.()
  ctx.beginPath?.(); ctx.rect?.(x, y, s, s); ctx.clip?.()
  ctx.fillStyle = PAPER; ctx.fillRect(x, y, s, s)
  const msg = (t) => { ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.max(8, Math.round(s / 12))}px sans-serif`; ctx.fillText(t, x + s / 2, y + s / 2, s * 0.9) }
  if (c.type === 'pattern') drawPattern(ctx, x, y, s, c.pattern)
  else if (c.type === 'text') {
    const fs = Math.max(8, Math.round(s / 11)); ctx.font = `${fs}px sans-serif`; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    const pad = s * 0.1; const lines = wrap(ctx, c.text, s - pad * 2)
    for (let i = 0; i < lines.length; i++) { const ly = y + pad + i * fs * 1.25; if (ly + fs > y + s - pad) break; ctx.fillText(lines[i], x + pad, ly, s - pad * 2) }
  } else if (c.type === 'image' || c.type === 'doc') {
    if (extra.source && extra.source.width > 0 && extra.source.height > 0) {
      const sw = extra.source.width; const sh = extra.source.height; const k = Math.min(s / sw, s / sh)
      const w = sw * k; const h = sh * k
      ctx.drawImage(extra.source, x + (s - w) / 2, y + (s - h) / 2, w, h)
    } else if (!c.source || c.source.type === 'none') msg('Choose a file')
    else if (extra.state === 'error') msg('Could not load')
    else msg('Loading…')
  } else if (c.type === 'sound' && c.source && c.source.type !== 'none') glyphSpeaker(ctx, x, y, s)
  if (face?.label && c.type !== 'text' && !((c.type === 'doc' || c.type === 'image') && extra.source)) {
    const fs = Math.max(8, Math.round(s / 10)); ctx.font = `bold ${fs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x, y + s - fs * 1.5, s, fs * 1.5); ctx.fillStyle = INK; ctx.fillText(face.label, x + s / 2, y + s - fs * 0.15, s * 0.9)
  }
  ctx.restore?.()
  return true
}
export default { drawFace, drawPattern }
