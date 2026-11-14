# MultiVideoNode

Cut several videos together on a timeline and let the node (and the camera) move in step with them.

Make one with the ribbon button (▤) or `Omni MultiVideo create`. Select it, then **Open editor** in the Inspector.

- **Clips**: add from the document library, from a file, or as a placeholder. Each clip has in/out, speed, volume, opacity, fade in/out, a chroma key, and how it comes in (cut, fade, dip, wipe, slide).
- **Key coordinates**: at a time, a position (and optionally where the camera looks), moving the node, the camera or both, with a GSAP ease into the key. "Use camera position" fills in where you are now.
- **Text**: captions in a thin layer in front of the node. Motion keys move it in simple directions (cardinal) or round the node (spherical).
- Click the strip to scrub. Play / Pause / Stop are in the editor, the Inspector and `Omni MultiVideo play id(...)`.

Nothing is rendered to a file: the edit plays live and is saved with the scene. One MultiVideo plays at a time. Stop puts the node back where it started.
