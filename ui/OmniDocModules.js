/**
 * ui/OmniDocModules.js — registers the V203 doc modules in one place (main.js adds them with a single call)
 *   OmniDocNodes   the DocNode kind runtime, level of detail + GPU budget, the shared editing API / store (undo, persistence)   (systems/OmniDocNodes.js)
 *   OmniDocPanel   ⟐OmniDoc, the document controls window (class-A window)                                                       (ui/OmniDocPanel.js)
 * and the quadrant content 'doc'. BaseScene.addModule() calls init() itself. Order matters: the runtime registers Extra.SERVICES.doc before the panel reads it.
 */

import OmniDocNodes from '../systems/OmniDocNodes.js'
import OmniDocPanel, { registerDocContent } from './OmniDocPanel.js'

export function addDocModules (base, omniNode) {
  const docNodes = base.addModule(new OmniDocNodes(base.context, omniNode))
  const panel = base.addModule(new OmniDocPanel())
  const unregister = registerDocContent()
  return { docNodes, panel, unregister }
}
