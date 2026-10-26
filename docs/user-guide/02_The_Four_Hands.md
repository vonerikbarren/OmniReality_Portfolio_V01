# 2. The Four Hands

Applies to: V191 · Status: verified against code on 2026-10-11 · Real devices: not verified.

[Guide index](README.md) · Previous: [Getting Started](01_Getting_Started.md) · Next: [Nodes and Inspector](03_Nodes_and_Inspector.md)

A **hand** is a group of four small buttons (a 2x2 **cell** matrix) in a screen corner. Each hand has a role. A **pad** is a floating control that a hand can open: a ring of direction buttons with a centre button. A **satellite** is one of the four round buttons around a pad. Each pad also has one round **chip** (see below).

## The hands

| Hand | Corner | Role | ☰ opens |
|---|---|---|---|
| ⟐OmniHand | top-left | MetaStates | ⟐mniMenu (left drawer) |
| ⟐ConsciousHand | top-right | VisualStates | ⟐NavMenu (right drawer) |
| ⟐LogicalHand (LH) | bottom-left | Process | LH panel (tabs GRID, TREE) |
| ⟐CreativeHand (RH) | bottom-right | Object | RH panel |

Hover a hand's name badge to see its product name and role.

## The four cells

| Cell | Name | Does |
|---|---|---|
| ☰ | Menu | Opens that hand's menu or panel |
| ⚇ | Pad | Shows or hides that hand's pad |
| ⬢ | Tools | Opens a 3-page radial menu |
| ⦿ | Orbiter | Disabled on all four hands |

On the left hands the top row is ☰ then ⚇; on the right hands it is ⚇ then ☰.

Real vs design-only:
- Real: the drawers from ☰ on OmniHand and ConsciousHand, the pads, the ⬢ radial page ⟐1 on LH and RH.
- Not finished: the LH panel GRID tab is empty (TREE works). The RH ☰ panel is a placeholder ("panel content — phase 4"). Radial page ⟐2 buttons only light up; they do nothing. Page ⟐3 is locked.

Show or hide the hands (**summon**): dock icon ⚇ toggles the top two hands, dock icon ⚉ the bottom two (LH and RH). To summon one hand alone use the ribbon Hands tab > Summon (buttons LH, RH, OH, CH) or the rows in the ⟐OmniHands panel. The dock icon is half-filled (mixed) when only one hand of its pair is shown. Each hand's choice is remembered. Hiding hands does not close pads or disable their keys.

## Pads

Pads start hidden. Open one with its hand's ⚇, the ribbon Hands tab > Pads, or the pad setting "Show pad on start" in the hand's settings.

| Hand | Pad title | Moves |
|---|---|---|
| ⟐LogicalHand | MOVE | Camera: FWD, BCK, STR-L, STR-R. Corner buttons: ORB-U / ORB-D (orbit up / down around the current target, V192), ASC / DSC (ascend / descend along world Y) |
| ⟐CreativeHand | NAV | Camera: RISE, FALL, ORB-L, ORB-R (orbit around the vertical axis through the current target). Corner buttons: ORB-U / ORB-D (orbit up / down around the current target), ASC / DSC (ascend / descend) |
| ⟐OmniHand | ⟐ AXIS | Steps along its tunnel: Product / Tier ([Tunnels](05_Tunnels_and_Axes.md)) |
| ⟐ConsciousHand | ◬ AXIS | Steps along its tunnel: Perspective / Scale |

The corner buttons (V191) are hold-to-move like the others. ASC / DSC use the same altitude settings and speed as RH Rise / Fall (a camera movement setting: Admin altitude-up / -down step, or the Global speed, times the hand's speed). ORB-L / ORB-R / ORB-U / ORB-D (V192: ORB-U / ORB-D are on both lower pads) orbit the current target: the node you selected or flew to, else the point 4 units ahead of you when you start (never the scene origin). They keep your distance and height relative to the target. ORB-U / ORB-D now loop all the way around, over the top and under the bottom, with no stop at straight up / down (V191 stopped 5 degrees short); when you let go the view rolls back upright over about half a second. Speed is the Admin vertical orbit step times the speed of the hand whose button you hold. There is no invert option. A strip labelled KB shows the keys. The axis pads never move the camera. Pressing steps once; holding repeats (default every 450 ms, divided by speed, never faster than 60 ms).

Centre button: on LH and RH it is **Fire** ([Firing](04_Firing_and_Payloads.md)). On OmniHand and ConsciousHand it is a label only.

### Satellites (in order along the arc)

| Satellite | Does |
|---|---|
| ⏏ | Detach the pad into a floating one you can drag. Its position is saved. |
| » | Shows ×N speed. Click for a slider (0.01x to 50x, fine at the slow end) and an exact box, kept per hand. Walking, rising/falling and all orbiting follow it. |
| ◎ (OmniHand, ConsciousHand) | Turns that hand's tunnel on or off (pins it) |
| ✦ (LH, RH) | Fires the current ammo (a node behaviour) at a target |
| ⚙ | Opens that hand's settings ([Settings](09_Settings_and_Admin.md)) |

All satellites are circles, large enough to show their label (FREE, ×1.0, FIRE or TUNL, SET), with clear space between each circle and the pad. The **chip** is a larger circle just outside one satellite:

| Pad | Chip shows | Click |
|---|---|---|
| LH, RH | The current ammo, or "empty" | Cycle; Shift+click goes back; or press [ and ] |
| OmniHand, ConsciousHand (V191) | The marker's current node and its position, e.g. "OmniPlayer 2/11" | Opens that hand's **tool options** menu |

The tool options of OmniHand and ConsciousHand (V191) were only at the axis before. The menu holds: TakeMeThere (fly into the marker's node), Root (fly to the root), Back and Forth (primary axis), Υ up and Υ down, Reset marker, Tunnel, Follow pads, Settings. They do what the same actions do at the axis; the axis itself (clicking a node in the tunnel, the readout, ⟐DimensionalAxesSettings) is unchanged.

### Keys

| Keys | Does |
|---|---|
| W A S D | LH pad: forward, left, back, right |
| R F, Arrow keys | RH pad (Up/Down rise and fall, Left/Right orbit) |
| (E and Q) | Removed in V195: Q opens OmniStarLight and E is free. The ASC / DSC corner buttons on the LH pad still work (tap or hold them) |
| U V | LH pad corner buttons: orbit up / down (V192) |
| Y H | RH pad corner buttons: orbit up / down |
| Numpad / * - + | OmniHand pad: up, down, left, right |
| Numpad 7 9 5 6 | ConsciousHand pad: up, down, left, right |
| [ and ] | Cycle ammo of the last pad you touched |
| 1, 2, 3, 4, Left Shift, Right Shift | Press hand cells; see [cheatsheet](10_Keyboard_and_Touch_Cheatsheet.md) |

Pad keys work even when the pad is hidden. The ammo behaviour: the target is your selected node, or else the node closest to the screen centre (within 25 degrees). A node you gave your own behaviour is never overwritten. Firing the same ammo again releases it. At most 8 are active per hand by default (the oldest is released). Hints you may see: "No target — select a node", "Target has its own behaviour", "Magazine empty".

Planned (not available yet): firing from OmniHand and ConsciousHand, and an OmniKeyboard launcher in radial page ⟐3. See [DeveloperQueue](../dev/Roles/Developer/DeveloperQueue.md).
