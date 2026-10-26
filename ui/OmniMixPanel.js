/**
 * ui/OmniMixPanel.js — ⟐OmniMix: the window around the mixing desk of an OmniMusicMixNode (V201, class-A window panel).
 * The desk itself is ui/OmniMixView.js; this file is the window (resize + maximize from utils/OmniWindowChrome.js, a bottom sheet on phones) and the registration of the same view
 * as quadrant content 'mix' (utils/OmniQuadrantRegistry.js). Opened by omni:nav-select '⟐OmniMix' (ribbon Create 'Mix node', the OmniDraw tile 'Mix', OmniStarLight, the Inspector).
 * It follows the selected mix node; with none it says so and offers a button that creates one.
 */

import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import OmniMixView, { NAV_ITEM, injectMixStyles } from './OmniMixView.js'
import { registerQuadrantContent, unregisterQuadrantContent } from '../utils/OmniQuadrantRegistry.js'

export { NAV_ITEM }
export const PANEL_ID = 'omnimix'
export const QUADRANT_ID = 'mix'

const STYLES = `
.oss-panel.omxp-panel, .oss-panel.omxp-panel.is-wide { width: 980px; max-width: calc(100vw - 16px); }
.oss-panel.omxp-panel .oss-body { padding: 6px 8px 8px; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.omxp-panel, .oss-panel.omxp-panel.is-wide { max-height: 80vh; width: 100%; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omxp-panel-styles')) return
  const s = document.createElement('style'); s.id = 'omxp-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniMixPanel extends OmniSettingsPanelBase {
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: '⟐OmniMix', iconLabel: '⟐♪♪', navItems: [NAV_ITEM, '⟐OmniMixPanel'], className: 'omxp-panel', wide: true })
    this.viewOpts = opts
    this.view = null
  }
  onInit () { injectStyles(); injectMixStyles() }
  buildBody (body) {
    const host = document.createElement('div')
    body.appendChild(host)
    this.view = new OmniMixView(host, { ...this.viewOpts, active: () => this._isOpen })
    this.view.mount()
  }
  refresh () { this.view?.refresh() }
  onOpened () { this.view?.onOpened(); this.view?.onResize() }
  onResize () { this.view?.onResize() }
  onDestroy () { this.view?.destroy(); this.view = null }
  setNode (id) { this.view?.setNode(id) }
  get nodeId () { return this.view?.nodeId ?? null }
}

/** Register the desk as quadrant content 'mix'. Returns an unregister function. */
export function registerMixContent (opts = {}) {
  registerQuadrantContent(QUADRANT_ID, {
    label: 'OmniMix', order: 46,
    mount (host) {
      const view = new OmniMixView(host, { ...opts, compact: true })
      view.mount()
      return { destroy () { view.destroy() }, onResize () { view.onResize() }, view }
    },
  })
  return () => unregisterQuadrantContent(QUADRANT_ID)
}
