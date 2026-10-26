/**
 * data/OmniUserWellness.js — the 14 Dimensions of Wellness
 *
 * Given directly, in this order (one typo — "Netowrk" — corrected to
 * "Network"): Life, Financial, Spiritual, Mental, Physical, Social,
 * Emotional, Sexual, Political, Network, Educational, Professional,
 * National, International.
 *
 * Each dimension gets a real, user-set rating, 0-100 — a plain,
 * intuitive scale, since no specific scale was given; a real design
 * choice made explicitly, not hidden, and easy to change later.
 */

export const WELLNESS_DIMENSIONS = [
  'Life', 'Financial', 'Spiritual', 'Mental', 'Physical', 'Social',
  'Emotional', 'Sexual', 'Political', 'Network', 'Educational',
  'Professional', 'National', 'International',
]

export function buildDefaultWellness () {
  const wellness = {}
  WELLNESS_DIMENSIONS.forEach(dim => { wellness[dim] = 50 })   // neutral midpoint default, not zero — zero would read as "already failing" for a dimension nobody has set yet
  return wellness
}
