# Multi-tool workflow — real notes, not a build doc

A real capability discussion, worth keeping on record rather than
letting it scroll past, since it's context for how this project's
own tooling is actually being split going forward.

## Claude's own real, honest capability boundary

Not equivalent to Blender. Everything built in this project is
procedural — real JavaScript constructing THREE.Geometry (combining
primitives, extruding profiles, custom BufferGeometry math). That's
genuine mesh construction, but it's code-driven, not interactive:
no viewport, no brush-based sculpting, no push/pull vertex feedback
loop the way an artist works in Blender's sculpt mode or ZBrush.
Can build objects from meshes procedurally; cannot sculpt organic
shapes by hand.

## Magnific — checked directly, not from memory

Started as an AI image upscaler, but has since grown into a broader
platform. It now has a real "3D Scenes" feature — explicitly built
for people who've never opened Blender and don't plan to. It's scene
*composition*, not sculpting: place objects (its own library or
imported GLB files) in a spatially consistent environment, direct a
camera, shoot. Closer in spirit to OmniRealityGridSelector's own
staging role than to a modeling tool — aimed at product photography,
not organic mesh creation.

## The real gap for both

Neither Claude nor Magnific does true organic sculpting. If genuinely
sculpted, non-procedural geometry is ever needed, that's real work
for Blender itself or a dedicated AI mesh-generation tool that
outputs an OBJ/GLB to import here.

## The broader real plan

Claude paired with a real 3D/modeling tool for mesh work; Gemini and
Copilot paired elsewhere. Each tool used for what it's actually
good at, rather than one tool forced to cover everything.
