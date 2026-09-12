# OmniSystem Node Identification & Fast Travel

Nothing in this document is built yet - this captures the naming and
fast-travel design agreed on before writing any of it.

## The naming scheme

Every OmniSystem node gets an id shaped like:

```
{system}{Letter}{Number}_{iteration}
```

Modeled directly on the spreadsheet/Excel cell-reference convention
(column letter, row number) - chosen deliberately because, per the
reasoning behind it, that's genuinely how these positions are already
being thought about, not just a borrowed metaphor.

- **`{system}`** - which formation the node belongs to: `cross`,
  `ring`, `sphere`, `grid`, etc. This alone is what keeps multiple
  systems coexisting in the same reality from colliding - a `crossA1`
  and a `ringA1` are never the same id.
- **`{Letter}{Number}`** - the position within that system. What this
  actually *means* is genuinely different per system, confirmed
  individually rather than assumed to be one universal rule:
  - **Cross** - the letter is structural, one per arm axis:
    Up=A, Down=B, Left=C, Right=D, Forward=E, Back=F. The center node
    isn't an arm at all, so it gets its own reserved key rather than
    being forced into the letter sequence (e.g. `cross-CORE`, exact
    string TBD when built).
  - **Ring** - no natural letter grouping exists with only one ring,
    so a single shared letter `A`, numbered sequentially around it:
    `ringA1` ... `ringAN`. The letter is reserved for a real, future
    purpose: if concentric rings are ever added, the letter is what
    separates ring 1 from ring 2.
  - **Sphere** - same reasoning as Ring: single shared letter `A`,
    numbered in the same order the Fibonacci formula already
    generates them (top to bottom): `sphereA1` ... `sphereAN`.
  - **Grid** - the one system where the letter/number pairing is
    structural in the fullest sense: real column and row. See the
    Grid system's own section (in OMNISYSTEM_DESIGN.md) for the shape
    that pairing takes there.
- **`{iteration}`** - a trailing disambiguator (`_01`, `_02`, ...).
  For the current fixed-shape systems this will almost always just be
  `_01`, since each position is only ever occupied once - but it's
  there as a permanent safety net, so if a position is ever
  regenerated, or a future system allows more than one node per
  named slot, ids still never collide.

## Fast travel - the node selector

The existing "Take Me There" travel mechanic in
`systems/OmniInspector.js` (`_goToObject`) already does the hard part
correctly - it faces the target dead-on by the end of the tween,
regardless of the camera's angle beforehand, and it's generic: it
works for any node OmniInspector opens for, regardless of which
system created it. What's missing isn't the travel itself, it's how
you *find* the node to travel to without first spotting it visually
in the scene.

**The new piece**: a toggleable 2D overlay listing every node's
generated id, laid out as a grid (not an infinitely cascading
dropdown) so it stays usable as systems grow into the dozens or
hundreds of nodes. Selecting an entry - by typing to filter, or
clicking a grid cell directly - triggers the same existing travel
mechanic.

- **Layout**: kept linear/uniform rather than shaped to match each
  system's own geometry, per direct instruction - simpler and more
  consistent across very different formation shapes.
- **Type-in field**: filters by the node's generated id (`ringA5`,
  not the raw internal database id) as you type, live.
- **Multiple systems coexisting**: solved entirely by the naming
  scheme above - a pooled list showing every node across every active
  system is unambiguous by construction, no per-system filter needed
  as a prerequisite.
- **At scale**: once a system holds many dozens of nodes, filtering
  by typed text is the actual mechanism that keeps this fast - the
  grid layout keeps it visually organized, but text filtering is what
  keeps it fast.

## Noted for later, not built now

- **Fade-away / focus mode** - while actively working on one system,
  other systems in the scene should dim and physically move away,
  similar in spirit to how macOS's multi-space switching recedes
  everything but the active space. A real, wanted feature; not part
  of this pass.
- **OmniSense-driven space gridification** - once OmniSense exists,
  the entire space itself becomes gridded, with the ability to choose
  the size of systems placed within it. Noted for whenever OmniSense
  work actually begins; not relevant to the node-selector work above.

## Status

Purely conceptual - naming scheme and fast-travel design agreed on,
nothing implemented yet.
