# OmniSound engine design (V194)

Status: built in V194 (part 1 of 3: model + engine + scene module). The SoundNode kind, the settings panel and the Inspector section are part 2; particles and viewers are part 3. The binding names and signatures are in `OMNISOUND_CONTRACT.md`.

Files

| File | Role |
|---|---|
| `utils/OmniSoundModel.js` | The sound MODEL: the schema of every setting, defaults, `sanitizeSound`, presets, note and dynamics helpers. Pure (no DOM, no Web Audio). |
| `systems/OmniSoundEngine.js` | The audio ENGINE: builds a Web Audio graph per node, schedules notes, analyses the sound. Singleton `SoundEngine` (default export). |
| `systems/OmniSoundScene.js` | The scene MODULE `{init, update, destroy}`: audio listener from the camera, positional voices, auto-start rules, play / stop requests. |

## 1. What "every setting" means (plain language)

A SoundNode does not just "play a sound". It describes a note in many dimensions, and each dimension is a group of settings. Think of a musician who must decide, for one note: which instrument (Source), which pitch (Pitch), how loud (Dynamics), how the loudness rises and falls (Envelope), whether it is held (Sustain), whether it wobbles (Vibrato / Tremolo), how it repeats (Time and Playback), whether it gets louder or softer over time (Crescendo), how bright it is (Filter), what room or effect it is in (FX) and where it stands in the room (Spatial). On top of that come when it starts by itself (Triggers), how it is measured for the viewers and particles (Analysis) and its name and colour (Meta). There are 14 groups and about 200 settings; every one has a plain-language description in the schema (and in section 6 below).

A default SoundNode is deliberately simple: a soft sine wave on the note A4 (440 Hz), at the loudness mf, with the envelope Attack 0.02 s / Decay 0.2 s / Sustain 0.7 / Release 0.4 s, one note of 1.5 s, and no effects.

## 2. Musical terms explained

**Pitch, note, octave, semitone, cents.** Pitch is how high or low a note sounds. A note name is a letter plus an octave number: C4 is middle C and A4 is the tuning note at 440 Hz (440 vibrations per second, Hz). Going up one octave doubles the frequency (A5 = 880 Hz). An octave has 12 semitones (the 12 keys of a piano from C to the next C); a semitone has 100 cents, so cents are used for tiny corrections. MIDI numbers count the piano keys from 0 to 127 (60 = middle C, 69 = A4).

**Dynamics: pppp ... ffff.** Dynamics is musical loudness. `p` is piano (soft), `f` is forte (loud), `m` is mezzo (half), and doubling a letter means more extreme. In order from quietest to loudest: **pppp, ppp, pp, p, mp, mf, f, ff, fff, ffff**. In this engine `pppp` plays at 3 percent of the full level and `ffff` at 100 percent (table below); the default is `mf`. The "Extra gain" setting in decibels (dB) is a free trim on top: +6 dB doubles the amplitude, -6 dB halves it.

| Mark | pppp | ppp | pp | p | mp | mf | f | ff | fff | ffff |
|---|---|---|---|---|---|---|---|---|---|---|
| Gain | 0.03 | 0.06 | 0.11 | 0.18 | 0.28 | 0.42 | 0.58 | 0.74 | 0.88 | 1.00 |

**Crescendo and decrescendo.** A crescendo is a gradual increase in loudness (for example from pp to ff over 8 seconds); a decrescendo or diminuendo is a gradual decrease. The engine moves the volume in decibels between the two marks, so the change sounds even to the ear. Options: a delay before it starts, a curve shape, and what happens at the end (stay, start over, or swell back and forth).

**ADSR envelope.** The loudness shape of one note over time, in four stages. **Attack**: the time to rise from silence to the peak (short = a click or a pluck, long = a slow swell). **Decay**: the time to fall from the peak to the sustain level. **Sustain**: the LEVEL (not a time) held while the note continues. **Release**: the time to fade to silence after the note ends. This engine adds an optional **Hold** (time spent at the peak before the decay) and a curve shape for each stage (linear = a straight line, exponential = fast then slow, logarithmic = slow then fast, S-curve = smooth at both ends).

**Sustained sound.** "Sustained" means the note does not end by itself: it holds at the sustain level until `stop()` is called, then it fades by the release time. Handy for drones, pads and wind. Off (the default) = the note plays for its "Note length" and then releases. A sustained note ignores Loop (it is one held note).

**Vibrato vs tremolo.** Both are a slow wobble made by an LFO (low frequency oscillator: a wave too slow to hear as a tone, only as movement). **Vibrato wobbles the PITCH** (a violinist rocking a finger, a singer's voice). **Tremolo wobbles the LOUDNESS** (a guitar amplifier's pulsing, a mandolin trill). Rate = how many wobbles per second, depth = how big each wobble is, delay and fade-in = how long it waits and how slowly it grows after the note starts.

**Filter.** A filter lets some pitch ranges through and turns others down. Lowpass keeps the lows and removes the highs (a dull, muffled sound; like putting a hand over a speaker). Highpass keeps the highs (thin, tinny). Bandpass keeps only a slice. Notch removes a slice. Peaking boosts or cuts a slice; the shelves boost or cut everything above or below a corner. The cutoff is the pitch where it starts to work; resonance (Q) is the emphasis right at the cutoff (high = whistling). The filter envelope makes the cutoff sweep at the start of every note (the classic synth "wow"); the filter LFO makes it wobble continuously (wah-wah).

**Reverb.** The sound of a space: the tail of echoes you hear in a hall or a cave. Decay = how long the tail lasts, room size = how big it feels, pre-delay = a small gap before it starts, damping = how fast the treble fades in the tail, dry/wet = the balance between the original (dry) and the reverb only (wet).

**Delay (echo), chorus, flanger.** Delay repeats the sound after a time; feedback sets how many repeats. Chorus mixes in slightly detuned, moving copies so one sound seems to be played by several (lush, thick); flanger is the same with a very short delay, giving a jet-plane sweep.

**Distortion, bitcrush, EQ, compressor.** Distortion clips the wave for crunch (soft clip = warm, hard clip = harsh, fold = metallic, tube = even and warm). Bitcrush uses fewer loudness steps for a lo-fi digital sound. EQ (equaliser) is a three-band tone control for bass, middle and treble. A compressor turns down the loudest parts so the sound is more even (threshold = where it starts, ratio = how strongly).

**Unison, detune, sub oscillator, pulse width.** Unison plays several copies of the tone together; detune sets how far apart they are tuned (cents), which makes the sound thick. A sub oscillator adds a tone one or two octaves lower for weight. Pulse width changes the shape of the square wave from hollow (50 percent) to nasal (10 percent).

**FM and additive synthesis.** FM (frequency modulation): one tone wiggles the pitch of another very fast; ratio and depth give bell, electric-piano and metallic sounds. Additive: the sound is built by adding harmonics (overtones: multiples of the base pitch) one by one; "rolloff" is how fast the higher ones get quieter.

**Iterative play, loop.** Loop repeats the whole sound. Iterative play repeats the NOTE on its own: how many times, how far apart (milliseconds or beats at a tempo), with random jitter and swing, and with a change per repeat (pitch step in semitones = a rising ladder or an arpeggio, volume step in dB = an echo that fades or a crescendo of hits, filter step, pan spread).

**Spatial.** Positional sound comes from the node position in the 3D world: louder when you are near (distance model, full-volume distance, max distance, rolloff), and placed left/right/behind by your camera direction (panning model: simple stereo or HRTF for headphones). Cone angles make a node that sounds louder in front than behind. Doppler bends the pitch when the node moves past you. Air absorption makes distant sounds duller.

**Analysis.** The engine measures every sound with an FFT (fast Fourier transform: a way of splitting a sound into its pitches). The FFT size sets the detail, smoothing calms the result. The result is given as 7 bands (sub, bass, low-mid, mid, high-mid, presence, brilliance), the strongest frequency in Hz (peakHz), the overall level and the raw spectrum and waveform; the viewers and the particles are driven by it.

## 3. The audio graph (per node voice)

```
 NOTE (one per play / repeat; many can overlap)
   sources ---------------------------------------------------------------+
   oscillator (x unison voices, detune, stereo spread)   -> srcMix         |
   noise (white / pink / brown buffer, looping)          -> srcMix         |
   sample (decoded buffer, reverse / offset / rate)      -> srcMix         |
   additive (PeriodicWave of N harmonics) | FM (carrier + modulator)       |
   + sub oscillator + noise-under-tone                                     |
   pitch: osc.frequency (note, glide), osc.detune <- pitchBus ------------+
          (pitch envelope, unison detune)                                  v
   srcMix -> [filter 12/24 dB, per note: cutoff, Q, key-track,
              detune <- filter envelope (ConstantSource) + detuneBus]
          -> env gain (ADSR points, per note)
          -> trim gain (iteration gain step, accent, humanize)
          -> [stereo panner for iteration pan spread]
          -> voice inputBus
 VOICE (one per node)
   inputBus -> dyn gain (dynamic mark x gain dB x velocity; crescendo windows)
            -> trem gain (1 - depth/2 + LFO x depth/2)
            -> drift gain (slow random level wander)
            -> fade gain (fade in / fade out)
            -> chain gate (crossfaded when the chain is rebuilt)
            -> [distortion] -> [bitcrush] -> [chorus / flanger] -> [3-band EQ]
            -> [compressor + make-up] -> [delay or ping-pong delay] -> [convolution reverb]
            -> stereo width (mid/side) -> stereo pan (+ auto-pan LFO) = fxOut
 fxOut -+-> AnalyserNode (per voice: spectrum, waveform, level, bands)  [pre-spatial, pre-mute]
        '-> [PannerNode (distance model, cone, HRTF)] -> [air-absorption lowpass]
            -> voice out gain (mute / immediate-stop fade)
            -> MASTER gain (volume, mute) -> limiter (compressor, -2 dB, 20:1)
            -> MASTER AnalyserNode -> destination (speakers)

 LFOs and buses (per voice, shared by all notes)
   pitchBus   = vibrato LFO x depth(cents) + crescendo pitch + doppler cents    -> every osc.detune
   detuneBus  = filter wobble LFO + crescendo brightness + brightness drift     -> every note filter.detune
   OmniMixer bridge: <audio> (mixer channel) -> MediaElementSource -> mixer bus -> mixer AnalyserNode (tap)
                                                                     '-> limiter -> master analyser (heard, and counted in master analysis)
```

Points worth knowing:

- **No clicks by design**: every parameter change on a running voice uses `setTargetAtTime` (an exponential glide of a few milliseconds), notes begin at 0 and end at 0, stolen notes fade over 30 ms, the FX chain is crossfaded (30 ms) when an effect is switched on or off.
- **Per-note filter**: each note owns its filter so the filter envelope restarts with every repeat. The slow filter LFO, the crescendo brightness and the drift are shared through `detuneBus`.
- **Tail**: after the last note ends the voice stays alive for the effects tail (reverb decay, delay feedback) and is then disposed (all nodes disconnected, sources stopped).
- **Analyser is a tap**: it sits before the spatial stage and before the mute gain, so the viewers and particles still react to a muted or far-away node.

## 4. Scheduling (loop, iterative play, crescendo)

A 25 ms timer (`setInterval`) calls `SoundEngine.tick()`. Each tick schedules every note that falls within the next 0.12 s of `AudioContext.currentTime` (1.5 s when the tab is hidden, because browsers throttle timers in background tabs). Notes are placed on a TIME GRID: repeat `i` starts at `anchor + i x interval` (plus swing and jitter), never at "previous start + interval", so there is no cumulative drift. Changing the interval while playing re-anchors the grid at the last note. Random choices (jitter, humanize, random pitch pattern) use a pseudo-random generator seeded from the node id, so a given node always repeats the same way (and the tests are deterministic).

Rules: Sustained + Iterative: only the last repeat of a finite series is held. Sustained + Loop: sustained wins (one held note). Legato retrigger: the first repeat starts the note, later repeats slide its pitch (no new attack). A voice holds at most 24 notes; the oldest is faded out in 30 ms. "Safety stop" ends any sound after N seconds.

Crescendo is computed as a function of time (`dynamicsGainAt`) and written to the `dyn` gain in 1-second `setValueCurveAtTime` windows (2.5 s ahead), also driving the brightness and pitch offsets. Because it is a pure function of time, a live edit just re-schedules from "now" without a jump.

Events on `window` (`omni:sound-state`, detail `{nodeId, state}`): `started`, `stopped` (stop requested or the sound ended), `looped` (+`loopCount`), `iteration` (+`iteration`), `phase` (+`phase`: attack / decay / sustain / release / idle).

## 5. Public API (summary)

`SoundEngine.unlock()`, `isUnlocked()`, `start(nodeId, sound, {getWorldPosition})`, `update(nodeId, sound)`, `stop(nodeId, {immediate})`, `stopAll()`, `isPlaying`, `playing()`, `setVoiceCap/getVoiceCap` (default 8, max 32; the oldest voice is stolen), `setMasterVolume/getMasterVolume`, `setMuted/isMuted`, `configure({masterVolume, voiceCap, muted, requireOptIn})`, `getAnalysis(nodeId | 'master' | 'mixer')`, `getMasterAnalysis()`, `getMixerAnalysis()`, `setListener(pos, forward, up)`, `updateSpatial(dt)`, `bridgeMediaElement(audioEl)`, `tick()`, `dispose()`.

`getAnalysis(nodeId)` returns `null` when the node has no voice, else `{nodeId, playing, phase, level, rms, bands:{sub,bass,lowMid,mid,highMid,presence,brilliance}, peakHz, spectrum:Uint8Array, waveform:Uint8Array, binCount, sampleRate, iteration, loopCount, dynamicNow}`. The typed arrays are REUSED between calls (copy them if you keep them). Bands: sub below 60 Hz, bass 60 to 250, low-mid 250 to 500, mid 500 to 2000, high-mid 2000 to 4000, presence 4000 to 6000, brilliance above 6000; each is 0..1 (half the average and half the strongest bin of the band, scaled by "Band gain", smoothed by "Band smoothing"). `peakHz` is the strongest bin refined by parabolic interpolation (0 below the peak threshold). `level` maps the RMS of the waveform from -54 dB (0) to 0 dB (1).

**Autoplay and unlock.** Browsers allow sound only after a user gesture. The engine never creates an AudioContext before a gesture (so no console warning): `start()` before that queues the request and fires `omni:sound-unlock-needed`; the first `pointerdown` / `keydown` (or an explicit `unlock()`, for example the "Enable sound" button) creates and resumes the context and starts the queued sounds. With the Admin option "require opt-in" (`configure({requireOptIn:true})`) a plain click does NOT unlock; only an explicit `unlock()` does.

**Fake engine.** Without `AudioContext` (jsdom, Node tests, very old browsers) the engine runs the same scheduler on a fake clock and produces a deterministic SYNTHETIC analysis from the settings (harmonics of the waveform, the filter, the envelope and the dynamics), so the particles and viewers can be tested without audio. `SoundEngine._fake === true` in that case; tests can drive time with `_setClock(seconds)` and `tick()`.

**OmniMixer bridge.** The mixer plays its two audio channels with plain `<audio>` elements and has no analyser. `ui/OmniMixerPanel.js` now publishes them (read-only hook, one added line) as `window.__omniMixerAudio = {1: <audio>, 2: <audio>}` and fires `omni:mixer-audio-ready`; `OmniSoundScene` listens to the channels' `play` events and taps them with `SoundEngine.bridgeMediaElement(el)` once audio is unlocked (some sound was requested or `SoundEngine.unlock()` was called, for example by a viewer's button) and a channel is playing. From then on `getAnalysis('mixer')` is the mixer's own spectrum and `getMasterAnalysis()` counts the mixer too. The mixer keeps its own volume (the sound master volume does not change it); the music is routed through the limiter. A browser rule: an element can be turned into a Web Audio source only once, and it is silent until the context is running, so the bridge is only attempted when the context is already running.

**Global settings.** `OmniSoundScene` reads `utils/OmniSoundSettings.js` (Admin; written by part 2) with a dynamic import inside try/catch: master volume (default 0.8), voice cap (default 8), mute on phones, require opt-in. If the module is missing or throws, the defaults apply. It re-reads on `omni:sound-settings-set`.

## 6. Every setting

The tables below are generated from `SOUND_SCHEMA` (the single source of truth: `utils/OmniSoundModel.js`). "Range" gives the allowed values; values outside are clamped or replaced by the default by `sanitizeSound`.

### Source  (24 settings)

What makes the raw sound before anything shapes it: a tone, noise, a recording, or a stack of harmonics.

| Key | Name | Range | What it does |
|---|---|---|---|
| `sourceType` | Source type | one of: oscillator, noise, sample, additive, fm; default oscillator | The kind of sound generator. Oscillator = a steady tone, Noise = random hiss, Sample = a recording you uploaded, Additive = many harmonics added together, FM = one tone bending another (bells, electric pianos). |
| `waveform` | Waveform | one of: sine, square, sawtooth, triangle, custom; default sine | The shape of the tone wave. It decides the timbre (tone colour): sine is the purest, saw is the brightest. |
| `customPartials` | Custom partials | text up to 120 characters, default "1, 0.5, 0.25" | Used when the waveform is Custom: a comma separated list of how loud each harmonic is (first = the base note, second = one octave up, ...). 1, 0.5, 0.25 is a gentle fade. |
| `pulseWidth` | Pulse width | 0.05 to 0.95, default 0.5 | For the square wave: how long it stays "up" in each cycle. 0.5 is a normal square; thin values (0.1) sound nasal and reedy. |
| `phase` | Start phase | 0 to 360 deg, default 0 | Where in its cycle the wave starts. Matters mostly for clicks and for stacked voices. |
| `noiseType` | Noise colour | one of: white, pink, brown; default white | The flavour of noise. White has equal energy at every pitch, pink falls off gently, brown rumbles. |
| `noiseLevel` | Noise mixed into tone | 0 to 1, default 0 | Adds a little noise under any source: breathiness for a flute, grit for a pad. 0 = none. |
| `sampleSlot` | Sample slot (OmniMusicPlayer library) | 0 to 15, default 0 | Which uploaded OmniMusicPlayer audio slot (1 to 15) to play as the sample. 0 = none. |
| `sampleUrl` | Sample URL | text up to 4096 characters, default "" | Optional direct address of an audio file instead of a library slot (blob:, https: or data:). |
| `sampleKeyTrack` | Sample follows the note | on/off, default off | On: the recording is played faster or slower so that it sounds at the chosen note (A4 = original speed). Off: it plays at its own pitch. |
| `additiveHarmonics` | Harmonics count | 1 to 64, default 8 | Additive source: how many overtones are stacked on the base note. More = brighter and richer. |
| `additiveRolloff` | Harmonics rolloff | 0 to 3, default 1 | Additive: how fast the higher overtones get quieter. 0 = all equal (very bright), 1 = natural saw-like fall, 3 = nearly just the base note. |
| `additiveOddOnly` | Odd harmonics only | on/off, default off | Additive: use only the 1st, 3rd, 5th... overtones. This gives a hollow, clarinet-like tone. |
| `fmRatio` | FM ratio | 0.25 to 16 x, default 2 | FM: pitch of the modulator relative to the base note. Whole numbers (1, 2, 3) sound harmonic; fractions (1.41, 3.5) sound metallic and bell-like. |
| `fmDepth` | FM depth | 0 to 20, default 3 | FM: how strongly the modulator bends the tone. 0 = plain sine, larger = brighter and wilder. |
| `fmDecay` | FM depth decay | 0 to 10 s, default 0.6 | FM: how long the bendy brightness takes to die away after the start (like a struck bell getting purer). 0 = stays constant. |
| `fmWaveform` | FM modulator wave | one of: sine, triangle, square, sawtooth; default sine | FM: the wave shape of the modulator. |
| `unisonVoices` | Unison voices | 1 to 8, default 1 | How many copies of the tone play together. 1 = single. More copies slightly out of tune make a thick, chorus-like "supersaw" sound. |
| `unisonDetune` | Unison detune | 0 to 100 cents, default 12 | How far apart the unison copies are tuned (100 cents = one semitone). Small = warm, large = out of tune. |
| `unisonSpread` | Unison stereo spread | 0 to 1, default 0.6 | How widely the unison copies are placed left to right. |
| `subEnabled` | Sub oscillator | on/off, default off | Adds a second tone one or two octaves below to add weight (bass). |
| `subLevel` | Sub level | 0 to 1, default 0.5 | How loud the sub tone is. |
| `subOctave` | Sub octave | one of: -1, -2; default -1 | How far below the note the sub tone plays. |
| `subWaveform` | Sub wave | one of: sine, triangle, square; default sine | The wave shape of the sub tone. |

### Pitch  (12 settings)

How high or low the note is, and how it is tuned.

| Key | Name | Range | What it does |
|---|---|---|---|
| `note` | Note | note name like A4, default A4 | The note to play, as a letter and an octave: C4 is middle C, A4 is the tuning note (440 Hz). |
| `octaveShift` | Octave shift | -4 to 4 oct, default 0 | Moves the whole note up or down by whole octaves. |
| `transpose` | Transpose | -48 to 48 semi, default 0 | Moves the note by semitones (piano keys). 12 = one octave, 7 = a fifth. |
| `fineTune` | Fine tune | -100 to 100 cents, default 0 | Tiny pitch correction; 100 cents = one semitone. |
| `useMidi` | Use MIDI number | on/off, default off | On: ignore the note name and use the MIDI number below (a 0 to 127 number for each piano key, 60 = middle C). |
| `midi` | MIDI number | 0 to 127, default 69 | MIDI key number used when "Use MIDI number" is on. 69 = A4. |
| `freqOverride` | Exact frequency | 0 to 20000 Hz, default 0 | If above 0, plays exactly this frequency and ignores the note settings. 0 = off. |
| `a4` | Concert pitch (A4) | 400 to 480 Hz, default 440 | The reference tuning. 440 is the modern standard; 432 or 415 are sometimes used for a different feel. |
| `glide` | Glide (portamento) | 0 to 5000 ms, default 0 | Slides from the previous pitch to the new one instead of jumping. 0 = no glide. |
| `pitchEnvAmount` | Pitch envelope amount | -2400 to 2400 cents, default 0 | Pitch swoops at the start of every note: positive starts high and falls (a kick drum or laser), negative starts low and rises. |
| `pitchEnvTime` | Pitch envelope time | 0.005 to 5 s, default 0.1 | How long the start-of-note pitch swoop takes. |
| `pitchDrift` | Random pitch drift | 0 to 100 cents, default 0 | A little random wander of pitch each time the note starts, like a real instrument that is never exactly the same twice. |

### Dynamics / Amplitude  (9 settings)

How loud the note is. Musicians write loudness as dynamic marks from pppp (almost silent) to ffff (maximum).

| Key | Name | Range | What it does |
|---|---|---|---|
| `dynamic` | Dynamic mark | one of: pppp, ppp, pp, p, mp, mf, f, ff, fff, ffff; default mf | The loudness in musical terms: p = piano = soft, f = forte = loud, m = mezzo = medium, doubled letters = more extreme. Default mf = moderately loud. |
| `gainDb` | Extra gain | -48 to 12 dB, default 0 | A free volume trim on top of the dynamic mark. Every 6 dB doubles or halves the amplitude; 0 = no change. |
| `velocity` | Velocity | 0 to 1, default 1 | How hard the note is "struck", scaling loudness (and a little brightness) as a piano key would. |
| `humanizeDb` | Humanize loudness | 0 to 12 dB, default 0 | Random loudness variation on every new note or repeat, so repeats do not sound mechanical. |
| `accentEvery` | Accent every N repeats | 0 to 32, default 0 | Every Nth repeat gets louder (a downbeat). 0 = no accents. |
| `accentDb` | Accent boost | 0 to 24 dB, default 6 | How much louder the accented repeats are. |
| `fadeIn` | Fade in | 0 to 30 s, default 0 | A slow overall fade-in when the sound starts (on top of the attack). |
| `fadeOut` | Fade out | 0 to 30 s, default 0 | A slow overall fade-out when the sound is stopped (on top of the release). |
| `muted` | Muted | on/off, default off | Keeps the sound running (so particles and viewers still react) but makes it silent. |

### Envelope (ADSR)  (10 settings)

The loudness shape of one note over time: Attack (fade in), Decay (settle down), Sustain (held level), Release (fade out after you let go).

| Key | Name | Range | What it does |
|---|---|---|---|
| `attack` | Attack | 0 to 10 s, default 0.02 | Time to rise from silence to full loudness. Short = percussive click, long = slow swell. |
| `hold` | Hold | 0 to 10 s, default 0 | Time to stay at full loudness before the decay starts (0 = classic ADSR). |
| `decay` | Decay | 0 to 10 s, default 0.2 | Time to fall from full loudness to the sustain level. |
| `sustainLevel` | Sustain level | 0 to 1, default 0.7 | The loudness held while the note continues (fraction of the peak). 0 = the note dies away by itself like a pluck. |
| `release` | Release | 0 to 20 s, default 0.4 | Time to fade to silence after the note ends or is stopped. |
| `attackCurve` | Attack curve | one of: linear, exponential, logarithmic, scurve; default linear | The shape of the rise during attack. |
| `decayCurve` | Decay curve | one of: linear, exponential, logarithmic, scurve; default exponential | The shape of the fall during decay. |
| `releaseCurve` | Release curve | one of: linear, exponential, logarithmic, scurve; default exponential | The shape of the fade during release. Exponential sounds the most natural. |
| `envTimeScale` | Envelope speed | 0.1 to 10 x, default 1 | Stretches all envelope times at once: 2 = twice as long, 0.5 = twice as fast. |
| `envVelocityTime` | Velocity shortens attack | 0 to 1, default 0 | Harder notes (higher velocity) get a quicker attack, as on real instruments. |

### Sustain  (6 settings)

How the note is held. A SUSTAINED sound keeps playing until you stop it; otherwise it plays for a set length.

| Key | Name | Range | What it does |
|---|---|---|---|
| `sustained` | Sustained (hold until stopped) | on/off, default off | On: the note holds at its sustain level indefinitely until Stop is pressed, then fades by the release time. Off: the note plays for the length below and ends by itself. |
| `duration` | Note length | 0.02 to 120 s, default 1.5 | How long one note lasts before its release starts (ignored when Sustained is on). |
| `sustainDecayDb` | Sustain fade-away | 0 to 24 dB/s, default 0 | While held, the level slowly sinks by this many dB per second (a piano string). 0 = holds perfectly steady. |
| `sustainDrift` | Sustain level drift | 0 to 1, default 0 | A slow random swell and fade of the held level, so a drone feels alive. 0 = none. |
| `sustainDriftRate` | Drift speed | 0.02 to 4 Hz, default 0.3 | How quickly the sustain drift wanders. |
| `sustainBrightDrift` | Brightness drift | 0 to 1, default 0 | A slow random opening and closing of the filter while held (needs the filter enabled). |

### Vibrato / Tremolo  (12 settings)

Vibrato wobbles the PITCH; tremolo wobbles the LOUDNESS. Both are driven by a slow wave called an LFO (low frequency oscillator).

| Key | Name | Range | What it does |
|---|---|---|---|
| `vibratoRate` | Vibrato speed | 0 to 20 Hz, default 5 | How many pitch wobbles per second. About 5 to 7 is a human singer. |
| `vibratoDepth` | Vibrato depth | 0 to 1200 cents, default 0 | How far the pitch wobbles up and down. 0 = off, 20 to 40 = natural, 100 = one semitone. |
| `vibratoDelay` | Vibrato delay | 0 to 10 s, default 0 | Wait this long after the note starts before the vibrato begins. |
| `vibratoFade` | Vibrato fade in | 0 to 10 s, default 0.3 | How slowly the vibrato grows to full depth once it starts. |
| `vibratoShape` | Vibrato wave | one of: sine, triangle, square, sawtooth, random; default sine | The shape of the pitch wobble. |
| `tremoloRate` | Tremolo speed | 0 to 40 Hz, default 6 | How many loudness wobbles per second. |
| `tremoloDepth` | Tremolo depth | 0 to 1, default 0 | How deep the loudness wobble is. 0 = off, 1 = the sound fully drops to silence between pulses. |
| `tremoloDelay` | Tremolo delay | 0 to 10 s, default 0 | Wait this long after the note starts before the tremolo begins. |
| `tremoloFade` | Tremolo fade in | 0 to 10 s, default 0 | How slowly the tremolo grows to full depth. |
| `tremoloShape` | Tremolo wave | one of: sine, triangle, square, sawtooth, random; default sine | The shape of the loudness wobble. Square gives a choppy on/off gate. |
| `tremoloPhase` | Tremolo start phase | 0 to 360 deg, default 0 | Where in its cycle the tremolo starts. |
| `lfoDrift` | LFO speed drift | 0 to 1, default 0 | Makes vibrato and tremolo speeds waver slightly, like a human. |

### Time & Playback  (25 settings)

Looping and iterative play: how the sound repeats, and how each repeat can change.

| Key | Name | Range | What it does |
|---|---|---|---|
| `startDelay` | Start delay | 0 to 60 s, default 0 | Wait before the very first note after Play. |
| `loop` | Loop | on/off, default off | Repeat the whole sound again and again. |
| `loopCount` | Loop count | 0 to 9999, default 0 | How many times to loop. 0 = loop forever. |
| `loopGap` | Gap between loops | 0 to 60 s, default 0 | Silence between one loop and the next. |
| `iterative` | Iterative play (repeats) | on/off, default off | Play the note several times in a row on its own, each repeat can change pitch and volume (arpeggios, ladders, echoes, rain drops). |
| `iterations` | Repeats | 1 to 999, default 4 | How many times the note is played in iterative mode. |
| `iterInfinite` | Repeat forever | on/off, default off | Iterative mode never ends (until Stop). |
| `intervalUnit` | Interval unit | one of: ms, beat; default ms | Measure the time between repeats in milliseconds or in musical beats. |
| `interval` | Interval | 20 to 60000 ms, default 400 | Time from the start of one repeat to the start of the next. |
| `intervalBeats` | Interval in beats | 0.0625 to 16 beats, default 1 | The same, in beats (1 = quarter note, 0.5 = eighth note). |
| `tempo` | Tempo | 20 to 300 bpm, default 120 | Beats per minute, used when the interval is in beats. |
| `intervalJitter` | Interval jitter | 0 to 1, default 0 | Randomness of the time between repeats (0.2 = up to 20 percent earlier or later). Makes rhythms feel human or like falling rain. |
| `swing` | Swing | 0 to 0.9, default 0 | Delays every second repeat for a lilting, shuffled rhythm. |
| `iterPitchStep` | Pitch step per repeat | -24 to 24 semi, default 0 | Each repeat is this many semitones higher (or lower) than the one before: a rising ladder or a falling cascade. |
| `iterPattern` | Pitch pattern | one of: ladder, updown, down, random, cycle; default ladder | How the pitch steps behave across repeats. |
| `iterPatternLength` | Pattern length | 2 to 64, default 8 | How many steps before up-and-down or cycle patterns turn around or restart. |
| `iterGainStep` | Volume step per repeat | -12 to 12 dB, default 0 | Each repeat is this much louder (or quieter) than the last: negative = echo fading away. |
| `iterFilterStep` | Brightness step per repeat | -2 to 2 oct, default 0 | Each repeat opens (positive) or closes (negative) the filter by this many octaves. |
| `iterPanSpread` | Pan spread per repeat | 0 to 1, default 0 | Places repeats at alternating left and right positions. |
| `iterNoteLength` | Repeat note length | 0 to 10 s, default 0 | Length of each repeated note. 0 = use the main note length. |
| `retrigger` | Retrigger mode | one of: retrigger, legato; default retrigger | Whether each repeat starts a fresh note or slides smoothly from the previous one. |
| `playbackRate` | Playback rate | 0.1 to 4 x, default 1 | For samples: speed (and pitch) of playback. 2 = twice as fast and an octave higher. |
| `startOffset` | Sample start offset | 0 to 600 s, default 0 | For samples: start playing this many seconds into the recording. |
| `reverse` | Reverse | on/off, default off | For samples: play the recording backwards. |
| `maxPlayTime` | Safety stop | 0 to 3600 s, default 0 | Always stop the sound after this many seconds. 0 = never. |

### Crescendo / Decrescendo  (9 settings)

A gradual change of loudness over time: crescendo = getting louder, decrescendo (diminuendo) = getting softer.

| Key | Name | Range | What it does |
|---|---|---|---|
| `crescendoEnabled` | Crescendo / decrescendo | on/off, default off | Turn on a gradual loudness change from one dynamic to another. |
| `crescendoFrom` | From dynamic | one of: pppp, ppp, pp, p, mp, mf, f, ff, fff, ffff; default pp | The loudness to start at. |
| `crescendoTo` | To dynamic | one of: pppp, ppp, pp, p, mp, mf, f, ff, fff, ffff; default ff | The loudness to arrive at. Higher than From = crescendo, lower = decrescendo. |
| `crescendoTime` | Over | 0.1 to 600 s, default 8 | How many seconds the change takes. |
| `crescendoCurve` | Curve | one of: linear, exponential, logarithmic, scurve; default linear | The shape of the change. |
| `crescendoDelay` | Delay | 0 to 120 s, default 0 | Wait before the change begins (holds the From level). |
| `crescendoRepeat` | When it arrives | one of: hold, loop, pingpong; default hold | What happens after the change completes. |
| `crescendoBrightness` | Opens the filter too | 0 to 1, default 0 | Louder usually also means brighter. This opens the filter as the sound gets louder (needs the filter enabled). 0 = loudness only. |
| `crescendoPitch` | Rising pitch | -1200 to 1200 cents, default 0 | Pitch change along the crescendo (a rising siren or sinking drone). |

### Filter  (15 settings)

A filter removes or boosts part of the pitch range: lowpass = dull (keeps lows), highpass = thin (keeps highs), bandpass = only a slice.

| Key | Name | Range | What it does |
|---|---|---|---|
| `filterEnabled` | Filter on | on/off, default off | Use the filter. |
| `filterType` | Filter type | one of: lowpass, highpass, bandpass, notch, peaking, lowshelf, highshelf, allpass; default lowpass | What the filter does to the sound. |
| `filterCutoff` | Cutoff frequency | 20 to 20000 Hz, default 2000 | The pitch where the filter starts working. For a lowpass, everything above this gets quieter. |
| `filterQ` | Resonance (Q) | 0.1 to 30, default 1 | Emphasis right at the cutoff. Low = smooth, high = ringing, whistling. |
| `filterGainDb` | Boost / cut | -24 to 24 dB, default 0 | For peaking and shelf types: how much to boost or cut. |
| `filterSlope` | Slope | one of: 12, 24; default 12 | Steepness of the cut. Steep uses two filters in a row. |
| `filterKeyTrack` | Follow the note | 0 to 1, default 0 | Moves the cutoff with the note pitch, so high notes are as bright as low ones. 1 = fully follows. |
| `filterEnvAmount` | Filter envelope amount | -8 to 8 oct, default 0 | The cutoff sweeps by this many octaves at the start of each note then settles (the classic "wow" of synth basses). |
| `filterEnvAttack` | Filter env attack | 0 to 10 s, default 0.01 | Time for the cutoff to reach the sweep peak. |
| `filterEnvDecay` | Filter env decay | 0 to 10 s, default 0.3 | Time for the cutoff to settle back after the peak. |
| `filterEnvSustain` | Filter env sustain | 0 to 1, default 0 | How much of the sweep stays while the note is held. |
| `filterEnvRelease` | Filter env release | 0 to 10 s, default 0.3 | Time for the cutoff to return when the note ends. |
| `filterLfoRate` | Filter wobble speed | 0 to 30 Hz, default 2 | Speed of an automatic slow cutoff wobble ("wah-wah"). |
| `filterLfoDepth` | Filter wobble depth | 0 to 6 oct, default 0 | How far the wobble moves the cutoff. 0 = no wobble. |
| `filterLfoShape` | Filter wobble wave | one of: sine, triangle, square, sawtooth, random; default sine | The wave shape of the cutoff wobble. |

### Effects (FX)  (42 settings)

Effects change the sound after it is made: space (reverb, delay), colour (distortion, EQ), thickness (chorus), and control (compressor).

| Key | Name | Range | What it does |
|---|---|---|---|
| `reverbEnabled` | Reverb on | on/off, default off | Adds the sound of a room or hall around the note. |
| `reverbMix` | Reverb dry/wet | 0 to 1, default 0.3 | Balance between the original (dry, 0) and the reverb only (wet, 1). |
| `reverbDecay` | Reverb decay | 0.1 to 12 s, default 2.5 | How long the echoes of the room take to die away: 0.5 s = small room, 3 s = hall, 8 s = cathedral. |
| `reverbSize` | Reverb room size | 0 to 1, default 0.5 | How big the room feels (spacing of the early reflections). |
| `reverbPreDelay` | Reverb pre-delay | 0 to 200 ms, default 0 | A small gap before the reverb starts, keeping the dry note clear. |
| `reverbDamping` | Reverb damping | 0 to 1, default 0.4 | How quickly high tones fade in the reverb tail. High = warm and dark, low = bright and shiny. |
| `delayEnabled` | Delay (echo) on | on/off, default off | Adds repeating echoes. |
| `delayTime` | Delay time | 5 to 2000 ms, default 350 | Time between echoes. |
| `delayFeedback` | Delay feedback | 0 to 0.95, default 0.35 | How many echoes: 0 = one echo, 0.5 = several, 0.9 = nearly endless. |
| `delayMix` | Delay mix | 0 to 1, default 0.3 | How loud the echoes are against the original. |
| `delayTone` | Delay tone | 200 to 20000 Hz, default 5000 | Echoes get darker each repeat above this frequency, like tape or a cave. |
| `delayPingPong` | Ping-pong | on/off, default off | Echoes bounce between left and right. |
| `distortionEnabled` | Distortion on | on/off, default off | Adds crunch by clipping the wave. |
| `distortionAmount` | Distortion amount | 0 to 1, default 0.4 | How hard the sound is pushed. Low = warm saturation, high = fuzz. |
| `distortionType` | Distortion type | one of: soft, hard, fold, tube; default soft | The character of the distortion. |
| `distortionMix` | Distortion mix | 0 to 1, default 1 | Blend of distorted and clean sound. |
| `distortionTone` | Distortion tone | 500 to 20000 Hz, default 8000 | A lowpass after the distortion to tame fizz. |
| `modFxEnabled` | Chorus / flanger on | on/off, default off | Thickens the sound by mixing in slightly detuned, moving copies. |
| `modFxType` | Chorus or flanger | one of: chorus, flanger; default chorus | Chorus uses a longer delay and sounds like several players; flanger uses a very short delay and sweeps like a jet plane. |
| `modFxRate` | Rate | 0.05 to 10 Hz, default 0.8 | Speed of the sweep. |
| `modFxDepth` | Depth | 0 to 1, default 0.5 | Width of the sweep. |
| `modFxMix` | Mix | 0 to 1, default 0.5 | How much of the moving copy is mixed in. |
| `modFxFeedback` | Feedback | 0 to 0.9, default 0.2 | Feeds the effect into itself for a more intense, ringing sweep (mostly flanger). |
| `bitcrushEnabled` | Bitcrush on | on/off, default off | Lo-fi digital crunch by using fewer loudness steps. |
| `bitcrushBits` | Bit depth | 1 to 16 bits, default 8 | Fewer bits = coarser, noisier, more retro. 16 = clean. |
| `bitcrushMix` | Bitcrush mix | 0 to 1, default 1 | Blend of crushed and clean sound. |
| `eqEnabled` | EQ on | on/off, default off | A 3-band tone control: bass, middle, treble. |
| `eqLowDb` | EQ low | -18 to 18 dB, default 0 | Boost or cut the bass. |
| `eqLowFreq` | EQ low corner | 40 to 800 Hz, default 200 | Where the bass control starts. |
| `eqMidDb` | EQ mid | -18 to 18 dB, default 0 | Boost or cut the middle. |
| `eqMidFreq` | EQ mid centre | 200 to 5000 Hz, default 1000 | The middle of the mid control. |
| `eqMidQ` | EQ mid width (Q) | 0.2 to 10, default 1 | How narrow the mid control is. High = a narrow slice. |
| `eqHighDb` | EQ high | -18 to 18 dB, default 0 | Boost or cut the treble. |
| `eqHighFreq` | EQ high corner | 1000 to 16000 Hz, default 4000 | Where the treble control starts. |
| `compEnabled` | Compressor on | on/off, default off | Evens out loudness by turning down the loudest parts. |
| `compThreshold` | Compressor threshold | -60 to 0 dB, default -24 | Sounds louder than this level get turned down. |
| `compRatio` | Compressor ratio | 1 to 20 :1, default 4 | How strongly loud parts are turned down. 4:1 = gentle, 20:1 = nearly a hard limit. |
| `compAttack` | Compressor attack | 0 to 1 s, default 0.01 | How fast the compressor reacts. |
| `compRelease` | Compressor release | 0.01 to 2 s, default 0.25 | How fast it lets go. |
| `compKnee` | Compressor knee | 0 to 40 dB, default 12 | Softness of the start of compression. |
| `compMakeup` | Compressor make-up gain | 0 to 24 dB, default 0 | Brings the volume back up after compressing. |
| `stereoWidth` | Stereo width | 0 to 2, default 1 | 0 = mono, 1 = as is, 2 = extra wide. |

### Spatial  (16 settings)

Where the sound seems to be in the 3D world. Positional sound gets quieter with distance and pans as you turn.

| Key | Name | Range | What it does |
|---|---|---|---|
| `positional` | Positional (3D) | on/off, default off | On: the sound comes from the node position, so it is louder when you are near and moves left/right as you turn. Off: plays flat in your head. |
| `distanceModel` | Distance model | one of: linear, inverse, exponential; default inverse | How loudness drops with distance. |
| `refDistance` | Full-volume distance | 0.1 to 200 m, default 4 | Within this distance the sound is at full loudness. |
| `maxDistance` | Max distance | 1 to 2000 m, default 120 | Beyond this distance the sound stops getting quieter (linear model: silent). |
| `rolloff` | Rolloff | 0 to 10, default 1 | How quickly the sound fades with distance. Higher = fades faster. |
| `panningModel` | Panning model | one of: equalpower, HRTF; default equalpower | How left/right/behind is simulated. HRTF is best on headphones. |
| `coneInner` | Cone inner angle | 0 to 360 deg, default 360 | Inside this angle in front of the node the sound is at full volume. 360 = same in all directions. |
| `coneOuter` | Cone outer angle | 0 to 360 deg, default 360 | Outside this angle the sound is turned down to the outer gain. |
| `coneOuterGain` | Cone outer gain | 0 to 1, default 0.2 | Volume behind the cone. |
| `coneAzimuth` | Cone direction (turn) | -180 to 180 deg, default 0 | Which way the cone points around the vertical axis. |
| `coneElevation` | Cone direction (tilt) | -90 to 90 deg, default 0 | Which way the cone points up or down. |
| `pan` | Pan | -1 to 1, default 0 | Left (-1) to right (+1), used when not positional. |
| `panLfoRate` | Auto-pan speed | 0.02 to 10 Hz, default 0.5 | Speed of an automatic left-right sweep. |
| `panLfoDepth` | Auto-pan depth | 0 to 1, default 0 | Width of the auto sweep. 0 = off. |
| `doppler` | Doppler | on/off, default off | Pitch bends as the node moves past you (like a passing siren). |
| `occlusion` | Distance muffling | one of: none, air; default none | Far sounds lose their treble as in real air. |

### Triggers  (7 settings)

When the sound starts and stops by itself.

| Key | Name | Range | What it does |
|---|---|---|---|
| `autoStart` | Auto start | one of: manual, scene-load, proximity, click; default manual | What makes the sound start. |
| `proximityRadius` | Proximity radius | 0.5 to 500 m, default 12 | Distance at which proximity start triggers. |
| `proximityStop` | Stop when you leave | on/off, default on | In proximity mode, stop when you move away. |
| `triggerEvent` | Also start on | one of: none, selected, connected; default none | Extra node events that start the sound. |
| `triggerStop` | Stop on | one of: none, deselected; default none | Events that stop the sound. |
| `cooldown` | Cooldown | 0 to 60 s, default 0 | Minimum seconds between two automatic starts. |
| `clickToggle` | Click toggles | on/off, default on | In click mode, a second click stops the sound. |

### Analysis  (8 settings)

How the sound is measured for the viewers, the node reaction and the particles.

| Key | Name | Range | What it does |
|---|---|---|---|
| `analysisEnabled` | Analyse this sound | on/off, default on | Measure the frequencies (needed for particles and viewers). Turn off to save a little power. |
| `fftSize` | FFT size | one of: 256, 512, 1024, 2048, 4096; default 2048 | Number of samples per analysis. Bigger = finer frequency detail. |
| `smoothing` | FFT smoothing | 0 to 0.99, default 0.8 | Averages the spectrum over time. High = calm, low = twitchy. |
| `minDb` | Minimum dB | -140 to -30 dB, default -100 | The level shown as zero in the spectrum. |
| `maxDb` | Maximum dB | -60 to 0 dB, default -20 | The level shown as full in the spectrum. |
| `bandSmoothing` | Band smoothing | 0 to 0.99, default 0.6 | Extra smoothing of the 7 band values. |
| `bandGain` | Band gain | 0.1 to 8 x, default 1 | Boosts the band values for quiet sounds. |
| `peakThreshold` | Peak threshold | 0 to 1, default 0.02 | Below this level no peak pitch is reported. |

### Meta  (7 settings)

Name and bookkeeping.

| Key | Name | Range | What it does |
|---|---|---|---|
| `enabled` | Sound enabled | on/off, default on | Whether this node makes sound at all. |
| `label` | Sound name | text up to 60 characters, default "Sound" | A name for this sound. |
| `tags` | Tags | text up to 120 characters, default "" | Comma separated words to find it again. |
| `color` | Colour | colour, default #66ccff | A colour used by viewers and the node glow. |
| `notes` | Notes | text up to 400 characters, default "" | Your own notes about this sound. |
| `presetId` | Preset | text up to 40 characters, default "" | The preset this was started from. |
| `version` | Model version | 1 to 99, default 1 | Internal version of the settings layout. |

## 7. Presets

Apply with `soundFromPreset(id)` or `mergeSound(SOUND_PRESETS[id].settings)`. The number is how many settings the preset changes from the default.

| Id | Name | Settings changed |
|---|---|---|
| `sinePad` | Pure sine pad | 13 |
| `pluck` | Pluck | 15 |
| `bell` | Bell | 14 |
| `organ` | Organ | 16 |
| `kick` | Kick drum | 13 |
| `snare` | Snare burst | 15 |
| `bass` | Bass | 15 |
| `siren` | Siren | 14 |
| `wind` | Wind | 18 |
| `drone` | Drone | 18 |
| `arp` | Arpeggio | 18 |
| `swell` | Swell (crescendo) | 17 |
| `rain` | Rain drops | 20 |
| `heartbeat` | Heartbeat | 17 |
| `robot` | Robot voice | 12 |

## 8. Limits, safety and what is approximate

- Values are always sanitized (`sanitizeSound`): unknown keys dropped, numbers clamped, enums fall back, text stripped of control characters and truncated, hostile input (`__proto__`, NaN, huge numbers) cannot throw. `sampleUrl` is limited to 4096 characters (a URL, not audio data); uploaded audio normally lives in the OmniMixer library and is referenced by `sampleSlot` (1..15, read from the IndexedDB store `omnimixer-audio`).
- Voice cap: default 8, max 32 (Admin setting). A master limiter (threshold -2 dB, ratio 20:1) protects ears and speakers from stacked loud voices.
- Reverb uses a GENERATED impulse response (noise with an exponential tail, damping and early reflections), cached per decay / size / damping. Changing those live rebuilds the response after 150 ms; the swap can be audible as a slight change of the tail.
- Bitcrush is an approximation (a quantizing WaveShaper curve, no sample-rate reduction, no AudioWorklet). Vibrato delay and fade count from the start of the voice, not from every repeat. Doppler is computed by the scene loop (radial speed -> pitch cents); the browser PannerNode itself has no Doppler.
- FM modulator depth is an absolute frequency deviation computed at note start; a glide on a long FM note does not rescale it.
- Changing a source-level setting (waveform, unison, filter on/off ...) while a note is held restarts that held note (the old one fades with its release, the new one starts with its normal attack, so a slow attack is heard again); most other settings glide with no restart.
- Chrome rounds automation times to sample frames, so consecutive crescendo windows leave a 2 ms gap (inaudible).
- Not judged by ear: tone quality, clicks and latency on real speakers were not listened to (see the build notes).

## 9. Tests

`v194a_model_test.mjs` (model: defaults, clamps, hostile input, schema consistency, dynamics, notes, presets), `v194a_engine_fake_test.mjs` (fake engine: phases, sustain, loop, iterative grid, crescendo, update, voice cap, hostile), `v194a_engine_mock_test.mjs` (the REAL graph code against a strict mock AudioContext that throws like Chrome on overlapping automation: every preset, every source type, live updates, disposal), `v194a_scene_test.mjs` (listener, auto-start, proximity, click, requests, deletion, destroy). In a real Chromium (`autoplay-policy=no-user-gesture-required`; the headless browser runs the AudioContext on a null sink): a 440 Hz sine gives a non-zero spectrum with `peakHz` about 440, live update to A5 gives about 880, noise is broadband, loop / iterative / crescendo / stop / voice cap / every preset / all effects on / unlock queue / opt-in / the OmniMixer bridge (a 1 kHz tone through an `<audio>` element gives `peakHz` about 1000) and a full app boot with no new console errors.
