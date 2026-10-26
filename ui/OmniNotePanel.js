/**
 * ui/OmniNotePanel.js — ⟐OmniNote: the window around ui/OmniNoteEditor.js (V213, class-A window panel, a bottom sheet on phones).
 * Opened by omni:nav-select '⟐OmniNote' (ribbon Create > Note node, the Inspector's "Open ⟐OmniNote", OmniStarLight).
 */
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import OmniNoteEditor, { NAV_ITEM, injectNoteStyles } from './OmniNoteEditor.js'

export { NAV_ITEM }
export const PANEL_ID = 'omninote'
const STYLES = `
.oss-panel.onotep-panel, .oss-panel.onotep-panel.is-wide { width: 700px; max-width: calc(100vw - 16px); }
.oss-panel.onotep-panel .oss-body { padding: 6px 8px 8px; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.onotep-panel, .oss-panel.onotep-panel.is-wide { max-height: 80vh; width: 100%; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('onotep-panel-styles')) return
  const s = document.createElement('style'); s.id = 'onotep-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
export default class OmniNotePanel extends OmniSettingsPanelBase {
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: '⟐OmniNote', iconLabel: '⟐✎', navItems: [NAV_ITEM], className: 'onotep-panel', wide: true })
    this.viewOpts = opts; this.view = null
  }
  onInit () { injectStyles(); injectNoteStyles() }
  buildBody (body) { const host = document.createElement('div'); body.appendChild(host); this.view = new OmniNoteEditor(host, { ...this.viewOpts }); this.view.mount() }
  refresh () { this.view?._fillList?.(); this.view?._status?.() }
  onOpened () { this.view?.onOpened() }
  onResize () { this.view?.onResize() }
  onDestroy () { this.view?.destroy(); this.view = null }
}
