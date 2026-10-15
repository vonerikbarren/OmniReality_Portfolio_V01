/**
 * utils/OmniTimeStretch.js (V202) — pure WSOLA time stretch: change the TEMPO of audio without changing its pitch ("key lock").
 * No DOM, no AudioContext: it works on Float32Array channels, so it runs in Node tests and in the browser. Used by systems/OmniMixEngine.js for deck strips with key lock.
 *
 * Method (waveform-similarity overlap-add): the output is built from overlapping Hann-windowed frames. Frames (75 % overlap) are read from the input `rate` times faster than they are written
 * (analysis hop = synthesis hop x rate); each frame start is nudged within a small search window to the place that best continues the previous frame (normalised cross-correlation
 * on a down-sampled mono mix), so waveforms line up and no flanging or warble builds up. Every channel uses the same frame positions (keeps the stereo image).
 *
 * rate > 1 = faster (shorter output), rate < 1 = slower (longer). Allowed 0.25..4. Output length = input length / rate.
 * Quality: good for rate 0.7..1.4 (what DJ pitch ranges need); outside that it still works but sounds more processed. Percussive hits can smear slightly.
 * Cost: about 40 ns per input sample per channel on a normal CPU, so 3 minutes of stereo takes about 1 s; stretchAsync() splits the work into slices that yield to the browser.
 * Never throws on bad input: returns the input unchanged (copied) for rate ~ 1 or a clip too short to stretch.
 */

export const STRETCH_LIMITS = Object.freeze({ rateMin: 0.25, rateMax: 4, maxSeconds: 900, frameSeconds: 0.04, searchSeconds: 0.012, decimate: 8 })

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

function plan (length, sampleRate, rate) {
  const sr = isNum(sampleRate) && sampleRate >= 8000 && sampleRate <= 384000 ? sampleRate : 44100
  let N = 1; while (N < sr * STRETCH_LIMITS.frameSeconds) N <<= 1   // frame length: power of two (2048 at 44.1 kHz)
  const Hs = N >> 2                                                     // synthesis hop (75 % overlap: the windows sum to a constant, divided out by wsum)
  const Ha = Hs * rate                                                  // analysis hop (can be fractional)
  // the search window must not let two frames drift so far apart that input samples between them are never read (a dropped drum hit)
  const delta = Math.max(8, Math.min(Math.round(sr * STRETCH_LIMITS.searchSeconds), Math.floor((0.9 * N - Ha) / 2)))
  const outLen = Math.max(1, Math.round(length / rate))
  const frames = Math.ceil(outLen / Hs) + 1
  return { sr, N, Hs, Ha, delta, outLen, frames }
}

/** A stretch job that can be run in slices. Use stretchChannels / stretchAsync unless you need control. */
export class Stretcher {
  constructor (channels, sampleRate, rate) {
    const chans = Array.isArray(channels) ? channels.filter(c => c && typeof c.length === 'number' && c.length > 0).slice(0, 8) : []
    this.ok = false
    this.rate = isNum(rate) ? clamp(rate, STRETCH_LIMITS.rateMin, STRETCH_LIMITS.rateMax) : 1
    if (!chans.length) { this.chans = []; this.result = []; this.done = true; return }
    this.chans = chans
    const len = Math.min(...chans.map(c => c.length))
    this.len = len
    const sr = isNum(sampleRate) ? sampleRate : 44100
    if (len < 4096 || Math.abs(this.rate - 1) < 0.002 || len / sr > STRETCH_LIMITS.maxSeconds) {
      this.result = chans.map(c => Float32Array.from(c.subarray ? c.subarray(0, len) : Array.prototype.slice.call(c, 0, len)))
      this.done = true; this.passthrough = true
      return
    }
    const p = plan(len, sr, this.rate)
    this.p = p
    this.win = new Float32Array(p.N); for (let i = 0; i < p.N; i++) this.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / p.N)
    this.out = chans.map(() => new Float32Array(p.outLen + p.N))
    this.wsum = new Float32Array(p.outLen + p.N)
    // mono, decimated copy for the similarity search
    const D = STRETCH_LIMITS.decimate
    this.D = D
    const dl = Math.floor(len / D)
    this.mono = new Float32Array(dl)
    for (let i = 0; i < dl; i++) { let s = 0; for (const c of chans) s += c[i * D]; this.mono[i] = s / chans.length }
    this.k = 0            // frame index
    this.prev = 0         // input start of the previous frame
    this.done = false
    this.ok = true
  }

  /** Process up to `maxFrames` frames. Returns true when finished. */
  step (maxFrames = 64) {
    if (this.done) return true
    const { N, Hs, Ha, delta, frames } = this.p
    const { win, out, wsum, chans, mono, D, len } = this
    let n = 0
    while (this.k < frames && n < maxFrames) {
      const k = this.k
      let start
      if (k === 0) start = 0
      else {
        const ideal = Math.round(k * Ha)
        const natural = this.prev + Hs                       // where the previous frame would naturally continue
        const lo = Math.max(0, ideal - delta); const hi = Math.min(len - N, ideal + delta)
        if (hi <= lo || natural + N > len) start = clamp(ideal, 0, Math.max(0, len - N))
        else {
          // compare the first half-frame of each candidate with the natural continuation (decimated)
          const L = Math.floor(2 * Hs / D); const tn = Math.floor(natural / D)
          let best = -Infinity; start = clamp(ideal, lo, hi)
          let en = 0; for (let i = 0; i < L; i++) { const v = mono[tn + i] ?? 0; en += v * v }
          for (let c = lo; c <= hi; c += D) {
            const tc = Math.floor(c / D)
            let dot = 0; let ec = 0
            for (let i = 0; i < L; i++) { const a = mono[tc + i] ?? 0; dot += a * (mono[tn + i] ?? 0); ec += a * a }
            const score = dot / Math.sqrt(ec * en + 1e-9)
            if (score > best) { best = score; start = c }
          }
          // refine on the full-rate grid around the best coarse candidate
          let bestFine = -Infinity; let fineStart = start
          const m0 = chans[0]
          for (let c = Math.max(lo, start - D); c <= Math.min(hi, start + D); c++) {
            let dot = 0; let ec = 0; let en2 = 0
            for (let i = 0; i < 2 * Hs; i += 2) { const a = m0[c + i]; const b = m0[natural + i] ?? 0; dot += a * b; ec += a * a; en2 += b * b }
            const score = dot / Math.sqrt(ec * en2 + 1e-9)
            if (score > bestFine) { bestFine = score; fineStart = c }
          }
          start = fineStart
        }
      }
      const o = k * Hs
      for (let ci = 0; ci < chans.length; ci++) {
        const src = chans[ci]; const dst = out[ci]
        for (let i = 0; i < N; i++) {
          const w = win[i]; const si = start + i
          if (si >= len) break
          dst[o + i] += src[si] * w
        }
      }
      for (let i = 0; i < N; i++) wsum[o + i] += win[i]
      this.prev = start
      this.k++; n++
    }
    if (this.k >= frames) this._finish()
    return this.done
  }

  _finish () {
    const { outLen } = this.p
    const { out, wsum } = this
    this.result = out.map((dst) => {
      const r = new Float32Array(outLen)
      for (let i = 0; i < outLen; i++) { const w = wsum[i]; r[i] = w > 1e-3 ? dst[i] / w : 0 }
      return r
    })
    this.out = null; this.wsum = null; this.mono = null
    this.done = true
  }

  /** Progress 0..1. */
  get progress () { return this.done ? 1 : this.p ? clamp(this.k / this.p.frames, 0, 1) : 1 }
}

/** Stretch all channels in one go. Returns Float32Array[] (the same count of channels). */
export function stretchChannels (channels, sampleRate, rate) {
  const s = new Stretcher(channels, sampleRate, rate)
  while (!s.done) s.step(256)
  return s.result
}

/**
 * Stretch in slices so the page stays responsive. opts: { sliceFrames = 48, yieldFn = () => new Promise(r => setTimeout(r, 0)), cancelled = () => false, onProgress(p) }.
 * Resolves to the channels, or null when cancelled.
 */
export async function stretchAsync (channels, sampleRate, rate, opts = {}) {
  const s = new Stretcher(channels, sampleRate, rate)
  const slice = clamp(Math.round(Number(opts.sliceFrames) || 48), 1, 4096)
  const yieldFn = typeof opts.yieldFn === 'function' ? opts.yieldFn : () => new Promise(r => setTimeout(r, 0))
  const cancelled = typeof opts.cancelled === 'function' ? opts.cancelled : () => false
  while (!s.done) {
    if (cancelled()) return null
    s.step(slice)
    try { opts.onProgress?.(s.progress) } catch (_) { /* a listener must not stop the job */ }
    if (!s.done) await yieldFn()
  }
  return cancelled() ? null : s.result
}

/** Output length in samples for an input length and rate (what stretchChannels returns). */
export const stretchedLength = (length, rate) => Math.max(1, Math.round((isNum(length) && length > 0 ? length : 0) / (isNum(rate) ? clamp(rate, STRETCH_LIMITS.rateMin, STRETCH_LIMITS.rateMax) : 1)))

export default { STRETCH_LIMITS, Stretcher, stretchChannels, stretchAsync, stretchedLength }
