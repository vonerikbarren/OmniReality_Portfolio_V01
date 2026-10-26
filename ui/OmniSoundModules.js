/**
 * ui/OmniSoundModules.js — registers the V194 sound-node UI modules in one place (main.js adds them with a single call)
 *
 *   OmniSoundNodes         the SoundNode kind runtime, the shared editing API, the global sound settings -> engine   (systems/OmniSoundNodes.js)
 *   OmniSoundPanel         ⟐SoundNodeSettings, the editor of a node's sound + particles (class-A window)            (ui/OmniSoundPanel.js)
 *   OmniSoundUnlockPrompt  the small "Enable sound" toast (class B)                                                 (ui/OmniSoundUnlockPrompt.js)
 *
 * It also puts the panel into the Admin drawer without touching main.js's config (⟐Admin: the next free slot from 22).
 * The audio engine / scene (systems/OmniSoundEngine.js, OmniSoundScene.js) and the particles + viewers are added by their own registrations.
 * BaseScene.addModule() calls init() itself; nothing here calls it again.
 */

import OmniSoundNodes from '../systems/OmniSoundNodes.js'
import OmniSoundPanel, { NAV_ITEM } from './OmniSoundPanel.js'
import OmniSoundUnlockPrompt from './OmniSoundUnlockPrompt.js'
import { registerExtraSlot } from './IndexedPanel.js'

export function addSoundModules (base, omniNode) {
  registerExtraSlot('admin', { label: 'SoundNodeSettings', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM } })) }, 22)
  const soundNodes = base.addModule(new OmniSoundNodes(base.context, omniNode))
  const panel = base.addModule(new OmniSoundPanel(soundNodes))
  const prompt = base.addModule(new OmniSoundUnlockPrompt())
  return { soundNodes, panel, prompt }
}
