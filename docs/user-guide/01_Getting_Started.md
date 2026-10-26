# 1. Getting Started

Applies to: V188 · Status: verified against code on 2026-10-11 · Real devices: not verified.

[Guide index](README.md) · Next: [The Four Hands](02_The_Four_Hands.md)

A **Reality** is a 3D space you can fly through. OmniOS (this app) is made of Realities, and what you see first is one of them. You look around, click things, and build things called **nodes** (small objects you place in the space).

## Enter

1. Open the app. The boot screen is black. The word **Omni⟐Star** fades in while a white shooting star, with a tapering tail, streaks in from the top right on a curve, slows down, spinning, and lands about a second and a half later directly **behind the ⟐** (the ⟐ stays in front and readable). The star then turns into a five-pointed star, then rounds into a white spiky orb (a round body with sixteen thin spikes, like a sea urchin) that keeps turning slowly while its spikes gently breathe in and out. A small **OmniOS** sits under the word, and a faint field of stars fades in around it. A thin progress bar fills while the app loads, then an **Enter** button appears. Move the mouse (or touch the button) and the stars drift gently toward the logo.
2. Click **Enter**. The stars rush into the logo and fade, the app asks the browser for fullscreen, then plays an entry animation: the camera falls from high above and lands at the middle of the space. It takes about 7 seconds. (If your device is set to reduce motion, the boot screen shows the finished spiky logo and still stars at once, with no movement; Enter works the same.)
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
| userCompass | Under the logo, above the top-left hand's ☰ MENU | A small clear globe that spins slowly. Hover for its name, click it (or right-click) to open its settings. It hides itself when the window is too narrow for it (the ribbon then covers that strip). Options: [Settings and Admin](09_Settings_and_Admin.md) |
| Hands | Four screen corners | Four 2x2 button groups. ☰ opens a menu, ⚇ opens a pad, ⬢ opens tools ([Hands](02_The_Four_Hands.md)) |
| Dock | Bottom, 52px tall | Pinned icons ⚇ and ⚉, minimized panels, a panel tray button |
| OmniNotify box | Under your profile (V190) | Tells you what anything under your pointer is and what key it has |

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
