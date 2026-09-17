/**
 * systems/OmniPlayerGame.js — ⟐OmniPlayer game state
 *
 * The core loop: collect Aspects belonging to a Core Reality; once
 * every Aspect of one Core Reality is collected, that reality's
 * truth is exposed — a greater whole that couldn't have existed
 * while its Aspects were still scattered. 30 Core Realities exist
 * (data/OmniPlayerRealities.js).
 *
 * Real cross-product reuse, not siloed: exposing a truth pushes a
 * real notification through the already-built OmniNotify system
 * (`omni:notify-push`) rather than a separate, parallel alert —
 * this is meant to work in tandem with any other OmniProduct, per
 * the request, and OmniNotify is the real, existing surface for
 * "something important just happened."
 *
 * Emotional state + visor color: a small, real state machine.
 * Collecting nudges toward Curious; completing a reality triggers
 * Triumphant briefly, then settles back to Neutral. The active
 * particle aura (modules/OmniExpressionator.js's new 'playerAura'
 * preset) and the dashboard's Visors tab both read this same real
 * state, not two separate copies of it.
 *
 * Persists progress to localStorage — collected Aspects and exposed
 * Realities survive a reload, matching the established pattern used
 * throughout this project.
 */

import buildRealities, { CORE_REALITY_COUNT } from '../data/OmniPlayerRealities.js'

const STORE_KEY = 'omni:player:progress'

export const EMOTIONAL_STATES = {
  neutral:    { label: 'Neutral',    color: '#ffffff' },
  curious:    { label: 'Curious',    color: '#7fd8ff' },
  focused:    { label: 'Focused',    color: '#8cff8c' },
  alert:      { label: 'Alert',      color: '#ff6666' },
  triumphant: { label: 'Triumphant', color: '#ffd700' },
}
const TRIUMPHANT_DURATION_MS = 4000   // how long the visor/aura stays gold after exposing a truth, before settling back

function loadProgress () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (_) { return null }
}
function saveProgress (realities) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(realities)) } catch (_) {}
}

export default class OmniPlayerGame {
  constructor () {
    this.realities = null
    this.emotionalState = 'neutral'
    this._triumphantTimer = null
    this._onExternalCollect = null
  }

  init () {
    const saved = loadProgress()
    this.realities = saved && Array.isArray(saved) && saved.length === CORE_REALITY_COUNT ? saved : buildRealities()
    try { this._lifeSkillsCount = Number(localStorage.getItem('omni:player:lifeskills')) || 0 } catch (_) { this._lifeSkillsCount = 0 }

    this._onExternalCollect = (e) => {
      const { realityId, aspectId } = e.detail ?? {}
      if (realityId && aspectId) this.collectAspect(realityId, aspectId)
    }
    window.addEventListener('omni:player-collect-aspect', this._onExternalCollect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:player-collect-aspect', this._onExternalCollect)
    clearTimeout(this._triumphantTimer)
  }

  /** Real collection — marks the specific Aspect, checks whether its
   *  whole Core Reality is now complete, and if so, actually exposes
   *  the truth: flips the flag, notifies through the real OmniNotify
   *  system, and nudges the emotional state to Triumphant. */
  collectAspect (realityId, aspectId) {
    const reality = this.realities.find(r => r.id === realityId)
    if (!reality) return false
    const aspect = reality.aspects.find(a => a.id === aspectId)
    if (!aspect || aspect.collected) return false

    aspect.collected = true
    this._setEmotionalState('curious')

    const allCollected = reality.aspects.every(a => a.collected)
    if (allCollected && !reality.exposed) {
      reality.exposed = true
      this._exposeTruth(reality)
    }

    saveProgress(this.realities)
    window.dispatchEvent(new CustomEvent('omni:player-aspect-collected', { detail: { realityId, aspectId } }))
    return true
  }

  _exposeTruth (reality) {
    this._setEmotionalState('triumphant')
    clearTimeout(this._triumphantTimer)
    this._triumphantTimer = setTimeout(() => this._setEmotionalState('neutral'), TRIUMPHANT_DURATION_MS)

    window.dispatchEvent(new CustomEvent('omni:reality-truth-exposed', { detail: { realityId: reality.id, label: reality.label } }))
    window.dispatchEvent(new CustomEvent('omni:notify-push', {
      detail: { text: `⟐ Truth exposed: ${reality.label} — all ${reality.aspects.length} aspects gathered.` }
    }))
  }

  _setEmotionalState (state) {
    if (!EMOTIONAL_STATES[state]) return
    this.emotionalState = state
    window.dispatchEvent(new CustomEvent('omni:player-emotional-state-changed', {
      detail: { state, color: EMOTIONAL_STATES[state].color }
    }))
  }

  /** Real, current-state accessors — for the dashboard, OmniPocket's
   *  new tab, and the particle aura, all reading the same real data
   *  rather than each keeping their own copy. */
  getRealities () { return this.realities }
  getReality (id) { return this.realities.find(r => r.id === id) ?? null }
  getExposedCount () { return this.realities.filter(r => r.exposed).length }
  getTotalAspectsCollected () {
    return this.realities.reduce((sum, r) => sum + r.aspects.filter(a => a.collected).length, 0)
  }
  getCurrentVisorColor () { return EMOTIONAL_STATES[this.emotionalState].color }

  /** Number of Life Skills — a real, persisted count, per the
   *  explicit request that this "be shown" even with no fuller
   *  design given yet for what constitutes one. Just the count,
   *  honestly, not an invented skill-tracking system layered on top
   *  of a request that only asked for a number. */
  getLifeSkillsCount () { return this._lifeSkillsCount ?? 0 }

  addLifeSkill () {
    this._lifeSkillsCount = (this._lifeSkillsCount ?? 0) + 1
    try { localStorage.setItem('omni:player:lifeskills', String(this._lifeSkillsCount)) } catch (_) {}
    window.dispatchEvent(new CustomEvent('omni:player-lifeskill-added', { detail: { count: this._lifeSkillsCount } }))
  }
}
