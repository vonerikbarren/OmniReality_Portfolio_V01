/**
 * ui/OmniDJPanel.js (V195) — ⟐OmniDJ: the OmniDJ as its own class-A window (resize + maximize from utils/OmniWindowChrome.js through WindowManager.register).
 * The same OmniDJ that the OmniExpression quadrant shows (ui/OmniDJ.js, content id 'dj'); both use the same decks (systems/OmniDJDecks.js),
 * so a track keeps playing when you close the window or switch the quadrant. The controls are built when the window opens and removed when
 * it closes (no animation frames run for a closed window); the music is not stopped by closing: use "Stop all" in the window.
 * Opened by the nav item '⟐OmniDJ' (ribbon Home > Tools, OmniStarLight). Layout: localStorage 'omni:dj-layout-v1' (shared with the quadrant).
 */

import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { createOmniDJ } from './OmniDJ.js'

export const PANEL_ID = 'omnidj'
export const NAV_ITEM = '⟐OmniDJ'

const STYLES = `
.oss-panel.dj-panel { width: 920px; height: 600px; max-width: calc(100vw - 16px); resize: none; }
.dj-panel .oss-body { display: flex; padding: 0; overflow: hidden; }
.dj-panel .dj-host { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; }
@media (max-width: ${PHONE_MAX}px) {
  .oss-panel.dj-panel.dj-panel { max-height: calc(100vh - var(--omni-dock-h, 52px) - 48px); height: calc(100vh - var(--omni-dock-h, 52px) - 48px); top: 48px !important; bottom: var(--omni-dock-h, 52px); }
}
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('dj-panel-styles')) return
  const s = document.createElement('style'); s.id = 'dj-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniDJPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐DJ', navItems: [NAV_ITEM], className: 'dj-panel' })
    this._dj = null; this._host = null; this._closeT = null
  }
  onInit () { injectStyles() }
  buildBody (body) {
    this._host = document.createElement('div'); this._host.className = 'dj-host'
    body.appendChild(this._host)
  }
  onOpened () {
    if (this._closeT) { clearTimeout(this._closeT); this._closeT = null }
    if (!this._dj && this._host) this._dj = createOmniDJ(this._host)
  }
  /** The OmniDJ instance while the window is open (tests, other modules). */
  get dj () { return this._dj }
  close () {
    super.close()
    if (this._closeT) clearTimeout(this._closeT)
    this._closeT = setTimeout(() => { this._closeT = null; if (!this._isOpen) this._teardown() }, 220)
  }
  _teardown () { if (this._dj) { try { this._dj.destroy() } catch (_) { /* ignore */ } this._dj = null } }
  onDestroy () { if (this._closeT) clearTimeout(this._closeT); this._teardown() }
}
