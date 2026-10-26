# OmniIdentity (+ OmniIllumination)

Nothing in this document is built. Source material: a JSON spec
produced in a separate conversation with Copilot, brought in whole -
captured here rather than rewritten, since it's a real, external
artifact worth preserving as-given.

## The core idea, as specified

A visitor selects an **identity mode** for an entity (an individual,
a business, a community group) through a hexagonal selector UI. The
whole space then transforms around that choice - CSS, objects,
modules, and store inventory all change together, following a defined
pipeline: `identity_selection -> css_outfit_load -> object_load ->
module_load -> inventory_filter -> tone_shift`.

Four example identity modes were specified in detail (Earthbound
Healer, Collaborative Architect, Community Steward, Mindful Educator),
each bundling its own CSS "outfit," objects, modules, and filtered
store inventory. Real-world analogues were given too - Nike
(athlete/designer/community/sustainability), Apple
(consumer/developer/enterprise/education), Harvard
(student/researcher/alumni/community) - as evidence that established
brands already have implicit identity modes; this makes that
switching explicit and interactive rather than buried in separate
sub-sites.

**OmniIllumination** is specified as the reveal/transition layer on
top: identity-preview animation, transition effects between modes, a
lighting/glow system, and highlight states - explicitly *not* the
logic itself. As given: "OmniIdentity determines the identity logic;
OmniIllumination reveals it visually."

## Where this connects to what's already here - and it connects more than incidentally

- **OmniVisor** (`OMNIVISOR_DESIGN.md`) - OmniVisor's own founding
  principle is perception-gating: some things don't just get clearer
  with the right lens, they don't exist to you at all without it.
  OmniIdentity is describing exactly that principle, at the scale of
  an entire space rather than one object - a different identity mode
  doesn't just restyle what's visible, it changes which objects,
  modules, and inventory exist for that visitor at all. Worth treating
  OmniIdentity as a concrete, site-scale application of OmniVisor's
  own idea, not a coincidentally similar one.
- **OmniConfig** (`OMNICONFIG_DESIGN.md`) - `css_outfit_load` is the
  exact shape OmniConfig was designed around: a named, reusable style
  definition, swapped as a whole rather than edited field by field.
  OmniConfig may end up being the literal mechanism this step runs on.
- **OmniTruths' realityOf(params)** (`OMNITRUTHS_DESIGN.md`) - "the
  same entity, parameterized by identity mode" is a direct, concrete
  instance of that exact framing: reality as a function of its
  parameters, not a fixed singleton. OmniIdentity gives that abstract
  principle its first real, product-shaped application.
- **OmniStore** (`OMNISTORE_DESIGN.md`) - `inventory_filter` is
  precisely the kind of filtering OmniStore's own multi-store/
  marketplace idea would need regardless; the two are very plausibly
  the same mechanism seen from two different entry points.

## A naming risk worth flagging now, on purpose

This project has already hit exactly this problem once -
OmniVision and OmniVisor turned out to be two names for close to the
same idea, which is part of why the Naming & Tier System
(`NAMING_TIER_SYSTEM_DESIGN.md`) exists at all. **OmniIllumination**
sits in similar thematic territory to OmniVisor/OmniVision - light,
revealing, seeing - and OmniVisor's own doc is literally subtitled
"OmniVisor / OmniPerspective" already. Worth deciding deliberately,
before any of this is built, whether OmniIllumination is genuinely its
own thing or another instance of the same naming collision showing up
a second time.

## What's genuinely undecided

- Whether OmniIllumination is built as its own module, or is actually
  just OmniConfig's animated-transition half (already an open question
  in OmniConfig's own doc) wearing a different name.
- How deep `module_load`/`object_load` go - swapping which modules are
  *visible*, versus which modules structurally *exist* for that
  session, are different builds.
- Nothing about the hexagonal selector's actual implementation (real
  DOM, or a 3D/CSS3D-style construction - with the CSS3D lesson from
  `OmniBrowserSpace`/`OmniSystem` worth remembering here) has been
  decided.

## Status

Purely conceptual - a complete, external spec captured whole, not yet
connected to any actual code in this project.
