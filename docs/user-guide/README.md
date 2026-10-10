# User Guide

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

How to use the app, written for a first-time user. Each page takes under 5 minutes.

## Pages

| # | Page | About |
|---|---|---|
| 00 | [How to maintain this guide](00_How_To_Maintain_This_Guide.md) | Rules and template (for developers) |
| 01 | [Getting started](01_Getting_Started.md) | Enter, camera, select, saving |
| 02 | [The four hands](02_The_Four_Hands.md) | Corner controls, pads, satellites |
| 03 | [Nodes and Inspector](03_Nodes_and_Inspector.md) | Make, select, edit, delete nodes |
| 04 | [Firing and payloads](04_Firing_and_Payloads.md) | Fire from LH and RH |
| 05 | [Tunnels and axes](05_Tunnels_and_Axes.md) | Hand tunnels, stepping, axes panels |
| 06 | [Chronos, Player and Timeline](06_Chronos_Player_and_Timeline.md) | Clock, clips, keyframes |
| 07 | [Ribbon, Notify and Dock](07_Ribbon_Notify_and_Dock.md) | Toolbar, info box, bottom dock |
| 08 | [OmniStore and OmniValue](08_OmniStore_and_OmniValue.md) | Sandbox stores (several, by type), wallet, and pinning products / values as nodes |
| 09 | [Settings and Admin](09_Settings_and_Admin.md) | Admin vs Developer, resets |
| 10 | [Keyboard and touch cheatsheet](10_Keyboard_and_Touch_Cheatsheet.md) | Every key in one table |
| 11 | [Troubleshooting](11_Troubleshooting.md) | Fixes, clearing data, bug reports |

## 60-second tour

1. Click **Enter**. Wait about 7 seconds for the landing.
2. Drag to look around; scroll to zoom; W A S D to fly.
3. Press **n**, choose OmniNode, then "+ Add Node" and click the floor to place a node.
4. Click the node. The **Inspector** opens on the right.
5. Open the ribbon (under the top bar) and try the Realities tab > Value > Store for the sandbox shop.
6. Hover any button to see what it does in the OmniNotify box.

## Where do I find things?

| I want to… | Go to |
|---|---|
| Move the camera | Mouse, or the W A S D / arrow keys; [Getting started](01_Getting_Started.md) |
| Make a node | n key, or ribbon Home > Create; [Nodes](03_Nodes_and_Inspector.md) |
| Change a node | Click it; the Inspector; [Nodes](03_Nodes_and_Inspector.md) |
| Put things on a timeline | Inspector Time section, or ribbon Realities > Chronos; [Chronos](06_Chronos_Player_and_Timeline.md) |
| Open a panel | Left drawer (⟐OmniHand ☰), right drawer (⟐ConsciousHand ☰), the ribbon, or the top-bar menus |
| Change settings | ⟐Admin in the left drawer; a hand's ⚙; [Settings](09_Settings_and_Admin.md) |
| Pin a product or value as a node | Exchange > Pin to my space; ⟐N picker > Store item; [Pin](08_OmniStore_and_OmniValue.md) |
| Shop in the sandbox | Ribbon Realities > Value > Store; [Store](08_OmniStore_and_OmniValue.md) |
| Find a key | [Cheatsheet](10_Keyboard_and_Touch_Cheatsheet.md) |
| Fix a problem | [Troubleshooting](11_Troubleshooting.md) |

## Desktop vs phone

The break is **700 pixels wide**. At 700px or narrower:

| Part | Phone behaviour |
|---|---|
| Ribbon | Only tabs show; a tapped tab drops its buttons over the scene |
| Inspector | One section at a time; left-docked, max 45% screen height |
| Chronos | Tabs PLAYER / TIMELINE / SETTINGS instead of EDITOR / SETTINGS |
| Exchange (store) | Full-width bottom sheet |
| OmniNotify | Starts folded; info on long-press |
| Hands | Top hands are shown by default on all devices |

## Glossary

| Term | Meaning |
|---|---|
| Reality | A 3D space you can move through; this app is one |
| Node | A small object in the space; edges join nodes |
| Store item / Value type node | A node that points at a product or a value type and shows it live (sandbox) |
| Pin | Drop a node that points at a product or value type in front of you |
| Hand | A 2x2 group of buttons in a screen corner |
| Cell | One button of a hand (☰ ⚇ ⬢ ⦿) |
| Pad | A floating direction control a hand opens |
| Satellite | One of four small buttons around a pad |
| Tunnel | A long line through the centre with nodes along it |
| Root | The centre node (0,0,0) of the tunnels |
| Ribbon | The tabbed button strip under the top bar |
| OmniNotify | The info box that names what you point at |
| Payload / ammo | The data or behaviour a hand fires |
| Primary Time | The app's clock |
| Sandbox | Fake value; nothing real is spent |
| Store type | A recipe for a store (Produce, Bakery, Electronics, Blank): look, layout, sections, accepted payment forms, starting products |
| Active store | The one of your stores the 3D scene shows and the settings edit |

## Appendix: Doc/code mismatches found

Where older text and the code disagree, this guide follows the code.

1. The in-app Keyboard Shortcuts panel omits 1–4, Shift, W A S D, arrow keys, [ ], F3, F6 and the separate Shift+O.
2. The ribbon's Create tooltip lists six picker modes (Static, Dynamic, Behavior, Cell, Chat, Log); the picker has eight.
3. The LH ☰ panel's GRID tab is empty (the grid component is never mounted). The RH ☰ panel is a placeholder.
4. The GlobalBar file comment still lists position/rotation/scale columns that are no longer in the bar.
5. The Inspector file header says "Four accordion sections"; there are twelve.
6. The LH ⚇ cell toggles the LH and RH pads together, not "all corners".
7. Radial page ⟐2 tools are placeholders and do nothing.
8. (Fixed in V181) The Exchange showed "Chart slot — D3 views arrive in V177"; the slot now holds a real chart. The V180 guide text about this placeholder is removed.
9. The OmniHands panel note for RH keys says arrows yaw; they also rise and fall.
10. R and F are bound in both main.js and MovementPad (possible double move; developer note).
11. The ribbon Dashboard tooltip calls it the "only dashboard panel".
12. The ribbon Start HUD tooltip mentions "four empty placeholder quadrants".

## Appendix: Unverified (needs a human on a real device)

- All touch behaviour, including long-press OmniNotify and pinch zoom.
- Phone layouts at 700px and below (checked in code only).
- Real GPU frame rate in the store and with many nodes.
- Fullscreen and the entry animation on phones and tablets.
- Audio, video playback and file pickers.
- Whether R/F move the camera twice.
- Exact browser-clearing steps in different browsers.
