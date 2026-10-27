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

## Boost (V220)
Hold the **BOOST** button that appears above the LH or RH pad (it shows with the pad). Your speed is multiplied by the Boost multiplier on top of Speed, eased in and out. Settings: ⟐OmniHands → LH / RH → ⚡ Boost. Terminal: `Omni Boost start hand(lh)`, `Omni Boost stop`, `Omni Boost set hand(lh) key(mult) value(5)`.

Layered effects (any mix):
- **OmniVibration while boosting** — any program, run on you, sustained until the boost ends (attack and release are the Boost's own).
- **Afterimage** — capsule ghosts left behind + speed streaks on the screen.
- **Glitch** — RGB-split bands and a small canvas shudder.
- **multiPointPosition** — while you move, your view blinks between random points scattered around your path. You still arrive at point B; the scatter ends when you stop.
Sustain keeps the boost on for a moment after you let go.

## The LH orb (V221)
Tap **◉ ORB** (beside BOOST above the LH pad) or type `Omni Orb open`. A greyscale sphere of possibility opens: words orbit it (Opportunities, Unknowns, Undefined, Possibilities, ? ...), and the tools in your LH magazine stream into its core. Hover or tap a word or tool for its tooltip; click a tool to load it as your ammo. **Hold the core** to charge, **release** to fire the loaded ammo (the same as the pad's Activation). Edit the words, speed and charge time in ⟐OmniHands → LH → ◉ Orb, or `Omni Orb words value("Maybe, Open, ?")`. The RH, ConsciousHand and OmniHand orbs come later.

**V224 fix:** the BOOST and ◉ ORB buttons did not react to hover or taps (the UI layer lets clicks pass through to the scene and the two buttons did not opt back in). Fixed.

## The orb, explained (V225)
- The white dots spiralling into the core are the **tools in your LH magazine** (Orbit, Anchor, Follow ...), not nodes from your scene. The ringed one is loaded. Click a dot to load that tool.
- The words orbiting on the rings are decoration and tooltips.
- Releasing the core fires the loaded tool at the node you have selected (else the node nearest the screen centre).
- The orb is a **round panel** now. Drag it by the empty rim around the picture; the × at the top closes it.
- **Panel opacity** (⟐OmniHands → LH → ◉ Orb, 0.15 faint to 1 solid) makes the whole orb more or less see-through. `Omni Setting set hands.lh.orbOpacity value(0.5)` does the same.
