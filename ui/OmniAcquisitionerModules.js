/** ui/OmniAcquisitionerModules.js — registers the V223 OmniCommunication system, then its OmniNodeAcquisitioner panel. */
import OmniCommunication from '../systems/OmniCommunication.js'
import OmniAcquisitionerPanel from './OmniAcquisitionerPanel.js'
export function addAcquisitionerModules (base, omniNode) {
  const communication = base.addModule(new OmniCommunication(base.context, omniNode))
  const panel = base.addModule(new OmniAcquisitionerPanel())
  return { communication, panel }
}
