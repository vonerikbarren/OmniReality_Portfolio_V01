/** ui/OmniIDEModules.js — registers the V222 OmniIDE panel. */
import OmniIDEPanel from './OmniIDEPanel.js'
export function addIDEModules (base, omniNode) {
  const panel = base.addModule(new OmniIDEPanel(base.context, omniNode))
  return { panel }
}
