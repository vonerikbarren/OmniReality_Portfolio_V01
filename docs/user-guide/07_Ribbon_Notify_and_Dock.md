# 7. Ribbon, OmniNotify and Dock

Applies to: V194 · Status: verified against code on 2026-10-12 · Real devices: not verified.

[Guide index](README.md) · Previous: [Chronos](06_Chronos_Player_and_Timeline.md) · Next: [OmniStore and OmniValue](08_OmniStore_and_OmniValue.md)

## The ribbon

The ribbon is the strip of buttons under the top bar. It has five tabs (V190 added OmniStar on the left). It remembers your tab and whether it is folded.

| Tab | Groups (buttons) |
|---|---|
| OmniStar ✧ | Docs (this guide, with search); OmniStarLight (search sites and docs, the Q key) |
| Home ▦ | Dashboard (Dashboard, Start HUD); Navigation (NavMap, MiniMap, Landing); Create (OmniDraw, Static, Dynamic, Behavior, Path node, Terminal node, Sound node, Music node, Song node, Node order, Floor panels); Tools (Music player (OmniMusicPlayer, was OmniMixer), Translator, Presenter, Gallery, Sound settings, Expression, BeatPad, Browser, OmniDJ, Song editor); Windows (PanelControl, Panel Tray); Assistance (Shortcuts, Terminal, Fullscreen, Refresh, Reset HUD). Refresh reloads the page; Reset HUD puts window sizes, the OmniNotify box and the userCompass back in their default places without reloading and touches no data |
| Inspector ◧ | Panel (Inspector); Node, Look & logic, Content (the 13 sections, see [Inspector](03_Nodes_and_Inspector.md)) |
| Realities ⟐ | Realities (Realities, Experiences, Spaces, Times, Products); Axes (Dim. Axes, Axinator, Tunnels, Domain grid); Scopes (Visor, Select, Floors, User space); Chronos (Chronos, Play, Step ◀, Step ▶, To start, Add node, Marker); Value (Store, Exchange, Wallet, Store Settings, Dev Store); Save (Save nodes) |
| Hands ⚇ | Pads (LH, RH, OmniHand, Conscious, LH + RH together); Banner (⟐Hands, ⟐Hands LH/RH); Menus (⟐mniMenu, ⟐NavMenu); Tools (the four ⬢ menus); Settings (the four hand settings); Fire & tunnels (LH fire, RH fire, Tunnels, Axinator). Since V190 a thin divider (with a colour cap) separates each hand's buttons (LH, RH, OmniHand, Conscious) in every group |

Dev Store is marked DEV: a developer panel, not for normal use. Hover any button to see its key.

## Folding it

- Desktop: the ⌃ chevron folds the ribbon. Clicking the active tab again, or double-clicking a tab, also folds it. The mouse wheel scrolls the buttons sideways.
- Phone (700px wide or less): only tabs show. Tap a tab and its buttons drop down over the scene. Tap the tab again, tap outside, or press Escape to close.

## OmniNotify

**OmniNotify** is the info box. Since V190 it docks under your profile (top left) by default; drag it elsewhere, or double-click its header to dock it back, and it remembers where you left it. Point at (or focus) any button or icon and it shows the name, a key chip, where it comes from, and what it does. Nothing happens until you hover; idle text reads "Hover any tool, button or icon to see its name, shortcut and what it does."

| Device | How |
|---|---|
| Mouse | Hover for a moment (about 0.12 s). It reverts about 1.2 s after you leave |
| Keyboard | Focus a control; it shows at once |
| Touch | Long-press (0.45 s); reverts after about 2.5 s |

The box also shows the latest notification line; click it for the feed. You can drag its header, resize with the bottom-right grip, double-click the header to dock it back, and fold it with the ▾ chevron (it starts folded on phones). The ⟐Notify bar in the top bar also opens the feed.

## The dock

The dock is the bar at the bottom (52px).

| Part | Does |
|---|---|
| ⚇ | Show / hide the two top hands |
| ⚉ | Show / hide the two bottom hands (LH / RH) |
| Centre tray | Minimized panels appear as icons; click to bring one back. Empty: "no docked panels" |
| ▲ (right) | "Panel Tray": opens the panel tray |

A panel's _ button minimizes it to the dock.

The ⚇ and ⚉ icons are half-filled when only one hand of the pair is shown. Ribbon Hands tab > **Summon** has the pair buttons plus one button per hand (LH, RH, OH, CH); the same four toggles are rows in the ⟐OmniHands panel.

## The OmniDock_Realities row (V191)

A second, thin dock sits directly **above** the dock: the **OmniDock_Realities**. It holds one small **wireframe icon for each main shape** a node can have (Box, Sphere, Cylinder, Cone, Torus, TorusKnot, Octahedron, Tetrahedron, Icosahedron, Dodecahedron, Plane, Circle, Ring, Capsule, Lathe, Tube, Extrude, Shape, Edges, Wireframe: the same 20 as the geometry picker). The row has its own space, so it **scrolls sideways** (drag it, swipe it, or use the mouse wheel) without a scrollbar.

| Action | Does |
|---|---|
| Hover a shape (desktop) | The OmniNotify box shows the shape's name and its **number of nodes**, for example "4 nodes". The icon also turns slowly while the pointer is on it (not when your device asks for reduced motion) |
| Tap a shape once (phone) | The same quick tip appears and the shape is marked. **Tap it again** (within 6 seconds) to open its list. A long-press also shows the tip |
| Click a shape | Opens **⟐RealitiesInShape**, a window listing every node with that shape: its name, its kind (node, group, essence, store item, value, structural ...) and its **id**. Click a row to select that node and fly to it. The list updates by itself when nodes are added, removed or given another shape. Click the same shape again to close the window |
| ⚙ at the right end | Opens the OmniDock_Realities settings |

The **userCompass** now lives at the **left end** of this row by default. You can still drag it anywhere (a spot you chose is remembered and wins). **Dock compass** (in the settings, or in Admin > UI Settings) puts it back in the row.

The row stays between the two bottom hands, so it never covers them or the dock. The icons get bigger or smaller with the screen width, and on a phone the row stays one line and scrolls. The X meter (the thin horizontal bar) and the bottom sheets sit above the row.

Settings (Admin > UI Settings > OmniDock_Realities > Open settings, or the ⚙ on the row, or the nav item `⟐OmniDockRealitiesSettings`): **Show** the row; **icon size** with S / M / L buttons and a 60 to 160 % slider; **opacity** (20 to 100 %); **hide shapes with 0 nodes**; and for **each shape** its own colour and opacity with a reset. Everything applies at once and is remembered on this device. Counts are the nodes in the current reality; nothing here involves money.

## Resizing and maximizing panels (V187)

Every panel window can be resized and maximized.

- **Resize**: drag any edge or corner (eight zones; a larger grab area on a touch screen). Smallest size about 220 x 120; a panel never goes under the ribbon or the dock. Content scrolls, the title bar stays.
- **Maximize**: the square ⛶ button in the title bar, left of minimize / close, or double-click the title bar. The panel fills the free area (full width, below the ribbon and the top hands, above the dock). The button becomes ❐; press it or double-click again to restore the exact earlier size and place. A maximized panel cannot be dragged.
- **Remembered**: sizes are saved per panel (not positions, and never the maximized state). Reset them in Admin > UI Settings > Window sizes.
- **Phone**: panels are bottom sheets; drag the top edge to change the height; the maximize button fills the screen between ribbon and dock.
- Not windows, so no handles: the ribbon, dock, hands and pads, toasts, tooltips, small pickers and context menus.
