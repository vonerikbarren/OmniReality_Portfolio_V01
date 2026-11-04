/**
 * utils/OmniFlashcardModel.js (V269) — the Flashcards node's deck. Pure: no DOM, no Three.js.
 * A deck lives IN the node (data.flash): { v:1, title, speak, width, paper, cards:[{ id, front:{text,img,snd}, back:{text,img,snd} }], queue:[cardIds], side:'front'|'back', got, again, rounds }
 *   text  <= 400 chars · img  a small data:image (png/jpeg/webp/gif) · snd  a small data:audio · the whole deck is capped so it always fits the browser's storage
 * STUDY is a rotating queue: the card in front is queue[0]. flip shows the other side; next sends it to the back of the queue; prev brings the last one forward;
 *   got  takes it out of this round (counted)           again  sends it to the back to come round once more (counted)       round over when the queue is empty -> restart
 *   sanitizeDeck(d)  never throws, idempotent, caps everything     newCard / addCard / updateCard / removeCard / moveCard     startRound(deck, rng?) (shuffled queue)
 *   current(deck) / progress(deck) / flip / next / prev / mark(deck, 'got'|'again') / restart(deck, shuffle?, rng?)     — each returns a NEW deck (inputs are never mutated)
 *   toJSON(deck) / fromJSON(text) / toCSV(deck) / fromCSV(text)  (text only in CSV: front,back)      SCHEMA 'omni-flashcards/1'
 */
export const SCHEMA = 'omni-flashcards/1'
export const LIMITS = Object.freeze({ cards: 500, text: 400, title: 60, img: 150000, snd: 150000, total: 1500000, width: [1.5, 8] })
const HEX = /^#[0-9a-fA-F]{6}$/
const IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/
const SND = /^data:audio\/(mpeg|ogg|wav|webm|mp4|x-wav);base64,[A-Za-z0-9+/=]+$/
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max)
const rid = () => 'c' + Math.random().toString(36).slice(2, 8)
const okId = (v) => typeof v === 'string' && /^[\w-]{1,24}$/.test(v)

export function cleanSide (s) {
  const o = (s && typeof s === 'object') ? s : {}
  const side = { text: str(o.text, LIMITS.text) }
  if (typeof o.img === 'string' && o.img.length <= LIMITS.img && IMG.test(o.img)) side.img = o.img
  if (typeof o.snd === 'string' && o.snd.length <= LIMITS.snd && SND.test(o.snd)) side.snd = o.snd
  return side
}
const bytes = (c) => (c.front.img?.length ?? 0) + (c.front.snd?.length ?? 0) + (c.back.img?.length ?? 0) + (c.back.snd?.length ?? 0)

export function defaultDeck () { return { v: 1, title: 'Flashcards', speak: false, width: 3.2, paper: '#fffdf4', cards: [], queue: [], side: 'front', got: 0, again: 0, rounds: 0 } }

export function sanitizeDeck (d) {
  const o = (d && typeof d === 'object') ? d : {}
  const seen = new Set(); const cards = []; let total = 0
  for (const c of (Array.isArray(o.cards) ? o.cards : [])) {
    if (cards.length >= LIMITS.cards || !c || typeof c !== 'object') continue
    let id = okId(c.id) ? c.id : rid(); while (seen.has(id)) id = rid(); seen.add(id)
    const card = { id, front: cleanSide(c.front), back: cleanSide(c.back) }
    const b = bytes(card)
    if (total + b > LIMITS.total) { for (const k of ['front', 'back']) { delete card[k].img; delete card[k].snd } } else total += b
    cards.push(card)
  }
  const ids = new Set(cards.map(c => c.id)); const qIn = Array.isArray(o.queue) ? o.queue : null
  const queue = []; const inQ = new Set()
  if (qIn) for (const id of qIn) { if (ids.has(id) && !inQ.has(id)) { queue.push(id); inQ.add(id) } }
  if (!qIn) for (const c of cards) queue.push(c.id)
  const w = Number(o.width); const [wl, wh] = LIMITS.width
  const cnt = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 1e6) : 0 }
  return { v: 1, title: str(o.title, LIMITS.title) || 'Flashcards', speak: o.speak === true, width: Number.isFinite(w) ? Math.min(wh, Math.max(wl, w)) : 3.2, paper: HEX.test(o.paper) ? o.paper.toLowerCase() : '#fffdf4', cards, queue, side: o.side === 'back' && queue.length ? 'back' : 'front', got: cnt(o.got), again: cnt(o.again), rounds: cnt(o.rounds) }
}

export function newCard (front = '', back = '', id = null) { return { id: okId(id) ? id : rid(), front: cleanSide({ text: front }), back: cleanSide({ text: back }) } }

export function addCard (deck, card, at = null) {
  const d = sanitizeDeck(deck); if (d.cards.length >= LIMITS.cards) return d
  const c = sanitizeDeck({ cards: [card] }).cards[0]; if (!c) return d
  if (d.cards.some(x => x.id === c.id)) c.id = rid()
  const i = Number.isInteger(at) ? Math.max(0, Math.min(d.cards.length, at)) : d.cards.length
  const cards = d.cards.slice(); cards.splice(i, 0, c)
  return sanitizeDeck({ ...d, cards, queue: [...d.queue, c.id] })
}
export function updateCard (deck, id, patch) {
  const d = sanitizeDeck(deck); const p = (patch && typeof patch === 'object') ? patch : {}
  return sanitizeDeck({ ...d, cards: d.cards.map(c => (c.id !== id ? c : { id: c.id, front: p.front !== undefined ? { ...c.front, ...p.front } : c.front, back: p.back !== undefined ? { ...c.back, ...p.back } : c.back })) })
}
export function removeCard (deck, id) { const d = sanitizeDeck(deck); return sanitizeDeck({ ...d, cards: d.cards.filter(c => c.id !== id), queue: d.queue.filter(q => q !== id) }) }
export function moveCard (deck, id, to) {
  const d = sanitizeDeck(deck); const i = d.cards.findIndex(c => c.id === id); if (i < 0) return d
  const j = Math.max(0, Math.min(d.cards.length - 1, Math.floor(Number(to)) || 0)); const cards = d.cards.slice(); const [c] = cards.splice(i, 1); cards.splice(j, 0, c)
  return sanitizeDeck({ ...d, cards })
}

export function startRound (deck, rng = Math.random) {
  const d = sanitizeDeck(deck); const q = d.cards.map(c => c.id)
  for (let i = q.length - 1; i > 0; i--) { const j = Math.floor((typeof rng === 'function' ? rng() : Math.random()) * (i + 1)); [q[i], q[j]] = [q[j], q[i]] }
  return q
}
export function restart (deck, shuffle = false, rng = Math.random) {
  const d = sanitizeDeck(deck)
  return sanitizeDeck({ ...d, queue: shuffle ? startRound(d, rng) : d.cards.map(c => c.id), side: 'front', got: 0, again: 0, rounds: d.rounds + 1 })
}
export function current (deck) { const d = sanitizeDeck(deck); const id = d.queue[0]; return d.cards.find(c => c.id === id) ?? null }
export function progress (deck) { const d = sanitizeDeck(deck); return { total: d.cards.length, left: d.queue.length, got: d.got, again: d.again, done: d.cards.length > 0 && d.queue.length === 0, side: d.side } }
export function flip (deck) { const d = sanitizeDeck(deck); return d.queue.length ? { ...d, side: d.side === 'front' ? 'back' : 'front' } : d }
export function next (deck) { const d = sanitizeDeck(deck); if (d.queue.length < 2) return { ...d, side: 'front' }; return { ...d, queue: [...d.queue.slice(1), d.queue[0]], side: 'front' } }
export function prev (deck) { const d = sanitizeDeck(deck); if (d.queue.length < 2) return { ...d, side: 'front' }; return { ...d, queue: [d.queue[d.queue.length - 1], ...d.queue.slice(0, -1)], side: 'front' } }
export function mark (deck, how) {
  const d = sanitizeDeck(deck); if (!d.queue.length) return d
  if (how === 'got') return { ...d, queue: d.queue.slice(1), got: d.got + 1, side: 'front' }
  if (how === 'again') return { ...d, queue: d.queue.length > 1 ? [...d.queue.slice(1), d.queue[0]] : d.queue, again: d.again + 1, side: 'front' }
  return d
}

export function toJSON (deck) { const d = sanitizeDeck(deck); return JSON.stringify({ schema: SCHEMA, title: d.title, speak: d.speak, cards: d.cards.map(c => ({ front: c.front, back: c.back })) }, null, 1) }
export function fromJSON (text) {
  let o; try { o = JSON.parse(String(text ?? '')) } catch (_) { throw new Error('That is not a JSON file.') }
  if (!o || typeof o !== 'object' || o.schema !== SCHEMA || !Array.isArray(o.cards)) throw new Error('That file is not a Flashcards deck (expected schema ' + SCHEMA + ').')
  return sanitizeDeck({ title: o.title, speak: o.speak, cards: o.cards.map(c => ({ front: c?.front, back: c?.back })) })
}
const csvCell = (t) => { const s = String(t ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
export function toCSV (deck) { const d = sanitizeDeck(deck); return ['front,back', ...d.cards.map(c => csvCell(c.front.text) + ',' + csvCell(c.back.text))].join('\n') + '\n' }
export function fromCSV (text) {
  const src = String(text ?? '').replace(/^﻿/, ''); const rows = []; let row = [], cell = '', q = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += ch }
    else if (ch === '"' && cell === '') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
    if (rows.length > LIMITS.cards + 2) break
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const body = rows.filter(r => r.some(c => c.trim() !== '')); if (body.length && /^front$/i.test(body[0][0].trim()) && /^back$/i.test((body[0][1] ?? '').trim())) body.shift()
  if (!body.length) throw new Error('No cards found (expected lines like: front,back).')
  return sanitizeDeck({ cards: body.map(r => ({ front: { text: r[0] ?? '' }, back: { text: r[1] ?? '' } })) })
}
