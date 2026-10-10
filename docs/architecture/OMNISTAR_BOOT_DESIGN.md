# OmniStar boot screen (V185)

Applies to: V185 · Status: verified in software-GL Chromium on 2026-10-10 · Real devices: not verified.

Files: `index.html` (markup + CSS), `boot/OmniStarBoot.js` (classic script, no module graph). `main.js` is unchanged.

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
| 1900-2600 | 5 -> 12 point morph while spinning up (angular speed ramps up with a burst of 6x the steady speed in the middle) |
| 1900-3300 | star field fades in (per-star stagger up to 0.9 s) |
| 2600- | steady spin, 10 s per turn, forever |

Virtual time = frame time minus the animations' common start time (wall clock, so a stall skips the morph instead of delaying the roll).

## Shape math

`starPoints(n, outerR, innerR, rotation)` returns 2n vertices alternating outer / inner. Each shape (4: inner 0.38, 5: 0.45, 12: 0.72) is turned into a polar radius profile by casting 120 rays (every 3 degrees) and intersecting the polygon; 120 divides every tip and valley angle of the three shapes, so the pure shapes stay exact (the brief suggested 24 samples; 24 would round the 5-star's tips). The morph is a per-ray radius lerp (`lerp(P4, P5, a)` then `lerp(., P12, b)`) written to one `<path d>` only while a morph runs.

## Compositor vs main thread

Roll, cover, pop (`scale`) and spin (`rotate`, 24 keyframes for the spin-up, then one infinite 360-degree turn) are Web Animations on individual transform properties, so they continue while main.js evaluates its ~40-module graph. The path morph and the star field use `requestAnimationFrame`. The loop checks `document.getElementById('omni-boot')` every frame and stops once main.js's `dismissBoot` removed it.

## Star field

80 stars (40 when the viewport is under 700 px), canvas at `devicePixelRatio` capped at 2, normalised coordinates (resize-proof), drift 2-7 px/s, size 0.4-1.3 px, alpha 0.35-0.9, slow twinkle; larger stars get a small pre-rendered halo sprite. Constellations: at most 8 (4 on phones) lines between near neighbours (150 / 110 px max), peak alpha 0.16, 0.6 px wide, 6-10 s life with a sine fade; none under reduced motion.

## Attract rules

- `pointermove` anywhere: strength 0.15; over the Enter button 0.5. Holds 600 ms, then decays (time constant 0.7 s).
- `pointerenter` / `touchstart` / `focus` on Enter: strength 0.5 while it lasts (`pointerleave` / `blur` release it).
- Each star's pull toward the logo star = strength x 0.8 x its own factor (0.6-1.0), eased per frame, so the maximum is about 40% of the distance and the field stays a field.
- Enter click: pull -> 0.96 with a fast ease and alpha 1 -> 0 over 500 ms. The boot script's own click listener only stores a time stamp; main.js's handler still calls `requestFullscreen()` synchronously and then `playEntryAnimation()` (which calls `dismissBoot()`), unchanged.

## Reduced motion

`prefers-reduced-motion: reduce` at load: the 12-point star is drawn static after the wordmark, the subtitle is visible at once, about 40 static stars are drawn once (redrawn on resize), no animations, no rAF loop, no listeners for pull; Enter works as always.

## Other

- The JSZip CDN script is `defer` so `<body>` can paint before the CDN answers.
- Perf (software GL, 1280x720): script per frame p50 0.2 ms, p95 0.4 ms; frame interval p95 16.7 ms.
