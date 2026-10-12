# OmniAlphabet index — worksheet V01 (for the owner to index and hand back)

Date: 2026-10-12 · Status: **proposal, nothing built, no code reads this yet** · Related: `OMNISENSE_ALPHABET_AXIOMS_DESIGN.md`, `OMNICITY_DESIGN.md` (OmniProductId), `data/OmniCryptxTypes.js`.

## What exists today (cross-match result)
* **There is no letter-to-symbol table anywhere in the code.** Searched: ui/, data/, utils/, systems/, modules/. The only "alphabet" in code is OmniKeys (20 letter pages, page 1 = plain a-z; pages 2-20 blank "for the user to fill") and the cryptx `MasterKeySymbol / KeySymbol / Symbol` rings (a symbol picker, no fixed set).
* **Products have no individual symbols yet.** Almost every product and panel is prefixed with the same `⟐`. The only per-area symbols in the UI are the ribbon tabs: `✧` OmniStar, `▦` Home, `◧` Inspector, `⟐` Realities, `⚇` Hands (and `⚉` bottom hands, `⬢` tools, `☰` menu).
* **Axioms are an open set** (`OMNISENSE_ALPHABET_AXIOMS_DESIGN.md`): the alphabet must be appendable, never a closed enum. This worksheet therefore indexes **letters 1-26 as a starting slice**, not a complete list.
* The letter used below is the first letter **after "Omni"** (OmniStore = S), because every product starts with O.

## Worksheet: A-Z with a candidate symbol and what already starts with that letter
The "Candidate" column is **my placeholder suggestion**, plain Unicode geometric/technical symbols (no emoji) that avoid the symbols already used in the UI (✧ ▦ ◧ ⟐ ⚇ ⚉ ⬢ ◎ ☰) and the perspective eye ◉. Overwrite any of them. Fill the last two columns and hand the sheet back.

| Letter | Candidate symbol | Existing / designed products with this letter | Your symbol | Your index # |
|---|---|---|---|---|
| A | ▲ | OmniAxinator (built), OmniAction (planned / design only) | | |
| B | ◐ | OmniBrowser (built), OmniBrand (planned / design only) | | |
| C | ⬡ | OmniChronos (built), OmniCryptx (built), OmniCity (planned / design only), OmniCamera (planned / design only), OmniComplexity (planned / design only), OmniCommunication (planned / design only) | | |
| D | ✎ | OmniDraw (built) | | |
| E | ⇄ | OmniExchange (built), OmniExpressionator (built), OmniEmotionParticles (planned / design only) | | |
| F | ❖ | OmniFloor (built), OmniFeed (planned / design only) | | |
| G | ▥ | OmniGallery (built), OmniGlyph (planned / design only) | | |
| H | ⬣ | OmniHands (built) | | |
| I | ◨ | OmniInspector (built), OmniIdentity (planned / design only) | | |
| J | ⟡ | (nothing yet) | | |
| K | ⌨ | OmniKeys (built) | | |
| L | ⌖ | OmniLocus (planned / design only), OmniLandingRoom (planned / design only) | | |
| M | ♫ | OmniMixer (built), OmniMeter (built) | | |
| N | ⟁ | OmniNavi (built), OmniNotify (built), OmniNode (built), OmniNet (planned / design only) | | |
| O | ⭘ | (nothing yet) | | |
| P | ⬖ | OmniPlayer (built), OmniPresenter (built), OmniPocket (built), OmniProgram (built), OmniPlatform (planned / design only) | | |
| Q | ⟠ | (nothing yet) | | |
| R | ✦ | OmniRealities (planned / design only) | | |
| S | ◈ | OmniStore (built), OmniSelect (built), OmniSystemCreator (built), OmniStarLight (built), OmniSense (planned / design only), OmniSystemAnimator (planned / design only), OmniSystemDimensionalizer (planned / design only) | | |
| T | ⏱ | OmniTalent (built), OmniTranslator (built), OmniTargeting (built), OmniTruths (planned / design only) | | |
| U | ◇ | OmniUserCompass (built) | | |
| V | ◬ | OmniValue (built), OmniVisor (built), OmniVision (planned / design only) | | |
| W | ⌘ | (nothing yet) | | |
| X | ✕ | (nothing yet) | | |
| Y | ⟢ | (nothing yet) | | |
| Z | ◌ | (nothing yet) | | |

Collisions to resolve (several products share a letter): C (Chronos, Cryptx, Camera, Complexity, Communication, City), S (Store, Select, Sense, SystemCreator, StarLight, SystemAnimator, SystemDimensionalizer), P (Player, Pocket, Presenter, Program, Platform), T (Talent, Translator, Targeting, Truths), V (Value, Vision, Visor), N (Navi, Notify, Node, Net). Letters with nothing yet: F (only Feed/Floor), J, L (Locus/LandingRoom), Q, U, W, X, Y, Z.
**Recommendation:** the letter is a *family*, not a unique id. Give each product its own symbol and use the letter only for sorting and grouping.

## How I would index it (recommendation)
1. **Two separate things:** the **symbol** (what a user sees, any glyph) and the **index** (a stable integer that never changes, assigned once and never reused). The address and the cryptx store the index, the screen shows the symbol, so you can change a symbol later without breaking any saved address.
2. **Index by the product, not the letter.** A product keeps its index even if its name changes. Suggested ranges (open set, leave gaps): 1-99 core OS (OmniStar, OmniOS, OmniNet, OmniCity), 100-199 value (Store, Value, Exchange, Talent), 200-299 time (Chronos, Player), 300-399 scene tools, 400-499 hands and input, 500-599 knowledge (Sense, Glyph, Docs). Letters A-Z then only decide the default sort inside a range.
3. **Levels with sub/superscripts: yes, with one rule.** Unicode only has real super/subscript **digits** (⁰¹²³⁴⁵⁶⁷⁸⁹ and ₀₁₂₃₄₅₆₇₈₉) plus a few letters, so use them for **numbers only**:
   * **Subscript = level / depth of the product** (how deep into it you are): `◉₂` is OmniChronos at level 2. Subscript reads as "belongs below" which matches tree depth and the way chemistry and CAD number things.
   * **Superscript = version / variant / state** of the same product: `◉²` is the second variant. (If you prefer them the other way round, that is a one-line swap; just keep each meaning on one position.)
   * Both together: `◉₂³` = level 2, variant 3.
   * Always keep a plain ASCII twin for storage and URLs: `chronos.2.3` (product id, level, variant). The super/subscript form is **display only**, like the `⟐` in `0mni`. Some fonts draw sub/superscript digits too small or misaligned, which is the reason not to store them.
4. **Fit with the address (OMNICITY_DESIGN.md):** the perspective part `@chronos(1980s)` already begins with the product id; the product's symbol is its display form, so `@chronos` shows as `◉` with its level as a subscript when it is deeper than level 1. No change to the address grammar is needed.
5. **Fit with the cryptx:** the symbol rings (`MasterKeySymbol`, `KeySymbol`, `Symbol`) become pickers over this table; a ring setting stores the index, so a changed symbol never invalidates a key.

## Questions for you
1. Is "product level" what I assumed (depth inside the product), or the **maturity** of the product (draft / built / sealed)? The answer decides subscript vs. a separate badge.
2. Do you want the 26 letters indexed first (as in the sheet) or the products first (my recommendation)?
3. Should digits 0-9 get symbols as well, or stay plain numbers?
