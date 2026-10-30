// Every pure module (utils/ and data/ that do not need three / gsap / the DOM) imports cleanly and exports something.
// Modules that import three / gsap (directly or through a neighbour) are listed in NEEDS_BROWSER and are covered by tests/browser/.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { walk, rel, imp, shimBrowser } from './helpers.mjs'

shimBrowser()
const files = walk().filter(f => /\/(utils|data)\//.test(f.split('\\').join('/')))
const needsBrowser = (f) => /from '(three|gsap|d3|d3-sankey|jszip)(\/[^']*)?'/.test(fs.readFileSync(f, 'utf8'))

test('pure modules import and export', async (t) => {
  const failed = []; let ok = 0; let skipped = 0
  for (const f of files) {
    if (needsBrowser(f)) { skipped++; continue }
    try { const m = await import(new URL('file://' + f).href); if (!Object.keys(m).length) failed.push(rel(f) + ': no exports'); else ok++ } catch (e) {
      // a pure module that imports a browser-needing neighbour fails here with a bare-specifier error: that is expected, not a bug
      if (/Cannot find package '(three|gsap|d3|d3-sankey|jszip)'|ERR_MODULE_NOT_FOUND.*(three|gsap)/.test(String(e.message))) skipped++
      else failed.push(rel(f) + ': ' + String(e.message).split('\n')[0])
    }
  }
  t.diagnostic(`${ok} imported, ${skipped} need a browser`)
  assert.deepEqual(failed, [])
  assert.ok(ok > 80, `expected many pure modules, got ${ok}`)
})
