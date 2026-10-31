# 42 — Vibration: beat landing, song sync, eases (V245)

**Beat lands at** (per vibration, ⟐OmniVibration > Edit this vibration): where in the motion the beat falls. It looks at the FIRST channel.
- Ground: the beat hits when the body is on the floor. Apex: in the air, at the top. Middle: halfway up. "Start of the loop" is the old behaviour.
- The small number after it moves the motion a little later (+) or earlier (-), in beats (-0.5 to 0.5), for a feel that is slightly ahead of or behind the beat.

**Tempo from**: "The BPM above" (typed; set Timing to Beat) or "The playing song": the vibration follows the song's beat position (so a late start, a seek or a tempo change stays in time) and keeps the last tempo if the song stops. If no song has played, it runs at the typed BPM.

**Wave: ease**: one hump per beat (floor, apex, floor) where the rise follows a GSAP-named ease: linear, power1-4, sine, expo, circ, back, elastic, bounce, each .in / .out / .inOut. power2.out is a good jump (fast up, slow at the top).

Commands: `Omni Vibration start target(user) program(bounce) sync(song) land(apex) offset(0.1) [bpm(120)]`.

**Wave: curve (V246)** — draw the motion yourself. Choose wave "curve" on a channel: it starts as a copy of the wave it replaces. In the editor: drag a point to move it, tap empty space to add one, select a point and press Delete (or the Delete point button) to remove it. The two ends are one point of the loop, so they move together, up and down only. **Snap** (off, 1/4, 1/8, 1/16) makes points jump to a grid for stepwise edits. The yellow dashed line is where the BEAT falls (shown when "Beat lands at" is not "Start of the loop") and it follows your edits. Up to 16 points; smooth between them.

**Beat follows this channel**: the small radio button under each channel picks which channel the beat landing is measured on (default: the first).

Remember to Save as new (or Save changes) before pressing Start: Start plays the saved vibration.

## Bending the curve with handles (V254)

In the curve editor, tap a point to select it. Two round handles appear on either side. Drag one to bend that side of the curve into a smooth Bezier. With **Mirror** on, the other handle turns the opposite way so the joint stays smooth; turn it off to make a sharp corner.

- **Smooth** draws handles on every point at once, a quick way to round off a drawn curve.
- **Straighten** removes the handles of the selected point (or of all points when none is selected).
- A point with no handles yet shows a small grab spot a little to each side of it.
- Curves you drew before V254 play exactly as they did: a segment with no handles keeps the old soft ease.
