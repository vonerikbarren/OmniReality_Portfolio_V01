# TimeData ruler (V192)

Applies to: V192 (part 4) · Status: unit-tested in jsdom and checked in software-GL Chromium on 2026-10-12 · Real devices, real GPU, touch: not verified.

Files: `utils/TimeRulerMath.js` (pure calendar maths), `utils/TimeDataRuler.js` (window, consumption, draw plan), `utils/TimeDataRulerSettings.js` (validated settings and storage), `ui/TimeDataRulerPanel.js` (the ruler window), `ui/TimeDataRulerSettingsPanel.js` (Admin settings), `ui/OmniTimeDataRulerModules.js` (registers both). Small edits: `ui/IndexedPanel.js` (`registerExtraSlot`), `ui/OmniRibbon.js` (one button), `main.js` (one block of three lines).

## What existed before

Nothing drew a TimeData ruler. The word "ruler" in the code is a name only:

| Piece | What it is | Where |
|---|---|---|
| `utils/TimeDataRegistry.js` | `lockToRuler(nodeId, timeData)`: the map from a node id to its `TimeData`. "Creating a node locks it to the ruler" (called from `systems/OmniNode.js`). No pixels, no coordinates. | OMNICHRONOS_DESIGN.md "locks it to the ruler" |
| `utils/TimeData.js` | `{ naturalSeconds, manipulatedSeconds, format }` and `formatSeconds` (HH:MM). | |
| `utils/PerspectiveTime.js` | `perspectiveTime(object, timeData)`: the Y height of a time in the Master Tunnel, `y = -102 + (seconds % 86400) / 86400 * 260`. The tunnel IS a vertical day ruler in world space, but it draws no notches. | `modules/RootSpace.js` tunnel |
| `modules/ChronosFloorClock.js` | The MasterClock node and its HH:MM.mmm label on the floor (world y -102). | |
| `ui/OmniChronos.js`, `ui/OmniTimelineView.js` | The player and the Premiere-style timeline. The timeline has a real horizontal canvas ruler (frames, seconds, minutes, hours) but it measures Primary Time (seconds since the app started), not dates. | |
| `ui/OmniVerticalMeter.js`, `ui/OmniMeter.js` | HUD altitude (Y) and X meters, plus the V190 session readout (`utils/OmniSessionClock.js`). Distances in world units, not time. | |
| `systems/OmniDimensionalAxes.js` | The X / Y / Z axes and their tunnels. The Y axis carries node ticks, no clock. | |

So no ruler existed to extend. The new ruler is a separate pair `utils/TimeDataRuler.js` + `ui/TimeDataRulerPanel.js`; it reads nothing from `TimeDataRegistry` yet (see Follow-ups).

## What it is

A floating window (`⟐TimeDataRuler`, window-chrome class A: resize + maximize) with one 2D `<canvas>` (no WebGL context, no three.js). Opened from:

- `⟐Times` drawer slot 1 (`TimeDataRuler`),
- ribbon Realities > Chronos > Time ruler (nav item `⟐TimeDataRuler`),
- the nav item itself (`omni:nav-select`), and the ⚙ button of the settings panel ("Open ruler").

On a phone (<= 700 px) it is a tall panel docked to the right edge, between the ribbon / hands banner and the Dock; on desktop it opens at the right edge clear of the hands and can be dragged and resized.

Top to bottom: `Elapsed` / `Remaining` (HH:MM:SS), a meta line (`Day +0 · 92.6% of the day · baseline Mon 12 Oct 2026 00:00:00 (today 00:00)`), a toolbar (− ＋, D W M Y X scale chips, ▲ ▼ page, ⌖ now, ⊤ baseline, ⚙ settings), the canvas, a cursor readout (`Mon 12 Oct 2026 12:00:00  (+12:00:00)`).

## Decisions

### 1. Calendar local time

Everything uses the browser's local calendar. A day window runs from a wall-clock time to the same wall-clock time one calendar day later, so on a daylight-saving day it is really 23 or 25 hours long (23.5 / 24.5 in Lord Howe). Hour notch `k` is the wall time `baseline + k hours`; JS `Date` puts a wall time inside a spring-forward gap on the instant after the gap and the first of a repeated hour on its first occurrence. Notches that land on the same instant are dropped, so a 23-hour day has 24 notches (00:00 .. 24:00 minus the missing hour) and a 25-hour day has 25 (one interval is two real hours). 24:00 always lands exactly on the next midnight (the next occurrence of the baseline time). Elapsed / remaining are real milliseconds, so on a 25-hour day the readout counts 25 hours. Rejected: elapsed 24 h notches (24:00 would drift away from the calendar midnight that the week and month lines use).

### 2. Baseline

`baselineMs` in the settings is either `null` (automatic: local midnight of today, recomputed every day, so the ruler resets by itself at midnight) or a chosen moment (whole seconds). Input: a date field and a time field (seconds allowed) in `⟐TimeDataRulerSettings`, buttons **Set** (also applied when a field is left), **Now**, **Session start** (the OmniMeter's session start from `sessionStorage`), **Today 00:00** (back to automatic). Validation (`parseBaselineInput`): `YYYY-MM-DD` and `HH:MM[:SS]`; refuses 30 February, month 13, 24:00, second 60, years outside 1900..2999 and a wall time that does not exist (spring-forward gap). A refused input shows the reason and changes nothing. Stored as `omni:timedata-ruler-v1`.

Every notch and line is measured from the baseline: page 0 of every zoom starts at it, so the baseline line (accent colour) is at the very top. A baseline in the future shows "Starts in HH:MM:SS" and nothing is consumed.

### 3. Time consumption and what happens after 24:00

The part of the window already used is dimmed (the canvas is drawn twice, clipped, the past with reduced alpha) and washed with the accent colour, a bar runs along the spine from the top to the marker, and a marker line with a time chip moves down once a second. The readout shows elapsed and remaining of the DAY window. The hour boundary fires `omni:timedata-ruler-hour { hour, page, at }` and rings a pulse (a CSS animation on a small element, no canvas frames). A new day fires `omni:timedata-ruler-day { page, at }`.

When the day passes 24:00 (setting **After 24:00**):

- `follow` (default): the window moves on to the next day ("Day +1", the next 24:00 notch is the next occurrence of the baseline time); the stored baseline never changes. With the automatic baseline this is simply a reset at midnight (the baseline is a new midnight, always "Day +0").
- `stop`: the window stays on the day that was current when the baseline / setting was applied; the bar is full (elapsed 24:00:00, remaining 00:00:00, "Day complete").

"Follow" never goes before the baseline (a future baseline stays on page 0). ▲ / ▼ step the window one page and stop following; ⌖ follows now again; ⊤ shows page 0.

Motion: the canvas redraws every second while **Animation** is on and the system does not ask for reduced motion. With `prefers-reduced-motion: reduce` or Animation off there is no pulse and the canvas redraws once a minute (the numbers still tick). The ticker is `update(delta)` of the module, which compares `floor(Date.now() / 1000)` with the last second: no `setInterval`, no per-frame work, and nothing at all while the window is closed.

### 4. Hierarchy and zoom

Levels: minute < hour < day < week < month < year < decade. Line length (share of the line area), weight and opacity grow up the levels (`LEVEL_STYLE`): 0.10 / 0.20 / 0.32 / 0.46 / 0.64 / 0.82 / 1.00 and 1 / 1 / 1 / 1.25 / 1.5 / 2 / 2.5 px; colour is the line colour lightened per level, decade lines and the baseline use the accent colour. A boundary that is several levels at once (1 January 2030) is drawn once with the highest level.

| Zoom | Window (page 0 from the baseline) | Labelled | Also drawn when dense enough (>= 4 px apart) |
|---|---|---|---|
| Day | 1 calendar day | 25 hours 00:00 .. 24:00 (left of the spine) | minutes every 30 / 15 / 5 (>= 4 px apart), day lines |
| Week | 7 days | days (`Mon 12`), weeks (`W42`) | month, year, decade |
| Month | 1 calendar month | weeks, months (`Nov 2026`) | days as hairlines, year, decade |
| Year | 1 calendar year | months, years | week hairlines, decade |
| Decade | 100 calendar years | decade years (`2030`, `2040` ...) | year hairlines |

Controls: − / ＋, the D W M Y X chips, the mouse wheel over the canvas (60 units per step, `preventDefault`), a two-finger pinch (spread = closer, fingers together = further), keys + - ↑ ↓ Home N while the canvas has focus. The wheel and pinch never leave the canvas.

Labels never overlap: left (hour) labels and right (hierarchy) labels are each decluttered by priority (`declutter`): 00:00 / 24:00 first, then 12:00, 06:00 / 18:00, 3-hourly, the rest; months and years beat weeks beat days. At a small window height (200 px) only some hours keep a label and the 15-minute minors drop to 30 or none. The ruler is scaled to the canvas height (`padY` keeps the first and last label fully visible).

Weeks (setting **Week start**): `iso` (Monday start, ISO-8601 week numbers: 29 Dec 2025 is week 1 of 2026), `monday` and `sunday` (week 1 = the week that holds 1 January; a week belongs to the year in which it ends; numbers 1..53). Month lengths and leap years come from the calendar (`daysInMonth`, `isLeapYear`; the 2024 February boundary is 29 days after the 1 February line).

### 5. Settings

`ui/TimeDataRulerSettingsPanel.js` (`⟐TimeDataRulerSettings`, window-chrome class A, user-facing; there is no Dev twin and no Dev import) is reached from `⟐Admin` slot 21 (first free slot after the fixed twenty; added without touching the Admin config in `main.js` through `registerExtraSlot('admin', ...)`), the ⚙ on the ruler and the nav item. Controls, all applied live and validated by `S.updateSettings`: baseline date / time / Set / Now / Session start / Today 00:00, week start, show weeks / months / years / decade years, minor notches (off / 30 / 15 / 5), animation, after 24:00, line colour, accent colour, consumed dimming (10..90 %), line opacity (30..100 %), Reset. Events: `omni:timedata-ruler-set { patch } | { reset:true }` in, `omni:timedata-ruler-changed { settings }` out.

## Module contract and tests

Both panels extend `ui/OmniSettingsPanelBase.js` (single-init guard, `init / update / destroy / onResize`, WindowManager registration, bottom sheet rules overridden for the ruler). `OmniTimeDataRulerModules.addTimeDataRulerModules(base)` is the only thing `main.js` calls; `BaseScene.addModule` calls `init()`.

Tests (scratchpad `t/`): `v192d_math_test.mjs` (pure maths: leap years, year / decade boundaries, ISO weeks 2015-2026, DST days found from the host zone and run under seven `TZ` values, hostile inputs, declutter), `v192d_model_test.mjs` (settings validation and storage, windows, pages, consumption, plan counts and geometry per zoom and per size, DST plan), `v192d_ui_test.mjs` (the two windows, ticking, hour pulse, reduced motion, rollover, controls, wheel / pinch / keys, settings, painting through a recording 2D context, drawer slots), `v192d_nodev_test.mjs` (no Dev import, no timers / DOM in the pure files).

## Follow-ups (not built)

- Nodes on the ruler: draw each `TimeDataRegistry` entry (natural / manipulated seconds) as a mark at its time, and let the Master Tunnel Y use the same baseline. The registry holds seconds since app start, so a mapping from Primary Time to a date is needed first (owner question).
- Panning by drag, a "jump to date" field, a second zoom axis for hour-of-day inside the week view.
- Time zones other than the browser's, week numbers for other conventions (US 1 January rule is only approximated by `sunday`).
