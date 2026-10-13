/**
 * ui/OmniExpressionPanelModules.js (V195, agent 2) — registers the OmniExpression panel parts in one place (main.js adds them with one call).
 *
 *   registry contents   'keysL' 'keysR' 'mixer' (ui/OmniExpressionPanel.js) and 'beatpad' (ui/OmniBeatPad.js) -> utils/OmniQuadrantRegistry.js
 *   OmniExpressionPanel ui/OmniExpressionPanel.js   nav 'OmniExpression' / event omni:expression-open   (keyboard; maximize = 4 quadrants; Split / Join)
 *   OmniBeatPad         ui/OmniBeatPad.js           nav 'OmniBeatPad'                                   (4x4 pads, also the 'beatpad' quadrant content)
 *
 * Imported lazily so a problem in one part is logged and never stops the app from starting. BaseScene.addModule() calls init() itself.
 */
export async function addExpressionPanelModules (base, omniNode = null) {
  const out = { panel: null, beatpad: null, registered: false }
  try {
    const { registerExpressionContents } = await import('./OmniExpressionPanel.js')
    out.registered = registerExpressionContents()
  } catch (err) { console.warn('⟐OmniExpression contents not registered:', err) }
  try {
    const { default: OmniExpressionPanel } = await import('./OmniExpressionPanel.js')
    out.panel = base.addModule(new OmniExpressionPanel())
  } catch (err) { console.warn('⟐OmniExpression panel not started:', err) }
  try {
    const { default: OmniBeatPad } = await import('./OmniBeatPad.js')
    out.beatpad = base.addModule(new OmniBeatPad(omniNode))
  } catch (err) { console.warn('⟐OmniBeatPad not started:', err) }
  return out
}
