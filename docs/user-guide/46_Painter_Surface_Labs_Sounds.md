# 46 · The painter: surfaces, labs, sounds, right hand

[Guide index](README.md)

The painter (Sandbox tab > Painter > **Paint**) now does four more things (V256).

## Paint onto a node (OmniObjectPainter)
Switch the painter to **surface** mode (ribbon **Spray / Surface**, or `Omni Construction set paint(surface)`). Now a drag paints colour onto the surface of the node under your finger or mouse, with a soft round brush.
- `dab(4..96)` is the brush width, `soft(0..1)` is the edge (0 hard, 1 airbrush).
- It paints the nearest node under the pointer. Sprites and text can not be painted.
- **Undo** takes back the last stroke (20 are kept). `Omni Construction clearpaint(id)` gives one node its own look back; with no id, every painted node.
- Paint is **not saved** with the scene yet: it lasts until you reload.

## Labs
A lab is a named brush setup. Built in: Confetti, Stars, Moss, Pebbles, Crayon, Airbrush. Ribbon **Next lab** steps through them, or:
- `Omni Construction lab(Airbrush)` use one · `Omni Construction labs` list
- `Omni Construction savelab(My lab)` save the current brush · `Omni Construction deletelab(My lab) confirm`
Labs never change your hand, sound or volume settings.

## Sounds
Little tones: turning the painter on and off, each spray or dab, the end of a stroke, undo, a full Sandbox, choosing a lab. The colour sets the note and a bigger brush sounds lower. `sound(false)` turns them off, `volume(0..1)` sets the level. (Made with the browser's own synthesizer, so no sound files.)

## Right hand
While the painter is on, the right hand's page-1 tools steer the brush; press again to step again:
- **Color** next colour · **Texture** next shape (spray) or edge softness (surface) · **Material** spray / surface · **DataTypes** ground / air.
`Omni Construction set hand(none)` turns this off. Other hands and the page-2 tools are never touched.
