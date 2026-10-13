# OmniAudioAssets: the audio library (V198)

Applies to: V198 · Status: built; jsdom (fake IndexedDB) and Chromium checked · Real devices, real ears: not verified.
Contract: `docs/architecture/OMNISONG_CONTRACT.md` ("Audio assets"). Songs: `OMNISONGNODE_DESIGN.md`. User text: `docs/user-guide/18_Audio_Library.md`.

## What it is

A small store of imported sound files: `utils/OmniAudioAssets.js` (no DOM, no UI), the window `ui/OmniAudioLibraryPanel.js` and the chooser `ui/OmniAudioPicker.js`. A song node stores only an asset **id** (`clip.ref = {type:'audio', id}`); the bytes live in IndexedDB.

## Files

| File | Role |
|---|---|
| `utils/OmniAudioAssets.js` | the store (`AudioAssets`, `createAudioAssets(opts)`), pure helpers `computePeaks`, `peaksFromBuffer`, `sanitizeName`, `uniqueName`, `sniffBytes`, `wavInfo` |
| `ui/OmniAudioLibraryPanel.js` | class-A window `⟐OmniAudioLibrary` (import button, drag and drop, list, waveform canvas, preview, rename, delete, meter), `countSongUsage`, `setUsageProvider`, `drawWave` |
| `ui/OmniAudioPicker.js` | `openAudioPicker({onPick})` modal chooser; `importFilesNotify`, `fmtDuration`, `fmtBytes`, `fmtDate` |
| `ui/OmniAudioModules.js` | `addAudioModules(base, omniNode?)`: registers the window and the usage provider (main.js, one block) |

## API (binding names from the contract; additions marked +)

```
AudioAssets.importFile(file)   -> {ok:true,id,meta} | {ok:false, error:{code,message}, code, message}     (String(error) === message)
AudioAssets.list()             -> meta[] oldest first        getMeta(id) -> meta|null
AudioAssets.remove(id) / rename(id,name) -> {ok,...} | {ok:false,...}
AudioAssets.usage()            -> {bytes,count,limitBytes,fileLimitBytes,persistent,browserFreeBytes?,reason?}
AudioAssets.getBuffer(ctx,id)  -> AudioBuffer|null (decoded on ctx; LRU 200 MB of decoded audio over all contexts)
AudioAssets.getPeaks(id,n=512) -> Float32Array(2n)|null
AudioAssets.playClip(ctx,id,{when,offset,duration,gain,fadeIn,fadeOut,rate,dest}) -> {stop(at?), done}
+ AudioAssets.preload(ctx, ids) -> {loaded,missing}     AudioAssets.peekBuffer(ctx,id) -> AudioBuffer|null (sync)
+ AudioAssets.persistent (bool)  AudioAssets.ready() -> Promise<bool>
meta = {id,name,duration,sampleRate,channels,bytes,addedAt, +format, +type}
```
Error codes: `unsupported`, `too-large`, `quota`, `decode`, `empty`, `not-a-file`, + `storage` (any other store failure), + `missing` (unknown id on remove / rename). No async function rejects.

### Peaks format (decision)
`getPeaks` returns `Float32Array(2n)` = `[min0, max0, min1, max1, ...]`. `min` is in -1..0, `max` in 0..1, and the whole array is divided by the loudest sample, so the loudest point of the file touches +-1 (silence stays 0). Draw bar `i` from `mid - max*h/2` to `mid - min*h/2`. A file never gets a peak above 1.

### playClip
Returns synchronously. If the buffer was decoded on `ctx` before (`getBuffer` / `preload`), the `AudioBufferSourceNode` is scheduled **inside the call**, so a lookahead scheduler gets sample-accurate starts. Otherwise the buffer is decoded first and the clip is scheduled when it is ready; a `when` that is already in the past by then **skips into the file** (offset advanced by the lateness x rate) instead of starting from the wrong place. `duration` is in source seconds (clamped to what is left after `offset`); fades are in output seconds, squeezed to fit; `rate` 0.1..4; `gain` 0..4. Graph: source -> gain (envelope) -> `dest` (default `ctx.destination`). `stop(at?)` ramps the gain down (4 ms time constant) and stops 30 ms later; `stop()` before the decode finished cancels the schedule. `done` resolves `{ended, reason:'ended'|'stopped'|'missing'|'error'}`; nodes are disconnected afterwards. A song player should call `preload(ctx, ids)` when playback starts.

## Storage

IndexedDB `omni-audio-assets-v1` v1: store `meta` (keyPath id; the public record) and `blobs` (keyPath id; `{id, bytes:ArrayBuffer, type, peaks:Float32Array(1024)}`). The original bytes are kept (not a decoded copy): decoding happens on whichever context asks (decoders resample to the context rate, so `meta.sampleRate` is read from the WAV header when there is one; for other formats it is the rate of the decode context). One transaction writes both stores. Writes are serialised (names, the 300 MB cap). `QuotaExceededError` -> `quota`. If IndexedDB is missing, blocked, errors on open, or fails a write for another reason, a memory store takes over and `persistent` is `false` (`usage().reason` says why). `ArrayBuffer`s are stored instead of `Blob`s on purpose: no blob-handle problems in old Safari or private modes, and the fake IndexedDB used in tests clones them.

## Import pipeline

1. not-a-file (no size) -> empty (0 bytes) -> too-large (> 40 MB) -- before reading.
2. total cap (used + size > 300 MB) -> `quota`.
3. read bytes; sniff the first bytes (`sniffBytes`): known non-audio (PNG, JPEG, GIF, BMP, TIFF, ICO, WebP, HEIC / AVIF, PDF, zip, 7z, gzip, exe, ELF, MIDI, XML / HTML) -> `unsupported` with "looks like an image"; known audio magic only sets the format guess; unknown bytes are **tried**.
4. `navigator.storage.estimate()` (when present): less than 1.1 x size free -> `quota`.
5. decode on a throwaway `OfflineAudioContext(2,1,44100)` (or a temporary `AudioContext`, closed afterwards). The engine's context is never created, resumed or touched. 60 s timeout. Failure -> `decode` with a message naming the guessed format. No Web Audio at all -> `unsupported`.
6. decoded size > 600 MB (`length * channels * 4`) -> `too-large` ("too long").
7. name: file name without folder and extension, control and reserved characters removed, 60 characters, unique among the library (`Name`, `Name (2)` ...).
8. peaks (512) computed once and stored; `omni:audio-assets-changed {action:'add', id}`.

## Library window

The window is built like the other class-A panels (`OmniSettingsPanelBase`, so resize / maximize come from `utils/OmniWindowChrome.js`, and on a phone it is a bottom sheet, 72 vh). While open it listens (window level) for `dragenter` with files and shows a full-screen drop overlay (z-index 89000); it removes the overlay and listeners on close. Preview: its **own** `AudioContext`, created in the click that starts it (user gesture), chain source -> gain 0.8 -> analyser -> destination; it is closed 120 ms after the preview stops (stop button, clip end, window close, another preview, deleting the file). The waveform is a 2D canvas (no WebGL), redrawn with a playhead on `requestAnimationFrame` only while a preview runs. Usage count on rows and in the delete confirm: `countSongUsage(id, nodes)` scans `node.data.song.clips[].ref` defensively; `setUsageProvider(fn)` (set by `addAudioModules` from `omniNode.getAllNodes()`) supplies the nodes.

## Picker

`openAudioPicker({onPick, onClose, title, importLabel, pickAfterImport:true, assets?})` -> `{close, el, refresh, input}`. z-index 90000 modal (WindowManager raises windows from 200 upward, so the picker must sit far above them), bottom sheet on phones, Esc / backdrop / Close close it, one at a time. Import inside it picks the first file that worked.

## Decisions and limits

- Everything is per browser. A song moved to another machine shows missing clips until the files are imported there (ids differ).
- No time stretch, trimming, recording or export of audio (stopping line of the song design).
- Memory: the decoded cache is capped at 200 MB across contexts; one asset can be at most 600 MB decoded.
- `omni:audio-assets-changed` is only dispatched in the tab that changed the library; other tabs see changes after a reload.
