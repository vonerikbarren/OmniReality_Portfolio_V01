# Music-Reactive Panels ("Timestone" concept)

Nothing in this document is built. Captures a brainstorm.

## The idea

Every panel gets a "slot" — a hook into whatever's currently playing
through OmniMixer — that can light up the panel's own border in a
color/pattern reacting to the music. Two tiers proposed:

- **Regular content**: a generic, RGB-store-light-style reactive
  glow - colors shifting with the music the way a cheap consumer LED
  strip does, no special meaning attached.
- **OmniExpression-specific panels**: reserved for something more
  intentional than a generic light show - left explicitly undefined
  for now rather than guessed at.

## The Zelda Skyward Sword Timestone framing

A strong, clarifying metaphor worth keeping attached to this idea
directly: in that game, the Timeshift Stone doesn't just decorate a
space, it changes what STATE the world is in - it brings a dead area
back to a living one. The proposal here is the same shape: music isn't
just a mood layer under the experience, it's a genuine activation
mechanism - the thing that can bring a reality (or a corridor, or a
panel) from a dormant state into an active one. This is the same
thread as the earlier "music activating realities" conversation, now
with a concrete visual mechanism attached (the border glow) and a
concrete narrative anchor (the Timestone) rather than just an abstract
principle.

## "Demonstrate the data moving as music nodes"

A visualization idea: audio data (the actual frequency/amplitude
content coming out of a channel, e.g., via Web Audio's `AnalyserNode`)
rendered as moving nodes - presumably using the existing OmniNode
system as the visual vocabulary, rather than inventing a new one. Not
elaborated further yet - worth its own design pass whenever this gets
picked up, since "nodes that move with the music" could mean several
different concrete things (nodes that pulse in place, nodes that
travel along a path at a music-driven speed, a whole graph that
reshapes itself with the beat).

## How this connects to corridors and panels

Raised in the same breath as the fixed-corridor/panel work - the
implication being that a corridor or panel's activation state (locked/
dormant vs. unlocked/alive) could be tied to the SAME mechanism as the
border glow, not a separate system. Not resolved here whether "lit
border" and "corridor unlocked" would literally be the same signal or
two related-but-separate ones.

## Open questions, unresolved

- What, specifically, should an OmniExpression panel's reserved
  behavior actually be, once it's time to define it?
- Is the border glow purely decorative feedback, or does it double as
  the corridor-gating signal itself?
- What does "moving as music nodes" concretely render as - pulsing,
  traveling, reshaping?

## Status

Purely conceptual. No panel-border reactivity, no AnalyserNode
integration, and no node-based music visualization exist yet. See
`OMNIVALUE_DESIGN.md` and the "music activating realities" discussion
this idea grew out of for the surrounding context.
