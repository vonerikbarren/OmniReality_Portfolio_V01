# OmniConstruction: the Painter (V232)

Spray small nodes into the Sandbox by dragging, like a spray can. Everything painted is a normal node in the Sandbox, so Sandbox hide / lock / remix / clear all work on it.

## Use
1. Sandbox tab → **Paint** (🖌). A "Painting" chip appears with Undo and Off.
2. Drag across the scene (mouse or finger). The camera does not turn while the brush is on.
3. **Undo paint** (or the chip's Undo) takes back the last stroke. Esc or Off turns the brush off.

## Brush (Omni commands)
`Omni Construction set shape(box) color(#ff8800) size(.5) radius(1.5) density(3) spacing(.6) jitterColor(.15) mode(ground) rainbow(true)`
- **mode(ground)** sprays on the floor plane at `height()`; **mode(air)** sprays `distance()` in front of the camera.
- `Omni Construction on [brush props]`, `off`, `get`, `undo`.
- The brush is remembered between visits.

## Limits
The Sandbox holds 60 nodes, so a stroke stops with a notice when it is full. Undo a stroke or `Omni Sandbox clear confirm`.
