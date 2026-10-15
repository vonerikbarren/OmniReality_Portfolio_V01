/**
 * ui/OmniMixModules.js — registers the V201 mix modules in one place (main.js adds them with a single call)
 *   OmniMixNodes   the MixNode kind runtime, the shared editing API / store (undo, live apply, persistence), the desk reacting to the mixer   (systems/OmniMixNodes.js)
 *   OmniMixPanel   ⟐OmniMix, the mixing desk window (class-A window)                                                                         (ui/OmniMixPanel.js)
 * and the quadrant content 'mix'. BaseScene.addModule() calls init() itself. Order matters: the runtime registers Extra.SERVICES.mix before the panel reads it.
 */

import OmniMixNodes from '../systems/OmniMixNodes.js'
import OmniMixPanel, { registerMixContent } from './OmniMixPanel.js'

export function addMixModules (base, omniNode) {
  const mixNodes = base.addModule(new OmniMixNodes(base.context, omniNode))
  const panel = base.addModule(new OmniMixPanel())
  const unregister = registerMixContent()
  return { mixNodes, panel, unregister }
}
