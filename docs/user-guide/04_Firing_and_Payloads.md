# 4. Firing and Payloads

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Nodes and Inspector](03_Nodes_and_Inspector.md) · Next: [Tunnels and Axes](05_Tunnels_and_Axes.md)

**Fire** makes something appear in the scene from the LH or RH pad. A **payload** is the data (a word, number or true/false) that the RH fires. Firing only exists on the LH and RH pads.

## Fire from the pad

1. Open the LH or RH pad (hand ⚇ button).
2. Press the centre button (or Space or Enter when it is focused).

If the centre button is dimmed, the tooltip says "Fire is switched off (flow master toggle)". Turn it on in the hand's settings ("Fire enabled (master)").

**Where it goes:** the selected node; if none, the node nearest the screen centre (within 25 degrees); if none, a spot ahead of the camera (default 10 units). Fire always has somewhere to go.

## LH: flowchart elements

1. Press ⬢ on ⟐LogicalHand, then page ⟐1.
2. Choose an element kind: Terminator, Process, Decision, InputOutput, Connector or Loop. The highlight stays on.
3. Press Fire. A tracer flies out and a real node in that shape appears.

Consecutive elements line up along the camera's right side and are joined by edges (a **chain**). A chain restarts when you aim at a different target, press "End chain", or turn off "Chain consecutive elements" (hand settings). These nodes are saved with the others. Flowcharts do not run.

## RH: words (page 1 and the Payload panel)

1. Press ⬢ on ⟐CreativeHand, page ⟐1. Choose DataTypes, Color, Texture or Material. Each opens (or focuses) the ⟐Payload panel; choose it again to close.
2. In "⟐Payload · RightHand ammo" fill in:

| Section | What |
|---|---|
| 1 · Data type | String, Number or Boolean (Array and Object are disabled, "later") |
| Value / name | Text up to 500 characters, a number, or true/false. Name up to 40 characters |
| Word timing | Delay 50–3000 ms, hold, rise, direction, loop, max words. "▶ Preview" tries it |
| 2 · Color | Swatches |
| 3 · Texture | Texture choice |
| 4 · Material | standard, basic, emissive, glass, wireframe, metal |
| Library · created ammo | Create ammo, Save changes, Cancel edit, Use / current, Edit, ✕ (up to 200 payloads) |

3. Press Fire. A small "Anchor" node appears and the words rise from it. Click the node to replay. With no payload chosen the chip says "empty".

## Limits and clearing

| Limit | Value |
|---|---|
| Fired elements alive per hand | Default 40 (1 to 200); oldest removed first |
| Flying tracers at once | 8 |
| Words on screen | 24 total |

Clear them in the hand's settings: "Remove all fired elements" (LH) or "Remove all fired displays" (RH). Deleting the node in the Inspector also works. Settings are in [Settings](09_Settings_and_Admin.md).

Planned (not available yet): array and object payloads, running flowcharts, Fire on OmniHand and ConsciousHand. See [DeveloperQueue](../dev/Roles/Developer/DeveloperQueue.md).
