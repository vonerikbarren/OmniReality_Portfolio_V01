# OmniLocus

Nothing in this document is built. A real, new OmniProduct name,
settled directly in conversation: from Latin *locus* — "place" — an
already-standing English loanword, not invented, the same real
etymological approach already used for OmniTalent. Precise about
what this actually is: not a location app, not a feed with a map
skin, but a real *place*, made present through the sphere model
below.

## Origin — a real observation, not a hypothetical

Started from a direct, real observation: a convenience-store owner
at North Station looked unhappy, likely because his business
depends on foot traffic he has little visibility into or influence
over. The original idea: survey the people who wait there about
what they actually want, then use OmniDraw/OmniFeed to give that
location a live, honest feedback layer — starting with something as
concrete as "there are no outlets here."

## Core mechanic

Mega Man Battle Network's "jack-in" combined with Pokémon Go's
location-bound live state: a user enters a real, physical location's
own reality (via QR/NFC/link), sees genuinely live, current data
about that place, and can "pocket" it — copy or connect to it —
back to their own personal HomePage.

## The sphere model — the real, load-bearing design, not a UI convenience

Three real presence states, each with a different real cost and a
different real meaning:

- **Inner sphere (local presence)** — the actual physical domain.
  Full-fidelity, real-time data. Highest influence weight — someone
  physically at North Station right now should count for more than
  someone watching from home, the same way a stadium seat means more
  than watching on TV.
- **Outer sphere (remote presence)** — a live, spatial *window* onto
  the reality from a HomePage, without needing to actually visit.
  Deliberately lower-fidelity — an aggregated, lightweight sync
  (activity counts, a recent ticker), not the full real-time stream
  the inner sphere gets. This is the real, direct answer to the
  live-data cost question raised early in this design: cheap for
  remote viewers by design, not by accident.
- **Personal/pocketed sphere** — a copy or live-linked instance on
  someone's own HomePage. Real, unresolved tension below on whether
  this is a static snapshot (GitHub fork model) or a persistent,
  always-live connection.

This isn't just a bandwidth-saving trick. It's the same instinct
already running through OmniThemes' palettes and stateCommunicator's
face: making an abstract idea (attention, presence) into something
spatially, physically true rather than explained in a settings menu.

## Identity tiers — real, unresolved across four independent sources

Four separate documents (two from direct conversation, two each from
Gemini and Copilot instances) converged on roughly the same three-
tier shape but disagree on the real mechanics:

| Tier (name varies) | How it's earned, per source |
|---|---|
| Guest/Visitor/OmniGuest | Anonymous, ephemeral — converges cleanly across all four; real candidate: Firebase anonymous auth, upgradeable later without losing anything |
| OmniUser | Registered; a HomePage; can pocket realities |
| OmniPlayer | **Genuinely disputed** — a *mode* the same account switches into (original framing); earned by *physical presence at nodes* (Gemini); earned by *demonstrated build scale* (Copilot); a *skill/role* framing, "Reality Architect" (Gemini's Copilot instance) |

**Real, unresolved question, flagged as the one to answer before
building anything around it:** can an OmniPlayer write into *shared*,
public space (deploying modules to a public node, managing a shared
location hub), or only ever into their own pocketed copy? The former
is a real, live moderation/abuse surface that has not been designed
at all yet.

## Live data architecture — real, unresolved on persistence model

Two genuinely different ideas exist, not variations of one:

1. **Static snapshot/fork** (original framing, GitHub-precedent) —
   pocketing copies the reality once; it can drift out of date from
   its source; cheap, simple, no ongoing connection cost.
2. **Persistent live connection** (later framing, and Copilot's
   explicit `sync_modes` table: `local: full_sync`, `remote:
   view_sync`, `pocketed: hybrid_sync`) — pocketed realities stay
   connected to live data indefinitely. Real cost, already flagged
   directly: this scales with concurrent open connections, not total
   users — genuinely bigger backend work than a snapshot.

Not yet decided which one OmniLocus actually is. Worth deciding
deliberately — this changes the backend shape substantially.

## Product pillars (from Gemini's direct pass)

- **Spatial OmniFeed** — a live broadcast loop, radius-bound to the
  physical node (100m/200ft proposed as a starting assumption, not
  validated).
- **OmniChat Intent Channel** — the single sharpest mechanic across
  all four sources: real-time Ask/Offer matching between people at
  the same location, not just a passive comment feed.
- **OmniDraw Spatial Mesh** — the physical layout itself, modeled,
  with live data overlaid on real geometry.

## Operational grounding (from Gemini's Copilot instance)

The most domain-specific, real-world-researched of the four sources:

- **Commuter segmentation is real and matters** — high-velocity
  nodes (5–10 min dwell, battery panic, need grab-and-go/power banks)
  are a genuinely different problem from high-dwell nodes (25–60+
  min, need seating/quiet/comfort). One station may have both.
- **Real retail constraints named directly** — MOQ limits, Keolis/
  MBTA facility lease terms. Not yet verified independently, but a
  real, useful starting list of what to actually check before
  assuming a fix (e.g. a vending partnership) is simple to execute.
- **Micro-interactions over surveys** — single-tap QR polls on
  physical signage, binary prompts, rather than asking someone
  waiting for a train to fill out a form. A real, better-fit
  methodology than the original open-ended survey idea, kept.

## Where the real, defensible uniqueness actually is

Not "a location app" — that space already has real, entrenched
competitors. The genuine, hard-to-copy combination:

- **Science** — OmniJsonifier's own truth/neutral/false
  classification system, already built for a different purpose,
  applied here to civic claims themselves ("no outlets here" as a
  verifiable, contestable fact, not just an opinion in a feed).
  Nothing else in this space has the underlying machinery for this,
  because nothing else built it for something else first.
- **Art** — the sphere model as genuine spatial philosophy, not a
  dashboard wearing a map skin. Presence made a place you can be
  inside of or outside of, the same instinct as everything else in
  this OS that turns an abstraction into somewhere real.
- **Philosophy** — optimizing for *honest and current*, not for
  *time-on-app*. A real, different goal from most location/social
  products, and one that should shape every real design choice below
  it (the Ask/Offer layer, the classification system, QR micro-polls
  are all in service of accuracy, not engagement).

## Real, proposed build order — MVP scoped for one person plus a possible collaborator

1. **QR micro-poll at North Station, first, alone.** Near-zero cost,
   no backend, settles real demand before anything else gets built.
2. **Model the inner sphere only, in OmniDraw.** The real, physical
   space, no live data yet — just making North Station feel like a
   real place to be inside. Squarely the frontend strength already
   proven this whole session.
3. **Wire the classification system into whatever the poll surfaces.**
   The one genuinely unique, already-mostly-built piece competitors
   don't have.
4. **Only then resolve OmniPlayer's real unlock condition and the
   shared-write-access question** — deliberately deferred until real
   poll data exists to make these concrete instead of hypothetical.

The outer sphere, full live-sync tiers, and the full identity ladder
are all real and worth having — genuinely backend-heavy, and
deliberately sequenced after the MVP above, not before it.

## Status

Documented, synthesizing four independent sources (two direct
conversation passes, two AI-assisted passes from Gemini and Copilot).
Real, load-bearing decisions still open: OmniPlayer's actual unlock
mechanic, shared-write-access permissions, and static-fork vs.
persistent-live-connection for pocketed realities. Not yet built.
