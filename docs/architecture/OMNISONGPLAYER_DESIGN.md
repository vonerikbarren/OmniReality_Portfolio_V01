# OmniSong core: the song model and the song player (V198, agent 1)

Files: `utils/OmniSongModel.js` (pure model + edit ops), `systems/OmniSongPlayer.js` (the `SongPlayer` singleton, the scene module `OmniSongPlayerScene`), `ui/OmniSongCoreModules.js` (registration, 3 lines in `main.js`). Contract: `OMNISONG_CONTRACT.md`. Design of the whole feature: `OMNISONGNODE_DESIGN.md`.

## 1. Model (`utils/OmniSongModel.js`)

Pure: no DOM, no three, no audio. `node.data.song`, kind id `KIND_SONG = 'songNode'`.

- `sanitizeSong(x)` never throws, repairs everything, drops unknown keys (`__proto__`, `constructor`), enforces `SONG_LIMITS`, makes ids unique (ids must match `[A-Za-z0-9_-]{1,32}`, never start with `__`, a lane may not be called `master`), is idempotent and JSON-stable. Non-objects give `defaultSong()` (a pattern lane `lane1` and an audio lane `lane2`); a song object WITHOUT a `lanes` key also gets those two, `lanes: []` stays empty.
- Clips that reference a missing lane, whose `ref.type` does not match the lane kind (`music` on a pattern lane, `audio` on an audio lane), whose ref id is unsafe, or whose length is not > 0 are DROPPED. A clip whose pattern node was deleted in the scene is not a model matter: the clip stays, the player skips it with a warning.
- Bars are 1-based floats rounded to 1/1000. Minimum clip length 1/8 bar (`SONG_LIMITS.minClipBars`), minimum loop 1/4 bar. A clip must start between bar 1 and bar 256.
- Caps: 32 lanes, 512 clips, 64 tempo points, 64 sections, 64 automation lanes x 256 points, 128 markers, 16 tags, hostile arrays are only scanned up to 2 x cap items (a `new Array(1e7)` costs nothing).
- Automation lanes are unique per (target, param); targets are a lane id or `'master'` (master only `volume`, `pan`, `filter`). Value ranges: volume 0..1.5, pan -1..1, filter 0..1 (1 = open), sends 0..1.

### Tempo map maths

`bpm` is the tempo from bar 1 (quarter-note beats per minute). A `tempoMap` point `{bar, bpm}` (bar > 1) changes the tempo from that bar on; a point sent on bar 1 is folded into `bpm` (one source of truth); two points on one bar keep the later; points are sorted. The map is piecewise CONSTANT (a jump, no ramps). A bar has `beatsPerBar = timeSig[0] * 4 / timeSig[1]` beats.

```
segments i: start bar b_i, tempo t_i, spb_i = beatsPerBar * 60 / t_i   (seconds per bar)
cum_0 = 0,  cum_{i+1} = cum_i + (b_{i+1} - b_i) * spb_i
barToSeconds(bar) = cum_i + (bar - b_i) * spb_i          i = last segment with b_i <= bar   (bars < 1 extrapolate with segment 0)
secondsToBar(sec) = b_i + (sec - cum_i) / spb_i          i = last segment with cum_i <= sec
```
Both are monotone and exact inverses (tested over 300 random maps, worst error < 1e-9 bars). `bpmAt(bar)` is the tempo of the segment (a point's own bar already has the new tempo). `tempoSegments(song)` + `barToSecondsSeg` / `secondsToBarSeg` / `bpmAtSeg` do the same with a precomputed table (the player caches it; no allocation per call). All of them tolerate unsanitized songs.

### Edit ops

All `(song, ...) -> new sanitized song`, never throw, never mutate the input; an op that cannot apply (unknown id, wrong lane kind, a cap, bad numbers) returns the sanitized input unchanged. To learn the id an add op created pass your own `id` (`newId('clip')`) or call `addedId(before, after, 'clips')`.

- `resizeClip(song, id, len, {fromStart})`: from the end by default; `fromStart` keeps the END fixed, moves the start and ADDS the same amount to `offset` so the content stays in place (never before bar 1, never below offset 0).
- `splitClip(song, id, atBar)`: refused unless both pieces keep >= 1/8 bar. The first piece loses `fadeOut`, the second gets `offset + (atBar - start)` and loses `fadeIn`, so `len1 + len2 = len`, `end2 = end`, and the played content is identical (invariants are random-tested).
- `moveClip` / `updateClip` to a lane of another KIND are refused as a whole (a pattern clip cannot sit on an audio lane).
- `removeLane` removes its clips and its automation. `setTempoPoint(song, 1, bpm)` sets the base tempo.
- `automationValueAt(song, target, param, bar)`: `null` without automation; before the first point the first value, after the last the last; `linear` interpolates, `step` holds the left value.
- `demoSong(refs)`: one pattern lane per ref (`'nodeId'` or `{id,name,bars}`, max 8), 16 bars, sections Intro / Verse / Chorus / Outro, lane n enters in section n, `repeat` fills the clip, plus an empty audio lane.

## 2. Player (`systems/OmniSongPlayer.js`)

API (contract): `play(nodeId,{fromBar}) stop pause seek isPlaying update(nodeId, song?) getPosition getLevels`. Events: in `omni:song-transport-request {action:'play'|'stop'|'pause'|'toggle'|'seek', nodeId?, bar?}` (answer in `detail.out`, failures also raise `omni:notify-info`), out `omni:song-transport {state:'play'|'stop', nodeId, paused?}`. `omni:node-deleted` of the playing song and `omni:scene-clear-request` stop it. ONE song plays at a time: `play` of another song stops the first (and announces its stop).

`stop` returns the play position to bar 1 (or the bar of the last explicit `play({fromBar})` / `seek` while stopped); `pause` keeps the bar; the song stops by itself 0.25 s after the end of the last bar (not looping).

### Scheduler

A `setTimeout` every 25 ms (and the scene module's per-frame `update()` as a safety net) schedules everything that falls in the next 100 ms (1.5 s when `document.hidden`) against `SoundEngine.now()` (the AudioContext clock, or the fake clock). Time is kept by ANCHORS `{t (engine seconds), s (song seconds), wrap}`; the song position at engine time `t` is `s + (t - anchor.t)` of the last anchor with `anchor.t <= now`. Song seconds <-> bars go through the tempo table, so a tempo change inside the song needs no special case and nothing drifts.

Each pass schedules the half-open song-seconds window `[cursor, horizon)`; the half-open bar window is passed to every clip, so an event belongs to exactly one window (neighbouring windows use the same epsilon of 1e-7 beat so a float error of the bar <-> seconds round trip can neither lose nor double an event on the edge).

- LOOP: when the window contains the loop end (`loop.on`, `endBar` clipped to the song length) it is split there; a new anchor `{t: exact engine time of the loop end, s: loop start}` is pushed and the cursor moves to the loop start, so the wrap has no gap and no double note, and `getPosition` jumps back exactly when the audible time passes the anchor (`loopCount` counts those). Notes and audio that would run past the loop end (or the clip end, or the song end) are shortened to it. Starting after the loop end simply plays on to the song end.
- SEEK while playing: release all sounding notes, stop the audio sources, one new anchor 30 ms ahead. Audio clips that are already running at the new position start mid-way (offset advanced); the same is done at a loop wrap and at the start.
- LIVE EDITS: when `node.data.song` is replaced by another object (or `SongPlayer.update(nodeId, song)` is called) the new song is adopted: the position (bar) and the schedule cursor (bar) are kept and re-mapped through the new tempo map, so a tempo / mixer / clip edit never jumps. Notes that were already scheduled in the last 100 ms keep their old times. A pattern lane that just became inaudible (mute / solo) has its sounding notes released at once.
- STALLS: events more than 120 ms in the past are skipped (no burst after a throttled tab); max 512 events per pass.
- Probability (`prob`) uses `Math.random` (injectable in tests).

### Pattern clips

A pattern clip plays the referenced MusicNode (`node.data.music`, via `Extra.SERVICES.music.getMusic` when the MusicNodes runtime is there, else its own sanitized cache). Beats (quarter notes) are the common unit: the event at step `k` of tile `n` sits at `n*P + k*sb (+ swing*sb on odd steps) + offset*sb` beats of the clip's source stream, `P` = pattern length in beats, `sb` = step length in beats. The clip shows the stream window `[offset*bpb, min(offset*bpb + length*bpb, repeat*P))` (`bpb` = beats per bar of the SONG), starting at `startBar`; so `repeat` is how many times the pattern is allowed to run, a longer clip is silent after the last repeat. Event bar = `startBar + (streamBeat - offset*bpb) / bpb`, engine time = anchor + `barToSeconds(bar)`. The gate (seconds) = `gate * sb * 60 / bpmAt(bar)`. The sound is the track's instrument node (`data.sound`, sanitized, exactly as `OmniSequencer`); the default instrument is the MusicNode itself (soft sine). The MusicNode's own track mute / solo, volume, gain, transpose are honoured; clip `transpose` and lane/clip/master gain are added.

**LIMIT (by design)**: `SoundEngine.playNote` voices go to the engine's own master and are not routed through the lane buses. Lane volume, clip gain, master gain, mute, solo and `volume` automation therefore act as a VELOCITY scale, capped at velocity 1 (a pattern lane cannot be louder than the pattern's own level; volume 1.5 = 1). `pan` is passed to the engine like `OmniSequencer` does (the engine ignores it today). Lane `filter`, `sendReverb`, `sendDelay` and the lane/master `pan` do NOT touch pattern lanes. Pattern lane meters are computed from the scheduled velocities (decaying).

### Audio clips and buses

`AudioAssets.playClip(ctx, id, {when, offset, duration, gain, fadeIn, fadeOut, rate:1, dest})` (utils/OmniAudioAssets.js, agent 3) is loaded with a defensive dynamic `import()` at `init()` / first `play()`; `SongPlayer.setAudioAssets(stub)` installs a double (tests), `setAudioAssets(false)` pretends there is none. While the import is pending the song's start is held (nothing scheduled yet), if it fails audio clips are skipped and `getPosition().warnings` says so. The handle may be sync or a Promise; `getBuffer` is called for every audio ref at play to warm the cache (a null buffer adds a warning). Audio is NOT time-stretched: the clip length in bars is converted to SECONDS through the tempo map at its position, `offset` bars to seconds with the tempo at the clip start; `repeat` is ignored for audio; a clip longer than its source is silent after the source.

Graph, built lazily when the song has an audio lane and `SoundEngine.getContext()` exists (never a second context; with the fake engine / before unlock there is no graph and a warning is raised):

```
clip source -> lane.in (Gain = fader*mute/solo*automation) -> lowpass (filter) -> StereoPanner -> master.in
                                                                        |-> AnalyserNode (meter)
                                                                        |-> sendReverb Gain -> revIn -> Convolver(generated impulse) -> revRet Gain(mix) -> master.in
                                                                        |-> sendDelay  Gain -> delIn -> Delay(time) <-> feedback Gain(+4.5 kHz lowpass) -> delRet Gain(mix) -> master.in
master.in (Gain = master.gain) -> lowpass -> StereoPanner -> DynamicsCompressor (limiter) -> AnalyserNode -> SoundEngine master gain (global volume / mute) or destination
```
Limiter: threshold `master.limiterThresholdDb`, knee 0, ratio 20, attack 3 ms, release 100 ms; `limiter:false` sets ratio 1 / threshold 0 (transparent). Reverb impulse = `makeImpulse` of the engine (decay 0.5 + 3.5 x size seconds), regenerated when `size` changes by > 0.02. Delay time 0.02..2 s (seconds, not beats). Every tick the player pushes the mixer state into the AudioParams (`setTargetAtTime`, 15 ms constant, only when a value changed by > 1e-4); automation is evaluated at the bar 50 ms ahead, so it is stepped in 25 ms slices and smoothed. While an automation lane exists it REPLACES the fader of that param. `getLevels` reads the analysers on demand into preallocated buffers (peak, 0.25 s decay) and returns ONE reused object per session.

### Stop / cleanup

`stop`/`pause`/node delete: timer cleared, `allNotesOff` for every instrument id the song used, audio handles `stop()`ped, the master gain ramped to 0 (10 ms) and all graph nodes `disconnect()`ed 150 ms later (`flushDisposals()` does it at once; `destroy()` calls it). Nothing holds the context afterwards.

## 3. What is NOT done

- Pattern lanes do not go through lane buses: no pan, filter, sends or boost above the pattern level (needs per-instrument routing in `OmniSoundEngine`, a later build).
- No time-stretch / warping, no audio `repeat`, no tempo ramps (jumps only), no time-signature changes inside the song, no MIDI/WAV export, no mic recording, no lyrics UI, no 3D (see `OMNISONGNODE_DESIGN.md`).
- A live tempo edit keeps the notes already scheduled in the last 100 ms at their old times.
- Delay time is in seconds, not tempo-synced.
- Nobody has listened to it (no ears in the test environment): timing and levels are verified by data and analyser readings only.
