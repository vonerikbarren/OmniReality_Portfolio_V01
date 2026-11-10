import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
test('Take Me There has a slight, adjustable start delay (default 0.15 s, 0 = none)', () => {
  assert.match(read('utils/CameraTravelSettings.js'), /delay: 0\.15/)
  const t = read('utils/CameraTravel.js'); assert.match(t, /gsap\.delayedCall\(wait/); assert.match(t, /pending\?\.kill\(\)/, 'a newer travel replaces a waiting one'); assert.match(t, /Math\.min\(2, Math\.max\(0/)
  assert.match(read('ui/CameraTravelSettingsPanel.js'), /id="cts-delay"/)
})
