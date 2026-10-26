/**
 * utils/OmniLogRegistry.js — every real OmniLog entry's own raw
 * data (title/html/transform), keyed by its real group node id
 *
 * Needed so a submitted entry can genuinely be re-opened for editing
 * later — OmniLogPagesPanel only holds the paginated, rendered
 * output, not the original, editable source, so something has to
 * remember the real source separately. Same real, established
 * registry pattern already used for ChartDataRegistry/
 * JsonifierRegistry, matching that precedent rather than inventing
 * a new one.
 */

const entries = new Map()

export function registerLogEntry (nodeId, { title, html, transform }) {
  entries.set(nodeId, { title, html, transform })
}

export function getLogEntry (nodeId) {
  return entries.get(nodeId) ?? null
}

export function unregisterLogEntry (nodeId) {
  entries.delete(nodeId)
}
