/**
 * utils/OmniClaimVault.js (V258) — the PRIVATE form of a claim. A public claim is plain data; a private one is SEALED with a key (passphrase):
 * AES-GCM-256, key derived by PBKDF2-SHA256 (210k rounds, random salt), fresh random IV per seal. Without the key only the title and
 * "private" are visible. A wrong key or any tampering fails to open (GCM tag), never returns garbage. Uses WebCrypto (browser and Node 19+).
 */
import { sanitizeClaim } from './OmniClaimModel.js'
export const VAULT_FORMAT = 'omni-claim-vault/1'
export const PBKDF2_ROUNDS = 210000
const subtle = () => { const s = globalThis.crypto?.subtle; if (!s) throw new Error('WebCrypto is not available here'); return s }
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s) }
const unb64 = (s) => { if (typeof s !== 'string' || s.length > 8e6 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('bad vault data'); const t = atob(s); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u }
async function deriveKey (pass, salt, rounds) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
const goodPass = (p) => typeof p === 'string' && p.length >= 4 && p.length <= 256
/** Seal a claim -> { format, id, claim (title), visibility:'private', salt, iv, data, rounds }. */
export async function sealClaim (claim, passphrase, { rounds = PBKDF2_ROUNDS } = {}) {
  if (!goodPass(passphrase)) throw new Error('the key must be 4 to 256 characters')
  const c = sanitizeClaim({ ...claim, visibility: 'private' })
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const r = Math.min(Math.max(1000, rounds | 0), 1e6)
  const key = await deriveKey(passphrase, salt, r)
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(c))))
  return { format: VAULT_FORMAT, id: c.id, claim: c.claim, visibility: 'private', rounds: r, salt: b64(salt), iv: b64(iv), data: b64(ct) }
}
/** Open a sealed claim. Throws 'wrong key or damaged vault' for a wrong key or any change to the data. */
export async function openClaim (sealed, passphrase) {
  if (!sealed || typeof sealed !== 'object' || sealed.format !== VAULT_FORMAT) throw new Error('not a sealed claim')
  if (!goodPass(passphrase)) throw new Error('wrong key or damaged vault')
  try {
    const rounds = Math.min(Math.max(1000, Number(sealed.rounds) | 0), 1e6)
    const key = await deriveKey(passphrase, unb64(sealed.salt), rounds)
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.data))
    return sanitizeClaim(JSON.parse(new TextDecoder().decode(pt)))
  } catch { throw new Error('wrong key or damaged vault') }
}
export const isSealed = (v) => !!v && typeof v === 'object' && v.format === VAULT_FORMAT
/** What anyone may see of a sealed claim without the key. */
export const publicFace = (v) => (isSealed(v) ? { id: String(v.id || ''), claim: String(v.claim || '').slice(0, 300), visibility: 'private', sealed: true } : null)
