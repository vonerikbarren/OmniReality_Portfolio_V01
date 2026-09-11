# OmniAction (name undecided — OmniAction / OmniAct / OmniFunction floated)

Nothing in this document is built. Explicitly saved for last on
purpose - described as "actually really fun," meant to be gotten to
once other, more foundational pieces exist.

## The core idea

A new OmniProduct centered on giving GSAP its full power, deliberately
exposed rather than wrapped down to a few presets: connecting nodes to
functions, and those functions to animations. The product *is* the
connection layer between "a node exists" and "a node does something,
choreographed."

## Why "saved for last" is a real, load-bearing decision, not just sequencing

Nothing about this needs to be first - it depends on other systems
existing to have something worth connecting and animating. It's
recorded here specifically so the idea itself doesn't get lost while
waiting for the right moment, not because it needs designing right now.

## Where this plausibly connects, once it's picked up

- **OmniSystem** (once that exists) - explicitly deferred out of
  OmniSystem's own first pass: "manually animated nodes... I wanted to
  save that for last, cause that's actually really fun." OmniAction is
  very plausibly the actual mechanism that later animation work runs
  through, rather than a one-off feature bolted onto OmniSystem itself.
- **OmniExpression's Timeline/Time Tunnel/OmniTime thread** - already
  GSAP-driven keyframing at its core; OmniAction may end up being the
  general-purpose version of the same underlying idea OmniExpression
  needed a specific version of first.
- **OmniLayer's curve types** (linear/sporadic/exponential/logarithmic)
  - a plausible natural fit for how an OmniAction connection could be
  shaped over time, once both exist.

## What's genuinely undecided

- The actual name - OmniAction and OmniAct were both floated, neither
  chosen. ("OmniFunction" also came up, unclear if seriously intended
  or a transcription artifact of one of the other two.)
- Whether this is its own standalone panel/system, or an authoring
  layer that attaches to existing panels (OmniDraw, OmniSystem, etc.)
  rather than living anywhere on its own.
- Nothing about the actual node-to-function connection model (how a
  node gets wired to a function, how a function gets wired to an
  animation, what the authoring interface for this even looks like)
  has been discussed yet - this document exists to hold the idea and
  its name candidates, not to specify the mechanism.

## Status

Purely conceptual, and deliberately not being designed further yet.
