/**
 * ui/OmniSoundUnlockPrompt.js — the "Enable sound" prompt (V194, class B: a small toast, not a window; no handles, no WindowManager).
 *
 * Browsers only let a page make sound after a tap or key press. When the sound engine wants to play while the audio is still locked it emits
 * `omni:sound-unlock-needed`; this shows a small toast with an "Enable sound" button. The button calls SoundEngine.unlock(), tells systems/OmniSoundNodes.js
 * (`omni:sound-enable-request`: opt in for this tab and unmute) and dismisses the toast. It also appears when "Ask before sound" is on (Admin > UI Settings >
 * Sound) and a sound starts before the person has opted in. "Show Enable sound" off in the settings hides it. Closing it with × keeps it away for the rest of
 * the page's life. Module contract: constructor / init (single) / update / destroy / onResize.
 */

import SoundEngine from '../systems/OmniSoundEngine.js'
import * as Settings from '../utils/OmniSoundSettings.js'

const STYLES = `
#omni-sound-unlock { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--omni-dock-h, 52px) + 14px); z-index: 70; display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 16px); box-sizing: border-box; padding: 8px 10px 8px 14px;
  background: var(--omni-theme-bg, rgba(8,8,12,.95)); color: var(--omni-theme-text, rgba(255,255,255,.93)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.5);
  font: 11px 'Courier New', Courier, monospace; pointer-events: auto; }
#omni-sound-unlock[hidden] { display: none; }
#omni-sound-unlock button { min-height: 32px; padding: 2px 12px; font: inherit; color: inherit; border-radius: 8px; border: 1px solid rgba(255,255,255,.4); background: rgba(127,214,255,.25); cursor: pointer; }
#omni-sound-unlock button.osu-x { min-width: 32px; padding: 0; background: transparent; border-color: transparent; opacity: .7; }
@media (max-width: 700px) { #omni-sound-unlock { left: 8px; right: 8px; transform: none; } #omni-sound-unlock button { min-height: 44px; } }
`

export default class OmniSoundUnlockPrompt {
  constructor () {
    this._inited = 0
    this._el = null
    this._dismissed = false
    this._bound = []
    this._timer = 0
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    if (typeof document !== 'undefined' && !document.getElementById('osu-styles')) { const s = document.createElement('style'); s.id = 'osu-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const on = (name, fn) => { window.addEventListener(name, fn); this._bound.push([name, fn]) }
    on('omni:sound-unlock-needed', () => this.show())
    on('omni:sound-state', (e) => { if (e.detail?.state === 'started' && Settings.getSoundSettings().requireOptIn && !Settings.isOptedIn()) this.show() })
    on('omni:sound-enable-request', () => this.hide())
    on(Settings.CHANGED_EVENT, (e) => { if (e.detail?.settings && !e.detail.settings.showUnlockPrompt) this.hide() })
  }

  update () {}
  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h)); this._bound = []
    clearTimeout(this._timer)
    this._el?.parentNode?.removeChild(this._el); this._el = null
    this._inited = 0
  }

  get visible () { return !!this._el && !this._el.hasAttribute('hidden') }

  show () {
    if (this._dismissed || !Settings.getSoundSettings().showUnlockPrompt) return false
    if (!this._el) this._build()
    this._el.removeAttribute('hidden')
    return true
  }
  hide () { this._el?.setAttribute('hidden', '') }

  _build () {
    const el = document.createElement('div')
    el.id = 'omni-sound-unlock'
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite')
    el.innerHTML = `<span data-ref="msg">Sound is waiting: your browser needs a tap first.</span>
      <button type="button" data-act="enable" data-omni-tip="Enable sound" data-omni-tip-key="—" data-omni-tip-desc="Allows this page to make sound (the browser asks for one tap) and unmutes it.">Enable sound</button>
      <button type="button" class="osu-x" data-act="close" aria-label="Dismiss" data-omni-tip="Dismiss" data-omni-tip-key="—" data-omni-tip-desc="Hides this prompt until the page is reloaded. Sound stays blocked.">×</button>`
    el.addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-act]'); if (!b) return
      if (b.dataset.act === 'enable') this.enable(); else { this._dismissed = true; this.hide() }
    })
    document.getElementById('omni-ui')?.appendChild(el) ?? document.body.appendChild(el)
    this._el = el
  }

  /** The button: unlock the audio, tell the sound runtime (opt-in + unmute), dismiss. */
  enable () {
    try { SoundEngine.unlock() } catch (_) { /* the browser refused: the next tap tries again */ }
    window.dispatchEvent(new CustomEvent('omni:sound-enable-request', { detail: {} }))
    this.hide()
  }
}
