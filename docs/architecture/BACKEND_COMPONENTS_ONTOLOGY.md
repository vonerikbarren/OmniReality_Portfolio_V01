# Backend Components — an Ontology, by Type

Real, direct answer to a real question: "what are the sensor types
for a backend." A tree, not a list — main/core components (things
almost every real backend needs), then extended (add-on modules you
attach for a specific capability, the way you'd bolt a GPS or
temperature sensor onto an Arduino for one specific job).

Framed specifically in terms of this OS — every component below
notes where it would actually matter here, not just abstractly.

## Core Components (the base board — nothing real works without these)

### 1. Runtime / Server Process
The thing that actually executes code when a request comes in.
Node.js is the natural fit here, given everything else in this
project is already JavaScript. This is the literal CPU of the
Arduino analogy — everything else plugs into it.

### 2. Database / Persistence
Where data survives after the request ends. Already discussed
directly this session: Firestore (serverless, document-shaped) vs.
Postgres/MySQL (relational) vs. MongoDB (document, self-hosted).
**Where this matters here:** every OmniProduct that currently only
saves to localStorage — OmniIdentity, OmniPocket, saved
OmniRealityGridSelector contexts — is a real, direct candidate the
moment "works across devices" or "works for more than one person"
matters.

### 3. Authentication / Identity
Who is making the request, and are they allowed to. Sessions, JWTs,
OAuth, Firebase Auth. **Where this matters here:** OmniIdentity
already exists as a real, frontend-only concept (per-identity
namespacing in SectionCarousel/Jsonifier); a real backend identity
layer is what would let the *same* identity follow a person across
devices instead of resetting per-browser.

### 4. API / Routing Layer
How an incoming request finds the right code to handle it — REST
endpoints, or GraphQL. The actual "wiring diagram" connecting a
request to a response. **Where this matters here:** OmniCommandTerminal's
own commands are a real, direct preview of this same shape — each
one is already "a name plus arguments plus a handler," just running
entirely client-side today.

### 5. Real-Time Layer (WebSockets)
A persistent, two-way connection the server can push through without
being asked first — genuinely different from request/response.
**Where this matters here:** already the identified, real blocker
for OmniNavi's own message threading and any shared-reality
multiplayer state — two people seeing the same placed object update
live needs this specific piece, not just a database.

## Extended Components (bolt-on modules — added for one specific capability)

### 6. Third-Party API Integration
The literal example already understood: Twilio for automated SMS.
This category is broad — any outside service with its own real API
(Twilio, SendGrid, Google Maps, OpenAI). The backend's real job here
is holding the secret key and making the call server-side, exactly
as already established — never from the client directly.

### 7. Payment Processing
A specific, heavily-regulated subset of #6 — Stripe, PayPal.
**Where this matters here:** directly relevant to OmniValue/OmniStore
and the new OmniTalent idea below — any real, monetized exchange of
value needs this specific piece, and it's genuinely one of the more
unforgiving ones to get wrong (PCI compliance, webhooks, idempotency).

### 8. Queues / Background Jobs
Work that shouldn't block the actual request — send this email in
30 seconds, process this upload after it finishes, run this nightly
cleanup. Redis/BullMQ, or simple cron. **Where this matters here:**
any real "OmniBotProgram runs its own logic even when nobody's
watching" behavior, eventually, would live here rather than in the
live render loop.

### 9. Caching
A fast, temporary copy of something expensive to (re)compute or
fetch, so repeat requests don't redo the same work. Redis is the
common real choice. Matters more as real traffic grows than it does
today.

### 10. File / Object Storage
Where uploaded files actually live — S3, Firebase Storage, R2. Not
the same as the database (which holds structured data, not binary
blobs). **Where this matters here:** ChronosRealityNode's own real
video/image texture support already anticipates this — right now a
texture is just a URL; a real backend would need somewhere to
actually receive and host what a user uploads.

### 11. Search / Indexing
Fast lookup across large amounts of content — Algolia, Elasticsearch,
or a database's own full-text search. Only matters once there's
enough real content that browsing beats searching (many saved
realities, many OmniLog entries across many users).

### 12. Observability (Logging, Monitoring, Error Tracking)
Sentry, or simple structured logs — knowing something broke, for
who, and why, without a user having to report it. Not glamorous,
genuinely load-bearing the moment other people depend on this
staying up.

### 13. Rate Limiting / Abuse Prevention
Stopping one person (or one bot) from overwhelming the backend —
genuinely necessary the moment endpoints are public, easy to skip
early and painful to add after the fact once real abuse shows up.

### 14. Notifications (Email / SMS / Push)
The literal Twilio example, generalized — anything that reaches a
person outside the app itself. Built on top of #6.

### 15. Blockchain / Ledger Integration
Only relevant if OmniValue or OmniTalent are ever genuinely
crypto-backed (a real, distributed ledger) rather than a database
table that just behaves like one. A real, much heavier commitment
than the rest of this list — worth being deliberate about, not
reached for by default just because the names sound crypto-native.

## OmniValue / OmniTalent — where the backend ontology and the monetization idea meet

OmniValue's own, already-documented real structure (its full design
doc) is five real tiers, not one number: **Primary** (money/credits),
**Secondary** (items/tools/resources), **Tertiary** (intentions/
signals/future plans), **Quaternary** (reputation/trust), **Quinary**
(access/permissions/social capital).

**OmniTalent — a real, plausible fit within that same structure, not
a sixth, competing system.** The etymology genuinely supports this:
τάλαντον was real, substantial ancient currency, and the modern
"skill" sense comes specifically from the Parable of the Talents —
being entrusted with something valuable and expected to grow it, not
hoard it. That maps cleanly onto OmniValue's own Quaternary tier
(reputation/trust) or a real, named subtype of Secondary
(skill/service *as* a tradeable resource) — a person's own real,
demonstrated capability inside the OS, denominated the way any other
OmniValue type already is, tradeable against Primary or Tertiary
value the same way OmniValue's own core mechanic already allows
("a service for a product," directly from its own doc).

**Concretely, what this needs from the backend ontology above:** a
real ledger (#2, Database) tracking each identity's own balance per
value-type, not a single number; real identity (#3) so a talent
balance actually belongs to someone across sessions; and, the moment
actual money changes hands rather than just in-world value, real
payment processing (#7). Everything else on this list (real-time,
notifications, observability) matters more as this grows, not on
day one.

**A concrete, real opportunity worth naming directly:** OmniProgram
(building OmniBotPrograms/OmniNavi) is a genuinely plausible place a
paid tier could live — building on the frontend, gating advanced
tiers or persistence behind a real backend account, priced in real
currency *or* OmniTalent, depending on which value-type someone
wants to spend. That's the frontend/backend split from the earlier
conversation, made concrete: the building experience is the frontend
work already done; the *account, persistence, and paid gate* around
it is the backend work that's still genuinely ahead.

## Status

Documentation only, per direct request. No backend work started.
