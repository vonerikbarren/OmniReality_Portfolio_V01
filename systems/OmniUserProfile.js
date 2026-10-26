/**
 * systems/OmniUserProfile.js — ⟐OmniUser profile + wellness state
 *
 * "OmniUser is more for non-gamers while OmniPlayer is for gamers" —
 * stated directly. This holds real, personal profile information
 * (not game progress) and the 14 Dimensions of Wellness
 * (data/OmniUserWellness.js), each a real, user-set 0-100 rating.
 * Persists to localStorage, matching the established pattern used
 * throughout this project.
 */

import { WELLNESS_DIMENSIONS, buildDefaultWellness } from '../data/OmniUserWellness.js'

const STORE_KEY = 'omni:user:profile'

function defaultProfile () {
  return {
    displayName: '',
    bio: '',
    avatarSymbol: '⟐',
    wellness: buildDefaultWellness(),
  }
}

function loadProfile () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return defaultProfile()
    const saved = JSON.parse(raw)
    return { ...defaultProfile(), ...saved, wellness: { ...buildDefaultWellness(), ...(saved.wellness ?? {}) } }
  } catch (_) { return defaultProfile() }
}
function saveProfile (profile) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(profile)) } catch (_) {}
}

export default class OmniUserProfile {
  constructor () {
    this.profile = null
  }

  init () {
    this.profile = loadProfile()
  }

  update () {}
  onResize () {}
  destroy () {}

  getProfile () { return this.profile }

  setField (field, value) {
    if (!(field in this.profile) || field === 'wellness') return
    this.profile[field] = value
    saveProfile(this.profile)
    window.dispatchEvent(new CustomEvent('omni:user-profile-changed', { detail: { field, value } }))
  }

  setWellness (dimension, value) {
    if (!WELLNESS_DIMENSIONS.includes(dimension)) return
    this.profile.wellness[dimension] = Math.max(0, Math.min(100, value))
    saveProfile(this.profile)
    window.dispatchEvent(new CustomEvent('omni:user-wellness-changed', { detail: { dimension, value: this.profile.wellness[dimension] } }))
  }

  getWellnessAverage () {
    const values = WELLNESS_DIMENSIONS.map(d => this.profile.wellness[d])
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }
}
