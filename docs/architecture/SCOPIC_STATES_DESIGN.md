# Scopic States — four hands, four scopes of what the user sees and does

Design captured from a real conversation (2026-10-06). **Nothing here is
built except the radial-menu / role relabel in V167 and, in V168, the first
thing the Process and Object hands do together: Fire / payload ammo (see the
last section).** The "system first,
defaults later" rule applies: the machinery for scopic states comes before
any per-product defaults.

## The idea in one paragraph

The app is a way to understand realities. Instead of one fixed scene, the
user constructs what they want to see by combining four independent
*scopes* — one per hand. This is a **dynamic Venn diagram experience**:
each hand's selection narrows or widens the view, and the combination is
computed, not stored per combination. The reference model is Metroid Prime
(visors change how you perceive the same room) plus Zelda: Twilight Princess
(an item found in one dungeon behaves according to the physical laws of the
space where it is used). Generalised: a "BossEntity" has phases; the
sequence of those phases is the narrative, i.e. a *programmable story*.

## The four hands = four scopes

| Hand | Scope | Meaning | Node tier |
|---|---|---|---|
| OmniHand (TL) | **MetaStates** | Realities. The OmniProducts are axiomatic ("MetaRealities"); everything is technically a reality, but axioms are called MetaStates for programming clarity. | 1 — MetaState |
| ConsciousHand (TR) | **VisualStates** | Perspectives. The *options* an OmniProduct/MetaState offers (e.g. OmniSight, root form of OmniVisor, offers perspectives). May draw from a DIFFERENT OmniProduct than the one OmniHand has selected (e.g. Spaces, for moving between spaces). | 2 — ConsciousState |
| LeftHand (BL) | **Process** | The physical state of a node and its functions (the "boomerang"). Works down to the number unit. Home of the node behaviours (V164) and numeric tools. | 3 — ObjectNodePhysicalState |
| RightHand (BR) | **Object** | The identity of a node: the object itself, i.e. the drawing (OmniDraw.Nodes). Creative tools. | 4 — ObjectNodeIdentityState |

Narrative / sequencing is **not** a hand. It is the time axis system
(OmniChronos), below. (The earlier idea of a "Narrative" right hand was a
Narrative-vs-Process confusion: Process belongs to the left hand because it
resolves to numbers; Object belongs to the right hand because OmniDraw is
the creative surface.)

Each hand is its own individual tool system. The HUD/UI should show the
realities the user is in, interacts with and uses (one line per scope).

## Node placement tiers (logic check)

1. **MetaState** — persistent anchor in the scene regardless of the current
   reality or perspective. OmniHand selects which MetaState(s) are active or
   in focus; they do not disappear because another is selected.
2. **ConsciousState** — the option set of a MetaState/OmniProduct. Each
   OmniProduct must be able to declare its state options (a list); the
   ConsciousHand axis loads whichever product's list it has been pointed at.
3. **ObjectNodePhysicalState** — how a node exists/acts: its process
   (node types and the V164 behaviours).
4. **ObjectNodeIdentityState** — what the node is: the object itself.

Open logic point recorded, not decided: *laws of a space* (what makes the
same boomerang behave differently in an ice dungeon vs a lava arena) belong
to the MetaState, and act on tiers 3 and 4; a node's effective behaviour =
its own state + the active laws.

## Combining scopes — the Venn

- Nodes carry membership tags (MetaState, ConsciousState(s), ...).
- Within one hand, multi-select = union. Across hands, default = intersection;
  each hand can be set to add (union) or exclude. (Defaults are a *later*
  decision: the system is built first.)
- The view is a query over tags; saved data is per node, not per combination.
- A true stored intersection exists only where an author overrides one.
- A perspective is a lens (filter + restyle), stored in its own
  `perspectiveNode`, so perspectives can be applied across any reality.
- A reality's **HomeSpace** is a separate system (a reference, not part of
  the reality's own data). Spaces (discovering things at scale and other
  spaces within a context) is distinct from realities; it may merge with
  OmniChronos to some degree — share the traversal component first.

## Defaults

Each OmniProduct gets a standard default (which states each hand starts on);
the user can then switch each hand to whatever they want. Not built; the
defaults depend on the selection system existing first.

## Time axes (OmniChronos)

- **Z = position in time** (the axis you travel along; the existing vertical
  Master Tunnel).
- **Y = time flow** (rate / direction / looping). Recommendation recorded:
  flow is better as a control (like the hand speed slider with a reverse
  range) than as a spatial axis, but the stated structure is Y.
- **X = object**.
- Naming caution: the project already calls the vertical tunnel "Z-axis
  mode" while Three.js uses Y for up. Use T / flow / object names in code and
  docs, not bare X/Y/Z.
Sequence Nodes (V146, `SEQUENCE_NODE.md`) and the Program feature are the
nearest existing pieces of the "programmable story".

## What V167 changed

Only labels: the hand roles in `ui/Hand.js` / `ui/OmniHandsPanel.js` /
`ui/Panel.js` (MetaStates, VisualStates, Process, Object) and the radial
menu page-2 tool names in `ui/RadialMenu.js` (placeholders; they dispatch
the same `omni:tool-select`).

## Known mismatches to resolve next

- **The RightHand activation mismatch remains (recorded follow-up, V168 did
  not resolve it).** The RightHand's *Activation* satellite (✦, V165) still
  fires node *behaviours* via `systems/OmniHandAmmo.js`; under this structure
  behaviours are Process (LeftHand). The RightHand's activation should become
  object-oriented (stamp/draw the current OmniDraw object). V168 added the
  centre **Fire** button for the Object hand (display of a created payload,
  below) but left Activation as it was on both hands, by decision: "the
  existing Activation (behaviour) button stays as is on both". The default
  magazines (LH 20 / RH 14) were split by class, not by this structure.
- The V160–V166 tunnels still use the earlier meanings (ConsciousHand tunnel
  = perspectives, OmniHand tunnel = products). The nodes are meant to become
  a selection UI that stages a MetaState at 0,0,0, with TakeMeThere replaced
  by "load"; not built.
- First system build: tags + per-hand scopic-state selection + Venn query +
  four-line HUD.

## Fire / payload ammo (V168)

Full design: `docs/omniproducts/OMNI_FLOW_FIRE_DESIGN.md`. In scopic terms:

- **LeftHand (Process) shoots out flowchart elements** (Terminator, Process,
  Decision, InputOutput, Connector, Loop): the *shape and sequence* of what
  flows. Radial page ⟐1 picks the kind; the pad's **centre button** fires it.
- **RightHand (Object) displays what that looks like and what is inside it.**
  Its ammo is a created **payload** (data type + value + style) from a
  library. Radial page ⟐1 = #1 DataTypes (opens the payload panel), #2 Color,
  #3 Texture, #4 Material (edit the current payload's style). Strings play as
  word tooltips with per-word timing; numbers / booleans as one badge tooltip.
  Array / object payloads are not built.
- Together they are "the inspector, broken up between hands", for *shooting
  content out* now and, later, for content *shot at the user* to interpret
  (not built). Both fire at the selected node, else the screen-centre node,
  else the HUD centre. OmniHand / ConsciousHand have no Fire (undefined).
- Elements and displays are visual / structural only: no flowchart execution.
- The RH radial page ⟐2 lost ColorShift / MaterialMorph / TextureWeave (they
  are ⟐1's Color / Material / Texture now) and gained Geometry, Glyph, Label
  (placeholders).
