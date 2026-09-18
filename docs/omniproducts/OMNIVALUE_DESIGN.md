# OmniValue

Nothing in this document is built. Captures an idea raised while
brainstorming OmniBrowserSpace/spatial browsing — noted here per
explicit request so it isn't lost, not designed in depth yet.

## The idea

A crypto-adjacent value system, but "dimensionalized" — value isn't
one currency, it's several distinct *types* of value that can be
weighed against and exchanged for each other. Named examples given: a
service rendered, a product or object (in a specific condition, which
affects its value), and presumably money/currency itself as just one
value-type among several, not the default everything else converts
through.

The core mechanic: two people can trade across *different* value
types directly - a service for a product, a product-in-fair-condition
for a different amount of a product-in-excellent-condition - rather
than everything routing through a single shared currency first. "The
dimensions of value can be maintained between individuals based on
value type" - each value type keeps its own character/weight rather
than being flattened into one number.

## Why this connects to spatial/OmniBrowserSpace browsing

Raised in the context of what spatial browsing can do that a flat page
can't: a normal webpage's commerce is almost always single-currency -
a shopping cart, a price in dollars. A spatially-native marketplace
(literally walking into a space representing a trade) supports a
multi-value bartering metaphor far more naturally than a checkout-form
UI does, since "space" already implies "things brought into it, of
different kinds." Discounts/rewards for spatial stores (mentioned in
the same brainstorm, inspired by Metroid Prime/Zelda discovery logic)
would presumably be denominated in OmniValue terms too, once this
exists - not designed here.

## OmniStore — a paired future project, noted per explicit request

Raised while sequencing upcoming builds (OmniPocket, then Omnicel,
then this): **OmniStore** will be a commerce/store system built with
OmniValue as its core aspect — the two are expected to be worked on
at the same time, OmniValue providing the actual multi-type value
mechanics and OmniStore being the storefront/interaction layer on top
of it. Now has its own, fuller design doc — see `OMNISTORE_DESIGN.md`.

## The OmniValeux Protocol — the formal node architecture

A much fuller formalization of the same idea above, not a separate
concept — "OmniValeux" is the protocol/engine name; OmniValue remains
the product it belongs to, the same relationship OmniCryptexLab has
to OmniCryptx. This directly answers one of this doc's own open
questions and substantially deepens the rest.

**The core reframe**: value isn't scalar, it's tiered. Primary
(money/credits), Secondary (items/tools/resources), Tertiary
(intentions/signals/future plans), Quaternary (reputation/trust),
Quinary (access/permissions/social capital) — five real tiers, not
one number. This is the multi-type idea above, made precise.

**Eight node types, each meant to be a real Reality in OmniOS** —
consistent with how everything else in this project is already
structured, not a new pattern invented just for this:

1. **Value Nodes** — what can be traded (money, items, services,
   access, reputation, intentions, time, energy, space), each with a
   type, weight, conversion rules, trust requirements, enforcement
   rules.
2. **Intention Nodes** — trading *signals of future intent*, not just
   current possessions ("I want fruit because I'm crafting"). Makes
   the system more predictable by revealing where value is headed,
   not just where it sits.
3. **Exchange Nodes** — how value actually moves: barter, money,
   hybrid trade, multi-asset swaps, reputation-weighted trades,
   access-based trades. The real matching engine.
4. **Conversion Nodes** — this is the direct answer to "is there a
   default/common value type": conversion rules between specific
   pairs (3 fruit → 1 credit; 1 hour of labor → 2 access tokens)
   rather than one universal currency everything routes through.
   Real, pairwise, not global.
5. **Enforcement Nodes** — protocol-level, not human: identity
   verification, contract confirmation, automatic penalties, dispute
   resolution, reputation loss, access revocation.
6. **Security Nodes** — asset authentication, fraud detection,
   storage security, access control, identity binding. Named
   directly as where a real cold-storage locker business would plug
   in.
7. **Governance Nodes** — who can change the system: protocol rules,
   community voting, reputation-weighted decisions, node permissions.
8. **Cultural Nodes** — what items/signals/trades actually mean and
   are respected within a given reality; without this, a value system
   reads as arbitrary rather than meaningful.

**A real, honest flag on tiers 5–7 specifically**: enforcement,
security, and governance stop being a design exercise the moment real
trades with real stakes run through them — doubly true given a real
cold-storage locker business is named as a concrete plug-in point.
Automatic penalties, reputation loss, and access revocation are the
kind of mechanism that needs to be *correct*, not just designed,
before anything real depends on it. Worth building and testing this
tier with the same care given to this project's own security work
(OmniCryptx), not rushed to match the pace of the more conceptual
tiers around it.
## Conversion Nodes are edges, not a Value Node subtype

A real structural question, resolved: a Conversion Node isn't a
Value Node, and isn't a child of one either — it's a genuinely
separate kind of thing, structurally an **OmniEdge**
(`docs/omniproducts/OMNISENSE_GLYPH_SYSTEM_DESIGN.md`'s own
node/edge primitive from the sentence-graph work), not an OmniNode.
Reasoning: a Value Node is a noun (a thing that holds value); a
Conversion Node is a relationship between two Value Nodes ("3 fruit
→ 1 credit"). Making it a child of one Value Node forces an
unanswerable ownership question — does the rate belong to Fruit, or
to Credit? It belongs to neither alone; it belongs to the pair. This
also means multiple conversion paths between the same two Value
Nodes (a direct rate, and an indirect one through a third type) are
just multiple *methods* on that same edge — the identical shape a
tunnel between two Stationary Realities already has, not a new
concept.

## Remainders — stated, not auto-corrected, tracked per account

A real, settled mechanic for uneven trades: a remainder (3 fruit per
credit, 10 fruit traded, 1 left over) is not silently rounded away by
a universal system rule. It's **stated** — documented as a real,
literal line at the end of the trade, the same way physical change is
handed back at a register — and it's then **up to the individual
account** to decide how that leftover value gets used or resolved in
this or a future trade, not a system-wide policy. This is real, per-
account bookkeeping, not aggregate rounding.

Consistent with this whole system's own multi-dimensional philosophy
(value types don't collapse into one number), a remainder ledger
should stay **per value-type**, not merged into one running balance —
leftover fruit and leftover credit are tracked separately, the same
way the value types themselves never blend into each other.


## Company intervention — resolved as an architecture goal, not a policy

Directly answered: whether the company verifies every trade or only
disputed ones isn't actually a policy decision to make — it's a
downstream *result* of how well the system is architected. Build the
available trade structures flexible enough, upfront, and fewer
ambiguous situations arise at all; fewer ambiguous situations means
less intervention is ever needed. This is the exact same principle
OmniSense itself was founded on — "define to the nth degree so
there's nothing left to guess" — now applied specifically to trades
rather than communication generally. Not a new philosophy; the same
one, load-bearing in a second place.

## Trades affect a person's real life-structure — directly, not abstractly

A real, concrete design, connecting straight to systems that already
exist in code, not new ones: a person's life is already represented
as real nodes — `OmniUserProfile.js`'s 14 Dimensions of Wellness, and
`OmniPlayerGame.js`'s Core Realities/Aspects. The vision given
directly: a trade shouldn't just change an abstract number — it
should show a real **addition and subtraction against those actual
life-structure nodes**. Trading fruit for a credit isn't just "+1
credit" on a ledger; it's a real, visible shift somewhere in that
person's own Financial (or whichever) wellness dimension.

**The genuinely sharp part**: the *same* objective trade (3 fruit →
1 credit) can carry wildly different real impact depending on who's
making it — significant for one person's life-structure, negligible
or even a detriment for another's, on either side of the trade. This
means the Conversion Node's own rate (the "3 fruit → 1 credit" ratio)
and the *life-impact* of executing that rate are two genuinely
separate calculations, not one — the rate is objective and fixed; the
wellness-delta it produces is a real function of each party's own
current state, computed fresh per trade, per person.

**Scale note, given directly**: the "2 parties" in a trade aren't
always 2 individuals — they can be entities containing multiple users
each. How an entity's own aggregate life-structure is computed from
its members' (average, weighted, something else) is real, explicitly
open — not decided here.

**The actual, stated goal underneath all of this**: to prove the
system is genuinely multidimensional by having it solve several real
problems — financial, wellness, identity — through the *same* trade,
at the *same* time, not sequentially. "The proof is through service"
— demonstrated by real, lived use, not a technical claim made in the
abstract.


## Intent verification — three real layers, not one

Resolved as a real, three-part system, not a single "state your
intent" field — and now precisely named: **Intent is Desire(). Purpose
is PrimaryForce().** Confirmed directly, in the language's own 30
(`architecture/THE_30_RECLASSIFICATION.md`), which is why the mapping
below reads as exact, not just analogous:

1. **Forward intent = Desire()** — stated before a trade, low weight
   by design: direction and scope only, not proof of anything.
   Confirmed directly: humans can't be trusted to self-report
   accurately, so a forward declaration is a hint about *where this
   is headed*, never the actual verification. Desire is exactly this
   — aspirational, unproven, by its own nature.
2. **Backward-derived purpose = PrimaryForce()** — the real check.
   Start from where someone actually is, observe the choices they
   make, and let the pattern those choices form tell its own story —
   proven by working backward from outcome, the same way a math
   proof gets checked in reverse. Identifying which force actually
   dominated a structure gets you to the root of real purpose,
   because by default it's the dominant structure's own power that
   shapes outcomes — subjugated intent only becomes visible if it
   successfully rises against that power.
3. **The technical affidavit** — the real bridge between 1 and 2.
   Human life is complex enough that a pattern alone isn't
   necessarily a fair full picture, so the person behind a pattern
   can give a real, honest, on-record explanation for their choices
   — not proof, not neutral, an affidavit in the legal sense: a
   sworn, honest account. The system's job is making sure this is
   genuinely available and undistorted, not judging whether it's

   correct.

**The actual design principle**: the system never renders a verdict
on someone else's behalf. It surfaces the full picture — declared
intent, the real pattern, the affidavit explaining it — and leaves
the decision to trade or not entirely with the other party. Honesty
up front; judgment stays human.

**Where this closes the earlier open question** (telling a
legitimate remainder apart from tampering): a real divergence between
the declared forward intent and what the backward-derived pattern
actually shows — not the remainder number itself — is the real
corruption signal. The remainder was never the thing to distrust; the
mismatch between what was promised and what actually happened is.



## Open questions, unresolved

- ~~Is there a "default" or common value type objects/services get
  weighed against for practical trading~~ — answered above: no
  universal default, real pairwise Conversion Nodes instead (3 fruit
  → 1 credit, etc.).
- How is an object's condition actually assessed/recorded as a value
  input - self-reported, inspected by another OmniPlayer, something
  else?
- Does OmniValue have any relationship to real-world currency at all,
  or is it entirely internal to the reality?
- ~~Is there any mechanic for telling a legitimate remainder apart
  from tampering/corruption~~ — answered above: a divergence between
  declared forward intent and the backward-derived pattern is the
  real signal, not the remainder itself.

## Status

Purely conceptual, no code — but now genuinely fuller: the OmniValeux
Protocol gives this a real 8-node architecture and answers one of
its own open questions directly. Still no data model, no exchange
logic, no relationship to any other real system (OmniPlayer,
OmniBrowserSpace stores, etc.) implemented. Enforcement/Security/
Governance specifically are flagged as needing real, careful design
before anything live depends on them — not rushed to match the pace
of the more conceptual tiers.
