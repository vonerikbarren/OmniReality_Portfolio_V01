/**
 * utils/TimeData.js — the real, standalone TimeData primitive
 *
 * Confirmed directly as a real thing in its own right, not just a
 * parameter bag — created once per node (or reused across several,
 * per perspectiveTime()), holding both the natural and the
 * manipulated timestamp together.
 *
 * The natural/manipulated split is modeled directly on Breath of
 * the Wild's Stasis: the world's own clock (naturalSeconds) never
 * pauses or reverses — it always tracks PrimaryTime.js's own flow.
 * manipulatedSeconds is the separate, real, per-node override that
 * CAN be rewound, held, or pushed ahead — independent of the first.
 * A growing gap between the two is a real, honest signal (the same
 * shape as Desire vs. PrimaryForce, and OmniValue's declared-rate
 * vs. actual-remainder), not asserted, just measured.
 */

export function createTimeData (naturalSeconds, format = 'military') {
  return {
    naturalSeconds,
    manipulatedSeconds: naturalSeconds,   // starts in sync — no manipulation yet
    format,   // 'military' | 'ampm' — both real, switchable, never one replacing the other
  }
}

/** The real, honest tamper signal — how far a node's manipulated
 *  time has drifted from its own natural time. */
export function getDrift (timeData) {
  return timeData.manipulatedSeconds - timeData.naturalSeconds
}

export function formatSeconds (totalSeconds, format) {
  const totalMinutes = Math.floor(totalSeconds / 60)
  const hours24 = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  const mm = String(minutes).padStart(2, '0')

  if (format === 'ampm') {
    const period = hours24 >= 12 ? 'PM' : 'AM'
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
    return `${hours12}:${mm} ${period}`
  }
  return `${String(hours24).padStart(2, '0')}:${mm}`
}
