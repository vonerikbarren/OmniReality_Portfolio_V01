/**
 * utils/JsonifierRegistry.js — every real, currently-active
 * OmniJsonifier instance, tracked in one shared place
 *
 * Needed the moment more than one real Jsonifier instance can exist
 * at once (the standalone drawer panel, plus each SectionCarousel's
 * own dedicated instance) — something needs a real way to find
 * which one, if any, actually owns a given selected node's tree,
 * since each instance's own tree is otherwise completely private to
 * it. Matches the same real, established pattern already used for
 * WordTickerRegistry/ChartDataRegistry.
 */

const instances = new Set()

export function registerJsonifier (instance) {
  instances.add(instance)
}

export function unregisterJsonifier (instance) {
  instances.delete(instance)
}

/** The real, actual mechanism Q3 needs — searches every currently
 *  registered instance's own real tree for a node with this id,
 *  returning both the node and the specific instance that owns it,
 *  or null if the selected node isn't part of any Jsonifier tree at
 *  all (e.g. a plain Static-created node). */
export function findOwnerOf (nodeId) {
  for (const jsonifier of instances) {
    if (!jsonifier._tree) continue
    const node = jsonifier._findNode(jsonifier._tree, nodeId)
    if (node) return { jsonifier, node }
  }
  return null
}

/** Every real, currently-active instance — the real mechanism a
 *  genuine "reset everything" admin action needs, to clear every
 *  section's own tree at once, not just whichever one happens to be
 *  open right now. */
export function getAllJsonifiers () {
  return [...instances]
}
