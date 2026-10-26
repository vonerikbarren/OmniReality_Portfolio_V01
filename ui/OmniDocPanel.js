/**
 * ui/OmniDocPanel.js — ⟐OmniDoc: the window around the controls of a DocNode (V203, class-A window panel).
 * The controls are ui/OmniDocView.js; this file is the window (resize + maximize from utils/OmniWindowChrome.js, a bottom sheet on phones) and the registration of the same view as quadrant
 * content 'doc' (utils/OmniQuadrantRegistry.js). Opened by omni:nav-select '⟐OmniDoc' (ribbon Create 'Doc node', the OmniDraw tile 'Doc', OmniStarLight, the Inspector).
 * It follows the selected doc node; with none it says so and offers a button that creates one.
 */

import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import OmniDocView, { NAV_ITEM, injectDocStyles } from './OmniDocView.js'
import { registerQuadrantContent, unregisterQuadrantContent } from '../utils/OmniQuadrantRegistry.js'

export { NAV_ITEM }
export const PANEL_ID = 'omnidoc'
export const QUADRANT_ID = 'doc'

const STYLES = `
.oss-panel.odcp-panel, .oss-panel.odcp-panel.is-wide { width: 720px; max-width: calc(100vw - 16px); }
.oss-panel.odcp-panel .oss-body { padding: 6px 8px 8px; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.odcp-panel, .oss-panel.odcp-panel.is-wide { max-height: 80vh; width: 100%; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('odcp-panel-styles')) return
  const s = document.createElement('style'); s.id = 'odcp-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniDocPanel extends OmniSettingsPanelBase {
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: '⟐OmniDoc', iconLabel: '⟐▤', navItems: [NAV_ITEM, '⟐OmniDocPanel'], className: 'odcp-panel', wide: true })
    this.viewOpts = opts
    this.view = null
  }
  onInit () { injectStyles(); injectDocStyles() }
  buildBody (body) {
    const host = document.createElement('div')
    body.appendChild(host)
    this.view = new OmniDocView(host, { ...this.viewOpts, active: () => this._isOpen })
    this.view.mount()
  }
  refresh () { this.view?.refresh() }
  onOpened () { this.view?.onOpened(); this.view?.onResize() }
  onResize () { this.view?.onResize() }
  onDestroy () { this.view?.destroy(); this.view = null }
  setNode (id) { this.view?.setNode(id) }
  get nodeId () { return this.view?.nodeId ?? null }
}

/** Register the controls as quadrant content 'doc'. Returns an unregister function. */
export function registerDocContent (opts = {}) {
  registerQuadrantContent(QUADRANT_ID, {
    label: 'OmniDoc', order: 47,
    mount (host) {
      const view = new OmniDocView(host, { ...opts, compact: true })
      view.mount()
      return { destroy () { view.destroy() }, onResize () { view.onResize() }, view }
    },
  })
  return () => unregisterQuadrantContent(QUADRANT_ID)
}
