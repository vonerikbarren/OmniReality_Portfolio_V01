# 1. Getting Started

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Next: [The Four Hands](02_The_Four_Hands.md)

A **Reality** is a 3D space you can fly through. This app is one Reality. You look around, click things, and build things called **nodes** (small objects you place in the space).

## Enter

1. Open the app. A boot screen shows an **Enter** button.
2. Click **Enter**. The app asks the browser for fullscreen, then plays an entry animation: the camera falls from high above and lands at the middle of the space. It takes about 7 seconds.
3. When you land, a browser window (OmniBrowser window 1) and its Properties panel open by themselves. Close them with their ✕ if you do not want them. (They do not open when the app is shown inside another page.)

## Move the camera

| What | Mouse | Keyboard |
|---|---|---|
| Look around (orbit) | Drag with the left button | Arrow Left / Right (orbit), see [cheatsheet](10_Keyboard_and_Touch_Cheatsheet.md) |
| Zoom | Mouse wheel (or middle button) | |
| Pan | Drag with the right button | |
| Fly forward/back/sideways | | W A S D |
| Up / down | | R / F, or Arrow Up / Down |
| Back to the start view | | C |

Limits: you can zoom in to 1 unit from the middle point and out to 80 units. The camera glides to a stop (damped). The orbit point starts at the middle of the space, 2 units up. The TakeMeThere action in [Tunnels](05_Tunnels_and_Axes.md) can raise the 80 limit.

## Select a node

Click a node in the scene. The **Inspector** opens on the right ([Nodes and Inspector](03_Nodes_and_Inspector.md)). Click empty space to deselect.

## The screen at a glance

| Part | Where | What it is |
|---|---|---|
| Global bar | Top, 48px tall | Logo, your profile, Current State (space, time), the ⟐Notify bar, and 8 menus: Realities, Experiences, Perspectives, Times, Spaces, Objects, Windows, Assistance |
| Ribbon | Under the bar | Tabs Home, Inspector, Realities, Hands with buttons ([Ribbon](07_Ribbon_Notify_and_Dock.md)) |
| Hands | Four screen corners | Four 2x2 button groups. ☰ opens a menu, ⚇ opens a pad, ⬢ opens tools ([Hands](02_The_Four_Hands.md)) |
| Dock | Bottom, 52px tall | Pinned icons ⚇ and ⚉, minimized panels, a panel tray button |
| OmniNotify box | Under Current State | Tells you what anything under your pointer is and what key it has |

## Saving

The app saves in your **browser** (localStorage), on this device only. There is no account or server. It saves on its own when you leave or hide the page. The ribbon has a **Save nodes** button (Realities tab, Save group) that saves right now.

| What is saved | Saved under (plain words) |
|---|---|
| Nodes and the lines between them | nodes, edges |
| Timeline | timeline |
| Hand settings, pad positions | hands settings, movement pad detach |
| Ribbon tab, hand visibility | ribbon, hands banner, bottom hands |
| Store and wallet | store, value, store settings |
| Admin settings, theme, panel opacity | admin settings |

What does **not** survive a reload: which panels are open, the Primary Time seconds counter (it restarts), the camera position, and sandbox store state if you used Reset sandbox. Clearing browser data erases everything. See [Troubleshooting](11_Troubleshooting.md) for the exact key names and how to clear them.

Planned (not available yet): undo and redo, copy and paste. See [DeeperSettings build order](../dev/Roles/Developer/buildOrder_DeeperSettings_V01.md).
