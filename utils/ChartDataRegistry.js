/**
 * utils/ChartDataRegistry.js — the real lookup OmniCellPanel needs
 * to find "the chart data for this selected node"
 *
 * Same real pattern as utils/WordTickerRegistry.js — a shared,
 * global map from a real node id to its chart data, so any panel
 * holding only a selected mesh can find the right data without
 * fragile matching.
 *
 * Each entry: { seriesData, seriesVisibility, chartType }
 *   seriesData: { seriesName: { label: value, ... }, ... } — even a
 *     single-series chart is stored as one series under one key, so
 *     both shapes share the same real structure, not two.
 *   seriesVisibility: { seriesName: boolean } — the real toggle state.
 *   chartType: 'bar' | 'line'
 */

const registry = new Map()

export function registerChart (nodeId, entry) {
  registry.set(nodeId, entry)
}

export function unregisterChart (nodeId) {
  registry.delete(nodeId)
}

export function getChart (nodeId) {
  return registry.get(nodeId) ?? null
}
