# Hosting Costs & Client Pricing — Pre-Execution Notes

Real figures and reasoning from a planning conversation, captured
for whenever pricing decisions actually need to be made. Nothing
here is a commitment — this is the reference material to make that
decision from.

## Personal project scope, as stated

Two personal 3D sites planned:
1. This portfolio (OmniReality)
2. OmniNet — a fictitious-but-not-fictitious first-person take on
   the internet-diving experience from Mega Man Battle Network

Rounded hosting estimate: **~$20/month each → ~$40/month for both**,
under the custom-server path (see cost comparison below). Real
possible client load discussed: 3 clients, each with their own page
→ **~$60/month** in hosting overhead across all three, using the
same $20/mo-per-site estimate.

## Hosting cost comparison — Firebase vs. custom server

Specifically for low-traffic, portfolio-scale use (not commercial
scale):

**Firebase (Firestore + Auth + Cloud Functions):** realistically
**$0/month**. Free-tier (Spark) daily quotas — 1 GB Firestore
storage, 20K writes/day, 50K reads/day, 20K deletes/day, 50K MAU on
Auth — are comfortably above what a portfolio-scale site would use.
Enabling Blaze (required for Cloud Functions, e.g. to hold a real
secret key server-side) is not itself a subscription — it only bills
usage *above* those same free quotas, which a portfolio wouldn't
reach. Cloud Storage now requires Blaze regardless of usage (changed
Feb 2026) but stays $0 under 5 GB-months stored / 100 GB egress.

**Custom server (Node + Postgres/MySQL, e.g. via Render):**
realistically **$0–14/month**, with a real catch on the free option.
Render's free web service sleeps after 15 minutes idle (30–50s cold
start on wake) — acceptable for a low-traffic portfolio. But
Render's free Postgres hard-expires 30 days after creation, then
gets deleted — not a real, renewable free option for a persistent
database. An always-on server + a real, persistent database runs
roughly **$7/mo (web service) + $7/mo (Postgres) ≈ $14/mo minimum**.
Railway and Fly.io no longer have meaningful free tiers for new
accounts; small real workloads there typically land $10–25/mo,
usage-metered with no hard ceiling.

**Bottom line:** Firebase is close to free indefinitely at this
scale; the custom-server path's honest "always-on, real database"
cost is ~$14/month. Chosen anyway for full visibility into the
stack, not to save money — a legitimate reason to prefer it, stated
directly in the original conversation.

## Residual income — real, precise answer

Charging a client a recurring fee above actual hosting cost is real,
recurring revenue. Worth being precise on terminology, though: true
"residual" or "passive" income implies very little ongoing labor
(royalties, dividends). "Managing the sites" is real, continuing
work — updates, fixes, support. The accurate term is **recurring
revenue** or a **retainer**, not passive income. Not a lesser model
for that — retainer income is genuinely one of the strongest
freelance business shapes, predictable and compounding as the
client roster grows — just not literally passive.

## Client pricing — real market reference data, not a fixed number

Not a confident single dollar figure — depends on market, experience
level, positioning, and what specific clients can pay. Real,
current (2026) reference ranges instead, to price *from*:

| Category | Typical range |
|---|---|
| Simple brochure/template site | $500–$2,500 |
| Custom Shopify/Webflow build | $3,000–$8,000 |
| **Full custom web application** | **$10,000–$30,000+** |
| Bespoke custom applications (high end) | $15,000–$100,000+ |

**Real, direct positioning note:** a client OmniReality — even a
deliberately scaled-down "beginner" build with fewer OmniProducts —
is genuinely custom Three.js development, not a template or CMS
skin. This belongs in the "full custom web application" tier, not
the brochure-site tier. Pricing it like a simple site would be a
real, meaningful undercharge relative to the actual build.

**Real, current freelance rate bands (US, 2026), for reference:**
- Junior: $40–$65/hr
- Mid-level (custom React/full-stack): $75–$125/hr
- Senior/specialist: $100–$180+/hr
- Full-stack maintenance retainers: **$500–$3,000/month**, industry-
  typical, separate from and in addition to hosting pass-through.

## A structure worth using, not yet decided on

Two separate line items rather than one bundled number:
1. **The build** — a fixed project fee once scope is defined (which
   OmniProducts, how much custom work), not hourly. Fixed pricing
   protects margin against scope creep.
2. **Ongoing management** — a separate monthly retainer covering
   hosting pass-through *plus* real management time, not hosting
   cost with a token markup.

Real, concrete next step suggested, not yet built: a tiered project-
scoping template (e.g. "Tier 1: 3 OmniProducts, static content" vs.
"Tier 3: 8 OmniProducts, live multiplayer") for quoting different
clients consistently rather than re-deriving pricing from scratch
each time.

## Status

Reference notes only. No pricing decision made. No client
agreements exist yet.
