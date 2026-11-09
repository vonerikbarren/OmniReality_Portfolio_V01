# Source node (V281)

A SourceNode is where a claim came from, kept ONCE so many claims can cite it. An Epistemics node keeps its short source label (so it is whole on its own) and may also point at a source node; the pointer is drawn as a **Cites** line (claim to source).

## Make one
- Select an Epistemics node, then Nodes ribbon / N picker: **Source node**. It lifts the node's source label and the address in its note into a source, or reuses a matching one, and links it.
- In the Epistemics inspector: **Make source node** (and **Unlink source**). Page / part and Quote are kept on the claim, because the same report is cited at different pages.
- Terminal: `Omni Source create title(...) url(https://...) kind(report) trust(0.8) proximity(primary)`, `Omni Source cite claim(id) source(id) page(12)`.

## What a source holds
title, kind (report, news, filing, dataset, interview, archive, social, other), publisher, author, address (https only), published and checked dates, trust (0 to 1, set by you) and why, closeness (primary, secondary, tertiary), status (live, moved, dead, retracted, paywalled), archive address, note.

- **Counts for:** a dead or retracted source counts for little, a third-hand one for less, a primary one a little more. A claim's support is derived from the sources it cites (weakest or best).
- **Never fetched:** the node stores the address; the Open button opens it in a new tab.

## Upkeep
`Omni Source status`, `Omni Source recheck`, `Omni Source report` (dead, retracted or old sources and the claims resting on them; claims that cite no source node), `Omni Source merge` (folds duplicates into one).

## The MBTA course
The course now has 21 shared source nodes; each of its 30 sourced claims cites one. The trust numbers are a first rating by the course author, each with a reason; change them in the node.
