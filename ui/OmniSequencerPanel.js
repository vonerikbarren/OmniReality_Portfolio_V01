/**
 * ui/OmniSequencerPanel.js — ⟐OmniSequencer: the step-sequencer window of a MusicNode (V195, class-A window panel).
 *
 * The editor itself (track lanes, piano roll, transport, settings, undo) is ui/OmniSequencerView.js; this file is the window around it and the registration of the same
 * editor as quadrant content 'sequencer' (utils/OmniQuadrantRegistry.js: the maximized OmniExpression panel can show it in any quadrant, compact).
 * Built on ui/OmniSettingsPanelBase.js (WindowManager registration => resize + maximize from utils/OmniWindowChrome.js, a bottom sheet on phones).
 * Opened by omni:nav-select '⟐OmniSequencer' (ribbon Home > Sound > Sequencer, OmniStarLight, the Inspector's 'Open sequencer').
 * It follows the selected music node; with none it says so and offers a button that creates one.
 */

import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import OmniSequencerView, { NAV_ITEM, injectSequencerStyles } from './OmniSequencerView.js'
import { registerQuadrantContent, unregisterQuadrantContent } from '../utils/OmniQuadrantRegistry.js'

export { NAV_ITEM }
export const PANEL_ID = 'omnisequencer'
export const QUADRANT_ID = 'sequencer'

const STYLES = `
.oss-panel.osq-panel, .oss-panel.osq-panel.is-wide { width: 700px; max-width: calc(100vw - 16px); }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.osq-panel, .oss-panel.osq-panel.is-wide { max-height: 72vh; width: 100%; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('osq-panel-styles')) return
  const s = document.createElement('style'); s.id = 'osq-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniSequencerPanel extends OmniSettingsPanelBase {
  /** @param opts { svc?, seq? } (default: Extra.SERVICES.music / .sequencer, looked up when used) */
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: '⟐OmniSequencer', iconLabel: '⟐♫', navItems: [NAV_ITEM, '⟐OmniSequencerPanel'], className: 'osq-panel', wide: true })
    this.viewOpts = opts
    this.view = null
  }

  onInit () { injectStyles(); injectSequencerStyles() }

  buildBody (body) {
    const host = document.createElement('div')
    body.appendChild(host)
    this.view = new OmniSequencerView(host, { ...this.viewOpts, active: () => this._isOpen })
    this.view.mount()
  }

  refresh () { this.view?.refresh() }
  onOpened () { this.view?.refresh(); this.view?.onResize() }
  onResize () { this.view?.onResize() }

  onDestroy () { this.view?.destroy(); this.view = null }

  /** The window follows a node (public: the Inspector's button and the tests). */
  setNode (id) { this.view?.setNode(id) }
  get nodeId () { return this.view?.nodeId ?? null }
}

/** Register the editor as quadrant content 'sequencer' (compact view in a quadrant of the OmniExpression panel). Returns an unregister function. */
export function registerSequencerContent (opts = {}) {
  registerQuadrantContent(QUADRANT_ID, {
    label: 'OmniSequencer', order: 40,
    mount (host, ctx) {
      const view = new OmniSequencerView(host, { ...opts, compact: true, quadrant: ctx?.quadrant ?? null })
      view.mount()
      return { destroy () { view.destroy() }, onResize () { view.onResize() }, view }
    },
  })
  return () => unregisterQuadrantContent(QUADRANT_ID)
}
