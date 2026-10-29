# The scene file: `.omni.json` (V236)

Save the whole scene as one JSON file and load it back later (or hand it to Claude to read, explain or write).

## Save
- Ribbon: **Realities → Save → Export scene** downloads `<name>-<date>.omni.json`.
- Command: `Omni Scene export name(My reality)` downloads it; `Omni Scene export path(/home/scenes/a)` writes it into the in-browser file system instead.

## Check (nothing changes)
`Omni Scene check path(/home/scenes/a.omni.json)` says what is inside ("12 nodes (3 musicNode, 9 node), 14 edges") and lists anything it would fix or skip.

## Load
- Ribbon: **Import scene** opens the file picker and REPLACES the scene (it asks first).
- `Omni Scene import path(...) confirm` replaces. `Omni Scene import path(...) mode(merge)` adds beside what is there; a node whose id already exists gets a new id, and everything that pointed at it (parent, group lists, song clips) is updated.
- No `path(...)`: the file picker opens.

## What the file holds
```
{ "schema": "omni-scene/1", "app": "OmniStarOS", "version": "...", "name": "...", "exportedAt": "...",
  "counts": {...}, "nodes": [ {node record as the app saves it} ], "edges": [ {"from":"id","to":"id","style":{...}} ] }
```
Every node record is saved in full, so music, sound, song, mix, doc, poly, voxel, note, dimensional, store and value nodes keep their own data.

## Not in the file yet
Hand settings, painter strokes, scene orbs, uploaded media (images, video, audio in this browser), path nodes' recorded paths and terminal shells' side stores. Those come in later versions.

## Safety
Files are never trusted: max 8 MB, 2000 nodes, 6000 edges; bad ids, duplicate ids, broken links, odd numbers and unsafe keys are cleaned or skipped with a warning. A file that is not an Omni scene file, or has no nodes, changes nothing.
