# ⟐OmniHands — design and status (V163, extended V165)

**Status: built (settings panel; V165 added the pad satellites below). Not yet seen in a real browser.**

⟐OmniHands is the OmniProduct that holds the settings of the four hands. It
lives in the ⟐mniMenu drawer (`ui/Drawer.js` `LEFT_ITEMS`, after ⟐OmniNavi) as a
sub-menu:

| Menu entry | Hand id | Corner | Role (ui/Hand.js) |
|---|---|---|---|
| ⟐LogicalHand | `lh` | bottom-left | Analytical |
| ⟐CreativeHand | `rh` | bottom-right | Creative |
| ⟐ConsciousHand | `conscious` | top-right | Perspectives |
| ⟐OmniHand | `omnihand` | top-left | App Launcher |

The names are product / display names. Hand ids and every storage key keep their
old names. `ui/Hand.js` carries them as `productName` (aria-label and badge
tooltip only).

## The panel (`ui/OmniHandsPanel.js`)

One draggable panel (WindowManager id `omnihands`, minimizes to the tab tray).
Clicking a sub-menu entry opens it on that hand; a four-button switcher at the top
changes hand without going back to the drawer. The title line is
name · corner · role. Only real, wired settings are shown.

**All four hands**
- Show pad on start (`padOnStart`; `main.js` dispatches `omni:pad-toggle` after the axes exist). Default off.
- Pad docked / detached readout and a Re-dock button (`omni:pad-detach-state`, `omni:pad-redock`).
- Reset the hand's settings.

**⟐LogicalHand / ⟐CreativeHand.** These edit the same `omni:admin:settings`
store as ⟐CameraMovementOptions (same event, so both panels and MovementPad stay
in sync). LogicalHand: px / py / pz step (the V163 dash multiplier row was removed in
V165, Dash became Speed). CreativeHand: altitude-up,
altitude-down, horizontal orbit, vertical orbit. When Global speed is on there,
the boxes are disabled and a note says so.

**⟐ConsciousHand / ⟐OmniHand.** Tunnel pin, "tunnels follow the pads" (shared
flag, labelled as such), step travel duration, relative (Υ) axis duration, hold-to-repeat
interval, clock hour (applied live by rebuilding the tunnel), OmniHand-only travel
stagger, a live position readout, and Reset marker to the first node.

## The four pad satellites (V165, `ui/MovementPad.js`)

Every movable pad carries four buttons on its own rim, in this order along the arc
(`omni-pad-sat-${hand}-${role}`): **1 release** (detach the pad, unchanged), **2 speed**,
**3 activate**, **4 settings**. Angles (clockwise from 12): LH 90/120/150/180, RH
270/240/210/180, OmniHand 90/60/30/0, Conscious 270/300/330/0; same rim radius and
button size (40 px desktop / 34 px mobile) as before. The old inert "undefined" slot and
the Dash toggle are gone.

**Speed (`»`).** Opens `ui/HandSpeedPanel.js`, a popover: slider 1.0x-10.0x (step 0.1),
readout, chips 1/2/3/5/10, Reset. Stored per hand as `speed` (default 1) in the hands
store and mirrored by a slider on every hand view of this panel. Systems read the eased
value (`utils/OmniHandSpeed.js`, ~0.15 s exponential smoothing). Meaning per hand:
LogicalHand translate speed; CreativeHand altitude + orbit speed; ConsciousHand /
OmniHand axis travel durations divided by speed and hold-repeat interval divided by speed
(never under 60 ms). Composition: `admin step (or Global override) x speed`; at 1x
everything equals V164. The old dash multiplier is not migrated into speed.

**Activation.**
- ConsciousHand / OmniHand `◎`: toggles that hand's tunnel. **Precedence: explicit OFF >
  pin (manual) > pad-follow.** Pressing while visible = OFF (until the pad is next
  toggled, the button is pressed again, or the tunnel is pinned from a checkbox);
  pressing while hidden = ON = the pin. With Activation never pressed the V160 pad-follow
  rule is unchanged. The OmniAxinator panel and this panel's Pin checkbox mirror it.
- LogicalHand / CreativeHand `✦`: **node behaviours are the hands' ammo**
  (`systems/OmniHandAmmo.js`). Each hand has a magazine and a current ammo; ✦ fires it at
  the target (selected node, else the node nearest screen centre) as a behaviour with
  `source: 'hand:lh' | 'hand:rh'`; firing the same ammo at the same node again releases
  it; per-hand cap `maxActive` (8). Two-node behaviours are paired with the nearest other
  node(s) (`anchorMode`, `anchorCount`). A user-authored behaviour on the target is never
  overwritten. An ammo chip beside ✦ shows and cycles the current ammo (`[` `]` too).
  This panel's LH/RH view edits the magazine (class-grouped checkboxes, Load all / Clear /
  Reset to default), the current ammo, the cap, the pair mode, and has Release all.
- **The default split is a proposal, not a decided taxonomy.** LogicalHand: Mechanic
  (minus Drift, Oscillate) + Relational (minus Mirror) + Transformational = 20.
  CreativeHand: Temporal + Emergent + Drift, Oscillate, Mirror = 14. Edit freely.

**Settings (`⚙`).** Dispatches `omni:nav-select` with the hand's menu name, which opens
this panel on that hand's view; pressing it while that view is open closes the panel
(`omni:hands-panel-state` / `omni:hands-panel-close`).

## Persistence (`utils/OmniHandsSettings.js`)

`localStorage` key `omni:hands-settings-v1`, stamped `_v: 1` (V165 added `speed` on all hands and
`magazine`, `ammo`, `maxActive`, `anchorMode`, `anchorCount` on lh/rh without a bump: new fields
merge over DEFAULTS), per-hand
`{...DEFAULTS, ...saved}` merge with clamping (corrupt or out-of-range data falls
back to defaults). Every write dispatches
`omni:hands-settings-changed {hand, key, value}`. Consumers read the store at use
time: `systems/OmniAxinator.js` (durations, stagger, clock hour),
`ui/MovementPad.js` (hold-repeat), `main.js` (pad on start). Defaults equal the
old module constants: 0.55 s, 0.45 s, 450 ms, clock 2 (Conscious) / 11 (OmniHand),
stagger on for OmniHand, pads hidden on start.

## Not built

- ⦿ Orbiter is undefined on all four hands (DeveloperQueue item 38).
- ⬢ radial tool lists are static placeholders; not configurable.
- Key rebinding (shown read-only).
- Per-hand "follow the pads"; ConsciousHand stagger.
- The perspective / scale / product / tier lists are data (`data/OmniDimensionalAxesData.js`), not panel settings.

See DeveloperQueue item 48 for follow-ups. Related:
`docs/architecture/HAND_TOGGLE_CONTROL_DESIGN.md`, `CAMERA_MOVEMENT_OPTIONS_DESIGN.md`.
