# 6. Chronos, Player and Timeline

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Tunnels and Axes](05_Tunnels_and_Axes.md) · Next: [Ribbon, Notify and Dock](07_Ribbon_Notify_and_Dock.md)

**Primary Time** is the app's clock. It starts running when the app starts and the seconds counter restarts on every reload. The **timeline** is a list of **tracks** holding **clips** (a node shown for a while) with **keyframes** (values at moments). The **player** applies it to your nodes.

## Open it

- Window: drawer ⟐OmniChronos, or ribbon Realities > Chronos > Chronos.
- Ribbon Chronos buttons (Play, Step ◀, Step ▶, To start, Add node, Marker) work even with the window closed.

Desktop tabs: EDITOR (Program Monitor above, Timeline below) and SETTINGS. Phone: PLAYER, TIMELINE, SETTINGS.

## Put a node on the timeline

1. Select a node.
2. In the timeline toolbar choose it in "Add node…" or press "＋ Selected" (or use the Inspector Time section's "On timeline").
3. A clip appears. Drag it to move it (also between tracks); drag its edges to trim. It snaps at 8 px; the "⌁ Snap" button turns that off.
4. Add keyframes: choose a property in the toolbar, move the playhead, press "◇ Key". Or double-click a sub-lane inside a clip.

Inside a clip the node is visible and its keyframes (position, scale, rotation Y, opacity, colour) are blended. Outside it, the node is hidden. If you delete the clip, mute the track or disable the timeline, the node comes back. Muted tracks are ignored; a soloed track wins. Overlapping clips: the one that started last wins.

## Transport

⇤ start, ◂ back, ▶/❚❚ play/pause, ▸ forward, ⇥ end, ↻ loop, speed (0.25x to 8x), I and O (work area in/out), ⚑ marker. The monitor shows timecode, clock, "Tunnel height %", and "Active: …" or "No clips yet — add a node in the TIMELINE".

## Timeline toolbar and mouse

| Control | Does |
|---|---|
| ✂ Split | Cut the clip at the playhead |
| ⧉ / 🗑 | Duplicate / delete |
| ＋ Track | New track |
| − ＋ ⤢ | Zoom out, in, fit |
| Track header | Double-click renames; M mute, S solo, L lock; ▸ expands keyframe lanes |
| Shift+click | Select several clips |
| Ruler drag | Scrub |
| Right-click clip | Split at playhead, Duplicate, Loop, Select node in scene, Delete |
| Right-click keyframe | Ease (linear, easeIn, easeOut, easeInOut, hold), Delete |
| Right-click ruler | Add marker here, Set work area in/out here, Clear work area; on a marker: Go to marker, Rename…, Delete marker |
| Right-click track | Rename, Add track, Delete track and its clips |
| Ctrl/Cmd + wheel | Zoom |
| Shift + wheel | Pan |
| Two-finger pinch | Zoom (touch) |

## Keys (only while the pointer is over the Chronos window, or focus is inside it)

| Key | Does |
|---|---|
| Space | Play / pause |
| ← / → | One frame back / forward (Shift: one second) |
| Home / End | Work-area start / end, or project start / end |
| I / O | Set work area in / out |
| M | Marker |
| C | Split |
| Delete / Backspace | Delete selection |
| + / = and - | Zoom |
| Escape | Clear selection or close menu |

While you hover the window these keys are taken, so the global **m** (mini map) and **c** (back to landing) do not fire.

## SETTINGS tab

Staged: nothing applies until you press 💾. Options: Tunnel Enabled, Z-axis Mode, Transparency, Time Format (military or ampm).

## Limits

30 frames per second; shortest clip 1/30 s; zoom 0.01 to 2400 px per second; 64 tracks, 2000 clips, 20000 keyframes, 1000 markers; 2 MB saved. The timeline is saved in your browser.
