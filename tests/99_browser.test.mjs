// The real-browser smoke test, as part of `node --test`. Off by default (it needs a browser and takes about 2 minutes): set OMNI_BROWSER=1 after `npm install && npm run vendor` in tests/browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { ROOT } from './helpers.mjs'

test('browser smoke', { skip: process.env.OMNI_BROWSER ? false : 'set OMNI_BROWSER=1 to run (needs tests/browser deps)', timeout: 600000 }, () => {
  const r = spawnSync(process.execPath, ['run.mjs'], { cwd: path.join(ROOT, 'tests', 'browser'), encoding: 'utf8', timeout: 580000 })
  assert.equal(r.status, 0, (r.stdout || '').split('\n').filter(l => /FAILED|PAGEERROR|HARNESS|passed/.test(l)).join('\n') || r.stderr)
})
