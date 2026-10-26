/**
 * ui/OmniTimeDataRulerModules.js — registers the V192 TimeData ruler UI in one place (main.js adds them with a single call)
 *
 *   TimeDataRulerPanel          the vertical ruler window                  (ui/TimeDataRulerPanel.js)
 *   TimeDataRulerSettingsPanel  its user settings window (Admin)           (ui/TimeDataRulerSettingsPanel.js)
 *
 * It also puts the two entries into the indexed panels without touching their config in main.js:
 *   ⟐Times slot (first free)  TimeDataRuler            ⟐Admin slot (first free after the fixed ones)  TimeDataRulerSettings
 * BaseScene.addModule() calls init() itself; nothing here calls it again.
 */

import TimeDataRulerPanel, { NAV_ITEM as RULER_NAV } from './TimeDataRulerPanel.js'
import TimeDataRulerSettingsPanel, { NAV_ITEM as SETTINGS_NAV } from './TimeDataRulerSettingsPanel.js'
import { registerExtraSlot } from './IndexedPanel.js'

const nav = (item) => () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item } }))

export function addTimeDataRulerModules (base) {
  registerExtraSlot('times', { label: 'TimeDataRuler', onClick: nav(RULER_NAV) }, 1)
  registerExtraSlot('admin', { label: 'TimeDataRulerSettings', onClick: nav(SETTINGS_NAV) }, 21)
  const ruler = base.addModule(new TimeDataRulerPanel())
  const settings = base.addModule(new TimeDataRulerSettingsPanel())
  return { ruler, settings }
}
