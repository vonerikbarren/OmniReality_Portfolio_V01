# buildOrder_DeeperSettings_V01 — Undo / Redo, Copy / Paste, and the Feeds panel (2026-10-09)

Sibling of `buildOrder_OmniStore_V01.md` (the OmniStore/OmniValue/Mall order; items 1–4 DONE, 5–11 remain). "DeeperSettings" = the cross-cutting UX layer every system benefits from. Decision (user): this is a UX **necessity**, so it is scheduled **before OmniStore item 5**, because every later feature produces actions it should cover.

Status key: NEXT · QUEUED · LATER. Convention carried over: `<System>Settings` (user, Admin) vs `Dev<System>Settings` (dev/Claude). Real-money actions are never undoable in a real tier; sandbox is fine.

## What the user asked for
1. A **universal undo** (and **redo**) in case the user does something they did not intend.
2. **Cubes as dimensional matrices**: six main CLASSES of action on the cube, per-class undo/redo, so the user can "undo node deletion", "undo movement", "undo setting change" separately. Name for the user: **Undo Options** (internal: UndoMatrix). Faces available depend on which products/functions the user has access to.
3. **Copy and paste** with the same logic.
4. A **UI panel system** that shows (a) **history of actions**, (b) **what is on the clipboard**, (c) **what has been pasted** — working like **feeds**, in the spirit of the controller-input display in Smash (a scrolling, timestamped stream of inputs).

## Model
- ONE history, many views: each action is recorded once `{id, t, class, label, icon, source, do, undo, group, meta}`; the six cube faces are filters over it (nothing stored twice).
- ONE clipboard model: `{id, t, kind, label, payload, source}`; paste is itself a recorded, undoable action, and also appears in the Pasted feed `{t, clipId, target, result}`.
- Feeds are three live read-only views (History · Clipboard · Pasted) over those two models; entries are clickable (undo to here / redo / re-copy / paste again / reveal source).
- Candidate six classes (confirm in D1): **Create/Delete**, **Move/Transform**, **Settings**, **Content** (text, data, catalog, payloads), **Structure** (hierarchy, links, groups, tunnels/axes), **Commerce** (cart/wishlist/sandbox trades; only for OmniValue owners).

## Order

| # | Build | Notes |
|---|-------|-------|
| D1 | **History core (`UndoMatrix`)** — NEXT | No UI. `utils/OmniHistory.js`: record / undo / redo, six class filters, grouping (one step per gesture, one step per import), per-class caps, redo cleared by a new action in that class, persistence within a size limit (drop oldest), access gating per class, events `omni:history-changed`. Fully headless-testable. Includes the undo-must-restore-everything rule (both node registries; dangling refs like wish-list items, timeline clips, behaviours). |
| D2 | **Wire the first classes** | Listen to existing events (`omni:node-created/-deleted/-restored`, transform end, settings-changed events from the settings stores). Node delete/restore on BOTH registries; node move = one step per drag. Replace the ad-hoc catalog-import undo with the core (keep behaviour). |
| D3 | **Clipboard core** | `utils/OmniClipboard.js`: copy / cut / paste of nodes, products, catalog rows, settings sets (e.g. a store look), text. Internal clipboard first. System-clipboard writes only on a user gesture; never read the system clipboard silently; imported/pasted data goes through the same validators as imports (untrusted). Paste = undoable action. |
| D4 | **Feeds panel** | Three feeds (History / Clipboard / Pasted) in one movable, resizable panel; Smash-style input-stream look: newest entries at the edge, timestamps, class icon + colour, fade/age, filter by class, pin, pause. Mobile: header-only ticker (like OmniNotify) that expands. Optional one-line mirror into OmniNotify. Entries are clickable (undo to here, redo, re-copy, paste again, reveal). |
| D5 | **Undo Options panel (the cube)** | Six faces, per-class Undo / Redo and counts, "what would this do" preview text before it runs, access-gated faces, global Undo/Redo. Ribbon buttons + shortcuts: Ctrl/Cmd+Z, Shift+Z, C, X, V — only outside text fields and only if they do not clash (audit main.js keys first). |
| D6 | **Settings** | `OmniHistorySettings` (user, Admin): caps per class, which classes record, feed look/length, clear history. `DevOmniHistorySettings` (dev): dump, inject test actions, force-fail an undo, perf readout. |
| D7 | **Wire the remaining classes** | Structure, Content, Commerce (sandbox), timeline edits, store/catalog, one class at a time; each gets tests. |

## Rules to settle in D1
- Not everything is undoable; each action declares `undoable` and why not (real-money, sent-outside-the-app, destructive resets that already confirm).
- Gesture grouping: dragging records one step; bulk operations record one step with a count.
- Undo of a deletion restores children/links/behaviours/clips; if something cannot be restored the step says so before it runs ("what would this do").
- Caps: steps per class (default ~100), total persisted size limit; oldest dropped first; redo cleared by new actions in the same class.
- Cross-class order: undoing within one class must not corrupt a later action in another class (each step declares the objects it touches; conflicts are detected and the step is disabled with a reason).

## Open questions
- Exact six classes (above is a proposal).
- Should global Ctrl/Cmd+Z undo the last action of ANY class, or the focused class only? (Proposal: global = last action overall; the cube = per class.)
- Persist history across reloads by default, or session-only?
- Does the Pasted feed need cross-device sync? (Proposal: no.)

## Carried
- Real GPU/phone/touch verification of every panel still outstanding.
- `WindowManager.watchPanelOpacity` leaks one listener per panel destroy (pre-existing, DeveloperQueue 59).
