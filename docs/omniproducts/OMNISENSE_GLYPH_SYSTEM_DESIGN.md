# OmniSense — The Glyph System (OmniGlyph, OmniGlyphics, the Legend Fork, OmniScroll)

A deeper layer under `OMNISENSE_DESIGN.md`'s own short definition
("controls symbols and what they grant access to"). This doc is where
that definition actually gets a mechanism. Everything here is
conceptual — captured from a real design conversation, not built.

## OmniGlyph / OmniGlyphics

**An OmniGlyph** is a voxel- or 3D-space-represented symbol that best
represents a reality — the *sum* of that reality, for whatever
context level is currently being analyzed, regardless of the glyph's
own shape, form, or duration. Every glyph has a duration: a default
state, and state changes between other states. This is explicitly
**not** the same claim as animation — it means *process*. Animation
is one optional *method* a state change can be assigned, not what a
state change inherently is. A transition can be rendered as a hard
cut, a morph, a fade — different methods, same underlying process.
(This is, not coincidentally, close to how D3's own data-join —
enter/update/exit — already works: the process is real and tracked
regardless of whether `.transition()` is ever attached to it.)

**OmniGlyphics** is the ability to read these in-motion glyphs and
decipher a reality group's general meaning or message — a real,
learnable skill, the way reading a candlestick chart's shape is a
real, learnable skill. This only works if the mapping from data to
visual property is fixed and consistent (see "The ambiguity problem,"
below) — otherwise it's motion with no reliable way to decode it.

## The Legend Fork — resolved as internal vs. external, not either/or

Two candidate approaches were raised for how OmniSense's meta-metric
legend should actually work:

- **Fork 1** — collapse functionally-equivalent words across domains
  into one shared symbol. Loop, routine, cycle, circle, rotation —
  not synonyms, but genuinely the same underlying process, described
  differently depending which reality/field you're standing in.
- **Fork 2** — keep science, art, and philosophy's own vocabularies
  fully separate, and only assign a shared, global badge when
  something is *actually, verifiably* true across domains — LIFO and
  FIFO as the real example: genuinely, provably the same concept in
  multiple separate fields, not an approximate mapping.

**Resolution: Fork 1 is the internal engine. Fork 2 is the external,
public-facing claim.** Not a contradiction — two different jobs:

- **Internally**, OmniSense is free to *recognize* that several
  domain-specific words point at a related process — this is a
  private resolution/lookup layer, never surfaced to a user as an
  assertion that the words are interchangeable.
- **Externally**, a shared badge or glyph is only ever actually shown
  to a user once something has been genuinely verified as true across
  the domains it's claimed for — the harder, slower approach, but the
  one that can actually support "community recognition" and become a
  real, joinable movement, since it isn't making claims that don't
  hold up under scrutiny.

The reasoning for why Fork 1 can't be the public-facing system on its
own: collapsing related-but-distinct concepts into one symbol
reintroduces, at the concept layer, the exact ambiguity OmniSense
exists to eliminate at the language layer — the same failure mode as
saying "I hate dogs" without specifying which dogs, which hate, which
version of yourself is doing the hating (see below).

## The ambiguity problem — the actual design target

The founding example, worth keeping verbatim because the precision is
the point: "I hate dogs" is ambiguous on at least three independent
axes at once — **which self** (the current you, a younger, traumatized
you, a continuously-growing you, all of you, to what degree), **which
intensity** (mild dislike vs. genuine loathing), and **which dogs**
(size, origin, literal animals vs. hot dogs vs. mechanical dogs).
Leaving any axis undefined allows misinterpretation — the system's
entire purpose is defining each axis to whatever degree is actually
necessary for complete understanding, no further, no less.

This is explicitly why a reality can hold **multiple contexts at
once** — confirmed directly. A single reality isn't one fixed
meaning; it's a container for however many axes of specification a
given piece of communication actually needs disambiguated.

## Stationary Realities, tunnels, and the grid

Already partly recorded in `architecture/HAND_TOGGLE_CONTROL_DESIGN.md`
(Tiers 1–4 of grabbing a Reality); restated here because the glyph
system depends on it directly.

The floor grid (`modules/OmniFloor.js`) is the same object as the
wall — a perspective transform, not two different builds. Standing
inside a reality, it's the floor beneath you. Retreating toward where
you entered, the same grid becomes a vertical wall-map of the whole
reality, viewable both top-down and as a literal wall you're looking
at. At that distance, every reality on the grid is represented by its
glyph (or a plain cube, sized to however much is actually inside it,
if no glyph exists yet) — this **is** the first real interface for
OmniSense's own definition. A blank cell isn't a placeholder to fill
in later; it's the honest, correct representation of "not yet
understood, not yet defined" — the map's own incompleteness is part
of what it communicates, matching `OmniFloor`'s existing discipline of
only ever building the tiles that actually need to exist.

Each cell on this grid is a **Stationary Reality** — a fixed,
higher-middle-class node: not the fully-enterable deep version of a
reality, and not just a floor tile either, something in between.
Realities connect to each other via **tunnels**, cylinder geometry
nine times out of ten (independently, `OMNI_EXPRESSION_PRESENTER_DESIGN.md`'s
own OmniTime shape vocabulary already calls Cylinder "the Tunnel" —
the same idea arriving twice, on its own). The genuinely sharp part:
**a tunnel is itself a reality, not just a line.** Getting from one
Stationary Reality to another can have multiple distinct
methodologies — the T, walking, biking, an electric scooter, using the
Boston analogy directly — each its own path, "flexible and fixed" at
once. The tunnel is a container for however many of those traversal-
realities actually exist for that specific connection, the same way
an edge in a node-based matrix system can hold more than a fixed
weight.

Reading direction on the grid is deliberately not fixed to one
convention. Chinese/Japanese reading vertically, Arabic reading
right-to-left, are named directly as real precedent — different
regions of the same map may legitimately read in different
directions, as a real property of the surface, not an oversight to
standardize away.

## Sentences as multi-reality, non-linear graphs — the flowchart merge

A single expression — "I hate dogs" was the working example — is not
one reality. It's several Stationary Realities (roughly: the self
being expressed, the intensity, the object), connected non-linearly —
"wherever the next direction of the node comes in," explicitly
compared to how Chinese conveys ideas and expressions rather than a
strictly linear word order.

This is framed directly as a real critique of flowcharts as they
exist today: a flowchart's own nodes and connectors don't communicate
*why* a given node actually matters, and the meaning of the chart as a
whole changes depending on who's reading it — a business person, an
engineer, and a designer looking at the identical flowchart walk away
with genuinely different understandings, because they're reading it
from inside different realities (different contexts/expertise) even
though the diagram itself never changed.

**The proposed merge, stated directly**: flowchart logic (nodes and
directed connections) + D3's own data-visualization aspect + Three.js's
spatial dimensionality — combined not just to let someone *read* which
glyph/reality they're currently in, but to let them **experience**
what's actually inside that glyph, and toggle between the two modes
freely. Reading and experiencing are two real, distinct modes of the
same underlying reality, not one mode with a better camera angle.

## OmniScroll

The name for the far end of this grid/map system: a digital scroll,
built in genuine three-dimensional space rather than as a flat 2D
document. A scroll unrolls in one specific, linear direction when
opened — but here that linearity happens *on a plane* that is itself
the grid, not a single unrolling strip. Operates, at a glance,
"like hieroglyphics in motion" — the glyph layer described above,
viewed as a continuous, traversable surface rather than a fixed
document.

## The founding lore — why this is being built, stated directly

Recorded because it's the actual motivating vision, not a footnote:
this system is described as inspired, in part, by NKO flashcards and
the method of loci — an ancient, real memory technique (place things
at specific points in a mental space, walk through that space to
recall them) — which the person tried once, found lacking, and
resolved years ago to eventually build a genuinely better version of.
That resolution is a real throughline for this entire project, not
just this one system.

The larger ambition, stated directly: creating a new field of study —
explicitly compared to the Maesters in *Game of Thrones*, specialists
whose deep, specific knowledge earned them a genuine voice in
politics and governance, not merely being used as a passive resource.
Framed as a missing piece in real governance today — specialization
that carries real influence, not just utility. OmniGlyphics, as a
real, learnable literacy, is the concrete first step toward that
larger ambition: something legible enough that people who've
struggled to understand this thinking in words might finally
experience it directly, through the OS itself.

## Status

Entirely conceptual — no code, no glyph data model, no actual grid-to-
wall transform, no tunnel-as-reality implementation. This doc exists
so the full depth of this design conversation has one real home,
given how much of it is foundational to what OmniSense, OmniCell, and
the wall-map system are each eventually meant to become.
