# 16. Music nodes

Applies to: V195 · Status: written from the V195 music-node code (the node, the sequencer window, recording, the Inspector block); tested with the browser-less test suite and one desktop and one phone-sized browser run with a stand-in for the note engine · Real devices: not verified.

[Guide index](README.md) · Related: [Sound nodes](12_Sound_Nodes.md)

A **music node** is a **step sequencer** you can place in the space. It holds a short repeating pattern: rows of notes (tracks) laid out on a grid of steps. Its flat plate shows the pattern as little blocks, lights the step that is playing and flashes a block whenever a note sounds. The pattern is saved **with the node**.

## Make one (numbered)

1. Open the ribbon, **Home** tab, **Create** group, and press **Music node**. A music node appears in front of the camera. (OmniStarLight, Ctrl/Cmd+K, finds it too: "Music node".)
2. Press **Home > Sound > Sequencer** (or **Open sequencer** in the Inspector block "Music node"). The window **⟐OmniSequencer** opens and edits the selected music node.
3. Tap steps in the grid to switch notes on. Press **▶ Play**.

The window follows your selection. With no music node selected it says so and offers **＋ Create a music node**. It also has a menu of every music node in the scene.

## The step grid

Each track is a row: **steps are the columns** (16 by default, one bar).

| Do this | Result |
|---|---|
| Tap an empty step | A note at the track's note (the **Note** picker under the gear ⚙) |
| Tap a note | Switches it off |
| Drag across empty steps | Paints a run of notes (one Undo step) |
| Drag a note **up or down**, or hold it (long press) and drag | Sets its **velocity** (how hard it is played). The note editor opens under the tracks |
| Drag **sideways** over notes | Erases them |

The **note editor** shows the selected note's **velocity**, **length** (in steps), **chance** (the probability that it plays on each pass) and **offset** (a little early or late). Keyboard: focus a lane, arrows move, **Enter** or **Space** toggles a note, **Delete** removes the selected note.

### Piano roll

Press **♪ Roll** (under the gear ⚙) to turn a track into a compact **piano roll**: one row per semitone with a key column, scrolling up and down. Tap an empty cell to paint a note (it sounds once so you hear the pitch), tap a note to select it, drag sideways on a note to set its length, **Delete** to remove it. Painting across cells paints a run.

## Tracks and instruments

Every track has: a red **arm** dot, a name, an **instrument**, **M**ute and **S**olo. Under the gear: the track **note**, grid or roll, **volume**, **pan**, **transpose** (semitones), move up / down, duplicate and remove. A pattern has up to 16 tracks.

The **instrument** is either **Default sine** (a soft sine tone) or one of the **sound nodes** in the scene: the notes then play with that node's sound settings (its waveform, envelope, effects). Build a sound in ⟐SoundNodeSettings, then pick it here. If you delete that sound node the track falls back to the default sine and the picker shows "missing".

The **armed** track is where recording goes and what the pattern presets, **Clear**, **Copy** and **Paste** act on. Working on a lane arms it. **Pattern presets** write a ready-made pattern into the armed track: four on the floor, backbeat, offbeat / eighth / sixteenth hats, Euclidean 5, arpeggio up and down, bassline and chord stabs.

## Tempo, swing and length

| Setting | Meaning |
|---|---|
| Tempo | 20 to 300 beats per minute. Heard at once while playing |
| Swing | 0 to 0.75: every second step is late by that fraction of a step (0.5 is a shuffle) |
| Steps / bar | 4 to 32 steps in a bar |
| Bars | 1 to 8 bars. 8 bars of 32 steps is the most (256 steps) |
| Step length | 1/4, 1/8, 1/16 or 1/32: how long ONE step is (1/16 = a sixteenth note) |
| Master | The loudness of the whole pattern |
| Loop | On: repeats. Off: plays once and stops |
| Metronome | A click on every beat while playing (accent on the bar) |

If you shorten the pattern, notes beyond the new end are cut off and the window tells you how many; **Undo** brings them back.

## Recording

Press **● Rec**. It records what you play on the **computer keys** (in the OmniExpression typing mode), **MIDI**, the **touch keyboards** and the **BeatPad** into the **armed** track.

1. **Count-in**: with a count-in of 1 to 4 bars (a setting), clicks play first, then the pattern starts looping and your notes are written. Notes played during the count-in are ignored.
2. **Quantize recording** (on by default) snaps each note to the **Grid** (1/4 to 1/32). Off: the note keeps its exact timing as an offset inside the step.
3. The length you hold a key becomes the note's length.
4. **Overdub** (on by default) adds to the track. Off: the armed track is cleared when the take starts.
5. Press **● Rec** again to finish; playback goes on. **■ Stop** stops everything.
6. **↶ Take** takes the whole recording back in one go (only while nothing else was edited after it). **↶ / ↷** are the normal Undo and Redo (60 steps); a whole recording, a paint stroke or a velocity drag is one step.

**Step record** (**⏭ Step**): no clock. Each note you play is written to the **next step** of the armed track and the cursor moves on; notes played together become a chord. **Rest** skips a step, **◀ Back** moves back. Press **⏭ Step** again to end.

The recorded pitch is what you played minus the track's transpose, so the track sounds exactly like what you played.

## Keys

With the OmniExpression typing mode on, **Enter** plays / stops the transport and **Cmd/Ctrl+Enter** starts / ends recording (they send the request `omni:music-transport-request`). Only one music node plays at a time; starting another stops the first.

## Phone

The window is a bottom sheet. Steps are at least 26 px wide with 44 px tall rows; a long pattern scrolls sideways in its lane, the piano roll scrolls up and down. Sound starts muted on phones: the window shows an **Enable sound** button when sound is muted.

## Limits

16 tracks, 4096 notes per track, 256 steps, tempo 20 to 300, one transport at a time. A hidden browser tab slows its timers, so the sequencer looks 1.5 seconds ahead then (a tempo change can lag by that much). Pan is passed to the sound engine; whether it is heard depends on the engine.

## Planned (not available yet)

| Idea | State |
|---|---|
| Deeper piano roll editing (select several notes, move, copy, scale, draw velocity lanes) | not built; the roll paints, selects one note and sets its length |
| **Audio clips** (record or drop a sound and place it on a track) | not built |
| **MIDI file export** (.mid) | not built |
| **Arrangement** (several patterns in a song order, sections) | not built |
| **Spatial arrangement** (placing patterns and music nodes in the space as a song) | not built; see `docs/architecture/OMNIMUSICNODE_DESIGN.md` |

## Not verified

The real audio engine's note playback with a music node (it is built to the shared engine contract and was tested with a stand-in), timing accuracy and glitches on real phones and speakers, recording latency from real keyboards and MIDI devices, the frame rate with many music nodes.
