# Live Realities — OmniChat, OmniTranslator, OmniFeed, OmniState

Design conversation, documented per direction before any of this is
built. Order of operations, as given: OmniChat first (simple panel),
then OmniTranslate, then OmniFeed. OmniState (the reality state
machine) applies across all of them once "live" realities exist.

## The real conceptual shift being named here

Everything built up to this point — OmniDraw's Static/Dynamic/
Jsonifier/OmniCell modes, every SectionCarousel — is fundamentally
static: content that sits still until a user acts on it. Confirmed
directly: going forward, outside of Nav Items, most new builds are
"live realities" — content that runs an actual, ongoing program and
actively communicates something to the user, not just geometry
waiting to be looked at. OmniDraw(Dynamic)'s word-ticker is named as
the one existing precedent closest to this, though still a distant
one.

## OmniChat (first)

A message window, bottom-right anchored, normal-sized on wide
screens. Detachable — but closing it always returns it to its dock
anchor point via a "genie" animation (the real, established
minimize-toward-an-icon effect, stretching back toward the dock
rather than just fading out).

Like Inspector's own material preview, wants a live preview of its
"communication reality" — a real, defined kind of content
(currently named but undefined): a geometry that morphs between
forms (square → sphere, cylinder-horizontal → cylinder-vertical),
not just static shape swaps but real, animated transitions between
them. Real orbit rotation on top, representing the loop itself.

**First, real, buildable version**: a single dummy communication
reality — one shape, morphing through four real geometries in a
continuous loop, with real orbit rotation as the visual sign that
it's looping. A placeholder proving the real mechanic, not a final
design.

## OmniTranslator (second)

A subtitle-style space — translates whatever's active in a reality
into the user's own preferred language. Two real containers: a
vertical vault on the right, a horizontal vault along the bottom
(above the dock and minimap).

The right-side vault is described as two things at once: real
storage for a reality's own geometry, and a real navigation device —
realities become shortcuts a user can jump to, and not just into the
reality itself but to a specific point in that reality's own time
*and* space (a real, direct link to OmniChronos's own time system).

Confirmed as working together with OmniPresenter and
OmniExpressionTool, not standalone.

## OmniFeed (third)

A "dual experience" — live data moving in the scene. Confirmed
directly: `OmniFeedObject = OmniReality = OmniCommunication` — these
three names describe the same real thing from different angles, not
three separate systems. Starting with the basics; the real, full
scope is intentionally still open.

## OmniState — the real state machine behind every live reality

`userOmniRealityStateMachine`, `OmniState(Bool)` for short — a real
on/off switch for what a reality's own contents are actively doing.
Each reality is described as its own cog: does its own thing
independently, but can also be consequential — one reality's real
state affecting another's ("if A then B," shown as part of the
reality itself). User-controlled. Applies even to realities that
never move position, if their own rotation or form is what's
changing.

## Real questions, before any of this is built

1. **The genie-tail animation** — confirming this means the real,
   established "stretch back toward an anchor icon" minimize effect
   (the same family as macOS's own Dock genie effect), not a
   different, literal tail/trail visual.
2. **The four dummy geometries** — square/sphere/cylinder-h/
   cylinder-v were given as an example, not necessarily final. Real
   or placeholder set for the actual first build?
3. **"Vault," precisely** — read as a real container holding
   multiple items (a tray/sidebar of reality shortcuts), not a
   single object. Confirming before this becomes real UI.
4. **OmniState's "if A then B"** — is this meant to be user-authored
   (a real rule the user sets up between two specific realities), or
   a fixed, built-in relationship defined per reality by whoever
   builds it?

## Real clarifications (confirmed this pass)

**Genie tail** — confirmed: the real, familiar dock-minimize stretch
effect.

**The four-plus morphing geometries** — no fixed set required, just
needs to be 4 or more real, distinct forms. Open to whatever reads
well.

**The vault's real visual identity** — not a structural difference
from a normal panel, a real, deliberate visual one: it should look
like an actual vault, distinct from every other panel in the
project, marked out with something like a double-line border. This
sits under a real, named theme for this whole area — **The
SystemsOfSpacialSystems** — confirmed as the umbrella design language
for OmniChat/OmniTranslator/OmniFeed and whatever else lives in this
"live realities" layer, distinct from the visual language everything
else so far has used.

**OmniState — the real, full shape of it**

The core metaphor, given directly: a video player's play/pause
controls, except the user is inside the video while operating them —
same real controls, a completely different real experience from
watching one.

This sits at the highest level of OmniChronos, specifically
controlling a *reality's own* overall state — genuinely different
from the state of individual things living inside that reality.
OmniChronos will use OmniState as its top level once built, but
OmniState is confirmed as its own real, standalone product too — it
has real functions outside of time entirely, not only within
OmniChronos.

The real point of a reality, as described: combinatorial or
cumulative — the value isn't one isolated mechanism but multiple
mechanisms visibly combining, literally showing how a reality
actually operates rather than hiding it. Three real axes given for
how that combination happens: the axiomatic tool itself (the base,
irreducible building block — OmniDraw, OmniCell, etc.), skill level
with that tool, and using multiple tools together. The earlier "if A
then B" was confirmed as just an illustrative example, not the
literal, final mechanism.

## TheOmniStatePanelControls — the real, full shape of OmniState's UI

Confirmed: real, visible controls, not purely programmatic. Named
directly: **TheOmniStatePanelControls**.

**Bottom section** — standard video-player transport controls
(play/pause and the rest), in their own dedicated section at the
bottom of the panel. This is the literal "you're inside the video"
control set described earlier.

**Above it — a real Logic Pro Live Loops-style grid.** Same real
logic as Apple Logic's own loop-pad board, but driving whatever's in
a reality's own object instead of only sound. Directly, honestly
noted in the same breath: sound itself has no place in realities at
all yet — logged as its own real, separate future item (Developer
Queue #25), not something this build touches.

**Real hierarchy, top-down:**
1. Starts with a list of the real *groups* of items in the scene —
   not individual objects at the top level.
2. Clicking a layer button on a group drills into it, showing that
   specific group's own individual loops.

**A separate, additional page** for a real `byCount` iterator — a
genuine conditional trigger distinct from the main loop grid: e.g.
"every 6 iterations of the scene, run these specific programs."
Confirmed as logically sufficient for this first pass.

## Grouping and iteration — resolved

**Grouping** — confirmed: any real nodeGroup at all, deliberately,
not scoped to one specific existing system (not exclusively
OmniStructure's own tree, not exclusively OmniSystem's own
formations).

**Iteration — the real tension, and its resolution.** Given directly:
"everything designed to run at least once before it iterates again"
— then immediately, honestly flagged as breaking down once multiple
realities each carry their own distinct context, since a single,
scene-wide definition of "everything" can't hold across realities
that don't share the same running set at all.

Proposed resolution, reasoned from a principle already established
elsewhere in this doc: a reality's own state is already treated as
genuinely separate from the state of things inside it (OmniState's
core distinction). Iteration should follow the same real rule —
**scoped per reality, not per scene.** Each reality counts its own
completions on its own terms, defined by its own context; a
`byCount` trigger of "every 6" means six of that specific reality's
own iterations, not a shared, global tick. Two realities can
genuinely run at different rates without that being a bug — that's
context actually mattering, not a flaw in the count.

## OmniTranslator — major expansion: the full 4-sided vault system

What started as two vaults (right/bottom) became four, deliberately,
once the idea was fully thought through. Real definition given:
**reality = node || nodeGroups.** Each side is its own real,
distinct function, by reality:

- **Top** — Notification Realities: alerts the user to a reality's
  own urgent/important aspects.
- **Right** — Problems, Risks, and other concerns within the reality.
- **Bottom** — Tools, skills, abilities, attributes, and hints for
  the reality.
- **Left** — Solutions, Algorithms, Processes, Instructions for
  those problems.

All four carry the real double-border-plus-glow vault look,
confirmed specific to OmniTranslator, not OmniChat.

Real, open question before this is buildable: whether Right and
Left are a strict pairing (one specific problem directly linked to
one specific solution, positioned across from it) or two independent
pools with no forced 1:1 relationship.

**Real new dependency this creates**: an icon/identity per node,
since sorting things onto four sides by type requires nodes to
actually carry a type. Two real candidate mechanisms raised: small
3D instances as icons, or dragging a reality onto a side to extract
its type from it directly. This also means nodes get real labels —
enabling both static and dynamic sorting once built.

Also proposed: a real identification system linking realities to
each other based on their own screen position/side, so users can
identify related realities by type across the scene, not just within
one reality's own four vaults.

**Real scope decision**: this is now several genuine subsystems —
the four vaults, node typing/labeling, drag-to-extract, cross-reality
linking — not one panel addition. Kept in its own, already-agreed
place after OmniChat, not folded into OmniChat's own build. OmniChat
itself stays exactly as already scoped.

**On types, specifically** — real recommendation given, not a
speculative taxonomy: build only what OmniChat/OmniCommunicate
actually needs first, and let the real type system grow from that
real example, rather than designing a full classification before
anything real exists to classify against. Same real reasoning
already applied to OmniLayer in the Developer Queue (extract the
general shape once a second real consumer exists, not before).

## OmniState controls — confirmed for this first build too

Both the morphing preview *and* basic play/pause controls, not
morphing alone — with the explicit fallback that controls could be
pushed to a following pass if this proves too much for one build.
Default confirmed: loops animations, transformations, *and*
mutations together, not just simple animation.

## OmniChat — built

The real, first build in this layer. `ui/OmniChat.js`. Dockable,
bottom-right anchored, detachable, genie-return on close targeting
`#omni-dock`'s own real, live position — not a guessed one. Full
Unicode text field (a plain `<input>` already accepts any real
Unicode character; nothing added restricts it). A Terminal tab,
black with transparency, wired to the same real
`omni:terminal-invoke`/`omni:terminal-dismiss` events
`modules/TerminalTunnel.js` already listens for — a real find made
before building, connecting to existing, partially-built
infrastructure rather than building a second, disconnected terminal.

The dummy communication reality preview: one geometry cycling
through four real forms (box/sphere/cylinder-horizontal/
cylinder-vertical, an open set as confirmed, not a fixed spec),
looping continuously, with real orbit rotation as the visible sign
it's alive. Honestly a cross-fade/scale transition between discrete
shapes, not true vertex-level morphing — the right, proportionate
choice for a confirmed dummy, with true morphing logged as real,
separate future work once shapes' topology can be matched. Loops
animation, transformation, and mutation together by default, per
direction. Basic play/pause included, the first real piece of
TheOmniStatePanelControls — the fuller loop-grid/groups system
remains its own, later build.

Toggled via a new 'c' keybinding for now (matching OmniStartHUD's
own Enter-key pattern) — a real Dock icon trigger is a reasonable
follow-up, not done in this pass since Dock's own icon API lives in
a different file (`ui/index.js`) not yet investigated.

17 checks, all passing — including direct verification that the
genie animation's real target offset exactly matches the dock's own
actual, live position, and that the preview setup's WebGL failure
handling learns directly from the same lesson found fixing
OmniStartHUD's own preview diamond.

## OmniTranslator — the real, visual shell built

Same proven "shell first" approach as OmniStartHUD. Four real vault
containers (`ui/OmniTranslator.js`), correctly positioned (Top
centered near the screen's own top edge, Right and Left as vertical
strips, Bottom centered above the dock and minimap), each carrying
the confirmed "SystemsOfSpacialSystems" double-border-plus-glow
identity and its own correct label, with an honest empty state —
matching this project's own established pattern for something not
yet filled in, rather than fake placeholder content.

Deliberately not attempted in this pass: node typing/labeling,
drag-to-extract, cross-reality linking, and the Right/Left pairing
question — all genuinely still open, per the design above. Toggled
via a new 't' keybinding and reachable from the Left Drawer as
⟐OmniTranslator, matching OmniChat's own dual-path pattern. 13
checks, all passing.

## OmniChat — the message-shooting mechanic, built

A real, new toolbar in OmniChat's Chat tab (between header and
content, per direct request) — font, size, alignment, and Form
(1–6). Confirmed: Form splits one message into that many pieces, not
N copies. Sending a message now launches its pieces forward along
the camera's own real, fixed-at-launch direction, traveling the
confirmed 2000-unit distance before real disposal.

Forms 1–5 use real, square planes — confirmed as a visual-
consistency choice, not a performance one (a flat plane's triangle
count is identical regardless of aspect ratio). Form 6 uses real
cubes — the confirmed lowest-cost material — which genuinely
dismantle partway through their flight: the real 3D mesh is actually
disposed, and the piece continues as a real DOM element reusing
ToolTipMenu's own already-established `.ttm-header` look, tracked via
the same real world-to-screen projection ToolTipMenu itself already
uses. Every piece visibly fades/flickers/jitters during the final
stretch before disposal, per direct request for a visible
dissolve/glitch effect rather than silent removal.

A real bug caught during testing, not assumed correct: the initial
word-grouping algorithm for splitting a message into N pieces could
leave later pieces empty depending on word-length distribution, even
when there were enough words for all N. Replaced with a guaranteed-
correct round-based distribution. 17 checks, all passing.

## OmniChat — the JSON tab, built

A real, third tab confirmed and built: OmniChat(Text, JSON,
Terminal). Two real findings made before building, not assumed:
checked directly that wallpaper has no actual multi-profile system —
just one single, global saved configuration under one key — so
`utils/JsonChatMessageOptions.js` matches that real pattern exactly,
not a new profile system. Separately, confirmed OmniDraw's own
Transform schema (`ui/OmniDraw.js`) already has the exact real
px/py/pz/rx/ry/rz/sx/sy/sz fields and ranges being referenced —
reused directly rather than inventing new ones.

Real, meaningful difference from text messages: a JSON tree travels
from its chosen origin (user/left/right/ceiling/ground/instant-at-
the-point) toward its explicit destination transform and genuinely
settles there, remaining in the scene — not disposed the way a
transient text message is, since the person is deliberately placing
something lasting, not firing off an effect. Form 1–6 (shape) and
Form 6's real cube-to-tooltip dismantle are reused exactly as already
proven for text. Real JSON validation with an honest error for
invalid input, not a silent failure. 17 checks, all passing,
including a real regression check confirming text messages are
completely unaffected by this addition.

## OmniTranslator — content logic resolved and built

Both real, open questions resolved directly, then built. Pairing:
independent pools, not strict Right/Left linking — same real
reasoning already applied to OmniCommunicate's own type system,
avoiding forced structure a real relationship won't always hold.

Node typing: reused a real, existing, lower-risk pattern rather than
building new drag-detection — OmniGrab's own `sendToHand` already
proved "menu-driven placement, no dragging required" for hands;
`OmniTranslator.addToVault()` and a new vault picker in ToolTipMenu's
own quick menu apply the exact same real pattern to the four vaults.
A node's own real, existing label is its identity — no separate
type-classification system built, honestly, since nothing real has
needed one yet.

`utils/OmniTranslatorVaults.js` — real, saved, independent lists per
side. Vaults now render real entries once added, replacing the empty
state; clicking an entry removes it. 9 checks, all passing, including
direct, end-to-end confirmation that the two pools genuinely stay
independent through the full real flow, not just at the data layer.

## Status

OmniChat built and tested. OmniTranslator's real, visual shell and
its content logic (node typing, vault entries) both built and
tested — cross-reality linking remains a real, separate, later idea.
OmniFeed and the fuller TheOmniStatePanelControls remain design-only.
Already-agreed order continues: OmniFeed next, with OmniState
threaded through each as they go live.
