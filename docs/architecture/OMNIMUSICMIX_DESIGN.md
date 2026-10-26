# OmniMusicMixNode (DESIGN + what V201 built)

Date: 2026-10-15 · Status: **Layer 1 (mixing desk) and the core of Layer 2 (crossfader, DJ moves, tempo sync) and Layer 3 (automation, recording) are built in V201.** Decks with jog wheels, time-stretch, cue/loop points and export are not. · Owner: the founder · Never heard on a real device.

## 1. The idea, and why it is "all three"

The owner asked whether the MusicMixNode is "a higher functioning DJ mix mode and / or all three" of the mix meanings. The answer built is: **one node, three layers**, each useful alone.

1. **The desk (mixing).** Inputs from Sound / Song nodes and audio-library clips go through channel strips (volume, pan, mute / solo, filter, EQ, sends) into a master bus with a limiter. This is what "mix" means in a studio.
2. **The DJ (mixing live).** A crossfader (strips assigned A / Through / B), a shared tempo, per-strip tempo and sync, and "moves" (crossfade, fade, filter sweep over N seconds). Same maths as the OmniDJ (`utils/OmniDJModel.js`: square-taper fader, constant-power or linear crossfade).
3. **The set (mix as a recorded piece).** Every control can have an automation lane; a DJ move is just two automation points; Rec writes your fader moves as points. The result replays, and later can be edited or exported (an album track, a tutorial, the marketing product the growth plan describes).

The logic holds because everything is one data model: a mix is `strips + master + cross + automation`, and **a live move and a recorded move are the same thing** (a value at a time). The node stays small; the audio graph is rebuilt from the model.

## 2. Data (`node.data.mix`, `utils/OmniMixModel.js`)

`{ version, name, bpm, strips[], master{gain, limiter, limiterThresholdDb, reverbMix, delayMix}, cross{pos -1..1, curve}, automation[{target, points[{t, v, ease}]}] }`. A strip: `{ id, name, source{type: song|sound|audio, id}, volume, pan, mute, solo, filter, eq{low,mid,high}, sends{reverb,delay}, assign A|T|B, loop, bpm, sync, color }`. Targets: `<stripId>.volume|pan|filter|eqLow|eqMid|eqHigh|sendReverb|sendDelay`, `master.gain`, `cross.pos`. Time is seconds from the start. Limits: 16 strips, 64 lanes, 256 points, one hour. sanitize never throws and is idempotent; ops are immutable.

## 3. Audio (`systems/OmniMixEngine.js`)

`source -> strip.in (fader x crossfader x mute/solo) -> low shelf -> mid peak -> high shelf -> low-pass -> pan -> master.in` and sends to a shared reverb (generated impulse) and feedback delay; `master.in -> compressor (limiter) -> analyser -> the sound engine's master gain`. Automation is evaluated every 50 ms at the mix time and pushed with short smoothing.
- **sound** strips: `engine.start(id, sound)`; the engine router (key `mix`) sends that voice to the strip.
- **audio** strips (V202, a deck): one native looping `AudioBufferSourceNode` per strip; see section 7. (V201 scheduled copies with `AudioAssets.playClip`; that could not change loop points or speed live.)
- **song** strips: `SongPlayer.play(id)` with `SongPlayer.setOutput` sending the song's whole output into the strip. One song at a time.

## 4. Routing (the prerequisite that was missing)

`SoundEngine.setRouter(fn, key)` lets an owner (the song player under key `song`, the mix under key `mix`) say "voice `id` goes to this bus input"; the first owner that answers wins; a failing or foreign-context answer falls back to the master. The song player now builds buses for **pattern lanes** too, so lane pan, filter, sends and volume (even above the pattern's level) act on the real sound. Default voice cap 8 -> 16, and a song that needs more raises it while it plays.

## 5. Not built (candidates; V202 built the first three marked done)

- Two **decks A / B** with jog wheels inside the mix (reuse `systems/OmniDJDecks.js`). Partly done in V202: each audio strip is a deck; no jog wheels yet.
- **Time-stretch** so tempo sync keeps the pitch. DONE in V202 (WSOLA, `utils/OmniTimeStretch.js`; first version).
- **Cue points, loop in / out**, beat grid. DONE in V202.
- **Pattern (music node) strips** and **live input**.
- **Automation lane editor** (move points by hand); **export** the mix as WAV.
- Several songs at once (needs the song player reworked).

## 6. Open questions

1. Is a crossfader with A / Through / B enough, or should the mix have decks as first-class objects?
2. Should the mix node be placeable inside other nodes (a mix per reality), and should a reality's visitors be able to move the crossfader (a shared performance)? That needs the permissions layer (Contexts 2-3).
3. Export: audio file, or a "set" JSON that replays the sources (rights: keep it to music the owner owns).

## 7. Decks (V202)

An **audio strip is a deck**. Fields (clip seconds): `cue`, `hot[4]`, `loopIn / loopOut / loopOn`, `beat1` (first beat), `pitch` (-1..1 = +-8 %), `keyLock`; `bpm` is the clip's own tempo. Pure maths: `utils/OmniDeckMath.js`.

- **One source per deck.** A native looping `AudioBufferSourceNode` (loop, loopStart, loopEnd, playbackRate). Rate = tempo sync x pitch; all of them change live on the running source. Playhead = `{ p, t, rate, region }` checkpointed on every change; `advance()` wraps it inside the loop. A cue jump or a mode change starts a new source at a clip position (4 ms fade).
- **Key lock.** `rate` != 1 and `keyLock`: a WSOLA-stretched copy (`utils/OmniTimeStretch.js`, 75 % overlap, similarity search on a down-sampled mono mix, shared frame positions for stereo) is made in slices after the rate has held still for 0.35 s, and swapped in at the same clip position; the residual playbackRate (wanted rate / stretch rate) absorbs small fader moves, and a move over 1.2 % triggers a new stretch. Until the stretch is ready the deck plays at the right tempo with a pitch shift. One stretched copy per deck; clips over 600 s are not stretched.
- **Why not a phase vocoder or an AudioWorklet?** WSOLA is small, pure (testable in Node) and good for 0.75..1.5 on tonal material. Its weakness is drum hits (softened up to about 6 dB above rate 1.1). A transient-aware method or a worklet is the upgrade if the owner finds it lacking (ask `v202-keylock-quality`).
- **Controls.** `SERVICES.mix.deck(nodeId, stripId, action, arg)`; the engine has `getDeck`, `jump`, `pauseDeck`, `resumeDeck`.
- **Still open.** Export as audio (OfflineAudioContext render of the same graph), pattern strips, an automation lane editor, jog wheels, saved loop lists, deck-to-deck beat sync (beyond "-> mix").
