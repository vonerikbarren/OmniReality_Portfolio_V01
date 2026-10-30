# Tests

Zero-dependency regression suite. Run from the app folder:

    node --test tests/*.test.mjs          # about 40 s: syntax of every file, imports, fuzz, unit tests

| File | What it guards |
|---|---|
| 00_syntax | every `.js` file parses |
| 01_import | every pure module in `utils/` and `data/` imports and exports (modules that need three / gsap are skipped here and covered by the browser test) |
| 02_sanitizers | every exported `sanitize*` function (found automatically) never throws on hostile input, never pollutes `Object.prototype`, and is idempotent. A new model is covered the day it is written. |
| 10_scene_and_docs | scene file (`.omni.json`), doc bookmarks, doc model, page layouts |
| 11_semantics_lineup | meaning demo, axioms, semantics skin, lineups, attachments, camera-walk maths, avatar gait |
| 12_vibration | vibration model, beat landing, lead channel, GSAP eases, curve editor maths |
| 99_browser | the real-browser smoke test (opt-in, below) |

## Browser smoke test (real Chromium, boots the whole app)

    cd tests/browser && npm install && npm run vendor && npm test
    # or, from the app folder:  OMNI_BROWSER=1 node --test tests/99_browser.test.mjs

It serves the app locally with pinned local copies of three / gsap / d3 (the app imports them from a CDN), enters the scene, runs the Omni commands for nodes, scene files, semantics cubes, doc layouts, lineups, the camera walk, vibration beat landing and the demo, and fails on any page error. It uses software GL, so it needs no GPU. It does NOT replace testing on a real phone / Mac / GPU / touch screen.

## Adding tests
- A new pure model: nothing to do for the fuzz (02 finds `sanitize*`); add a behaviour test next to the others.
- A new command or service: add steps to `tests/browser/smoke.mjs` (`ok(name, 'Omni ...')`, `bad(...)` for a command that must be refused).
- Known gaps: layout / visuals are not asserted (only that nothing throws); audio playback; touch gestures.
