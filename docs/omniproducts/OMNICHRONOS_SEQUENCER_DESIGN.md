# OmniChronos Sequencer — player, timeline and the node Time property (V172)

Status: built and tested in V172 (jsdom + real Chromium at 1280x720 and 390x844; not tested on a touch device).
Parent document: `OMNICHRONOS_DESIGN.md`.

## What it is

One project timeline measured in **Primary Time seconds**. The playhead is `utils/PrimaryTime.js`; nothing keeps a second clock.
Nodes are placed on the timeline as clips; a clip makes its node appear only while the playhead is inside it, and keyframes
animate chosen properties. The OmniChronos window is a Premiere Pro-style editing window over it; the Inspector gets a
"Time" section so time is a **property of a node**.

## Files

| File | Role |
|---|---|
| `utils/OmniTimeline.js` | Data store + transport, no DOM. Persists to `localStorage['omni:timeline-v1']`. |
| `systems/OmniTimelinePlayer.js` | Module in `main.js` (after OmniChronos). Evaluates every frame, owns the ribbon events. |
| `ui/OmniTimelineView.js` | The timeline widget (ruler, headers, lanes, clips, keyframes, menus, keyboard). |
| `ui/OmniChronos.js` | The window: Program Monitor, selected-clip strip, tabs, Settings (staged save), window chrome. |
| `utils/PrimaryTime.js` | Unchanged API; `play` / `pause` / `setSpeed` now also announce `omni:primarytime-state`. |
| `systems/OmniInspector.js`, `utils/OmniInspectorSections.js` | Section `time` (12 sections). |
| `ui/OmniRibbon.js` | Realities > Chronos group. |

## Data model

- **track** `{id, name, kind:'node'|'marker', muted, locked, solo, open}` (`marker` kind is reserved, unused).
- **clip** `{id, trackId, nodeId, start, duration, inPoint, loop, label, color}`; times in seconds. The clip shows source time
  `[inPoint, inPoint + duration]` at timeline time `[start, start + duration]`; minimum duration one frame (1/30 s).
- **key** `{id, clipId, property, t, value, ease}`; `t` is in clip *source* time (the same axis as `inPoint`), so trimming
  or moving a clip never moves its keys relative to the clip. Ease is the interpolation of the segment that starts at the
  key: `linear`, `easeIn`, `easeOut`, `easeInOut`, `hold`. Before the first key the value is the first key's, after the last the last key's.
- **marker** `{id, t, name, color}`; **workArea** `{in, out}`; view `{pps, scroll}` (zoom 0.01-2400 px/s); `snap`, `loop`, `enabled`.
- Nothing is written into node data, so persistence is identical for OmniNode and NodeLoader nodes; clips keep only the `nodeId`
  (and a label copy), resolved lazily, so a reload that restores nodes later re-attaches them.
- Caps: 64 tracks, 2000 clips, 20000 keys, 1000 markers, 2 MB serialised. Loading sanitises every field (bad numbers, orphans, unknown properties, newer versions are dropped or ignored).

## Evaluation

Each frame (when the playhead moved, the data changed, or a node was missing and is retried every 20 frames):
for every node with at least one clip on an audible track (not muted; if any track is soloed, only soloed tracks),
the clip whose range contains the playhead (latest start wins) is *active*:
node mesh `visible = true`, keyframes evaluated at the clip's source time and written to the mesh. No active clip: `visible = false`.
Nodes with no clip, or whose clips are all on silenced tracks, are never touched.
The first touch records the node's pose (visibility, position, scale, rotation Y, opacity + transparent flag, colour); it is put
back when the clip is deleted, the track is muted, the timeline is disabled, the node is deleted (its clips are removed), Clear Scene runs (clips removed), or the module is destroyed.
**Loop** repeats the key cycle `[inPoint, last key]` for the whole clip duration (a clip with no later key cycles over its own duration).
Allocation-free for numeric properties; colour blends per channel without allocating.

### Keyframe properties and registries
Keyframes are applied directly to the node's `THREE.Mesh`, which *both* registries create and tag with `userData.nodeId`
(the same way `systems/OmniNodeBehavior.js` finds nodes). So every property below works for OmniNode nodes **and** NodeLoader
(Create-System) nodes: `position.x`, `position.y`, `position.z`, `scale` (uniform), `rotation.y` (degrees), `opacity`, `color`.
Not supported: other rotation axes, non-uniform scale, material parameters.
Caveat: they fight another writer of the same value (an active behaviour, auto-rotate, the selection scale pulse).

### Activation vs behaviours
A clip's "activation" is visibility. The behaviour engine skips hidden nodes, so a node's behaviour effectively runs only while it is
visible, but its rest pose is not reset at clip in / out and auto-rotate keeps its angle. A real hook (start / stop a behaviour at clip
boundaries via `omni:node-behavior-set`) is a follow-up (DeveloperQueue 56.1).

## Transport

`seek(t)`, `step(frames)` (pauses, lands on the frame grid, clamps at 0), `setPlaying`, `togglePlay`, `setSpeed` (0.25x-8x in the UI),
`beginScrub / endScrub` (nesting-safe; the last end resumes only if it was playing at the first begin). Work area: while *playing*
through `out` (or, with Loop on and no work area, the last clip end) the playhead wraps to `in` (Loop) or pauses at `out`. Starting
past `out` just plays on; scrubbing never wraps. Primary Time itself still never reverses.

## Events

| Event | Direction |
|---|---|
| `omni:timeline-play-set {playing}` or `{toggle:true}` | in (ribbon, window) |
| `omni:timeline-step {frames}` | in |
| `omni:timeline-seek {t}` | in |
| `omni:timeline-add-selected` | in: adds the node selected in the scene |
| `omni:timeline-marker-add {t?, name?}` | in |
| `omni:timeline-reveal {nodeId}` | in (Inspector > Reveal) |
| `omni:timeline-changed {kind}` | out: `clip`, `track`, `key`, `marker`, `workarea`, `snap`, `loop`, `enabled`, `clear` |
| `omni:timeline-playhead {t}` | out |
| `omni:timeline-selection {clipIds, keyIds, markerIds}` | out (view) |
| `omni:primarytime-state {playing, speed}` | out (PrimaryTime) |

## The window

Desktop: **EDITOR** (docked like Premiere: Program Monitor + selected-clip strip on top, timeline below) and **SETTINGS**.
Phones (<= 700 px): **PLAYER | TIMELINE | SETTINGS**, one at a time. Movable (header), resizable (corner), maximisable, minimisable
(tray) and registered with `WindowManager` as before (`omnichronos`, panel opacity honoured). Timeline edits are live and auto-persist (debounced);
SETTINGS keeps the Admin-style staged 💾 save.
Shortcuts only while the pointer is over the window or focus is inside it (and never while typing in a field): Space, ←/→ (Shift = 1 s), Home/End, I/O, M, C (split), Delete, + / -.
They are captured and stopped before the global handlers in `main.js` (which bind `m`, `c` ...), and unhandled keys pass through.

## Inspector: Time section

Switch **On timeline** (creates a 5 s clip at the playhead on the first unlocked track / removes the node's clips), **Track** (or New track),
**Start**, **Duration** (seconds, timecode beside), **Loop**, a **property** menu with **◇ At playhead** (the key's value is the node's current value, or the clip's own animation at that time),
the clip's key list (jump, edit value, delete), **Reveal on timeline**. Two-way: the section re-renders on `omni:timeline-changed` (unless a field is being edited).

## Out of scope (not built)
The ten future sub-panels (TimeLive, TimeTool, Calendar, Planner, TimeLine, TimeAxisBuilder, Story, Series, Dev), audio, video clips and video-texture sync,
render / export, multi-camera, nested sequences, speed ramping, reverse play, undo / redo, copy / paste of clips, ripple / roll / slip tools, marquee selection.
