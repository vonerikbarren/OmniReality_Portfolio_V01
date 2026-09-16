# OmniTargeting

Built: `modules/OmniTargeting.js`, `ui/OmniTargetingSettingsPanel.js`.
Z-Targeting, from Zelda — a real reticle, not a generic highlight.
Its own OmniProduct, with its own subpanel structure — this is the
first subpanel (direct settings); more are expected later.

## Real, working, not a mock

Deliberately built on the existing, already-working selection
mechanism (`omni:node-selected`) rather than a second, parallel
targeting system — targeting *is* "what the reticle looks like around
the current selection." Four markers orbit the target, each one's own
apex pointed inward toward the target's center — the actual Z-target
reticle shape, confirmed directly (a marker's own "up" axis points
back toward center, not outward). Follows the target's live position
every frame and rotates slowly, reading as "actively locked on."

## targetRadiusGeometry — full customization, matching OmniDraw's own pattern

Marker shape, color/alpha, and texture (via the same proven
`WallpaperStorage` pattern already used by OmniBrowserSpace and
OmniFloor) are all independently configurable, deliberately built to
feel close to OmniDraw's own inspector rather than a stripped-down
variant. Default shape is Tetrahedron, per the original request.

Not yet included: the full per-shape geometry parameter system
(ring/tube ratios, segment counts, etc.) — that's still the separate,
cross-cutting item already tracked in the developer queue, not
duplicated here. OmniTargeting uses today's simpler shape-picker; it
becomes a real candidate to receive the fuller parameter system once
that's actually built, same as every other inspector.

## The tooltip — a real CSS2D-style label, not Three.js's own add-on

A genuine screen-projected HTML element, positioned each frame by
projecting the target's real 3D position through the camera. Shows
the targeted object's label — a quick identifier, not a full
Inspector.

## Status

Built and verified directly, 14 checks: correct default state,
correct visibility toggling on real selection/deselection, the
markers' actual inward-pointing orientation confirmed geometrically
(not just assumed from the code), geometry swapping correctly
rebuilding without leaking old markers, color/alpha/texture all
applying, and the real settings panel confirmed reaching the real
module.
