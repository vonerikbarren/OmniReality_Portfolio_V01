// Every .js file in the app parses (node --check). Catches a stray brace in a file no other test imports.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { walk, rel } from './helpers.mjs'

const files = walk()
const check = (f) => new Promise((res) => { let err = ''; const p = spawn(process.execPath, ['--check', f]); p.stderr.on('data', d => { err += d }); p.on('close', (code) => res(code === 0 ? null : rel(f) + ': ' + (err.split('\n').find(l => /Error/.test(l)) ?? err.slice(0, 120)))) })

test(`syntax: ${files.length} files parse`, async () => {
  const bad = []; const queue = [...files]
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) { const r = await check(queue.shift()); if (r) bad.push(r) } }))
  assert.deepEqual(bad, [])
})
