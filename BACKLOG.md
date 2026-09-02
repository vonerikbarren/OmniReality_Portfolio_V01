# ⟐mniReality — Backlog

Larger features flagged during the event-activation pass (not built yet —
tracked here so they aren't lost).

## OmniKeyboard — full design doc, not built yet

A Dock-toggleable virtual keyboard, with a dimensional/cube-key mode
via its own Inspector (each key becomes a cube with up to 6 usable
faces, rotating the whole keyboard swaps layers, faces can hold
multi-character macro strings). Full spec, open questions, and
architecture notes are in `OMNIKEYBOARD_DESIGN.md` — kept as its own
file rather than folded in here given the size and detail.

Also noted there: the hand radial menus' planned "page 3" should be a
*launcher* for this same keyboard, not a second implementation — and
page 1 (search + a Metroid-Prime-style scan function) is a related but
separate feature to scope on its own later.

## MiniMap → real 3D wireframe map

Replace the current 2D DOM minimap with a proper 3D map, in the style of
Metroid Prime's map room: rooms/spaces rendered as translucent wireframe
geometry matching their actual in-world shapes, revealed as the player
visits them (matches `omni:space-changed` traversal data already flowing
through `NodeManager`).

**Do not build ahead of this** — noted as intended to merge with a
separate concept the user is bringing in from a legacy project. Confirm
scope before starting.

## Pocket cube system — full spec

`systems/PocketCubes.js` currently only proves the pipeline (extract →
empty cube appears → click toggles a continuous blink). The actual
target feature, ACNH-inspired:

- Pockets are empty-cube containers ("folders") that will hold the
  realities being built in this project.
- A UI mode to **connect cubes into a grid** — adjacent cubes snap
  together into a lattice layout.
- A second mode to arrange cubes in a **radial/segment layout** around a
  center point instead of a grid.
- **Cube size** needs to be adjustable.
- All of the above (layout mode, size) should be controllable either
  from `OmniInspector` when a pocket/cube node is selected, or from a
  small contextual menu on the cube itself — undecided which, possibly
  both.

## Object Panel — deferred subsystems

`ui/ObjectPanel.js` (the ⟐Objects container-authoring panel, top-left
⟐mniHand drawer) has the full property schema built and every field is
editable/stored, but several groups are schema-only — real subsystems
needed before they do anything visible:

- **Particles** (`ID_Particles`, `ID_ParticleWind`, `ID_ParticleShape`,
  image→particle tie) — needs an actual particle emitter system.
- **Video / image embedding onto the sphere** — needs a texture-loading
  pipeline (`THREE.VideoTexture` / `THREE.TextureLoader`) wired to the
  container mesh's material map. Mutual-exclusivity rule (video on ⇒
  image off) is already enforced at the data level.
- **Automatic axis / rotation systems** (`autoAxisX/Y/Z`,
  `autoRotation`, `rotationAxis`, `rotationToObject`,
  `rotationToOriginCoordinates`) — needs per-frame update logic once a
  container mesh actually lives in the main scene (the panel currently
  only drives its own small embedded preview, not a real scene object).
- **External/internal cycle rotation** (`externalCycleRotationSpeed`,
  `internalCycleRotationSpeed`) — depends on the torus/orbit-ring cycle
  meshes existing first (see `ID_CycleOrbitSize`, `ID_NumOfExternalCycles`
  / `ID_NumOfInternalCycles` — currently just stored numbers, no torus
  geometry is actually generated yet).
- **"Enter" mode** — stub tab in the panel; intended to let the user
  navigate into a container as its own space. Needs real NodeManager
  integration.
- **Cube↔sphere "Domain Expansion" morph** is currently a squash-swap-
  restore approximation, not true vertex-interpolated morphing (that
  needs matching-topology morph targets authored for each geometry
  pair). Fine for now, worth upgrading if more shapes get added to the
  morph set later.

## Texture/media pipeline — three places still deferred

`WallpaperSphere`'s image support is now real (`THREE.TextureLoader`,
defaults to `assets/images/wallpaper-default.jpg`, overridable via
Admin's file-browse upload). The other three are still deferred, for
the same reason as before — real shared infrastructure, not four
one-off implementations:

- `ObjectPanel`'s Media section (video/image mesh toggles + URL)
- `OmniInspector`'s Domain section (Space Img field)
- `WallpaperSphere`'s **video** upload specifically (image works; video
  playback as a texture is a separate, bigger piece — `THREE.VideoTexture`
  needs an actual `<video>` element driving it, not just a loaded file)
- `UserSpaceSphere`'s Admin-configured texture URL

## Event-test indicators — replace when real features land

`systems/EventTestIndicators.js` is deliberately throwaway scaffolding:
two colored spheres that pulse/blink to confirm `grid-select`,
`tool-select`/`tool-deselect`, `page-select`, and the pocket-panel
detached/restore-handler events are actually wired. None of it is real
feature behavior — replace piece by piece as each underlying feature
(GridPanel's actual purpose, RadialMenu tool behavior, etc.) gets
designed for real.
