# OmniTruths

Nothing in this document is built. Captures a deep, multi-turn design
conversation — the most conceptually developed of the OmniProducts
documented so far, alongside OmniValue and OmniTime.

## The core idea

Realities can sit next to each other for comparison, or merge for
analysis. When two merge, each carries its own data - visually
distinct (e.g., reality A rendered blue, reality B rendered pink) -
and where they overlap, that overlap is a distinct region, not just a
blend. If the two data sets converge on the same point, that's
described as "a collision of truth" - potentially meaningful, not
noise to be smoothed over.

The result of a merge isn't singular or automatically resolved.
Explicitly requested: **the user gets options for how to see the
result**, not one fixed output. A merge introduces a new color state,
and from there, the user can see:

- Truths discovered
- Falses discovered
- Undefineds discovered
- Events that got created

**Objective views before subjective ones**, in whatever ordering the
UI ends up presenting these in.

## A direct, concrete connection worth naming

The truths/falses/undefineds categorization is not a new taxonomy -
it's the same four-part `primitive` classification `systems/OmniNode.js`
has used since early this session (`objective` / `subjective` /
`undefined` / `false` - see `PRIMITIVE_COLORS`). OmniTruths' merge
results appear to be that same vocabulary, applied at the scale of
whole realities colliding rather than individual placed nodes. Worth
building on that existing foundation rather than inventing a second,
parallel one when this gets designed further.

Also explicitly requested: **the user should be able to choose whether
a given merge outcome is treated as a benefit/gain or a
detriment/loss** - not something the system decides unilaterally. Not
yet specified how that choice gets made or what it affects downstream.

## realityOf(params) - reality as a function, not a singleton

A separate but connected insight from the same conversation, worth
recording precisely because of how load-bearing it turned out to be:
"reality" as a bare word has no fixed referent - there's no *this*
reality without something to anchor which one is meant. The proposed
resolution: a reality isn't a singleton thing, it's a **function of its
own parameters** - `realityOf(params)`. One of those parameters can be
a clock, and that clock can run at any resolution, down to whatever's
actually driving the render loop, frame by frame. Under this framing,
"a persistent reality across frames" is already an abstraction layered
on top of something more fundamental (each frame technically being its
own distinct state) - not a new problem, but a naming of something that
was already implicitly true throughout everything built this session.

## Still genuinely open - asked, not yet answered

**Destructive vs. non-destructive merging.** When two realities merge,
does the merge consume them (A and B stop independently existing, the
merge result is now the only thing that persists), or is the merge
itself a new, third reality - parameterized by its own clock, per the
section above - while A and B continue existing independently,
unaffected? This was asked directly and the conversation moved on to
the benefit/loss and truths/falses/undefineds detail without a direct
answer. Worth resolving before any of the merge mechanic gets built,
since it changes the data model significantly.

**Computed reconciliation vs. observed rendering.** Related, also
unresolved: when two realities' data converge on the same point, does
OmniTruths need to actually *compute* something (reconcile the overlap
into one resolved value, flag a contradiction), or is the "collision of
truth" purely something a person observes and interprets, with the
system's only job being to render the overlap clearly? A visualization
problem and a data-reconciliation engine are very different builds.

## Where this connects to the rest of the system

- **OmniValue** (`OMNIVALUE_DESIGN.md`) - a merge outcome framed as
  benefit/gain vs. detriment/loss sounds adjacent to, maybe expressed
  in terms of, OmniValue's own multi-type value system, once both
  exist.
- **OmniChronos** - realityOf(params)'s clock-as-parameter is the
  same principle OmniChronos was already built around (each user
  experiencing the same reality on their own time) - this
  conversation gives that principle sharper, more general vocabulary
  rather than introducing a competing one.
- **OmniTime** (see the OmniExpression design docs) - a merge
  happening at some specific point along a Master Tunnel, evaluated
  through OmniTime as the instrument doing the measuring, is a
  plausible mechanism for *where/when* a merge is actually authored -
  not confirmed, just a structural fit worth testing later.

## Status

Purely conceptual - no data model, no rendering approach, and no
resolution of the open questions above exist yet. This is genuinely
one of the deepest, most-developed ideas in the whole project so far;
worth a dedicated follow-up conversation specifically to resolve the
destructive/non-destructive question before any code gets written
against it.
