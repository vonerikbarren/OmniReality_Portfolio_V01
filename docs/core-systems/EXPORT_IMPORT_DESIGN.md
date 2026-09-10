# Export / Import

Built and tested — 20 checks, verified end-to-end against real
localStorage data, real IndexedDB assets across multiple namespaces,
and a real generated zip file. Not conceptual.

## What it does

Admin Panel → Data Management → **Export Reality** downloads a single
`.zip` containing everything: every `localStorage` key/value, and
every saved image/audio/video across the whole app - wallpaper
images, browserspace cube textures, mixer audio/video/skin,
OmniExpression's video and backing circle images. **Import Reality**
reverses it: reads the zip, checks compatibility, restores everything,
reloads the page.

## The shape

```
omnireality-export-<timestamp>.zip
├── manifest.json
└── assets/
    ├── sphere/slot-3.png
    ├── omnimixer-audio/slot-1.mpeg
    └── omniexpression-circles/slot-0.png
```

`manifest.json` holds three things: a `schemaVersion` number, the full
`localStorage` dump (every key, swept generically - no hardcoded key
list, so new systems that add their own key are automatically
included later without this code needing to know they exist), and an
`assets` array mapping each namespace/slot to its file path in the
zip.

## Why IndexedDB needed something localStorage didn't

`localStorage` can be swept with a plain loop - no need to know its
keys in advance. IndexedDB has no equally reliable, universal "list
every database" call, so a small, explicit registry exists instead:
`KNOWN_NAMESPACES` in `utils/WallpaperStorage.js`. Currently covers all
7 namespaces in use: `sphere`, `browserspace-cube`, `omnimixer-audio`,
`omnimixer-video`, `omnimixer-skin`, `omniexpression-video`,
`omniexpression-circles`.

**Whoever adds a new `createWallpaperStore(...)` call anywhere in the
app needs to add its namespace to this registry too** - otherwise that
namespace's assets are silently skipped by export/import. This is the
one piece of this system that doesn't maintain itself automatically.

## Version handling

`schemaVersion` is a plain number, bumped only when the manifest's own
shape changes - separate from any visual/feature version number. On
import: a version *newer* than what the current build understands is
rejected outright, with a clear message, before anything is touched -
verified directly that a rejected import leaves existing data
completely untouched. A version equal to or older than current is
imported as-is. There's no migration logic yet for an older schema
that's missing fields a newer build expects; that's the natural next
piece to add once the manifest shape actually changes for the first
time.

## Why JSZip, and why it's not in the importmap like Three/GSAP

Browsers have no built-in "create a zip file" capability. JSZip
(https://stuk.github.io/jszip/) is the standard choice, loaded via
`index.html`'s own script tag - not the importmap, because JSZip's
distributed build is UMD, not an ES module, unlike Three.js and GSAP.
It sets a plain global `window.JSZip` instead.

## What isn't built yet

- No progress bar - the button's own label changes during export
  (`Exporting (namespace)...`, `Zipping...`) as a lightweight
  substitute, but a real multi-megabyte export with lots of
  audio/video would benefit from a proper indicator eventually.
- No migration path for an older schema version on import (see above).
- Not yet scoped to "one reality" - still all-or-nothing against
  every namespace and the whole of `localStorage`. Once something like
  OmniPocket or OmniStorage can hold multiple realities side by side,
  this may need a way to export/import just one.

## Status

Built and verified. First genuinely working piece of the "build a
reality your own way, export it, hand it to someone else" foundation
discussed earlier - the rest (scoping to a single reality, a real
progress UI, schema migration) is expected to grow from here as the
rest of the OS does.
