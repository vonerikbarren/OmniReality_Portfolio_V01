# ClaimNode: DimensionalScripting in the space (V260)

A **ClaimNode** holds one claim that is **true, false and undefined at the same time**, and shows how much of each at a scale you choose. Every testimony says who spoke, so anyone reading can tell people, bots, AI and sensors apart.

## What you see
A core sphere inside a flat **gauge ring** cut into three arcs: **green = true, red = false, yellow = undefined**. The core is tinted with the blend. When nothing is undefined at the chosen scale **and** the claim has at least one **Law**, it is **objective** and the colours become white / black / grey.
A **private** claim that is locked shows a grey ring and a padlock, and nothing else.

## Make one
Ribbon **Create > Time and logic > Claim node**, the **Claim** tile of the node menu, or
`Omni Claim create claim(The cup is half full) id(cup) scale(10) laws(conservation of mass)`
Select it: the Inspector has a **ClaimNode** section.

## How "true, false, undefined" is worked out
The claim lives on an extent from 0 to 1 (a cup's fill level, a stretch of time ...). A **testimony** covers a region of it with a verdict. The **scale** cuts the extent into that many cells. Each cell is judged on its own:
- everyone who covers the whole cell says true → **true**; everyone says false → **false**
- they disagree → undefined (**conflict**); only part of the cell is covered, so a boundary lies inside it → undefined (**mixed**); nobody covers it → undefined (**absence**); only witnesses too coarse to see that finely cover it → undefined (**too coarse**)

The three shares always add up to 1. "Half full" is half undefined at 2 cells (the line falls inside a cell) and fully resolved at 100. A boundary with real thickness stays undefined at every scale.

## Testimonies (who said what)
`Omni Claim testify id(cup) by(ann) kind(human) verdict(true) from(0) to(0.52) saw(water to the line) means(about half)`
kind: human, bot, ai, sensor, animal, other, unknown. **saw** (observation) and **means** (interpretation) are kept apart. `resolution` is the finest detail the witness can see; `source` makes copies of one source count once; `conditions(light=day)` records what it was seen under. The Inspector shows a *Who said what* table and a form.

## Truth levels, theories, history
- **Promote:** testimonies that agree, come from independent sources and were seen under different conditions become *subjective truth* (`Omni Claim promote`). Many copies of one source do not count.
- **Theories:** `Omni Claim theory id(cup) text(...)` stages one; `confirm` / `reject` with a reason. A rejected theory is kept, with its reason.
- **Change the conditions** (add a lime): `Omni Claim state id(cup) conditions(lime=true) reason(added a lime)`. The old state is closed and kept, never erased. `Omni Claim path id(cup)` lists the history.
- **Undefined, on the record:** `Omni Claim unknown id(cup) layer(known_unknown) text(...)`.

## Public and private
`Omni Claim private id(cup) key(my secret)` seals the claim (AES-GCM, key from PBKDF2). Only the title stays visible. **The key is never saved**; lose it and the claim cannot be read. `unlock` opens it for this session, `lock` seals it again, `public` takes the seal off. A sealed claim travels sealed inside the scene file.

## OmniCell
The share curve (true / false / undefined at scales 1 to 1024) is registered for the OmniCell chart for that node.

## Not built yet
## Walking in, awareness and branch realities (V261)
- `Omni Claim view id(x)` (or the ⌂ Walk in button in the Inspector) opens three rooms round the node: TRUE, FALSE and UNDEFINED, each sized by its share at the current scale. Every testimony is a few particles in the room of its verdict, coloured by who said it and moving the way its experience says. It is a view only and is never saved. A locked private claim shows nothing.
- **Awareness**: `Omni Claim aware id(x) name(Camera) type(natural|intentional) familiar(...) accepts(...)`. `Omni Claim identify id(x) subject(s)` asks each awareness: not familiar = undefined; familiar but declined = a **branch reality** is born (an intentional awareness reveals its values by what it declines); otherwise identified.
- **Branches**: `Omni Claim branches`, `branch … status(dormant|forked|merged|active)`, and `grow` turns one into a ClaimNode of its own joined by a line. Merging makes the declining awareness accept the subject.
Tested in headless Chromium only.
