# 17. Song nodes

Applies to: V198 · Status: written from the V198 song-node code (the node, the ⟐OmniSong timeline window, the Inspector block); tested with the browser-less test suite and one desktop and one phone-sized browser run with a stand-in for the song player and the audio storage · Real devices: not verified.

[Guide index](README.md) · Related: [Sound nodes](12_Sound_Nodes.md), [Music nodes](16_Music_Nodes.md)

## What a song is

Sound nodes make one sound. Music nodes repeat one short **pattern**. A **song node** is the next step: an **arrangement**. It puts patterns (and audio files) in order on a **timeline**, mixes them, and lets you label the parts of the song.

The ladder: **Sound node** (one sound) → **Music node** (a pattern) → **Song node** (a whole piece).

The song node is a flat **record disc** in the space. Its four rings are the first four lanes; a ring segment is lit where that lane has a clip. While the song plays, a bright segment sweeps around the record and the centre label turns. The whole song is saved **with the node** (patterns and audio files are referenced, not copied into it).

## Make one (numbered)

1. Open the ribbon, **Home** tab, **Create** group, and press **Song node**. A song node appears in front of the camera and **⟐OmniSong** opens. (The OmniDraw picker has a **Song** tile ♬; OmniStarLight, Ctrl/Cmd+K, finds "Song node" and "Song editor".)
2. Press **＋ Pattern lane**. A lane appears.
3. In the **library** on the right, press **Add** next to a pattern (a music node). It becomes a **clip** on the lane. You need a music node first: **＋ New** in the library makes one.
4. Press **▶**. The song plays.

The window follows your selection. With no song node selected it says so and offers **＋ Create a song node** and a small **demo song**; it also lists the song nodes of the scene. **Home > Tools > Song editor** opens the window on the selected song node. The Inspector block "Song node" has the transport, the base tempo, the length in bars and **Open song editor**.

## The timeline

| Part | What it does |
|---|---|
| Toolbar | Rewind, **▶ / ⏸**, **■**, **Loop** with its start and end bars, the position (**bar.beat** and **mm:ss**), tempo, time signature, key, zoom − / ＋ / **Fit**, **snap** (1/4 bar, 1/2 bar, 1 bar), Undo / Redo, Split, Duplicate, Add marker, show / hide the library and the master strip |
| Ruler | Bar numbers. **Click** moves the playhead (drag to scrub). **Shift-drag** sets the loop region. **Right click** (or a **long press** on a touch screen) opens a menu: add a section or a marker, set the loop, move the playhead |
| Tempo track | **Click** to add a tempo point, **drag** it up and down to change the bpm, sideways to move it. The first point is the base bpm and cannot be removed. **Double click** or **right click** a point (or press **Delete**) to remove it |
| Lanes | One row per lane. The **lane header is the mixer** (below). The clips are the blocks |
| Zoom | The buttons, **Ctrl/Cmd + mouse wheel**, or a **two-finger pinch** |

The playhead follows the song while it plays and the view scrolls with it.

## Lanes are the mixer

Each lane header has: a **colour**, a **name**, **M**ute and **S**olo, **∿** (automation), **×** (delete the lane), a **volume** fader, **pan**, **reverb send** and **delay send** knobs (drag a knob up or down; **double click** resets it; with a knob focused the arrow keys change it) and a **level meter** that moves while the song plays. A lane that is muted, or not soloed while another is, looks dimmed. A **pattern lane** takes pattern clips; an **audio lane** takes audio clips.

A pattern lane's volume works through the **loudness of the notes** and mute / solo (the notes go through the shared sound engine); an audio lane has a real volume and pan.

## Clips

| Do this | Result |
|---|---|
| **Add** in the library, or **drag** an item onto a lane | A clip at the playhead (Add) or where you drop it (drag) |
| Drag a clip | Moves it. It **snaps** to the grid, and moves across lanes of the same kind |
| Drag the **left or right edge** | Resizes it (the left edge keeps the end) |
| Click a clip | Selects it and opens the **clip bar** |

The clip bar has: **name**, **start**, **length**, **repeat** (how many times the pattern plays one after the other inside the clip), **gain**, **transpose** (pattern clips, in semitones) or **fade in / out** (audio clips), **Split** (cuts at the playhead), **Duplicate**, **Delete**, **Make unique** and **Open in sequencer**. A clip dragged past the end makes the song longer (up to 256 bars).

A **pattern clip** shows a small picture of the notes of its music node. An **audio clip** shows the **waveform**. **Editing the pattern once changes every clip that uses it.** A clip whose pattern or audio file was deleted stays in the song as a hatched **missing** block; nothing crashes.

**Make unique** copies the pattern into a new music node and points just that clip at the copy, so editing it no longer changes the other clips. **Open in sequencer** selects the pattern's music node and opens ⟐OmniSequencer. Double-clicking a pattern clip does the same.

## Sections and markers

Click the thin **band at the top of the ruler** to add a **section** (a labelled colour block such as Intro, Verse, Chorus). A small box opens: **name**, **start**, **length in bars**, a **colour**, **Delete**. Click a section to edit it again. Click a **flag** (marker) in the row under the section band to rename or delete it, or press **⚑** in the toolbar to drop a marker at the playhead. On a phone, the sections are buttons: tap one to jump to it.

## Automation

Press **∿** in a lane header: an **automation row** opens under the lane. Choose the setting with the menu: **volume, pan, filter, reverb send, delay send**. **Click** to add a point, **drag** a point to move it, **right click** (or **Delete**, or double click) to remove it, **Alt+click** a point to switch the segment after it between a smooth line and a **step**. **Clear** removes the curve, **Hide** closes the row. With no points, a dashed line shows the lane's normal value. The master strip has its own **∿** (volume, filter).

## Audio clips

Press **Import…** in the library (or drop audio files anywhere on the window). **WAV, MP3, OGG, M4A and any other file your browser can decode** work; the limit is 40 MB per file. The files stay **on this device** (in the browser's storage), the node stores only their names. If a file cannot be imported the window says why in plain words (not audio, too big, no room left, could not be decoded). Add the file to an **audio lane** like a pattern.

## Master strip

Press **🎚 Master**. **Gain**, **Limiter** (on / off and its threshold in dB: it holds the loudest peaks back so many lanes together do not clip), **reverb** (size, mix), **delay** (time, feedback, mix) and the master level meter.

## Tempo, time signature, key, loop

The base **tempo** is 60 to 240 bpm; tempo points on the tempo track change it along the song. The **time signature** and **key** are labels for you and for the ruler. The **loop** region (start and end bars) repeats while **Loop** is on.

## Undo and shortcuts

**Undo / Redo** keep the last **100** steps; a drag, a knob turn, or a stretch of fader movement is one step. Everything is saved with the node a moment after you change it.

Shortcuts work **while the song window has focus** (click inside it):

| Key | Does |
|---|---|
| **Space** | Play / pause |
| **Delete** (Backspace) | Delete the selected clip, tempo point or automation point |
| **Ctrl/Cmd + Z** | Undo |
| **Ctrl/Cmd + Shift + Z** (or Ctrl + Y) | Redo |
| **Ctrl/Cmd + D** | Duplicate the selected clip |
| **S** | Split the selected clip at the playhead |
| **Esc** | Close a menu or box; deselect the clip |

## Phone

The window is a bottom sheet with a simplified **vertical lane view**: a card per lane with a thin strip of its clips. **Tap a lane** to open its mixer controls (name, volume, pan, reverb, delay, a picker to add a clip, delete). Tap a clip block to select it (the clip bar appears); tap the strip to move the playhead. The transport, tempo, undo / redo and **＋ Lane** are in the toolbar; the library and the master strip are buttons there. The same compact view is available as **quadrant content** "OmniSong" in the maximised OmniExpression panel.

## Limits

32 lanes, 512 clips, 64 sections, 128 markers, 64 tempo points, 64 automation curves of up to 256 points each, 4 to 256 bars, 60 to 240 bpm. Pattern lanes are played through the shared sound engine: the volume of a pattern lane is done with note loudness.

## What is not built (yet)

**Export** (MIDI or WAV file), **recording from the microphone**, **lyrics**, and a **3D experience** of the song (walking through its sections) are not part of this version. There is no time-stretching or pitch-correcting of audio, no plug-ins and no editing with several people at once.
