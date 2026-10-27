/**
 * utils/OmniCommModel.js (V223) — the rules of OmniCommunication (Receive / Route) and the Tetris packing of the OmniNodeAcquisitioner. Pure.
 *
 * A TUNNEL IS A FIELD. Each of the seven tunnels (the two top hands, LH, RH, X, Y, Z) can receive things, but only when its owner opens it:
 *   receive config  { open (default FALSE), muted, allow ['*'], cap 12 }
 *     open   false: nothing is delivered and routes through it are refused. true: it accepts.
 *     muted  stores arrivals without a notification or a drop animation
 *     allow  who may send: '*' anyone, 'user' (you), 'external' (another user, later), or tunnel ids
 *     cap    how many pieces it holds (1..24); a full inbox drops its oldest unpinned piece; pinned pieces are never dropped
 * A PIECE (packet): { id, kind 'node'|'text', from (the origin), sender (the last hand that passed it on), to, via[], path[], label, node?, text?, at, state 'zipped'|'deciphered', pinned }
 * Route = send / direct: planRoute({ from, to, via }) decides if a piece may travel from -> via... -> to and says where it was refused.
 * Everything that comes from storage or from a command is sanitised here; nothing in this file touches the DOM or the scene.
 */
export const TUNNELS = ['conscious', 'omnihand', 'lh', 'rh', 'x', 'y', 'z']
export const TUNNEL_NAMES = { conscious: 'ConsciousHand', omnihand: 'OmniHand', lh: 'LH', rh: 'RH', x: 'X axis', y: 'Y axis', z: 'Z axis' }
export const SENDERS = ['user', 'external']
export const DEFAULT_CAP = 12
export const MAX_CAP = 24
export const MAX_TEXT = 2000
export const MAX_LABEL = 60
export const MAX_VIA = 4
export const MAX_ALLOW = 16
export const COLS = 4
const ID_OK = /^[\w-]{1,48}$/
const GEO_OK = /^[A-Za-z0-9]{3,40}Geometry$/
const HEX = /^#[0-9a-fA-F]{6}$/

export const isTunnel = (t) => TUNNELS.includes(t)
export const defaultConfig = () => ({ open: false, muted: false, allow: ['*'], cap: DEFAULT_CAP })
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const vec3 = (v, d) => (Array.isArray(v) && v.length === 3 && v.every(x => Number.isFinite(Number(x))) ? v.map(x => num(x, -1e4, 1e4, 0)) : d)
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n)

export function sanitizeAllow (list) {
  const out = []
  ;(Array.isArray(list) ? list : []).forEach(a => { const s = String(a ?? '').toLowerCase(); if ((s === '*' || SENDERS.includes(s) || isTunnel(s)) && !out.includes(s) && out.length < MAX_ALLOW) out.push(s) })
  return out
}
export function sanitizeConfig (c) {
  const o = c && typeof c === 'object' ? c : {}
  const allow = Array.isArray(o.allow) ? sanitizeAllow(o.allow) : ['*']   // an empty list means nobody
  return { open: o.open === true, muted: o.muted === true, allow, cap: Math.round(num(o.cap, 1, MAX_CAP, DEFAULT_CAP)) }
}
/** the node snapshot a piece may carry: ordinary geometry only, a safe subset of fields */
export function sanitizeNodeSnapshot (n) {
  if (!n || typeof n !== 'object') return null
  const geometry = GEO_OK.test(String(n.geometry)) ? String(n.geometry) : null
  if (!geometry) return null
  return { label: str(n.label, MAX_LABEL) || 'Node', geometry, primitive: n.primitive === 'subjective' ? 'subjective' : 'objective', color: HEX.test(String(n.color)) ? String(n.color).toLowerCase() : '#ffffff',
    rotation: vec3(n.rotation, [0, 0, 0]), scale: vec3(n.scale, [1, 1, 1]).map(x => num(x, 0.01, 1000, 1)), wireframe: n.wireframe === true }
}
export function sanitizePacket (p) {
  if (!p || typeof p !== 'object') return null
  const kind = p.kind === 'node' ? 'node' : p.kind === 'text' ? 'text' : null; if (!kind) return null
  const id = ID_OK.test(String(p.id)) ? String(p.id) : null; if (!id) return null
  const ok = (t) => { const s = String(t ?? '').toLowerCase(); return (isTunnel(s) || SENDERS.includes(s)) ? s : null }
  const from = ok(p.from) ?? 'external', sender = ok(p.sender) ?? from, to = isTunnel(p.to) ? p.to : null; if (!to) return null
  const out = { id, kind, from, sender, to, via: (Array.isArray(p.via) ? p.via : []).filter(isTunnel).slice(0, MAX_VIA), path: (Array.isArray(p.path) ? p.path : []).filter(isTunnel).slice(0, 12),
    label: str(p.label, MAX_LABEL), at: Number.isFinite(Number(p.at)) ? Number(p.at) : 0, state: p.state === 'deciphered' ? 'deciphered' : 'zipped', pinned: p.pinned === true }
  if (kind === 'node') { out.node = sanitizeNodeSnapshot(p.node); if (!out.node) return null; if (!out.label) out.label = out.node.label } else { out.text = str(p.text, MAX_TEXT); if (!out.text) return null; if (!out.label) out.label = out.text.slice(0, 40) }
  return out
}
/** a whole saved state -> a safe one */
export function sanitizeState (s) {
  const cfg = {}, inbox = {}
  TUNNELS.forEach(t => {
    cfg[t] = sanitizeConfig(s?.cfg?.[t])
    const list = []; ;(Array.isArray(s?.inbox?.[t]) ? s.inbox[t] : []).forEach(p => { const q = sanitizePacket(p); if (q && q.to === t && list.length < cfg[t].cap && !list.some(x => x.id === q.id)) list.push(q) })
    inbox[t] = list
  })
  return { cfg, inbox }
}

/** may `sender` deliver into a tunnel with this config? */
export function canReceive (cfg, sender) {
  if (!cfg.open) return { ok: false, reason: 'closed: its owner has not opened it to receive' }
  if (!cfg.allow.includes('*') && !cfg.allow.includes(sender)) return { ok: false, reason: `"${sender}" is not on its allow list` }
  return { ok: true }
}
/** from -> via... -> to. `configs` is { tunnel: config }. Relays must be open (a closed tunnel blocks the road). */
export function planRoute ({ from, to, via = [] }, configs) {
  if (!isTunnel(to)) return { ok: false, reason: `"${to}" is not a tunnel (${TUNNELS.join(', ')})`, blockedAt: null }
  const hops = (Array.isArray(via) ? via : [via]).map(v => String(v ?? '').toLowerCase())
  if (hops.length > MAX_VIA) return { ok: false, reason: `a route can have at most ${MAX_VIA} stops between`, blockedAt: null }
  for (const h of hops) {
    if (!isTunnel(h)) return { ok: false, reason: `via "${h}" is not a tunnel`, blockedAt: h }
    if (h === to || h === from) return { ok: false, reason: `via cannot include the start or the end (${h})`, blockedAt: h }
  }
  if (new Set(hops).size !== hops.length) return { ok: false, reason: 'via cannot repeat a tunnel', blockedAt: null }
  let prev = from
  for (const h of hops) {
    const r = canReceive(configs[h], prev); if (!r.ok) return { ok: false, reason: `${TUNNEL_NAMES[h]} ${r.reason}`, blockedAt: h }
    prev = h
  }
  const last = canReceive(configs[to], prev); if (!last.ok) return { ok: false, reason: `${TUNNEL_NAMES[to]} ${last.reason}`, blockedAt: to }
  return { ok: true, hops: [...hops, to], sender: prev }
}
/** put a piece in an inbox (newest last). Full: the oldest unpinned goes. All pinned: refused. */
export function addToInbox (list, packet, cap) {
  const out = [...list]; let dropped = null
  if (out.length >= cap) {
    const i = out.findIndex(p => !p.pinned)
    if (i < 0) return { ok: false, list, reason: 'full of pinned pieces' }
    dropped = out.splice(i, 1)[0]
  }
  out.push(packet); return { ok: true, list: out, dropped }
}

// ── Tetris packing ──
/** how many of the 4 columns a piece takes: a node is a 2-wide block, short text 1, medium 2, long a full row */
export function pieceWidth (p) {
  if (p.kind === 'node') return 2
  const n = (p.text ?? '').length
  return n <= 40 ? 1 : n <= 240 ? 2 : COLS
}
/** settle pieces (oldest first) onto a COLS-wide board from the bottom: each goes in the lowest row with a gap wide enough.
 *  -> [{ id, col, row (0 = bottom), w }] */
export function packPieces (pieces, cols = COLS) {
  const rows = []   // rows[r] = array of booleans
  const out = []
  for (const p of pieces) {
    const w = Math.min(cols, pieceWidth(p)); let placed = false
    for (let r = 0; !placed; r++) {
      rows[r] = rows[r] ?? new Array(cols).fill(false)
      for (let c = 0; c + w <= cols; c++) {
        if (rows[r].slice(c, c + w).every(x => !x)) { for (let k = c; k < c + w; k++) rows[r][k] = true; out.push({ id: p.id, col: c, row: r, w }); placed = true; break }
      }
    }
  }
  return out
}
export const pieceSymbol = (p) => (p.kind === 'node' ? '◆' : '¶')
/** a stable hue (0..359) from the sender, so pieces from the same place look alike */
export function pieceHue (p) { let h = 0; for (const c of String(p.from)) h = (h * 31 + c.charCodeAt(0)) % 360; return h }
