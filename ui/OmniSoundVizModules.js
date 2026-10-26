/**
 * ui/OmniSoundVizModules.js — registers the V194 sound particles and the two sound viewers in one place (main.js adds them with a single call)
 *
 *   OmniSoundParticles               systems/OmniSoundParticles.js            a THREE.Points cloud per node with sound + particles (no new WebGL context)
 *   OmniSoundViewerPanel             ui/OmniSoundViewerPanel.js               ⟐SoundViewer          (class-A window, 2D canvas)
 *   OmniSoundParticleViewerPanel     ui/OmniSoundParticleViewerPanel.js       ⟐SoundParticleViewer  (class-A window, 2D canvas)
 *
 * The modules are imported here, lazily, so that a problem in one of them (for example the sound engine failing to load on a very old
 * browser) is logged and never stops the rest of the app from starting. Opened by the nav items above, the ribbon Home > Sound group and
 * OmniStarLight ('Sound viewer', 'Particle viewer'). BaseScene.addModule() calls init() itself; nothing here calls it again.
 */

export async function addSoundVizModules (base, omniNode) {
  const out = { particles: null, viewer: null, particleViewer: null }
  try {
    const { default: OmniSoundParticles } = await import('../systems/OmniSoundParticles.js')
    out.particles = base.addModule(new OmniSoundParticles(base.context, omniNode))
  } catch (err) { console.warn('⟐ sound particles not started:', err) }
  try {
    const { default: OmniSoundViewerPanel } = await import('./OmniSoundViewerPanel.js')
    out.viewer = base.addModule(new OmniSoundViewerPanel(omniNode))
  } catch (err) { console.warn('⟐SoundViewer not started:', err) }
  try {
    const { default: OmniSoundParticleViewerPanel } = await import('./OmniSoundParticleViewerPanel.js')
    out.particleViewer = base.addModule(new OmniSoundParticleViewerPanel(omniNode))
  } catch (err) { console.warn('⟐SoundParticleViewer not started:', err) }
  return out
}
