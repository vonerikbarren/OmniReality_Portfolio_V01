/**
 * ui/OmniTargetSidePanel.js (V227) — a small switch that shows up while something is targeted: Left · Centre · Right.
 *
 * It only sends the existing omni:targeting-mode-set { mode: 'L'|'Z'|'R' } (systems/OmniSideTargeting.js does the work) and follows
 * omni:targeting-mode-changed, so the same setting in ⟐OmniTargetingSettings stays in step. It appears when a target is set
 * (omni:orbit-target-set) and goes when the target is let go (omni:node-deselected / omni:orbit-released / omni:return-to-landing).
 * #omni-ui ignores the pointer, so the panel sets pointer-events itself. Keys: none (the buttons are the control).
 */
import * as S from '../utils/OmniSideTargeting.js'

const CSS = `
#omni-target-side { position: fixed; left: 50%; top: calc(var(--omni-ribbon-h, 40px) + 8px); transform: translateX(-50%); z-index: 60; display: none; align-items: center; gap: 2px;
  padding: 3px; border-radius: 999px; background: rgba(10,10,14,.82); border: 1px solid rgba(255,255,255,.22); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font: 11px "Courier New", monospace; color: rgba(255,255,255,.85); pointer-events: auto; user-select: none; touch-action: manipulation; }
#omni-target-side.is-on { display: flex; }
#omni-target-side .ots-t { padding: 0 8px 0 10px; opacity: .65; letter-spacing: .06em; }
#omni-target-side button { min-width: 34px; min-height: 28px; padding: 0 10px; border-radius: 999px; border: 1px solid transparent; background: none; color: inherit; cursor: pointer; font: inherit; }
#omni-target-side button:hover { background: rgba(255,255,255,.12); }
#omni-target-side button.is-sel { background: rgba(255,255,255,.92); color: #000; }
@media (max-width: 700px) { #omni-target-side button { min-width: 44px; min-height: 40px; } #omni-target-side .ots-t { display: none; } }
`
const BTNS = [['L', '◀ Left', 'L-Targeting: the target moves to the left, the right side stays free'], ['Z', '● Centre', 'Z-Targeting: the target stays in the middle'], ['R', 'Right ▶', 'R-Targeting: the target moves to the right, the left side stays free']]

export default class OmniTargetSidePanel {
  constructor (context) { this.ctx = context; this._el = null; this._h = {}; this._mode = 'Z'; this.active = false }
  init () {
    if (typeof document === 'undefined') return
    if (!document.getElementById('omni-target-side-css')) { const s = document.createElement('style'); s.id = 'omni-target-side-css'; s.textContent = CSS; document.head.appendChild(s) }
    const el = this._el = document.createElement('div'); el.id = 'omni-target-side'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Target side')
    el.innerHTML = '<span class="ots-t">TARGET</span>' + BTNS.map(([m, label, tip]) => `<button type="button" data-mode="${m}" title="${tip}" aria-pressed="false">${label}</button>`).join('')
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-mode]'); if (b) window.dispatchEvent(new CustomEvent('omni:targeting-mode-set', { detail: { mode: b.dataset.mode } })) })
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(el)
    this._mode = S.load().mode
    const w = (t, fn) => { this._h[t] = fn; window.addEventListener(t, fn) }
    w('omni:orbit-target-set', (e) => { const d = e.detail ?? {}; if ([d.x, d.y, d.z].every(Number.isFinite)) this._show(true) })
    const off = () => this._show(false)
    w('omni:node-deselected', off); w('omni:orbit-released', off); w('omni:return-to-landing', off)
    w('omni:targeting-mode-changed', (e) => { this._mode = S.sanitize(e.detail).mode; this._paint() })
    this._paint()
  }
  update () {} onResize () {}
  destroy () { for (const [t, f] of Object.entries(this._h)) window.removeEventListener(t, f); this._h = {}; this._el?.remove(); this._el = null }
  _show (v) { this.active = !!v; this._el?.classList.toggle('is-on', this.active) }
  _paint () { this._el?.querySelectorAll('button[data-mode]').forEach(b => { const on = b.dataset.mode === this._mode; b.classList.toggle('is-sel', on); b.setAttribute('aria-pressed', on ? 'true' : 'false') }) }
}
