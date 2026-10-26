# 9. Settings and Admin

Applies to: V194 · Status: verified against code on 2026-10-12 · Real devices: not verified.

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
| Theme presets (V205) | One click sets a **wallpaper and all the panel colours** together. Seven ship with the app (Midnight, Daylight, Ember, Ocean, Forest, Violet, High contrast). **Save current as theme** stores the wallpaper now showing (a slot, the default picture or a plain colour, and its alpha) plus the panel colours now in use as a theme of your own (up to 24; rename, replace with what is on screen, delete). A video wallpaper is switched off when a theme is applied; a theme that uses a wallpaper slot needs that slot to still be filled in this browser. Applies at once. |
| Domain Grid | Grid colour, Opacity (0–1), Wireframe, Visible |
| User Space | Colour, Size multiplier, Visible, Spinning, Texture |
| UI Settings | Panel opacity (0.3 to 1); **Window sizes: Reset** puts every panel back to its original size and forgets saved sizes (V187); the **userCompass** section (V188, below) |
| Data Management | 🗑 Clear Scene, ⬇ Export Reality, ⬆ Import Reality |

### userCompass (Admin > UI Settings > userCompass, V188; own panel since V190)

The userCompass is the small clear globe in its own little panel. **Drag it anywhere** (it remembers the spot on this device); it stays inside the window and never covers the ribbon. Its controls apply **at once** (no 💾 needed) and are remembered on this device. Clicking the globe, or right-clicking it, opens this section.

| Option | Choices | Default |
|---|---|---|
| Show | on / off | on |
| Size | Small 32 / Medium 44 / Large 56 px | Medium |
| Spin | Off / Slow (28 s per turn) / Normal (14 s) / Fast (7 s) | Normal; **Off** if your device asks for reduced motion |
| Mode | Spin, or Heading (the globe turns with the way the camera faces, like a compass) | Spin |
| Line colour | White / Cyan / Accent (your theme's accent colour) | White |
| Opacity | 30 to 100 % | 85 % |
| Reset position | puts the panel back at its default spot | |
| Reset userCompass | puts all of the above back, and the position | |

Since V191 it sits by default at the **left end of the OmniDock_Realities row** just above the dock (see [Ribbon, OmniNotify and Dock](07_Ribbon_Notify_and_Dock.md)); **Reset position** or **Dock compass** puts it back there. If the row is hidden it falls back to the old spots: the strip under the logo, or when that strip is not free (narrow window, phone, or a moved OmniNotify box) the right edge under the ribbon. It is a small widget, not a window: it moves but has no resize handles or maximize. Click it (without dragging) to open this section; with the keyboard, focus it and press Enter, or use the arrow keys to move it (Shift for bigger steps).

### OmniDock_Realities (Admin > UI Settings > OmniDock_Realities, V191)

Show or hide the row of wireframe shapes above the dock, **Open settings** (icon size S / M / L plus a slider, opacity, a colour and opacity for each shape, hide shapes with 0 nodes, reset), and **Dock compass** (puts the userCompass back at the left end of the row). Stored on this device (`omni:dock-realities-v1`). Details: [Ribbon, OmniNotify and Dock](07_Ribbon_Notify_and_Dock.md).

### OmniState_StrictAlign (Admin > UI Settings > OmniState_StrictAlign, V191)

The ` key moves any node along one axis (the checked one) with exact numbers. Controls apply at once and are remembered on this device (`omni:strictalign-v1`).

| Option | Choices | Default |
|---|---|---|
| Step | 0.001 to 100 (also set in the panel's Step box and chips) | 0.1 |
| Decimals (precision) | 0 to 6: every move is rounded to this many decimals and set as an exact value (V192) | 4 |
| Shift = 10 x step | on: Shift multiplies the step by 10, Alt divides it by 10. Off: Shift uses the fixed Shift step below (V192) | on |
| Shift step | 0.001 to 1000 (used when Shift = 10 x step is off; an older save that chose its own keeps using it) | 1 |
| Show axis line | on / off | on |
| Close after Enter | on / off | off |
| Snap drag to step | on / off | on |
| Reset StrictAlign | puts all of the above back | |

Keys are in [Keyboard and Touch](10_Keyboard_and_Touch_Cheatsheet.md). A node that cannot be moved (a tracking node, a behaviour-locked or structural node, an object that is not an OmniNode) says why in the panel. If several nodes are set to move together, each moves by the same amount along the axis.

### Reticle (Admin > UI Settings > Reticle, V190)

A faint decorative technical circle in the middle of the screen, behind every panel. It cannot be clicked. It turns slowly (not when your device asks for reduced motion). Controls apply at once: **Show** (on by default), **Opacity** (5 to 100 %, default 15 %), **Reset reticle**.

### Sound (Admin > UI Settings > Sound, V194)

Global options for every node that makes sound: master volume, the speaker (mute), how many sounds play at once, mute on phones, ask before sound, the Enable sound prompt and the particle limit. They apply at once. The table is in [Sound nodes](12_Sound_Nodes.md). The window that edits one node's sound, ⟐SoundNodeSettings, is also in the ⟐Admin drawer (next free slot after the fixed ones).

**Clear Scene** asks to confirm, then removes every created object. Cannot be undone. **Export Reality** downloads a .zip of all settings plus saved images, audio and video. **Import Reality** restores from such a zip and reloads the page. Export before you clear.

## FloorNodeMakerSettings (Admin slot 20)

Opens from the ⟐Admin special slot 20 or ribbon Home > Create > Floor panels. It is a normal window (resize, maximize; a bottom sheet on a phone).

1. **Piece**: choose I, O, T, S, Z, J, L or an extra (single, double, three-cell). **Rotate** turns it a quarter turn; **Mirror** flips it.
2. **Grid** (12 x 12 by default, 6 to 24): with the Piece tool, click an empty cell to stamp the piece there (hover shows its footprint; red means it does not fit) and click a panel to remove that panel only. With the Face tool, click a panel, then give it a picture, GIF or video by file or https link; **Clear** removes it.
3. **Place in scene** stamps the whole blueprint at the camera target; **Place at cell** uses a floor cell you type; **Place with pointer** lets you click the floor. Placing over existing panels is refused.

| Setting | Range / default |
|---|---|
| Grid size | 6 to 24, default 12. Shrinking drops pieces that no longer fit |
| Cell size | 1 to 200, default 20 (the floor grid unit); "= floor unit" resets it |
| Panel thickness | 0.02 to 2, default 0.2 |
| Colour, Opacity | default light blue, 0.1 to 1 (default 0.9) |
| Snap to the floor grid | On: pieces sit exactly on floor cells |
| Grid overlay on the floor | Draws the placement grid near the camera target |
| Max panels | 20 to 1000, default 400, counted over the whole scene |

The media list shows stored files (in use / unused); **Clean unused** deletes the unused ones. Media is kept in this browser and goes with Export Reality / Import Reality (60 files at most). **Reset** restores the settings and keeps the blueprint.

## Hand settings

Open with a pad's ⚙, ribbon Hands tab > Settings, or drawer ⟐OmniHands. Four tabs, one per hand.

| Section | What |
|---|---|
| » Speed | Slider (0.01 to 50, logarithmic), exact box and presets (0.05, 0.25, 1, 5, 50) |
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
