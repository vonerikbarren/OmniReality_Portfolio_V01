/**
 * ui/OmniVoxelModules.js — registers the V210 voxel modules in one place (main.js adds them with a single call)
 *   OmniVoxelSpace  the rooms, points, lines and routes + their drawing in the scene   (systems/OmniVoxelSpace.js)
 *   OmniVoxelPanel  ⟐OmniVoxel, the controls window                                    (ui/OmniVoxelPanel.js)
 * Order matters: the runtime registers Extra.SERVICES.voxel before the panel reads it.
 */
import OmniVoxelSpace from '../systems/OmniVoxelSpace.js'
import OmniVoxelPanel from './OmniVoxelPanel.js'

export function addVoxelModules (base, omniNode) {
  const space = base.addModule(new OmniVoxelSpace(base.context, omniNode))
  const panel = base.addModule(new OmniVoxelPanel())
  return { space, panel }
}
