import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

test('LH and RH get a tunnel satellite, mirrored, and the other two pads do not', () => {
  const src = read('ui/MovementPad.js')
  assert.match(src, /const _rolesOf = \(hand\) => \(hand === 'lh' \|\| hand === 'rh' \? \[\.\.\._SAT_ROLES, 'tunnel'\] : _SAT_ROLES\)/)
  const ang = (obj) => { const m = new RegExp(obj + ':\\s*\\{[^}]*tunnel:\\s*([\\d.]+)').exec(src); return m && Number(m[1]) }
  const lh = /_SAT_ANGLES = \{\s*lh:\s*\{[^}]*tunnel: ([\d.]+) \}/.exec(src), rh = /\n  rh:\s*\{ release: 270[^}]*tunnel: ([\d.]+) \}/.exec(src)
  assert.ok(lh && rh, 'angles found'); assert.equal(360 - Number(lh[1]), Number(rh[1]), 'RH mirrors LH')
  assert.ok(Number(lh[1]) < 90 && Number(lh[1]) > 0, 'one step before Release, not on top of the other four')
  assert.match(src, /\.omni-pad-sat--lh-tunnel, \.omni-pad-sat--rh-tunnel \{ display: none !important; \}/, 'hidden on a phone')
  assert.match(src, /tunnelHand \? \{\} : \{ tunnel:/, 'only the pads that lack a tunnel button get one')
  assert.match(src, /omni:hand-tunnel-toggle/)
})
test('Axinator answers the toggle for any tunnel of the hand, ribbon and command exist', () => {
  assert.match(read('systems/OmniAxinator.js'), /_onHandTunnelToggle[\s\S]*t\.def\.padHand === hand\) this\.activateTunnel\(t\.id\)/)
  const rib = read('ui/OmniRibbon.js'); assert.match(rib, /b\('tunnel-lh'/); assert.match(rib, /b\('tunnel-rh'/); assert.match(rib, /omni:axinator-tunnel-visible/)
  assert.match(read('systems/OmniLangCommands.js'), /registerOmni\('Tunnel', 'toggle'/)
})
