# 22. Targeting: Z, L and R

Applies to: V207 · Status: written from the V207 code; tested in jsdom with the real Three.js camera maths. **Not yet looked at in a real browser or on a phone.**

[Guide index](README.md) · Related: [Nodes and Inspector](03_Nodes_and_Inspector.md)

## What it is

When you select something, the camera orbits it (the *target*). By default the target sits in the middle of the screen. That is **Z-Targeting**. Two limited modes move it to the side so the other side of the screen is open space for panels or other nodes:

| Mode | Where the target sits | Free space |
|---|---|---|
| **Z** (centre) | middle of the screen (as always) | around it |
| **L** (9 o'clock) | left side | the right side of the HUD |
| **R** (3 o'clock) | right side | the left side of the HUD |

Only **one mode is on at a time**.

## How to use it

1. Open **⟐OmniTargeting > OmniTargetingSettings** (or search *targeting* in OmniStarLight).
2. Under **Targeting mode** choose **Z**, **L** or **R**. **Side distance** (20 to 80 %) is how far from the centre towards the edge the target sits; 50 % puts it a quarter of the screen from the edge.
3. Select a node. The view slides so the node sits on that side. Open panels on the free side.

## Leaving the mode

- Clicking **empty 3D space** (not a panel, not a node) lets go of the target, and the view eases back to the centre.
- **Escape** does the same.
- Clicking a **panel** or anything on the HUD does **not** leave.
- Choosing **Z** returns to the centre at once.

## Good to know

- The mode is remembered in this browser.
- Only the picture is shifted; moving, selecting and clicking nodes work as before, wherever the target sits.
