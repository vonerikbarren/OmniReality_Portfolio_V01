/** ui/OmniDimensionsModules.js — registers the V217 modules: axioms, dimensional nodes, spaces, then the panel. */
import OmniAxioms from '../systems/OmniAxioms.js'
import OmniDimensionalNodes from '../systems/OmniDimensionalNodes.js'
import OmniDimensionalSpaces from '../systems/OmniDimensionalSpaces.js'
import OmniDimensionsPanel from './OmniDimensionsPanel.js'
export function addDimensionsModules (base, omniNode, opts = {}) {
  const axioms = base.addModule(new OmniAxioms(base.context))
  const spaces = base.addModule(new OmniDimensionalSpaces(base.context, omniNode))
  const nodes = base.addModule(new OmniDimensionalNodes(base.context, omniNode, opts))
  const panel = base.addModule(new OmniDimensionsPanel())
  return { axioms, spaces, nodes, panel }
}
