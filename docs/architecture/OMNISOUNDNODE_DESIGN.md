# SoundNode, its settings window and sound on every node (V194, part 2 of 3)

Status: implemented in V194, tested with jsdom against test doubles of the model and the engine (the real `utils/OmniSoundModel.js`, `systems/OmniSoundEngine.js` and `utils/OmniSoundParticleModel.js` belong to the other two builders; see `OMNISOUND_CONTRACT.md`). Real GPU, real audio, phone and touch not verified.

## Purpose
Dimensionalize a sound: a node that makes a sound with as many settings as possible, whose body reacts to the sound, and a way to give ANY node a sound. This part is the node kind, its geometry, the editing UI and the global options. The audio (engine, scene glue) is agent 1; particles and viewers are agent 3.

## Existing equivalents (checked first)
- Kinds with a marker in `data.nodeKind` (V183 store items, V191 path / floor panel, V192 terminal shell). The SoundNode follows the V191/V192 route: `utils/OmniExtraKinds.js` (kind id, create fields, mesh, release) plus a runtime module. No new node system.
- `ui/OmniSettingsPanelBase.js` (class-A window, resize and maximize through `WindowManager`, bottom sheet on phones) is the shell of the settings window.
- Admin blocks (`OmniStateStrictAlignAdminBlock.js` + `utils/OmniStateStrictAlignSettings.js`) are the pattern for the global options.
- OmniMusicPlayer (OmniMixer before V195) already plays audio; the engine bridges to it (agent 1). Nothing in this part touches the mixer.

## Data (persisted by reference, with the node)
`data.nodeKind = 'soundNode'`, `data.sound` (sanitized by the sound model), `data.soundParticles` (sanitized by the particle model). Any other node may have `data.sound` once the user switches sound on; until then the node has no sound keys and behaves exactly as before. Nothing is copied into a second store: `OmniNode._save` writes the node's data object, so the sound is saved and loaded with the node. `_fixNode` repairs a loaded sound node whose `sound` is missing or not an object.

## Files
| File | Role |
|---|---|
| `utils/OmniExtraKinds.js` (edited) | `KIND_SOUND`, `GEO_SOUND`, `isSoundNodeData`, create fields (plain-object copies of `sound` / `soundParticles`), mesh build and release, `SERVICES.sound` |
| `utils/OmniSoundNodeMesh.js` | the GEOMETRY system: mesh, live set, `reactSoundMesh` (per frame), `pitchHue` |
| `systems/OmniSoundNodes.js` | runtime: create, per-frame reaction, the shared EDITING API, global settings to engine |
| `utils/OmniSoundSettings.js` | global options: defaults, validation, migration, storage, event, opt-in |
| `ui/OmniSoundFields.js` | controls generated from a schema (shared by the window and the Inspector) |
| `ui/OmniSoundPanel.js` | `⟐SoundNodeSettings` (class A) |
| `ui/OmniSoundInspector.js` | Inspector `Sound` section (every node) and the SoundNode block in Appearance |
| `ui/OmniSoundAdminBlock.js` | Admin > UI Settings > Sound |
| `ui/OmniSoundUnlockPrompt.js` | "Enable sound" toast (class B) |
| `ui/OmniSoundModules.js` | `addSoundModules(base, omniNode)`: the 3 lines in `main.js`; also registers the Admin slot |

## Geometry
One `Mesh` (a double-sided lathe "speaker bell", so the node's normal raycast, colour, move, StrictAlign and delete work) with six non-pickable visual children: a core icosahedron, three torus rings and a play triangle / pause bars. OmniNode raycasts node meshes non-recursively, so the children never change selection. Geometries are shared and never disposed with a node; each node owns five basic materials, disposed by `releaseSoundMesh` (run through the kind's `omniRelease` when the node is deleted).

Per frame (`reactSoundMesh`, called by `OmniSoundNodes.update`): level (smoothed) drives core scale and brightness; sub+bass, low-mid+mid and high-mid+presence+brilliance drive the three rings (scale and opacity); silence gives a slow breathing; the play triangle shows when idle and the pause bars while playing. Colour is `sound.color` when it is a `#rrggbb`, else a hue from the note class (`pitchHue`, 440 Hz when unknown). Disabled sound: very dim, no glyph. Muted: half dim. It allocates nothing per frame (scratch colour, no arrays), takes the analysis as a parameter (`null`, missing bands, NaN, strings are all safe), skips hidden meshes and meshes farther than 220 units from the camera.

## Editing API (the one code path for the window and the Inspector)
`getView`, `ensureSound`, `setEnabled`, `setField(id, scope, key, value)`, `applyPreset`, `resetGroup`, `undo`, `exportJSON`, `importJSON`, `play`, `stop`, `toggle`, `audition`. Rules: keys must exist in the schema (so `__proto__` and unknown keys are refused); the value must be the right KIND for the field (a wrong kind is refused instead of silently becoming the default); the model clamps; the node's `data.sound` is REPLACED by the sanitized object; a playing voice gets `SoundEngine.update(id, sound)`; switching a playing sound off asks the scene to stop it (`omni:sound-stop-request`); persistence is debounced (300 ms: `omni:force-save`, then `omni:node-updated`); `omni:sound-data-changed {nodeId, scope, reason}` tells the windows. Presets replace the sound (defaults + preset) and keep `enabled`, `label`, `tags`, `color`, `autoStart`. Undo keeps 30 snapshots per node in memory for discrete actions (preset, reset, paste, switch), not for slider ticks.

## Schema-driven UI
Nothing in `OmniSoundFields.js` / `OmniSoundPanel.js` names a setting. The window renders one section per schema group and one row per field (number = slider + number + unit, enum = select, bool = switch, note = name + octave, text, colour), tooltips and `?` help from `desc`, a search over label / key / description. Only the Inspector's five quick controls look fields up by what they are (`findQuick`: key `note` or type `note`; `dynamic*`; `gainDb` / `gain` / `volume*`; `loop`; `spatial` / `positional*`); a quick control whose field does not exist is left out. Assumptions about the model's key names are limited to: `enabled`, `color`, `midi` / `note` / `octave` (for the colour only), `label`, `tags`, `autoStart`.

## Global options (`omni:sound-settings-v1`)
`masterVolume` 0..1 (0.8), `voiceCap` 1..32 (8), `muteOnPhone` (true), `requireOptIn` (false), `particleCap` 0..50000 (20000), `showUnlockPrompt` (true), `muted` (null = follow `muteOnPhone`). Events `omni:sound-settings-set` (in) and `omni:sound-settings-changed` (out). `OmniSoundNodes` owns the listener, calls `SoundEngine.setMasterVolume` and `setMuted(engineMuted())` (muted by the speaker, by the phone default, or because opt-in is required and not given). The voice cap and particle cap are read by the engine / scene / particles from `getSoundSettings()` (cached, always valid) and the `changed` event; this part calls no engine function that the contract does not list.

## Unlock prompt
Class B toast, no window chrome. Shown on `omni:sound-unlock-needed`, or on `omni:sound-state started` while "ask before sound" is on and the person has not opted in. The button calls `SoundEngine.unlock()` and `omni:sound-enable-request` (opt in for the tab, unmute). × hides it for the page's life. The speaker toggle in the Inspector uses the same request to unmute and the `muted: true` setting to mute.

## Decisions
- The Sound section is a 13th Inspector section (`sound`, after Media) in the shared list, so the icon strip and the ribbon's Inspector tab get it from one place.
- The speaker is global (the engine has one `setMuted`); there is no per-node mute in the contract.
- Particles for an ordinary node are created on the first particle edit, not when sound is switched on.
- `requireOptIn` defaults to false and `muteOnPhone` to true (see the owner questions in the agent notes).
- Stopping the voices of a deleted node is the scene module's job (contract); this part emits the standard `omni:node-deleted`.
- Test doubles stand in for the model and the engine until the three parts are merged.
