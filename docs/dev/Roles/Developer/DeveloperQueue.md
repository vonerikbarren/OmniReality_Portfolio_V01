# Developer Queue

The official developer todo list. Lives here specifically —
`docs/dev/Roles/Developer/` — because there are other roles besides
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

## 5. OmniDraw — right-click options on a geometry — RESOLVED, built in V143

Two related but distinct questions were raised here. Both are now
real code:

- **Placing an object "in one of the user's hands" — built.**
  `systems/OmniGrab.js` (Build Log V24): grab any real node, jitter
  while held, drag toward a hand, and only a genuinely *open* hand
  (its own hamburger menu active) is a valid drop target. 20 checks,
  verified.
- **Right-click-style options on a geometry — built.**
  `systems/OmniNode.js`'s `_bindRaycast()` now binds a real
  `contextmenu` listener extending the exact same raycast pattern
  `PanelIcon.js` proved for 2D icons out to 3D scene objects — a hit
  dispatches `omni:node-contextmenu-request`, and `ui/ToolTipMenu.js`
  opens its existing quick menu (now also carrying Duplicate/Delete)
  pinned to the cursor. See BuildLog.md V143.

## 6. OmniNotify — new OmniProduct, now partially real

Every OS needs a way to notify the user of updates. The real
open/close mechanic exists now (`ui/OmniAddressBar.js`,
`ui/OmniNotifyPanel.js`, and per-hand mini address bars in
`ui/Hand.js` — see `docs/dev/Roles/Developer/BuildLog.md` V23), but there
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

## 18. OmniSense Dashboard + OmniRealityCell creation flow

Builds on the existing, real `OmniStartHUD.js` quadrant shell rather
than a new system. Now confirmed to come after item 17 — its
passcryptx panel needs OmniCryptx to exist first, even in a simple
typed-code form. Real open questions before this is buildable: exact
drag-boundary behavior at a quadrant's edge (free movement confirmed
for mobile's own per-tab panels), and OmniReality Primitives'
classification (not yet done) for default-password-by-default
personal realities. See `omniproducts/OMNISENSE_DASHBOARD_DESIGN.md`.

## 19. OmniPlayer/OmniUser — open threads from today's build

- **Fixed-path camera travel** is still not connected — `NavMapPanel`
  currently snaps the camera directly (fast-travel, for testing);
  the real, constrained-position/free-rotation travel system
  discussed for the landing room hasn't been built or wired to
  OmniPlayer's own realities yet.
- **Boundaries and Languages tabs** in `OmniPlayerDashboard` remain
  honest placeholders — no real design given yet for either.
- **OmniUser's entry point** is currently only reachable through
  OmniPlayer's own Dashboard — a real tension with "OmniUser is for
  non-gamers," worth a direct decision (its own Left Drawer item?)
  rather than leaving non-gamers routed through a gamer-first surface.
- **The landing room's near-wall navigable volume and per-node
  geometry variation** (beyond the current fixed/random shape
  assignment) are both still unbuilt — explicitly saved for later.

## 20. OmniLandingRoom — the /pages content itself

The room (7 nodes, Cross formation) and its NavMapPanel are real;
the actual landing-page content — the local static page in a
`/pages` directory, and each arm's own `OmniBrowserWindow` pointed at
its own section — has not been started. Nothing in `/pages` exists
yet.

## 21. OmniInspector's data-tab — screen-space panel view

Checked directly: the node data-tab is a real 3D mesh with a canvas
painted onto it as a texture, which is why it currently needs to
face the camera to use its own scroll controls. The canvas already
exists as a plain 2D canvas before it becomes a texture, so a
screen-space panel view wouldn't mean rebuilding the rendering — just
relocating where that same canvas visually lives. Not started;
`OmniInspector.js` is 3800+ lines and deserves its own focused pass,
not a rushed edit alongside other work.

## 22. OmniDraw(Dynamic) — still-deferred pieces

Rotation styles (linear/vertical/diagonal whip), the qualitative/
quantitative command panel, and FilterMorphing-style capture+texture+
tooltip remain exactly where they were scoped out to — real, agreed
future work, not started. FilterMorphing itself still doesn't exist
anywhere in the codebase.

## 23. OmniJsonifier — the "shrink as it grows" option

Raised as a real "maybe," not committed to: showing the entire JSON
tree at once, with nodes auto-shrinking in scale as the total node
count grows, as an alternative to the current manual per-branch
toggle. Not designed in detail; the toggle system itself is real and
built.

## 24. The 30-letter Product-to-Tier mapping — a real first pass done

The reclassification itself is done
(`architecture/THE_30_RECLASSIFICATION.md`), and now a real, reasoned
first-pass mapping exists too
(`architecture/OMNIPRODUCTS_ALPHABET_CROSS_ANALYSIS.md`) — each
letter matched to whichever real product's function embodies it,
with genuine double-uses (OmniPlayer, OmniValue, OmniBrowserSpace,
OmniCell each carry more than one letter) and open gaps (Begin's own
match is weak; OmniAction/OmniTruths are matched while still mostly
conceptual) stated plainly. Not yet decided: whether the double-uses
should stay as-is or get pulled apart into named sub-products, and
no actual Product-to-Tier capability list has been built on top of
this mapping yet — this is the proposal it would be built from.

## 25. Audio/sound — not yet incorporated into realities at all

Raised directly while designing OmniState's own Logic-style loop-pad
controls: realities currently have no sound dimension whatsoever —
everything built so far is purely visual. Noted explicitly as a real
gap to come back to, not something to design or build now.

## 26. OmniCommandTerminal — command language, and the tunnel-shooting visual

Renamed from OmniTerminal, per direction — more accurate to its real
legacy (`modules/TerminalTunnel.js`) and to what it literally is and
does. Documentation-only pass complete, no code yet — see
`omniproducts/OMNICOMMANDTERMINAL_COMMAND_LANGUAGE_DESIGN.md`. Two real
pieces: a local-space-parented visual (sending a message down
`TerminalTunnel`'s own cylinder correctly regardless of its
orientation, since a cylinder's length runs along its own local
Y-axis), and a real `⟐`-prefixed command grammar, reusing this
project's own registry pattern so each OmniProduct registers its own
commands rather than one giant switch file. The existing placeholder
hint list (help/ls/cd/create/inspect/present/pocket) was mapped
directly onto real, already-existing events rather than invented
fresh. Three real open questions left unresolved in the doc before
this is buildable — see its own Status section.

Major real expansion added this pass: **OmniScript** — the real name
now given to symbol-shorthand commands (`⟐☰` standing in for `⟐ls`,
for instance), proposed to work alongside the word-based commands
above, not replace them. Connects directly to two already-real,
already-documented systems rather than inventing new ones: OmniSense
(`OMNICRYPTEXLAB_DESIGN.md`), already defined as controlling symbols
and what they grant access to, and `ui/OmniKeys.js`'s own QWERTY
view, which already has real, deliberately-blank "symbol pages"
waiting for exactly this kind of content. Rewarding real OmniScript
use is proposed as a natural fit for Developer Queue item 13
(OmniPlayer's own planned badge system) rather than a new mechanism.

## 27. OmniPocket — RESOLVED, built in V108

Was "genuinely needed next, future notes only" when this entry was
written. Since built and shipped: real Extract/Shortcuts/Attach
system live, wired into the Left Drawer, Admin, and Q2's own pocket
manager. Left here only as a record, not an open item.

## 28. OmniProduct index — pending, from the person's own side

Confirmed real, existing target: the Left Drawer ("the top left
corner menu") is genuinely where all the real Omni-named products
already live (OmniDraw, OmniTranslator, OmniPocket, and the rest).
The person will index/ID these themselves and hand back a real,
finished list — nothing to build here until that list exists. Real
placeholder only, so this doesn't get lost.

## 29. Coordinate grid / altitude ruler — PARTIALLY RESOLVED

Altitude half built and shipped: OmniVerticalMeter, a real Admin
item, live camera-height readout on a fixed screen-edge scale.

Still open: the floor half — a real coordinate grid/ruler over the
ground plane itself for placement. Confirmed scope unchanged: real,
dev/admin access by default, opened up to real visitors specifically
through OmniPlayer, "which will give them more freedom."

Real, direct opinion given on naming, since it was asked for: a
separate real product — **OmniSpaceExplorer** — rather than folding
this into OmniPlayer itself. The real distinction: OmniPlayer is
described as the thing that *grants* that freedom (already the real,
established access-gating mechanism, already wired to OmniPocket as
real inventory); the coordinate-awareness tool itself is a genuinely
separate, real capability being unlocked, not what OmniPlayer's own
core purpose already is. Worth keeping those two ideas distinct
rather than merging them.

## 30. Developer menu access-level gating — real, honest gap

The real ⟐Developer entry and its own sub-menu now exist (above
⟐Admin, same real pattern), but "based on the admin access type the
dev tools will appear" is not built — confirmed directly that no
general access-type/role system exists anywhere in this project yet.
Every slot added to ⟐Developer is visible to anyone who can open the
panel until a real access-level system exists to check against.
WindowInspector (currently Admin's own slot 7) is a real, natural
first candidate to move here once this menu starts filling in —
flagged, not moved, since that's a real, visible change worth
confirming first.

## 31. Data structures & algorithms — real future idea, not built

Raised as a "would this be fun to sandbox" discussion, not a build
request yet. Real architectural conclusion already reached: not a
new module system — new OmniDraw modes, the exact same pattern
Jsonifier/Chat/Log already use. Not a single, monolithic "DS&Algo"
mode either — each new mode should reuse whichever existing real
mechanic actually matches what it demonstrates, rather than forcing
one mechanic to cover everything:
- **⟐OmniDrawSort** — OmniSystem's own real formation-morphing
  (confirmed genuinely built, not just designed: helix/spiral/ring/
  sphere/galaxy/star already work). A fixed set of N nodes, only
  position changes — exactly what a sort algorithm actually does.
- **⟐OmniDrawGraph** — Jsonifier's own real tree engine, generalized
  to allow more than one parent per node (arbitrary edges, cycles).
- **⟐OmniDrawList** — Jsonifier's engine again, simpler: reuses the
  already-existing linear-vertical/linear-horizontal layouts, with
  push/pop as real, animated actions.

All three would spawn nodes through the same, already-proven
omni:node-create-request pipeline everything else uses — selection,
Inspector editing, theming, pooling all stay free. Real new work per
mode is just the model and its own operations (compare-and-swap,
insert/traverse, push/pop), not the rendering underneath.

## 32. OmniRandomizer — real future object, not built

A standard, reusable object type — constantly, never-settling in
geometry/color/material/transparency — representing any concept that
falls within "chance, life, death, trouble, desire" as a category.
Confirmed real, direct answer on the GPU-cost question that was
asked: color/material property animation is effectively free (plain
uniform updates); geometry is the real cost, but only if built the
naive way (CPU-side rebuilding every frame). Built correctly —
swapping between a small set of pre-built shapes, or true continuous
vertex morphing done via a vertex shader with one time uniform
rather than CPU geometry rebuilding — this is cheap enough to be a
genuine, real standard object, matching the original gut instinct.

Real utilization ideas raised, not yet built: a third, honest visual
state for "genuinely undetermined" classification (distinct from
Jsonifier's existing neutral, which just means no highlight, not
"unresolved"); a click-to-settle "collapse the wavefunction"
interaction; ambient, dataless scene dressing; a thematically
consistent loading/pending indicator.

## 33. OmniHand — paging (3 → 10) and OmniDraw as first item — real, unresolved

Raised directly: "there should be three pages for each hand" (then
increase to 10), and OmniDraw should be the first, immediately
viewable/clickable item in OmniHand specifically for mobile users
without a keyboard (distinct from the 'n' key, which is the desktop
path to the same OmniDraw mode picker).

Confirmed real gap, not acted on: checked Hand.js directly and no
paging concept exists anywhere in it — only the fixed 2×2 cell grid
(hamburger/pad/orbiter/radial) already documented there. Not
guessed at or built against an assumption, since building the wrong
paging structure would be real, avoidable rework. Real open
question for whoever picks this up: is "3 pages" a structure from an
earlier planning session not reflected in the current code, or a
new structure to design from scratch now? Needs a real answer before
building.

## 34. Sound Settings — real, unresolved

Explicitly requested while adding Video Wallpaper: "there are some
sounds I think I want with it. We will need a sounds settings so put
that in our todo." Nothing scoped yet beyond the ask itself — this
app already has a real `Sound`/`SoundManager` (see `utils/SoundManager.js`
and every panel's own `_playSound('click'|'open'|'close', ...)` calls),
so the missing piece is a real settings surface: master volume,
per-category or per-sound-effect volume/mute, and wherever "sounds I
want with it [the video wallpaper]" turns out to mean — video's own
audio track volume/mute already exists (Wallpaper Settings' Video
section), so this may mean UI/interaction sound effects specifically,
or something else entirely. Needs a real answer on scope before
building: one global Sound Settings panel (Admin-style), or is this
about a specific feature's sounds?

## 35. Clock circumference sphere — queued, real design questions open

MasterClock (`modules/ChronosFloorClock.js`) is currently a single
Icosahedron node with a floating live-time text label — not a literal
analog clock face. The ask was: a sphere that moves along the
circumference of the clock, as an alternative way to reach the
clock's settings (now real — see `OmniInspector._customOptionsHTML`'s
MasterClock section, added this pass) without opening the generic
node Inspector. Explicitly deferred — "for now put that in the
queue." Real open questions for whoever picks this up: does
MasterClock need to become an actual circular dial first (it isn't
one now)? Is the orbiting sphere meant to visually represent the
current time (like a clock hand), or purely serve as a clickable
handle that opens the settings panel? Needs real answers before
building, same as item 33 above.

## 36. The 30 ↔ OmniProducts — audit, then build the gaps (multi-day)

Explicit direction: "the next phase will be us connecting The_30_
Reclassification to the products they match. We have not built all
the products nor have all the products been fully built. So you see
the mountain of work we have to do." First real work item.

`docs/architecture/THE_30_RECLASSIFICATION.md` (the 30 letters) and
`docs/architecture/OMNIPRODUCTS_ALPHABET_CROSS_ANALYSIS.md` (each
letter matched to a product) both already exist, but the mapping was
never checked against what's actually built vs. stubbed vs. missing —
that audit doesn't exist yet and is genuinely the first step, not an
assumption to skip past:

1. **Audit pass** — go letter by letter through the cross-analysis
   doc, check the matched product's real state in the codebase
   (fully built / partially built / not started), and produce a real
   status table (could live as a new section in the cross-analysis
   doc itself, or a new `docs/architecture/THE_30_BUILD_STATUS.md`).
2. **Gap list** — from that audit, a concrete, ordered build queue of
   whichever products are missing or incomplete — this is where the
   actual "mountain of work" gets broken into real, sequenced pieces
   rather than staying one big undifferentiated pile.
3. Build against that gap list.

Not started — the audit itself is the very next step, before any
product gets touched.

## 37. TopLeftMenu (⟐mniMenu drawer) — reorganize, real crowding

Explicit: "The TopLeftMenu is getting crowded." Confirmed real, not
just a feeling — `ui/Drawer.js`'s ⟐mniMenu currently lists 21
top-level entries (OmniEXP, OmniPlayer, OmniRealities, OmniChronos,
CameraTravelSettings, OmniVision, OmniSense, OmniExpression,
OmniTargeting, NavMap, OmniDraw, OmniTranslator, OmniKeys, OmniSelect,
PanelControl, OmniVisor, OmniBrowser, OmniSystem [+4 children],
OmniMixer, OmniPocket, OmniNavi) in one flat list, plus a second,
already-grouped category block below it (Developer/Admin/Experiences/
Realities/Times/Spaces/Governance/Intelligence/Infrastructures/
Objects) that the top list itself doesn't use.

Real open question, not yet decided: what's the actual reorganization
principle? Candidates, none chosen yet: (a) group the flat 21 into
the same kind of category structure the block below it already uses;
(b) organize by which of The 30 (item 36) each product maps to, which
would make the menu itself a live reflection of the alphabet-to-
product system rather than two separate, disconnected things; (c)
something else entirely. Needs a real decision before rebuilding —
this is a UX/IA pass, not a mechanical resize.

## 38. Hand functions — all four hands, real and complete (after 36)

Explicit, sequenced after the alphabet work: "The next thing are the
functions of the hands specifically. All of them." `ui/Hand.js`
documents four symbols per hand (☰ Hamburger, ⚇ Pad, ⦿ Orbiter, ⬢
Tools) across all four hands (⟐mniHand/TL, ⟐ConsciousHand/TR, ⟐LH/BL,
⟐RH/BR) — 16 cells total.

Confirmed real, current gap: **⦿ Orbiter is undefined on all four
hands** — the file's own header comment says so directly ("Undefined
— last to be specified"), it only ever dispatches a stub
`omni:orbiter` event with no listener anywhere acting on it, and its
button renders with `aria-label="... — undefined"` and a muted,
non-interactive cursor. This is the single clearest, already-confirmed
piece of this item — everything else (Hamburger/Pad/Tools) is at
least defined per-hand already in `HAND_CONFIGS`, even where the
underlying panel it opens may itself be unbuilt (ties back to item 36).

Real open question for whoever picks this up: what is Orbiter
actually for, on each of the four hands? Nothing's been specified —
this needs real design input, not four guessed-at behaviors, before
building. Once Orbiter has an answer, the rest of this item is
confirming/completing whichever Hamburger/Pad/Tools targets are still
stubs per item 36's audit, not new discovery.

## 39. TestCallStack (Dev05) — RESOLVED, built in V136

Requested directly: a place in the Developer menu to track "the
latest updates to the OS" as a tappable checklist, organized by
class/id, persisted so progress survives a reload.

Built as `ui/TestCallStackPanel.js`, wired as Developer specialSlot 5
in `main.js` (`⟐TestCallStack`). Items are grouped by class (a free-
text category, e.g. "Persistence", "Movement", "Wallpaper") with a
checkbox per row; state is stored in
`localStorage['omni:dev:testcallstack:items']` keyed by a stable
per-item id, so checking things off persists across reloads and
future rebuilds of the panel. New rows can be added from the panel
itself (existing class or a new one), and removed with the ✕ on each
row — this is meant to be a living list the person updates as new
work lands, not a fixed one requiring a code edit each time.

Seeded on first open with the real changes delivered in V131–V135
(persistence force-save fix, dash movement, Inspector snap-to-right,
per-node custom options, video wallpaper + the image-mirror fix,
DoubleSide toggle, the docs/business_strategy and docs/dev moves) —
seeding only happens once (`omni:dev:testcallstack:seeded` flag), so
deleting a seeded row won't bring it back on the next open.

## 40. Program — real, per-object step sequence — built in V137

Requested directly: a toggle in the Inspector for a "Program"
capability, applied to any OmniDraw object (not just OmniNavi), with
real commands — move(to), communicate(message), notify(item), plus
rotate/scale — run via GSAP, and a dedicated, growing panel version
of the same editor alongside the Inspector's own quick version. Both
carry a `⟐OmniBegin(Program)` run button.

Built as:
- `systems/OmniProgramCommands.js` — the shared command registry
  (move/rotate/scale/communicate/notify), the step-row HTML generator,
  and `runProgram(mesh, steps, label)`, a real gsap timeline: move/
  rotate/scale genuinely tween the mesh's own transform; communicate/
  notify push through the real, already-wired ⟐OmniNotify pipeline
  (`omni:notify-push`) rather than a new, fake chat system — labeled
  differently ("X says: ..." vs a plain item) so they read distinctly
  even though both land in the same real inbox.
- `systems/OmniInspector.js` — new "▶ Program" accordion section
  (Enabled toggle, step list, + Add Step, Open Full Editor ⟐, and the
  Begin button), stored in the same per-node `ext` object as every
  other Inspector field (`ext.program = { enabled, steps }`), so it
  persists and debounce/force-save the same way everything else here
  already does. Works on any node — not gated to a specific
  `data.label` the way `_customOptionsHTML`'s MasterClock block is.
- `ui/OmniProgramEditorPanel.js` — the dedicated panel, opened via the
  Inspector's "Open Full Editor ⟐" button (`omni:program-panel-open-
  request`), same real save-through-Inspector pattern already proven
  by `ui/OmniInternalPanel.js` (`omni:node-program-set`, no second,
  competing write path). Looks its mesh up live via
  `omniNode.getMeshById(id)` so its own Begin button still works even
  if the Inspector's selection has since moved to a different node.
  No drawer/nav slot yet — reached only from the Inspector, same as
  Internal Data — intentionally minimal for now, meant to grow.

Real, honest gap: running a program is a live animation only — it
does not write the tweened end position/rotation/scale back to the
node's saved transform, so a reload reverts to whatever was last
actually saved via the normal fields. Making it auto-persist would
silently rewrite saved data on every re-run, which felt like the
wrong default without being asked for it directly — flagging this
rather than deciding it silently.

## 41. Auto-Persist + Run Mode, Mini Map overhaul, real map merge,
## video wallpaper slots, FloorManager — built in V138

Five real, separate changes requested together:

**Program Auto-Persist + Run Mode** (`systems/OmniProgramCommands.js`,
Inspector's Program section, `ui/OmniProgramEditorPanel.js`): Run Mode
is Once or Infinite (`gsap.timeline({ repeat: -1 })`); Auto-Persist
writes the tweened end transform back via the real
`omni:node-pos/-rotation/-scale-set` events — once at the end of a
"Once" run, or after every lap for "Infinite" (`onRepeat`, since
`repeat:-1` never fires `onComplete`). The Begin button now tracks its
running timeline and turns into a real Stop button — the only way to
cancel an Infinite run.

**Mini Map, Zelda BotW/TotK-style** (`ui/MiniMap.js`,
`utils/MiniMapSettings.js`, `ui/MiniMapSettingsPanel.js` at Admin04):
default corner moved from bottom-center to top-right, corner is now a
real per-account setting (all 4 corners), toggled with **M**.
Real, honest conflict caught before shipping: 'm' was already
OmniMixer's hotkey — moved OmniMixer to **K** rather than silently
double-binding 'm' (`main.js`, `ui/OmniKeyboardShortcutsPanel.js`
both updated).

**Real map / Q4 merge** (`ui/OmniMapPortals.js` new shared module,
`ui/OmniStartHUD.js`): pulled the portal marker defs out of MiniMap.js
into a shared file so Q4's already-real, bounding-box-fitted map
draws the exact same portal markers plus the live camera position +
heading arrow MiniMap.js shows — genuinely the fuller version of the
same map now, not two maps that could drift apart. Throttled to
~10fps while the Start HUD is open (`update(delta)`), not full
framerate, since it's a simple canvas redraw only ever visible there.

**Video wallpaper — 20 slots** (`utils/WallpaperStorage.js`,
`modules/WallpaperSphere.js`, `ui/WallpaperSettingsPanel.js`):
`wallpaperVideoStore` now has the same 20 slots as the image browser,
with the same click-empty-to-upload/click-filled-to-apply/× grid.
Only one video ever decodes/plays at a time no matter how many are
saved — switching slots disposes the previous `<video>`/VideoTexture
first — so this is more storage, not more simultaneous decode cost. A
real migration path handles an install that saved `videoActive:true`
before slots existed (treated as slot 1).

**FloorManager, Admin15** (`modules/OmniFloorManager.js` new module,
`ui/FloorManagerPanel.js`): create additional floors at any height
(each a `THREE.GridHelper`, not OmniFloor.js's own windowed-tiling
system — deliberately simpler, since this manages a handful of
reference floors, not one at massive scale) and adjust their height
live. A toggleable indicator sits just below screen center (clear of
`ui/OmniAimReticle.js`) and reports whichever floor — ground included
— the camera is currently closest to, live, with the current Y. The
real ground floor (OmniFloor.js, y=0) is listed read-only for
reference; it isn't one of OmniFloorManager's own floors and can't be
edited or removed from here.

## 42. MiniMap circumference coordinates + stop MasterClock stealing the
Inspector — built in V139

**MiniMap circumference coordinates** (`ui/MiniMap.js`): the single
cramped bottom-center coordinate line is gone. Live X / Z / Y now sit
at the E / S / W points of the ring itself (`_drawCompassCoords()`),
each tagged with its compass letter — "E · X", "S · Z", "W · Y" — the
same way BotW/TotK reads a coordinate off its own compass rather than
a single overlay string. Y (elevation) gets its own real reading now
that FloorManager lets the camera's height actually change. Still
clamped inside the circle's own clip mask (`MAP_HALF - 12`), so
nothing gets cut off at the rim; the "OUT" flag (outside
`_worldHalf`) now shows near the NE corner instead of colliding with
the coordinate text.

**MasterClock no longer steals the Inspector** (`systems/OmniNode.js`):
real gap found, not a cosmetic one — `skipAutoSelect: true`
(`modules/ChronosFloorClock.js`) only ever stopped the clock's
Inspector from force-opening at the moment it's *created*; nothing
stopped a later, ordinary raycast click on its small floating
icosahedron from selecting it and popping the Inspector's "⏱ Clock
Settings" section open anyway, which is what was actually happening.
Fixed at the source: `_selectableMeshes()` filters any node whose
`data.skipAutoSelect` is true out of hover, click-select, and
path-click raycasting entirely, so a structural node genuinely never
grabs the Inspector by accident again. `getAllMeshes()` (used by
OmniGrab for dragging) is untouched — grabbing the clock physically is
still allowed, only accidental *selection* is closed off. The clock's
real settings stay reachable the deliberate way: the dedicated
⟐Chronos panel, unaffected by this change.

## 43. Wallpaper — 360° Cubemap shape mode — built in V140

**Real gap identified first, then closed:** every existing wallpaper
shape (Box included) shows the SAME loaded image on every face —
THREE's default box UVs give each face its own full 0-1 range, so a
photo appears whole and repeated 6 times, not as one continuous
space. Direct question from the person: is a bespoke cube-texturing
system smarter than just adding another entry to the existing
shape/texture pipeline? Answer: no — Box already lived in that
pipeline for free. What was actually missing was a *second, distinct*
shape mode built for one continuous 360° space rather than 6 repeats
of one picture.

**`modules/WallpaperSphere.js`** — new `CubemapCross` shape,
alongside the existing curated 11 (not one of `SHAPE_BUILDERS`' real
THREE geometries — a deliberately separate mode). Picking it in the
Shape dropdown still builds a `THREE.BoxGeometry`, but with a
**6-material array** instead of one shared material. One uploaded
image — laid out as the classic skybox "cross" (4 side faces across
the middle row, top face above the front one, bottom below it) — gets
sliced with `sliceCrossImage()` (plain canvas cropping, no library)
into 6 face canvases, each turned into its own `THREE.CanvasTexture`
and assigned to its matching box face in THREE's own material-array
order (+x/-x/+y/-y/+z/-z). The 4 side faces line up edge-to-edge
around the horizon instead of repeating — a real, continuous
360°-on-a-box, not a skinned cube.

**Real, stated limitation — video isn't supported in Cubemap mode.**
Re-slicing a *playing* video into 6 canvases every single frame is a
genuine, avoidable performance cost, so it's blocked outright
(`_applyVideo`/`_applyVideoFromSlot`/`_loadVideoFromStore` all guard
on `this._isCubemap` and warn rather than silently doing nothing).
Switching shape into Cubemap while a video wallpaper is active drops
back to the last image. Images only, for now — a real gap, not
hidden.

**`ui/WallpaperSettingsPanel.js`** — labeled "360° Cubemap (Box)" in
the Shape dropdown (rather than the raw internal key), with a note
explaining the cross-layout requirement and, only while Cubemap is
selected, a second note stating the video limitation above.

**`modules/OmniBrowserSpace.js`** — real cross-module leak caught
before shipping: `BROWSERSPACE_SHAPES` derives from
`WALLPAPER_SHAPES`, which now includes `CubemapCross` — but
OmniBrowserSpace's own, separate `SHAPE_BUILDERS` has no matching
entry (a live browser view is one texture, not a sliced skybox
image), so it would have shown up as a dropdown option that silently
did nothing when picked. Filtered back out at the source
(`REAL_WALLPAPER_SHAPES`) rather than patched over in the panel.

## 44. Event-triggered wallpaper — swap on event, revert after — not built

Raised directly, framed as a real test the person wants to run, not a
finished spec: a user-triggered event should swap the active wallpaper
(image or video) to a specific one for the duration of that event,
then automatically revert to whatever wallpaper was active before it
fired — same shape as Tears of the Kingdom's "ability" transitions
(pass through an object, a specific animation always plays, then
control returns to the normal scene). The reference is the *transient
override-then-restore* pattern, not the specific visual of passing
through an object.

Nothing built yet. Real open questions before this is buildable:
- What counts as "an event" here — a specific node's Program
  step (item 40/41, `communicate`/`notify` already exist as Program
  actions; a new `setWallpaper` action could fit the same registry),
  a proximity/enter trigger, a manual button, something else?
- Does the reverted wallpaper need to be the literal previous
  slot/state (image vs video, which slot), or just "whatever the
  saved default is" — matters for `utils/WallpaperStorage.js`'s
  existing slot system, since "previous" isn't currently tracked
  anywhere, only "currently active."
- Duration: does it revert after a fixed time, after the triggering
  animation/program finishes, or does it stay until a second explicit
  "revert" event fires?
- Movement tests mentioned alongside this are the person's own,
  separate from this feature — noted here only as context for why
  this was raised, not additional scope to build.

**Refinement, added after the first pass above — still a note, explicitly
not to be built yet.** A new section inside `ui/WallpaperSettingsPanel.js`
called **ProgrammedWallpaper**, separate from the existing user-facing
image/video slot browser: **5 sections of 5 rows each (25 total)**.
These are explicitly **static to the files, not user-controllable** —
no upload UI, no slot-click-to-apply like the regular 20-slot browser
has. The person will supply the actual files directly (upload them to
Claude) rather than adding them through the app; what "5 sections"
each represent (5 categories of trigger? 5 groups of events?) hasn't
been specified yet and needs the files themselves before that's
answerable. **Explicit instruction: do not build any of this — this
entry is a note only, waiting on the person's files.** Testing the
V143 build first; will return to this once that's done.

## 45. OmniObjectFX — generalize the locationNode sonar ping into a reusable effect system — not built

Raised directly, documentation-only per explicit instruction: "I would
like that sonar fx to be stored as an OmniObjectFX and it should have
a radius marker. We can use this for so many things. So just document
for a work later file." **Nothing in this entry is built — planning
only.**

**What exists today (V155).** `systems/OmniPointing.js`'s "Highlight
and Edit" action (its real locationNode-creation path) attaches a
one-off sonar-ping effect directly to the locationNode it creates: per
`docs/dev/Roles/Developer/BuildLog.md`'s own V155 entry, three
looping, expanding-and-fading rings (`THREE.RingGeometry`, lying flat)
are added as independent scene objects at the node's world position
(not as children of the tiny node mesh itself, since its own small
scale would shrink the rings to near-nothing), re-attached on both
fresh creation (`omni:node-created`) and page-reload restore
(`omni:node-restored`). That same V155 entry is explicit that this is
a **new, original effect** built for this one feature — grepped for
"sonar"/"Sonar" project-wide at the time with zero other matches, and
no pre-existing "the origin point's own marker" object exists either.
It is locationNode-specific: the ring-build/loop/dispose logic lives
inline in `OmniPointing.js` (and whatever matching read-only display
`systems/OmniInspector.js`'s Location section shows for it), not in
any standalone, reusable module. Nothing else in the project can
attach this effect, or anything like it, to an arbitrary node or mesh.

**Proposed generalization.** A new `OmniObjectFX` system/registry —
same shape as this codebase's other small, focused systems (own file,
own module contract) — that any node or system can attach a named,
reusable visual effect to, rather than each feature re-building its
own one-off version the way `OmniPointing.js` did. Rough shape:

- A **radius marker** as a first-class, separate concept from the
  pulse animation itself — a visible ring/boundary showing the
  effect's actual area of influence/relevance, distinct from (and
  not replaced by) the expanding-and-fading sonar rings, which are an
  *animation*, not a fixed boundary indicator. Worth deciding whether
  the radius marker is always-visible, hover-only, or
  selection-only — not specified by the person yet, flagged here as a
  real open question, not decided.
- Effects beyond sonar ping worth anticipating, since the person's own
  framing is "we can use this for so many things," not scoped to one
  effect: a plain pulse/glow (no expanding rings, just an
  emissive/opacity breathing loop), a proximity-triggered effect (ties
  naturally to the radius marker — "something happens when you're
  inside this radius," distinct from the always-on sonar case),
  orbiting particles/rings, a highlight-on-hover ring. None of these
  are scoped or committed — listed only so the registry's shape isn't
  designed around sonar alone.
- Likely needs its own small per-type registry (mirroring how
  `systems/OmniNode.js`'s own `GEOMETRY_DEFS`/`GEO_LABELS` or
  `ui/OmniDraw.js`'s `SCHEMA` array work elsewhere in this codebase) so
  a new effect type is a new registry entry, not a new one-off file.
- Needs a real decision on lifecycle ownership — does `OmniObjectFX`
  track its own attached-effects registry independently (its own
  `Map<id, fxEntry>`, dispatching its own events, update()'d as its
  own module) the same way `data/NodeLoader.js` keeps its own separate
  node registry from `systems/OmniNode.js`'s? If so, worth deliberately
  avoiding the exact cross-registry gap documented in this same
  version's `BuildLog.md` entry (the Auto-Rotate bug — a feature that
  only knows about one registry silently doing nothing for a node that
  lives in the other) by designing `OmniObjectFX` to key off the
  node's real id and be attachable regardless of which system actually
  owns that node's base mesh.

**Rough API sketch — not committed, illustrative only:**

```js
// Attach a named, reusable effect to any existing mesh/node.
OmniObjectFX.attach(mesh, {
  type   : 'sonar',       // registry key — 'sonar' today, more later
  radius : 2.4,           // world units — drives the radius marker AND
                           // (for sonar) how far the rings expand before fading
  color  : '#ffe14d',
  speed  : 1,             // loop speed multiplier
  showRadiusMarker: true, // the fixed boundary ring, separate from the pulse animation
})

// Later, remove it (node deleted, effect toggled off, etc.)
OmniObjectFX.detach(mesh)   // or by id, matching OmniNode's own getNodeData(id)-style API
```

**Why this matters, in the person's own framing.** Not a
locationNode-only feature — a general-purpose "attach a radius-bounded
visual effect to anything" capability the project will want repeatedly
as more node types and interactions get built (proximity cues, ability
ranges, highlight states, future OmniSystem formations), so it's worth
extracting into one real, reusable system now that a second real use
case (this entry) already exists, rather than each future feature
re-implementing its own copy of `OmniPointing.js`'s inline ring logic
the way the first one had to.

**Explicit instruction: do not build any of this yet — documentation
only, for a later work session.**

---

## 46. Dimensional axes — real data behind the massive nodes — shell built in V158

V158 built the Δ Conscious Hand and ⟐ OmniHand axes (tunnels, massive
container nodes, markers, Υ columns, pad/key control, state,
persistence, events, visibility toggle). See `HAND_TOGGLE_CONTROL_DESIGN.md`,
"Design confirmed 2026-10-04 (dimensional axes)". The behavior is real;
the *content* is not. Follow-ups:

1. **Real data inside the massive nodes.** Each node is a labeled
   translucent container shape today and holds nothing. Decide what a
   node actually contains (its own scene? a loaded Reality?) and how
   it loads, bearing in mind the stated reason for the size: the
   further from world zero the buggier things get, so contents must
   stay inside the node.
2. **Real perspective census for Conscious Hand.** The 8 perspectives
   (Biologist ... Historian) and 5 scale degrees (Human ... Atomic) in
   `data/OmniDimensionalAxesData.js` are placeholders seeded from the
   apple-on-a-table example. The HAND_TOGGLE doc's census idea
   (how many perspective-realities exist in the current reality, and
   what they are) needs a real queryable source first.
3. **Real OmniProduct tier data for OmniHand.** Product names are real
   (⟐mniMenu products with design docs, plus OmniVision) and the 4-tier
   ladder is the real generic one from `NAMING_TIER_SYSTEM_DESIGN.md`,
   but per-product tier availability is not modeled: OmniNavi's doc
   describes 3 tiers, not 4; Tier 3's name is undecided; and which
   products are actually owned/unlocked is not wired to anything. The
   drawer products left off the axis (OmniEXP, OmniRealities,
   OmniTranslator, OmniKeys, OmniSelect, OmniDraw, OmniMixer,
   OmniPocket) need an inclusion decision.
4. **Discovered while building (V158):**
   - *Reaching the far nodes.* OrbitControls caps at `maxDistance = 80`
     and no camera-travel-to-node exists (and neither hand may move the
     camera), so with default controls only the nearest nodes are in
     view; the rest are seen at distance, and the readout is the
     reliable way to see the state. A deliberate, separate "view this
     node" action may be wanted.
   - *Precision / far plane.* Not a problem at this size: camera far is
     100000, the renderer uses a logarithmic depth buffer, there is no
     fog, and the default extent is ~790 units. If nodes ever grow
     toward the 1000-unit VoidBoundary sphere or beyond, revisit; the
     range constants are at the top of `systems/OmniDimensionalAxes.js`.
   - *60° X.* The clock numbers as given (2-8, 10-4) cross at 60°, not
     90°. Decide whether to keep or change `CLOCK` to 1.5/7.5, 10.5/4.5.
   - *Axis height.* Both tunnels are centred on y = 0, so half of each
     sits below the floor grid (the floor is a transparent grid, so it
     reads fine). Raise `AXIS_Y` if that is not wanted.
   - *Readout vs narrow screens.* The top-centre readout can run under
     the top corner hands on a phone-width screen (it ellipsizes, it
     does not reflow).
   - *Tooltips.* Hand tooltips and the pad `padFunction` strings are
     plain text and long-ish; a shorter label may be wanted.
   - *Layer-visibility migration.* Moving OmniBrowserSpace's layer
     toggles into these hands (HAND_TOGGLE doc's original plan) is
     still not done and is now a separate question from the axes.

## 47. OmniAxinator follow-ups — V160

1. **Confirm the top-hand ⚇ fix in a real browser.** Headless tests could not reproduce a dead button; the one real defect found is the MiniMap/hand z-index overlap (fixed, V160). If a top ⚇ still fails, inspect with `document.elementsFromPoint()` at the cell centre and look for another overlay.
2. **Tune the look once seen.** Single knobs at the top of `systems/OmniAxinator.js`: `TUNNEL_COLOR`, `TUNNEL_BODY_OPACITY` / `TUNNEL_GRID_OPACITY`, `NODE_*` colours/opacities, `LABEL_SCREEN_FRAC_NODE` (0.08) / `_LEVEL` (0.055), `LABEL_MIN/MAX_WORLD`.
3. **Real content for X/Y/Z and the 2↔8 / 11↔5 clock diagonals.** Placeholder nodes and root texts (TODO) in `data/OmniAxinatorData.js`. The 12↔6 diagonal is the Z tunnel; 2↔8 overlaps the one-sided Conscious tunnel and 11↔5 the OmniHand tunnel when both are on (same direction, different node positions).
4. **Root semantics.** The Root menu action currently travels to the tunnel's root node; confirm that is what is wanted. X/Y/Z/diagonal roots are the centre node and have no crown/ROOT mark (`showRootMark:false`).
5. **TakeMeThere and OrbitControls.** `omni:orbit-max-distance-set` raises `maxDistance` permanently (main.js) so the camera can sit ~512 units from a node; nothing restores 80. A "return to origin / reset zoom limit" action may be wanted. OmniPointing's menu and ours can both open if OmniPointing is active and a node lies behind the click.
6. **Other channels.** `new OmniAxinator(ctx, {name, storeKey, tunnels, padSource:false, pick:false})` works standalone (tested headlessly); the panel merges `omni:axinator-list` replies by id, so a second axinator with colliding ids would need a name-qualified key in `ui/OmniAxinatorPanel.js` and the `-visible-set` event.
7. **Performance with all tunnels on.** 7 tunnels = ~320 scene objects, label scaling per frame; measure in a real browser. Node shells share geometry per tunnel; tunnels build lazily.
8. **Hand ⚇ stale state.** Hand now follows `omni:pad-state`, but its own click still toggles from `_padActive`; an unrelated future caller that shows a pad without `MovementPad.setVisible` would bypass the event.


## 48. ⟐OmniHands follow-ups — V163

1. **See it in a real browser.** Nothing in V163 was rendered. Check the panel (330 px wide, up to 84vh, scrolls), the drawer sub-menu, and the live clock-hour rebuild.
2. **Orbiter and radial tools are still undefined** (item 38). Each hand view says so; once item 38 defines them, add their settings to `ui/OmniHandsPanel.js` and `utils/OmniHandsSettings.js` (add the key to `DEFAULTS`, read it where used).
3. **Key rebinding.** Bindings are fixed (`MovementPad._mapKey`); the panel only shows them read-only. Rebinding needs a conflict check against main.js `HAND_KEY_BINDINGS` and the numpad rules in `_mapKey`.
4. **Per-hand follow-pads.** "Tunnels follow the pads" is one shared flag (`OmniAxinator._followPads`); a per-hand version would change `_wantOn`.
5. **Two stores for LogicalHand/CreativeHand.** Their speeds stay in `omni:admin:settings` (shared with ⟐CameraMovementOptions) on purpose; if the speeds ever move into `omni:hands-settings-v1`, MovementPad must read both until migrated.
6. **Stagger for ConsciousHand** is not offered (its tunnel def has no `stagger`); add `stagger` to its `DEFAULTS` and def if wanted.
7. **Pad on start ordering.** Applied in `main.js` right after the axes panels via `omni:pad-toggle`; confirm in a real boot that the Hand ⚇ cells and tunnels agree.
8. **Product list.** ⟐OmniHands is not in `OMNIHAND_PRODUCTS` (data/OmniDimensionalAxesData.js, even count kept on purpose) nor in `docs/architecture/DRAWER_TO_30_MAPPING.md` (no concept assigned yet).


## 49. OmniDraw(BehaviorNode) / NodeBehavior follow-ups — V164

1. **See it in a real browser.** Nothing in V164 was rendered. Check the mode grid (desktop + phone), the BehaviorNode panel, ring/line/bead legibility on a white AND a black wallpaper, marker size, and the 1 s start delay after creation.
2. **Hand tunnel opacity reading.** "Lower the transparency by 30%" was applied as 30% *less* transparent (`opacityScale: 1.3` on the `conscious`/`omnihand` defs). If more see-through was meant, set both to `0.7` — one line each in `data/OmniAxinatorData.js`.
3. **Tier B is a metaphor.** Transform..Mediate animate beads, nothing more. A real signal/data layer (packets with typed payloads routed along edges) would replace the `arrive`/`tick` functions of those rows; decide whether that layer is wanted and where it lives.
4. **Package count.** Copilot's list holds 32 behaviours (header said 30); with Leader and Follower the file says `behavior_count: 34`. Confirm the intended count.
5. **Leader/Follower semantics.** Leader = wanders a Lissajous path with followers on its targets list; Follower = Follow with role `Follower`. If a real declared pair (a follower naming its leader, flocks around a leader, leader that follows waypoints) is wanted, extend the two rows.
6. **Edges to moving nodes.** OmniNode edges are baked cylinders; they do not follow a node a behavior is moving. `_rebuildEdgesFor` exists but is not called per frame (cost). Decide whether edges should follow.
7. **Parented / entered-space nodes.** The engine uses `mesh.position` as scene coordinates; nodes parented into an entered space are not treated specially.
8. **Pick in scene.** Depends on scene clicks firing `omni:node-selected` in the current mode; the dropdown always works. Verify with a real mouse (and with OmniPointing/ToolTipMenu active).
9. **One behavior per node; first-claim-wins.** Chaining is nodes targeting nodes. A node that is both a host and another behavior's target is moved by whichever claims it first each frame — may want explicit layering.
10. **Restore snaps.** Stop restores the rest pose instantly (start eases in 0.6 s). Add an ease-out if it looks abrupt.
11. **Position edits while owned.** Editing a node's position in the Inspector or dropping it with OmniGrab while a behavior owns it is overwritten on stop (rest pose). Listen to `omni:node-pos-set`/`-position-set` to update the rest pose if wanted.
12. **Performance.** 64 behaviours x (marker ring + extras) are drawn as one line batch (cap 12 000 segments, dark twin lines double the count). Measure in a browser; lower `MAX_ACTIVE`/`MAX_SEGS` or drop outlines if needed.
13. **Test harness.** Headless tests live in the session scratchpad only (not in the repo); consider adding a `tests/` folder.


## 50. Hand satellites: Speed / Activation / HandSettings follow-ups — V165

1. **See it in a real browser.** Nothing in V165 was rendered. Check the four-button arcs in all four corners (desktop + 360 px phone), the `»` `◎` `✦` `⚙` glyphs, the "×N" label inside the 34 px button, the ammo chip under ✦, the speed popover placement/drag on touch, and that the lower satellites clear the Dock and the hand 2x2 cells.
2. **Class-to-hand split is a proposal.** LogicalHand = Mechanic(-Drift,-Oscillate) + Relational(-Mirror) + Transformational; CreativeHand = Temporal + Emergent + Drift/Oscillate/Mirror (`DEFAULT_MAGAZINE` in `utils/OmniHandsSettings.js`). Decide the real taxonomy of "communication styles"; the data is one table.
3. **Ammo semantics.** Hand-fired behaviours attach to the TARGET node with the nearest node(s) as pair. Confirm that is the intended meaning of "firing"; alternatives: the hand's anchor node as host, or the camera/player as leader (needs an engine change: partners are resolved by node id only).
4. **One behaviour per node.** A hand never overwrites a user-authored behaviour (`blocked`). Decide whether it should (and restore the old one on un-fire).
5. **Hand-fired behaviours edited in the Inspector** keep `source: 'hand:..'` (the form round-trips it) and stay releasable; a different behaviour set there without `source` takes the node out of the hand's list. Confirm.
6. **Targeting.** Selection first, then the node nearest the screen centre (25 deg cone). OmniTargeting/OmniAimReticle have no aim query; if a real "under the reticle" pick is wanted, add one there and call it from `OmniHandAmmo.resolveTarget`.
7. **OmniKeys rotate steps are not scaled by Speed** (only held pad movement is). Say if the center-pad rotation should follow RH speed.
8. **Legacy dash value** (`omni:admin:settings.dashMultiplier`, field in ⟐CameraMovementOptions) is kept but ignored; remove it once nobody needs it.
9. **Activation OFF is session-only** (and the ON pin persists, as the V160 pin always did). Persist OFF across reloads if wanted.
10. **`[` `]` keys** cycle the last-touched lower hand; if both pads are open and neither was touched it is LogicalHand. A per-hand key pair (or a wheel on the chip) is an option.
11. **Speed popover is not a WindowManager window** (no tray/minimize). If it should stack with the other panels, register it as `handspeed`.
12. **Tracer** is one plain line per shot; a pulse on the target mesh (engine `flash`) is not wired because it is private to the engine.
13. **Test harness** is still scratchpad-only (see item 49.13).


## 51. Hand tunnels, origin roots, Speed button — V166 follow-ups

1. **Look at it with real content, on your own wallpaper.** Opacities were judged in headless Chromium (software GL) on a flat white and a flat black background only, not on a photo wallpaper. Knobs: `HAND_TUNNEL_OPACITY_SCALE` (0.7) and `HAND_NODE_OPACITY_SCALE` (0.63 = 0.7 x 0.9) in `data/OmniAxinatorData.js`, `CONTRAST_FRAC` (0.35) and `LIGHT_LUMA` (0.6) in `systems/OmniAxinator.js`. The root crown ring now follows the node scale (0.9 x 0.63).
2. **Tunnel colour is a decision, not a quote.** ConsciousHand's tunnel is now violet (it was grey with a violet marker); OmniHand's tunnel is white but its marker / orb / label border stay orange; CreativeHand's label border is white. Say if any of those should change (`tunnelColor`, `color` in the defs).
3. **LogicalHand 7↔1 and CreativeHand 4↔10 are my choice** (you gave no hours). Nodes sit on the named side only (7 and 4 o'clock), so the four node rays are 330 / 60 / 120 / 210 degrees; the closest pair (Conscious 2 o'clock and CreativeHand 4 o'clock, 60 degrees apart) still keeps nodes 800 units apart, so no shells overlap and no node centre lies in another tunnel's shell (checked pairwise). Alternatives are one number each (`CLOCK.lh.pos` / `CLOCK.rh.pos` in `data/OmniDimensionalAxesData.js`).
4. **Real content for the LH / RH nodes.** Mechanic / Relational / Transformational and Temporal / Emergent / Expressive are placeholders (TODO in `data/OmniAxinatorData.js`). The code only has five behaviour classes (Mechanic, Relational, Transformational, Temporal, Emergent); "Expressive" is a stand-in for the Drift / Oscillate / Mirror group in CreativeHand's magazine. Root texts are placeholder wording too.
5. **Four roots share 0,0,0.** They nest (radii 320 / 280 / 240 / 200) and only the largest is pickable from outside; to pick the smaller ones fly inside or use the panels. Root labels stack by rank among the shown tunnels; a short label per root or a root-only picker may read better.
6. **Placeholder levels.** Tier 5-8 and Scale 6-10 are placeholders; the hard caps are `OMNIHAND_MAX_TIERS` 8 / `CONSCIOUS_MAX_SCALES` 10 (data) and `def.maxLevels` (axinator). Per-product tier availability is still not modelled.
7. **Panels float above the pads.** WindowManager panels start at z 200 and the satellites are 47 on purpose, so an open Inspector (auto-opens over x 202-542 when a node is selected) still covers the left pads' ⏏ and » buttons. If that is the problem you actually saw, either move the Inspector's default position or lift the satellites above panels (and accept them floating over the panel).
8. **Radial menu hygiene.** The closed radial's items had pointer-events:auto inside a pointer-events:none, opacity-0 container; V166 hides the closed container with visibility. Any other component that parks interactive children inside an invisible container in `#omni-ui` (which is itself pointer-events:none) has the same two failure modes; grep for `opacity: 0` + `pointer-events: auto`.
9. **Phones.** At 360x640 the top and bottom pad rows overlap each other (pad geometry, not the satellites); satellites were checked at 390x844 and 360x740. Consider hiding all but the active pad on short screens.
10. **Saved positions.** v2 axis positions are migrated by +1 once into `omni:dimension-axes-v3`; if you want to drop old saves instead, delete `migrateV2` in `systems/OmniDimensionalAxes.js`.
11. **Speed 25x and the tunnel animations.** Step tweens floor at 0.04 s (`MIN_STEP_S`), so 10x-25x all look the same for a single step; the travel stagger flash and the marker ring pulse are not scaled. Hold-repeat stays at the 60 ms floor.
12. **Test harness** still scratchpad-only (see 49.13); V166 added ~135 assertions plus the real-Chromium hit-test / screenshot scripts.


## 52. Scopic states — system build, then defaults — V167 relabel only
See `docs/architecture/SCOPIC_STATES_DESIGN.md`. Built in V167: labels only.
Next: (1) tags + per-hand scopic-state selection + Venn query + four-line HUD
(system first; per-product defaults later); (2) turn tunnel nodes into a
selection UI that stages a MetaState at 0,0,0 (replace TakeMeThere with load);
(3) RightHand activation/ammo should become object-oriented (V165 still fires
behaviours, which are now Process = LeftHand); (4) each OmniProduct declares
its ConsciousState option list; (5) laws-of-a-space on MetaStates acting on
node behaviours; (6) OmniChronos axes (Z position, Y flow, X object) and the
Spaces/Chronos shared traversal component; (7) perspectiveNode as its own
node type; HomeSpace as a separate system.


## 53. Fire / flowchart elements / payloads — V168 first pass
See `docs/omniproducts/OMNI_FLOW_FIRE_DESIGN.md`. Follow-ups:
1. **RH Activation mismatch** (also item 52.3): the RightHand Activation satellite still fires V164 behaviours; make it object-oriented.
2. **Array and Object payloads**; per-word panels (`display.mode` switch); the incoming "shot at the user" interpretation mode; real flowchart semantics (branches, loops).
3. A chain is not restored after reload (elements and edges are; the next shot starts a new chain).
4. OmniNode's selection emissive overrides the `emissive` payload material while selected.
5. The centre button is capped at 44 px (the direction buttons sit 23 px from centre); a larger pad would allow a bigger target.
6. A per-hand ammo model (LH currently hosts the RH's current payload); a Space / global key for Fire.
7. Camera-start oddity: in the headless run the camera starts looking up, so a HUD-centre shot lands above the horizon; check on real hardware.
8. Judge readability on a photo wallpaper and on a touch device; harness (jsdom + Playwright) is still scratchpad-only (see 49.13).
9. Seen only in screenshots (V168): node labels of neighbouring fired elements overlap each other (OmniNode tooltip labels), anchors show their own node label next to the words, and radial page-1 labels are truncated by the existing `splitName` ("Termina", "Decisio", "Materia"). Fixes: hide the label on anchors, wider radial labels.


## 54. Ribbon / OmniNotify / Hands banner — V169 first pass
See `docs/architecture/RIBBON_AND_NOTIFY_DESIGN.md`. Follow-ups:
1. ~~Inspector icon-strip redesign~~ done in V170 (item 55).
2. ~~Fix the double `UI.init`~~ done in V170 (item 55).
3. A user-dragged minimap and dragged floating panels keep px positions; relayout them on `omni:layout-changed` if wanted.
4. No real Open / import handler exists, so the ribbon has no Open button; add one when a loader exists.
5. The disabled Orbiter cell gets no tip (disabled buttons swallow mouse events); wrap or use pointer-events handling.
6. Ctrl/Cmd+F1 not bound: F1 is the terminal. Pick another key if a ribbon toggle shortcut is wanted.
7. No start-menu app list exists, so the Home tab has none.
8. Real-touch long-press and the HandSpeed popover tip not checked on hardware.


## 55. One UI.init + condensed Inspector — V170
See `docs/architecture/RIBBON_AND_NOTIFY_DESIGN.md` (Inspector strip section). Follow-ups:
1. Real-device check: the strip icons are 28x34 px at 390px wide (11 icons in 340px); confirm they are comfortable to tap, widen or let the strip scroll if not.
2. No "non-default content" dot on strip icons (skipped as not cheap: every section would need its own default test).
3. The Inspector title wraps to two lines next to the 8 header buttons on a 340px panel (pre-existing); shorten the title or drop it on phones.
4. Phone drag: the header can still be dragged on a phone; it is re-docked at the left edge only when the panel is opened or the breakpoint is crossed.
5. WindowManager's cascade puts other panels at x ~200+ too; on phones several of them are partly off-screen (seen: FloorManager at 390px). Same fix as the Inspector's `_placeForViewport` could be generalised in `WindowManager.register`.
6. The extra four `Hand` modules in main.js were removed; if something is later found to rely on a second hand set, `ui.hands` is the one to use.
7. Not checked on hardware: touch scrolling inside an open section, prefers-reduced-motion, rotating a phone while a section is open (only the resize path was simulated).
8. Pre-existing: older suites (axinator_test, behavior_integ) fail identically on V169 when pointed at it; hands_test position readout, integ_test groups, v165 speed-limit checks as already known.


## 56. OmniChronos player + sequencer + node Time property — V172
See `docs/omniproducts/OMNICHRONOS_SEQUENCER_DESIGN.md` and `OMNICHRONOS_DESIGN.md`. Follow-ups:
1. Behaviours: a clip only shows / hides its node (the behaviour engine skips hidden nodes). Starting / stopping a configured behaviour or auto-rotate exactly at clip in / out (and restoring its rest pose) is not done; position / rotation keyframes fight an active behaviour or auto-rotate on the same node.
2. No reverse play and no speed ramping (`PrimaryTime` never reverses, by design); `loop` repeats a clip's keyframe cycle only, there is no nested sequence.
3. Overlaps on one track are allowed (the later-starting clip wins); no ripple / roll / slip tools, no marquee select, no copy / paste of clips, no undo / redo of timeline edits.
4. Clips of a node that no longer exists (deleted while the app was closed) stay as hatched "missing" blocks; deleting the node in the running app removes its clips, as does Clear Scene.
5. Not checked on hardware: touch drag on clips / ruler, two-finger pinch zoom (best effort via touchmove), phone keyboards (shortcuts are desktop only).
6. The Inspector strip now holds 12 icons; check tap size on a 340 px panel (item 55.1).
7. Marker rename uses `prompt()`; replace with an inline editor. Markers have no timeline-lane of their own (the data model has a `marker` track kind, unused).
8. Window opacity (Admin "panel opacity") applies to the whole window including the timeline lanes.
9. Older suites expect 11 Inspector sections / no Chronos ribbon buttons: `v170_test` (3 checks) and `v169_test` (section-count, "every ribbon button exercised", icon order) need their counts updated; the v169 banner checks and the already-known v165 / hands / integ / axinator / behavior_integ failures are unchanged.
10. The ten future sub-panels (TimeLive, TimeTool, Calendar, Planner ...), audio, video clips / texture-video sync, render / export, multi-camera: out of scope, still design only.
11. Pre-existing, found while building the Time section: the Inspector's `<button class="oi-toggle">` switches (Domain, Auto-Rotate axes, Behavior enabled) have no matching CSS (the `.oi-toggle` rule styles the label + checkbox structure), so they render as plain white boxes. The Time section uses the label + checkbox structure; the older ones were left alone.
12. `oc-*` CSS class names are shared between OmniChat and (before V172) OmniChronos (`.oc-header`, `.oc-tab`); OmniChronos now uses `chr-*`. Other panels may share short prefixes the same way.

## 57. OmniValue + OmniStore + exchange radial (sandbox) — V176
See `docs/omniproducts/OMNIVALUE_STORE_EXCHANGE_BUILD.md`. Follow-ups:
1. V177: D3 views in `#exchange-chart-slot` fed by `toHierarchy()` / `toFlows()` (treemap, sankey, sunburst); not started.
2. Lifecycle tunnel scene reading `product.lifecycle`.
3. Quality assessment is self-reported; a real method is an open question.
4. Video textures are untested on real devices; image data URLs degrade (dropped) when the 1.5MB store quota is exceeded.
5. `produce` as payment (a `produce -> credits` edge) is not built; `produce` and `reputation` are `payable:false`.
6. (V178: product add / edit / delete / duplicate now exist.) No buy-price editing, no several-stores-per-identity.
7. Real two-account trades and entities are not built; PrimaryForce (backward purpose), affidavit and the wellness-delta of a trade are not built.
8. Arbitrage loops between edges are unguarded (quote only looks at paths up to 3 edges).
9. `omni:orbit-target-set` makes main.js treat the shelf as the selected pivot until a node is deselected.
10. The store HUD (z-index 44) sits under the Inspector; `--omni-dock-h` does not exist (52px fallback in `OmniStoreLayout`).
11. No hover on touch; the 390px bottom sheet needs a scroll to reach the fourth spoke; touch is unverified.
12. Fees are rounded up to the type step, so tiny quantities pay a whole step.
13. Older suites: v169 / v170 section-count checks are unchanged by this version.

## 58. OmniStoreSettings (user) + DevOmniStoreSettings (dev only) — V177
See `docs/omniproducts/OMNISTORE_SETTINGS_DESIGN.md` (the `<System>Settings` / `Dev<System>Settings` convention) and `buildOrder_OmniStore_V01.md` items 1 and 2 (DONE). Follow-ups:
1. (DONE in V178, see item 59.) BuildOrder item 3: the user-facing catalog import + AI template inside OmniStoreSettings (paste / upload, the same preview and undo as the dev panel). The schema, validator and the dev "Copy AI prompt + schema" prototype exist; the user flow, manual product add / edit / delete and section editing do not.
2. BuildOrder item 4: layouts. Store-type records carry `layout` (`shelf`, `ring`, `aisle`, `island`) as data only; nothing reads it. OmniStoreSettings shows "Layout: Shelf wall" read-only.
3. Store-type records do not drive a store yet: a record's `theme.colors` / `theme.backdrop` ids are not applied (item 6).
4. Items per page and the readout need a real GPU / phone: software GL gave fps 1 and 92 draw calls for 16 products. No mesh-budget knob, no accepted-exchange-form or quality-scale editors (they were in the item 1 brief).
5. The undo snapshot of a catalog import lives in memory only (lost on reload). (V178: the user panel persists it in `omni:store-undo-v1`; the dev panel's undo is still memory only.)
6. User presets are shared by every store (max 20); settings are keyed per store id but the model still has one store per identity.
7. `colors.backdrop` is a reserved override of `backdrop.color` (no UI); `schema.sections` is informational (custom sections cannot be imported); `category` is free text since V178 and `valueType` is still `produce` in the model.
8. The dev panel is in the ⟐Developer group, which still has no access gating (no role system exists).
9. Phones: both panels are a 42vh bottom sheet that covers the bottom hands (like the exchange sheet); the HUD hides while one is open. Touch is unverified.
10. Backdrop: opaque dome writes depth, so objects beyond 120 units from the shelf are hidden while it is on; the translucent dome only tints. The camera is clamped by the app near the origin, so it cannot leave the dome today; if that clamp is ever lifted, the hide-when-far rule (0.92 R) takes over.
11. Older suites: v169's "every ribbon button exercised" lists `store-settings` and `dev-store` as unexercised (same known-failure style as the Value group buttons).
12. Settings are not synced live between two open browser tabs (localStorage is read on load; no storage event listener).


## 59. Catalog import + AI template + manual product editing (user) — V178
See `docs/omniproducts/OMNISTORE_SETTINGS_DESIGN.md` ("User catalog import") and `buildOrder_OmniStore_V01.md` item 3 (DONE). Follow-ups:
1. CSV / spreadsheet import (a second input beside the AI JSON), and a "starter" store-type template (BuildOrder item 6) that pre-fills the description step.
2. Image upload / hosting: products take https links or small data URLs only; the 1.5 MB per-store data-URL budget is unchanged.
3. The AI step is outside the app by design; test with several real assistants (reply variety: fences, prose, curly quotes, truncated long lists, 100+ products) and tune `buildAiPrompt` / `extractJson`. Replies with curly quotes are reported, not repaired (decision); revisit if real replies make that common.
4. Undo is one step: a new import replaces the snapshot and undo discards manual edits made after the import. A multi-step history would need a bounded list under `omni:store-undo-v1`.
5. The empty store (after Delete all) shows an empty shelf wall with no hint in the scene; add an in-scene "No products yet" note. There is no "restore sample produce" button for users (the dev panel has Reset sandbox store).
6. Sections are still not editable or importable (the schema ignores `sections`); a catalog can only use the four identity sections. Products land in the sections the answer names, default Physical.
7. Category is free text but only `vegetable` changes the tile tint; `valueType` stays `produce` / `qualityScale` `ripeness` on every product, so a bakery's quality field is not meaningful yet.
8. Phones: the Catalog sheet is 56vh and covers the bottom hands; the form and the preview table are scroll areas inside the sheet. Touch is unverified.
9. Merge by name matches case-insensitive full names only (no fuzzy matching); two catalog rows with the same name collapse onto one existing product (the first wins, the second is added as new).
10. `WindowManager.watchPanelOpacity` never unregisters its `omni:admin-settings-saved` listener (one leak per panel destroy; panels are normally never destroyed).
11. Manual edit of `accept` (sell-side forms), lifecycle and reviews is not in the form (they are kept untouched on edit; lifecycle can only arrive through an import).

## 60. Swappable store layouts: shelf / ring / aisle / island — V179
See `docs/omniproducts/OMNISTORE_LAYOUTS_DESIGN.md` and `buildOrder_OmniStore_V01.md` item 4 (DONE). Follow-ups:
1. BuildOrder item 6: store types should write their record's `layout` into the store's settings when a store is created (`Look.setSettings({layout})`); today only the dev "Preview layout" button reads a record's layout. The mall hub (item 10) keeps one anchor + one layout id per store.
2. Real GPU / phone / touch: only software GL was available. Measure frame rate and draw calls per layout at 24 and 60 products on real hardware; the mesh counts (a cube is 1 mesh, a disc 3) are the main cost, furniture is 2..26 meshes. Touch hover does not exist, the phone sheet hides the HUD, so on a phone the aisle stop buttons and the ring Enter button need the sheet closed (the selector in the sheet and the HUD chip are two ways to switch).
3. Aisle: a stop camera stands in the walkway, so the nearest bay's products are large at the edges of the view (normal corridor perspective). If that reads badly on a real device try a higher camera, a wider walkway, or hiding the previous bay. Arrow-key stepping is not bound (ui/MovementPad.js and ui/OmniKeys.js own the arrow keys globally); a focus-scoped binding on the HUD would be safe if wanted.
4. Ring: products face the centre, so from outside you see their backs (identical on cubes, two-sided on discs); with few products the ring is sparse (radius floor 2.6). No central pillar (the inside camera stands there). Inside view is a close-up on small rings.
5. Island: tiers rise toward the back and products face +z / up; from behind they are tilted away. A round island or a double-sided gable would read better from all sides.
6. Furniture is flat unlit colours from the three shelf colours (the floor is the plank colour x 0.72); no per-layout colours, textures, lighting or shadows.
7. A layout is per store, not per section: the section chips still only filter the products. Per-section layouts are not built.
8. The selected / hover rings are placed from the slot's base pose and ignore the idle sway (like V178); the products sway +-0.35 rad around their base facing in every layout.
9. `omni:store-layout-set {preview:true}` is ignored while the store is closed; the dev panel says so.
10. `_trimFurniture()` runs on close; slot meshes are never shrunk (a store that once showed 60 products keeps 60 pooled slots, 4 meshes each).
11. Older suites: the retargeted v177 UI suite had two assertions rewritten (read-only layout row -> 4-card selector; "not built" options -> none). Pre-existing failures are unchanged (v165 speed limits, hands_test readout, integ_test groups, axinator_test, behavior_integ, v166 opacity, v169 / v170 section counts).

## 61. Keep the user guide in sync — V180
See `docs/user-guide/00_How_To_Maintain_This_Guide.md`. Follow-ups:
1. Fix or decide the doc/code mismatches listed in `docs/user-guide/README.md` (shortcuts panel omissions, six-vs-eight picker modes in the Create tooltip, empty LH GRID tab, RH placeholder panel, stale header comments, "D3 views arrive in V177" text, possible R/F double move). Then update the guide.
2. Unverified items (touch, phone layout, GPU, fullscreen, audio, file pickers) need a human on a real device; then drop them from the guide's Unverified appendix.
3. When DeeperSettings D5 (Undo Options, undo/redo, clipboard) ships, add an undo/redo and clipboard chapter and update the keyboard cheatsheet's "keys that do NOT exist yet" table.
