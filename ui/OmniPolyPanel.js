/**
 * ui/OmniPolyPanel.js — ⟐OmniPoly: the window around the controls of a PolyNode (V204, class-A window panel).
 * The controls are ui/OmniPolyView.js; this file is the window (resize + maximize, a bottom sheet on phones) and the registration of the same view as quadrant content 'poly'.
 * Opened by omni:nav-select '⟐OmniPoly' (ribbon Create 'Poly node', the OmniDraw tile 'Poly', OmniStarLight, the Inspector, the tooltip's 'Open face settings').
 */
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import OmniPolyView, { NAV_ITEM, injectPolyStyles } from './OmniPolyView.js'
import { registerQuadrantContent, unregisterQuadrantContent } from '../utils/OmniQuadrantRegistry.js'

export { NAV_ITEM }
export const PANEL_ID = 'omnipoly'
export const QUADRANT_ID = 'poly'
const STYLES = `
.oss-panel.opyp-panel, .oss-panel.opyp-panel.is-wide { width: 640px; max-width: calc(100vw - 16px); }
.oss-panel.opyp-panel .oss-body { padding: 6px 8px 8px; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.opyp-panel, .oss-panel.opyp-panel.is-wide { max-height: 80vh; width: 100%; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('opyp-panel-styles')) return
  const s = document.createElement('style'); s.id = 'opyp-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
export default class OmniPolyPanel extends OmniSettingsPanelBase {
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: '⟐OmniPoly', iconLabel: '⟐⬡', navItems: [NAV_ITEM, '⟐OmniPolyPanel'], className: 'opyp-panel', wide: true })
    this.viewOpts = opts; this.view = null
  }
  onInit () { injectStyles(); injectPolyStyles() }
  buildBody (body) {
    const host = document.createElement('div'); body.appendChild(host)
    this.view = new OmniPolyView(host, { ...this.viewOpts, active: () => this._isOpen }); this.view.mount()
  }
  refresh () { this.view?.refresh() }
  onOpened () { this.view?.onOpened(); this.view?.onResize() }
  onResize () { this.view?.onResize() }
  onDestroy () { this.view?.destroy(); this.view = null }
  setNode (id) { this.view?.setNode(id) }
  get nodeId () { return this.view?.nodeId ?? null }
}
export function registerPolyContent (opts = {}) {
  registerQuadrantContent(QUADRANT_ID, {
    label: 'OmniPoly', order: 48,
    mount (host) { const view = new OmniPolyView(host, { ...opts, compact: true }); view.mount(); return { destroy () { view.destroy() }, onResize () { view.onResize() }, view } },
  })
  return () => unregisterQuadrantContent(QUADRANT_ID)
}
