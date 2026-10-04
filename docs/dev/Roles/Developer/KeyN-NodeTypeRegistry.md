# KeyN — Node Type Registry

**Purpose**: the user's own running registry of every real node/geometry
type that exists in the project — "a way for me to keep track of all node
types" (direct request, OmniPointing/OmniStemming build). The name "KeyN"
refers to the `n` keyboard shortcut that opens OmniNode's own placement UI
(see `ui/OmniKeyboardShortcutsPanel.js`'s SHORTCUTS list), since every type
below is ultimately placed through that same system, `systems/OmniNode.js`.

**Convention**: any future new node type — a new entry in
`systems/OmniNode.js`'s `GEOMETRY_DEFS`/`GEO_LABELS`, or a new flagged
node-type like `locationNode` below — gets appended to this file too, in
the same table, with a one-line description. Don't delete old rows even if
a type falls out of use; note that in the description instead.

Source of truth for the "native geometry" rows: `systems/OmniNode.js`'s own
`GEOMETRY_DEFS` object (factory functions) and `GEO_LABELS` (display
names) — both real, currently in the codebase as of this entry
(2026-10-04).

## Native Three.js geometry types (`GEOMETRY_DEFS` / `GEO_LABELS`)

| Type key | Display label | One-line description |
|---|---|---|
| `BoxGeometry` | Box | A plain cube/box primitive — the default general-purpose node shape. |
| `SphereGeometry` | Sphere | A sphere primitive. Also the base shape OmniPointing's `locationNode` (below) uses, at a much smaller scale. |
| `CylinderGeometry` | Cylinder | A cylinder primitive. |
| `ConeGeometry` | Cone | A cone primitive. |
| `TorusGeometry` | Torus | A ring/donut primitive. |
| `TorusKnotGeometry` | TorusKnot | A knotted-torus primitive. |
| `OctahedronGeometry` | Octahedron | An 8-faced primitive. |
| `TetrahedronGeometry` | Tetrahedron | A 4-faced primitive. |
| `IcosahedronGeometry` | Icosahedron | A 20-faced primitive. |
| `DodecahedronGeometry` | Dodecahedron | A 12-faced primitive. |
| `PlaneGeometry` | Plane | A flat plane primitive. |
| `CircleGeometry` | Circle | A flat circle primitive. |
| `RingGeometry` | Ring | A flat, open ring primitive. |
| `CapsuleGeometry` | Capsule | A capsule (pill-shaped) primitive. |
| `LatheGeometry` | Lathe | A profile-revolved primitive (vase-like silhouette). |
| `TubeGeometry` | Tube | A curve-following tube primitive. |
| `ExtrudeGeometry` | Extrude | A 2D shape extruded into 3D depth. |
| `ShapeGeometry` | Shape | A flat, filled 2D shape. |
| `EdgesGeometry` | Edges | Wireframe edges of a box, rendered as `LineSegments` rather than a solid `Mesh`. |
| `WireframeGeometry` | Wireframe | Full wireframe of an icosahedron, rendered as `LineSegments` rather than a solid `Mesh`. |
| `EssenceData` | Essence Data | A claim-bearing node (truth/subjective/false primitive classification) with evidence-stud and halo visuals — not just a shape. |

## Flagged node types (beyond raw geometry)

These aren't a separate `geometry` value — they're built on top of one of
the native types above, distinguished by an extra real field on the
node's own data (checked directly in `systems/OmniNode.js` /
`systems/OmniInspector.js`), with their own dedicated handling.

| Flag | Built on | One-line description |
|---|---|---|
| `isDomain` | any | Marks a node as an enterable "space" — camera can move inside it; gets double-sided material. |
| `isSequenceNode` | any | Part of a sequence/path chain (OmniPresenter); starts wireframe by default. |
| `isEssenceNode` | `EssenceData` | Drives the evidence-stud/halo visual rebuild (`_rebuildEssenceVisual`). |
| `isLocationNode` | `SphereGeometry` | **New in this build (2026-10-04).** OmniPointing's "Highlight and Edit" action (`systems/OmniPointing.js`) — a small yellow orb (scale `0.22`) dropped at a snapped grid coordinate, carrying its own small sonar-ping ring effect (not persisted geometry — a runtime child effect re-attached on both creation and page-reload restore) and a real `pointingCoordinate: {x,y,z}` field. Inspector shows a dedicated "Location (OmniPointing)" section (`systems/OmniInspector.js`'s `_locationHTML`/`_wireLocation`) summarizing its title/color/coordinate. |

## Honest note on this entry

No node type named "sonar" or anything resembling a persistent "0,0,0
origin marker" object existed anywhere in this codebase before this build
(confirmed by grep — zero matches for "sonar"/"Sonar" project-wide). The
`isLocationNode` sonar-ping effect above is an original effect built to
match the user's description, not a scaled-down copy of a pre-existing
one. See `docs/dev/Roles/Developer/BuildLog.md`'s entry for this date for
the full write-up.
