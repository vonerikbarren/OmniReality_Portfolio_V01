# 27 · Receive, Route and the OmniNodeAcquisitioner (V223)

A tunnel is a **field**. Things can arrive in it, but only when you open it.

## Receive (opt-in)
Seven tunnels can receive: ConsciousHand, OmniHand, LH, RH, and the X / Y / Z axes. **Every tunnel starts closed.** Open one in ⟐OmniNodeAcquisitioner (tick **Receive**) or with `Omni Communication receive tunnel(lh) open(true)`.
- **Mute** keeps arrivals but shows no notification and no drop animation.
- **Allow** is the list of who may send: `*` (anyone), `user` (you), `external` (other users, later) or tunnels. An empty list means nobody.
- **Cap** is how many pieces a tunnel holds (12 by default, up to 24). When it is full the oldest piece that is not pinned drops. Pinned pieces never drop.

## Send and Route
- `Omni Communication send to(lh) node(<id>)` or `text("hello")`, optionally `via(x, rh)`.
- `Omni Communication route id(<piece>) from(lh) to(rh) via(x)` moves a piece you already hold.
- **via** are relays. A relay must be open and must allow the sender, or the road is blocked and you are told which tunnel refused. A route cannot loop or repeat a tunnel, and has at most four relays.
- Only ordinary nodes can be sent for now (special kinds like notes are not). The piece carries the node's shape, colour, scale and rotation, not its position.

## The OmniNodeAcquisitioner
Left half: what has arrived in the chosen tunnel, as pieces settling onto a 4-wide board like Tetris (node ◆ is two wide; a message ¶ is one, two or four wide by length). Right half: the inspector. A piece is **zipped**: you see what it is and who sent it. **Decipher** unzips its contents, **Re-zip** folds it up again. **Acquire** puts it in the space in front of you (a node becomes a real node; a message becomes a note). **Forward** routes it to another tunnel. **Pin** keeps it. **Drop** removes it. Under the halves you can send your selected node, or a short message, to any tunnel.

## From the terminal
`Omni Communication status | receive | mute | allow | cap | send | route | inbox | take | drop | clear confirm | open`

## Not built
Nothing leaves this space yet: `external` is reserved for the Presence backend. No in-tunnel 3D animation of arrivals, no rhythm-game "hit" mechanic, no OmniSense symbols on pieces.
