/**
 * ui/OmniExpressionInputModules.js — registers the V195 Expression INPUT modules in one place (main.js adds them with a single call).
 *
 *   OmniExpressionTyping               Cmd/Ctrl+K mode: the computer keys -> the input bus (and the owner of omni:expression-typing-set)     (systems/OmniExpressionTyping.js)
 *   OmniLiveInstrument                 the input bus -> SoundEngine polyphonic notes (the selected node's sound is the instrument)         (systems/OmniLiveInstrument.js)
 *   OmniMidiIn                         Web MIDI in -> the input bus (permission asked only when MIDI is switched on in the settings)         (systems/OmniMidiIn.js)
 *   OmniExpressionTypingSettingsPanel  ⟐OmniExpressionTypingSettings (class-A window)                                                        (ui/OmniExpressionTypingSettingsPanel.js)
 *
 * It also puts the settings panel into the Admin drawer without touching main.js's config (⟐Admin: the next free slot from 23).
 * BaseScene.addModule() calls init() itself; nothing here calls it again.
 */
import OmniExpressionTyping from '../systems/OmniExpressionTyping.js'
import OmniLiveInstrument from '../systems/OmniLiveInstrument.js'
import OmniMidiIn from '../systems/OmniMidiIn.js'
import OmniExpressionTypingSettingsPanel, { NAV_ITEM } from './OmniExpressionTypingSettingsPanel.js'
import { registerExtraSlot } from './IndexedPanel.js'

export function addExpressionInputModules (base, omniNode) {
  registerExtraSlot('admin', { label: 'OmniExpressionTypingSettings', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM } })) }, 23)
  const typing = base.addModule(new OmniExpressionTyping(base.context))
  const live = base.addModule(new OmniLiveInstrument(base.context, omniNode))
  const midi = base.addModule(new OmniMidiIn(base.context))
  const panel = base.addModule(new OmniExpressionTypingSettingsPanel(omniNode))
  return { typing, live, midi, panel }
}
