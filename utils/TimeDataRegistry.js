/**
 * utils/TimeDataRegistry.js — "creating a node locks it to the
 * ruler"
 *
 * OmniTime was already named "not a clock, a spatial ruler" — this
 * is the real, shared map from a node's own id to its real TimeData,
 * matching the exact pattern already proven in
 * WordTickerRegistry.js/ChartDataRegistry.js. Every node gets a real
 * entry here the instant it's created — never optional.
 */

const registry = new Map()

export function lockToRuler (nodeId, timeData) {
  registry.set(nodeId, timeData)
}

export function unlockFromRuler (nodeId) {
  registry.delete(nodeId)
}

export function getTimeData (nodeId) {
  return registry.get(nodeId) ?? null
}

/** Every node currently on the ruler, with its id — the real
 *  mechanism the floor clock and any future cross-path correlation
 *  query against, rather than each reinventing its own lookup. */
export function getAllLocked () {
  return [...registry.entries()].map(([nodeId, timeData]) => ({ nodeId, timeData }))
}
