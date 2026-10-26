# OmniVibration (V216)

Looped, rhythmic motion for **you** and for **any node**: bouncing with an object, dancing with the user. Open it from the ribbon (〰), from OmniStarLight ("vibration"), or by the nav item ⟐OmniVibration.

## Using it
1. **Move**: choose *You* or the selected node.
2. **Vibration**: Bounce, Hop, Sway, Pulse, Shake, Float, Dance, or one of yours.
3. **Sustain**: seconds to keep going (0 = until you stop it). **Attack** eases it in, **Release** eases it out after Stop, so the motion carries on for a moment after you let go.
4. **Start**. **Stop (release)** fades it out, **Stop now** snaps back. Several vibrations on one target add together.

## What a vibration is
A loop of *channels*. Each channel moves one thing (position x/y/z, rotation x/y/z, scale, glow) with a wave (sine, tri, saw, square, pulse, bounce, steps), a size, a speed multiplier and a phase. Timing is either **Free** (cycles per second) or **Beat** (BPM, ready for OmniMusicMix to drive later). **Swing** pushes every second beat late, so the loop is uneven but still repeats. **steps** loops your own list of values (-1 to 1), eased between, for patterns that are not a plain wave. Keep speed multipliers to simple ratios (0.5, 1, 1.5, 2) so the loop repeats exactly.

Edit under "Edit this vibration". Built-ins are copied, never overwritten; your own are saved on this device.

## On you
A view effect only: the camera and the avatar capsule move (bob, sway, turn, squash, glow). Your real position never changes, and the avatar's follow camera is not fooled into letting go.

## On nodes
Added on top of where the node is, and taken away exactly afterwards. Drag a vibrating node and it keeps vibrating around its new place. Saved positions and node behaviours use the node's real place, so a bounce is never baked in.

## For builders
`window.dispatchEvent(new CustomEvent('omni:vibration-start', { detail: { target: 'user' | nodeId, programId: 'dance', hold: 3, attack: 0.1, release: 1 } }))` and `omni:vibration-stop { target | runId, immediate }`. Service: `Extra.SERVICES.vibration` (start, stop, stopAll, runs, programs, saveProgram). Next build: the LH/RH Boost button starts a vibration and sustains it after a dash.
