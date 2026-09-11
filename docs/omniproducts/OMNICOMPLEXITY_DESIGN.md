# OmniComplexity

Nothing in this document is built.

## The core idea

A dynamic table of contents for structural complexity - not for
individual objects, but for the *systems and structures* they form.
Explicitly not a filter, though it shares some of a filter's
functions: a filter narrows a set down; OmniComplexity's job is to let
someone navigate and understand a structure's shape, which sometimes
means narrowing, but also means showing relation, position, and scale
within the whole.

Confirmed as genuinely cross-cutting, not a one-off tool: intended to
be used in most, if not all, of the other OmniProducts.

## Three organizing axes, not one

This is the part that makes it more than a rebrand of an existing
idea - it's explicitly meant to organize by more than one kind of
relationship at once:

- **Vertical / hierarchical** - parent-to-child relation, the thing
  `systems/OmniNode.js`'s existing genealogy/Path mode already does
  (edges, ancestry, highlighting) - but as *one axis among several*
  here, not the only lens available.
- **Horizontal / categorical** - form, type, association. Filtering by
  *kind* rather than by position in a tree. The stated example: the
  different types of clothing a company sells - a real, concrete
  catalog-organization case, not an abstract one.
- **Spectral / progressive** - a start-to-end range across a whole
  reality, not a discrete category at all. Described as seeing a
  structure the way you'd see a spectrum.

The name comes specifically from being able to hold all three at
once, including still being able to show a plain parent-to-child
relation when that's what's actually needed - not replacing hierarchy,
absorbing it as one mode among others.

## What it's for, in practice

Two stated use cases, not one:

1. **Navigation** - moving from a system's full domain down into its
   smaller domains, based on chosen criteria. The primary use.
2. **Quick looks** - an at-a-glance read of a structure's shape and
   scale, without necessarily drilling into it at all.

## Where this connects to what's already here

- **`systems/OmniNode.js`'s genealogy/Path mode** - currently purely
  hierarchical (parent/child edges only). OmniComplexity would fold
  that existing mechanic in as one of its axes, not replace it.
- **OmniSystem** (`OMNISYSTEM_DESIGN.md`) - "structures/systems, not
  objects themselves" describes exactly what an OmniSystem instance
  is. OmniComplexity reads like the natural navigation/overview layer
  for browsing one, once it exists.
- **OmniStore** (`OMNISTORE_DESIGN.md`) - the clothing-catalog example
  given is literally a store-inventory organization problem.
- **OmniIdentity** (`OMNIIDENTITY_DESIGN.md`) - `object_load`/
  `module_load` per identity is exactly the kind of structural
  complexity this tool would help someone navigate and understand.
- **OmniVisor** (`OMNIVISOR_DESIGN.md`) - related but distinct: OmniVisor
  gates whether something exists/is visible at all; OmniComplexity
  organizes and navigates what's already there. Worth keeping that
  line clear rather than letting the two blur together.

## SWOT - asked for directly, given honestly

**Strengths**
- Genuinely high-leverage by its own design - reusable across most
  tools rather than a one-off, so building it once upgrades many
  things at once.
- Solves a real, already-existing gap: OmniNode's own Path mode can
  currently *only* show hierarchy - there's no type- or
  category-based way to navigate the same node graph today.
- The "quick look" use case stands on its own value, independent of
  deep navigation - a fast read of a structure's shape is useful even
  without ever drilling in.
- Strong conceptual grounding - connects concretely to four other
  documented systems, not floating in isolation.

**Weaknesses**
- Under-specified at the mechanism level right now - panel, 3D
  visualization, search-bar-like input, a tree view, some hybrid?
  Nothing about the actual interface has been decided yet.
- Three genuinely different organizing principles (hierarchy,
  category, spectrum) in one tool is a real engineering challenge, not
  just a UI one - OmniSystem's own doc had to explicitly split three
  superficially-similar ideas apart to avoid exactly this kind of
  ambiguity trap, and the same discipline will matter here.
- "Not a filter, but has some filter functions" is a real, useful
  distinction, but still fuzzy - worth a concrete definition of where
  the line actually sits before this gets built, or it risks staying
  vague indefinitely.

**Opportunities**
- Given the "used in most tools" intent, this could become *the*
  shared navigation layer across OmniSystem, OmniStore's inventory,
  OmniIdentity's space logic, and OmniNode's own Inspector - one build
  upgrading several systems simultaneously rather than four separate,
  smaller navigation tools.
- The spectral/start-to-end axis is a natural fit for however
  OmniChronos ends up visualizing time - this could become the shared
  visual language for that, not a separate one invented later.

**Threats**
- Real scope-creep risk, precisely *because* it's meant to be
  everywhere - "universal" tools are the ones most likely to never
  actually ship unless scoped to one concrete first use case early.
- Several existing/planned systems already sit near this exact space -
  OmniVisor's filtering, OmniLayer's layer-navigation, OmniNode's own
  Path mode. Without deliberately working out how OmniComplexity
  relates to each of them, there's a real risk of building a fourth,
  competing navigation paradigm instead of unifying the ones already
  in motion - the same kind of collision already hit once with
  OmniVision/OmniVisor, and just discussed again with OmniIdentity.

## What's genuinely undecided

- The actual UI/interaction model - nothing chosen yet.
- Where exactly "filter-like function" stops and something else
  starts.
- Which concrete tool gets this first, as the real proving ground,
  rather than building it in the abstract.

## Status

Purely conceptual. No interface, no data model, and no first
integration target exist yet.
