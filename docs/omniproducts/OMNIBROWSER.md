# OmniBrowser

## Default embed content — a Three.js project, same-origin

`OmniBrowserProperties`'s home URL currently points to an external
site (`https://example.com`), subject to whatever framing policy that
site happens to have. It doesn't have to point externally at all — an
iframe's `src` can point to a local HTML file served alongside the
rest of this app.

This matters concretely: **same-origin local content isn't subject to
the X-Frame-Options/CSP framing restriction at all** — that
restriction exists specifically for one site embedding *another*
site's content; it doesn't apply to embedding your own. A small
standalone HTML file with its own Three.js scene (its own
`<script type="importmap">`, same CDN-import pattern the main app
already uses) as the default homepage would load instantly and
reliably every time, regardless of what happens with external sites.

For a portfolio specifically, this is a genuine strategic move, not
just a placeholder: your own work becomes the one thing in OmniBrowser
guaranteed to always work, while external sites remain a
site-by-site "some will, some won't" situation that can't be fully
controlled from this side anyway.

**Not yet built.** The default embed still points at `example.com`.

## Building an actual browser — the real path

Writing a browser *engine* (the thing that parses HTML/CSS/JS into
pixels) is not a "not yet" project - Chromium, Gecko, and WebKit each
represent decades of work from thousands of engineers. Nobody builds
that from scratch as an individual project, and that's not a
discouragement, it's just an accurate scale comparison.

The real path every actual alternative browser uses: **wrap an
existing engine instead of writing one.** Brave, Arc, Vivaldi, Edge -
none of them wrote their own rendering engine; all of them are
Chromium with their own UI and features layered on top. The tool that
makes this achievable for a project like this one: **Electron** (or
the lighter **Tauri**) - lets a desktop app embed a real, full
Chromium engine (via a `<webview>` tag or `BrowserView`) inside its
own window, with custom UI wrapped around it.

The part that directly matters for OmniBrowser's iframe limitation:
**an Electron `webview` is not a same-page iframe - it's a separate,
isolated browsing context, closer to a real browser tab than a DOM
element.** X-Frame-Options/CSP framing restrictions specifically
govern content embedded *within* another page's security boundary. A
webview doesn't sit inside that boundary the same way, so many sites
that refuse iframing load normally in a webview. Not a loophole - the
same legitimate mechanism real Chromium-based browsers rely on.

Honest tradeoff: this is a different *kind* of project - a desktop
Electron app, not a page hosted on GitHub Pages or any static host.
Connects to `BACKEND_ARCHITECTURE_DESIGN.md`'s own theme: once in
Electron territory, this has already stopped being "just a website,"
which fits the direction things have been heading anyway.

**Not started.** No Electron/Tauri scaffold exists. A real, concrete
next step whenever it's time to scope it - not attempted here.

## Phased build plan (agreed order)

1. **Structure/behavior** - auto-open on landing (OmniBrowser + its
   Properties panel sliding in together, not requiring the drawer),
   removing `OmniBrowserProperties` as its own top-level drawer item
   and folding it into `OmniBrowser` as a child slot (same pattern
   Admin already uses for OmniAdminSettings/Particle/Wallpaper
   settings - slot 1 = the browser window itself, slot 2 =
   properties), and supporting up to 3 simultaneous browser windows
   from Properties.
2. **OmniBrowserSpace** - a 3D "room" for the site, using an `OmniDraw`
   object as the enclosing geometry, rather than just a flat panel.
   The browser content exists *within* a space instead of floating as
   a window over it.
3. **OmniBrowserSettingsOptions** - a default-embeds section (presets,
   above the user's own 12 index slots) plus edit/save controls for
   removing entries from the user's own saved index.

## Status

See `NAV_PANELS_DESIGN.md` and the main `OmniBrowser`/
`OmniBrowserProperties` panels for what's already built (single iframe,
own-tracked navigation history, sandbox permission toggles, the
12-slot save-a-URL index). This document covers what's still ahead:
default same-origin embed content, the real-browser path, and the
three-phase plan above.
