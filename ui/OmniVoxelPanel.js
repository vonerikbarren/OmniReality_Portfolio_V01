/**
 * ui/OmniVoxelPanel.js — ⟐OmniVoxel: the window around ui/OmniVoxelView.js (V210, class-A window panel, a bottom sheet on phones).
 * Opened by omni:nav-select '⟐OmniVoxel' (ribbon Create > Voxel rooms, OmniStarLight).
 */
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import OmniVoxelView, { NAV_ITEM, injectVoxelStyles } from './OmniVoxelView.js'

export { NAV_ITEM }
export const PANEL_ID = 'omnivoxel'
const STYLES = `
.oss-panel.ovxp-panel, .oss-panel.ovxp-panel.is-wide { width: 560px; max-width: calc(100vw - 16px); }
.oss-panel.ovxp-panel .oss-body { padding: 6px 8px 8px; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.ovxp-panel, .oss-panel.ovxp-panel.is-wide { max-height: 80vh; width: 100%; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('ovxp-panel-styles')) return
  const s = document.createElement('style'); s.id = 'ovxp-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
export default class OmniVoxelPanel extends OmniSettingsPanelBase {
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: '⟐OmniVoxel', iconLabel: '⟐▦', navItems: [NAV_ITEM, '⟐OmniVoxelPanel'], className: 'ovxp-panel', wide: true })
    this.viewOpts = opts; this.view = null
  }
  onInit () { injectStyles(); injectVoxelStyles() }
  buildBody (body) {
    const host = document.createElement('div'); body.appendChild(host)
    this.view = new OmniVoxelView(host, { ...this.viewOpts }); this.view.mount()
  }
  refresh () { this.view?.refresh() }
  onOpened () { this.view?.onOpened() }
  onResize () { this.view?.onResize() }
  onDestroy () { this.view?.destroy(); this.view = null }
}
