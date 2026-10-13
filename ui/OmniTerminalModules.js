/**
 * ui/OmniTerminalModules.js — registers the V192 terminal modules in one place (main.js adds them with a single call)
 *
 *   TerminalShellNodes   the runtime of the TerminalShellTunnel node kind: one in-scene terminal tunnel per node, all following the
 *                        one master on / off of the Terminal button      (systems/TerminalShellNodes.js)
 *
 * The built-in tunnel (modules/TerminalTunnel.js), ⟐TerminalSettings and ⟐OmniCommandTerminal are registered where they always were.
 * BaseScene.addModule() calls init() itself; nothing here calls it again.
 */

import TerminalShellNodes from '../systems/TerminalShellNodes.js'

export function addTerminalModules (base, omniNode) {
  const shellNodes = base.addModule(new TerminalShellNodes(base.context, omniNode))
  return { shellNodes }
}
