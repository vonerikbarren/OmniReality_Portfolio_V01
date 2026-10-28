# OmniNotifyOfHands (V235)

A small **circle panel** for each hand that repeats whatever the hand's orb is saying, plus a one-line state.

## What it shows
- **Main text** – the orb's hover text (word + its description) or its last message ("Fired.").
- **State line** – ammo loaded, orb speed, words chosen, orb open/closed.

## Where it sits
- Lower hands (LH, RH): **above the movement pad** (12 o'clock) and **beside the tools menu** (9 o'clock for RH; mirrored to 3 o'clock for LH).
- Upper hands: just below the pad.
- Always kept inside the window.

## Panel behaviour
- **Drag** anywhere on the circle to move it (position is remembered).
- **Grip** on the lower-right rim resizes it; it stays a circle (96–320 px).
- **–** button minimises it to a small dot; tap the dot to restore.
- **Double-click** resets it to its default spot.

## Setting
⟐OmniHands → ⦿ Orb-it → "Notify circle": `orb` (default, only while the hand's orb is open), `always`, or `off`.

## Notes
It has its own drag/resize/minimise chrome and is not registered with the Panel Tray. Class name: `OmniNotifyOfHands`, element id `omni-notify-of-hands-<hand>`; the circle is general-purpose, so other state options can be added later.
