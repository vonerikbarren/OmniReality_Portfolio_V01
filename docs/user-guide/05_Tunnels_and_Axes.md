# 5. Tunnels and Axes

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Firing and Payloads](04_Firing_and_Payloads.md) · Next: [Chronos, Player and Timeline](06_Chronos_Player_and_Timeline.md)

A **tunnel** is a long line through the middle of the space with nodes along it, like a ruler you can stand inside. The app (module name OmniAxinator, "Axinator") draws seven: one for each hand, plus the X, Y and Z axes. All pass through the **root** node at the centre (0,0,0).

| Tunnel | Runs between | Steppable? |
|---|---|---|
| OmniHand | clock 11 and 5 | Yes: Product / Tier |
| Conscious Hand | 2 and 8 | Yes: Perspective / Scale |
| Logical Hand | 7 and 1 | View only |
| Creative Hand | 4 and 10 | View only |
| X axis | 3 and 9 | View only |
| Y axis | vertical | View only |
| Z axis | 12 and 6 | View only |

## Stepping along a tunnel

1. Open the ⟐ AXIS pad (OmniHand) or Δ AXIS pad (ConsciousHand).
2. Press a direction, or use the keys listed in [Hands](02_The_Four_Hands.md). One press = one step; hold to repeat.
3. The marker moves to the next node. Step speed, travel time and the repeat interval are in the hand's settings ([Settings](09_Settings_and_Admin.md)).

Some node names and values in these tunnels are still placeholders.

## Click a node on a tunnel

Click (do not drag) a tunnel node. A small menu appears with:
- **🎯 TakeMeThere** flies the camera into that node.
- **⟐ Root** returns to the root.
Escape closes the menu. Hovering shows a tooltip.

## When is a tunnel visible?

A tunnel shows when it is not switched off AND (it is pinned OR "Tunnels follow the pads" is on and that hand's pad is open). The pad's ◎ satellite toggles pin/off for OmniHand and ConsciousHand. Hand tunnels are drawn faint on purpose: about 70% strength, nodes about 63%. The tunnel body is grey; the marker, ticks and labels use the tunnel's colour (OmniHand orange, Conscious purple, Logical green, Creative RGB).

## The panels

| Panel | Open from | Contains |
|---|---|---|
| ⟐OmniAxinator | ⟐Admin slot 18, ribbon Realities > Axes > Axinator | "Tunnels follow the pads" checkbox; per-tunnel rows under "Hand tunnels" and "Axes" (a "pad" badge means visible only because its pad is open); "Show all"; "Hide all" |
| ⟐DimensionalAxesSettings | ⟐Admin slot 17, ribbon Dim. Axes | "Tunnels follow the pads"; "Reset Both Markers to Default" |

Hand settings also have "Pin this tunnel visible" and "Reset marker to the root (origin)".
