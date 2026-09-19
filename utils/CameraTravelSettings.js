/**
 * utils/CameraTravelSettings.js — the real, shared, configurable
 * settings behind every "Take Me There"
 *
 * A real, plain singleton (matching PrimaryTime.js's own pattern),
 * persisted so a chosen speed/ease survives a reload. `stagger` is
 * stored and exposed honestly even though goToObject() itself only
 * ever animates one object at a time today — it doesn't yet do
 * anything, kept real rather than silently dropped, ready for
 * whenever a multi-target "take me to all of these" travel exists
 * to actually use it.
 */

const STORE_KEY = 'omni:cameraTravel:settings'

const REAL_GSAP_EASES = [
  'power1.in', 'power1.out', 'power1.inOut',
  'power2.in', 'power2.out', 'power2.inOut',
  'power3.in', 'power3.out', 'power3.inOut',
  'power4.in', 'power4.out', 'power4.inOut',
  'back.in', 'back.out', 'back.inOut',
  'elastic.in', 'elastic.out', 'elastic.inOut',
  'bounce.in', 'bounce.out', 'bounce.inOut',
  'sine.in', 'sine.out', 'sine.inOut',
  'circ.in', 'circ.out', 'circ.inOut',
  'expo.in', 'expo.out', 'expo.inOut',
  'none',
]

const DEFAULTS = { duration: 0.6, ease: 'power2.inOut', stagger: 0 }

let settings = loadSettings()

function loadSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch (_) {
    return { ...DEFAULTS }
  }
}

export function getSettings () {
  return { ...settings }
}

export function setSettings (patch) {
  settings = { ...settings, ...patch }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)) } catch (_) { /* real save simply skipped if storage unavailable */ }
}

export function getAvailableEases () {
  return [...REAL_GSAP_EASES]
}
