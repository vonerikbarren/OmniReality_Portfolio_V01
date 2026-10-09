# 7. Ribbon, OmniNotify and Dock

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Chronos](06_Chronos_Player_and_Timeline.md) · Next: [OmniStore and OmniValue](08_OmniStore_and_OmniValue.md)

## The ribbon

The ribbon is the strip of buttons under the top bar. It has four tabs. It remembers your tab and whether it is folded.

| Tab | Groups (buttons) |
|---|---|
| Home ▦ | Dashboard (Dashboard, Start HUD); Navigation (NavMap, MiniMap, Landing); Create (OmniDraw, Static, Dynamic, Behavior); Tools (Mixer, Translator, Presenter, Gallery, Browser); Windows (PanelControl, Panel Tray); Assistance (Shortcuts, Terminal, Fullscreen) |
| Inspector ◧ | Panel (Inspector); Node, Look & logic, Content (the 12 sections, see [Inspector](03_Nodes_and_Inspector.md)) |
| Realities ⟐ | Realities (Realities, Experiences, Spaces, Times, Products); Axes (Dim. Axes, Axinator, Tunnels, Domain grid); Scopes (Visor, Select, Floors, User space); Chronos (Chronos, Play, Step ◀, Step ▶, To start, Add node, Marker); Value (Store, Exchange, Wallet, Store Settings, Dev Store); Save (Save nodes) |
| Hands ⚇ | Pads (LH, RH, OmniHand, Conscious, LH + RH together); Banner (⟐Hands, ⟐Hands LH/RH); Menus (⟐mniMenu, ⟐NavMenu); Tools (the four ⬢ menus); Settings (the four hand settings); Fire & tunnels (LH fire, RH fire, Tunnels, Axinator) |

Dev Store is marked DEV: a developer panel, not for normal use. Hover any button to see its key.

## Folding it

- Desktop: the ⌃ chevron folds the ribbon. Clicking the active tab again, or double-clicking a tab, also folds it. The mouse wheel scrolls the buttons sideways.
- Phone (700px wide or less): only tabs show. Tap a tab and its buttons drop down over the scene. Tap the tab again, tap outside, or press Escape to close.

## OmniNotify

**OmniNotify** is the info box under the "Current State" block in the top bar. Point at (or focus) any button or icon and it shows the name, a key chip, where it comes from, and what it does. Nothing happens until you hover; idle text reads "Hover any tool, button or icon to see its name, shortcut and what it does."

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
