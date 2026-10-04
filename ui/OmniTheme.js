/**
 * ui/OmniTheme.js — centralizes the one hardcoded blue accent literal
 *
 * Context — a full theme system already exists in this app, found
 * while investigating this, and it already works: ui/ThemeManager.js
 * loads data/themes.json ('dark' / 'light' + a saved 'custom' set) and
 * applies it by setting --omni-theme-bg / -border / -header-bg / -text
 * / -text-dim / -text-muted / -accent / -input-bg / -input-border on
 * `document.documentElement`. ~50 panels already read their own local
 * CSS vars as `var(--omni-theme-X, <their own original literal>)`, so
 * they pick up a theme switch automatically. `main.js` already calls
 * `ThemeManager.initTheme()` on startup (applies the saved/'dark'
 * theme) and `ui/AdminPanel.js` already has a working theme picker +
 * custom-color editor. None of that needed building — it's real,
 * already wired, and out of scope to touch here.
 *
 * The actual gap: the specific blue — #7fd8ff / rgba(127, 216, 255, …),
 * which is also 'dark' theme's `accent` in data/themes.json — is ALSO
 * hardcoded directly, as a literal, outside that `--omni-theme-accent`
 * hook, in a dozen-plus files' hover/active-state glows (OmniPanelTray,
 * OmniKeys, OmniDraw, OmniInspector, every Account* panel, and others —
 * see BuildLog.md for the exact list). Those glows don't derive from
 * `--omni-theme-accent` (switching to 'light' there wouldn't touch
 * them — a real, if minor, theme-consistency gap, and out of scope to
 * fully close here since CSS alone can't split a theme's `accent` hex
 * back into R/G/B components for a translucent `rgba(…, 0.16)` wash
 * without something like `color-mix()`). What this file DOES fix: that
 * literal was duplicated identically a dozen-plus times rather than
 * read from one place. `--omni-color-accent-blue` / `-rgb` centralizes
 * it; those files were edited to reference it instead of repeating the
 * hex (see BuildLog.md for the exact list and values).
 *
 * Deliberately NOT touched: the small number of places this exact
 * color is a real non-CSS value — a THREE.Color string (OmniDrawDynamic
 * .js's node-create-request, systems/OmniPlayerGame.js's emotional-state
 * aura) or a data-viz series-color array (OmniCellPanel.js) — none of
 * those are read by a browser's CSS engine, so a `var(...)` reference
 * would not resolve there; they keep the literal hex on purpose.
 *
 * Usage: call `injectOmniTheme()` once, early (ui/index.js's `init()`
 * does this first, before any panel's own `injectStyles()`) — same
 * "check-for-existing-<style>-tag-by-id, else inject" convention every
 * other module in this app already uses for its own styles.
 */

const STYLE_ID = 'omni-theme-root-vars'

const THEME_STYLES = /* css */`
:root {
  --omni-color-accent-blue      : #7fd8ff;
  --omni-color-accent-blue-rgb  : 127, 216, 255;
}
`

/** Inject the shared `:root` theme once. Idempotent, like every other
 *  `injectStyles()` in this app. */
export function injectOmniTheme () {
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style')
  tag.id = STYLE_ID
  tag.textContent = THEME_STYLES
  document.head.insertBefore(tag, document.head.firstChild)
}

export default injectOmniTheme
