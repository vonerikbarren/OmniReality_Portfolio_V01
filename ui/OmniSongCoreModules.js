/**
 * ui/OmniSongCoreModules.js — registers the V198 song CORE modules in one place (main.js adds them with a single call)
 *
 *   OmniSongPlayerScene   the SongPlayer singleton wired to the node registry: transport requests (omni:song-transport-request), stop on omni:node-deleted /
 *                         omni:scene-clear-request, the per-frame re-arm of the lookahead timer                                           (systems/OmniSongPlayer.js)
 * The pure model is utils/OmniSongModel.js. The song node kind / panel (agent 2), the audio library (agent 3) and the piano roll (agent 4) are added by their own blocks.
 * BaseScene.addModule() calls init() itself; nothing here calls it again.
 */

import { OmniSongPlayerScene } from '../systems/OmniSongPlayer.js'

export function addSongCoreModules (base, omniNode) {
  const player = base.addModule(new OmniSongPlayerScene(base.context, omniNode))
  return { player }
}
