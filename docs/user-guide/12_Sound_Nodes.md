# 12. Sound nodes

Applies to: V194 · Status: written from the V194 sound-node code (the node, its window, the Inspector section, Admin options); the exact setting names inside the window come from the sound model and were not re-checked against the merged build · Real devices: not verified.

[Guide index](README.md) · Previous: [Troubleshooting](11_Troubleshooting.md)

A **sound node** is a speaker you can place in the space. It makes a sound (a single note, a pad, a bell, a beat), its glowing bell and rings pulse with what it plays, and it can send out **particles** that move with the sound. **Any node** can also carry a sound: the sound node is just a node that starts with sound already on.

## Make one (numbered)

1. Open the ribbon, **Home** tab, **Create** group, and press **Sound node**. A sound node appears in front of the camera. (OmniStarLight, the Q key, finds it too: "Sound node".)
2. Press **▶ Play** in the Inspector block "Sound node", or open **Home > Tools > Sound settings** and press **Play**.
3. To change the sound, press **Open sound settings** (window **⟐SoundNodeSettings**). Everything is there.

To give an ordinary node a sound: select it, open the Inspector section **Sound** (icon ♪) and switch **Sound** on. Until you switch it on, the node is exactly as before.

## What you see

| Part | What it does |
|---|---|
| Bell | The node's body. Click, drag, delete and colour it like any node. |
| Glowing core | Bigger and brighter when the sound is loud. It breathes slowly when the node is silent. |
| Three rings | Low rings pulse with bass, the middle ring with mids, the top ring with treble. |
| Small ▶ / ❚❚ | ▶ when silent, ❚❚ while it plays. No sign at all when the node's sound is off. |
| Colour | The sound's own colour if you set one, otherwise a colour from the note (the same note in a higher octave has the same colour). |
| Dim | A muted sound is half dim; a node whose sound is off is very dim. |

## The Sound section of the Inspector (every node)

| Control | What it does |
|---|---|
| Sound switch | On gives the node a sound (the default one the first time); off keeps the settings but the node is silent. |
| Presets | Replaces the sound with a ready-made one. Your label, colour and tags stay. |
| Quick controls | The note, the dynamic mark, the volume, loop and positional (spatial) sound. |
| ▶ Play / ■ Stop | Plays or stops this node's sound. |
| 🔊 Mute / 🔇 Unmute | The speaker. It mutes or unmutes **all** sound, not just this node. |
| Open sound settings | Opens ⟐SoundNodeSettings. |

## The window ⟐SoundNodeSettings

It edits the **selected** node and follows your selection. If the selected node has no sound on, the window says so and offers **Enable sound on this node**.

1. **Play**, **Stop** and **Audition 2 s** (plays for two seconds, then stops). **Off** switches the node's sound off. **↶ Undo** takes back the last preset, reset, paste or switch (30 steps).
2. **Presets…** applies a ready-made sound.
3. The **search box** shows only settings whose name or explanation contains your text.
4. **Expand all / Collapse all** open or close the sections. Each section has its own **Reset**.
5. The **?** next to a setting shows what it does in plain words (it is also the tooltip). **Help text** shows all of them.
6. Number settings have a slider, a number box and the unit. Choices are menus. On/off settings are switches. A note is a name plus an octave.
7. **Copy JSON** copies the node's sound and particle settings as text; **Paste JSON** applies text you copied (from this or another node). **Reset all sound** and **Reset all particles** go back to the defaults.

Changes are heard **while it plays**, without a click, and are saved with the node after a moment. The window is resizable and can be maximized like the other windows; on a phone it is a bottom sheet.

## Ideas worth knowing

**Dynamics.** Musicians write loudness as marks, from the quietest to the loudest: **pppp, ppp, pp, p, mp, mf, f, ff, fff, ffff**. Each step is a little louder; pppp is a whisper (about 3% of full level) and ffff is full. You can add or remove volume on top of the mark.

**Sustained.** A sustained sound keeps going until you press Stop, like an organ key held down. Otherwise it plays for its set length.

**Crescendo and decrescendo.** A crescendo gets louder over a set number of seconds (for example from p to ff); a decrescendo gets quieter. You choose the dynamic it starts and ends on, how long it takes, and the curve.

**Loop or iterative play.** *Loop* plays the same sound again and again (a set number of times, or for ever). *Iterative play* repeats it a set number of times with a gap between the repeats, and can step the pitch or the volume on each repeat: a rising step gives an arpeggio or a ladder. Use loop for a drone or a beat, iterative play for a pattern.

**Presets.** Ready-made starting points such as a pad, a pluck, a bell, an organ, a bass, a siren, wind or a drone. Pick one, then change it.

**Spatial (positional) sound.** With positional sound on, the sound comes from the node's place: it is louder when you are near, quieter far away, and moves left and right as you turn. Headphones make this clearest. Turn it off for a sound that is the same everywhere.

**Start.** A sound can wait for you (manual), start when the scene loads, start when you come near, or start when you click it.

**Particles.** A sound node can send out a cloud of points whose count, shape and movement follow the sound's frequencies. Their settings are in the **Particles** sections of the window. Switching a node's particles on for the first time creates their default settings.

## Global sound options (Admin)

Open **⟐Admin > UI Settings > Sound**. Changes apply at once.

| Option | Meaning | Default |
|---|---|---|
| Master volume | How loud everything is, 0 to 1 | 0.8 |
| Speaker | Mutes or unmutes all sound | follows "Mute on phones" |
| Sounds at once | How many sounds may play together, 1 to 32; the oldest stops first | 8 |
| Mute on phones | On a phone-sized screen, sound starts muted until you press the speaker | on |
| Ask before sound | No sound until you press **Enable sound** (once per browser tab) | off |
| Show Enable sound | Shows the small Enable sound button when the browser blocks audio | on |
| Particle limit | The most particles drawn in the whole scene | 20000 |

**Reset sound options** puts them back.

## Phone and autoplay

Browsers do not let a page make sound until you tap or press a key on it once. If a sound tries to start earlier, a small bar appears at the bottom with **Enable sound**; press it (or press ×, then tap anywhere and press Play again). On a phone the sound starts **muted** by default: press the speaker to hear it. If you want a quiet start everywhere, switch "Ask before sound" on.

## Planned (not available yet)

Nothing is planned on this page beyond what the window already lists.

## Not verified

Sound on real phones, with real speakers and headphones; the feel of positional sound; the frame rate with many sound nodes or many particles.
