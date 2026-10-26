# OmniConfig

Nothing in this document is built. Captures a design conversation
about how text customization (font, size, weight, and eventually
animated behavior) should be architected across the whole project -
confirmed to apply to both user-created content and the app's own UI.

## The core idea

A named, reusable library of text-style definitions - the same shape
as Word's Styles panel, CSS classes, or Figma's text styles. Each
named entry ("Header-Large," "Default," a future animated one) holds
platform-agnostic data: font family, size (or a header-tier preset,
markdown-style - h1 through h6), weight, and eventually an animation
descriptor. Nothing that appears anywhere in this project sets its own
font directly - it references a named OmniConfig instead.

## Confirmed scope: both DimensionalText content and panel chrome

Two genuinely different rendering technologies, both meant to be
driven by the same underlying OmniConfig definitions:

- **DimensionalText** (`systems/OmniNode.js`, `_buildTextSprite`) -
  currently a `THREE.Sprite` whose image is drawn via Canvas 2D, with
  `ctx.font` hardcoded to `"bold 64px 'Courier New', monospace"`.
  Since `ctx.font` accepts any valid CSS font string, this is a small,
  well-supported change once it stops being hardcoded - not a stretch
  goal.
- **Panel chrome** (every panel's own labels/headers) - real DOM/CSS.
  A genuinely encouraging finding: every panel already references a
  single shared CSS variable (`var(--mono)`) rather than hardcoding
  its own font-family individually. That means the "translator" for
  this half is largely already there structurally - an OmniConfig
  theme could drive panel chrome just by setting that variable (and a
  size/weight counterpart) at the root, without touching every panel
  file individually.

## The definition/application split - why this isn't just a property bag

The recommended shape: OmniConfig is its own standalone library (the
**definition**), and each place text actually appears gets a
lightweight property saying *which* OmniConfig applies there (the
**application point**) - a reference, not the settings re-entered
every time. This is the same principle as a design-token system: one
central, platform-agnostic definition, with a separate small
"translator" per rendering target (one compiles a definition into a
canvas `ctx.font` string, another into real CSS) - neither translator
needs to know the other exists.

Why this matters practically, not just architecturally: without the
split, making several pieces of text look consistent means manually
re-entering the same settings everywhere, and changing "all my headers
should be 10% bigger" later means hunting down and editing every node
individually instead of changing one definition and having everything
referencing it update.

## Confirmed but with an open nuance: degree of freedom differs by context

"Both" doesn't necessarily mean identical freedom in both places.
DimensionalText is user-created content - wide-open variety is the
whole point, expression. Panel chrome is the app's own UI - unlimited
independent freedom per panel risks the app feeling incoherent rather
than customizable. Likely shape: DimensionalText gets the full,
open OmniConfig library; panel chrome picks from a smaller, curated
subset or a small number of app-wide themes. Not decided - flagged so
it gets chosen on purpose rather than defaulted into.

## The animation half, and a connection worth keeping in mind

An OmniConfig entry can define either a static look or an animated
behavior. This is a natural, likely-first real use case for
**OmniAction** (`OMNIACTION_DESIGN.md`) - connecting things to GSAP's
full power - rather than a separate animation mechanism built
specifically for text. Worth building against OmniAction once it
exists, not duplicating its job.

## What's genuinely undecided

- The actual set of starting definitions/presets - nothing beyond the
  "Times New Roman, 72pt" and markdown-header-tier examples has been
  proposed.
- Where OmniConfig itself lives as a panel/UI - not designed yet.
- The exact shape of an animated OmniConfig entry, pending OmniAction
  existing to build it against.
- The panel-chrome freedom question above.

## Status

Purely conceptual. No OmniConfig data model, panel, or application
points exist yet.
