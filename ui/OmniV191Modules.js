/**
 * ui/OmniV191Modules.js — registers the V191 UI modules in one place (main.js adds them with a single call)
 *
 *   OmniDockRealities               the geometry strip above the Dock          (ui/OmniDockRealities.js)
 *   OmniRealitiesInShape            the "realities in this shape" window       (ui/OmniRealitiesInShape.js)
 *   OmniDockRealitiesSettingsPanel  its user settings window                   (ui/OmniDockRealitiesSettingsPanel.js)
 *   OmniStateStrictAlign            the "`" one-axis exact-move mode           (ui/OmniStateStrictAlign.js)
 *
 * BaseScene.addModule() calls init() itself; nothing here calls it again.
 */

import OmniDockRealities from './OmniDockRealities.js'
import OmniRealitiesInShape from './OmniRealitiesInShape.js'
import OmniDockRealitiesSettingsPanel from './OmniDockRealitiesSettingsPanel.js'
import OmniStateStrictAlign from './OmniStateStrictAlign.js'

export function addV191Modules (base, omniNode) {
  const dock = base.addModule(new OmniDockRealities(base.context, omniNode))
  base.addModule(new OmniRealitiesInShape(omniNode))
  base.addModule(new OmniDockRealitiesSettingsPanel())
  const strictAlign = base.addModule(new OmniStateStrictAlign(base.context, omniNode))
  return { dock, strictAlign }
}
