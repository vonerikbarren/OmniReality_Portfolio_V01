# 13. Expression typing

Applies to: V195 · Status: written from the V195 code (keys, mode, live instrument, MIDI, settings window); not tried by ear and not tried with a real MIDI keyboard · Real devices: not verified.

[Guide index](README.md) · Previous: [Sound nodes](12_Sound_Nodes.md)

**Expression typing** turns your computer keyboard into a two-handed instrument. The left half of the keyboard is the left hand, the right half is the right hand, and the keys play notes in the sound of a **sound node** (see [Sound nodes](12_Sound_Nodes.md)). While it is on, the keys no longer move you or open panels, so you can play freely. A **MIDI keyboard** works too (Chrome, Edge and Opera; not Safari or iPhone).

## Start and stop (numbered)

1. Press **Ctrl+K** (**Cmd+K** on a Mac). It works anywhere, even while you are typing in a text box. A note in the OmniNotify box says "Expression typing ON".
2. Play the keys (table below). With nothing selected you hear a soft sine. Select a sound node and the keys play **that node's sound** (see "Instrument").
3. Press **Esc** (or **Ctrl/Cmd+K** again) to leave. All notes stop. Clicking into a text box also leaves the mode, so you can type there.

While the mode is on, **every key is taken by it** except Esc and the browser's own shortcuts (Ctrl/Cmd with R, L, W, T, N, Q, C, V ..., F5, F11, F12). That means W A S D, Q (search), Enter (Start HUD), the ` terminal key and the others do nothing until you leave.

## The two hands

The keys are read by **physical position**, so it is the same on any keyboard language.

| Row | Left hand (octave 3) | Right hand (octave 4) |
|---|---|---|
| Black keys | W E . R T Y = C# D# . F# G# A# | U I . O P [ = C# D# . F# G# A# |
| White keys (home row) | A S D F G = C D E F G | J K L ; ' = C D E F G |
| Bottom row | Z X C V = G A B C | M , . / = G A B C |

The bottom row repeats the **G** of the home row. Pressing both G keys together is one note (it ends when you release the last one). Octave 3 starts at C3 (MIDI note 48), octave 4 at C4 (60). A key whose note would be outside MIDI 0 to 127 stays silent.

## Octave

**B** moves the octave down, **N** up. Which hand moves is a setting: **both** (default), **left**, **right**, or **last** (the hand that played the latest note). The octave goes from -1 to 9. A key you are holding keeps its pitch and ends correctly when you let go. You can turn the octave keys off in the settings.

## Wheels, sustain and transport

| Keys | What happens |
|---|---|
| **Space** (hold) | Sustain pedal: notes keep sounding after you release the keys until you release Space |
| **Left Shift + Up / Down** | Modulation (a gentle vibrato) up / down by the "Modulation step" (default 0.1). It stays where you leave it |
| **Right Shift + Up / Down** | Pitch bend up / down (default range 2 semitones). Letting go makes it spring back to the middle in a short time (default 150 ms) |
| **Right Shift + Left / Right** | Second axis, which moves the sound left / right (pan). Springs back too |
| **Enter** | Asks the music transport to play / stop |
| **Ctrl/Cmd + Enter** | Asks the music transport to record |

Enter and Ctrl/Cmd+Enter only send a request (`omni:music-transport-request`). What they start depends on a music node and sequencer being present; if none is, nothing happens. Keys held down by the keyboard repeat are ignored, so a held key plays one note.

## Instrument

The sound the keys play (the "instrument") is the **sound of a node**:

1. The **selected node** that carries a sound (setting "Follow the selected node", on by default).
2. Otherwise the node chosen in the settings ("Instrument node").
3. Otherwise a **soft sine**.

A node's sound edits are heard on the next note. Notes use the node's envelope (attack, release), filter, effects and so on; the key sets the pitch and how hard it was played sets the loudness. The node's own base note is replaced by the key.

## MIDI keyboards

Turn on **Use MIDI** in the settings window (or Admin > UI Settings > Expression typing). The browser then asks permission. It is asked only then, never at startup.

| Supported | Notes |
|---|---|
| Notes on / off (note on with velocity 0 counts as off), velocity | Loudness follows how hard you press |
| Pitch bend wheel | Same range setting as the bend keys |
| CC1 modulation wheel, CC64 sustain pedal, CC11 expression | CC120 / CC123 (all notes off) also work |
| Program change | Ignored |

Each MIDI **channel** plays as a hand: channel 1 = left, channel 2 = right, the others = no hand (X). You can listen to one channel only, switch each **device** on or off, and plug a device in while the app runs (it appears by itself).

| Browser | Web MIDI |
|---|---|
| Chrome, Edge, Opera (computer), Chrome on Android | Works |
| Firefox | Needs a small site-permission add-on that the browser offers; not checked here |
| Safari, every browser on iPhone / iPad | **Not available.** The settings say so. Use the computer keys or the on-screen keyboards |

If you block the permission, the settings show how to allow it again. A page needs a secure address (https or localhost) for MIDI.

## The settings window

Open **Admin** (left drawer) > **OmniExpressionTypingSettings**, or ribbon **Home > Tools > Expression settings**, or the **Open settings** button in Admin > UI Settings > Expression typing.

| Section | What you can set |
|---|---|
| Typing | Octave keys on / off; which hand they move; base octave of each hand; modulation step; pitch bend range; spring-back time; key hints |
| Instrument | Follow the selected node; the instrument node when nothing is selected |
| MIDI keyboard | Use MIDI; the devices found (each on / off); channel; channel as hand |
| Key map | A table of the 28 note keys: type a different **semitone** (above the hand's C) to move a key; the note name follows; a reset button per key and one for all |

Everything applies at once and is saved in this browser (`omni:expression-typing-v1`). **Reset everything** restores the defaults.

## Phone vs desktop

Computer keys need a keyboard. On a phone use a Bluetooth keyboard, a MIDI keyboard (Android Chrome), or the on-screen keyboards of the OmniExpression panel.

Planned (not available yet): none of the items above; the OmniExpression panel, the BeatPad and the music node are separate V195 parts.
