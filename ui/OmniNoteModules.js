/** ui/OmniNoteModules.js — registers the V213 OmniNote modules (runtime first, then the panel). */
import OmniNoteNodes from '../systems/OmniNoteNodes.js'
import OmniNotePanel from './OmniNotePanel.js'
export function addNoteModules (base, omniNode) {
  const notes = base.addModule(new OmniNoteNodes(base.context, omniNode))
  const panel = base.addModule(new OmniNotePanel())
  return { notes, panel }
}
