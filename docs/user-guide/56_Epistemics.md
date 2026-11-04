# Epistemics: how a thing gets passed down

An **Epistemics node** is one step in the life of a piece of information. It never says what is true. It shows how the thing was made, what was kept, what was lost, and what pushes on it.

## One node, ten layers
A node has a **layer**. Pick it in the Inspector.

| Layer | Shape | Meaning |
|---|---|---|
| Event | sphere | Something that happened. The root. |
| Observation | sphere | One person or sensor seeing it. |
| Memory | sphere | An observation after time has worked on it. |
| Rumour | sphere | Passed on without checking. |
| Gossip | sphere | Told person to person, with colour added. |
| Narrative | cube | A story a group tells itself. |
| Meta view | cube | A view about the other views. |
| Documentary | cube | A record meant to last. |
| Absence | hollow wire | Something that should exist and does not. |
| What-if | ghost sphere | How it could have gone. |

Spheres are things alike in kind. Cubes are containers with a limited number of faces. The shape follows the layer, so changing the layer changes the shape.

## How a node looks
- **Solid or faint** = how well-grounded it is (certainty). It is worked out from the layer's own evidence, or from a linked claim. You never type it in.
- **Bigger** = carries more information.
- **Glowing** = emotionally charged.

## Make the next layer
Select a node and press **Epistemics** in the Ribbon (Create > Nodes), or use "Make the next layer" in its tooltip menu. You get a lossy copy: words drop out, attributes shift. A line joins the two and says how: **Derives**, **Distorts** or **Spreads to**. The source node is never changed. The same `seed` gives the same copy.

## Trace a claim
Select a Claim node and press **Epistemics** (or "Trace this claim" in its tooltip menu). It lays out the event, one observation per testimony (a disagreeing witness gets a Conflicts line), absences from what is unknown, and a what-if for each open branch.

Link any epistemics node to a claim (Inspector > Linked claim) and its certainty comes from that claim's testimonies.

## The Bridge Rumor example
`Omni Epistemics example bridge` builds a bridge closure that three people see, memory blurs, and a rumour turns into "it collapsed". It becomes gossip, then a local story, while the news record says otherwise. A missing inspection report and an earlier announcement sit beside it. Building it twice adds nothing.

## Commands
`Omni Epistemics create | set | derive | trace | example | report | list | layers`

Examples:
- `Omni Epistemics create layer(rumor) text(The bridge collapsed) id(r1)`
- `Omni Epistemics set id(r1) attr(propagation) value(0.9)`
- `Omni Epistemics derive id(r1) to(gossip) seed(7)`
- `Omni Epistemics report id(r1)`

## Not yet
Running the model forward (play, step, light travelling along lines), fields as spheres and containers as cubes around groups of nodes, and the tunnel lens come in later builds.
