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
