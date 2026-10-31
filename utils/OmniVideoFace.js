/**
 * utils/OmniVideoFace.js (V257) — pure rules for video faces on a PolyNode / semantics cube.
 *   MAX_PLAYING = 2 videos play at once (each one is a decoder and a texture update); starting a third stops the one that started first.
 *   FRAME_MS = 83 (about 12 pictures a second drawn onto the face; the sound plays at full rate)
 *   playPlan(playing, key, max) -> { action: 'start'|'stop', stop: [keys to stop] }     playing = [key, ...] oldest first
 *   posterTime(duration) -> seconds to show as the still picture        frameDue(lastMs, nowMs, every) -> boolean
 *   videoKey(nodeId, index) -> 'nodeId#index'
 */
export const MAX_PLAYING = 2
export const FRAME_MS = 83
export const videoKey = (nodeId, index) => `${String(nodeId)}#${Number(index) | 0}`

export function playPlan (playing = [], key, max = MAX_PLAYING) {
  const list = Array.isArray(playing) ? playing.filter(k => typeof k === 'string') : []
  if (list.includes(key)) return { action: 'stop', stop: [key] }                  // pressing play on a playing face pauses it
  const m = Math.max(1, Math.min(8, Math.round(Number.isFinite(max) ? max : MAX_PLAYING)))
  const over = Math.max(0, list.length + 1 - m)
  return { action: 'start', stop: list.slice(0, over) }
}

export function posterTime (duration) {
  const d = Number(duration); if (!Number.isFinite(d) || d <= 0) return 0
  return Math.min(1, d / 2)       // a moment in, not the first (often black) frame
}

export function frameDue (lastMs, nowMs, every = FRAME_MS) {
  const a = Number(lastMs); const b = Number(nowMs)
  if (!Number.isFinite(b)) return false
  return !Number.isFinite(a) || b - a >= every
}
