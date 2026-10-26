# 15. OmniDJ

Applies to: V195 · Status: written from the V195 code; the controls, the grid editor and the audio chain were checked in jsdom and in software-GL Chromium with a generated test tone · Real devices: not verified.

[Guide index](README.md) · Previous: [Sound nodes](12_Sound_Nodes.md)

The **OmniDJ** is a small mixing desk with **six decks**. Each deck plays one track from the same library the OmniMusicPlayer uses, and has its own volume, a three-band EQ, cue, mute, loop, a pitch fader and a jog wheel. Between the decks there is a crossfader and a master volume.

## Open it

- **Ribbon**: Home > Tools > **OmniDJ**. It opens the window `⟐OmniDJ`.
- **OmniStarLight** search: open it (Ctrl/Cmd+K, or Q in builds where that key is rebound) and type *dj*.
- **In an OmniExpression quadrant**: the quadrant's header menu lists **OmniDJ** (when the OmniExpression panel with quadrants is present). It is the same DJ, with the same decks and the same layout.

Closing the window or switching the quadrant does **not** stop the music, the same as the OmniMusicPlayer. Press **Stop all** in the DJ's Audio box to pause every deck.

## The six circles

The top row holds **six big rotating circles**, one per deck (`dj-circle-1` to `dj-circle-6`).

- A circle **spins while its deck plays**, faster when you push the pitch fader up (200 degrees a second at normal speed).
- The ring around it shows how far into the track you are; the number is the deck, the small time is the position.
- **Drag a circle round** to scrub: one full turn moves the track by 1.8 seconds. The mouse wheel or the left/right arrow keys nudge it. **Double-click** returns to the cue point.
- A circle that has no track just turns like a knob.

## A channel strip (one per deck)

| Control | What it does |
|---|---|
| **Load** | Opens a list of the 15 OmniMusicPlayer library slots, "Open an audio file", and "Empty this deck". The title shows next to it. |
| **Play** | Plays or pauses. |
| **CUE** | While paused: sets the cue point where you are. While playing: jumps back to the cue point and pauses. |
| **M** | Mutes the channel (the track keeps running). |
| **loop** | Repeats the whole track. |
| **A / T / B** | Which side of the crossfader the channel is on. **T** (thru) ignores the crossfader. |
| **LOW / MID / HIGH** | Three EQ knobs: left = cut (all the way = off), centre click = flat, right = up to +12 dB. |
| **Volume fader** | With a level meter beside it. |
| **Pitch fader** | Speed of the deck, plus or minus 8 percent. The pitch changes with the speed (no key lock). |

Further down: the **crossfader** (A on the left, B on the right; the *Curve* button switches between *constant power*, which keeps the loudness even, and *linear*), the **master** knob, and the **Audio** box (state of the audio, **Enable audio**, **Stop all**).

Every knob and fader works with the mouse (drag up and down, the mouse wheel, **double-click to reset**), with touch, and with the keyboard when it has focus (arrow keys, Page Up and Page Down, Home, End, Delete to reset). A small tick and a short buzz tell you a button was pressed or a knob passed its centre notch; both can be switched off with **Tick** and **Buzz** in the DJ's top bar (Tick, the sound, is off at the start; Buzz only works on phones that can vibrate).

## Rearranging: the grid

Everything sits on a grid of 24 by 14 cells. Press **Edit** in the top bar:

- **Drag** a component to move it. **Drag the corner triangle** to resize it. Touch works the same.
- **Snap** keeps components on whole cells; switch it off for free placement.
- **▲ / ▼** bring a component in front of the others or send it behind. Components may overlap and stack.
- **✕** hides a component. **+ Add** brings hidden ones back.
- With the keyboard: Tab to a component, arrows move it, Shift + arrows resize it, Page Up and Page Down stack it, Delete hides it.
- **Reset layout** (press twice) puts everything back. **Done** returns to play mode, where the controls work and nothing can be dragged by accident.

Your layout is saved in this browser (`omni:dj-layout-v1`) and shared by the window and the quadrant. If the saved data is damaged, the default layout is used. On a narrow screen the DJ keeps a minimum size and scrolls instead of squeezing the controls.

## Where the tracks come from

The library is the OmniMusicPlayer's 15 slots (stored in your browser). Add tracks there to keep them. A file you open from the DJ's Load menu is used for this session only and is not saved to the library.

## Not done yet

- **No beat sync, beat grid, BPM detection, key lock, hot cues, sample loops or effects.**
- **Scratching is approximate.** The jog wheel moves the playback position; it does not play reversed or stretched audio, so a fast scratch is a series of jumps, not a record's sound. Only forward playback speeds exist.
- **No headphone cue**: there is one output, so CUE is a cue point, not a pre-listen.
- **No recording** of the mix, and no MIDI or hardware controller input for the DJ.
- The mixer settings (faders, EQ) are not remembered after a reload; only the layout is.
- The six circles are flat today. They are meant to become faces of a cube in the 3D space later (see `docs/architecture/OMNIDJ_DESIGN.md`).
- Audio and touch were not tried on real devices or with real ears; the sound was checked by reading an analyser in a browser.

## If there is no sound

Browsers keep audio locked until you touch the page. Press **Enable audio** in the Audio box, or any control in the DJ. If a track from the library will not load, check that the slot is filled in the OmniMusicPlayer. See also [Troubleshooting](11_Troubleshooting.md).
