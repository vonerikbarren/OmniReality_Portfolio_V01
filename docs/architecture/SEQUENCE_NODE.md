# Sequence Node — What's Built, What's Deliberately Deferred

"A PowerPoint in 3D — not slides, sequences: places in space and time,
from a perspective. A narrative." Captured here so the real scope
built tonight (V146) is clear, and so everything discussed but not yet
built has a real home to resume from — not lost, not silently dropped.

## Built in V146 — the Presentation tier

- Any node, any geometry, can become a **Sequence Node** via a new
  toggle in its Inspector panel (`systems/OmniInspector.js`'s
  `_sequenceOptionsHTML`/`_wireSequenceOptions`).
- "What it changes to" is drawn, not picked from a menu — an edge
  between two Sequence Nodes in ⟐N's existing PATH mode. One outgoing
  edge at a time; drawing a new one replaces the old target
  (`_connectNodes` in `systems/OmniNode.js`).
- The transition edge renders in its own amber/dashed look
  (`SEQUENCE_EDGE_STYLE`) so a presentation path is visually distinct
  from an ordinary connection on sight.
- Turning the toggle on applies a wireframe look once, as the
  node's initial/unbuilt state ("utilize a wireframe for the initial
  build" — direct request).
- Each Sequence Node has a **camera mode**: `focus` (default — orbit
  stays suspended on arrival, the scripted "presenter talking to
  camera" framing, right for the first real use case: tutorials) or
  `free` (orbit hands back immediately, user can look around while
  still "at" that step).
- `systems/OmniPresenter.js` auto-loads the chain the moment it's
  drawn (`omni:sequence-updated`) or on page load from storage
  (`_bootstrapSequenceChain`) — no manual "build a sequence" step
  needed for this case, though the presenter's existing manual-build
  tools (+Add, Add by ID) still work for sequences assembled by hand.

## Discussed, real, explicitly deferred

Everything below came out of the same conversation and is worth
building — not rejected, just not tonight's scope. Each one changes
real structure, so building it should be its own deliberate pass, not
folded in silently.

### Two tiers: Presentation vs. Expression
Presentation (what's built) is the static, single-chain case.
**Expression** is its more complex sibling — more core nodes, closer
to OmniPlayer/OmniUser in behavior, branching rather than strictly
linear. Likely means a Sequence Node's `cameraMode`/`sequenceNext`-style
fields grow a second, richer mode rather than Expression being an
unrelated system. Branching itself (see below) is probably the real
fork between the two tiers, not a separate node type.

### Branching — "both options"
Right now `_connectNodes` enforces at most one outgoing sequence edge.
The person's answer when asked user-driven vs. rule-driven branching:
**both** — the user should be able to build either kind. This means,
when Expression is built: Sequence Nodes need to support more than one
outgoing edge, a way to mark a node's branch choice as user-selectable
(presented to the viewer, who picks) vs. rule-driven (resolved by some
condition — an Essence Data truth-state, an OmniValue state, etc.),
and OmniPresenter's linear "walk the chain" logic needs a real decision
point instead of always taking the only edge.

### Per-node camera mode, confirmed as just two states
Clarified directly: not a spectrum of "levels," just **Focus** (locked
on the content/presenter, the tutorial case — "it's almost as if it's
me, inside the circle, communicating directly to you") and **Free**
(orbit as it already works today). This matches what's already built —
no change needed here, just recorded as confirmed rather than assumed.

### The path line as visible, interactive scenery
A literal line through the sequence, with the Sequence Nodes sitting on
it as points — toggleable, clickable (click a node on the line to jump
into that sequence). Partially present today in spirit (the sequence
edges already render, distinctly styled) but not yet a dedicated,
toggleable "show the presentation path" feature, and clicking a node
in the scene doesn't yet jump the presenter to it directly (today it
only does that in the Presenter panel's own list, or in ADD mode).

### Recursive nesting — the interdimensional-highway model
The clearest framing given: a sequence can contain its own nested
sequence, the way getting off a highway onto a ramp puts you on a new,
smaller "highway" that's still its own complete path — and the same
move works in the other direction, zooming **out** from a sequence to
the larger structure that contains it (highway → state → country →
world), "scalar, spatial, and temporal, relative to the perspective
you're looking through." Concretely:
- **In** = containment — a Sequence Node holds its own child sequence,
  entered by clicking it (echoes the existing Domain/Space `.attach()`
  containment system, likely the right mechanism to build this on top
  of rather than inventing a new one).
- **Out** = the same relationship read upward — zooming out of a
  sequence reveals the parent sequence/structure it's one step of.
- Capped intentionally at **3 levels in and 3 out** for v1, not
  infinite, even though the person noted it could recurse to the nth
  degree in principle.
- For now, entering a nested sequence is **observation only** — no
  interaction with its contents yet; that's an explicitly later step.
- Whether entering a child sequence hides the parent or overlays it
  while the parent stays visible: answered **"wise to have both"** —
  i.e., support both, likely as a toggle, not a forced single choice.
- A related, unresolved aside worth keeping on record: the person
  raised whether pacing/time itself might scale with nesting depth (a
  relativity-flavored "it speeds up the more in you go") — noted as a
  real idea, not a commitment, since it was offered with "I'm not
  sure."

### Sequence Group
Still needed as its own lightweight container (chain-shaped: at most
one outgoing/incoming sequence edge per member, tracks its own start
node) — not the existing Group Node, which is order-agnostic. Not
built yet; the single-chain mechanic works today without it because
OmniPresenter derives the chain directly from the edges, but a formal
Sequence Group becomes necessary once nesting and branching exist and
something needs to answer "which sequence is this node even part of."

## Status

The Presentation-tier mechanic above is real, working code as of V146.
Everything in "discussed, deferred" is a genuine next step, not a
maybe — resume from whichever section is wanted next.
