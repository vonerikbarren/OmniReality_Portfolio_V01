/**
 * ui/OmniDJModules.js (V195) — registers the OmniDJ in one place (main.js adds it with a single call):
 *   - the quadrant content 'dj' (utils/OmniQuadrantRegistry.js): label 'OmniDJ', order 10, any quadrant, mounts ui/OmniDJ.js into the host div;
 *   - the class-A window ⟐OmniDJ (ui/OmniDJPanel.js), opened by the nav item, the ribbon Home > Tools button and OmniStarLight.
 * The audio (systems/OmniDJDecks.js) is created lazily on first use; nothing starts at app start. BaseScene.addModule() calls init() itself.
 */

import { registerQuadrantContent } from '../utils/OmniQuadrantRegistry.js'
import { mountDJ } from './OmniDJ.js'
import OmniDJPanel from './OmniDJPanel.js'

export function registerDJContent () {
  return registerQuadrantContent('dj', { label: 'OmniDJ', order: 10, accepts: ['tl', 'tr', 'bl', 'br'], mount: (host, ctx) => mountDJ(host, ctx) })
}

export function addDJModules (base) {
  registerDJContent()
  const panel = base.addModule(new OmniDJPanel())
  return { panel }
}
export default addDJModules
