import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
test('LogicalExpression is wired: module, panel, ribbon, commands, landing hook', () => {
  const m = src('ui/OmniRemixModules.js'); assert.ok(m.includes('new OmniLogicalExpression(') && m.includes('new OmniLogicalExpressionPanel('))
  assert.ok(src('ui/OmniRibbon.js').includes('omni:logical-expression-panel'))
  for (const a of ['play', 'set', 'derive', 'skip']) assert.ok(src('systems/OmniLangCommands.js').includes(`registerOmni('LogicalExpression', '${a}'`), a)
  const s = src('systems/OmniLogicalExpression.js'); assert.ok(s.includes("'omni:user-landed'") && s.includes('gate=off') && s.includes('Space'))
  assert.ok(src('utils/OmniExtraKinds.js').includes('logicalexpression: null'))
})
