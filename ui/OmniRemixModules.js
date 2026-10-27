/** ui/OmniRemixModules.js (V226) — registers the Remix system and the Sandbox. */
import OmniSandbox from '../systems/OmniSandbox.js'
import OmniRemix from '../systems/OmniRemix.js'
export function addRemixModules (base, omniNode) { return { remix: base.addModule(new OmniRemix(base.context, omniNode)), sandbox: base.addModule(new OmniSandbox(base.context, omniNode)) } }
