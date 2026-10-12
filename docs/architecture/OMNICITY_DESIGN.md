# Omni⟐City — Reality Addressing, Contexts and Perspectives (DESIGN, draft 1)

Date: 2026-10-12 · Status: **draft 2. Step 1 (utils/OmniAddress.js) is built in V189; everything else is design only** · Owner: the founder · Written from a design conversation; where a decision was not made it is listed under "Open questions", not guessed.

Product naming (decided 2026-10-12): company **OmniStar**, product **OmniOS**. "Reality / Realities" stays the concept word. "OmniReality" was a placeholder.

---

## 1. What this is

Omni⟐City is a recursive, text-addressable tree of **contexts**. Every context is a small version of the whole OS and can contain more contexts. People who see the value get a branch of their own, with their own recursive context of the broader OS. Everything branches from the **origin = the Reality Core**.

The first place a user enters is `Omni⟐City_Omni⟐StarHQ_MainLobby`. For now we build **infrastructure only**: how places are named, addressed, entered, switched between perspectives, saved and (later) secured. City art comes after.

Vibe (for later, not part of the infrastructure): a cyber city that makes Mega Man Battle Network look like a kid's dream; neon on dark glass, grid lines and data streams. Because states are overlays (section 6) the wrecked / era / sandbox looks are theme layers over the same geometry, not separate cities.

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **Reality Core / origin** | The root. Everything branches from it. Address `0`. |
| **Context** | A node of the tree: a city, an organisation's HQ, a room. Has a type, an immutable id and children. |
| **Drawer** | One of 8 fixed standard sub-areas every context has (section 4.3). |
| **Perspective** | A way of looking at the same place: a time (OmniChronos), a state (digital / wrecked / sandbox / era), etc. Chosen with the ConsciousHand (VisualStates). Shown with an eye-like symbol, the same idea as layer visibility in CAD / vector tools. |
| **State** | A perspective kind: a named version of a place (digitized, wrecked, sandbox, 1950s…). Implemented as an **overlay**, not a copy. |
| **Reality address** | Location + perspective(s). The whole string is the address, and it is saved because it is built for this purpose. |
| **Cryptx** | The ring engine (`modules/OmniCryptx.js`) used as a true key: it encodes/decodes addresses and, through derivation, grants entry. |
| **Mode** | Operable (editable), Sealed (truth-guarded: confirm only), Sandbox (private fork). |

## 3. The address

An address has two parts: **where** (location) and **how you look at it** (perspective). The same location in a different perspective is a different reality of the same space.

### 3.1 Segments are typed: symbol first, then number

Every segment is `<type symbol><ordinal>`. The symbol says what kind of system the segment is; the number is the ordinal under its parent.

```
Location   :=  Segment ( "/" Segment )*          e.g.  C0 / B1 / S1
Segment    :=  TypeSymbol Ordinal                 e.g.  B1  = branch #1 under its parent
Drawer     :=  "#" DrawerCode                     e.g.  #4  = States drawer
Perspective:=  "@" ProductId "(" params ")"       e.g.  @chronos(1980s)   @state(wrecked)
Address    :=  Location Drawer? Perspective*
```

Placeholder canonical form (ASCII, safe in URLs / ids / file names / DB keys):

```
0mni:C0/B1/S1#4@chronos(1980s)@state(wrecked)
```

* `0mni` is the namespace and master-key marker (user's idea: ASCII id `0mni_…` so the ⟐ glyph is never a technical problem; the glyph is display only).
* `C0` core/origin, `B1` the first branch (OmniStar HQ), `S1` the first space (MainLobby). The real type symbols are **not chosen yet** (open question 2); `C`, `B`, `S` here are placeholders.
* `#4` addresses the States drawer of that context.
* `@…` segments are perspectives. They are optional, ordered, and each begins with an **OmniProductId** (section 3.3).

Display form for humans: `Omni⟐City_Omni⟐StarHQ_MainLobby` (+ perspective shown with its eye symbol). Both forms come from the same list of segments. The underscore is display only so names containing underscores cannot collide with the stored separator.

### 3.2 Why the number alone is not enough, and what each part does

* The **ordinal** gives structure and sorting. It is assigned by the system when a child is attached to a parent (next free ordinal, **never reused**), so it is "built by having the object attached to it" and never renumbered when something is deleted. Unbounded depth and width: no fixed-width codes.
* The **type symbol** says what the segment is, so an address is readable and typed (a branch is not a room).
* The **identity** of a context is separate and **immutable** (an id that never changes). If a branch is moved its dotted address changes, the identity does not, and the old address is kept as an alias that still resolves.
* The **perspective part** is what lets one location be several realities (a different time, a different state).

Rejected: positional three-digit codes in names (`010_DataParent_01_…`). They overflow at the tenth parent, renumber on insert / move, repeated the parent twice, and had a duplicate `004`. Kept from that idea: numbers that carry meaning and sort, and the fixed function list (now the drawers).

### 3.3 Perspectives and the OmniProductId

* A perspective always starts with the **OmniProductId** of the product that provides it, so the product's symbol comes first. Example from the founder: OmniChronos has parameters `(TimePeriod, Decade, date, time)`, so `@chronos(1980s)`, `@chronos(1980s,1984)`, `@chronos(1980s,1984,1984-06-02,14:30)` are progressively more specific.
* The ConsciousHand's root always has an OmniProductId before it (the product being looked through). **Decided 2026-10-12:** OmniHand controls the symbolic layer, i.e. which OmniProduct (axiom) is in use; ConsciousHand takes whatever OmniHand has selected and uses **all the dimensions of that one item**. If the product is OmniSpace, the dimensions are the dimensions of spaces; if it is OmniChronos, they are time periods, decades, dates, times. (Matches `SCOPIC_STATES_DESIGN.md`: OmniHand = MetaStates, ConsciousHand = VisualStates.)
* **No OmniProductId registry exists in code today** (searched). Building one (id, symbol, name, perspective parameter schema) is part of the infrastructure.
* Perspectives are drawn like **layers**: an eye symbol per perspective; visible / hidden / locked; a stack with a base perspective. The symbol system should reuse the OmniSense glyph work (`OMNISENSE_GLYPH_SYSTEM_DESIGN.md`) rather than invent a second one.

## 4. Contexts, ids and drawers

### 4.1 Three separate things
1. **Identity**: immutable id. Used by storage and references.
2. **Address**: derived from the tree (typed segments with ordinals). Can change if a branch moves; old address stays as an alias.
3. **Display name**: what people read, e.g. `Omni⟐StarHQ`. May contain `⟐`, may be renamed.

### 4.2 Context record (sketch)
`{ id, type, ordinal, parentId, name, modeDefault, states[], owner, visibility, createdAt }` — plain data, versioned schema, validated like the store catalog (untrusted-input rules: caps, clamps, no HTML).

### 4.3 The 8 fixed drawers (every context has all 8, same codes everywhere)
| Code | Drawer | Note |
|---|---|---|
| 0 | ToBeSorted | inbox |
| 1 | Admin | |
| 2 | Templates | |
| 3 | Database | logical view; physical storage is the storage adapter |
| 4 | States | the reality states (overlays) of this context |
| 5 | Resources | |
| 6 | Store | per-context store(s) (OmniStore) |
| 7 | Program | |

(Order question, asked plainly: the drawer number is only a fixed code so `#4` always means States everywhere. The only thing to confirm is whether you want a different order or different names; if not, keep this list. The founder's list had two entries numbered 004 — States and Resources — which is why the list is 8 drawers with 8 codes, 0–7. Confirm the order.) The three-digit style (`004`) can still be **displayed** as a label for a drawer, it is not the identity.

## 5. Cryptx as the key

* The cryptx is a **true key for every context, starting from the first, then it branches.** Model: **hierarchical derivation**. The Reality Core holds the root secret; each child's key is derived from its parent's key and its own identity with a one-way function. A parent key can derive its descendants; a child key reveals nothing about its parent.
* A cryptx setting is the **encoding of an address**: the existing ring vocabulary already fits — `MasterKeySymbol / KeySymbol / Symbol` (place and type), `Time` (era), `State`, `Number`, `px / py / pz` (position), plus `typed password`. Decoding rings gives the address.
* **MasterKeySymbol** stays what `OMNICRYPTEXLAB_DESIGN.md` says: a deliberate skeleton-key failsafe factor, **not sufficient by itself**.
* A **codex** (the "book", like the Banjo-Kazooie spellbook): a record of realities the user has decoded or discovered. Proposed, not decided (open question 5).

## 6. States are overlays, perspectives are views

* A place has **one identity and one set of nodes**. A state supplies **overrides on top** of it: palette, sky, fog, particles, props, behaviours, and optionally extra content. Storage stays small and "same space, different dimension" is literally true.
* Initial states: digitized (default), wrecked / dystopian (for gamers), sandbox (testing builds), and eras (50s, 60s, 70s, 80s, 90s…). Eras are `@chronos(...)` perspectives; the others are `@state(...)`.
* **Inheritance**: a branch inherits its parent's state list and theme and may hide or add states.
* A user is taught the idea early: the lobby shows the same space under several channels.

## 7. Security: discovery is not authorization

The founder's requirement: a user can have access to the space but only in a **different reality of that space** (another time, another state).

* **Discovery / entry** = the cryptx (a capability-style key). Anyone holding a valid key can find and open the address it encodes.
* **Authorization** = **grants**, stored per context: `(subject, location subtree, allowed perspectives, mode rights)`. A grant can allow the location in only some perspectives (for example only `@state(sandbox)`, or only `@chronos(1990s)`), and says which perspective is the default.
* **Never rely on the cryptx alone for private enterprise branches.** A leaked code must not equal permission.
* Until a backend exists any check in the browser is **UX only, not security**. Real enforcement moves to the server with the database decision (see the backend discussion, 2026-10-12: managed backend behind a storage adapter, row-level rules on identity / context / perspective).

## 8. Lifecycle and modes ("the life cycle of nodes")

Some realities are **guarded by truth**: they cannot be edited, only confirmed. Others are operable.

| Mode | Behaviour |
|---|---|
| **Operable** | Editable; undo / history applies. |
| **Sealed (truth-guarded)** | No edits. Allowed actions: **confirm** (append a confirmation record). A change request creates a **new version** for confirmation; the old version is kept. Tied to Essence Data (truth state computed from evidence) and the product lifecycle tunnel (OmniStore build order item 9). |
| **Sandbox** | A private fork per user (copy-on-write over the same place). Changes never reach others. |

Who may confirm a sealed reality, and whether a sealed reality can ever be unsealed, are open (question 4).

First-person view ("a 3D Sims-like walk among the logical trees the user has access to") is a **camera mode on top of this**, planned for later. It is not part of the first infrastructure.

## 9. Where it plugs into the app (what exists)
* OmniNode already has "enter a space" (`_currentSpaceId`, `omni:enter-space-request`). Contexts reuse that idea.
* `OmniLandingRoom` is a hardcoded Cross-formation room: a reference for the MainLobby shell.
* The tunnels are where realities are **stationed** (founder): which tunnel hosts them is open (question 1).
* The store switcher (one context loaded, others unloaded) is the loading rule for contexts.
* OmniCityCore / OmniCorp exist only in `business-strategy.md`; there is no code. This is greenfield.

## 10. Proposed infrastructure build order (each step small and tested)
1. **Address model**: pure module: parse / serialise / validate / compare; typed segments, drawers, perspectives; round-trip tests; hostile-input tests; display form vs canonical form.
2. **OmniProductId registry**: id, symbol, name, perspective parameter schema (OmniChronos first).
3. **Context registry + persistence**: contexts, ordinals never reused, aliases on move; local adapter first (the same `OmniStorage` adapter that a backend will implement later).
4. **Enter / exit + breadcrumb** (the text tree shown as `Omni⟐City_Omni⟐StarHQ_MainLobby`) + the **MainLobby shell** with a spawn point; save the last address.
5. **Perspectives**: eye / layer stack UI; ConsciousHand lists the perspectives of the product OmniHand selected; state overlays (digital / wrecked / sandbox as palette-and-sky swaps first).
6. **Cryptx encode / decode of addresses** and hierarchical key derivation.
7. **Grants + modes** (operable / sealed / sandbox), enforced locally, shaped for server enforcement.
8. **City visuals** per state (the Mega Man Battle Network vibe).

## 11. Open questions
1. Which tunnel hosts the contexts: one tunnel with a station per context, or each hand's tunnel its own set? (The founder began answering "For now," — the message was cut off.)
2. The **type symbols** (core, branch, space…) and the perspective **eye symbols**: which glyphs? Reuse OmniSense glyphs?
3. Is the 8-drawer list and its order right? Should drawers exist on every context, or only some?
4. Sealed reality: **for now the owner is the only user and the only confirmer (decided 2026-10-12).** Multi-user confirmers and unsealing are deferred until there is a second user.
5. Codex ("the book"): yes or no, and what does it record?
6. Is the **sandbox** a private fork per user (assumed here; moot while there is one user)?
7. Are states global or defined per branch (assumed: the city defines them, branches inherit and may hide or add)?
8. Namespace marker: `0mni` (assumed). Keep `⟐` only for display (assumed).

## 12. Not built / known gaps
Built (V189): `utils/OmniAddress.js`, a pure parse / serialise / validate / tree-helper module with 95 jsdom-free node checks. Not built: OmniProductId registry, context registry, persistence, enter / exit, perspective UI, cryptx wiring, grants, server. Security statements above are design intent; nothing here is enforced anywhere yet.
