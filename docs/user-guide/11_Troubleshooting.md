# 11. Troubleshooting

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Keyboard and Touch](10_Keyboard_and_Touch_Cheatsheet.md)

## The hands are missing

1. Look at the dock at the bottom: click ⚇ (top hands) and ⚉ (bottom hands).
2. Or open the ribbon Hands tab > Banner and press ⟐Hands or ⟐Hands LH/RH.
3. Or open a hand's settings > "⟐Hands banner" and tick "Show hands banner" and "Show bottom hands (LH / RH)".
4. Still gone: reload (F2).

Hiding hands does not turn off their keys.

## Nothing in the store

1. Open it first: ribbon Realities > Value > Store. It appears in front of the landing view: press C, then look straight ahead; press ⌖ on the HUD to recentre.
2. Check a section chip: an Emoji, Images or Videos lens or a section can filter everything out. Click the pager.
3. Open ⟐OmniStoreSettings > Catalog. If the product list is empty (or after "Delete all products"), add one or import a catalog.

## The Inspector is too tall on a phone

Close sections: on a phone only one section stays open and the panel is capped at 45% of the screen. Tap the open section's icon to close it, or use ✕ to close the panel. Minimize it with _.

## A panel is off-screen

Panel positions are not saved (the code only saves a last-saved time per panel), so a reload puts panels back in a staggered stack. Close the panel and open it again, or reload (F2). Detached pads and the quick launcher do remember a position. For a detached pad open the hand's settings and use "Re-dock pad". Zoom the browser out (Ctrl and -) to see more.

## Sandbox needs a reset

Open ⟐Wallet, press "Reset sandbox" twice. For the look: ⟐OmniStoreSettings > Look > Reset to default.

## Clear saved data

The cleanest ways, from small to large:

| Goal | How |
|---|---|
| Remove what you built | ⟐Admin > Data Management > Clear Scene (confirms; permanent) |
| Back up first | ⟐Admin > Export Reality |
| Reset one hand | Hand settings > Reset <product> settings to defaults |
| Wipe everything | Browser: site settings > clear site data for this page |

For developers, the browser keys are (all begin with omni:): nodes, edges, timeline-v1, hands-settings-v1, hands-banner-v3, hands-bottom-v1, ribbon-v1, inspector-open-v1, notify-box-v1, payloads-v1, flow-fire-master-v1, axinator-v1, dimension-axes-v3, chronos:settings, admin:settings, admin:theme, value-v1, store-v1, store-settings-v1, store-undo-v1, movementpad:detach. There is no in-app "reset everything" button apart from Clear Scene and the per-area resets above.

## Send a good bug report

Include:
1. What you did, step by step, and what you expected.
2. What happened (copy any message text exactly).
3. Device, browser and version, screen size, and whether it is a phone (700px wide or less).
4. Whether it happens after a reload and after "Reset sandbox" / a fresh browser profile.
5. A screenshot. The browser console (F12) errors if you can.
6. The version: V180.
