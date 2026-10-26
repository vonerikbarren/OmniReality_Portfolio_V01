/**
 * utils/DesirePrimaryForce.js — the minimal Desire/PrimaryForce hook
 *
 * Explicitly NOT the full verification system — that's real,
 * internal work flagged as needing more time later. This is just
 * the mechanism: a real, generic way for anything to declare forward
 * intent (Desire) and later confirm whether the actual outcome
 * (PrimaryForce) matched it, so the deeper system has real events to
 * attach to whenever it's actually designed.
 *
 * Desire projects. PrimaryForce confirms. Both are real letters in
 * the language's own 30 (architecture/THE_30_RECLASSIFICATION.md) —
 * Desire() is Intent, PrimaryForce() is Purpose.
 */

export function declareDesire (intent, detail = {}) {
  window.dispatchEvent(new CustomEvent('omni:desire-declared', { detail: { intent, ...detail, at: Date.now() } }))
}

export function confirmPrimaryForce (outcome, matchesDesire, detail = {}) {
  window.dispatchEvent(new CustomEvent('omni:primaryforce-confirmed', { detail: { outcome, matchesDesire, ...detail, at: Date.now() } }))
}
