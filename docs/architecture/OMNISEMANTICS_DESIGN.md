# OmniSemantics: meaning shown by change (design, 2026-10-29)

Status: DESIGN ONLY, except the parts marked BUILT. Nothing here changes the app yet. Decisions come from the owner (2026-10-29).

## 1. The idea in one paragraph
Meaning is shown by CHANGE, read on the visual channel that belongs to one axiom, at a given SCALE. A unit of meaning is a cube with one face per axiom. Which face points at you says which axiom you are talking about, which is how the language removes ambiguity. A change on one face (bigger, faster, warmer, closer) is the "verb". A sequence of changes along a lineup of cubes is a sentence you walk through, start to finish.

## 2. Decided names (skeleton and skin)
| Name | Role | Status |
|---|---|---|
| **OmniVoxelNode** (`nodeKind: 'voxelNode'`) | the SKELETON: where it is, its place in the sequence, what is attached to its core, how it moves | BUILT as a small diamond at the centre of a voxel room (V211). To add: sequence index, lineup, attachments, independent motion |
| **OmniSemanticsVoxelNode** | the SKIN: six faces, what each shows, what a click does, what changed | NOT BUILT |
Rule: a skeleton works with a blank skin; a skin can be swapped on the same skeleton ("reskin": student, church, high contrast) without touching the sequence. One skin can be applied to many skeletons.
Existing pieces this reuses: the PolyNode (every face has colour, label, tags, a click event string and content: pattern, text, image, doc, sound; a tap opens a small menu), the voxel rooms and avatar lines, sequence nodes and the Node Order panel, the node behaviours (movement), parent links and groups.

## 3. The six faces are the six axioms (BUILT as data: data/OmniAxiomData.js)
| Face | Axiom | Symbol | Colour (from the data) | Question the face answers |
|---|---|---|---|---|
| 1 | Identity | ◉ | #ff9bd0 | who / what is this |
| 2 | Information | ⓘ | #7ec8ff | what is known, how |
| 3 | Space | ▦ | #8dffb0 | where, how big |
| 4 | Time | ⧖ | #ffd36b | when, how fast |
| 5 | Power | ⚡ | #ff7a5c | what can act |
| 6 | Expression | ❖ | #c79bff | how is it shown |
A face that is blank means "not defined yet" (the alphabet's honest failure). Opposite faces are fixed pairs; the pairing is an open question (section 9).

## 4. Skin data (draft)
```
skin = { nodeKind: 'semanticsVoxelNode', skeletonId, version: 1,
  faces: { identity: Face, information: Face, space: Face, time: Face, power: Face, expression: Face },
  change: { axis, direction: -1|0|1, rate, scale }   // the current "verb"
}
Face = { label, content: { type: 'none'|'icon'|'image'|'video'|'text'|'pattern'|'doc'|'sound', ... }, event, tags }
```
New content types needed beyond the PolyNode: **icon** (a symbol or emoji, cheap) and **video** (costs memory: allow one or two playing at a time; a poster image otherwise).
Skeleton additions: `seq: { index, lineupId }`, `attached: [nodeIds]` (things carried at the core), motion handled by the existing behaviours.

## 5. Change, scale and the visual channels (first draft, to be tested)
| Axiom | Main channel | A change reads as | Redundant cue |
|---|---|---|---|
| Power | size, brightness | bigger / brighter = more power | rim glow |
| Time | rate of motion | faster = more time pressure, slower = more time | trail length |
| Expression | colour and shape | warmer / sharper = stronger expression | pulse |
| Space | distance, position | nearer = closer, further = distant | line to the viewer |
| Information | clarity, density | sharper / denser = more known | texture detail |
| Identity | silhouette | a stable outline = a stable self | outline |
"Scale" has two meanings: (a) the ratio of a voxel to its neighbours or parent (relative weight); (b) the zoom level: zoomed out a lineup reads as one summary, zoomed in as detail. Rules: use few conventions, always code a change with two cues, show a legend, and an undefined symbol fails honestly.

## 6. Sequence and lineup
Start at the first voxel, move to the last. Voxels move independently; each carries what is attached to its core; the lineup is reordered by sequence number and the voxels animate to their new slots. Lineup shapes reuse the page-layout calculators planned for OmniDoc (line, ring, helix, inner sphere, outer sphere). Presentation can walk the lineup as a camera path.

## 7. Sources (lineage), not class names
Classes are named by what they do: Sign, Channel, Change, Relation, Sequence. The thinkers are cited as sources:
- C. S. Peirce: icon, index, symbol (how a sign means).
- Jacques Bertin: the visual variables (size, value, colour, shape, orientation, texture).
- Otto Neurath / Isotype: pictures that ordinary people can read.
- G. Lakoff and M. Johnson: conceptual metaphors (more is bigger, up is better).
- F. Heider and M. Simmel (1944): people read intent into moving shapes.
- P. Gärdenfors: conceptual spaces (meaning as position in a space of qualities).

## 8. Test: do strangers read it?
BUILT (V241): a 10-second demo, `Omni Demo play name(meaning)`: three nodes; Power grows one, Time speeds one, Expression changes the colour of one, Space brings them closer, each with a caption. Test it on five people with the captions OFF (`captions(false)`) and ask what each change meant. Record agreement per axis. Axes under about 70 % agreement need a better channel or a legend.

## 9. Open questions
1. Which faces are opposite (a fixed axis pairing)?
2. Identity has no defined perspectives yet (six numbered placeholders).
3. Does a voxel's "level" mean depth or maturity?
4. Video limits (how many at once, size cap) and phone behaviour.
5. Where does face content come from: by hand, derived, or generated?
6. Does a skin travel inside the `.omni.json` file with its skeleton, or as its own file?
