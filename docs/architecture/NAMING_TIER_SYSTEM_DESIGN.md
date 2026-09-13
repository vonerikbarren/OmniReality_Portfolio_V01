# Naming & Tier System

Nothing in this document is built. A cross-cutting convention, not a
single OmniProduct - affects how every product is named and monetized
going forward.

## The core idea

Inspired directly by Kingdom Hearts' magic system: a spell's name
itself changes as the player masters it - Fire becomes Fira, then
Firaga. The name *is* the progression indicator, not just a label.

Proposed for OmniProducts: each product gets a **tier of names**, each
name mapped to a real feature/access tier, not just a rebrand:

- **Tier 1 (free, demo-level)** - a plain, unbranded name. Example
  given: **Time** - a demo tool, not the official product.
- **Tier 2 (official product)** - the actual "Omni"-branded product.
  Example: **OmniTime** - the real, full product `Time` was a preview of.
- **Tier 3 (middle paid tier, name TBD)** - floated as something like
  **Sands of Time**, not settled.
- **Tier 4 (most current/full form)** - **OmniChronos**, the most
  up-to-date, complete version.

Paying for a tier is paying for the name change itself being backed by
real, additional capability - the name upgrade and the feature upgrade
are the same event, not decoupled.

## Why this matters beyond naming - it retroactively fixes a real, named problem

Explicitly identified as solving something that had already gone
wrong: **OmniVision and OmniVisor are two different names for what is
effectively the same underlying idea** - a naming collision that had
already happened before this system existed to prevent it. Under a
tiered system, that collision doesn't need an awkward retcon - the two
names can simply become two tiers of the *same* product line, rather
than needing to be untangled into two competing, confusingly similar
identities. This was raised specifically because the naming process
"has always been something I struggle with," and this is offered as
the structural fix, not a one-off patch.

## What's still undecided

- The actual tier names for anything other than the Time example are
  not settled - "Sands of Time" is floated, not confirmed.
- How many tiers is standard per product - the Time example has 4;
  it's not stated whether every OmniProduct is expected to have
  exactly that many.
- How OmniVision and OmniVisor specifically get resolved into tiers of
  one line - not yet decided, just identified as fixable under this
  system rather than fixed already.
- Whether this tiering is purely a naming/marketing layer on top of
  otherwise-identical code, or whether each tier is expected to be a
  genuinely separate build (more likely, given "paying for it" implies
  real feature gating, not just a different label on the same thing).

## Where this connects

- **OmniStore** (`OMNISTORE_DESIGN.md`) - this tier system is the
  actual monetization mechanic OmniStore's marketplace would sell
  access to; the two were raised in the same conversation for exactly
  this reason.
- Every existing OmniProduct with more than one obvious name floating
  around it (OmniVision/OmniVisor being the concrete, named example)
  is a candidate to be reconsidered as tiers of one line rather than
  competing names, once this system is actually designed further.
- **OmniExpression** (`OMNI_EXPRESSION_PRESENTER_DESIGN.md`) is a
  second, concrete candidate — its current, built form is explicitly a
  SingularNode (one presenter avatar), with a higher tier proposed to
  evolve it into a genuine SystemNode (multiple avatars operating at
  once). Not the same collision as OmniVision/OmniVisor (nothing's
  actually named wrong here yet), but the same underlying shape: one
  product line, meant to grow through real, named tiers rather than a
  single fixed form.

## Status

Purely conceptual. No tier names beyond the Time/OmniTime example are
settled, no product has actually been reorganized into tiers yet, and
the OmniVision/OmniVisor collision is identified as fixable here but
not yet resolved.
