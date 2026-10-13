/**
 * ui/OmniAudioModules.js (V198) — registers the audio library in one place (main.js adds it with a single call):
 *   the class-A window ⟐OmniAudioLibrary (ui/OmniAudioLibraryPanel.js; nav item '⟐OmniAudioLibrary', ribbon Home > Tools "Audio library", OmniStarLight "Audio library").
 * The store itself (utils/OmniAudioAssets.js) is a plain module singleton: it opens IndexedDB on first use and creates no AudioContext. Nothing runs at app start.
 * omniNode (optional) lets the library say how many songs use a file (omniNode.getAllNodes() is scanned for data.song.clips on delete / in the row text).
 * BaseScene.addModule() calls init() itself.
 */

import OmniAudioLibraryPanel, { setUsageProvider } from './OmniAudioLibraryPanel.js'

export function addAudioModules (base, omniNode) {
  if (omniNode && typeof omniNode.getAllNodes === 'function') setUsageProvider(() => omniNode.getAllNodes())
  const panel = base.addModule(new OmniAudioLibraryPanel())
  return { panel }
}
export default addAudioModules
