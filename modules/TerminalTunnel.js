/**
 * TerminalTunnel.js — ⟐T Terminal Tunnel (the BUILT-IN TerminalShellTunnel)
 *
 * A black cylinder nested inside the Root concentric cylinders, with a CanvasTexture panel floating at the centre at camera eye level:
 * the terminal's in-scene surface. V192: the tunnel itself moved to modules/TerminalShellTunnel.js, because there can now be several
 * (a TerminalShellTunnel NODE each, see systems/TerminalShellNodes.js). This file is the built-in one at the centre of the Root, the one the
 * F1 key and the Terminal buttons always had; it is a shell like the others and follows the same master on/off
 * (utils/TerminalShells.js), so a Terminal button turns it and every node shell on and off together.
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import TerminalShellTunnel from './TerminalShellTunnel.js'

export default class TerminalTunnel extends TerminalShellTunnel {
  constructor (context) {
    super(context, { builtin: true })
  }
}

export { TerminalShellTunnel }
