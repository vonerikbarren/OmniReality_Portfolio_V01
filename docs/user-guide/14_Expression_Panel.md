# 14. The Expression panel, keyboards and BeatPad

Applies to: V195 · Status: written from the V195 code and its jsdom tests on 2026-10-13; looked at in a desktop-size and a phone-size browser window · Real devices: not verified.

[Guide index](README.md) · Previous: [Sound nodes](12_Sound_Nodes.md)

**OmniExpression** is the panel where you play. Opened at first it looks like **just a keyboard**: a left-hand block and a right-hand block, drawn like the computer keys that play them. Maximize the window and it turns into **four quadrants** (like the Start HUD), each showing something you choose: a keyboard, the BeatPad, a mixer and more. **OmniBeatPad** is a grid of 16 pads that you can also open on its own.

## Open the keyboard (numbered)

1. Open the ribbon, **Home** tab, **Tools** group, and press **Expression**. (OmniStarLight, Ctrl/Cmd+K, finds "OmniExpression keyboard" too.)
2. Press the keys on screen with the mouse or your fingers. Several fingers play several notes. Slide a finger over the keys to glide from note to note.
3. The harder you press (a pen or a screen that senses pressure) or the lower on the key you press, the louder the note. A plain mouse or touch screen uses the position on the key.
4. Each hand has an **Oct** readout with **−** and **+** to move that keyboard one octave. The key labels show the computer key (for example **A**) and the note (for example **C3**).
5. **SUS** is the sustain lamp (tap it to switch sustain on or off). **BEND** and **MOD** show the pitch bend and modulation.

The keys also **light up when you play on the computer keyboard or a MIDI keyboard**, because everything goes through one input.

## Maximize: the four quadrants

Press the window's maximize button (next to minimize and close). The keyboard becomes four glass panels inside the corner brackets and split lines of the Start HUD:

| Quadrant | Shows at first |
|---|---|
| Top left | OmniDJ (shows a note that it is not available until it is built) |
| Top right | The BeatPad |
| Bottom left | Left-hand keyboard |
| Bottom right | Right-hand keyboard |

Every quadrant has a **header with a drop-down**. Choose what it shows: keyboard (left or right hand), BeatPad, **Mixer (placeholder)**, and whatever else exists (OmniDJ, the step sequencer). The choice is remembered. Restore the window size and you get the keyboard again. If a choice is not available yet the quadrant shows a short note and fills itself in as soon as it exists.

**Mixer (placeholder):** six vertical faders with mute (M) and solo (S). They work and are saved, but they are not connected to the OmniMusicPlayer audio yet.

## Split and Join

**Split** (in the window header, desktop only) closes the window and opens **two windows**: one for the left hand, one for the right. Move them wherever you like. **Join** (in either window) puts them back into one. The state and the places of the two windows are remembered. On a phone the panel is a bottom sheet and Split is not offered.

## OmniBeatPad (16 pads)

Open it from **Home > Tools > BeatPad**, or pick **BeatPad** in a quadrant. The grid is always 4 by 4. The bottom-left pad is note 36 (like a drum machine).

| Control | What it does |
|---|---|
| Tap a pad | Plays it, with a flash. Where you touch the pad sets the loudness (top soft, bottom hard) |
| Keys 1-4, Q-R, A-F, Z-V | Play the pads (top row to bottom row), **only while the pad grid has focus** and Expression typing mode is off |
| **Edit**, or a long press on a pad | Edit mode: tap a pad to choose it; the editor shows label, colour, what it plays, mode, choke group, volume and a **Test pad** button |
| Plays | **Pad note only**, **A note**, **A sound node** (pick one of your sound nodes) or **A sample slot** (1 to 15 of the OmniMusicPlayer library) |
| Mode | **One-shot** (a short hit), **Hold** (sounds while held), **Toggle loop** (first tap starts, next tap stops) |
| Choke group | Pads in the same group cut each other off (like an open and a closed hi-hat) |
| Kit | Loads a preset into all 16 pads: GM drums, Chromatic notes, Empty kit, Sound nodes |
| Stop | Silences every pad, loops included |

Pads bound to a sound node start that node's sound. If your scene has no sound node, the pad still plays its note.

## A name changed: OmniMixer is now OmniMusicPlayer

The panel that was called **OmniMixer** is called **OmniMusicPlayer** in V195 (title, ribbon button **Music player**, drawer, OmniStarLight, the **k** key). It works exactly as before and your saved audio, videos and settings are kept. Searching OmniStarLight for "mixer" still finds it.

## Phone vs desktop

On a phone the panels are bottom sheets and the two hands stack one above the other so the keyboard fits a 390 px wide screen. Maximized, the quadrants stack in a column you can scroll.

Planned (not available yet): the OmniDJ and step-sequencer quadrants (built by other parts of V195); connecting the Mixer quadrant to the real channels; a 3D version of the quadrants (see the [design note](../architecture/OMNIEXPRESSION_PANEL_DESIGN.md)).

## Not verified

Touch and pen pressure on real phones and tablets; multi-touch on real devices; playing a real MIDI keyboard through the panel; the feel of the glide and the key sizes under real fingers.
