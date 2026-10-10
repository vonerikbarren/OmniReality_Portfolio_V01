# Claude Check (V184): the check-and-answer loop

Applies to: V184 · Status: verified in jsdom and in real Chromium on software GL (1280x720 and 390x844) · Real GPU, phone and touch: not verified. DEV ONLY: not part of the user's app.

A panel in the Developer drawer where Claude puts exactly what it wants checked each iteration, and where the developer answers back. The loop: Claude lists what to test and what it is looking for; the developer marks results and answers; one button copies a small JSON report; the developer pastes it into the chat; Claude reads it and the next iteration starts from it.

## Where it is

Left drawer > **⟐Developer** > slot **7** `DevClaudeCheck` (event `omni:nav-select` item `⟐DevClaudeCheck`). Slots 1-6 are unchanged. There is no ribbon or dock button on purpose. The title shows the open-failure count ("⟐DevClaudeCheck · 2 failing"). Files:

| File | Role |
|---|---|
| `ui/DevClaudeCheckPanel.js` | The panel (extends `OmniSettingsPanelBase`, DEV ONLY badge + banner, 460px wide on desktop, bottom sheet at 700px or less) |
| `utils/DevClaudeCheckData.js` | Pure model and storage: validation, state, carry-over, report. No DOM |
| `data/ClaudeCheckData.js` | GENERATED each version: this iteration's content (`export default {...}`) |
| `tools/build-claude-check.mjs` | The generator |
| `docs/dev/Roles/Developer/ClaudeCheckAsk.json` | HAND-WRITTEN each version: summary, asks, known issues |
| `docs/dev/Roles/Developer/TestingChecklist.json` | The one source of truth for the checks (generator input) |

No user-facing module imports a `Dev*` module (the V184 static test scans every non-Dev file under ui, utils, systems, data, scene, modules). The one older, documented exception is `systems/OmniStoreScene.js` reading the per-page knob from `DevOmniStoreData`.

## The loop, every iteration (agents must do this)

1. Add/update the TestingChecklist category for the version (existing rule).
2. Edit `docs/dev/Roles/Developer/ClaudeCheckAsk.json`: `version`, `date`, one-line `summary`, `asks` (only things the developer alone can answer), `knownIssues` (6-10 open items from DeveloperQueue.md).
3. Run, from the project root:
   `node tools/build-claude-check.mjs --version V184 --categories "V174,V175,...,V184"`
   Categories are case-insensitive SUBSTRING matches against the category name. Pass the versions still worth testing (the last few). A pattern that matches nothing is printed as MISSING (V174 and V175 have no checklist category: their BuildLog entries list unchecked items but no TestingChecklist category was ever written).
4. Open the panel (Developer slot 7) and check that it loads; run `node --check data/ClaudeCheckData.js`.
5. In the reply to the developer say: **open Developer > Claude Check**.

Flags: `--date`, `--checklist`, `--ask`, `--out`, `--include-tested` (keep items already marked `tested: true`; by default they are skipped), `--strict` (a duplicate id is an error). The tool validates the result with the same validator the panel uses and refuses to write a file that loses items.

### What the generator derives
- **id** = `slug(category, 30) . slug(feature, 50)`, e.g. `omnistore-v183-storeitemnode.pin-a-store-item`. Stable while the category and feature text stay the same, so rewording either changes the id (and a carried item then shows as new). A duplicate gets `-2`, `-3` and is reported on stderr.
- **priority**: `high` for categories whose name contains V182 or V183, and for any item whose text says "regress" or "persist"; otherwise `normal`.
- **device**: `phone` (text mentions phone, 390 or mobile), else `touch` (touch, long-press), else `gpu` (GPU, fps, frame rate), else `any`. First match wins, so an item that only adds "also at 390px" is tagged phone.

## Schemas

### Iteration data `omni-claude-check/1` (data/ClaudeCheckData.js)
```
{ schema, version:'V184', date:'2026-10-10', summary,
  checks:[{id, category, feature, howToReach, whatToCheck, priority:'high'|'normal'|'low', device:'any'|'desktop'|'phone'|'touch'|'gpu'}],
  asks:[{id, question, why, kind:'text'|'yesno'|'choice'|'number', choices?:[...], device?}],
  knownIssues:[string] }
```
Treated as untrusted even though bundled: `validateData` copies only known fields, caps lengths (feature 160, whatToCheck 700, question 300 ...), drops items with bad or duplicate ids, unknown kinds, a choice with fewer than 2 choices, and caps counts (400 checks, 40 asks, 30 issues). A wrong schema or a missing version makes the whole file unusable; the panel then says so instead of crashing.

### User state (localStorage `omni:claude-check-v1`, dev only)
`{v:1, order:[versions], versions:{V184:{results:{id:{r:'pass'|'fail'|'skip', note?(<=300), at, snap?}}, answers:{askId:value}, message(<=4000), attachState}}, ui:{filter, hideDone}}`. Everything read from storage is sanitised again. Capped at about 200,000 characters (drops older passes, then the oldest versions, then notes) and to the last 3 versions. All reads and writes are in try/catch; with storage blocked the panel works in memory. `snap` ({c,f,h,w}) keeps the item text for fail and skip results only, so a carried item can still be shown after the old data file is gone.

### Report `omni-claude-report/1` (what "Copy report" writes)
```
{ schema, version, date, device:{ua,w,h,dpr,touch}, summary:{pass,fail,skip,unchecked},
  failed:[{id,feature,note?}], skipped:[{id,feature,note?}], passed:[ids], unchecked:[ids],
  carried:[{id,from,prior,now,note?}], answers:{askId:value}, message, state?, stateSource? }
```
Unchecked and passed items are ids only. With all 108 V184 checks and 3 failures the report is about 5 KB (about 6 KB with a typical message); the real-browser run measured it (see the BuildLog entry). `state` appears only when "Include app state (Dump)" is ticked.

## Carry-over rule
When the bundled version differs from a stored version, that stored version's `fail` and `skip` results are listed under **Carried over** ABOVE the new checks (each with a "from V183" tag, the old note, and the item text from the saved snapshot). `pass` results are not listed; they stay in the stored history (last 3 versions) and in exports. Matching is by check id; for one id the NEWEST version that has a result decides (the current version first), so a later pass retires an older fail. An id that is also one of the current checks is not listed twice: the current check gets a "failed in V183" tag. A carried item is re-marked in the current version like any other; the next version then drops it if it passed. Carried items count in the progress line and in the title's failure count until re-marked (an unmarked carried FAIL counts as an open failure).

## The panel
Header: version, date, summary, progress bar and "N of M checked (P pass, F fail, S skip), K carried over"; chips All / Desktop / Phone / Touch / GPU (items tagged `any` always show; All shows everything) and **Hide done** (hides every marked item at the next redraw, not the moment you click, so the list does not jump). Sections: Carried over (only if any), **Check these** (one collapsible group per category; groups with unchecked high-priority items start open), **What I'm looking for**, **Known issues**, **Message to Claude** (textarea, "Include app state (Dump)", Copy report, Download report (.json), Reset this version's answers with a second click to confirm).
Each check shows a priority dot, the feature, a device tag, "Go to: ...", what to check, Pass / Fail / Skip (the chosen one is highlighted; click again to clear) and a one-line note (hidden until a result is chosen; Fail asks "What went wrong?").
Safety: every piece of text from the data, notes, answers and message is set with `textContent` / `.value`; there is no `innerHTML` with such text (the panel builds elements with a small `h()` helper). Every control has `data-omni-tip`, `data-omni-tip-key` and `data-omni-tip-desc`.
Event: `omni:claude-check-changed {version, counts}` after every change; `counts` = `{total, pass, fail, skip, unchecked, carried, openFailures}`.

### Copy and the fallback
"Copy report" writes to the clipboard inside the click (a user gesture). If the clipboard is denied and `execCommand('copy')` also fails, the same text appears in a read-only textarea, selected, with the message "The clipboard is blocked here...". Download uses a Blob link; if that is unavailable the message says to use Copy.

### App state in the report
The Dump facility lives on the instance of `DevOmniStoreSettingsPanel` (`dumpState()`), not as an exported function. To avoid a Dev-to-Dev import the Claude Check panel dispatches `omni:dev-dump-get` with `detail.out = null`; the Dev store panel (added to the app at boot) fills `detail.out` with the same compact dump text (one small listener added in V184). The report then has `stateSource:'devstore-dump'`. If nothing answers, the panel builds a minimal own dump `{version, userAgent, viewport, devicePixelRatio, storeActive, counts}` and reports `stateSource:'minimal'`. The full dump can be tens of KB; leave the box unticked for a small report.

## Limits
Checks 400, asks 40, issues 30; note 300; message 4000; text answer 500; state about 200,000 characters; history 3 versions; the report's `device.ua` 200 characters.

## Not built
- Export / import of answers as a file (the Copy report block is the export; there is no importer).
- A paste-back importer so Claude can read the answers from inside the app (Claude reads the pasted JSON in the chat).
- A node form of Claude Check (the developer chose a panel, not a node).
- Automatic generation on build (agents run the tool by hand each version).
- Ribbon / dock button (deliberately none).
- Verified on a real GPU, a phone or touch: no.
