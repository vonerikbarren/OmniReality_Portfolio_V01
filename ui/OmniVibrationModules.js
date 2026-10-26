/** ui/OmniVibrationModules.js — registers the V216 OmniVibration modules (runtime first, then the panel). */
import OmniVibration from '../systems/OmniVibration.js'
import OmniVibrationPanel from './OmniVibrationPanel.js'
export function addVibrationModules (base, omniNode, getControls) {
  const vibration = base.addModule(new OmniVibration(base.context, omniNode, getControls))
  const panel = base.addModule(new OmniVibrationPanel())
  return { vibration, panel }
}
