/**
 * utils/OmniGate.js — the rules of the OmniPassKeyRing gate (V276). Pure: no DOM, no clock (time is passed in).
 *
 * SHOWCASE ONLY. This runs in the browser, so it is not security: any entry is accepted except one demo code, which is denied
 * so the error and the wait protocol can be seen. Real protection needs a server check or an encrypted scene (see claude/OMNIPASSKEYRING_DESIGN.md).
 *
 * An entry is { username, glyph, text, digits }:
 *   username  who is visiting (data; "Guest" is fine)
 *   glyph     0..49 picked from the palette (utils/OmniKeyGlyphs.js)
 *   text      the string the glyph is bound to (the glyph alone shows nothing; the string alone is not enough)
 *   digits    the digit key: 6 or 10 digits
 */
import { sanitizeGlyphId } from './OmniKeyGlyphs.js'

export const DIGIT_LENGTHS = Object.freeze([6, 10])
export const DENIED_TEXT = 'Access denied. Check your glyph, string and digits.'   // generic on purpose: never says which field was wrong
export const MAX_TEXT = 64
export const MAX_USERNAME = 32

/** The demo code that is denied: all zeros of the chosen length. */
export function demoDeniedDigits (len) { return '0'.repeat(len === 10 ? 10 : 6) }

export function sanitizeGateEntry (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '')
  return {
    username: clean(r.username, MAX_USERNAME).trim(),
    glyph: sanitizeGlyphId(r.glyph),
    text: clean(r.text, MAX_TEXT),
    digits: (typeof r.digits === 'string' ? r.digits : '').replace(/\D/g, '').slice(0, 10)
  }
}

/** Which required fields are still empty (the visitor may be told this: it is not a secret). */
export function missingFields (entry, len = 6) {
  const e = sanitizeGateEntry(entry), out = []
  if (e.glyph === null) out.push('glyph')
  if (!e.text) out.push('string')
  if (e.digits.length !== (len === 10 ? 10 : 6)) out.push('digits')
  return out
}

/** { ok, code } with code 'ok' | 'incomplete' | 'denied'. */
export function evaluateEntry (entry, len = 6) {
  const e = sanitizeGateEntry(entry), L = len === 10 ? 10 : 6
  if (missingFields(e, L).length) return { ok: false, code: 'incomplete' }
  if (e.digits === demoDeniedDigits(L)) return { ok: false, code: 'denied' }
  return { ok: true, code: 'ok' }
}

/**
 * The wait protocol. `free` wrong tries are allowed; after the next failure the gate pauses, for waits[0] seconds, then waits[1] ... (the last one repeats).
 * All times are milliseconds passed in by the caller.
 */
export function createGateState (opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  const free = Number.isInteger(o.free) && o.free >= 0 && o.free <= 20 ? o.free : 3
  const waits = Array.isArray(o.waits) && o.waits.length && o.waits.every(w => Number.isFinite(w) && w >= 0 && w <= 3600) ? o.waits.slice(0, 20) : [5, 15, 45]
  let fails = 0, until = 0
  return {
    free, waits,
    fail (now) {
      fails++
      // the pause starts with the failure that uses up the free tries (3rd wrong try -> waits[0]), then grows
      const lock = fails >= free ? waits[Math.min(fails - free, waits.length - 1)] * 1000 : 0
      until = lock > 0 ? now + lock : 0
      return { fails, lockMs: lock, until, triesLeft: Math.max(0, free - fails) }
    },
    success () { fails = 0; until = 0 },
    isLocked (now) { return until > now },
    remainingMs (now) { return Math.max(0, until - now) },
    get fails () { return fails },
    triesLeft () { return Math.max(0, free - fails) }
  }
}
