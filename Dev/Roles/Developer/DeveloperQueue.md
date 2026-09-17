# Developer Queue

The official developer todo list. Lives here specifically —
`Dev/Roles/Developer/` — because there are other roles besides
Developer that the project will need to work through; this queue is
this role's, not the only one.

Ordered roughly as raised, not strictly by priority — items near the
top are nearer-term, items at the bottom are explicitly "after that."

Forward-looking only — see `BuildLog.md`, in this same folder, for the
chronological record of what's actually already been built.

---

## 1. OmniLayer — new OmniProduct entry

The generalized version of the layer concept OmniBrowserSpace's own
layer system (Point → OmniReality) is built on. OmniBrowserSpace's
implementation is specifically for the browsing experience;
OmniLayer is the product-line entry for the underlying idea itself.

Not extracted into shared, reusable code yet — OmniBrowserSpace is
still the only real consumer. Extract once a second real consumer
exists, rather than guessing at a generic shape now. Needs its own
design doc once scoped further.

## 2. Per-layer full OmniDraw-style capability, for every layer

Each of the 9 layers (in OmniBrowserSpace, and eventually via
OmniLayer generally) needs:
- Its own shape geometry choice — confirmed as a real reversal of the
  original "all layers share one shape" design; each layer becomes
  its own independent object now, not a scaled copy.
- Its own color and alpha (already built).
- An image browse, for its own texture — confirmed for **every**
  layer, not just the solid-capable ones.
- Rendering tier by radial position, confirmed direction: wireframe
  (Point, Core) → solid + color + optional texture (Object, Class,
  Domain) → translucent color, no texture (Realm, Reality,
  InfiniteReality, OmniReality) — reasoned from real-world planetary/
  atmosphere visualization convention (wireframe reads as
  "measured/schematic," solid+texture as "a real surface to look at,"
  translucent color as "a field you're inside," matching how
  atmosphere layers are conventionally shown without texture, not
  textured surfaces).
- Default shape: Box, for every layer, for now — fewest vertices/
  faces, simplest default, per exchange during scoping.

## 3. Per-shape geometry parameters — cross-cutting, not OmniLayer-only

Real, current limitation: every shape (Torus included) is one fixed
formula with a single "size" knob — e.g.
`TorusGeometry(r * 0.75, r * 0.3, 16, 48)`. No way to actually go
from "donut" to "tunnel," since the ring/tube ratio is baked in, not
exposed.

Proposed approach: a small schema per shape type, describing its own
meaningful knobs (Torus: ring radius, tube thickness, radial/tubular
segments; Box: width/height/depth + their own segment counts; Sphere:
its own segment counts, plus phi/theta start-and-length for partial
spheres; Cylinder: top/bottom radius, height, open-ended vs. capped),
plus one generic UI builder reading that schema — built once, reused
by every inspector, not duplicated per product.

Confirmed scope: **every OmniProduct that offers shape choice**, not
scoped to OmniLayer alone — OmniLayer is the proving ground first,
given it's already mid-build, but the real target is universal.

Explicitly named as the technical foundation for a long-term goal:
using these primitives to build actual structures later (the reason
OmniDraw exists in the first place, per the person's own framing) —
"this will come with time," not rushed now.

## 4. OmniSystem — connecting lines between nodes

For the placement-based formations (Cross, Ring, Sphere, Grid,
Galaxy) — real lines connecting all nodes in a system, showing the
system's actual structure, not just floating unconnected nodes.

For Spiral, Helix, and Star specifically — framed differently: less
about showing the physical structure, more about showing **the path
through** the system. The physical-structure line style should still
remain possible for these too, not removed — just not the intended
default emphasis for this group.

Not yet designed in detail (line style, whether toggleable per
system, whether tied into the existing Group Lock / OmniCore Origin
mechanics) — real next design pass, not decided here.

## 5. OmniDraw — grabbing an object "into a hand" / right-click options

Two related but distinct questions raised, both currently
unanswered by any existing mechanism — confirmed via direct
investigation, not assumed:

- **Right-click-style options on a geometry.** Today, a single click
  on a node only ever does one thing — dispatches `omni:node-selected`,
  which opens the Inspector. No secondary/context menu exists for 3D
  objects anywhere in the codebase (`PanelIcon.js` has a real
  `contextmenu` listener, but only for 2D panel icons/minimized
  orbs, not 3D scene objects). Technically straightforward to add —
  the same real, already-proven pattern, just extended to 3D raycasts.
- **Placing an object "in one of the user's hands."** A genuinely new
  mechanic — an object reference held by one of the four hands (LH/
  RH/OmniHand/ConsciousHand) for quick access, distinct from
  selecting it or opening its Inspector. Not designed yet — which
  hand(s) this applies to, what "holding" an object actually changes
  about interacting with it, and how it relates to the right-click
  menu above (is grabbing an option *inside* that menu, or a
  separate gesture?) are all open.

## 6. OmniNotify — new OmniProduct, now partially real

Every OS needs a way to notify the user of updates. The real
open/close mechanic exists now (`ui/OmniAddressBar.js`,
`ui/OmniNotifyPanel.js`, and per-hand mini address bars in
`ui/Hand.js` — see `Dev/Roles/Developer/BuildLog.md` V23), but there
is still no real notification content or data source — it's a
genuine, honest shell.

## 7. OmniAction / OmniActionPanel — new OmniProduct

Directly inspired by the N64-era Zelda convention: a single action
button whose function changes based on the user's location and
proximity to nearby objects/interactions, rather than a fixed set of
buttons. `OmniActionPanel` is the concrete panel surfacing this;
`OmniAction` is the product it belongs to. Not designed yet beyond
this reference point.

---

## 8. Next major task — after the OmniProducts above

A deliberate break from OmniProduct-building specifically: using
OmniSystem's own formation logic to build **static fields for the
TopRightHandMenu** — rolling out real, working (if deliberately
limited) examples for actual users, specifically framed around the
person's own portfolio. Very limited capability on purpose for this
pass — the goal is a real, shippable example users can actually try,
not a complete feature.

## 9. After that — the 30-letter language mapping

The person will provide all 30 letters of their own language/
naming system. Task: map each letter to an OmniProduct, identify
what already exists vs. what's still unbuilt, and from that, build
an official Product-to-Tier capability list — the real, authoritative
version of the tier system `NAMING_TIER_SYSTEM_DESIGN.md` has been
reasoning toward conceptually.

## 10. Navbar (Top Right Drawer) template/preset system

Not for the person's own portfolio alone — a real template-building
system for other users too, letting them select OmniSystem presets
per node within the Navbar. Genuinely two audiences from the start,
same as OmniBrand's own dual-audience framing. Not scoped in detail
yet — divide-and-conquer vs. sequential build order raised as an
open question; see the response given directly on this.

## 11. OmniBrand — new OmniProduct

A standard Tree Building System, root-object-equivalent to how a
company like Apple or Samsung has "its own reality." Serves as both
a Map (simple users) and a Navigation reference (complex users) —
one structure, not two tools. See `OMNIBRAND_DESIGN.md`.

## 12. Grabbing a Reality — now a real 4-tier ladder

Tier 1 (quick options without entering) already documented. Tier 2
reuses OmniExpression's screen/scene mechanic directly. Tier 3 is
mixed-location placement between two hands, with a combined view in
the middle. Tier 4 has "some spatial aspects," not yet specified.
See `architecture/HAND_TOGGLE_CONTROL_DESIGN.md`.

## 13. OmniPlayer identification badges — new elaboration

An official, game-like access/identification system for OmniProducts,
living inside OmniPlayer — deliberately meant to appeal to gamers and
complex-software-minded users, not just track permission quietly.
Strong suspicion this converges with the tier system and the
permission/access overview rather than being a fourth, separate
system. See `OMNIPLAYER_BADGES_DESIGN.md`.

## 14. Complexity-level interface pattern (Logic-style expand/collapse)

A real, cross-cutting UI convention: any panel should be able to
support a compact form and an expanded form with more settings, the
same way a Logic Pro instrument module does — not two separate
panels for simple vs. complex users, one panel with two depths.
Strong candidate to become a shared, reusable panel behavior rather
than rebuilt per panel. See `OMNIPLAYER_BADGES_DESIGN.md`.

## 15. TopLeftDrawer parity — every item should show its children, like OmniSystem does

Checked directly: right now, exactly **one** of the Left Drawer's 17
top-level items (`⟐OmniSystem`) lists its children
(`ui/Drawer.js`'s `LEFT_ITEMS`) — every other item shows as a bare
label with nothing underneath, even though several of them
(OmniExpression, Admin) do have real sub-panels reachable through
`main.js`'s separate `specialSlots` mechanism that the drawer itself
currently doesn't reflect at all.

Real scope, stated plainly: many of the other 16 items
(`⟐OmniPlayer`, `⟐OmniRealities`, `⟐OmniChronos`, `⟐OmniVision`,
`⟐OmniSense`, `⟐OmniSelect`, `⟐OmniMixer`, and the whole
Experiences/Realities/Times/Governance/Intelligence/Infrastructures/
Objects group) have no real sub-panels built yet at all — giving
these children in the drawer means either genuine `ComingSoonPanel`-
style placeholders (the same honest pattern OmniSystem's own
unbuilt siblings already use) or leaving them bare until something
real exists to list. Not a small, uniform find-and-replace — closer
to a real pass through most of the app's own menu structure.

## 16. OmniFeed — explicitly named as a priority, real dependency unchanged

Raised directly as needing to be prioritized this week. Worth being
exact about the real constraint, unchanged since it was first raised:
OmniFeed's live comments cannot exist frontend-only — the backend
decision (`architecture/BACKEND_ARCHITECTURE_DESIGN.md`) has to
happen first, and no framework/host/database choice has been made
yet. Prioritizing OmniFeed *this week*, concretely, means the actual
first deliverable is making that backend decision — not OmniFeed's
own UI — since everything else about it sits behind that one choice.

---

## A real feasibility note on "all of this by end of week"

Worth naming plainly rather than agreeing by default: items 10
through 16 above, added in a single pass, span a new template/preset
system, a new root-identity product, a 4-tier interaction mechanic,
a new gamified access system, a cross-cutting UI pattern meant to
touch most panels, a real audit-and-rebuild of the entire Left
Drawer's menu structure, and a feature that's hard-blocked on an
undecided backend. Each one is individually reasonable; landing all
of them, fully built, in one week is not a realistic read of the
actual scope involved — flagged here so the queue itself carries
that honesty, not just a conversation that scrolled past it.

A live queue, not a finished plan — expect reordering and additions
as work actually happens. Items above are captured at the depth they
were actually specified; several need a real design pass before
becoming buildable work (see item 4 and 5 especially).

## 17. OmniCryptx — confirmed ahead of the dashboard

The parent security system (OmniCryptexLab, OmniAddressCryptex,
OmniAddress underneath it) is confirmed to be built **before** item
18 below, not after — the dashboard's own passcryptx panel depends on
this existing first. Includes its own panel (vertical scrolls per
ring, reusing OmniKryptx's slider widget directly), the 9-type
per-ring default list (Symbol/Time/Letter/Number/State/px/py/pz/typed
password), and the marble-maze idea (documented, explicitly deferred,
not part of this build). See `architecture/OMNICRYPTEXLAB_DESIGN.md`.

## 18. OmniSense Dashboard + OmniCell creation flow

Builds on the existing, real `OmniStartHUD.js` quadrant shell rather
than a new system. Now confirmed to come after item 17 — its
passcryptx panel needs OmniCryptx to exist first, even in a simple
typed-code form. Real open questions before this is buildable: exact
drag-boundary behavior at a quadrant's edge (free movement confirmed
for mobile's own per-tab panels), and OmniReality Primitives'
classification (not yet done) for default-password-by-default
personal realities. See `omniproducts/OMNISENSE_DASHBOARD_DESIGN.md`.

