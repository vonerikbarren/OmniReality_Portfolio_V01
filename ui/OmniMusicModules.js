/**
 * ui/OmniMusicModules.js — registers the V195 music-node modules in one place (main.js adds them with a single call)
 *
 *   OmniMusicNodes     the MusicNode kind runtime, the shared editing API / store, the plate reacting to the sequencer   (systems/OmniMusicNodes.js)
 *   OmniSequencer      transport, lookahead scheduler, metronome / count-in, recording from the InputBus                  (systems/OmniSequencer.js)
 *   OmniSequencerPanel ⟐OmniSequencer, the step editor (class-A window)                                                   (ui/OmniSequencerPanel.js)
 * and the quadrant content 'sequencer' (utils/OmniQuadrantRegistry.js). The audio engine (systems/OmniSoundEngine.js) is added by the sound blocks of main.js.
 * BaseScene.addModule() calls init() itself; nothing here calls it again. Order matters: the runtime registers Extra.SERVICES.music before the sequencer reads it.
 */

import OmniMusicNodes from '../systems/OmniMusicNodes.js'
import OmniSequencer from '../systems/OmniSequencer.js'
import OmniSequencerPanel, { registerSequencerContent } from './OmniSequencerPanel.js'

export function addMusicModules (base, omniNode) {
  const musicNodes = base.addModule(new OmniMusicNodes(base.context, omniNode))
  const sequencer = base.addModule(new OmniSequencer(base.context, omniNode))
  const panel = base.addModule(new OmniSequencerPanel())
  const unregister = registerSequencerContent()
  return { musicNodes, sequencer, panel, unregister }
}
