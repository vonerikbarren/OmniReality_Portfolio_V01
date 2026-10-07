# Ribbon and OmniNotify design (V169, Inspector strip V170)

## Layout offset
`utils/OmniLayout.js` owns the vertical stack and writes CSS vars on `:root`:
`--omni-bar-h` (48), `--omni-ribbon-h` (97 docked / 29 collapsed / 37 phone),
`--omni-top-offset` (bar + ribbon), `--omni-hands-banner-h` (90 when shown, else 0),
`--omni-top-stack` (offset + banner), `--omni-ribbon-left`. `omni:layout-changed` fires on change.
Consumers use `var(--omni-top-offset, 48px)` or `var(--omni-top-stack, 138px)`; JS code uses `getTopOffset()` / `getTopStack()`.
Changed consumers and the intentionally left ones are listed in the V169 BuildLog entry.

## Ribbon (`ui/OmniRibbon.js`)
A TABS table of `b(id, icon, label, key, desc, run, extra)` groups. Tabs: Home, Inspector, Realities, Hands. Buttons only dispatch existing events
(`omni:nav-select`, `omni:system-toggle`, `omni:pad-toggle`, `omni:pads-global`, `omni:osh-toggle`, `omni:translator-toggle`, `omni:paneltray-toggle`,
`omni:terminal-invoke`, `omni:dimension-axes-visible-set`, `omni:domaingrid-toggle-visible`, `omni:userspace-toggle-visible`, `omni:force-save`)
plus two listeners added in main.js. Inspector section buttons use `omni:inspector-state` (dim/lit/pressed) and `omni:inspector-section-open {section, toggle:true}` (V170; V169 sent no `toggle` and only opened). The section list (id, label, glyph, desc) lives in `utils/OmniInspectorSections.js` and is shared with the Inspector's own strip.
State persisted in `omni:ribbon-v1` (tab, collapsed). Phone or collapsed: body is an absolute overlay.

## OmniNotify
`utils/OmniNotifyHub.js`: capture listeners on document for `data-omni-tip`, `-key`, `-desc`, `-source`; 120 ms intent, 1.2 s revert, focus, touch long-press (450 ms, held 2.5 s).
`setInfo`, `clearInfo`, `pushNote`, `subscribe`; event `omni:notify-info`; existing `omni:notify-push` becomes a note line.
`ui/OmniNotifyBox.js`: modes `side` (next to the ribbon, x = Current State column), `under` (narrow / phone), `float` (after drag). Persisted in `omni:notify-box-v1`.
It extends the old Notify column: the feed, `omni:notify-panel-toggle` and the address bar still work.

## Hands banner
`utils/OmniHandBanner.js` toggles `html.omni-hands-banner-off` (display none, pointer-events none). Default shown on desktop, hidden at <=700px, stored in `omni:hands-banner-v1`.
UI: one pinned dock icon (Dock.addPinned) and a row in OmniHandsPanel. Hand cells keep working programmatically; pads and tunnels are not touched.

## Inspector strip (V170, `systems/OmniInspector.js`)
- Under the panel header: one icon per section from `utils/OmniInspectorSections.js` (same list the ribbon's Inspector tab renders), each with `data-omni-tip` (name, description). Dim = no node, or Location on a non-location node; lit = open.
- `activateSection(id)` is the only entry point for strip taps and the ribbon event `omni:inspector-section-open {toggle:true}`; the in-panel section headers call the same `_toggleSection`. `openSection(id)` (event without `toggle`) only opens.
- Phone (`width <= PHONE_MAX` 700): one section open at a time; tapping the open section closes it; first select opens none. Desktop: independent sections, defaults Identity / Location / Appearance. State in `localStorage 'omni:inspector-open-v1'` = `{d: {id: bool}, m: id|null}`.
- Height: `height:auto`, `max-height` = `var(--oi-cap-h)` (free height under the panel's real top, written by `_updateCap`) and on phones `min(45vh, cap)`. No section open -> `data-collapsed="true"` hides body, preview and footer. Maximized panels keep a 90vh ceiling. The resize handle sets `max-height`.
- Placement: phones dock the panel at left 0 / top `--omni-top-offset` on open; any screen clamps it inside the viewport. Footprint changes do not dispatch `omni:layout-changed` (no listener cares).

## UI.init (V170)
`base.addModule(module)` calls `module.init()`; never call `init()` by hand before it. `UI.init` is guarded against re-entry; the ribbon and notify box keep their own `_dup` guards as defence only.

## Known limits
See DeveloperQueue items 54 and 55.
