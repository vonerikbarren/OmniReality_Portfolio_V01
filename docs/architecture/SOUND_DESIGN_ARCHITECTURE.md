# Sound Design Architecture — Foundational Spec

This document exists because sound is being treated here as a design
discipline with its own ontology, not as a set of UI decorations — the
same way The 32 gave the app's visual/structural logic a formal
vocabulary before anything got built on top of it. Nothing below is
implemented yet. This is the shape the system is agreed to have before
building starts — "baby steps" from here, intentionally.

## Why this needed its own document

The trigger: two commercial sound packs ("Boom" — one mechanical, one
modern-UI) are being brought in, and going through them raised
questions bigger than "where do these files go." The working premise,
stated directly in conversation and preserved here verbatim in spirit:

> This isn't a toy. This is hopefully next-gen software for
> communicating way more efficiently. Sound design can play such a
> huge role in this.

Two things follow from that premise that change the whole approach:

1. **Sound here is logical, not expressive.** Music moves you; what's
   being designed is closer to **earcons** — short, abstract, *functional*
   sounds that encode meaning, the audio equivalent of an icon (as
   distinct from an "auditory icon," which mimics the real-world sound
   of the thing it represents). The goal is communication efficiency,
   not mood, for the layers that carry meaning. (Mood still has a
   place — see Class 1 below — it's just not the same layer.)
2. **This is now explicitly an accessibility surface.** Once sound
   carries real semantic load instead of decoration, a rigorous enough
   system means someone navigating by ear alone — including blind
   users, and potentially opening the door to sound-based language
   communities — could actually use this app. That's not a bolt-on
   feature; it's the test of whether the system has real content or is
   just vibes. If a sound can't be told apart from another sound
   without looking at the screen, it has failed as a language, however
   good it sounds.

## The core problem: creative freedom is the danger *and* the opportunity

Going through the packs surfaced a real anxiety, worth stating
honestly: how complex should this get? There's unlimited creative
room — textures, stingers, signatures, borrowed cinematic tropes — and
no natural ceiling. The resolution isn't "pick one complexity level
for sound." It's recognizing that **sound is not one layer, it's
several, and each layer gets its own independent complexity budget.**
Game audio arrived at this same split decades ago (ambience beds vs.
one-shots vs. stingers vs. UI vs. voice); this spec adapts that
division to this app's actual vocabulary rather than importing it
wholesale.

## The four classes

### 1. Ambience / Field (texture)
Continuous, not discrete — doesn't fire on an event, it answers "where
am I." Tied to a Reality, a zone, a depth level. This is where the
expressive, exploratory, even beautiful instinct ("textures create a
field") belongs without contradicting the "logical, not expressive"
principle for the rest of the system — its job is mood and location,
not a message that has to land correctly every time.

- **Complexity budget: loose.** This layer can be as rich and varied as
  it wants to be, because nothing downstream depends on parsing it
  correctly.
- Likely sourced more from the mechanical pack if it leans textural/
  drone-heavy, but not assumed — decided per-file once the catalogue
  pass is further along.

### 2. Earcons (the semantic language)
The disciplined layer: a small, fixed vocabulary, each sound mapped
1:1 to one meaning, used identically everywhere that meaning applies.
This is the layer that is the actual communication-efficiency promise,
and the layer a non-sighted user depends on most directly.

- **Complexity budget: hard ceiling, not a style choice.** Real earcon
  research (screen-reader design, cockpit alerting, the original
  Blattner/Sumikawa line of work) converges on the same finding:
  people can reliably hold a few dozen distinct, non-confusable short
  sounds in working memory under real-time pressure — not hundreds.
  Past that ceiling, the set stops being a language and becomes noise
  with vibes. Scope this class to what a first-time blind user could
  actually learn and not confuse, and treat that as the real
  constraint, not an arbitrary minimalism preference.
- Needs a literal, versioned mapping table eventually (sound ↔
  meaning, one row each) — the sound-design equivalent of
  `THE_32_REVISED_PROPOSAL.md`. Not written yet; this doc just reserves
  the slot.

### 3. Event SFX / Feedback Stingers
Discrete like an earcon (fires on a specific event) but carries more
personality/texture, because it's feedback about an *action*, not
navigation through a *space*. This is the "gaming mechanics" layer
noticed directly while going through the Modern UI pack: entering/
leaving a scene, did-something-right, did-something-wrong,
did-something-unexpected.

- **Complexity budget: moderate.** A handful of reusable archetypes
  (success / fail / warning / surprise / neutral-confirm) applied
  consistently across many contexts, rather than a bespoke sound per
  action. Bespoke-per-action is both harder to learn and not
  meaningfully more useful than well-chosen reuse.

### 4. Entity Signatures (composite, not independent)
Not a fifth sound set — an emergent property of Classes 2 and 3 being
applied consistently. A Reality, a node type, or an axiom gets a
recognizable signature when the *same* earcon/stinger is voiced
through the *same* timbre/texture family every time that entity is
involved (the reference point raised in conversation: Arcane's
hextech devices are recognizable by ear before the visual confirms
them — the device's sonic identity is consistent across every
interaction with it, with variations in that identity meaningfully
signaling that something about the object changed).

- No separate budget — it inherits the discipline of whichever class
  it's built from.

### Cross-cutting: the "decorative vs. semantic" split
Separately from the four classes above, every individual sound file
gets tagged by **role**, not just class:

- `role: semantic` — carries meaning; subject to the discipline of
  whichever class it belongs to.
- `role: decorative` — exists because it sounds good (the "SFX for the
  sound" instinct, which is legitimate and shouldn't be suppressed,
  just kept separate).

This tag matters specifically so decorative sounds don't quietly drift
into meaning-bearing slots over time without a decision being made —
that drift is exactly how real-world earcon systems degrade.

## Borrowed sonic tropes (a note for Class 2/3, not yet formalized)

Raised in conversation and worth preserving: sounds like reverse
playback, vinyl/tape static, or a pitch-bent power-down already carry
fixed cultural meaning from decades of film and game sound design
(reverse = temporal anomaly/undo, static = old/distant/degraded,
downshift = failure/collapse). The proposal on the table is to adopt a
small, deliberately limited set of these, bind each one to exactly one
meaning inside this app's vocabulary, and never reuse it for anything
else — turning a borrowed effect into a fixed word in the Class 2
language. **Not decided yet**: the actual fixed list and each one's
permanent meaning. That's a real content decision for a follow-up
pass, not something to improvise file-by-file while cataloguing packs.

## Open question: does this need a sound-equivalent of The 32?

Floated but not resolved — whether Class 2's meaning set should be
authored independently, or deliberately mapped onto the existing axiom
system (Begin → open-family sounds, End → close-family, Change →
transition/trope sounds, etc.) so that everything in the app
ultimately resolves to the same 32 meanings regardless of modality.
Attractive for conceptual unity; not assumed, because Class 2's real
constraint (human short-term memory for a few dozen sounds) may not
divide cleanly across 32 categories. Worth a dedicated pass once the
pack catalogue is further along, not before.

## Architecture / performance (so this doesn't stump the app)

Noted as an explicit constraint alongside the content design, not an
afterthought — raised directly: however this gets organized, it can't
come at the cost of runtime performance. Today's system (for
reference) is a flat 3-ID map (`click`/`open`/`close`) hardcoded in
`main.js`, loaded via Howler.js through `utils/SoundManager.js`, with
only global volume/mute and no manifest. That shape does not survive
a library that's about to grow by orders of magnitude. Direction
(not yet built):

- **Manifest-driven, not hardcoded.** A JSON manifest per theme/pack
  rather than editing `main.js`'s constructor call per sound.
- **Theme-swappable.** Decouple the semantic ID (`ui.panel.open`) from
  the physical file — the same event can resolve to a mechanical or a
  modern-UI file depending on an active theme setting. Doubles as a
  real feature for a white-label template: a site built from this
  template could ship its own sound theme.
- **Lazy-loaded per theme/category**, not all packs loaded at boot —
  necessary once this is hundreds of files instead of 3.
- **Variation pools** (array of files per ID, picked randomly/round-
  robin) for Class 3 especially, to avoid repetition fatigue — common
  in commercial UI packs for exactly this reason.
- **Per-category volume**, not just global — Class 1 (ambience), Class
  2 (earcons), and Class 3 (stingers) likely want independent mix
  levels, the same split games use for Music/SFX/Voice. No sound
  settings panel exists anywhere in the app today; one is a real gap
  either way.

None of this is built yet. This section exists so the eventual build
doesn't have to re-derive these constraints from scratch.

## Proposed next steps (in order, not yet started)

1. Finish the pack catalogue pass (in progress) and sort entries by
   class (1–4) and role (semantic/decorative) as they're found.
2. Draft the actual Class 2 mapping table (sound ↔ fixed meaning) —
   the highest-stakes, smallest-margin-for-error piece.
3. Decide the borrowed-trope list for Class 2/3 (reverse, static,
   pitch-bend, etc.) and lock each one's permanent meaning.
4. Resolve the "does Class 2 map onto The 32" question.
5. Only then: manifest format, SoundManager changes (theme-swap,
   per-category volume, variation pools, lazy loading), settings panel.

A cross-review of this spec with the project's other collaborating
assistants (Copilot, Gemini) was raised as worth doing given how
foundational this is intended to be — noted here as an intent, not
scheduled yet.

## Status

Design-stage only. No code, manifest, or file reorganization has been
built against this spec yet. This document is the agreed shape to
build toward once the catalogue and the Class 2 mapping table (steps 1
and 2 above) are further along.
