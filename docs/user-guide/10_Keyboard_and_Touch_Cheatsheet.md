# 10. Keyboard and Touch Cheatsheet

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Settings and Admin](09_Settings_and_Admin.md) · Next: [Troubleshooting](11_Troubleshooting.md)

Keys are ignored while you type in a text box. "Everywhere" means anywhere in the app. Keys listed here were checked in the code; the in-app Assistance > Keyboard Shortcuts panel lists only some of them.

| Key | Where it works | What it does |
|---|---|---|
| **Camera** | | |
| W A S D | Everywhere | LH pad: forward, left, back, right |
| R / F | Everywhere | Camera up / down |
| Arrow Up / Down | Everywhere | RH pad: rise / fall |
| Arrow Left / Right | Everywhere | RH pad: orbit left / right |
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
| M | Everywhere (not while hovering Chronos) | Mini map |
| Enter | Everywhere, unless a button has focus | Start HUD |
| O / Shift+O | Everywhere | Show/hide the User Space sphere / toggle its spin |
| 0 or 9 (top row) | Everywhere | Domain grid sphere |
| ( and ) | Everywhere | Wallpaper sphere spin direction |
| ` or F1 | Everywhere | Terminal |
| F3 | Everywhere | Camera auto-rotate |
| F6 | Everywhere | Window inspector dev tool |
| J | Only while OmniMeter(External) is on | OmniStemming |
| F4 | Everywhere | Fullscreen on/off |
| F2 | Everywhere | Reload the page |
| Escape | Everywhere | Closes the open drawer, speed popover, Axinator node menu, ribbon overlay, terminal; cancels placing/path mode and deselects; leaves fullscreen |
| **Only while a panel is hovered or focused** | | |
| Space, ← →, Home, End, I, O, M, C, Delete, + -, Escape | Chronos window | See [Chronos](06_Chronos_Player_and_Timeline.md) |
| → ↓ / ← ↑, Space, Esc, Home, End | OmniPresenter open | Next / previous, play, stop, first / last |

Note: R and F are bound both to the camera and the RH pad. Whether they move you twice has not been checked on a device.

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
