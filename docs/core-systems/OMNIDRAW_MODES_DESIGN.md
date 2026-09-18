# OmniDraw — Static / Dynamic Split

Built: `ui/OmniDrawModePicker.js`, `ui/OmniDrawDynamic.js`, a real
restructure of `ui/OmniDraw.js`'s own nav-select listener, and
`utils/DesirePrimaryForce.js`.

## The mode picker — the first real, concrete use of Desire/PrimaryForce

`⟐OmniDraw` now opens a real choice — Static or Dynamic — rather
than jumping straight to the old single panel. Confirmed directly as
intentional: the click itself *is* Desire (forward, stated intent —
"I want Dynamic"), and whichever mode's real behavior follows is what
a future, fuller PrimaryForce check would confirm against it. Both
are real letters in the language's own 30
(`architecture/THE_30_RECLASSIFICATION.md`) — Desire() is Intent,
PrimaryForce() is Purpose — not analogies invented for this feature.

`utils/DesirePrimaryForce.js` is the real, minimal mechanism this
uses today: `declareDesire()` on a mode choice,
`confirmPrimaryForce()` once Dynamic actually, successfully creates
something. Explicitly **not** the full verification system — that's
real, acknowledged future work ("we might need to spend a little bit
more time on it") — this is just the hook it can attach to later.

The `n` key now opens the picker, not Static directly — a real,
deliberate change from the previous single-panel shortcut.

## OmniDraw(Static)

Unchanged in every real way — same panel, same behavior — just
listening for `⟐OmniDrawStatic` specifically now instead of the bare
`⟐OmniDraw` label, since that label belongs to the picker.

## OmniDraw(Dynamic) — the real first slice

Scoped narrowly and confirmed directly, not guessed: a string is
split into words — an array, one word per index — and shown **one
word at a time**, in order, start to finish, looping back to the
start once it reaches the end. Each word shifts to the next like a
real notification: a timed slide-and-fade transition, not all words
visible at once.

Reuses Static's own real placement mechanism
(`omni:node-create-request`, spawned in front of the camera) for the
ticker's anchor point — "clone static logic to build the dynamic if
necessary," applied literally, not a second, separate placement
system. The word display itself is a real, screen-projected CSS2D-
style label, the same technique already proven for OmniTargeting's
tooltip and ToolTipMenu's headers — not `TextGeometry`/font-loading.

**Explicitly deferred, per the agreed scope** — real, separate future
work, not built here: rotation styles (linear/vertical/diagonal
whip), the qualitative/quantitative command panel, and FilterMorphing-
style capture+texture+tooltip (FilterMorphing itself still doesn't
exist anywhere in the codebase).

## OmniJsonifier — JSON tree construction, live and manual

Built as its own real panel, not folded into the plain-string ticker
mode. Confirmed scope directly: manual, toggle-per-branch reveal —
"so we don't break anything" — not OmniCryptexLab's replace-on-drill
pattern. Multiple branches can be open simultaneously; each toggle
controls its own real 3D children, spawned and despawned live as it
opens and closes, not built all at once regardless of size.

Reuses two real, existing mechanisms rather than inventing new ones:
`omni:node-create-request` (Static's own placement pattern) now with
a genuine `parentId` — Dynamic's own ticker still always sends
`null`, since a flat ticker has no real parent to point to; a tree
node always does. `omni:node-delete-request` (already real, already
used by `OmniInspector.js`) for despawning a branch's children when
it closes — including recursively force-collapsing any nested branch
that was left open underneath it, so nothing is ever orphaned.

**Leaf "forms," confirmed**: a leaf value gets its own labeled node;
if that leaf is a multi-word string, it also gets a real, attached
`WordTicker` — extracted into `utils/WordTicker.js` specifically
because it's confirmed to be a genuine, reusable *form*, not a
feature specific to plain-string Dynamic. Both Dynamic's own ticker
and OmniJsonifier's multi-word leaves now share one real
implementation. The stated goal, directly: "data manipulation based
on type of data structure type" — different forms for different data
shapes, not one universal rendering.

**Explicitly not built here**: the "show the entire tree, shrinking
as it grows" option raised alongside the toggle system — a real,
worthwhile idea, offered as a "maybe," not committed to in this pass.

## Font — a real, per-node property, not global

Confirmed directly: font is per-node, exactly like color and scale
already are — never a shared, app-wide setting. Added to
OmniDraw(Static)'s own field schema first (a new `select` field,
reusing the same pattern `meshTypeChannel`/`particleShape` already
use), flowing through the same real, shared node-creation path every
OmniNode already goes through — `mesh.userData.font` is now set
alongside `mesh.userData.label`, in both real creation paths (fresh
creation and restore-from-storage).

## OmniCommunicationPanel — the real, second inspector for tickers

Confirmed name. One shared panel, retargeted by selection — the same
real model `OmniInspector` itself uses, not one instance per ticker,
confirmed directly for mobile-scale reasoning. Finds its ticker
through `utils/WordTickerRegistry.js`, a real, shared map from node
id to ticker that both `OmniDrawDynamic` and `OmniJsonifier` register
into — not fragile position-matching.

A real UX correction made while building, not left as a defect: the
panel does not force itself open for every node selection — only
when the selected node genuinely has a registered ticker. Selecting
something unrelated while the panel is already open updates it to a
real, honest empty state instead of showing stale data.

**`WordTicker` itself was substantially extended** — previously had
zero external control (no pause, no per-instance speed, hardcoded
style, a shared module-level interval). Now real, per-instance, and
controllable: `play()`/`pause()`, `stepForward()`/`stepBackward()`
(manual single steps), `toggleReverse()` (flips the same auto-play
loop's direction — confirmed as genuinely different from a manual
step), `jumpTo(index)`, `setSpeed()`, `setStyle()`, `setWord()`.
Direction is stored as a plain signed value (+1/-1), confirmed
directly to future-proof clockwise/counter-clockwise circular
arrangements later, rather than a named forward/backward state.

The panel itself: live-synced word-list highlighting (follows the
ticker's real current index every frame, not just on button clicks),
per-word click-to-edit, speed as both a number field and a slider,
color/size/font controls reusing Static's own real `FONT_OPTIONS`
list rather than a second, diverging copy, a real Save button with
visible confirmation, and a genuine periodic autosave (every 8
seconds) — verified to not fire early.

**Explicitly not built here**, confirmed as real, separate future
work ("build this in parts"): per-word context changing shape and
saved texture on iteration.

## Status

Built and verified directly, 32 checks total across both build
passes: the mode picker's real routing and Desire declarations,
Static correctly responding only to its own specific label,
Dynamic's real word-array parsing, the shared `WordTicker` working
identically in both consumers, and OmniJsonifier's full real tree
lifecycle — correct root-only initial spawn, correct per-branch
open/close with genuine `parentId` wiring, correct ticker-attachment
only for multi-word leaves, and correct recursive collapse of nested
open branches on close, confirmed with no orphaned nodes left
behind.
