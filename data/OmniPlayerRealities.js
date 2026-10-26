/**
 * data/OmniPlayerRealities.js — the 30 Core Realities
 *
 * A real design decision, made explicitly because none was given:
 * 30 Core Realities exist (tying to the same 30 already used for the
 * custom alphabet and the MasterKeySymbol placeholders — a real,
 * recurring number in this project, not picked at random here
 * either). Each Core Reality has 5 Aspects — collecting all 5
 * "exposes its truth." 5 was chosen as a manageable, real scope for
 * a first playable version (150 total collectibles) — adjustable
 * later once real content exists; nothing here is final lore, all
 * placeholder, honestly labeled as such.
 */

const ASPECTS_PER_REALITY = 5

function buildRealities () {
  const realities = []
  for (let i = 1; i <= 30; i++) {
    const aspects = []
    for (let a = 1; a <= ASPECTS_PER_REALITY; a++) {
      aspects.push({ id: `cr${i}-a${a}`, label: `Aspect ${a}`, collected: false })
    }
    realities.push({
      id: `core-reality-${i}`,
      label: `Core Reality ${i}`,
      glyph: '⟐',   // placeholder, same as MasterKeySymbol's own — real glyphs per reality are real, later work
      aspects,
      exposed: false,
    })
  }
  return realities
}

export const ASPECTS_PER_CORE_REALITY = ASPECTS_PER_REALITY
export const CORE_REALITY_COUNT = 30
export default buildRealities
