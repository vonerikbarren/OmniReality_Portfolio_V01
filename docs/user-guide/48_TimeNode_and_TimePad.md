# TimeNode, TimeCube and the OmniTimePad (V259)

A **TimeCube** is a cube that knows about a stretch of time. A **sequence** is a line of TimeCubes. It is a poly node underneath, so everything a poly node does still works.

## What you see
- **Six sides:** Start date, End date, Start time, End time, Title and notes, Status. Press a side and a panel opens beside the cube (same paper material as a doc node). Press the same side again to close it. Only one panel is open at a time.
- **A ring** around the cube, like a doorknob seen along the z axis.
- **A spinning icosahedron** on the ring. It starts at the top and travels once round the ring as the time is fulfilled. Colours: grey waiting, cyan running, green fulfilled. **Halted:** it stops where it is and glows amber. Halting stops only that cube.

## Making them
`Omni Time create title(Kickoff) startdate(2026-06-01) starttime(09:00) enddate(2026-06-01) endtime(11:00) zone(America/New_York)`  (property names are lowercase in commands)
`Omni Time create after(<cubeId>) title(Review) ...` joins a line to the cube before it, in the same sequence.
Or select a TimeCube and use **＋ Add the next cube** in the Inspector's **TimeNode** section.

## Clocks
- **The calendar** (default): runs between its start and end date/time.
- **Its own:** starts when you **activate** it (Inspector, `Omni Time activate id(...)`, or a TimePad button) and lasts as long as end minus start, at its own **speed**.
- **Chain:** an own-clock cube can start by itself when the cube before it is fulfilled.
- **Halt / resume / reset / replay:** `Omni Time halt id(...)`, etc. **Loop** replays a finished cube over and over, for analysis only; it never changes the dates.
- **Repeat:** none, day, week, month or year, with a count (0 = forever). Month ends clamp (Jan 31 repeats on Feb 28).
- Times are stored with a zone (default UTC), so daylight saving is handled.

## Calendar views and filters
`Omni Time view span(7d)`: 1d, 3d, 5d, 7d, 14d, 1m, 3m, 6m, 1y, 2y, 3y, 5y, 10y, 20y, or `custom` with `days(45)`. The Inspector has the same picker.
`Omni Time filter unit(month) key(2026-06)` filters by minute, hour, day, week, month or year (keys: `2026-06-01T09:30`, `2026-06-01T09`, `2026-06-01`, `W2026-06-01`, `2026-06`, `2026`). Weeks start on Monday.

## The OmniTimePad
A sound board for events. Each button runs a list of timed actions on cubes.
```
Omni Time pad name(Show)
Omni Time button pad(Show) label(Go)
Omni Time action pad(Show) button(Go) op(activate) target(<cubeId>) at(0)
Omni Time action pad(Show) button(Go) op(halt) target(<cubeId>) at(5000)
Omni Time press pad(Show) button(Go)
```
Ops: activate, halt, resume, reset, replay, loop-on, loop-off. `at` is milliseconds after the press. Pads are saved in your browser.

## Limits (honest)
- The calendar clock is the real clock. Binding a cube to the scene clock (OmniChronos) is not done yet.
- There is no on-screen TimePad board yet; use the commands (or send `omni:timepad-request {action:'press', pad, button}`).
- Pads are not in the scene file yet. Tested in headless Chromium only, not on a real GPU or touch device.
