# 10. Keyboard and Touch Cheatsheet

Applies to: V191 · Status: verified against code on 2026-10-12 · Real devices: not verified.

[Guide index](README.md) · Previous: [Settings and Admin](09_Settings_and_Admin.md) · Next: [Troubleshooting](11_Troubleshooting.md)

Keys are ignored while you type in a text box. "Everywhere" means anywhere in the app. Keys listed here were checked in the code; the in-app Assistance > Keyboard Shortcuts panel lists only some of them.

| Key | Where it works | What it does |
|---|---|---|
| **Camera** | | |
| W A S D | Everywhere | LH pad: forward, left, back, right |
| R / F | Everywhere | Camera up / down |
| E / Q | Everywhere | LH pad corner buttons: ascend / descend along world Y (V191) |
| Arrow Up / Down | Everywhere | RH pad: rise / fall |
| Arrow Left / Right | Everywhere | RH pad: orbit left / right around the current target (the selected node, else the point just ahead of you), not the scene origin (V192) |
| Y / H | Everywhere | RH pad corner buttons: orbit up / down around the current target; keeps going all the way around, over the top and under the bottom (V192; V191 stopped 5 degrees short of straight up / down) |
| U / V | Everywhere | LH pad corner buttons: orbit up / down, the same continuous orbit as Y / H (V192) |
| C | Everywhere (not while hovering Chronos) | Return to the landing view |
| **Hands** | | |
| 1 / 2 | Everywhere | ⟐OmniHand ☰ / ⟐ConsciousHand ☰ (top-row digits or numpad) |
| 3 / 4 | Everywhere | OmniHand / ConsciousHand ⬢ Tools |
| Left Shift / Right Shift | Everywhere | LH ⬢ / RH ⬢ Tools |
| Numpad / * - + | Everywhere | OmniHand pad up, down, left, right |
| Numpad 7 9 5 6 | Everywhere | ConsciousHand pad up, down, left, right |
| [ / ] | Everywhere | Cycle ammo on the last-touched LH/RH pad |
| Space / Enter | Fire button focused | Fire |
| **Panels and tools** | | |
| N | Everywhere | OmniDraw mode picker |
| B | Everywhere | OmniBrowser window |
| P | Everywhere | OmniPresenter |
| G | Everywhere | OmniGallery |
| T | Everywhere, unless a button has focus | OmniTranslator |
| K | Everywhere | OmniMixer |
| Ctrl+K (Cmd+K on Mac) | Everywhere | OmniStarLight: search sites and docs; Up/Down + Enter pick, Escape closes (does not trigger the plain K) |
| PageUp / PageDown | In the Docs panel | Scroll the page; at the end, turn to the next/previous page |
| M | Everywhere (not while hovering Chronos) | Mini map |
| Enter | Everywhere, unless a button has focus | Start HUD |
| O / Shift+O | Everywhere | Show/hide the User Space sphere / toggle its spin |
| 0 or 9 (top row) | Everywhere | Domain grid sphere |
| ( and ) | Everywhere | Wallpaper sphere spin direction |
| F1 | Everywhere | Terminal (before V191 the ` key also opened it; ` now belongs to StrictAlign) |
| ` (Backquote) | Everywhere, not while typing in a text box | **OmniState_StrictAlign** on / off: move the selected node along ONE axis with exact coordinates (V191) |
| F3 | Everywhere | Camera auto-rotate |
| F6 | Everywhere | Window inspector dev tool |
| J | Only while OmniMeter(External) is on | OmniStemming |
| F4 | Everywhere | Fullscreen on/off |
| F2 | Everywhere | Reload the page |
| Escape | Everywhere | Closes the open drawer, speed popover, Axinator node menu, ribbon overlay, terminal; cancels placing/path mode and deselects; leaves fullscreen |
| **Only while a panel is hovered or focused** | | |
| Space, ← →, Home, End, I, O, M, C, Delete, + -, Escape | Chronos window | See [Chronos](06_Chronos_Player_and_Timeline.md) |
| → ↓ / ← ↑, Space, Esc, Home, End | OmniPresenter open | Next / previous, play, stop, first / last |

E, Q, Y, H, U and V do nothing while Ctrl, Cmd or Alt is held (browser shortcuts keep working), and are ignored while you type in a text box. Not checked on a device.

Note: R and F are bound both to the camera and the RH pad. Whether they move you twice has not been checked on a device.

## OmniState_StrictAlign keys (V191, upgraded in V192)

Press ` with a node selected. A small panel shows the node's exact **world** X, Y, Z. Only the **checked** axis can change; the other two are locked.

**Pick any node:** while the mode is on, click any node in the scene to make it the target (the panel names it). In Path or Place mode, a click in the scene only picks a node while this mode is on (it cannot connect or place anything).

**One axis at a time:** each coordinate has a **checkmark**. Check X, Y or Z and the others uncheck; the last checkmark cannot be unchecked. The keys below do the same.

**Step:** the **Step** box (the "space iterator") is how far one arrow press moves the node, in world units. Type any number from 0.001 to 100 and press Enter, or tap a preset chip: **0.01, 0.1, 1, 10**. It is saved on this device. The **-** and **+** arrow buttons move the node by one step along the checked axis; **hold** them to repeat. Shift = 10 x step, Alt = step / 10 (on the buttons and the wheel). Every move is an exact value rounded to the **Decimals** setting (default 4), so 100 steps of 0.1 land exactly on 10.

| Key | While the mode is on |
|---|---|
| 1 2 3 or x y z | Check the X, Y or Z axis |
| Arrow Up / Right, PageUp | One step up along the axis (**Shift** = 10 x step) |
| Arrow Down / Left, PageDown | One step down |
| Mouse wheel over the node or its line | One step (the wheel zooms as usual elsewhere) |
| Enter | Jump to the checked axis field to type an exact value; Enter again moves the node there |
| Ctrl+Z (Cmd+Z) | Undo the last move made in this mode (a whole hold of the arrow button is one undo) |
| Esc or ` | Leave the mode |

Touch: tap a node to pick it, tick an axis, tap the - / + buttons (hold to repeat), drag the coloured line with a finger, and type in the field.

A node that cannot be moved (a tracking node, a behaviour-locked or structural node, an object that is not an OmniNode) says why in the panel; the arrow buttons are dimmed.

## CryptX keyboard (right edge; launcher > Keyboard) (V192)

The ⟐ quick launcher's **Keyboard** entry opens a keyboard that slides out from the right edge. **Click a key to type it** (into the text box that has the focus, and to the app's own key handlers). At the **bottom** of the panel two arrows work the drawer: **◂** pulls the next column of keys out, **▸** pushes the last one back in (the order is Control, three letter rows, digits, symbols). **Drag the strip on the panel's left edge** to move it anywhere on screen; dragging never presses a key, it stays inside the window, and it remembers its place and drawer state on this device. **×** closes it. With a mouse: wheel over the panel moves the highlight, right-click pushes a column in, middle-click closes; the mouse's back / forward buttons pull a column out / push it in. Keys are lowercase only (no Shift layer yet).

## Panel windows (V187)

| Action | Mouse | Touch |
|---|---|---|
| Resize | Drag an edge or corner | Drag an edge or corner (larger grab area) |
| Maximize / restore | ⛶ button or double-click the title bar | ⛶ button (36 px) |

No key was added for maximize (Esc and Alt+Enter already have other uses).

## Touch

| Mouse/keyboard | Touch |
|---|---|
| Hover for OmniNotify | Long-press 0.45 s |
| Drag to orbit | One-finger drag |
| Zoom with wheel | Pinch |
| Right-drag pan | Not checked |
| Ctrl+wheel zoom in timeline | Two-finger pinch |
| Keys | Use the on-screen pads and ribbon (every key has a button) |

Touch behaviour is untested on real devices; see the [index appendix](README.md#unverified-needs-a-human-on-a-real-device).

## Keys that do NOT exist yet

| Wanted | Status |
|---|---|
| Undo, redo (Ctrl/Cmd+Z, Shift+Z) | Planned, not available yet |
| Copy, cut, paste (C, X, V with Ctrl/Cmd) | Planned, not available yet |
| Arrow keys in the store | Not bound |
| Ctrl/Cmd+F1 | Not bound |

See [DeeperSettings build order](../dev/Roles/Developer/buildOrder_DeeperSettings_V01.md), item D5.
