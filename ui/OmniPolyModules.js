/**
 * ui/OmniPolyModules.js — registers the V204 poly modules in one place (main.js adds them with a single call)
 *   OmniPolyNodes    the PolyNode kind runtime: level of detail + GPU budget, face clicks, the shared editing API / store (undo, persistence)   (systems/OmniPolyNodes.js)
 *   OmniPolyTooltip  the menu that opens where a face is tapped                                                                                 (ui/OmniPolyTooltip.js)
 *   OmniPolyPanel    ⟐OmniPoly, the shape + face controls window (class-A window)                                                                (ui/OmniPolyPanel.js)
 * and the quadrant content 'poly'. BaseScene.addModule() calls init() itself. Order matters: the runtime registers Extra.SERVICES.poly before the panel reads it.
 */
import OmniPolyNodes from '../systems/OmniPolyNodes.js'
import OmniPolyTooltip from './OmniPolyTooltip.js'
import OmniPolyPanel, { registerPolyContent } from './OmniPolyPanel.js'

export function addPolyModules (base, omniNode) {
  const polyNodes = base.addModule(new OmniPolyNodes(base.context, omniNode))
  const tooltip = base.addModule(new OmniPolyTooltip())
  const panel = base.addModule(new OmniPolyPanel())
  const unregister = registerPolyContent()
  return { polyNodes, tooltip, panel, unregister }
}
