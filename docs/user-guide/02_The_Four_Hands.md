# 2. The Four Hands

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Getting Started](01_Getting_Started.md) · Next: [Nodes and Inspector](03_Nodes_and_Inspector.md)

A **hand** is a group of four small buttons (a 2x2 **cell** matrix) in a screen corner. Each hand has a role. A **pad** is a floating control that a hand can open: a ring of direction buttons with a centre button. A **satellite** is one of the four small buttons around a pad.

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

Show or hide the hands: dock icon ⚇ toggles the top two hands, dock icon ⚉ the bottom two (also ribbon Hands tab > Banner). Hiding hands does not close pads or disable their keys.

## Pads

Pads start hidden. Open one with its hand's ⚇, the ribbon Hands tab > Pads, or the pad setting "Show pad on start" in the hand's settings.

| Hand | Pad title | Moves |
|---|---|---|
| ⟐LogicalHand | MOVE | Camera: FWD, BCK, STR-L, STR-R |
| ⟐CreativeHand | NAV | Camera: RISE, FALL, ORB-L, ORB-R (orbit around the vertical axis) |
| ⟐OmniHand | ⟐ AXIS | Steps along its tunnel: Product / Tier ([Tunnels](05_Tunnels_and_Axes.md)) |
| ⟐ConsciousHand | Δ AXIS | Steps along its tunnel: Perspective / Scale |

A strip labelled KB shows the keys. The axis pads never move the camera. Pressing steps once; holding repeats (default every 450 ms, divided by speed, never faster than 60 ms).

Centre button: on LH and RH it is **Fire** ([Firing](04_Firing_and_Payloads.md)). On OmniHand and ConsciousHand it is a label only.

### Satellites (left to right)

| Satellite | Does |
|---|---|
| ⏏ | Detach the pad into a floating one you can drag. Its position is saved. |
| » | Shows ×N speed. Click for a slider, 1x to 25x, kept per hand. |
| ◎ (OmniHand, ConsciousHand) | Turns that hand's tunnel on or off (pins it) |
| ✦ (LH, RH) | Fires the current ammo (a node behaviour) at a target |
| ⚙ | Opens that hand's settings ([Settings](09_Settings_and_Admin.md)) |

The **ammo chip** (LH, RH) shows the current ammo, or "empty". Click it to cycle, Shift+click to go back, or press [ and ].

### Keys

| Keys | Does |
|---|---|
| W A S D | LH pad: forward, left, back, right |
| R F, Arrow keys | RH pad (Up/Down rise and fall, Left/Right orbit) |
| Numpad / * - + | OmniHand pad: up, down, left, right |
| Numpad 7 9 5 6 | ConsciousHand pad: up, down, left, right |
| [ and ] | Cycle ammo of the last pad you touched |
| 1, 2, 3, 4, Left Shift, Right Shift | Press hand cells; see [cheatsheet](10_Keyboard_and_Touch_Cheatsheet.md) |

Pad keys work even when the pad is hidden. The ammo behaviour: the target is your selected node, or else the node closest to the screen centre (within 25 degrees). A node you gave your own behaviour is never overwritten. Firing the same ammo again releases it. At most 8 are active per hand by default (the oldest is released). Hints you may see: "No target — select a node", "Target has its own behaviour", "Magazine empty".

Planned (not available yet): firing from OmniHand and ConsciousHand, and an OmniKeyboard launcher in radial page ⟐3. See [DeveloperQueue](../dev/Roles/Developer/DeveloperQueue.md).
