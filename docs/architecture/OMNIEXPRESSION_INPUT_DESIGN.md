# OmniExpression INPUT design (V195, part 1): keys, typing mode, live instrument, MIDI, engine notes

Contract (names, ownership, events): `OMNIEXPRESSION_CONTRACT.md`. This page explains how the INPUT half is built and why. User view: `docs/user-guide/13_Expression_Typing.md`.

## Pieces

| File | Role |
|---|---|
| `systems/OmniSoundEngine.js` (edited) | Polyphonic note API: `noteOn / noteOff / allNotesOff / playNote / now / setPitchBend / setModulation` (+ `setPan`, `setExpression`, `getPolyState`) |
| `utils/OmniExpressionKeys.js` | PURE data-driven key map by `event.code`, octave state, `resolveKey` |
| `utils/OmniExpressionFlag.js` | One bit `<html data-omni-expression="on">`, read by older capture listeners |
| `utils/OmniExpressionTypingSettings.js` | Options, validation, storage `omni:expression-typing-v1`, events |
| `systems/OmniExpressionTyping.js` | The Cmd/Ctrl+K mode: capture listener, keys -> `OmniInputBus` |
| `systems/OmniLiveInstrument.js` | `OmniInputBus` -> `SoundEngine` notes (instrument = a node's `data.sound`) |
| `systems/OmniMidiIn.js` | Web MIDI -> `OmniInputBus` |
| `ui/OmniExpressionTypingSettingsPanel.js` | `OmniExpressionTypingSettings` window (class A) + Admin block |
| `ui/OmniExpressionInputModules.js` | One call from `main.js` (3 lines): registers the four modules and the Admin slot (preferred 23) |

Data flow: `keys | MIDI | touch | pad -> OmniInputBus -> LiveInstrument -> SoundEngine.noteOn(instrumentNodeId, midi, {velocity, sound})`. The bus ref-counts a pitch by `keyId`, so the two G keys are one note, and it owns the sustain pedal (it holds the noteOffs).

## Engine: how a note is made

A node's live notes share ONE extra voice (key `poly:<nodeId>` in the voice map, `v.poly = true`). It reuses the whole V194 voice graph: `_buildVoice` (dynamics, tremolo, drift, fade, analyser), `_buildChain` (FX, width, pan), `_buildNote` (source -> filter -> ADSR -> trim). A note is a normal note object whose `freq` comes from the MIDI number (`noteFrequency`: the sound's `a4`, `transpose`, `fineTune` are kept; its own base note and `octaveShift` are replaced by the key) and whose `spec.gainDb` carries `velocityGain(velocity)` (monotonic, 0.8 = unity, cap 1.3) on top of the sound's own dynamics, so velocity scales through the same dynamics curve.

- **Polyphony** 16 live notes per instrument; the 17th steals the oldest (30 ms release). The array of notes is bounded (40). The global voice cap (Admin, default 8) counts a poly voice as ONE voice and steals the oldest voice (any kind).
- **Scheduling** `when` is engine time (`SoundEngine.now()` = `ctx.currentTime` or the fake clock). `playNote` knows its release time at creation, so the whole note is scheduled in the graph at once. A past `when` plays now.
- **Controllers** `setPitchBend` is a constant source (cents) into the voice's pitch bus (every oscillator's `detune`); `setModulation` opens a gain from the voice's vibrato LFO into the same bus (up to 60 cents); `setPan` adds to the chain pan; `setExpression` multiplies the voice out gain. `nodeId = null` means all poly voices, and is remembered for voices created later. The values survive an instrument change (`_ctl`).
- **Sound change** passing a different `sound` to `noteOn` runs the existing `_applyLive` (held notes of a changed source are re-struck). Passing no `sound` keeps the voice's current one (a new voice gets the default sine). Positional audio is forced off for live notes.
- **Analysis** `getAnalysis(nodeId)` returns the louder of the node's own voice and its poly voice; the fake engine sums every live note (chord peaks, bend moves the peak, expression and velocity scale level).
- **Lifetime** a poly voice with no notes finishes and is disposed after the FX tail; `dispose()` / `stopAll()` clear everything; handles are dropped when a note retires (no leak).
- **Locked audio** `noteOn` returns `null` and asks for unlock (`omni:sound-unlock-needed`); the live instrument calls `unlock()` from the key press and starts the held note afterwards.

## Typing mode: how keys are shielded

`window` capture listener (`keydown` and `keyup`) in `OmniExpressionTyping`. Cmd/Ctrl+K toggles (also inside a text box). While ON: Esc leaves; Cmd/Ctrl combos (except K and Enter), F5, F11, F12 and bare Ctrl/Cmd/Alt pass untouched; everything else gets `preventDefault` + `stopImmediatePropagation`. Key repeats are ignored. Key-ups of keys that went down BEFORE the mode started pass through, so a held W is released instead of walking forever. Blur, `pagehide` and a hidden tab call `releaseAll()` (`InputBus.allOff()`, wheels to 0, Shift state cleared). Focusing a text field leaves the mode.

**Why a flag too.** A window capture listener registered EARLIER than ours runs first, and `stopImmediatePropagation` cannot reach back. Four such listeners existed; each now starts with `if (isExpressionOn()) return` (`utils/OmniExpressionFlag.js`):

| Early capture listener | Reacts to |
|---|---|
| `ui/OmniStarLight.js` | Q (open), Esc (close) |
| `ui/OmniStateStrictAlign.js` | backtick, Esc, arrows, X/Y/Z/1/2/3, Enter, Cmd+Z |
| `ui/OmniChronos.js` | Chronos transport / edit keys |
| `utils/TerminalSceneInput.js` (`handleKey`) | printable keys, Enter, Backspace, arrows into the scene terminal |

Every other keydown/keyup listener in the app is bubble phase on `window`, `document` or an element, so it is behind our capture swallow: `main.js` (R/F, backtick/F1/Esc, C, o/O, 0/9, b, p, g, n, t, k, m, F2, F4, Esc, ( ), Enter, Shift/1-4 hand cells), `ui/MovementPad.js` (WASD, R/F, arrows, Y/H/U/V, [ ], numpad), `Portfolio3D/XD`, `WindowInspectorTool` (F6), `CameraMovementOptionsPanel` (F3), `Drawer`, `HandToolsPanel`, `HandSpeedPanel`, `OmniStarBoot`, `OmniStoreScene`, `OmniAxinator`, `OmniPointing`, `OmniPresenter`, `OmniNode`, `OmniOrbitRelease`, `OmniFloorPanels`, `OmniRibbon`, and the engine's own unlock listener on `document` (hence the live instrument unlocks audio itself). A static test fails if a new window-capture keydown listener appears without being added to the known list. Synthetic keys dispatched by `OmniKeys` / `OmniKeyCryptxReveal` on `window` are swallowed too.

Limits: a listener registered at window capture in the future must check the flag (the test says so); a browser can keep a handful of chords for itself (Cmd+Q, Cmd+W, Cmd+T, ...) whatever a page does.

## Keys by physical position

`event.code`, never `event.key`: Shift/Caps/AZERTY/Dvorak do not change a note. The table `DEFAULT_KEYS` holds `{code, hand, semi, row}`; `semi` is semitones above the C of the hand's octave (editable per key in the settings: `keyOverrides`). Notes outside 0..127 are silent (no wrapping); octaves are clamped to -1..9. `resolveKey(code, {shiftL, shiftR, meta, ctrl})` classifies note / sustain / octave / mod / bend / bend2 / transport / record / escape. The two Shift keys are tracked by their own codes (`e.shiftKey` cannot tell them apart).

Wheels: a key pulls the wheel to full travel in 40 ms; on release it eases back with `exp(-dt / (springMs / 4))`, snapping to 0 under 0.004. One timer runs only while a wheel is moving; `step(dt)` is public so tests run without timers. Modulation steps by `modStep` per press and stays (reset to 0 when the mode ends).

## MIDI

`navigator.requestMIDIAccess({sysex:false})` runs only when the person switches MIDI on (a gesture). On startup with MIDI already on it connects only if `permissions.query({name:'midi'})` is `granted`; otherwise state `needs-permission` and a Connect button (`omni:midi-connect-request`). Errors map to `unsupported` (Safari / iOS), `denied` (SecurityError / NotAllowedError) and `failed`, all surfaced as text in `omni:midi-state`. Notes are keyed `m<deviceIndex>:<channel>:<note>` for the bus. Disabling a device, hot-unplug, MIDI off and destroy release that device's notes. Hostile bytes cannot throw (`parseMidiMessage` returns `null`). MIDI `timeStamp` is not used (notes are played when they arrive).

## Storage and events

`omni:expression-typing-v1` stores only values that differ from the defaults. In: `omni:expression-typing-set` `{patch}` / `{merge:{keyOverrides, midiHands, midiDevices}}` / `{reset}` / `{resetKeys}`. Out: `omni:expression-typing-changed {settings}`, `omni:expression-mode {on, source}`, `omni:expression-open`, `omni:expression-octave {octL, octR, last}` (extra, for the keyboards), `omni:music-transport-request {action}`, `omni:midi-state`, `omni:live-instrument-changed {nodeId, label}`. `omni:expression-toggle {on?}` toggles the mode from UI.

## Not verified

No one has heard the audio, no real MIDI hardware or phone was used, Firefox's MIDI add-on flow and Safari's absence are from documentation, not tests.
