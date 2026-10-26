# The 32 — A Revised Axiom Set, Each With Its Interface

A real, reasoned proposal — not final, offered for correction like
every other document in this series. Starts from The 30
(`THE_30_RECLASSIFICATION.md`), removes two entries that read as
interface mechanics rather than axioms of reality, and adds four that
independent evidence (the legacy Systems list, and this project's own
existing architecture) suggests are genuinely missing. Lands at 32, not
30 — the count is not the goal; having every axiom be something you
actually cannot describe a reality without, each backed by a real or
clearly-scoped interface, is the goal.

## The organizing principle

Every entry below answers two questions, not one:
1. Is this a thing reality genuinely has, independent of any specific
   product? (the axiom test)
2. What does a user actually touch, in this application, to work with
   it? (the interface test)

An entry that fails #2 — philosophically real but nothing you can
click, build with, or see — stays flagged as **open**, not removed.
An entry that only passes #2 (a real, useful product with no deeper
axiomatic claim) is a **utility product**, not an axiom — see the two
retirements below.

## Kept from The 30, with existing product (24)

| Axiom | Product | Note |
|---|---|---|
| Change | OmniDraw(Dynamic) | |
| Begin | OmniLandingRoom | Still the weakest match — unresolved from the original pass. |
| Structure | OmniSystem | |
| Express | OmniExpression / OmniExpressionator | |
| Illuminate | OmniSense | |
| Attract | OmniPlayer | Overloaded (3 letters on one product) — unresolved from the original pass. |
| Radiate | OmniNotify | |
| PrimaryForce | OmniValue | Confirmed = Purpose. |
| Freedom | OmniGrab | |
| Progression | OmniPlayer | |
| Regression | OmniCommunicationPanel | |
| Desire | OmniValue | Confirmed = Intent. |
| Problem | OmniChronos-Dev | |
| Solution | OmniCryptx | |
| Energy | OmniPlayer (aura) | |
| Motion | OmniExpressionator | |
| Perspective | OmniVision | |
| Time | OmniChronos | |
| SpaceInternal | OmniBrowserSpace (entered) | |
| SpaceExternal | OmniBrowserSpace (window) | |
| Complexity | OmniComplexity | |
| Data | OmniCell | Overloaded with Variable — see below. |
| Variable | OmniCell | |
| Value | OmniValue | |
| Flow | OmniStory | |
| Conflict | OmniValue (vortex/spiral model) | |
| End | OmniTruths | |
| Vector | *(infrastructure — THREE.Vector3, no single product)* | Kept as-is, deliberately not a product. |

## Retired as axioms — reclassified as utility products (2)

Both of these were already the source of real overload at the menu
layer (`DRAWER_TO_30_MAPPING.md` found "Operate" doing 5–6 separate
jobs — OmniTargeting, OmniKeys, PanelControl, OmniNavi, Admin,
Governance). That overload wasn't a mapping failure, it was a signal:
these aren't axioms reality has, they're *things you do to the
axioms* — control, arrange, narrow down. Demoting them resolves the
overload instead of forcing a pick among six legitimate uses.

- **Operate** → stays as a real concept, just not a reality-axiom.
  OmniAction, OmniKeys, PanelControl, Admin, Governance all remain
  real utility products; none needs reassigning to a different axiom.
- **Consolidate** → same demotion. OmniJsonifier remains exactly what
  it is — a utility that operates *on* Data/Variable, not an axiom of
  its own.

## New axioms, with a proposed interface (4)

Each of these surfaced from a real, independent source — the legacy
Systems list, or a gap this project's own architecture already had to
work around — not invented from nothing.

### Existence
**Why it's load-bearing**: before Change, Time, or Value can apply to
something, that something has to first *be*. The 30 never had this —
the closest candidate, ⟐ "Objective Truths," was excluded as the
Omni(x) operator rather than treated as its own axiom.

**Proposed product — and a real structural resolution, not just an
addition**: make ⟐ *both* — the operator applied to all axioms, and
the Existence axiom itself. This isn't a contradiction: "Omni(x)"
literally reads as "the existence of x" once you say it plainly, which
is arguably why ⟐ was already functioning as the universal prefix in
the first place. The interface is every act of node creation itself —
`systems/OmniNode.js`'s `_createNode()` already is, functionally, "assert
this thing exists." No new product needed, just naming the thing that
already runs underneath everything else.

### Relationship
**Why it's load-bearing**: a "language of structure, not strings"
cannot omit the thing that connects two structures to each other.
OmniValue's own Conversion Nodes already had to be defined as edges
between Value Nodes specifically because there was no first-class
Relationship concept to lean on (`OMNIVALUE_DESIGN.md`'s own
resolution: "it belongs to neither alone; it belongs to the pair").

**Proposed product**: the OmniEdge primitive (from OmniSense's
sentence-graph work, already used for edge styling in V141 and for
OmniValue's Conversion Nodes) is already most of a real product — it
just hasn't been named and surfaced as one. Elevating it to a visible,
first-class product (working name: **OmniRelation**, built on the
existing OmniEdge/OmniEdgeInspector code) rather than leaving it as
plumbing other products borrow.

### Experience
**Why it's load-bearing**: Perspective is *the view*; Experience is
*having lived it*. The legacy list had "Є — The Systems of
Experiences" as its own root; `DRAWER_TO_30_MAPPING.md` independently
flagged ⟐Experiences as a real gap The 30 couldn't place. Two separate
sources losing the same concept is a real signal, not noise.

**Proposed product — genuinely open, flagged rather than forced**:
the two closest candidates are both already stretched (OmniPlayer
already carries three letters; adding a fourth repeats the exact
overload problem just resolved for Operate/Consolidate). The more
honest fit may be **OmniLog** itself — a record of what a user has
actually done and lived through inside a reality — or the jack-in
"carry a captured reality with you" mechanic from the business
strategy doc, since both are literally experience-recording. Not
resolved here; worth a real decision before building anything against
it.

### Causation
**Why it's load-bearing**: "because of this, that" is one of the
handful of concepts linguists studying cross-cultural semantic
primitives (Wierzbicka's Natural Semantic Metalanguage) treat as
universal and irreducible — present in every human language studied.
Neither The 30 nor the legacy Systems list has an equivalent, and this
project has needed one from its very first design conversation: the
whole "provable through a chain of evidence" idea (the Amazon-review
analogy, the mirror-tunnel proof, the supply-chain traceability
example) *is* causation, applied to trust.

**Proposed product**: Essence Data's own truth-state computation
(`_computeEssenceState()` in `systems/OmniNode.js`) is already a real,
working causal-chain engine — evidence causes a computed state, never
hand-set. Making that reasoning chain itself visible and inspectable
(not just the final Truth/False/Undefined result) would turn an
already-built mechanic into Causation's own interface, the same way
Existence reuses node-creation rather than needing something wholly
new.

## What this leaves open

- **32, not 30** — stated plainly rather than forced back to a round
  number. If an exact 30 matters for the brand/name itself, two of
  these four could fold together later (Experience and Relationship
  both touch "what happened between things," for instance), but that
  should be a real decision, not a default.
- **Experience's product is the one genuine unknown** here — everything
  else either reuses an existing product/mechanic or has a clear
  working name.
- **Begin and Attract's existing problems are unchanged** by this pass
  — still worth resolving on their own.
- **Glyphs come after this, not before** — per direct instruction, this
  document settles names and interfaces first; glyph design (new ones,
  styled consistently with the three confirmed originals — Δ, Ω, and
  the ◬-family) is the deliberate next step once this structural layer
  is accepted or corrected.

## Status

A real, reasoned proposal. Nothing here has been used to rename,
restructure, or build any actual product yet.
