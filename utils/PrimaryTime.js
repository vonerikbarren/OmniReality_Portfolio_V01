/**
 * utils/PrimaryTime.js — the real Primary Time controller's clock
 * source
 *
 * "We will need a controller for primary time" — this is that
 * controller's actual state and math, as a real, shared singleton
 * (matching the registry pattern already used elsewhere), driven
 * every frame by ui/OmniChronos.js's own update(delta) rather than
 * needing a second, separate render-loop entry.
 *
 * The Master Tunnel's own global flow — confirmed directly: never
 * pauses on its own, never reverses. play()/pause() here control
 * whether it's advancing *for the purposes of this session*, not a
 * manipulated rewind — that's a separate, per-node concept
 * (TimeData.js), never applied here.
 */

let currentSeconds = 0   // seconds since this reality's own epoch — arbitrary but real, always advancing when playing
let playing = true
let speedMultiplier = 1

export function advance (delta) {
  if (!playing) return
  currentSeconds += delta * speedMultiplier
}

/** V172: announce play/pause/speed changes (the ribbon's Play button and the OmniChronos player listen);
 *  seeking is reported by the timeline (omni:timeline-playhead). Backward compatible: nothing else listens. */
function announce () {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('omni:primarytime-state', { detail: { playing, speed: speedMultiplier } }))
  } catch (_) {}
}

export function play () { const ch = !playing; playing = true; if (ch) announce() }
export function pause () { const ch = playing; playing = false; if (ch) announce() }
export function isPlaying () { return playing }

export function setSpeed (multiplier) {
  const m = Number.isFinite(multiplier) ? Math.max(0, multiplier) : speedMultiplier
  const ch = m !== speedMultiplier
  speedMultiplier = m
  if (ch) announce()
}
export function getSpeed () { return speedMultiplier }

export function getCurrentSeconds () { return currentSeconds }

/** Real, explicit jump — used for setting a specific starting time,
 *  not for the moment-to-moment manipulated-time concept, which
 *  lives per-node in TimeData.js instead. */
export function setCurrentSeconds (seconds) {
  currentSeconds = Math.max(0, seconds)
}
