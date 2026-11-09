# MBTA course (V280)

The first course: Boston's MBTA, from the problems older trains caused to why newer trains were bought.
The whole course lives inside ONE StoredRealityNode, so Expand lays out the entire reality.

## Open it
- Ribbon: Realities tab, MBTA course.
- Or the terminal: `Omni StoredReality example mbta`
- Select the box, then Expand (inspector or `Omni StoredReality expand`).
- Building it twice adds nothing; the existing box is kept.

## What you see when expanded
Four lanes, front to back, each 12 units apart:
- Overview: the question and the short answer
- Red Line, Orange Line, Green Line, Mattapan
Left to right in each lane is problem, then cause, then response. Lines are step, flow or note (never rhythm "drives").

## Honesty
- Every node is an Epistemics node with its layer (event, observation, counterfactual, absence, ...).
- The source is in the node's source field, the URL in its note.
- Cautions are separate nodes: the Red Line replacement predates the 2019 derailment, no Green Line failure figure was found, and the Mattapan trolleys have not been replaced.
- Facts are as reported at the time of writing; check the source before relying on a number.

## Files
data/OmniMbtaCourse.js (content), systems/OmniStoredReality.js (buildExample), tests/38_mbta_course.test.mjs.
