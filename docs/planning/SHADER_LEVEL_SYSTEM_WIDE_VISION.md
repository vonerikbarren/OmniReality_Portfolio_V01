# Shader-level rendering — a real, system-wide future direction

Raised as a real, broader vision, not a build request: "I feel like
everything should be made at that shader level in the app."
Confirmed directly as a real, deliberately deferred idea —
explicitly named as a system-wide restructuring, to be tackled
alongside real backend work, not before it, so the two can happen
together rather than one blocking the other.

## The real principle already proven three separate times

Not a new idea invented here — the same real distinction has now
come up and been reasoned through independently for three separate,
real systems in this project:

1. **OmniRandomizer** — constantly-changing geometry/color/material.
   Cheap if geometry-swapping or shader-driven vertex displacement;
   expensive if CPU-side geometry rebuilding every frame.
2. **OmniAccountLoginCryptx's randomPanels** — 8 real rings.
   InstancedMesh plus a vertex shader driven by one `uTime` uniform,
   rather than 8 separate meshes each getting their own real,
   per-frame CPU-side transform update.
3. **OmniRealityGridPanelType's grass question** — shader-bent
   blades via one shared, instanced geometry and a `uTime` uniform,
   rather than CPU-side per-blade vertex animation.

The real, common shape across all three: color/material uniform
changes are already free; the real cost is always geometry/transform
work, and that cost all but disappears once it's pushed onto the GPU
via instancing plus a small number of real, cheap uniforms, instead
of being recomputed and re-uploaded from the CPU every frame.

## Why this is confirmed as a real, later, system-wide pass — not now

Stated directly and correctly: doing this properly, everywhere,
isn't "add a shader here and there" — it's a real, structural shift
in how this project's own animated/mutating objects are built,
which only makes sense to take on as one deliberate pass once the
backend work is also underway, so the two genuinely happen together
rather than the shader work becoming its own, separate, competing
rebuild later. Building real structures now with the CPU-side
pattern where it's simplest, while keeping the shader-level pattern
as the real, proven default for anything genuinely
continuous/animated (as already done for the three cases above), is
the right sequencing — not everything needs to wait on the
restructuring, but new, continuously-animated systems should default
to the shader-level approach already proven, rather than adding a
fourth CPU-side pattern that would just need migrating later too.

## Status

Documented, per direct request. Not scheduled. Real, natural trigger
point: when backend work begins.
