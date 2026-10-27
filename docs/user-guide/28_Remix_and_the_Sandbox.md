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

# The ribbon, split into nine tabs (V227)
The old Home tab held 54 buttons in one row. Nothing was removed or renamed; buttons only moved to the tab that matches their job.

| Tab | What is in it |
|---|---|
| OmniStar | Docs, OmniStarLight |
| Home | Dashboard, Navigation, Windows, Sound, Assistance |
| Create | Draw (4 modes) · Nodes (path, terminal, note, order, floor panels, voxel rooms) · Media nodes (sound, music, song, mix, doc, poly) |
| Tools | Build (IDE, Acquisitioner, Scan, Dimensions, Vibration) · Studio (mixer, translator, presenter, gallery, expression, BeatPad, browser, DJ) · Editors |
| Sandbox | Sandbox, Remix, Sparks (OmniConstruction and the painter will land here) |
| Inspector | one button per Inspector section |
| Realities | Realities, Axes, Scopes, Save |
| Time & Value | the OmniChronos controls · Store, exchange, wallet, talent |
| Hands | unchanged |

On a phone the tab row scrolls sideways and shows icons; the active tab shows its name. For developers: the layout is the `RIBBON_LAYOUT` and `RIBBON_ORDER` tables in `ui/OmniRibbon.js`; a new button goes into the tab list that fits it.

# Targeting, brighter (V227)
The Z-target markers are now bright (unlit, additive, with a soft glow behind each), solid by default, spin about three times faster, breathe in and out as if focusing, and white bolts strike the target from the markers. ⟐OmniTargetingSettings has Opacity, Glow, Speed and Bolts per second (0 turns the bolts off, speed 0 holds still). This is a glow built into the markers, not a screen-wide bloom pass.

# Target side switch (V228)
While something is targeted, a small **TARGET  ◀ Left · ● Centre · Right ▶** switch appears at the top centre under the ribbon. It moves the target to the left or right of the screen (leaving the other side free for panels) or back to the centre. It is the same setting as Z / L / R in ⟐OmniTargetingSettings, and the two stay in step. It goes away when the target is let go.
