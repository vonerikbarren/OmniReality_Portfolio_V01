/**
 * ui/OmniSongModules.js — registers the V198 song modules in one place (main.js adds them with a single call)
 *
 *   OmniSongNodes   the SongNode kind runtime, the shared editing API / store (undo, live apply, persistence), the record disc reacting to the player   (systems/OmniSongNodes.js)
 *   OmniSongPanel   ⟐OmniSong, the song timeline editor (class-A window)                                                                              (ui/OmniSongPanel.js)
 * and the quadrant content 'song' (utils/OmniQuadrantRegistry.js). The player (systems/OmniSongPlayer.js scene module) and the audio assets are added by their own blocks.
 * BaseScene.addModule() calls init() itself; nothing here calls it again. Order matters: the runtime registers Extra.SERVICES.song before the panel reads it.
 */

import OmniSongNodes from '../systems/OmniSongNodes.js'
import OmniSongPanel, { registerSongContent } from './OmniSongPanel.js'

export function addSongModules (base, omniNode) {
  const songNodes = base.addModule(new OmniSongNodes(base.context, omniNode))
  const panel = base.addModule(new OmniSongPanel())
  const unregister = registerSongContent()
  return { songNodes, panel, unregister }
}
