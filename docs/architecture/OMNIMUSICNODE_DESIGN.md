# OmniMusicNode and the step sequencer (V195)

Applies to: V195 · Status: first stage built (pattern + live record), later stages are a roadmap · Real devices: not verified.

## Purpose
A MusicNode is a node that holds a pattern (tempo, length, tracks of notes) and plays it through the SoundNodes already in the reality. It is the first stage of a DAW-like feature: edit a loop, play it, record into it from the keyboard / MIDI / pads, undo the take. Everything stays a "digital space of logic": the pattern is plain data on the node (`data.music`), saved and loaded with the node like any other.

## Existing equivalents (reused, not rebuilt)
| Need | Existing piece | How it is used |
|---|---|---|
| Sound of an instrument | SoundNode (`data.sound`) + `OmniSoundEngine` | a track's `instrument` is a SoundNode id; none = the music node's own default sine |
| Note names / frequencies | `utils/OmniSoundModel.js` | re-exported by the model as `midiToName`, `nameToMidi`, `midiFrequency` |
| Extra node kinds | `utils/OmniExtraKinds.js` | `musicNode` kind, `extraCreateFields`, `buildExtraMesh`, `releaseExtraMesh` |
| Live notes in | `utils/OmniInputBus.js` (V195, shared) | the recorder subscribes; sources keys / midi / touch / pad are recorded |
| Window / bottom sheet | `OmniSettingsPanelBase` + `OmniWindowChrome` | class-A window; phone bottom sheet |
| Compact panel inside another panel | `OmniQuadrantRegistry` | content id `sequencer` |

## Data (`node.data.music`, sanitized on every write)
`{ v, tempo 20..300, stepsPerBar 4..32, bars 1..8, resolution (1/4 1/8 1/16 1/32), swing 0..0.75, loop, metronome, countIn, tracks[] }`.
A track: `{ id, name, instrument, view 'grid'|'roll', volume, pan, mute, solo, transpose, steps[] }`. A step event: `{ step, midi, velocity, gate, offset, prob }` (`gate` and `offset` are fractions of a step). Limits: 16 tracks, 4096 events per track, 256 total steps. `sanitizeMusic` is idempotent, never throws and is `__proto__`-safe. Stored patterns are never mutated: each edit makes a new object (this is what makes undo cheap and the 3D plate re-read only when the reference changes).

## Files
| File | Role |
|---|---|
| `utils/OmniMusicModel.js` | PURE: schema, defaults, sanitize, `stepTime`, `quantize`, `recordPosition`, `eventsAtStep`, event / track helpers, 11 presets |
| `systems/OmniMusicNodes.js` | module: kind creation, store (commit, undo / redo, coalescing, strokes), all edit verbs, mesh driving |
| `systems/OmniSequencer.js` | module: transport, lookahead scheduler, metronome, count-in, recording, take undo |
| `utils/OmniMusicNodeMesh.js` | the plate: one InstancedMesh of 4x16 cells, glyphs, flash; allocation-free per frame |
| `ui/OmniSequencerView.js` | 2D editor (grid + piano roll lanes, instrument picker, note editor, playhead) |
| `ui/OmniSequencerPanel.js` | class-A window `OmniSequencer`, quadrant content `sequencer` |
| `ui/OmniMusicInspector.js` | Inspector section (tempo, play / stop / record, loop, metronome, Open sequencer) |
| `ui/OmniMusicModules.js` | `addMusicModules(base, omniNode)`: the one add-only block main.js calls |

## Timing
One anchor maps engine time to beats (`_t0`, `_b0`, `_beatSec`); a tempo change re-anchors at "now", so nothing drifts. A ~25 ms timer chain schedules everything inside a 100 ms lookahead (1.5 s while the tab is hidden) against `SoundEngine.now()`. A step later than 0.12 s is skipped, never burst. Swing delays odd steps. Notes go out as `SoundEngine.playNote(instrument, midi, { sound, velocity, when, duration })`; if the engine lacks the method the sequencer stays silent and does not throw.

## Events
| Event | Direction | Detail |
|---|---|---|
| `omni:music-node-create` | in | `{ select?, pattern?, ... }`, answers in `detail.out` |
| `omni:music-transport-request` | in | `{ action: play / stop / toggle / record, nodeId, mode }`, answers in `detail.out` |
| `omni:music-transport` | out | `{ state, nodeId, countIn, mode }` |
| `omni:music-step` | out | `{ nodeId, trackId, step, midi, velocity }`, fired when the note is audible; drives the visuals |
| `omni:music-recorded` / `omni:music-armed` / `omni:music-data-changed` | out | take finished / armed track changed / pattern edited |
The sequencer deliberately does NOT echo played notes on the InputBus: the live instrument would play them a second time.

## Recording
Bus notes with source keys / midi / touch / pad are taken (seq and pedal are ignored). Live mode quantizes (or not) at the chosen resolution, swing aware, after an optional count-in; notes in the count-in are ignored; positions wrap around the loop. Step mode has a cursor, a 60 ms chord window, rest and back. A take is one undo step. Overdub off clears the armed track when the take starts. Stored pitch = played pitch minus the track transpose.

## Roadmap
1. Tracks (next): per-track length / loop points, per-track instrument chain and effects send, mixer strip in the quadrant host, automation lanes for volume / pan / bend.
2. Arrangement: several patterns per music node, a song timeline of pattern blocks, markers, tempo changes.
3. Audio clips: record or drop audio (OmniMusicPlayer sources, the DJ decks) as clips on tracks, time-stretch to tempo.
4. `.mid` export / import: the model already stores midi note numbers, steps, gate and velocity, so a standard MIDI file writer is a pure function over `data.music` (tick = step x ppq / steps-per-beat).
5. Spatial arrangement: the node's position in the reality becomes pan / level, several music nodes sync to one transport, and a track can be placed on another node (a "speaker") so the arrangement is walked through, not scrolled.

## Open points
Engine `pan` support (the sequencer passes `pan`; ignored if the engine does not read it), the Enter / Cmd+Enter transport shortcut bridge (agent 1), and the order of the add-only blocks in main.js across the four V195 parts.
