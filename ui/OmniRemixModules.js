/** ui/OmniRemixModules.js (V226) — registers the Remix system and the Sandbox. */
import OmniSandbox from '../systems/OmniSandbox.js'
import OmniConstruction from '../systems/OmniConstruction.js'
import OmniSceneFile from '../systems/OmniSceneFile.js'
import OmniMeaningDemo from '../systems/OmniMeaningDemo.js'
import OmniLineup from '../systems/OmniLineup.js'
import OmniDocWindow from '../systems/OmniDocWindow.js'
import OmniSequenceBadges from '../systems/OmniSequenceBadges.js'
import OmniObjectPainter from '../systems/OmniObjectPainter.js'
import OmniPainterSounds from '../systems/OmniPainterSounds.js'
import OmniRemix from '../systems/OmniRemix.js'
export function addRemixModules (base, omniNode) { return { remix: base.addModule(new OmniRemix(base.context, omniNode)), sandbox: base.addModule(new OmniSandbox(base.context, omniNode)), construction: base.addModule(new OmniConstruction(base.context, omniNode)), scenefile: base.addModule(new OmniSceneFile(base.context, omniNode)), demo: base.addModule(new OmniMeaningDemo(base.context, omniNode)), lineup: base.addModule(new OmniLineup(base.context, omniNode)), docwindow: base.addModule(new OmniDocWindow(base.context, omniNode)), badges: base.addModule(new OmniSequenceBadges(base.context, omniNode)), objectpaint: base.addModule(new OmniObjectPainter(base.context, omniNode)), paintersound: base.addModule(new OmniPainterSounds(base.context, omniNode)) } }
