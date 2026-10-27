# Remix and the Sandbox (V226)

**Remix** deals your nodes a random combination, only to get ideas moving: an axiom and one of its perspectives, a palette colour, a size, a turn and a name such as "Time · Bullet time lantern". It uses the same colour, size and name controls as `Omni Node set`, so nothing here is special; it is just chosen for you.

**The Sandbox** is a marked-off area for these experiments, apart from your portfolio. It is a Dimensional Space called "Sandbox" with its own spawn point (default x 60, away from the middle of the scene). Remix on the Sandbox never touches a portfolio node, and clearing it only deletes Sandbox nodes.

## Buttons (ribbon, and OmniStarLight search "remix" or "sandbox")
- 🎲 **Remix**: every node, or only the selected one. An Undo button sits on the note that appears.
- 🧪 **Sandbox**: makes 6 random nodes in the Sandbox and remixes them. Tap again for more (up to 24 per tap, 60 in all).
- ✺ **Sparks**: five ideas as text only; nothing changes.

## Commands
```
Omni Sandbox spawn n(8) layout(ring) scheme(triad) seed(7)
Omni Sandbox remix axiom(time)
Omni Sandbox add(myNode)      # bring an existing node in (it stays where it is)
Omni Sandbox remove(myNode)   # take it out; it is not deleted
Omni Sandbox hide | show | lock | unlock
Omni Sandbox centre pos(60, 1, 0)
Omni Sandbox list
Omni Sandbox clear confirm    # deletes only what is in the Sandbox
Omni Remix roll scope(sandbox) what(color, scale, label, motion, layout) seed(7)
Omni Remix undo
```
Same seed, same deal, so a combination you like can be found again. `what(...)` chooses which parts change (colour, scale, spin, label, motion, layout); `motion` starts a looped OmniVibration on each node.

## Limits
Remix handles up to 60 nodes at a time and keeps one level of undo (colour, size, turn, name, position; it stops motion it started). Verified in a simulated browser only.
