/**
 * modules/SectionCarousel.js — the real, reusable template behind
 * every remaining nav page
 *
 * One shared class, instantiated once per nav page — not a single
 * mutating object, not a bespoke build per page. Confirmed directly:
 * a real build tool, meant to be duplicated across every other nav
 * page once proven here on About Me first.
 *
 * Holds its own dedicated OmniJsonifier instance — the real,
 * existing "objective node" build tool (OmniDraw's own Jsonifier
 * mode) — namespaced by section id *and* the currently active
 * OmniIdentity, so "About Me" genuinely shows different content per
 * identity, not one shared save. Root-level children default to
 * OmniSystem's own real Ring formation (`omnisystem-ring` in
 * TreeLayout.js) — the actual formula already proven there, reused
 * directly rather than reinvented — but the Structure panel's full
 * set of shapes remains available and switchable per section, same
 * as everywhere else Jsonifier already works.
 */

import { getActiveIdentity } from '../utils/OmniIdentity.js'
import OmniJsonifier from '../ui/OmniJsonifier.js'

export default class SectionCarousel {
  /**
   * @param {object} context — shared scene/camera/renderer context
   * @param {object} omniNode — the real OmniNode registry instance
   * @param {object} config
   * @param {string} config.sectionId — a real, stable id for this nav page (e.g. 'about-me')
   * @param {string} config.navLabel — the exact nav-select label this section opens on (e.g. 'About-Me')
   */
  constructor (context, omniNode, config) {
    this.ctx = context
    this.omniNode = omniNode
    this.sectionId = config.sectionId
    this.navLabel = config.navLabel

    this.jsonifier = null
    this._onIdentityChanged = null
  }

  init () {
    const namespace = this._realNamespace()
    this.jsonifier = new OmniJsonifier(this.ctx, this.omniNode, namespace, this.navLabel, 'omnisystem-ring')
    this.jsonifier.init()

    // Real, live reactivity — when the active OmniIdentity changes,
    // this section's own content switches with it, since each
    // identity's own save genuinely lives under its own real,
    // separate key (confirmed directly in OmniJsonifier's own real
    // namespace tests).
    this._onIdentityChanged = () => {
      this.jsonifier.setStorageNamespace(this._realNamespace())
    }
    window.addEventListener('omni:identity-changed', this._onIdentityChanged)
  }

  update (delta) {
    this.jsonifier?.update?.(delta)
  }

  onResize () {
    this.jsonifier?.onResize?.()
  }

  destroy () {
    window.removeEventListener('omni:identity-changed', this._onIdentityChanged)
    this.jsonifier?.destroy?.()
  }

  /** The real, current namespace — section id plus whichever
   *  OmniIdentity is genuinely active right now, or a real,
   *  stable 'default' when none is, so content created before any
   *  identity exists isn't silently lost once one does. */
  _realNamespace () {
    const identity = getActiveIdentity()
    return `${this.sectionId}:${identity?.id ?? 'default'}`
  }
}
