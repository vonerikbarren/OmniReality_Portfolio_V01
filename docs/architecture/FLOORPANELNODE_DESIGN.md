# floorPanelNode and FloorNodeMakerSettings (V191)

Status: implemented in V191, verified with jsdom tests and a software-GL Chromium smoke test. Real GPU, phone, touch, real video/GIF playback not verified.

## Purpose
Flat floor tiles laid on the floor grid to make custom paths. One cell = one panel. A piece (Tetris I O T S Z J L plus single, domino, two triominoes) is placed as ONE node; panels can be removed one by one.

## Geometry
`utils/OmniFloorPieces.js` (pure): cell tables, rotation in 90 degree steps, mirror (mirror first, then rotate), snapping (`floor(v/size)`), collisions. `utils/OmniExtraKinds.js` builds one merged BufferGeometry per section (24 vertices per panel, one draw call) at `y = FLOOR_LEVEL + 0.02 + thickness/2` (floor y -0.08). Floor unit 20 = `TILE_SIZE/TILE_DIVISIONS`, exported from `modules/OmniFloor.js` as `FLOOR_CELL`. Node data: `nodeKind 'floorPanel', pieceId, rot, mirror, gx, gz, ox, oz, cells[{x,z,media}], cellSize, thickness, panelOpacity`.

## Media
`utils/FloorPanelMedia.js`: validation (png/jpg/webp <= 2 MB, gif <= 4 MB, mp4/webm <= 8 MB; https URLs only, no credentials, <= 500 chars) and storage in a NEW IndexedDB database `omni-wallpapers-floorpanel-media` (60 integer slots, namespace listed in `KNOWN_NAMESPACES` so Admin export/import carries it). `systems/OmniFloorPanelMedia.js`: lazy load (only when a panel is near and in view), refcounted texture per distinct reference, image = Texture, GIF = hidden `<img>` drawn to a <= 256 px canvas at <= 12 fps (CanvasTexture; ImageDecoder is not used), video = muted looping playsInline `<video>` as VideoTexture. At most 4 animated faces play (nearest visible), others pause; unload after 15 s unseen; hidden tab pauses all; release/destroy pauses, detaches, revokes object URLs and disposes textures. Faces are non-pickable child planes.

## Runtime and UI
`systems/OmniFloorPanels.js`: place, stamp blueprint, arm pointer placing (capture-phase click, ghost footprint, grid overlay), transform, snap, remove panel, media attach, cap `maxPanels` (default 400, hard 1000). `ui/OmniExtraKindInspector.js`: Inspector floor block. `ui/FloorNodeMakerSettingsPanel.js` + `utils/FloorNodeMakerSettings.js` (settings key `omni:floornodemaker:settings`, blueprint key `omni:floornodemaker:blueprint:v1`, validation + migration): the 2D blueprint grid (6..24, default 12), Piece and Face tools, Place in scene / at cell / with pointer, media library. Class A window; Admin special slot 20; ribbon Home > Create > Floor panels.

## Decisions
Section = one OmniNode (so the ordinary raycast selects it). Panels have no per-cell colour. URL media needs CORS. A dragged section is re-snapped only by the Snap button.
