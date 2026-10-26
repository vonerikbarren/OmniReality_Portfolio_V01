# OmniStar boot screen (V185; urchin mark V186; Omni⟐Star + shooting star V187; smaller landed star, background shooting stars, dev intro settings V190)

Applies to: V190 (V187 below for the parts V190 did not change) · Status: verified in software-GL Chromium on 2026-10-11 · Real devices: not verified.

Files: `index.html` (markup + CSS), `boot/OmniStarBoot.js` (classic script, no module graph). `main.js` is unchanged.

## V190: smaller landed star, background shooting stars, dev intro settings

**Landed star size (`CONFIG.STAR_EM`).** The star box was `--boot-star: 3.1em`, which made the landed urchin about 4x the height of the ⟐ glyph. `CONFIG.STAR_EM` (new, in `boot/OmniStarBoot.js`) now sets `--boot-star` at run time (the same number is the fallback in `index.html`); default **1.15** so the landed mark is "slightly larger than the ⟐". The flying 4-point star, the 5-point pop and the urchin all share that one box, so the whole star shrinks together; the comet tail length still comes from the flight speed, and the glow (`drop-shadow`) is now proportional to the box (`0.025 x --boot-star`). Everything else about the mark (`FIT`, `CORE_R`, spikes...) is unchanged. Measured in software-GL Chromium on the final frame (pixels brighter than 110/255 of a white-on-black screenshot; the glyph alone for its ink box, the star alone for its extent; 3 frames because the mark rotates and breathes): glyph ink 45 px at 1280x720 (22 px at 390x844), star tip-to-tip 58-65 px (desktop) and 28-31 px (phone) = **1.28-1.45x** (desktop) / **1.26-1.40x** (phone) the glyph height; before: 4.1x. The theoretical longest-spike tip-to-tip is about 1.5-1.7x because the needle tips fade below the threshold. To change it: edit `STAR_EM` (ratio is proportional to it: 1.0 -> about 1.15x, 1.3 -> about 1.5x).

**Shooting stars after the landing (`CONFIG.SHOOT_*`).** Drawn on the boot canvas inside `drawField` (after the stars), from `SHOOT_START` = 1700 ms (the landing is at 1650). One spawn event every 800-2500 ms (random), 30% of the events spawn 2 streaks instead of 1, at most 3 alive; angle 135 degrees on screen (down-left) +- 40 degrees (sum of two uniforms, so mostly near 135); start point random in the upper-right 2/3 of the screen; speed 650-1000 px/s, life 600-1000 ms, tail 90-170 px, thin (1.2 px) line with a gradient from transparent (tail) to the head, alpha `SHOOT_ALPHA` 0.5 x a sine envelope (fades in and out). Spawning stops on the Enter click (the convergence), once `#omni-boot` has `.fade-out`, and when the loop ends (boot removed); `prefers-reduced-motion` never starts the frame loop, so there are none. Cost: one linear gradient + one stroke per live streak per frame (at most 3); measured 25 s after the landing in the harness: p50 0.2 ms, p95 0.3 ms (V189: 0.1 / 0.3), p99 about 1 ms.

**Loop clean-up.** When the loop ends the script now removes its window `resize` / `pointermove` listeners (`cleanup()`), so replaying the intro does not stack them.

### Dev intro settings (localStorage `omni:dev-intro-v1`)

The boot script is a classic script that runs before any module, so the settings live in plain JSON in localStorage and the script reads them itself (`readIntro()`); the DEV panel (`ui/DevOmniStarIntroSettingsPanel.js`, Developer drawer slot 8, model `utils/DevOmniStarIntroSettings.js`) only writes them. User-facing modules never import the Dev files (static test); the boot script reading localStorage directly is fine.

| field | values | applies to |
|---|---|---|
| `bg` | `#rrggbb` (any colour; `#rgb` and a missing `#` are normalised) | `#omni-boot` background (default `#000000`) |
| `texture` | `none`, `noise`, `grid`, `scanlines`, `dots`, `custom` | a layer `#boot-texture` under the star canvas (generated procedurally on a small canvas tile, no assets; `custom` = the image below) |
| `textureOpacity` | 0..1 (default 0.35) | opacity of that layer |
| `customUrl` | `''`, a `data:image/(png\|jpeg\|webp\|gif);base64,...` URL up to 400000 chars, or an `https://` URL up to 500 chars without quotes / parentheses / spaces | the `custom` texture (`cover`, centred). The panel's file picker accepts png / jpeg / webp / gif up to 200 KB and stores it as a data URL |
| `starColor` | `#rrggbb` (default white) | landed star + flight tail + glow + the background star field and its faint lines (`--boot-star-color`, `--boot-star-rgb`) |
| `starOpacity` | 0..1 (default 0.7) | the landed star's final opacity |
| `fieldOpacity` | 0..1 (default 1) | the drifting background stars and lines |
| `shootColor` | `#rrggbb` (default white) | the shooting stars |

Read defensively: the value is parsed in try/catch, ignored above 600 KB, and every field is regex-validated / clamped; any doubt -> that field's default (`sanitizeIntro`, the same rules as `sanitize` in the Dev model; the tests run the same 40 hostile inputs through both and require identical output). A texture `custom` without a valid image falls back to `none`. Nothing from storage is ever put into the page except through those validated values (colours as `#rrggbb`, URLs only after the regexes, set through `style` properties). **Escape hatch:** open the page with `?bootintro=off` to ignore the saved value for that load.

Applied on the next load, or at once with **Preview intro**: the script keeps the untouched boot markup and its own `src`, and `window.__omniBootPreview()` (defined by the first run) re-creates the markup on top of the app and runs the script again (cache-busted `?preview=...`), which re-reads the saved settings. The Enter button becomes "Close preview"; Esc or the button fades it out and removes it. It refuses (returns false; the panel then says "reload the page") while the real boot is still showing or if the script's `src` is unknown. Reset to defaults removes the key.

Not verified: real GPU, a real phone, touch; the preview was exercised in software-GL Chromium inside the full app (about 1 fps there, so its timing is not representative).

## V187: Omni⟐Star title and shooting-star entrance (the 3.1em box below is superseded by V190 `STAR_EM`)

- **Wordmark** is real text `Omni` + `⟐` + `Star` (same monospace stack and size as before); `aria-label="Omni Star OmniOS"` on the h1 (the visual parts are `aria-hidden`); the tab `<title>` stays `OmniOS`. The subtitle `OmniOS` is unchanged.
- **Star behind the glyph.** The star box (`.boot-star`, `z-index:-1` inside the h1 stacking context) is centred on the ink centre of the `⟐`: `measure()` takes the glyph's box from `getBoundingClientRect` and corrects the horizontal centre for the trailing letter-spacing (box minus half the letter-spacing) and the vertical centre from canvas `measureText` ink metrics. Final tip radius is about 1.6 - 2.2x the glyph height (`--boot-star: 3.1em`). Legibility: the star is dimmed to opacity 0.7 after the flight (flight itself is full white) and the glyph and subtitle carry a dark text-shadow rim.
- **Flight.** Starts at 150 ms, lasts 1500 ms (`FLY_START`, `FLY_DUR`), from the top right outside the viewport to the glyph centre along a quadratic Bezier (bowed curve) sampled as 48 keyframes with an ease-out-cubic parameter, spinning -720 degrees (`FLY_SPIN`). Individual transform properties (`translate`, `rotate`, `scale`) as compositor Web Animations. Tail: one `.boot-comet` element, `transform-origin:100% 50%`, orientation = atan2 of the velocity, length scaled with speed (200 - 900 px, `0.38 x` the larger viewport side), clip-path taper, opacity fade at the end. The star is a 4-point shape in flight; at landing it runs the unchanged sequence (pop to 5 points, urchin morph, spin, breathing); later timeline offsets are not changed.
- **Words** fade in over 600 ms (the glyph 0.7 s later); the black cover of V186 is removed (the title is visible from the first frame).
- **Re-measure** on window resize and `document.fonts.ready`; an in-flight animation is re-aimed with `setKeyframes`.
- **Unchanged:** star field, attract, converge (now toward the glyph), reduced motion (finished title at once, no flight), `?bootmark=star12`, Enter + `requestFullscreen` in the click, no overflow at 390 px.
- **Cost:** boot script per frame p95 0.5 - 1.0 ms in the noisy harness (V186 target 0.5 ms; not tuned further).
- **Not verified:** real GPU, a real phone, touch, the true feel of the flight.

## Branding decision

- Company: **OmniStar**. Product: **OmniOS**. "OmniReality was always a placeholder."
- Changed (user-visible brand/title only): tab title, boot wordmark + subtitle, Global Bar logo tooltip (`⟐OmniOS`, the ⟐ glyph stays), Dev dump `app` string, user guide README / page 1.
- NOT renamed, on purpose: code identifiers and file names (`OmniRealityGrid*`), `omni:*` localStorage keys, event names (renames break saved data and listeners), the concept words **Reality / Realities** (the digital spaces), and the `OmniReality` layer in `OmniBrowserSpace` (a persisted layer name of the space hierarchy, not the product).

## Structure

```
#omni-boot
  canvas#boot-starfield      (JS-made, z 0, pointer-events none)
  h1.boot-brand[aria-label="OmniStar OmniOS"]
    span.boot-row            (flex, centred; the word + star group is centred)
      span#boot-wordmark     real text "OmniStar"
      span.boot-cover        (JS-made black cover, removed after the roll)
      span#boot-star > svg > path   aria-hidden; landing slot reserved in the flow
                       (V186: the script appends <circle.boot-core> + <g.boot-spikes><path> for the urchin, hidden until the morph ends)
    span.boot-sub            "OmniOS" (0.3em, letter-spacing 0.6em, fades to 65% opacity)
  .boot-progress-track, button#boot-enter-btn   (unchanged)
```

Font size is the old `.boot-glyph` clamp (`clamp(2rem, 6vw, 4rem)`); the star is 0.94em wide (star radius = 50/120 of that). The star's slot is the real layout position of the reserved box (`offsetLeft` of `#boot-star`, which ignores the roll transform); it is re-measured on resize, and a roll still in progress is re-aimed with `setKeyframes`.

## Timeline (ms after the first frame)

| ms | what |
|---|---|
| 0-150 | black, word hidden behind the cover, star off-screen left |
| 150-1650 | roll: translate from `-(slotX + 2R)` to 0 and rotate by `-(D / R)` (nudged to a whole number of turns so it lands tip-up) to 0, same ease-out cubic; the cover moves with the star's trailing edge so the word is revealed behind it |
| 900-1800 | OmniOS subtitle fades in (CSS delay 0.9 s, 0.9 s long) |
| 1500-1750 | 4 -> 5 point snap morph, plus a 16% scale pop |
| 1900-2600 | 5-point star -> final mark (V186: urchin; V185: 12-point star) while spinning up (angular speed ramps up with a burst of 6x the steady speed in the middle) |
| 1900-3300 | star field fades in (per-star stagger up to 0.9 s) |
| 2600- | steady spin, 10 s per turn, forever; urchin only: the spikes breathe (scale 1 +-6%, 3.2 s sine) |

Virtual time = frame time minus the animations' common start time (wall clock, so a stall skips the morph instead of delaying the roll).

## Shape math

`starPoints(n, outerR, innerR, rotation)` returns 2n vertices alternating outer / inner. Each shape is turned into a polar radius profile by casting M rays and intersecting the polygon; the morph is a per-ray radius lerp written to one `<path d>` only while a morph runs. The 4- and 5-point stars (inner 0.38 / 0.45, outer radius 50 in a 120-unit viewBox) are unchanged from V185.

### Final mark config (V186)

Everything tunable is in ONE object, `CONFIG`, at the top of the shape section of `boot/OmniStarBoot.js`:

| key | default | meaning |
|---|---|---|
| `FINAL_MARK` | `'urchin'` | `'urchin'` or `'star12'` (the V185 12-point star, M = 120 samples, code path unchanged) |
| `SPIKES` | 16 | spikes, evenly spaced (k x 22.5 deg), spike 0 straight up |
| `CORE_R` | 0.42 | core disc radius as a fraction of the box radius (60), the design size before `FIT` |
| `TIP_LONG` / `TIP_SHORT` | 1.0 / 0.82 | tip radius multipliers applied to 2.0 x core radius: even spikes 2.0 x core, odd spikes 1.64 x core |
| `JITTER` | `[0,-.05,.04,.06,-.03,-.07,.05,-.04,.08]` | fixed tip-radius jitter for spikes 0..8; spikes 9..15 mirror 7..1 (left-right symmetric, no `Math.random`) |
| `BASE_W` | 0.17 | spike base width at the core edge x core radius (V186 first tried 0.28: read as a starburst / gear, not as needles) |
| `MIN_BASE_UNITS` | 4 | floor for the base width in viewBox units (about 1 px at the smallest 30 px star box) |
| `FIT` | 1.1 | whole mark scaled so the nominal long-tip radius = FIT x 50 = 55 units |
| `BREATH_AMP` / `BREATH_MS` | 0.06 / 3200 | breathing amplitude and period |
| `SAMPLES_URCHIN` / `SAMPLES_STAR12` | 400 / 120 | polar samples per mark |

Resulting geometry (viewBox units, 1 unit = 0.5 px at the full-size 64 px font): core radius 27.5 (disc diameter 55 units = 27.5 px), long tips 55 (max with jitter 59.4), short tips 45 (about 41.9 - 47.8 with jitter), spike base width 4.7 (hs = 5 samples either side, 4.5 degrees half angle), tips needle sharp (a single vertex). Tip-to-tip is about 1.3 x the wordmark cap height (about 57 of 43 px at 1280x720, 29 of 21 px at 390); the old 12-star was 1.16 x. The star box (0.94 em) is unchanged; tip radius 55 stays inside the 60-unit box (the breathing peak, 63, uses the SVG's `overflow: visible`), so the glow is not clipped and the reserved slot / centring are unchanged.

### Why 400 samples

400 is divisible by 80 = lcm(4, 5, 16): with 0.9 degree steps every tip / valley of the 4- and 5-point stars (step 90 / 72 degrees) and every one of the 16 spike axes (every 25th sample) lands exactly on a sample, and the spike base corners are snapped to a sample too, so the urchin profile equals the true outline (checked: tip vertex radii equal the configured tips to 0.01). The polygon is up to 400 points (about 0.08 ms to build the `d` string, only while a morph runs). The `star12` fallback keeps M = 120 as in V185 (12-point tips are on a 3 degree grid).

### Morph, swap and breathing

The 5-point star morphs to the urchin in two overlapping parts of the same 700 ms window: the star rounds into the core disc (`e1`, first 60%), then the spikes sprout from it (`e2`, from 35%). A plain per-sample lerp from the star to the urchin gave a ragged, crumpled shape at 25-50%; this two-stage lerp reads as star -> rounded pentagon -> disc -> spikes.

The morph is one `<path>`. In the frame the morph reaches 100% the script hides the path and shows the layered form in the same frame: `<circle.boot-core>` plus `<g.boot-spikes>` (one path, all 16 spikes; each spike's edges continue inside the core so the base stays hidden when the group scales 1.06). The breathing animation is created at that moment, starting at scale 1 (= the morph's geometry), as a Web Animation (`transform: scale`, sine-shaped easing per quarter, `transform-origin 0 0` = the viewBox centre) on the spikes group only. The whole mark still rotates via `.boot-star`'s `rotate`. Swap check in Chromium: path vs layered render differ on about 0.7% of pixels (anti-aliasing at spike edges only, max 35 of 255 at 4x scale), no geometric difference. Trace: the breathing animation reports `compositeFailed: 0`. Reduced motion shows the layered form at scale 1 with no animation.

### Fallback and URL parameter

`CONFIG.FINAL_MARK = 'star12'` or `?bootmark=star12` in the page URL brings back the V185 12-point star (no layers, no breathing). Only `urchin` and `star12` are accepted; any other value is ignored (the CONFIG default applies). `window.__omniStarBoot.mark` shows the active one.

### Changes vs V185

Only the final mark and its morph: new CONFIG / urchin builder / layered form / breathing in `boot/OmniStarBoot.js`, `.boot-star circle` fill in `index.html`. Timeline, roll, landing, 5-star, star field, constellation lines, attract, converge, reduced motion, aria, fullscreen-in-click and `main.js` are unchanged.

## Compositor vs main thread

Roll, cover, pop (`scale`), breathing and spin (`rotate`, 24 keyframes for the spin-up, then one infinite 360-degree turn) are Web Animations on individual transform properties, so they continue while main.js evaluates its ~40-module graph. The path morphs and the star field use `requestAnimationFrame`; the urchin's breathing is a compositor animation too. The loop checks `document.getElementById('omni-boot')` every frame and stops once main.js's `dismissBoot` removed it.

## Star field

80 stars (40 when the viewport is under 700 px), canvas at `devicePixelRatio` capped at 2, normalised coordinates (resize-proof), drift 2-7 px/s, size 0.4-1.3 px, alpha 0.35-0.9, slow twinkle; larger stars get a small pre-rendered halo sprite. Constellations: at most 8 (4 on phones) lines between near neighbours (150 / 110 px max), peak alpha 0.16, 0.6 px wide, 6-10 s life with a sine fade; none under reduced motion.

## Attract rules

- `pointermove` anywhere: strength 0.15; over the Enter button 0.5. Holds 600 ms, then decays (time constant 0.7 s).
- `pointerenter` / `touchstart` / `focus` on Enter: strength 0.5 while it lasts (`pointerleave` / `blur` release it).
- Each star's pull toward the logo star = strength x 0.8 x its own factor (0.6-1.0), eased per frame, so the maximum is about 40% of the distance and the field stays a field.
- Enter click: pull -> 0.96 with a fast ease and alpha 1 -> 0 over 500 ms. The boot script's own click listener only stores a time stamp; main.js's handler still calls `requestFullscreen()` synchronously and then `playEntryAnimation()` (which calls `dismissBoot()`), unchanged.

## Reduced motion

`prefers-reduced-motion: reduce` at load: the final mark (urchin, or the 12-point star with `?bootmark=star12`) is drawn static after the wordmark, the subtitle is visible at once, about 40 static stars are drawn once (redrawn on resize), no animations, no rAF loop, no listeners for pull; Enter works as always.

## Other

- The JSZip CDN script is `defer` so `<body>` can paint before the CDN answers.
- Perf (software GL, 1280x720, V186 urchin): script per frame p50 0.2 ms, p95 0.4 ms (390 px: 0.1 / 0.4); frame interval p95 16.7 ms. In Chromium traces the roll, pop and steady spin report `compositeFailed: 64` in this software-GL harness in V185 and V186 alike (spin-up, cover and breathing report 0); not investigated on a real GPU.
