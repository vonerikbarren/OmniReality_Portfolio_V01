# 19. Mix nodes (OmniMusicMixNode)

Applies to: V202 · Status: written from the V202 code (the node, the ⟐OmniMix window, the Inspector block, the decks); tested in jsdom with a mock audio context and once in headless Chromium. **Nothing has been heard on a real device yet.**

[Guide index](README.md) · Related: [Sound nodes](12_Sound_Nodes.md), [Song nodes](17_Song_Nodes.md), [Audio library](18_Audio_Library.md), [OmniDJ](15_OmniDJ.md)

## What a mix node is

A **mix node** is a mixing desk you can place in the space. Each **strip** plays one thing: a **sound node**, a **song node** or a clip from the **audio library**. Every strip has a fader, pan, filter, a three-band EQ and two sends (reverb, delay). A **crossfader** blends the strips you put on side **A** with those on side **B** (strips on **T** are not crossfaded). That is the DJ part: you can do a transition by hand, or press a **DJ move** and it is saved as **automation**, so it plays the same way again.

The ladder: **Sound node** (one sound) → **Music node** (a pattern) → **Song node** (a piece) → **Mix node** (several of them together, live).

The node is a small desk: fader caps sit where the strips' faders are, caps brighten with the level while it plays, and the crossfader cap moves.

## Make one

1. Ribbon **Home > Create > Mix node** (or the **Mix** tile of the OmniDraw menu, or search **Mix node** in OmniStarLight). A desk appears in front of you and **⟐OmniMix** opens. If the scene already has song or sound nodes, the desk starts with a strip for each.
2. Add strips with **+ Add strip** (pick audio clip / sound node / song node first), then choose the source on the strip.
3. Press **▶ Play**.

## The desk

| Control | What it does |
|---|---|
| Volume fader + meter | The strip level (a square taper: 0.8 is about -4 dB). The meter shows the live peak. |
| pan / filt | Left-right; a low-pass filter (fully right = open). |
| low / mid / high | EQ, 0.5 = flat, fully left = kill (-48 dB), fully right = +12 dB. |
| rev / dly | How much of the strip goes to the shared reverb / delay. |
| A / T / B | Crossfader side. A fades out as the crossfader goes to B. |
| M / S | Mute / solo. Solo silences every strip that is not soloed. |
| ⟲ | Loop an audio clip. |
| bpm + sync | The strip's own tempo; with sync on the clip is played faster or slower to match the mix tempo. The pitch changes with the speed (there is no time-stretch yet). |
| Master | Volume, limiter, reverb and delay returns. |
| Crossfader | A to B, with a curve: constant-power (even loudness through the middle) or linear. |

**One song at a time:** the song player plays a single song, so only the first song strip sounds; the others say so.

## DJ moves and recording

- **Crossfade → B / → A** moves the crossfader over the seconds in the box, starting at the play position (or 0 when stopped).
- **Fade out / Fade in** and **Filter sweep** do the same for the strip chosen next to them.
- **● Rec** (header, or the Inspector): while the mix plays, every fader you move is written as automation at that time.
- Each moved control has an **automation lane**; **Clear** removes one, **Clear all automation** removes all. (Editing the points by hand is not built yet.)
- **Undo / Redo** cover every edit; a fader drag is one step.

## Inspector

Selecting a mix node shows a **Mix node** block: strips and tempo, **Play / Stop**, **Record**, the mix **tempo**, **Open mixer**.

## Limits

16 strips, 64 automation lanes, 256 points per lane, a mix up to one hour long; tempo 40 to 240. The mix is saved with the node. An audio clip that is missing from the library, or a node that was deleted, gives a warning under the desk and the rest keeps playing.

## What is not here yet

Decks with jog wheels inside the mix (the separate [OmniDJ](15_OmniDJ.md) has them), time-stretch, cue points and loops, exporting the mix as audio, pattern (music node) strips, hand-editing automation points.

## Decks (V202): audio clips get cue points, loops and key lock

A strip that plays an **audio clip** from the library is a **deck**. Below its sliders you will find:

| Control | What it does |
|---|---|
| Waveform | The clip. A white line is the playhead, an orange band the loop, a green line the cue, pink marks the hot cues. **Click it** to jump there. |
| CUE / set | **set** stores the cue at the playhead (it snaps to the beat if the clip has a bpm). **CUE** jumps back to it. |
| ❚❚ / ▶ | Pause and play this deck only (the rest of the mix keeps going). |
| 1 2 3 4 | Hot cues. An empty one stores the playhead; a stored one jumps there. **Shift-click** clears it; **×** clears all. |
| ⟲ 1/2 1 2 4 8 | A loop of that many beats starting on the beat you are in. ⟲ turns it on or off. **÷2** halves it, **×2** doubles it, **◂ ▸** move it by its own length. |
| tap | Tap the beat three or more times: the clip's bpm is filled in. |
| grid | Says where the first beat is (press it on beat 1). Cues and loops snap to your grid. |
| pitch | Plus or minus 8 % speed on top of tempo sync. The line under the deck shows the tempo you hear. |
| key | **Key lock**: the speed changes but the pitch stays. It first plays at the right speed with a higher or lower pitch, then swaps to a time-stretched copy after a moment. |
| 0 / → mix | Pitch back to 0 / make the mix tempo this strip's tempo (other strips with sync follow). |

Honest limits: key lock softens drum hits a little when a clip is sped up by more than about 10 %; clips over 10 minutes are not stretched; song and sound strips have no deck; one loop, one cue and four hot cues per strip. Cue, loop and pitch edits are undoable (a pitch drag is one step).
