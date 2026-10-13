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
| Arrow Left / Right | Everywhere | RH pad: orbit left / right |
| Y / H | Everywhere | RH pad corner buttons: orbit up / down, the vertical twin of the left / right orbit (V191) |
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

E, Q, Y and H do nothing while Ctrl, Cmd or Alt is held (browser shortcuts keep working), and are ignored while you type in a text box. Not checked on a device.

Note: R and F are bound both to the camera and the RH pad. Whether they move you twice has not been checked on a device.

## OmniState_StrictAlign keys (V191)

Press ` with a node selected. A small panel shows the node's exact X, Y, Z. Only the chosen axis can change; the other two are locked and shown underneath.

| Key | While the mode is on |
|---|---|
| 1 2 3 or x y z | Choose the axis (X, Y or Z) |
| Arrow Up / Right, PageUp | One step up along the axis (the step is 0.1; **Shift** = 1) |
| Arrow Down / Left, PageDown | One step down |
| Mouse wheel over the node or its line | One step (the wheel zooms as usual elsewhere) |
| Enter | Jump to the axis field to type an exact value; Enter again moves the node there |
| Ctrl+Z (Cmd+Z) | Undo the last move made in this mode |
| Esc or ` | Leave the mode |

Touch: use the X / Y / Z buttons, drag the coloured line with a finger, and type in the field.

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
