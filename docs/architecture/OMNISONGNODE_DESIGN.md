# OmniSongNode: design (draft 1, 2026-10-13)

Owner decisions: audio clips may be WAV, MP3 or any file the browser decodes; DOM first, 3D experience after; MIDI + WAV export is enough for the first version (export is NOT in V198).

Ladder: SoundNode (sound, V194) < MusicNode (pattern, V195) < SongNode (arrangement). A SongNode is a node kind `songNode` with `node.data.song`.

Core rule: a clip REFERENCES a MusicNode (pattern) or an audio asset by id; edit the pattern once and every use updates; "Make unique" copies; a deleted pattern leaves a visible "missing" clip, never a crash.

Audio clips: file picker / drag and drop, decoded by `decodeAudioData` (browser decides support), blobs in IndexedDB, node stores ids only; size caps; waveform peaks cached.

Playback: many patterns at once, lookahead scheduler on the engine clock, tempo map, loop region, solo / mute, automation, lane buses into a master limiter.

UI (DOM first): timeline with bar ruler, lanes, clips (drag, resize, split, duplicate, repeat), section labels, loop region, playhead, zoom, transport, lane headers as the mixer, clip library, automation lane, master strip. Touch friendly. Undo / redo.

Stopping line: arrangement, mix, import (export later). NOT: warping / time-stretch, comping, plugins, MP3 encoding, multi-user editing.

Later stages: lyrics + markers + metadata; MIDI file and real-time WAV export; mic recording; 3D experience (sections as places along an OmniPathNode).
Full text with data model: see docs/architecture/OMNISONG_CONTRACT.md.

## UI as built (V198)

- Node: `songNode` is an extra kind (data `{nodeKind:'songNode', song}`); mesh in `utils/OmniSongNodeMesh.js` (record disc, 4 rings x 24 segments as one InstancedMesh, label spins while playing; no per-frame allocation, early return when song and head are unchanged). Runtime in `systems/OmniSongNodes.js`: create, transport, undo/redo (immutable store, cap 100, 900 ms coalesce, `beginStroke`/`endStroke` makes a drag one step), persistence debounced 300 ms, cleanup on node delete.
- Window: `ui/OmniSongPanel.js` (class A panel, nav `⟐OmniSong`, quadrant content `song`) hosts `ui/OmniSongView.js`; drawing helpers in `ui/OmniSongDraw.js`; Inspector block in `ui/OmniSongInspector.js`; `ui/OmniSongModules.js` `addSongModules(base, omniNode)` is the single main.js hook.
- Layout: one scroller, sticky lane headers (the mixer) and sticky-top ruler; ruler, tempo and automation are sticky canvases redrawn by scroll offset; lane grids are CSS gradients; playhead is one transformed element; clips are absolute DOM blocks with canvas previews and are virtualized by viewport.
- Phone / compact (<=700 px): one card per lane with a thin clip strip; tapping expands the lane mixer.
- Audio assets are loaded by a defensive dynamic import; without them the panel opens and import reports it is unavailable.
- UI prefs only in `localStorage` key `omni:song-panel-v1`; song data lives in the node.
