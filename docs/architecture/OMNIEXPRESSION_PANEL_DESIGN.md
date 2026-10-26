# OmniExpression panel: design (V195, part 2: panels)

Applies to: V195 · Status: design of what was built in V195 part 2, plus an open idea (spatial equivalence) with no implementation · Real devices: not verified.

Contract it follows: `docs/architecture/OMNIEXPRESSION_CONTRACT.md`. User page: `docs/user-guide/14_Expression_Panel.md`.

## Files

| File | Role |
|---|---|
| `utils/OmniExpressionPanelModel.js` | Pure: key layout copy, note names, touch velocity, hit test, saved state `omni:expression-panel-v1`, mixer gains |
| `ui/OmniExpressionKeyboard.js` | `mountKeyboard(host, {hands, fill})`: one or two hand blocks; touch producer (source `touch`) and bus consumer (lights) |
| `ui/OmniExpressionPanel.js` | The window (class A), the quadrant host, Split / Join windows, `registerExpressionContents()` |
| `ui/OmniExpressionMixer.js` | Quadrant content `mixer` (placeholder) |
| `utils/OmniBeatPadModel.js`, `ui/OmniBeatPad.js` | Pad model and kits; the grid, the standalone window and the content `beatpad` |
| `ui/OmniExpressionPanelModules.js` | `addExpressionPanelModules(base, omniNode)`: the one call main.js makes |

## Behaviour in short

- First look = the keyboard only. `omni:window-maximized-changed {id:'expressionpanel'}` switches to quadrants; the other mode is torn down first, so there is never more than one mounted set.
- Quadrants: `listQuadrantContents(q)` fills each header drop-down; a saved id that is not registered is kept (marked "not available yet") and mounted by itself when the registry announces it. `mount(host, {quadrant, maximized:true, hand?})` is wrapped in try/catch; a throwing content gets a placeholder.
- Split: the panel closes and two `KeysWindow`s (ids `expressionpanel-l`, `expressionpanel-r`) open. Join closes them and reopens the panel. `split` and the two positions are saved. Not offered on a phone (both bottom sheets would sit on top of each other).
- Touch: pointer events on the keyboard root, one `keyId` per pointer (`touch:<pointerId>`), velocity from real pressure or the y position (top 0.3 .. bottom 1.0). Pointer up, cancel, lost capture, blur, page hidden and destroy all release through `InputBus.noteOff`.
- Key labels: the layout table is a local copy of the contract. `loadKeyMap()` can read `utils/OmniExpressionKeys.js` defensively (shape `{L:{KeyA:0..}, R:{..}}` via `getKeyMap()` / `KEY_MAP` / `DEFAULT_KEY_MAP`); anything else is ignored.
- Octave: the readout is the touch keyboard's octave. It also follows the computer keys: a note of that hand outside the shown block moves the block. Proposed event `omni:expression-octave {hand, octave}` lets the key layer say it explicitly.
- BeatPad: strictly 16 pads, note 36 + index, bus hand `X` source `pad`. Sound-bound pads also send `omni:sound-play-request {nodeId}` (and `omni:sound-stop-request` for hold / toggle pads). The live instrument should treat `source:'pad'` events as drum hits, not as a piano note, when the pad is bound to a sound node.
- Mixer: `ui/OmniMixerPanel.js` (OmniMusicPlayer) has no mixer API, only the read-only `window.__omniMixerAudio`. The quadrant is therefore "Mixer (placeholder)": it stores levels / mute / solo and publishes `omni:expression-mixer {gains}`.

## Spatial equivalence (for later)

The owner says the four quadrants have a 3D counterpart. Nothing of this is built; this section only records the idea so that the 2D choices do not block it.

Idea: each quadrant maps to a region or a face of a space. A maximized panel is a flat picture of a place you could stand in.

- Four quadrants could be the four walls (or four corners) of a room, with the player in the middle: the keyboards on the two walls near the hands, the pads and the DJ on the far walls.
- The six DJ circles (OmniDJ) are six faces; six circles could form a cube, with one circle per face and the mixer faders along its edges. The quadrant "dj" would be one projection of that cube.
- The same registry could serve both: a content registers once and offers a flat `mount(host, ctx)` and, later, a `place(space, face)`; a quadrant id (`tl`, `tr`, `bl`, `br`) would map to a region id.
- The input bus is already spatially neutral (`hand`, `source`, `keyId`), so a 3D key or pad could produce the same events.

Open questions for the owner:

1. Is the 3D counterpart a room around the player, a cube you walk around, or a set of objects floating in front of the hands?
2. With six DJ circles on a cube, what are the other two quadrant contents (keyboards, BeatPad, mixer, sequencer): the other faces, or inside the cube?
3. Should the four 2D quadrants and the 3D regions stay linked (change one, the other follows), or are they two views of the same layout setting?
4. Does touching a 3D key use the real hands (the hand rays) or the same pointer as today?
5. Should a quadrant keep its place when you travel to another reality, or is the space part of the reality?
6. One cube per reality, or one per player?
7. Is there a limit on how many contents a space may show at once (the page already holds 5 WebGL contexts; the 3D version must not add one)?
