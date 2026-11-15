import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')
test('OmniSense is wired: module, panel, services, ribbon, commands', () => {
  const m = src('ui/OmniRemixModules.js'); assert.ok(m.includes('new OmniSense(') && m.includes('new OmniSensePanel('))
  assert.ok(src('utils/OmniExtraKinds.js').includes('omnisense: null'))
  assert.ok(src('ui/OmniRibbon.js').includes('omni:omnisense-panel'))
  for (const a of ['open', 'close', 'view', 'von']) assert.ok(src('systems/OmniLangCommands.js').includes(`registerOmni('Sense', '${a}'`), a)
  const s = src('systems/OmniSense.js'); assert.ok(s.includes('SERVICES.orbit') && s.includes('omni:voxel-changed') && s.includes("'omni:omnisense:v1'"))
})
