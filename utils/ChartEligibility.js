/**
 * utils/ChartEligibility.js — the real, shared chart-eligibility
 * detection, extracted specifically so OmniJsonifier's own tree-
 * walker and OmniDrawCell's own standalone creation panel share one
 * real implementation, not two.
 *
 * Supports both real shapes: a single series (every child a plain
 * number, e.g. `sales: { Jan: 12000, Feb: 15500 }`) and multiple
 * series (every child itself an all-numeric-leaf group, e.g.
 * `salesByProduct: { OmniDraw: {...}, OmniCryptx: {...} }`). Both
 * resolve to the same real seriesData shape either way, so
 * OmniCellPanel never needs to know which case it's looking at.
 */

export function detectSeriesData (key, value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value)
  if (entries.length === 0) return null

  const isNumeric = (v) => typeof v === 'number'
  if (entries.every(([, v]) => isNumeric(v))) {
    return { [key]: Object.fromEntries(entries) }
  }

  const isNumericGroup = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.entries(v).length > 0 && Object.values(v).every(isNumeric)
  if (entries.every(([, v]) => isNumericGroup(v))) {
    return Object.fromEntries(entries.map(([seriesName, seriesObj]) => [seriesName, seriesObj]))
  }

  return null
}
