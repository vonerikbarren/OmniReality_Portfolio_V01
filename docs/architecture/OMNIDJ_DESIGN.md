# OmniDJ: six circles, a grid organizer and six decks (V195)

Applies to: V195 · Status: built; jsdom and software-GL Chromium checked · Real devices, real ears, real DJ hardware: not verified.

## What it is

A mixing desk of **six decks**, shown as **six rotating circles** (jog wheels) with a channel strip under each, a crossfader and a master. It exists in two places at once: as the registry content `dj` for an OmniExpression quadrant (`utils/OmniQuadrantRegistry.js`) and as the class-A window `⟐OmniDJ`. Both are the same code (`ui/OmniDJ.js`) on the same audio (`systems/OmniDJDecks.js`).

## Files

| File | Role |
|---|---|
| `utils/OmniGridMath.js` | pure: snap, clamp, move, resize, z-order, layout serialize / sanitize (versioned, hostile-input safe) |
| `ui/OmniGridLayout.js` | the reusable MultiTimer-style grid organizer + `createClickFeel` (tick and buzz) |
| `utils/OmniDJModel.js` | pure: channel state sanitizers, EQ dB map, crossfader curves, pitch, jog maths, track reference check |
| `systems/OmniDJDecks.js` | six decks on Web Audio; shared singleton `getDJDecks()` |
| `ui/OmniDJControls.js` | `DJKnob`, `DJFader`, `DJButton`, `DJCircle`: independent components (`mount`, `destroy`, `setValue`) |
| `ui/OmniDJ.js` | builds the components, wires them to the decks, the frame loop, the load menu, `mountDJ` |
| `ui/OmniDJPanel.js`, `ui/OmniDJModules.js` | the window; registration (`registerQuadrantContent('dj', ...)`) |

## The audio

```
audio element -> MediaElementSource (once per element) -> low shelf 250 Hz -> mid peak 1 kHz -> high shelf 4 kHz
              -> channel gain (fader, mute) -> crossfader gain (A / Thru / B) -> master gain -> limiter -> destination
              channel gain -> analyser (meter)                        limiter -> analyser (master meter)
```

- **Separate from the other audio.** The OmniMusicPlayer plays through its own `<audio>` elements, untouched. The SoundNode engine keeps its own graph. The decks use their own gains.
- **Context.** `SoundEngine.getContext()` is used only if it already exists and is running; the DJ never creates or resumes it (that would unlock the SoundNodes' audio as a side effect). Otherwise the DJ makes its own context, suspended until a user gesture (`unlock()` runs on the first pointer or key press in the DJ and in `play()`; a blocked `play()` is remembered and retried on the next gesture).
- **Sources.** `{slot: 1..15}` reads the OmniMusicPlayer library (`createWallpaperStore('omnimixer-audio', 15)`, the same IndexedDB); `{url}` (http, https, blob, data:audio only) and Blob / File are also accepted. Internal ids keep the old OmniMixer names.
- **Free again.** `unload()` pauses, drops the source and revokes the object URL; `destroy()` also disconnects the nodes and closes an own context (never a shared one).
- **CPU.** One analyser per channel (fft 256) is only read when the UI asks, 30 times a second, and only while the DJ is visible; no work happens in the decks file per frame. Six `<audio>` decodes plus a limiter are the real cost.
- **Events.** `omni:dj-state` `{deck, why, state}` on load, play, pause, cue, parameter changes (not per frame).
- **Jog.** Scrubbing pauses the element silently, seeks on each pointer move (1.8 s per turn), and resumes on release. It is a position control, not a scratch.
- **Curves.** `constant-power` (default) and `linear`. A channel set to THRU is not crossfaded.

## The grid organizer

Components live in cells (default 24 x 14) and are placed in percent of their host, so the layout scales. Edit mode adds an overlay per component for drag, corner resize, front / back, hide; play mode removes it, so controls cannot be dragged by accident. Layout JSON `{v:1, cols, rows, snap, click:{sound,haptic}, items:{id:{x,y,w,h,z,hidden}}}` in `omni:dj-layout-v1`; unknown ids, `__proto__`, wrong types and out-of-range numbers are dropped or clamped, a wrong version or damaged JSON gives the defaults. The organizer does not know about the DJ: its first client happens to be the DJ.

## Spatial equivalence (for later)

The six circles may become **the six faces of a cube** in the 3D space, one circle per face.

- Each circle is already an independent component with the id `dj-circle-N` and plain data: `circle.data = {id, index, angle, velocity, progress, level, playing, loaded, time}`. A 3D face needs only those numbers (and `decks.getDeck(n)`, `decks.getLevel(n)`): rotate a disc by `angle`, advance it by `velocity`, light it by `level`.
- Input maps to the same calls: a drag on a face becomes `decks.scrubBegin(n)`, `decks.nudge(n, seconds)` (1.8 s per turn), `decks.scrubEnd(n)`; a double tap becomes `decks.seek(n, cue)`.
- The audio can be spatial without change in the decks: a PannerNode between the channel gain and the crossfader gain, positioned at the face.
- Constraint kept in mind: no new WebGL context; the cube would be meshes in the existing scene, or CSS 3D transforms of the same DOM circles.

### Open questions for the owner

1. Is the cube one object in the space (a node kind) or a view of the DJ that opens in front of the camera?
2. Does a face keep playing when you walk away from the cube? Should the sound get quieter with distance (spatial) or stay at the DJ level?
3. Should the other controls (EQ, faders) also appear on the cube, or only the six circles with the rest staying in the 2D window?
4. Which gesture scratches on a cube: pointer drag on a face, a hand tunnel move, or both?
5. Should one cube hold the six decks of one DJ, or may several cubes share the six decks?

## Open questions for the owner (now)

1. **Click sound default.** Tick is off at the start (unexpected sound is a common complaint); haptic buzz is on. Switch the default?
2. **Mixer values are not saved** across a reload, only the layout. Should faders and EQ be remembered (a new key such as `omni:dj-mixer-v1`)?
3. **Library writes.** A file opened from the Load menu is not saved to the OmniMusicPlayer library. Should it be offered a free slot?
4. **Default assign** is THRU for every deck so a single track just plays. Would you rather have the decks alternate A / B?
5. **Pitch range** is 8 percent per deck (the model supports 6 / 8 / 16 / 50 percent, no UI yet). Which ranges should the UI offer, and key lock?
6. **Stop on close.** Closing the window keeps the music going (like the OmniMusicPlayer). Prefer stopping?
7. **Beat sync, BPM, hot cues, effects, recording, MIDI:** which comes first? (MIDI input is another agent's area in V195.)

## Not done

Beat sync and detection, key lock, hot cues, loops with in and out, effects, headphone pre-listen (one output only), recording, hardware control, remembered mixer values, an accurate scratch sound.
