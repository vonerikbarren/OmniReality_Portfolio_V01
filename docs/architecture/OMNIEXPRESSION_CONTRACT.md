# V195 contract: OmniExpression (keys, MIDI, keyboard panels, BeatPad, DJ, MusicNode)

Binding for the 4 parallel agents. Add, never rename. SHARED FILES ALREADY IN YOUR COPY (do NOT edit): `utils/OmniInputBus.js`, `utils/OmniQuadrantRegistry.js`.
Standing rules are in each agent prompt. Money stuff SANDBOX. User modules must not import Dev modules.

## Ownership
| Agent | Owns |
|---|---|
| 1 INPUT | key map + Expression typing mode (capture layer), `OmniExpressionTypingSettings`, Web MIDI in, live instrument, SoundEngine polyphonic note API, StarLight Q rebind, remove Q/E movement, Cmd/Ctrl+K |
| 2 PANELS | `OmniExpression` panel (keyboard look; maximize = 4 quadrants; header dropdown per quadrant), LH/RH keyboards (together / split into 2 panels, touch), BeatPad 4x4, mixer quadrant, OmniMixer -> OmniMusicPlayer visible rename |
| 3 DJ | `ui/OmniGridLayout.js` (MultiTimer-style grid organizer), OmniDJ quadrant content: 6 circles + faders / EQ / crossfader, working audio on OmniMusicPlayer sources |
| 4 MUSIC | `musicNode` kind, step sequencer (`OmniSequencer`), record from the bus, sequencer panel, ribbon 'Music node' |

## Input bus (shared; exists)
`utils/OmniInputBus.js`: `noteOn({midi,velocity,hand:'L'|'R'|'X',source,keyId?})`, `noteOff(...)`, `setSustain`, `controller('bend'|'bend2'|'mod'|'expression'|'sustain', v)`, `allOff`, `subscribe(fn)`. Window events `omni:input-note-on|off|controller|all-off` (detail = event). Producers: keys (agent 1), MIDI (agent 1), touch keyboards + BeatPad (agent 2), sequencer echo (agent 4, source 'seq'). Consumers: live instrument (agent 1), keyboard highlighting (agent 2), recorder (agent 4).

## Quadrant registry (shared; exists)
`utils/OmniQuadrantRegistry.js`. Agent 2 builds the host and registers 'keysL','keysR','beatpad','mixer'. Agent 3 registers 'dj'. Agent 4 registers 'sequencer'. Register at module load via a `register...` function called from your own `Omni...Modules.js` (3 lines in main.js, one contiguous add-only block each, separate lines).

## SoundEngine polyphonic notes (agent 1 implements in systems/OmniSoundEngine.js; others code against it and use a stub in tests)
```
SoundEngine.noteOn(nodeId, midi, { velocity=0.8, sound?, when? }) -> handle (string)   // polyphonic; many notes per node; `sound` = sanitized sound (instrument); no `sound` -> defaultSound()
SoundEngine.noteOff(handle, { when? })           SoundEngine.allNotesOff(nodeId?)
SoundEngine.playNote(nodeId, midi, { sound?, velocity=0.8, when=now(), duration=0.25 }) -> handle  // scheduled one-shot; `when` is AudioContext seconds (engine clock)
SoundEngine.now() -> engine clock seconds (AudioContext.currentTime or the fake clock)
SoundEngine.setPitchBend(nodeId|null, semitones)  SoundEngine.setModulation(nodeId|null, 0..1)   // null = all live notes
SoundEngine.getAnalysis(nodeId)  // unchanged; analysis of a node includes its polyphonic notes
```
Per-instrument polyphony cap 16, global voice cap from Admin. Fake engine supports every call (deterministic).

## Events (new)
`omni:expression-mode` {on}  (typing mode on/off)   `omni:expression-open` {}  `omni:quadrant-changed` {quadrant, id}
`omni:music-transport` {state:'play'|'stop'|'record', nodeId}   `omni:music-node-create` {position?, at?, label?, select?} (answer detail.out)
`omni:midi-state` {supported, devices:[{id,name}], error?}

## Key map (agent 1; data table, user-editable via settings)
LH: black `w e r t y` = C# D# F# G# A#; white home `a s d f g` = C D E F G; bottom `z x c v` = G A B C (same octave block). RH: black `u i o p [` = C# D# F# G# A#; white home `j k l ; '` = C D E F G; bottom `m , . /` = G A B C. Base octave: LH 3 (C3 = midi 48), RH 4 (C4 = 60). `b` octave down, `n` octave up (scope setting: both / left / right / last played). Space = sustain. Left Shift + ArrowUp/Down = modulation (stays). Right Shift + arrows = pitch bend (up/down) springing back, ←/→ = second axis (bend2, default meaning pan; spring). Enter = play/stop transport, Cmd/Ctrl+Enter = record (only in Expression mode). Cmd/Ctrl+K toggles Expression mode (Esc leaves). ALL by `event.code` (physical keys). While the mode is on a capture-phase layer swallows keys (movement, hands, hotkeys) except Esc and browser chords (Cmd/Ctrl+R, +L, +W, +T, F5, F12, devtools).
Q (bare, outside text fields, not in Expression mode) opens OmniStarLight (the old Cmd/Ctrl+K handler there is removed); movement Q / E bindings are WIPED (MovementPad KeyQ/KeyE).

## Storage keys (new)
`omni:expression-typing-v1` (settings, agent 1), `omni:expression-panel-v1` (panel layout/quadrants, agent 2), `omni:dj-layout-v1` (agent 3), `omni:beatpad-v1` (agent 2), music node data lives in `node.data.music` (agent 4).
