/** ui/OmniScanModules.js — registers the V212 OmniScan modules (runtime first, then the panel). */
import OmniScan from '../systems/OmniScan.js'
import OmniScanPanel from './OmniScanPanel.js'
export function addScanModules (base, omniNode) {
  const scan = base.addModule(new OmniScan(base.context, omniNode))
  const panel = base.addModule(new OmniScanPanel())
  return { scan, panel }
}
