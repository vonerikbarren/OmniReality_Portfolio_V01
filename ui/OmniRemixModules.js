/** ui/OmniRemixModules.js (V226) — registers the Remix system and the Sandbox. */
import OmniSandbox from '../systems/OmniSandbox.js'
import OmniConstruction from '../systems/OmniConstruction.js'
import OmniSceneFile from '../systems/OmniSceneFile.js'
import OmniMeaningDemo from '../systems/OmniMeaningDemo.js'
import OmniLineup from '../systems/OmniLineup.js'
import OmniDocWindow from '../systems/OmniDocWindow.js'
import OmniTimeNodes from '../systems/OmniTimeNodes.js'
import OmniTimePadBoard from './OmniTimePadBoard.js'
import OmniClaimNodes from '../systems/OmniClaimNodes.js'
import OmniClaimReality from '../systems/OmniClaimReality.js'
import OmniSelectMode from '../systems/OmniSelectMode.js'
import OmniStickyNotes from '../systems/OmniStickyNotes.js'
import OmniTransformBar from '../systems/OmniTransformBar.js'
import OmniLineEffects from '../systems/OmniLineEffects.js'
import OmniFlashcards from '../systems/OmniFlashcards.js'
import OmniFlashUI from './OmniFlashUI.js'
import OmniEpistemics from '../systems/OmniEpistemics.js'   // V271
import OmniEdgeNodes from '../systems/OmniEdgeNodes.js'   // V278
import OmniProfiler from './OmniProfiler.js'   // V278
import OmniStoredVideo from '../systems/OmniStoredVideo.js'   // V277
import OmniStoredReality from '../systems/OmniStoredReality.js'   // V277
import OmniRhythm from '../systems/OmniRhythm.js'
import OmniRhythmPanel from './OmniRhythmPanel.js'
import OmniSequenceBadges from '../systems/OmniSequenceBadges.js'
import OmniObjectPainter from '../systems/OmniObjectPainter.js'
import OmniPainterSounds from '../systems/OmniPainterSounds.js'
import OmniRemix from '../systems/OmniRemix.js'
export function addRemixModules (base, omniNode) { return { remix: base.addModule(new OmniRemix(base.context, omniNode)), sandbox: base.addModule(new OmniSandbox(base.context, omniNode)), construction: base.addModule(new OmniConstruction(base.context, omniNode)), scenefile: base.addModule(new OmniSceneFile(base.context, omniNode)), demo: base.addModule(new OmniMeaningDemo(base.context, omniNode)), lineup: base.addModule(new OmniLineup(base.context, omniNode)), docwindow: base.addModule(new OmniDocWindow(base.context, omniNode)), timenodes: base.addModule(new OmniTimeNodes(base.context, omniNode)), timepadboard: base.addModule(new OmniTimePadBoard(base.context, omniNode)), claims: base.addModule(new OmniClaimNodes(base.context, omniNode)), claimview: base.addModule(new OmniClaimReality(base.context, omniNode)), selectmode: base.addModule(new OmniSelectMode(base.context, omniNode)), sticky: base.addModule(new OmniStickyNotes(base.context, omniNode)), transform: base.addModule(new OmniTransformBar(base.context, omniNode)), lines: base.addModule(new OmniLineEffects(base.context, omniNode)), flash: base.addModule(new OmniFlashcards(base.context, omniNode)), flashui: base.addModule(new OmniFlashUI(base.context, omniNode)), epistemics: base.addModule(new OmniEpistemics(base.context, omniNode)), edgenodes: base.addModule(new OmniEdgeNodes(base.context, omniNode)), profiler: base.addModule(new OmniProfiler(base.context, omniNode)), storedvideo: base.addModule(new OmniStoredVideo(base.context, omniNode)), storedreality: base.addModule(new OmniStoredReality(base.context, omniNode)),
 rhythm: base.addModule(new OmniRhythm(base.context, omniNode)), rhythmui: base.addModule(new OmniRhythmPanel(base.context, omniNode)), badges: base.addModule(new OmniSequenceBadges(base.context, omniNode)), objectpaint: base.addModule(new OmniObjectPainter(base.context, omniNode)), paintersound: base.addModule(new OmniPainterSounds(base.context, omniNode)) } }
