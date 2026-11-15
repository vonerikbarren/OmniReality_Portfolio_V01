import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
test('MultiVideo kind is wired in every place an extra kind needs', () => {
  const k = src('utils/OmniExtraKinds.js')
  for (const needle of ['KIND_MULTI_VIDEO =', 'GEO_MULTI_VIDEO =', 'multivideo:', 'buildMultiVideoMesh', 'releaseMultiVideoMesh', 'sanitizeMultiVideo']) assert.ok(k.includes(needle), needle)
  assert.ok(/EXTRA_KINDS = \[[^\]]*KIND_MULTI_VIDEO/.test(k)); assert.ok(/isExtraKind[^\n]*KIND_MULTI_VIDEO/.test(k))
  assert.ok(src('utils/OmniScanModel.js').includes('multiVideoNode'))
  const i = src('ui/OmniExtraKindInspector.js'); assert.equal(i.split('KIND_MULTI_VIDEO').length - 1, 2)
  assert.ok(src('ui/OmniRemixModules.js').includes('new OmniMultiVideo(') && src('ui/OmniRemixModules.js').includes('new OmniMultiVideoEditor('))
  assert.ok(src('ui/OmniRibbon.js').includes('omni:multivideo-node-create'))
  for (const a of ['create', 'clip', 'key', 'text', 'play', 'edit']) assert.ok(src('systems/OmniLangCommands.js').includes(`registerOmni('MultiVideo', '${a}'`), a)
})
test('the editor text is free of emoji (escapes only)', () => { for (const f of ['ui/OmniMultiVideoEditor.js', 'ui/OmniMultiVideoInspector.js']) assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(src(f)), f) })
test('the N-key picker offers the MultiVideo node and creates it', () => {
  const p = readFileSync(new URL('../ui/OmniDrawModePicker.js', import.meta.url), 'utf8')
  assert.ok(p.includes('data-mode="multivideo"')); assert.ok(p.includes("'multivideo'")); assert.ok(p.includes('omni:multivideo-node-create'))
})
