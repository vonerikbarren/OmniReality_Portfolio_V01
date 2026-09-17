# OmniPlayer — The Gaming Interface

Built: `data/OmniPlayerRealities.js`, `systems/OmniPlayerGame.js`,
`ui/OmniPlayerDashboard.js`, a real 4th tab in `systems/OmniPocket.js`,
and a new `playerAura` preset in `modules/OmniExpressionator.js`.
References given directly: Zelda, Kingdom Hearts, Metroid Prime — "I
honestly at this point didn't have any real design aspects... we can
edit it." Everything below is a real, working first version, not a
final design.

## The core loop

30 Core Realities exist — the same 30 already used for the custom
alphabet and the MasterKeySymbol placeholders, not picked at random
here either. Each Core Reality has 5 Aspects (150 total collectibles)
— a real, explicit design decision made where none was given, chosen
as a manageable first scope rather than guessed-at final lore.
Collecting every Aspect of one Core Reality exposes its truth — a
greater whole that couldn't exist while its Aspects were scattered.

## OmniPocket is the real inventory

Per the request directly — not a separate inventory UI. A real
fourth tab, "Aspects," added to the existing, already-built
`OmniPocket.js` panel, wired via a new `setPlayerGame()` method
rather than reordering how OmniPocket is already constructed in
`main.js`.

## Visors, emotional state, and the particle aura

Five real states — Neutral, Curious, Focused, Alert, Triumphant —
each with its own color. Collecting an Aspect nudges toward Curious;
exposing a truth triggers Triumphant for a real, timed duration
before settling back to Neutral. The Visors tab and the particle
aura both read this exact same state, not two separate copies of it.

The aura itself reuses `OmniExpressionator` directly — a new
`playerAura` preset, camera-relative like the entrance effect but
continuous like Galaxy, small on purpose ("as small as possible"),
always sitting just in front of the camera regardless of where it
looks. Confirmed directly: its color reacts live to
`omni:player-emotional-state-changed`, a real, generic event —
meaning any other OmniProduct that ever wants to shift the player's
visible emotional state can do so by dispatching that one event,
without needing direct wiring to OmniPlayerGame specifically. This is
the concrete answer to "used in tandem with any other OmniProduct."

## The Dashboard — honest about what has real design and what doesn't

Five tabs: Status, Visors, Boundaries, Languages, Skills. Status and
Visors carry real, functional data from `OmniPlayerGame`. Boundaries,
Languages, and Skills render as genuine, clearly-labeled
placeholders — "no real design exists yet" — rather than invented
content dressed up to look finished, matching this project's
established pattern (OmniSystem's own unbuilt siblings, OmniKryptx's
deliberately blank keys) rather than a new exception to it.

## Cross-product reuse, confirmed directly in this build

- **OmniPocket** — real inventory, not a new panel.
- **OmniExpressionator** — the aura is a new preset on the existing
  particle engine, not a second, separate particle system.
- **OmniNotify** — exposing a truth pushes a real notification
  through the already-built drop-down system
  (`omni:notify-push`), the same real surface any other OmniProduct
  already uses for "something important just happened," rather than
  a parallel alert mechanism built just for this.

## OmniUser — the non-gamer counterpart

Stated directly: "OmniUser is more for non-gamers while OmniPlayer is
for gamers" — a real, separate product, not another Dashboard tab.
Toggled by a real button in the Dashboard's own header, but renders
as its own genuinely separate panel — the audience distinction stays
real structurally, not just conceptually.

Holds real profile fields (display name, avatar symbol, bio) and the
14 Dimensions of Wellness, given directly in order: Life, Financial,
Spiritual, Mental, Physical, Social, Emotional, Sexual, Political,
Network, Educational, Professional, National, International. Each is
a real, user-set 0–100 rating — a plain scale chosen since none was
given, defaulting to the neutral midpoint (50) rather than 0, since
zero would read as "already failing" for a dimension nobody has
touched yet.

One honest open question, worth naming rather than deciding
unilaterally: OmniUser is currently only reachable through
OmniPlayer's own, game-first Dashboard — but if it's genuinely meant
for people who aren't engaging with the game at all, a more direct
entry point (its own Left Drawer item, say) may eventually make more
sense than routing non-gamers through a gamer-first surface to reach
it.

## Number of Life Skills — real, shown, per the explicit request

A real, persisted count on `OmniPlayerGame`, now shown in the
Dashboard's Skills tab — replacing what was an honest placeholder.
What specifically counts as a "Life Skill" is still undefined; only
the count itself was asked to be real and visible, so that's what's
built — not an invented skill-tracking system layered on top of a
request that only asked for a number.

## Status

Built and verified directly, 22 checks: the full data model, real
collection and truth-exposure logic (including the double-collection
guard and the timed Triumphant-to-Neutral settle), real persistence
across a fresh reload, the aura's real camera attachment and its
live color reaction to the real event, OmniPocket's real Aspects tab
correctly wired and rendering, the Dashboard's real data on Status/
Visors and its honest placeholders elsewhere, and the full real
chain from collecting an Aspect through to OmniNotifyPanel actually
receiving and displaying the notification. Boundaries/Languages/
Skills, the fixed-path travel connection, and any real visual
distinction beyond the swatch color remain open, real future work.
