/**
 * utils/WordTickerRegistry.js — the real lookup OmniCommunicationPanel
 * needs to find "the ticker for this selected node"
 *
 * A genuine problem this solves: tickers are created inside whichever
 * panel made them (OmniDraw(Dynamic), OmniJsonifier), each keeping
 * its own private array. OmniCommunicationPanel needs to reach any
 * of them given only a selected node's id — this is the one, shared,
 * global place that mapping actually lives, keyed by real node id,
 * not fragile position-matching.
 */

const registry = new Map()   // nodeId -> WordTicker

export function registerTicker (nodeId, ticker) {
  registry.set(nodeId, ticker)
}

export function unregisterTicker (nodeId) {
  registry.delete(nodeId)
}

export function getTicker (nodeId) {
  return registry.get(nodeId) ?? null
}
