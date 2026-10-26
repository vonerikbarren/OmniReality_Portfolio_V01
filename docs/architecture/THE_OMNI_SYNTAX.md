# The Omni Syntax — Early Grammar, Paused Mid-Draft

Captured so this isn't lost, not because it's settled. Picked up again
whenever the person returns to it — not built into any running code
yet.

## What's real so far

**realityContext — 《 》** — a container/scope, the same role
`OmniNode.js`'s existing Domain/Space system (`spaceId`, `.attach()`)
already plays in code. Giving it notation, not new semantics.

**Five operators now, not four** — the fifth surfaced directly from
this syntax work:

| Operator | Glyph | Role |
|---|---|---|
| Existence / Activation | ⟐ | "this is instantiated" |
| Escalation | ′ / ″ | "more of this, one degree up" |
| Negation / Absence | ⊘ | "the absence of this" |
| Inversion / Polarity | ~ / mirror | "the opposite expression of this root" |
| **Binding** *(new)* | **:** | "this axiom, qualified by this value" — pairs an axiom with a value the way a key pairs with a value |

## Three working defaults — assumed to make example programs legal, not yet confirmed

1. `:` is generative — either side can be any of the 32 root axioms,
   not a closed sub-vocabulary. Open question: should the right side
   of `:` instead be restricted to a smaller set (e.g. an explicit
   access/permission vocabulary), making `:` narrower and more
   predictable at the cost of expressive power?
2. Multiple statements inside one 《 》 separate by comma.
3. Nesting is legal (a 《 》 can hold another 《 》), mapping directly
   onto the existing Domain/Group parent-child relationship already in
   code — not yet exercised in an example.

## Three example programs, smallest to largest

```
《 ⟐ 》
```
The smallest legal statement — a context exists, nothing else
asserted. The language's own "hello world."

```
《 ⟐ : ◦ 》
```
Existence bound to Begin — the context is instantiating, not just
present. Possibly the expanded form of the compound glyph ⟐◦ from
`THE_32_GLYPH_CANDIDATES.md` (the same relationship `x++` has to
`x = x + 1`) — raised, not confirmed.

```
《 ◦ : ⟐ , ↔ : ⚖ , ● : ⊘ 》
```
Begin bound to Existence, Relationship bound to Value, End bound to
Negation. Read as a sentence: something comes into being, forms a
relationship around value, and ends in absence — the minimal shape of
a trade. Not picked as an arbitrary example; it's the shape OmniValue
specifically needs expressed, so if the grammar can carry this, that's
a real signal it's useful, not just coherent.

## Status

Paused here, deliberately, to get back to building. Open questions
above (especially #1) are exactly where to resume. Nothing in this
document has been wired into any running system.
