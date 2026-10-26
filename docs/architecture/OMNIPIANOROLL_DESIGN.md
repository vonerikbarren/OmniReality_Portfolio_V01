# OmniPianoRoll (V198)

Applies to: V198 · Status: built (one track of a MusicNode); verified in jsdom and in software-GL Chromium (desktop 1280x720, phone 390x844) with a stand-in for the note engine · Real devices: not verified.

## Purpose
Edit the notes of ONE track of a MusicNode like in a DAW: draw, move, resize, select, copy, transpose, velocity lane, zoom, scale. It replaces nothing: the step grid and the older compact roll lane stay; every track gets a `Grid | Roll` switch in `ui/OmniSequencerView.js` and the roll takes the lane's place.

## Existing equivalents (reused)
| Need | Existing piece | How |
|---|---|---|
| Pattern data, undo, persistence | `systems/OmniMusicNodes.js` store (`getMusic`, `beginStroke` / `endStroke`, `undo` / `redo`, `commit`) | the roll writes ONLY through it (new verb `replaceEvents`), so the grid buttons, the roll and the panel share one undo stack |
| Hearing a note | `systems/OmniSequencer.js` `preview()` (calls `SoundEngine.playNote` with the track's instrument) | key strip and note audition |
| Playhead | `OmniSequencer.getPosition()` / `state` / `mode` and `omni:music-transport` | a DOM line, no per-frame canvas redraw |
| Note names | `utils/OmniMusicModel.js` / `OmniSoundModel.js` | labels |

## Files
| File | Role |
|---|---|
| `utils/OmniPianoRollMath.js` | PURE: view (`makeView`), pixel <-> step / pitch, scroll clamp, zoom about an anchor, snap grid sizes, hit testing (`hitNote` body / right / left), rubber band, `clampMove`, `dragDelta`, `resizeRight` / `resizeLeft`, velocity lane, grid lines, scale masks, `snapToScale` |
| `utils/OmniMusicModel.js` | `eventsToNotes`, `notesToEvents` (overlap policy), `notesInRange`, `transposeEvents`, `snapStep`, `startToStepOffset`, `patternLengthSteps` / `patternLengthBars`, `gateMaxFor`, gate cap raised |
| `ui/OmniPianoRoll.js` | the component: 2D canvas + DOM toolbar, pointer / wheel / keyboard, selection, commits, playhead |
| `ui/OmniSequencerView.js` | the Grid or Roll switch, prefs, mounting / unmounting rolls, calling `roll.update(dt)` from its frame loop |
| `systems/OmniMusicNodes.js` | `replaceEvents(id, trackId, events)`, `omni:music-node-duplicate`, `MUSIC_NODES_MAX` |

## Data model decisions
- **Gate unit stays steps.** The cap moved from 4 to the pattern length (`min(256, stepsPerBar x bars)`, `gateMaxFor`). No version bump: V195 data (gate <= 4) sanitizes to identical values, `v` stays 1, `sanitizeMusic` is still idempotent. A V198 pattern with a long gate opened in V195 is clamped to 4 there (nothing else breaks).
- **Note = event view.** `{ start (steps, float = step + offset), length (= gate), midi, velocity, prob }`. A start on a half step is stored as step + offset +0.5 (offset range +-0.5); `startToStepOffset` picks the step by rounding, so `eventsToNotes -> notesToEvents` is exact for every sanitized event (offset +-0.5 may swap to the neighbouring step; same sound).
- **Overlap policy "trim".** Two notes of the same pitch never overlap in storage: a later note starting inside an earlier one SHORTENS the earlier one; the same start replaces it; a trim below the minimum gate drops the earlier note. Different pitches overlap freely. A note may run past the pattern end (it wraps when the pattern loops); the roll itself never lets you resize past the end (`resizeRight` clamps), `clipEnd` is available to callers.
- **Event cap 4096 per track** unchanged (`notesToEvents` keeps the first 4096 by time).

## Scheduler
`OmniSequencer` needed one change: the duration of a note is `min(gate x stepSeconds, time to the pattern end)` when **Loop is off** (the transport ends with the pattern, so the tail would otherwise be cut by `stop()`); with Loop on a long note crosses the loop point exactly like a V195 note with gate 4. Recording clamps a held key to `gateMaxFor` instead of 4. Public events (`omni:music-transport`, `omni:music-step`, ...) are unchanged.

## Editing flow
1. A gesture takes a snapshot `base` of the notes (with ids).
2. Every pointer move computes the result from `base` + the delta (never from the previous move), so dragging back restores trimmed neighbours.
3. `_commit(notes, stroke)` normalises starts, runs `notesToEvents`, writes `replaceEvents`; the store sanitizes and announces `omni:music-data-changed {reason:'steps'}`.
4. The roll listens to that event and rebuilds its notes from the store, keeping the ids (and so the selection) of notes at the same `start:midi`. After an undo that moves notes back, the old selection is gone by design.
5. The first real change of a gesture calls `beginStroke` (lazy), `pointerup` calls `endStroke`: one undo step per gesture, no empty steps for a click that changed nothing.

## Rendering
One canvas (DPI aware, max 2x). Drawn only when `invalidate()` was called (data, view, selection, tool, theme, size) and at most once per animation frame; nothing is drawn while the window is closed (`opts.active`). The playhead is a DOM element moved with a transform from `update(delta)`, throttled to 30 fps, and only while the sequencer plays this node. Colours come from the theme CSS variables (`--omni-theme-*`), re-read on `omni:theme-changed`.

## Input
Pointer events with capture. One pointer: the tool (Draw, Select, Erase, Pan). Two pointers: pinch zoom + pan. Right button and a 450 ms long press (touch / pen, no movement) delete a note. Wheel: scroll, Shift = sideways, Ctrl/Cmd = zoom (a trackpad pinch arrives as Ctrl+wheel), Alt = row zoom. The canvas has `touch-action: none` (all gestures are ours); the rest of the panel scrolls normally.

## Prefs
`localStorage 'omni:sequencer-view-v1'` = `{ roll: { 'nodeId|trackId': true }, pr: { snap, key, scale, snapScale, tool, paint, follow, zx, zy } }`. Whitelisted on load (hostile / broken JSON falls back). Read / write failures are ignored (private mode).

## Duplicate
`omni:music-node-duplicate { nodeId, select? }` -> `detail.out { ok, nodeId, sourceId }` or `{ ok:false, code, error }` with `no-node`, `not-music`, `node-cap` (64 music nodes), `failed`. Deep sanitized copy of `data.music`, label + ' copy' (40 chars), placed one plate depth (1.4) behind the original, further if taken; own undo stack; the original is untouched. `createMusicNode` respects the same cap.

## Not built / ideas
Ghost notes of other tracks, chord stamps, quantize-selected, a scale-degree view, MIDI file import / export (see OMNIMUSICNODE_DESIGN), per-note probability and offset in the roll (the note editor of the grid still has them), multi-track roll.
