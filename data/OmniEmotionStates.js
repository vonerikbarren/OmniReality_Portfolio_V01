/**
 * data/OmniEmotionStates.js — the real, named states for
 * modules/OmniEmotionParticles.js
 *
 * Confirmed, named directly: Normal Walking (relative to real step
 * speed), Dash, Scared, Mad, Sad, Happy, Peace, Chaos, Thinking/
 * Passive. Four more proposed here, per direct invitation ("any
 * other you feel like would be necessary"): Confused (a real,
 * distinct middle ground between Thinking's calm and Chaos's
 * unpredictability), Excited (more energetic than Happy — a real,
 * separate register for "something great just happened"), Focused
 * (particles genuinely point/converge toward the look direction —
 * useful for investigating/examining moments), and Alert (a sharp,
 * one-shot system-level flash — not strictly an emotion, but the
 * same real mechanism genuinely fits error/warning feedback, e.g. a
 * failed OmniCommandTerminal command).
 *
 * Each state is real, declarative config — a color, a real motion
 * type (see MOTION_TYPES below), and the real intensity knobs that
 * drive modules/OmniEmotionParticles.js's own per-motion-type math.
 * Adding a new state is adding one real entry here, not new
 * particle logic.
 */

// Real, distinct motion behaviors — modules/OmniEmotionParticles.js
// implements exactly these, and every state below picks one.
export const MOTION_TYPES = {
  DRIFT: 'drift',       // gentle trailing behind camera movement (reuses StepMarker, like the existing Trail)
  SCATTER: 'scatter',   // erratic, short, unpredictable small darts
  PULSE: 'pulse',       // sharp, repeating outward bursts
  SINK: 'sink',         // slow, gravity-like downward drift
  BOUNCE: 'bounce',     // playful, upward/outward bob
  ORBIT: 'orbit',       // smooth, circular motion around the camera
  CHAOS: 'chaos',       // fully randomized direction + randomized hue per particle
  CONVERGE: 'converge', // particles move toward the camera's own look direction
  FLASH: 'flash',       // one-shot, sharp, fast fade — not continuous
}

export const EMOTION_STATES = {
  normalWalking: {
    label: 'Normal Walking',
    color: '#bcd8ff', motion: MOTION_TYPES.DRIFT,
    speedMultiplier: 1, density: 1, jitter: 0.15,
  },
  dash: {
    label: 'Dash',
    color: '#e0faff', motion: MOTION_TYPES.DRIFT,
    speedMultiplier: 2.2, density: 1.8, jitter: 0.1,
  },
  scared: {
    label: 'Scared',
    color: '#9fb3c8', motion: MOTION_TYPES.SCATTER,
    speedMultiplier: 1.6, density: 0.7, jitter: 0.9,
  },
  mad: {
    label: 'Mad',
    color: '#ff4d4d', motion: MOTION_TYPES.PULSE,
    speedMultiplier: 1.8, density: 1.6, jitter: 0.5,
  },
  sad: {
    label: 'Sad',
    color: '#5c6b8a', motion: MOTION_TYPES.SINK,
    speedMultiplier: 0.4, density: 0.5, jitter: 0.1,
  },
  happy: {
    label: 'Happy',
    color: '#ffd966', motion: MOTION_TYPES.BOUNCE,
    speedMultiplier: 1.3, density: 1.4, jitter: 0.4,
  },
  peace: {
    label: 'Peace',
    color: '#c8ffe0', motion: MOTION_TYPES.ORBIT,
    speedMultiplier: 0.3, density: 0.6, jitter: 0.05,
  },
  chaos: {
    label: 'Chaos',
    color: '#ffffff',   // real base color — CHAOS motion randomizes hue per particle regardless
    motion: MOTION_TYPES.CHAOS,
    speedMultiplier: 2, density: 2, jitter: 1,
  },
  thinkingPassive: {
    label: 'Thinking / Passive',
    color: '#b39cff', motion: MOTION_TYPES.ORBIT,
    speedMultiplier: 0.15, density: 0.25, jitter: 0.05,
  },
  confused: {
    label: 'Confused',
    color: '#d9cf8c', motion: MOTION_TYPES.SCATTER,
    speedMultiplier: 0.6, density: 0.4, jitter: 0.35,
  },
  excited: {
    label: 'Excited',
    color: '#ff9d47', motion: MOTION_TYPES.BOUNCE,
    speedMultiplier: 2, density: 1.9, jitter: 0.6,
  },
  focused: {
    label: 'Focused',
    color: '#66e0ff', motion: MOTION_TYPES.CONVERGE,
    speedMultiplier: 1.2, density: 0.8, jitter: 0.05,
  },
  alert: {
    label: 'Alert',
    color: '#ff2222', motion: MOTION_TYPES.FLASH,
    speedMultiplier: 3, density: 1, jitter: 0.2,
  },
}
