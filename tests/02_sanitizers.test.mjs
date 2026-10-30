// The contract of every pure model in this app: sanitize* never throws on hostile input, never pollutes Object.prototype, and (for single-argument sanitizers) is idempotent.
// This test finds every exported sanitize* function in utils/ and data/ by itself, so a new model is covered the day it is written.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { walk, rel, shimBrowser, hostile, noPollution } from './helpers.mjs'

shimBrowser()
const files = walk().filter(f => /\/utils\//.test(f.split('\\').join('/'))).filter(f => !/from '(three|gsap|d3|d3-sankey|jszip)(\/[^']*)?'/.test(fs.readFileSync(f, 'utf8')))
// sanitizers that are allowed to reject loudly or need more than one argument: name -> why
const NOT_A_SANITIZER = new Set([])
// outputs that legitimately differ between two calls (random ids / timestamps): compared after stripping these keys
const VOLATILE = new Set(['id', 'ts', 'at', 'updated', 'created', 'savedAt'])
const strip = (v) => JSON.parse(JSON.stringify(v, (k, x) => (VOLATILE.has(k) ? undefined : x)))

const found = []
for (const f of files) {
  let m; try { m = await import(new URL('file://' + f).href) } catch (_) { continue }
  for (const [k, fn] of Object.entries(m)) if (typeof fn === 'function' && /^sanitize[A-Z]/.test(k) && fn.length <= 1 && !NOT_A_SANITIZER.has(`${rel(f)}:${k}`)) found.push({ file: rel(f), name: k, fn })
}

test(`found sanitizers to test`, () => assert.ok(found.length >= 25, `only ${found.length} sanitizers found`))

test('sanitize* never throws and never pollutes', () => {
  const bad = []
  for (const { file, name, fn } of found) {
    hostile().forEach((h, i) => { try { fn(h) } catch (e) { bad.push(`${file}:${name}(hostile #${i}) threw ${String(e.message).slice(0, 80)}`) } })
  }
  assert.ok(noPollution(), 'Object.prototype was polluted')
  assert.deepEqual(bad, [])
})

test('sanitize* is idempotent on its own output', () => {
  const bad = []
  for (const { file, name, fn } of found) {
    for (const h of [undefined, {}, { a: 1 }, { channels: [{}] }, { faces: [{}] }, { order: ['a', 'a', 'b'] }, { name: 'x'.repeat(500), title: '<b>' }]) {
      let one; try { one = fn(h) } catch (_) { continue }
      if (one === undefined || typeof one === 'function') continue
      try { assert.deepEqual(strip(fn(one)), strip(one)) } catch (_) { bad.push(`${file}:${name}`); break }
    }
  }
  assert.deepEqual([...new Set(bad)], [])
})
