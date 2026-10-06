# ⟐OmniHands — design and status (V163, extended V165, V166, V168)

**Status: built (settings panel; V165 added the pad satellites below; V166 added the four full-length tunnels and fixed the Speed button). V166 was checked in headless Chromium (software GL), not on real hardware.**

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

**⟐LogicalHand / ⟐CreativeHand Fire (V168).** A "⟐ Fire (the centre button)" group below Ammo
(the pad's centre button, `systems/OmniFlowFire.js`, `docs/omniproducts/OMNI_FLOW_FIRE_DESIGN.md`).
Both hands: Fire enabled (master toggle), Fire distance (2–60 units, the HUD-centre point used when
nothing is targeted), Max fired elements alive (1–200), an alive count and "Remove all fired
elements / displays". LogicalHand adds the **element kind** (Terminator / Process / Decision /
InputOutput / Connector / Loop; the same value as radial ⟐1), "Chain consecutive elements" and
**End chain** with the current chain length. CreativeHand adds the **current ammo** (payload
library select), "Open the payload panel" and the default word delay for new payloads. Activation
(✦, behaviours) is separate and unchanged: the centre button is Fire.

**⟐LogicalHand / ⟐CreativeHand tunnel (V166).** Below Ammo, a "Tunnel (view only)" group: Pin this tunnel visible, "Tunnels follow the pads" (shared), and a status line. The tunnels (7↔1 green, 4↔10 red/green/blue) show while the pad is open or when pinned; they have no marker, and the ✦ button fires ammo, not the tunnel. Reset hand unpins.

**⟐ConsciousHand / ⟐OmniHand.** Tunnel pin, "tunnels follow the pads" (shared
flag, labelled as such), step travel duration, relative (Υ) axis duration, hold-to-repeat
interval, clock hour (applied live by rebuilding the tunnel), OmniHand-only travel
stagger, a live position readout, and Reset marker to the first node.

## The four pad satellites (V165, `ui/MovementPad.js`)

Every movable pad carries four buttons on its own rim, in this order along the arc
(`omni-pad-sat-${hand}-${role}`): **1 release** (detach the pad, unchanged), **2 speed**,
**3 activate**, **4 settings**. (V168: the pad's centre cell is a fifth control on lh / rh only: the **Fire** button, `omni:hand-fire`; see below.) Angles (clockwise from 12): LH 90/120/150/180, RH
270/240/210/180, OmniHand 90/60/30/0, Conscious 270/300/330/0; same rim radius and
button size (40 px desktop / 34 px mobile) as before. The old inert "undefined" slot and
the Dash toggle are gone.

**Speed (`»`).** Opens `ui/HandSpeedPanel.js`, a popover: slider 1.0x-25.0x (step 0.1; V166: was 10x; the popover is now `pointer-events:auto`, before V166 its parent shell swallowed every click),
readout, chips 1/2/5/10/25, Reset. Stored per hand as `speed` (default 1) in the hands
store and mirrored by a slider on every hand view of this panel. Systems read the eased
value (`utils/OmniHandSpeed.js`, ~0.15 s exponential smoothing). Meaning per hand:
LogicalHand translate speed; CreativeHand altitude + orbit speed; ConsciousHand /
OmniHand axis travel durations divided by speed and hold-repeat interval divided by speed
(never under 60 ms). Composition: `admin step (or Global override) x speed`; at 1x
everything equals V164. The old dash multiplier is not migrated into speed.

**Phone arcs (V166, <= 460 px).** On phones the inward arcs put the two bottom pads' Release / Speed buttons on top of each other, so mobile uses its own table (`_SAT_ANGLES_MOBILE`): LH 30/6/342/318, RH 330/354/18/42, OmniHand 150/174/198/222, Conscious 210/186/162/138 (release/speed/activate/settings), i.e. the arc facing the screen's vertical middle; the ammo chip sits above ✦ there. Satellites are `pointer-events:none` until their pad opens and sit at z-index 47 (above the minimap 42, hands 43, drawers 44/45; below WindowManager panels, z 200+).

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

## The centre Fire button (V168, lh and rh only, `ui/MovementPad.js`)

The centre cell of the lh / rh cross is a round button (`omni-pad-fire-${hand}`) that dispatches
`omni:hand-fire {hand}`: lh shoots out the current flowchart element kind, rh displays the current
payload (`systems/OmniFlowFire.js`). Ready glow when it has ammo (dim when empty or when the master
toggle is off), the ammo name small beneath the glyph, `aria-label` "Fire <ammo>", focusable, Space /
Enter when focused (no global key is bound). OmniHand and ConsciousHand keep their inert centre
label: **Fire is undefined for those two.** The radial ⟐1 pages are real on lh (flowchart element
kinds) and rh (DataTypes, Color, Texture, Material -> `ui/OmniPayloadPanel.js`); the top hands' ⟐1
stays blank.

## Persistence (`utils/OmniHandsSettings.js`)

`localStorage` key `omni:hands-settings-v1`, stamped `_v: 1` (V165 added `speed` on all hands and
`magazine`, `ammo`, `maxActive`, `anchorMode`, `anchorCount` on lh/rh without a bump: new fields
merge over DEFAULTS; V168 the same way: lh `elementKind` / `chainEnabled` / `fireDistance` /
`maxAlive`, rh `fireDistance` / `maxAlive` / `defaultWordDelayMs`), per-hand
`{...DEFAULTS, ...saved}` merge with clamping (corrupt or out-of-range data falls
back to defaults). Every write dispatches
`omni:hands-settings-changed {hand, key, value}`. Consumers read the store at use
time: `systems/OmniAxinator.js` (durations, stagger, clock hour),
`ui/MovementPad.js` (hold-repeat), `main.js` (pad on start). Defaults equal the
old module constants: 0.55 s, 0.45 s, 450 ms, clock 2 (Conscious) / 11 (OmniHand),
stagger on for OmniHand, pads hidden on start. V166: `speed` max is 25 (a saved value above 10 loads as is; above 25 clamps).

## The four tunnels (V166)

All four hands own a full-length, two-sided tunnel through the origin (`data/OmniAxinatorData.js`, `systems/OmniAxinator.js`): OmniHand 11↔5 (white), ConsciousHand 2↔8 (violet), LogicalHand 7↔1 (green), CreativeHand 4↔10 (red/green/blue grid). Node 0 of each is a ROOT at exactly 0,0,0 (shell radii 280 / 320 / 240 / 200, nested), real nodes at i x 800 along the hour. OmniHand has the root + 10 products, a Υ column of exactly 8 tiers; ConsciousHand the root + 8 perspectives, 10 scale degrees; Υ spacing is 320 (double V165). LogicalHand / CreativeHand are view only (root + three behaviour-class placeholder nodes). Visibility rule unchanged (explicit OFF > pin > pad-follow) and Activation `◎` answers only the two steppable tunnels. Opacities: tunnel body / grid x 0.7, node shells x 0.63 (V164's 1.3 is gone); a near-black contrast under-pass keeps the white tunnel (and the RGB tunnel's green lines) visible on a white wallpaper. Saved axis positions moved to `omni:dimension-axes-v3` (+1 migration).

## Not built

- ⦿ Orbiter is undefined on all four hands (DeveloperQueue item 38).
- ⬢ radial tool lists are static placeholders (page ⟐2 everywhere; page ⟐1 on the top hands is blank), not configurable. Real: ⟐1 on lh / rh (V168).
- Fire on OmniHand / ConsciousHand (undefined). Array / object payloads, per-word panels, the incoming "shot at the user" mode and flowchart execution (see OMNI_FLOW_FIRE_DESIGN.md).
- Key rebinding (shown read-only).
- Per-hand "follow the pads"; ConsciousHand stagger.
- The perspective / scale / product / tier lists are data (`data/OmniDimensionalAxesData.js`), not panel settings.

See DeveloperQueue items 48 and 53 for follow-ups. Related:
`docs/architecture/HAND_TOGGLE_CONTROL_DESIGN.md`, `CAMERA_MOVEMENT_OPTIONS_DESIGN.md`.
