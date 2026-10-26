# AccountLoginCryptx — randomPanels, the 8-ring expansion

Nothing in this document is built yet. Raised as a real, direct
expansion of the already-existing `modules/AccountLoginCryptx.js`
(confirmed real and built: a screen-docked cylinder, right side of
the screen — confirmed directly, `DOCK_SIDE_OFFSET` is already a
positive multiple of the camera's own real "right" vector, so no fix
was actually needed there).

## The real concept — confirmed

**randomPanels** — named directly from slot machines. Real, physical
image confirmed: like wearing several watches up one wrist, all the
same type — several ring-shaped bands, stacked along the cylinder's
own length (now sideways, matching the wristwatch orientation),
each one wrapping around the cylinder like a watch band wraps a
wrist. Confirmed count: **8**. Confirmed as flexible in exact form
("doesn't have to be" a literal ring) but rings are the real,
default starting shape.

## Real GPU-cost reasoning, confirmed direction: shader-level

Raised directly, and the real answer is yes — this should be built
shader-level, for the same real reason already established for
OmniRandomizer: CPU-side, per-object updates on 8 separate real
meshes is the expensive, avoidable path; GPU-side math driven by one
small uniform is the cheap, correct one.

Real, concrete approach:

1. **One real `THREE.InstancedMesh`**, 8 instances, sharing one real
   torus (ring) geometry and one real material — a single real draw
   call for all 8 rings, rather than 8 separate mesh objects each
   costing their own draw call and their own per-frame CPU-side
   transform update.
2. **Rotation/interaction computed in a real, custom vertex
   shader** — even with only one ring active at a time (confirmed
   above), all 8 still need to exist and render simultaneously
   (seven inactive, one active), so the same real InstancedMesh
   savings apply: one shared draw call for every ring's own real
   geometry, active or not. A single `uTime` uniform plus a per-
   instance "is this the active ring" flag lets the shader drive
   the active ring's own real motion while the other seven stay
   visually still — still no real per-frame CPU-side transform
   updates on any individual ring.
3. **Quaternions, confirmed as the right call, not Euler angles** —
   raised directly and correctly: composing the rings' own real
   rotation with the cylinder's own parent orientation (especially
   once genuinely sideways) is exactly the real case quaternions
   exist for, avoiding gimbal lock. The per-instance rotation state
   passed to the shader should be quaternion-based, not a raw Euler
   Y-rotation, even though the visual result (a ring spinning around
   its own axis) looks simple on the surface.

## Real, confirmed answers

1. **Selection model, confirmed: one ring at a time, like a watch's
   own main face.** Not eight independently, continuously spinning
   reels. The user selects and interacts with a single active ring;
   the others sit inactive until chosen. Changes the earlier framing
   directly — this isn't eight simultaneous slot-machine reels, it's
   a real, sequential, one-at-a-time interaction, closer in spirit
   to OmniCryptx's own existing drill-down rings than to a slot
   machine's simultaneous spin.
2. **Each ring carries its own real, distinct symbol class,
   confirmed as a real sequence:** Ring 1 — the user's own alphabet;
   Ring 2 — dimension; Ring 3 — location; further rings following
   the same real pattern; a later ring — a typed password. This is
   a direct, real extension of OmniCryptx's own existing type system
   (`data/OmniCryptxTypes.js`'s own TYPE_COLORS/TYPE_WIDGET maps
   already define per-type symbol classes — Symbol, Time, Letter,
   Number, State, 'typed password' among them) — the eight rings are
   a real, ordered sequence through classes of that same kind, not
   a new, parallel classification system.
3. **Color scope, confirmed and simplified:** not a bespoke Login-
   only override, and not a global rewrite of the shared
   `TYPE_COLORS` map either — just match the application's own,
   existing theme. Real, direct connection worth acting on: this
   project already has a real theme system (`utils/OmniThemes.js`
   — black-metallic / white-glowy-metallic / grey-metallic),
   confirmed to exist from earlier this session. The real, right
   move is pulling the ring styling from that same, already-built
   system rather than inventing new color logic for Login
   specifically.

## Status

All three real open questions now have real, confirmed answers
(above). Reasoned shader/instancing approach proposed and grounded
in the same principles already proven for OmniRandomizer. Genuinely
buildable work now, not blocked on further design decisions —
next real step is implementation.
