/**
 * ui/OmniSongPanel.js — ⟐OmniSong: the song timeline window of a SongNode (V198, class-A window panel).
 *
 * The editor itself (timeline, lanes as the mixer, clips, sections, tempo track, automation, library, master) is ui/OmniSongView.js; this file is the window around it and the
 * registration of the same editor as quadrant content 'song' (utils/OmniQuadrantRegistry.js: the maximized OmniExpression panel can show it in any quadrant, compact).
 * Built on ui/OmniSettingsPanelBase.js (WindowManager registration => resize + maximize from utils/OmniWindowChrome.js, a bottom sheet on phones).
 * Opened by omni:nav-select '⟐OmniSong' (ribbon Home > Create 'Song node' and Home > Tools 'Song editor', OmniStarLight, the OmniDraw tile 'Song', the Inspector's 'Open song editor').
 * It follows the selected song node; with none it says so and offers a button that creates one.
 */

import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import OmniSongView, { NAV_ITEM, injectSongStyles } from './OmniSongView.js'
import { registerQuadrantContent, unregisterQuadrantContent } from '../utils/OmniQuadrantRegistry.js'

export { NAV_ITEM }
export const PANEL_ID = 'omnisong'
export const QUADRANT_ID = 'song'

const STYLES = `
.oss-panel.osg-panel, .oss-panel.osg-panel.is-wide { width: 1000px; max-width: calc(100vw - 16px); }
.oss-panel.osg-panel .oss-body { padding: 6px 8px 8px; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.osg-panel, .oss-panel.osg-panel.is-wide { max-height: 80vh; width: 100%; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('osg-panel-styles')) return
  const s = document.createElement('style'); s.id = 'osg-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniSongPanel extends OmniSettingsPanelBase {
  /** @param opts { svc?, music?, assets?, player? } (default: Extra.SERVICES.song / .music, looked up when used) */
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: '⟐OmniSong', iconLabel: '⟐♬', navItems: [NAV_ITEM, '⟐OmniSongPanel'], className: 'osg-panel', wide: true })
    this.viewOpts = opts
    this.view = null
  }

  onInit () { injectStyles(); injectSongStyles() }

  buildBody (body) {
    const host = document.createElement('div')
    body.appendChild(host)
    this.view = new OmniSongView(host, { ...this.viewOpts, active: () => this._isOpen })
    this.view.mount()
  }

  refresh () { this.view?.refresh() }
  onOpened () { this.view?.onOpened(); this.view?.onResize() }
  onResize () { this.view?.onResize() }
  close () { super.close(); this.view?._syncTimer() }

  onDestroy () { this.view?.destroy(); this.view = null }

  /** The window follows a node (public: the Inspector's button and the tests). */
  setNode (id) { this.view?.setNode(id) }
  get nodeId () { return this.view?.nodeId ?? null }
}

/** Register the editor as quadrant content 'song' (compact view in a quadrant of the OmniExpression panel). Returns an unregister function. */
export function registerSongContent (opts = {}) {
  registerQuadrantContent(QUADRANT_ID, {
    label: 'OmniSong', order: 45,
    mount (host, ctx) {
      const view = new OmniSongView(host, { ...opts, compact: true, quadrant: ctx?.quadrant ?? null })
      view.mount()
      return { destroy () { view.destroy() }, onResize () { view.onResize() }, view }
    },
  })
  return () => unregisterQuadrantContent(QUADRANT_ID)
}
