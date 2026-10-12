# 9. Settings and Admin

Applies to: V188 · Status: verified against code on 2026-10-11 · Real devices: not verified.

[Guide index](README.md) · Previous: [OmniStore](08_OmniStore_and_OmniValue.md) · Next: [Keyboard and Touch](10_Keyboard_and_Touch_Cheatsheet.md)

## Where settings live

Open the left drawer (☰ on ⟐OmniHand, or ribbon Hands tab > Menus > ⟐mniMenu). Below the divider are two groups:

| Group | For | Naming |
|---|---|---|
| ⟐Admin | You, the user. Settings you may change | Panels are called `<System>Settings`, e.g. OmniStoreSettings |
| ⟐Developer | Builders and testing. Not for normal use | Panels are called `Dev<System>Settings`, e.g. DevOmniStoreSettings |

Both open a numbered list of slots. Admin slots include OmniAdminSettings (1), OmniParticleSettings (2), OmniWallpaperSettings (3), MiniMapSettings (4), OmniCameraMovementOptions (5), UserTime (6), WindowInspector (7), FloorSettings (8), ToolTipSettings (9), TerminalSettings (11), OmniMeter(Internal) (13), FloorManager (16), DimensionalAxesSettings (17), OmniAxinator (18) and OmniStoreSettings (19). Slot 10 "🔄 Reset All JSON Data" asks first, then clears every JSON tree; it cannot be undone. Developer slots hold test tools; leave them alone. Access control is not built: anyone can open them. Slot 7 is DevClaudeCheck (see below).

## Claude Check (developer-only; not for normal use)

Slot 7 of ⟐Developer opens DevClaudeCheck, a checklist the builders use to test each version and send notes back. It does nothing for normal use; ignore it. How it works is in `docs/omniproducts/CLAUDE_CHECK_DESIGN.md`.

## The ⟐Admin panel (slot 1)

Staged: changes apply when you press 💾.

| Group | Options |
|---|---|
| Theme | Panel theme (Dark, Light, Custom); for Custom type Background, Border and Accent as rgba values and press "Apply Custom Colors" (applies at once) |
| Domain Grid | Grid colour, Opacity (0–1), Wireframe, Visible |
| User Space | Colour, Size multiplier, Visible, Spinning, Texture |
| UI Settings | Panel opacity (0.3 to 1); **Window sizes: Reset** puts every panel back to its original size and forgets saved sizes (V187); the **userCompass** section (V188, below) |
| Data Management | 🗑 Clear Scene, ⬇ Export Reality, ⬆ Import Reality |

### userCompass (Admin > UI Settings > userCompass, V188)

The userCompass is the small clear globe under the logo and above the top-left hand's MENU cell. Its controls apply **at once** (no 💾 needed) and are remembered on this device. Clicking the globe, or right-clicking it, opens this section.

| Option | Choices | Default |
|---|---|---|
| Show | on / off | on |
| Align | Left / Center / Right inside its small slot (the slot is as wide as the top-left hand, about 103 px) | Center |
| Size | Small 32 / Medium 44 / Large 56 px (it shrinks to fit the slot; under 24 px it hides) | Medium |
| Spin | Off / Slow (28 s per turn) / Normal (14 s) / Fast (7 s) | Normal; **Off** if your device asks for reduced motion |
| Mode | Spin, or Heading (the globe turns with the way the camera faces, like a compass) | Spin |
| Line colour | White / Cyan / Accent (your theme's accent colour) | White |
| Opacity | 30 to 100 % | 85 % |
| Reset userCompass | puts all of the above back | |

It never covers the ribbon, the OmniNotify box, the hands or the Global Bar. When the window is narrower than about 1010 px (or you drag the OmniNotify box away from its docked spot) the ribbon runs under the whole bar and covers that strip, so the globe hides itself instead of overlapping; widen the window or dock the OmniNotify box (double-click its header) to see it again. It is not a window: it cannot be moved, resized or maximized.

**Clear Scene** asks to confirm, then removes every created object. Cannot be undone. **Export Reality** downloads a .zip of all settings plus saved images, audio and video. **Import Reality** restores from such a zip and reloads the page. Export before you clear.

## Hand settings

Open with a pad's ⚙, ribbon Hands tab > Settings, or drawer ⟐OmniHands. Four tabs, one per hand.

| Section | What |
|---|---|
| » Speed | Slider and presets (1 to 25) |
| ✦ Ammo (LH, RH) | Current ammo, Release all, Max fired at once (1–32), Pair for two-node behaviours, Nearest nodes (1–8); Magazine: Load all, Clear, Reset to default |
| ⟐ Fire (LH, RH) | See [Firing](04_Firing_and_Payloads.md): master switch, element kind, chain options, fire distance (2–60), max alive (1–200), word delay (50–3000) |
| Movement | LH steps; RH altitude and orbit speeds (shared with ⟐CameraMovementOptions) |
| Tunnels | Pin this tunnel, followPads, step and axis duration (0.1–3 s), hold-to-repeat (100–2000 ms), travel stagger, clock hour, reset marker |
| ⟐Hands banner | Show hands banner, Show bottom hands |
| ⚇ Pad | Show pad on start, Re-dock pad |
| Reset | "Reset <product> settings to defaults" resets that hand only |

## Safe resets

| To undo | Use | Effect |
|---|---|---|
| One hand's settings | Reset <product> settings to defaults | Only that hand |
| A tunnel marker | Reset marker to the root; Reset Both Markers to Default | Only the marker |
| Store look | Look tab > Reset to default | Only the look |
| Store wallet | Reset sandbox | Only the wallet |
| Everything you built | Clear Scene | Removes objects; **permanent** |
| Everything | Clear browser site data ([Troubleshooting](11_Troubleshooting.md)) | Erases all saved data |

Panel opacity and the theme make panels see-through or recoloured; they do not change what is saved in your scene.
