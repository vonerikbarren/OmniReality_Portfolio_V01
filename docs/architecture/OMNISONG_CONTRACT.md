# V198 contract: OmniSongNode (arrangement, mixer, audio clips, piano roll)

Design: docs/architecture/OMNISONGNODE_DESIGN.md (also in the Project as claude/OMNISONGNODE_DESIGN.md; copy provided below in your docs folder). Owner decisions: audio clips may be WAV/MP3/any format the browser decodes; DOM FIRST (no 3D experience in this build); export later (NOT in V198); MIDI/WAV export, mic recording, lyrics, 3D are NOT built now. Binding names; add, never rename.

## Ownership
| Agent | Owns |
|---|---|
| 1 SONG CORE | `utils/OmniSongModel.js` (pure model + pure edit ops), `systems/OmniSongPlayer.js` (multi-pattern + audio clip playback, tempo map, loop, lane buses, automation, master limiter, meters) |
| 2 SONG UI | `songNode` kind + mesh + Inspector + `ui/OmniSongPanel.js` (timeline DOM UI, lane headers = mixer, clip library, automation lane, master strip, undo/redo), ribbon Create 'Song node', OmniDraw picker tile 'Song', quadrant content 'song', docs 17 |
| 3 AUDIO ASSETS | `utils/OmniAudioAssets.js` (IndexedDB store, any-format import via decodeAudioData, peaks, clip playback helper), `ui/OmniAudioLibraryPanel.js` (+ drag/drop), docs 18 |
| 4 MUSIC UPGRADE | MusicNode piano-roll view (`ui/OmniPianoRoll.js`) inside the sequencer panel for melodic tracks, longer note gates, `omni:music-node-duplicate`, pattern length helper |

## Song data (`node.data.song`, agent 1 sanitizes; node kind id 'songNode', KIND_SONG exported from OmniSongModel)
```
song = { v:1, meta:{title,artist,credits,key,timeSig:[num,den],tags[]}, bpm:60..240 default 120 (base tempo),
  tempoMap:[{bar,bpm}] (cap 64, bar>=1, sorted, first bar 1 implied), 
  lengthBars: 4..256 default 32,
  lanes:[{id,name,kind:'pattern'|'audio',volume 0..1.5 (1 = unity),pan -1..1,mute,solo,color,sends:{reverb 0..1,delay 0..1}}] (cap 32),
  clips:[{id,lane,startBar>=1 (1-based, float allowed in 0.25 grid),lengthBars>0,ref:{type:'music'|'audio',id},repeat 1..64 (loops the source to fill? no: repeat = how many times the source pattern repeats within lengthBars is derived; `repeat` = explicit loop count; if lengthBars longer than source*repeat the clip is silent after),offset(bars into the source) >=0,gain 0..2,fadeIn,fadeOut (seconds, audio),transpose -24..24 (pattern clips),name?}] (cap 512),
  sections:[{id,name,startBar,lengthBars,color}] (cap 64),
  automation:[{id,lane|'master',param:'volume'|'pan'|'filter'|'sendReverb'|'sendDelay',points:[{bar,value,curve:'linear'|'step'}]}] (cap 64 lanes x 256 points),
  master:{gain 0..1.5,limiter:bool,limiterThresholdDb -24..0,reverb:{size,mix},delay:{time,feedback,mix}},
  loop:{on,startBar,endBar}, markers:[{id,bar,name}] (cap 128) }
```
Model API (agent 1): `defaultSong()`, `sanitizeSong(x)` (never throws, hostile/__proto__ safe), `SONG_LIMITS`, `KIND_SONG`, `barToSeconds(song,bar)`, `secondsToBar(song,sec)`, `bpmAt(song,bar)`, `clipEndBar(clip)`, `songLengthSeconds(song)`, `newId(prefix)`; immutable edit ops all `(song, ...) -> sanitized new song` and never throw: `addLane(song,{name,kind})`, `removeLane`, `updateLane(song,laneId,patch)`, `addClip(song,{lane,startBar,lengthBars,ref,...})`, `moveClip(song,clipId,{startBar,lane})`, `resizeClip(song,clipId,lengthBars,{fromStart})`, `splitClip(song,clipId,atBar)`, `duplicateClip`, `removeClip`, `updateClip(song,id,patch)`, `setTempoPoint(song,bar,bpm)`, `removeTempoPoint`, `addSection/updateSection/removeSection`, `setAutomationPoint(song,target,param,bar,value,curve)`, `removeAutomationPoint`, `addMarker`, `setLoop`, `snapBar(bar,grid)`, `songPresets()`/`demoSong(refs?)`. Unit tested.

## Player API (agent 1; module singleton `SongPlayer` default export + scene module class OmniSongPlayerScene {init,update,destroy})
```
SongPlayer.play(nodeId, {fromBar?}) / stop(nodeId) / pause / seek(nodeId, bar) / isPlaying(nodeId)
SongPlayer.update(nodeId, song)                 // live param changes (mixer, tempo, clips) while playing
SongPlayer.getPosition(nodeId) -> { playing, bar (float, 1-based), seconds, loopCount }
SongPlayer.getLevels(nodeId) -> { master: 0..1, lanes: { [laneId]: 0..1 } }   // peak/RMS, cheap
```
Events: request `omni:song-transport-request {action:'play'|'stop'|'toggle'|'seek', nodeId, bar?}`; state `omni:song-transport {state:'play'|'stop', nodeId}`; the player resolves the node's `data.song` from the node registry (find how systems/OmniSequencer.js / OmniMusicNodes.js read `data.music`). Pattern clips play the referenced MusicNode (`node.data.music`: tracks/steps; see utils/OmniMusicModel.js and systems/OmniSequencer.js: reuse its step-time logic, do NOT touch OmniSequencer.js) through `SoundEngine.playNote(...)` with the lane volume/pan applied by scaling velocity and (if engine supports) pan; audio clips through `AudioAssets.playClip(...)`. Lane gain buses + master limiter + two send FX (reverb, delay) built on the SoundEngine context (`SoundEngine.getContext()`; if the engine has no context yet use its unlock path; do not create a second context). Many patterns at once; lookahead scheduler (25 ms / 100 ms) against SoundEngine.now(); tempo map; loop region; automation lane values applied at schedule time and as AudioParam ramps for audio lanes.
Because pattern-clip notes go through the shared SoundEngine voices, lane volume for pattern lanes is done via velocity scaling and mute/solo; document this limit. Fake engine path must work (tests).

## Audio assets (agent 3) `utils/OmniAudioAssets.js`
```
AudioAssets.importFile(file) -> Promise<{ok,id?,meta?,error?}>   // meta {id,name,duration,sampleRate,channels,bytes,addedAt}; error codes 'unsupported','too-large','quota','decode'
AudioAssets.list() -> Promise<meta[]>   getMeta(id)   remove(id)   rename(id,name)   usage()-> Promise<{bytes,count,limitBytes}>
AudioAssets.getBuffer(ctx, id) -> Promise<AudioBuffer|null>   // cached per ctx, LRU
AudioAssets.getPeaks(id, n=512) -> Promise<Float32Array|null>  // min/max pairs 0..1 normalised, cached
AudioAssets.playClip(ctx, id, { when, offset=0, duration?, gain=1, fadeIn=0, fadeOut=0, rate=1, dest }) -> { stop(at?) , done:Promise }   // schedules an AudioBufferSourceNode on ctx time `when`
computePeaks(channelData, n)  // pure, exported
```
IndexedDB db 'omni-audio-assets-v1', stores meta + blob; caps 40 MB per file, 300 MB total (quota-checked via navigator.storage.estimate), `omni:audio-assets-changed` event. Supports whatever `decodeAudioData` accepts; extension/mime check is advisory only; friendly message for unsupported. Tests use a WAV generated in the test.

## Piano roll (agent 4)
`ui/OmniPianoRoll.js`: canvas/DOM piano roll for one MusicNode track (pitch rows with a keyboard strip, steps as columns), click/drag to paint, drag edges to resize gate, delete, select + move + transpose, velocity lane, snap, scroll/zoom, touch; embedded as a mode toggle (Grid | Roll) per track in `ui/OmniSequencerView.js` / panel. `omni:music-node-duplicate {nodeId, select?}` (answer in detail.out `{ok,nodeId}`) clones a MusicNode in front of the camera (used by the song's 'Make unique'). Helper `patternLengthBars(music)`, `patternLengthSteps(music)` exported from utils/OmniMusicModel.js. Raise the gate cap in the model (steps-long notes up to a bar) keeping `sanitizeMusic` back-compatible with V195 data.

## Song panel / node (agent 2) uses all of the above; during tests the player/model/assets are doubles.
Quadrant content id 'song' (registerQuadrantContent from utils/OmniQuadrantRegistry.js), standalone window '⟐OmniSong' nav item (also StarLight site, ribbon Home > Create 'Song node' + Home > Tools 'Song'), OmniDraw picker tile 'Song' (edit `ui/OmniDrawModePicker.js` ADD-only: tile + `_choose('song')` creates `omni:song-node-create {select:true}` and opens '⟐OmniSong'), `omni:song-node-create` answer in detail.out `{ok,nodeId}`.

## Events (new)
`omni:song-node-create`, `omni:song-transport-request`, `omni:song-transport`, `omni:song-changed {nodeId}`, `omni:music-node-duplicate`, `omni:audio-assets-changed`.
## Storage
Song data in node.data.song; audio blobs in IndexedDB `omni-audio-assets-v1`; panel UI prefs `omni:song-panel-v1` (agent 2).
