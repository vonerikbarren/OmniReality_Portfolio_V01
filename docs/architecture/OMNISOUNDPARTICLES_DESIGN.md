# Sound particles and the two sound viewers (V194)

Applies to: V194 (part 3 of 3: particles + viewers; the sound model / engine is part 1, the SoundNode kind / settings panel / Inspector / Admin is part 2) · Status: unit-tested in jsdom with a stub sound engine and checked in software-GL Chromium · Real GPU, real audio, phone, touch: not verified.

Contract: `docs/architecture/OMNISOUND_CONTRACT.md` (names and signatures are binding; this part owns the particle model, the particle system and the two viewers).

Files:

| File | What |
|---|---|
| `utils/OmniSoundParticleModel.js` | Pure. `PARTICLE_SCHEMA` (63 fields in 6 groups), `defaultParticles`, `sanitizeParticles`, `FORMATIONS` (14), `bandsToMotion` (the smoother), `lodCount`, `allocateParticleBudget`, and the two kernels shared by the scene and the viewer: `layoutFormation`, `displaceParticles`. |
| `systems/OmniSoundParticles.js` | The runtime module `(context, omniNode)`: one `THREE.Points` per node with sound and particles. |
| `utils/OmniSoundVizMath.js` | Pure maths of the viewers: note names, log frequency axis, bin ranges, scope trigger, heat colour table, the 2D projection. |
| `ui/OmniSoundViewerPanel.js` | `⟐SoundViewer` (class-A window, 2D canvas). |
| `ui/OmniSoundParticleViewerPanel.js` | `⟐SoundParticleViewer` (class-A window, 2D canvas). |
| `ui/OmniSoundVizModules.js` | `addSoundVizModules(base, omniNode)`: the one call main.js makes. |
| `ui/OmniRibbon.js`, `utils/OmniStarLightSites.js` | Home > Sound group (two buttons); the sites 'Sound viewer' and 'Particle viewer'. |

## What it is

A node that makes sound (`data.sound.enabled`) can also carry `data.soundParticles`: a cloud of points whose COUNT, FORMATION and MOVEMENT come from the frequency content of the sound. The owner's words: "particles whose count / formation / movement come from the sound's FREQUENCY content". Concretely:

- COUNT is a first-class setting (0 to 4000 per node) and it also responds: "Count follows level" shows only part of the cloud when the sound is quiet; LOD thins the cloud with the distance; all clouds share one global cap.
- FORMATION is the resting shape: ring, sphere shell, spiral, helix, galaxy, Lissajous, wave sheet, bars (a real 32-column spectrum analyser), cube lattice, burst, torus, cloud, disc (sunflower), funnel.
- MOVEMENT is the 7 bands (sub, bass, low mid, mid, high mid, presence, brilliance) mapped by the user to targets: radius (breathing), height (a lift wave running out from the axis), swirl (differential spin), jitter (shake), size, brightness, colour shift, or nothing, each with a gain. Defaults: bass and sub breathe the radius, mid and low mid lift, high mid swirls, presence brightens, brilliance jitters; the level grows the points.

## How a frame works (`systems/OmniSoundParticles.js`)

1. A scan four times a second (`getAllNodes()`): which nodes have `sound.enabled === true` and a `soundParticles` object with `enabled !== false` and count > 0. New ones get a cloud, gone / disabled / deleted ones are disposed. The parameters are sanitized here, never trusted. Each cloud remembers a cheap signature of its parameters and only re-lays-out when a layout field changed, only restyles when a style field changed.
2. In the same scan: distance to the camera, the LOD count (`lodCount`), then the shared cap (`allocateParticleBudget`): the nearest nodes are served first, so far nodes lose particles first. The cap is 20000 and is lowered by Admin > Sound when `utils/OmniSoundSettings.js` exists (it is imported lazily and optional; see Assumptions).
3. Every frame, per cloud: follow the node (world position of its mesh, plus the `offsetY` setting), cull (beyond `cullDistance`, hidden node, zero granted, off screen by a frustum test), then SILENCE: a settled cloud that is not playing does nothing, not even an analysis call (`pauseWhenSilent`, no idle motion). Otherwise read `SoundEngine.getAnalysis(nodeId)`, run `bandsToMotion` (input smoothing, attack / release, the mapping), and write positions with `displaceParticles` (breathing, lift, swirl, noise, jitter; bars read the spectrum), update the material (size from level, brightness, colour) and rotate the Points object (rotation costs no buffer write).
4. Colour: solid, gradient and pitch only touch `material.color` (no per-particle writes). By-band writes one colour per particle from a 7-entry table. Pitch maps the peak frequency to a hue on the chromatic circle.
5. Trails: while `trail > 0` a second `THREE.Points` (child of the first, sharing the colour attribute) follows the positions with a lag and is drawn dimmer and larger. At 0 it is removed.

One `THREE.Points` per node (plus the optional ghost child), a `PointsMaterial` with a canvas-texture orb (glow / disc) or none (square), `vertexColors`, additive or normal blending. No shader, no new WebGL context, nothing added to the page's WebGL context count.

### The importance order (why LOD does not rebuild)

`layoutFormation` stores slot s = the formation index with the s-th smallest bit-reversed index (van der Corput order). Any prefix of the slots is an even, representative subset of the whole shape. So LOD, the global cap and "count follows level" only change a draw range, never the layout, and they never show half a sphere. Changing count, formation or the shape settings re-lays-out (about 3 ms for 4000 particles); everything else is cheap.

### Cost and allocation

- No sound nodes: `update()` is one timer add and a size check.
- A silent settled cloud: a frustum and distance check; no analysis call, no buffer writes, no draw range change.
- Playing, 4000 particles with trails: about 1.5 ms of CPU per frame in node (the jsdom run), dominated by the two sin / cos passes. `updateRate` (every frame / 30 / 20 / 15 per second) thins even that.
- Buffers are allocated when the count outgrows them (rounded up to 512) and when it shrinks a lot (a quarter), never per frame; the update loop iterates an array, uses scratch objects and does not allocate (a test checks the hot path source for allocation patterns and, with `--expose-gc`, the heap over 500 frames).

## The shared kernels

The scene and the formation viewer call the SAME functions (`layoutFormation`, `bandsToMotion`, `displaceParticles`, `updateBarColumns`, `bandColor`), so the picture in the viewer is the picture in the scene (minus the camera). Everything in the model file is pure and deterministic: no `Math.random`, no DOM, no Three.js. `hash01(i, seed, k)` is an integer mix; the same particles object always gives the same cloud.

## The sanitizer

`sanitizeParticles(raw)` always returns a complete object with exactly the schema keys: numbers are clamped (and rounded where the field is an integer), enums fall back to the default, booleans accept `true` / `false` / `1` / `0` / `'true'` / `'false'`, colours accept `#rgb` and `#rrggbb` (and a number) and are normalised to lower-case `#rrggbb`. Unknown keys are dropped, only OWN properties are read (so `__proto__` and inherited keys are harmless), a getter or Proxy that throws is treated as absent, and `lodFar` is kept above `lodNear`. The test feeds 28 hostile inputs.

## `⟐SoundViewer` (`ui/OmniSoundViewerPanel.js`)

- Source: auto (the selected node when it has sound, else master), master (the whole mix, `getMasterAnalysis()`), or any node with sound.
- Views: All (spectrum + spectrogram + scope), Bars, Line, Scope, Spectro; seven band meters always at the bottom.
- Spectrum: log-frequency bars with peak-hold dots, a log line with a soft fill, a dB scale (the analyser byte mapped between the node's min / max dB when it has them, else -100 .. -30), a frequency grid (20 .. 20k), a dashed peak marker with its frequency.
- Scope: the waveform started at a rising zero crossing so that a steady tone stands still.
- Spectrogram: an offscreen 256 x 96 canvas scrolled one column per redraw (about 8.5 seconds at 30 fps), colours from the theme (dark, accent, white).
- Readout: peak Hz + note name + cents, level in dB, the ADSR phase chips, dynamic mark, iteration, loop count.
- Freeze (copies the data, because the engine reuses its arrays), FFT zoom (20-20k, 20-8k, 20-2k, 20-500, 20-120 Hz; the mouse wheel and the + / - keys also zoom).
- Theme: colours are read from the OmniOS theme variables (`--omni-theme-accent`, `-bg`, `-border`, and the panel's text colour) every two seconds.
- Redraw: at most 30 per second from the module's `update(delta)` (BaseScene calls it from the shared ticker; the panel has no `requestAnimationFrame` and no `setInterval`), only while the window is open. DPI aware (the canvas is scaled by `devicePixelRatio`, capped at 2.5).
- Silence, no engine, an engine that throws, a junk analysis: the empty grid and a hint, never an error.

## `⟐SoundParticleViewer` (`ui/OmniSoundParticleViewerPanel.js`)

- Views: Top, Front, Side, Orbit (a turntable seen from about 22 degrees above; drag turns it, Spin turns it by itself).
- The cloud is drawn as small squares, bucketed by (colour class, depth) so that `fillStyle` and `globalAlpha` are set 21 times per frame instead of per particle; up to 2500 particles (1500 on a phone), always the representative prefix. The readout keeps the true count.
- Live: the node playing moves the particles exactly as in the scene; silent: the static resting formation, and nothing is redrawn at all except the orbit turn (with Spin off: zero redraws).
- A band strip: the 7 bands with their live activity and what each drives (rad, hgt, swl, jit, siz, brt, hue).
- Count readout `drawn / count` plus the reason when it differs: `cap N` (shared cap), `LOD`, `far`, `offscreen`, `silent`, `no particles yet`, `sound is off`; it asks `PARTICLE_SERVICES.system.getStats(nodeId)` and falls back to the settings when the scene system is not there.
- Edit: formation picker, count slider (0 to 4000), size slider and On / Off write `data.soundParticles` of the selected node through `sanitizeParticles`, announce `omni:sound-particles-changed { nodeId, patch }` (the scene reacts within a quarter of a second) and save with the node: `omni:node-updated { node }` + `omni:force-save`, debounced by 400 ms while a slider moves and at once on release / change. Looking never writes; the first edit of a node without particles creates a complete object.
- No node selected: a hint.

## Registration

- main.js: one block (a comment, the dynamic import, the call) right after the V192 TimeData ruler block. `addSoundVizModules` imports the three modules lazily with a try / catch each: a failing module is logged and the app still boots.
- Nav items `⟐SoundViewer` and `⟐SoundParticleViewer` (the panels listen to `omni:nav-select`), ribbon Home > Sound (two buttons, after Windows), OmniStarLight sites 'Sound viewer' and 'Particle viewer' (group Tools). No drawer slot (see the owner questions).
- Window chrome: both extend `ui/OmniSettingsPanelBase.js`, which registers with `WindowManager`, so resize handles and the maximize button come from `utils/OmniWindowChrome.js` (class A). The desktop windows open at the right edge clear of the hands, the particle viewer to the left of the sound viewer; on a phone they are bottom sheets.

## Decisions

1. Points with a `PointsMaterial`, no shader: one size per cloud (size by level, not per particle) but no new GLSL to maintain and nothing that can fail to compile. Per-particle size would need `onBeforeCompile`; deliberately left out.
2. Positions on the CPU: 4000 particles is cheap, and the same kernel serves the viewer. A vertex shader driven by a uniform array of 7 bands (the contract's alternative) can come later without changing the model.
3. Importance order instead of rebuilding for LOD (above).
4. Silent clouds cost nothing: the engine is not even asked.
5. The viewer imports `systems/OmniSoundParticles.js` only for the `PARTICLE_SERVICES` handle; everything else comes from pure modules, so the picture works with the scene system absent.
6. Additive blending is the default (like `ParticleField`). On a very light wallpaper additive points wash out; the Blend setting switches to normal.

## Assumptions (to check against the other two parts)

- `SoundEngine` is the default export of `systems/OmniSoundEngine.js` with `getAnalysis(id)`, `getMasterAnalysis()`, `isPlaying(id)`; typed arrays are reused (the viewers copy on freeze and never retain).
- `getAnalysis` returns `null` or an object with `playing`, `phase`, `level`, `bands`, `peakHz`, `spectrum`, `waveform`, `binCount`, `sampleRate`, `iteration`, `loopCount`, `dynamicNow` (the contract). A missing `playing` is read as playing.
- The sound's analysis dB range is read defensively from `data.sound.minDb` / `maxDb` (or `analysisMinDb` / `analysisMaxDb`, `minDecibels` / `maxDecibels`); the default is -100 .. -30 (the Web Audio analyser default).
- Admin > Sound: `utils/OmniSoundSettings.js` `getSoundSettings()` may hold the particle cap under one of `particlesGlobalCap`, `particleGlobalCap`, `particlesCap`, `particleCap`, `globalParticleCap`, `maxParticles`, `particlesMax`; the first one found lowers the cap. The system re-reads on `omni:sound-settings-set`.
- The settings panel (part 2) generates its controls from `PARTICLE_SCHEMA` and may either dispatch `omni:sound-particles-changed` / `omni:node-updated` or only mutate `data.soundParticles`: the scan picks up either within a quarter of a second.

## Not verified

Real GPU frame rate, real audio (only a stub engine with synthetic bands), phone and touch feel (only a 390 x 844 software-GL browser), a light vs dark theme of the viewers, many sound nodes at once in the real app.

## Follow-ups

- Per-particle size (shader), a vertex-shader path for 4000 x many nodes.
- A drawer slot for the two viewers (the `⟐Objects` index is a planned placeholder today).
- A viewer mode that overlays the node's geometry (the SoundNode mesh) with the cloud.
