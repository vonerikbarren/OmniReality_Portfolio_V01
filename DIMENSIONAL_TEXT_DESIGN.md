# Dimensional Text — Design Doc

Captures the full vision for Dimensional Text nodes. The foundation
(see "Status" below) is built; everything else here is documented for
later, not implemented yet.

## Origin

Introduced while scoping OmniKeys' "Use/Delivery mode" — typing with a
dimensional keyboard shouldn't just insert plain characters into some
arbitrary text input; it should create a real, spatial reality of text.
"The whole reality of text and all of its transformational realities
based off of domain."

## The foundation (built)

- A new node type, living in the **same genealogy system as `OmniDraw`**
  (same `_nodes` registry, same `parentId` root/parent/child model) —
  not a parallel system. `geometry: 'DimensionalText'` is just another
  value alongside `BoxGeometry`, `SphereGeometry`, etc.
- Rendered as a **`THREE.Sprite`**, not a `PlaneGeometry` mesh and
  definitely not real 3D letterforms (`TextGeometry`). This was an
  explicit, repeated priority — performance first. A sprite is the
  cheapest possible option: minimal quad geometry, natively billboarded
  by the renderer with no manual `lookAt` bookkeeping needed.
- Text itself is drawn once onto a `<canvas>` and uploaded as a
  `CanvasTexture` — the same technique already used elsewhere in this
  project (Inspector's info-plane, the wallpaper sphere), not
  reinvented for this.
- The sprite's size is derived from the actual measured text width —
  "extends with the text," per the brief — not a fixed box.
- Basic transform properties (position/rotation/scale/color) come for
  free, since it's a normal node in the existing system — same
  Inspector fields as any other node.

## What's explicitly NOT built yet

### "Text comes alive" — the transformational/comic-book system

The real creative vision: text that transforms based on how it's
composed — "saying big with smaller font means something," a phrase
that sequentially shifts each letter from caps to lowercase as a
communicative device, comic-book-style dynamic typography. This is a
whole expressive system, not a single feature — treat it as its own
design pass when it's time, likely needing:

- A real animation/timeline system driving per-character or per-word
  property changes over time, not just two static keyframes.
- Some vocabulary for what different transformations *mean*
  ("big → small" implies something; what does "fast → slow" imply?) —
  this is explicitly something the person wants to define themselves
  over time, discovering their own "reality" of communication through
  play, not something to prescribe now.

### The Sequence system — fields only, no playback yet

OmniKeys' Sequence mode captures a **start** state and an **end**
state per key (font size, case, opacity, color) — this is real, saved
data now. What's NOT built: any actual interpolation/playback between
those two states. Right now they're just two static snapshots sitting
in storage. When this gets built, open questions:

- What triggers the transition — time-based on creation? Proximity?
  User interaction (walking toward the text, looking at it)?
- Is it a one-shot transition, a loop, or reversible (ping-pong)?
- Per-character stagger (each letter transitions slightly offset from
  the next, comic-book style) vs. the whole string transitioning
  uniformly at once?

### Sound / FX attachment

Users should be able to attach music or sound effects to a piece of
Dimensional Text (and, per the original OmniKeyboard doc, to individual
keys generally). Not built — no audio-attachment system exists yet for
any node type in this project, text or otherwise. Worth checking
whether `utils/SoundManager.js`'s existing infrastructure is a
reasonable foundation before building something new.

### Multi-axis composition — textX / textY / textZ

"I would like there to be more than one axis... this way they can
write in any form." Normal text reads along one line; the ask is for
composition along any of the three spatial axes, not just a fixed
left-to-right baseline. Not built. Likely needs its own authoring UI
(probably in the Dimensional Text node's Inspector) for choosing which
axis a given string flows along, since three sprites/canvases
oriented along X/Y/Z respectively is a very different rendering
problem than the current single flat sprite.

### Keys storing a full Dimensional Text node (not just a plain string)

Explicitly deferred by choice, not oversight — for now, a key's saved
value is plain text (a macro), the same as the original OmniKeyboard
design. Once the transformation/sound/multi-axis systems above exist,
it may make sense for a key to store a whole crafted "reality"
(sequence + sound + axis choice) rather than just a string. Revisit
once those systems exist to attach.

## Status

- **Foundation** (sprite + canvas-texture rendering, genealogy
  integration, basic transform properties): **built** — see
  `systems/OmniNode.js`'s `_buildTextSprite`/`_updateTextSprite`.
- **Sequence fields** (start/end data capture via OmniKeys' Sequence
  mode): **built** — no playback yet.
- Everything else on this page: **not built**, documented only.
