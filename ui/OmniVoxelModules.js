/**
 * ui/OmniVoxelModules.js — registers the V210 voxel modules in one place (main.js adds them with a single call)
 *   OmniVoxelSpace  the rooms, points, lines and routes + their drawing in the scene   (systems/OmniVoxelSpace.js)
 *   OmniAvatar      the capsule that travels the lines + the follow camera              (systems/OmniAvatar.js)
 *   OmniVoxelPanel  ⟐OmniVoxel, the controls window                                    (ui/OmniVoxelPanel.js)
 * Order matters: the runtime registers Extra.SERVICES.voxel before the panel reads it.
 */
import OmniVoxelSpace from '../systems/OmniVoxelSpace.js'
import OmniVoxelPanel from './OmniVoxelPanel.js'
import OmniAvatar from '../systems/OmniAvatar.js'

export function addVoxelModules (base, omniNode, getControls = () => null) {
  const space = base.addModule(new OmniVoxelSpace(base.context, omniNode))
  const avatar = base.addModule(new OmniAvatar(base.context, () => space, getControls))   // V214: the capsule avatar + the follow camera
  const panel = base.addModule(new OmniVoxelPanel())
  return { space, avatar, panel }
}
