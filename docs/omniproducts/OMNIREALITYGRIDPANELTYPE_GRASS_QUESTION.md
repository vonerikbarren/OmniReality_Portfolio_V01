# OmniRealityGridPanelType() — shader-grown grass on selected cells

Raised as a real question, not a build request: "if we can use
shaders is it possible to make grass from a select amount of Grid
that the user selects?"

Real, direct answer: yes, and it's a genuinely good fit for exactly
the shader-level approach discussed alongside it (see
OMNIACCOUNTLOGINCRYPTX_RANDOMPANELS_DESIGN.md) — grass is one of the
textbook real cases for GPU-driven vertex work rather than CPU-side
geometry building.

## Why this is genuinely cheap, built correctly

The naive approach — spawning hundreds of individual real grass-blade
meshes per selected cell, each animated by moving its own real
vertices on the CPU every frame — would be the expensive, wrong path,
the same real distinction already reasoned through for OmniRandomizer
and the login rings. The real, standard technique instead:

1. **One real, shared blade geometry** (a simple, few-vertex plane or
   thin blade shape), instanced across every real position within
   the user's selected cells via `THREE.InstancedMesh` — one real
   draw call for potentially thousands of blades, not thousands of
   draw calls.
2. **A real, custom vertex shader** bends each blade based on a
   `uTime` uniform (for real, continuous wind motion) and a per-
   instance random phase/offset attribute (so blades don't all sway
   in obvious lockstep) — the actual bending math runs on the GPU,
   in parallel, across every blade at once. The CPU only ever
   updates one real, small `uTime` value per frame.
3. **Real placement** — genuinely straightforward given what already
   exists: each selected cell (OmniRealityGridSelector's own real
   `{cx, cz}`) already has a real, known world-space bound
   (`CELL_SIZE = 20`, confirmed directly), so blade instance
   positions are just real, randomized points scattered within that
   same, already-known bound — no new spatial system needed, this
   rides directly on the grid selector's own real data.

## Real, open scope questions — not decided here

- Density per cell (how many real blades per 20-unit cell) is a
  real, direct GPU-cost lever — worth a real, chosen default rather
  than left unbounded.
- Whether grass should be a real, standing "landscaping" choice per
  saved OmniRealityGridSelector context (grown once, persists), or a
  live, toggleable overlay.

## Status

Documented only, per direct request ("this is just a question").
Not built, not yet scheduled.
