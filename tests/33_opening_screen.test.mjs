// V276: static checks on the opening screen: light defaults, the version label, the gate wiring, and that the boot script and the models agree.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, shimBrowser, imp } from './helpers.mjs'

shimBrowser()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const html = read('index.html'), boot = read('boot/OmniStarBoot.js'), main = read('main.js')
const Dev = await imp('utils/DevOmniStarIntroSettings.js')
const Gate = await imp('utils/OmniGateSettings.js')

test('the version label is one string at the bottom right', () => {
  assert.match(html, /<div id="boot-version">OmniOS_sandbox_A00_V276<\/div>/)
  assert.match(html, /#boot-version \{[^}]*right: 14px; bottom: 10px/)
})

test('the opening screen is LIGHT by default, in the boot script and in the dev model', () => {
  const m = /var INTRO_DEFAULTS = \{([^}]*)\}/.exec(boot)[1]
  const val = (k) => new RegExp(k + ": '(#[0-9a-f]{6})'").exec(m)[1]
  assert.equal(val('bg'), '#ffffff'); assert.equal(val('starColor'), '#000000'); assert.equal(val('shootColor'), '#000000')
  assert.equal(Dev.DEFAULTS.bg, val('bg')); assert.equal(Dev.DEFAULTS.starColor, val('starColor')); assert.equal(Dev.DEFAULTS.shootColor, val('shootColor'))
  assert.match(html, /background: var\(--boot-bg, #fff\)/)
})

test('the boot script and the gate settings agree on key, overall opacity and the rainbow switch', () => {
  assert.ok(boot.includes(`'${Gate.STORAGE_KEY}'`))
  assert.equal(Gate.DEFAULTS.overall, 0.68)
  assert.match(boot, /overall: 0\.68, bar: 'plain', reduceMotion: false, look: null/)
  assert.match(boot, /Math\.min\(1, Math\.max\(0\.3, n\)\)/)       // same clamp as the model (0.3 .. 1)
  assert.match(html, /--boot-overall, 0\.68/)
  assert.equal(Gate.DEFAULTS.bar, 'plain'); assert.ok(Gate.BARS.includes('rainbow'))
  assert.match(html, /\.boot-progress-bar\.is-rainbow/)
})

test('Enter starts a fall from twice the old height and holds at the old one', () => {
  assert.match(main, /const GATE_START_Y = 2000, GATE_HOLD_Y = 1000/)
  assert.match(main, /cam\.position\.set\(0, gateOn \? GATE_START_Y : GATE_HOLD_Y, 0\.001\)/)
  assert.match(main, /openGateForm\(\{ title:/)
  assert.match(main, /paused: gateOn/)
  assert.match(main, /window\.self !== window\.top\) return false/)    // an embedded copy never asks
  assert.match(main, /gate=off/)
})

test('the gate pieces stay user-facing and local: no dev import, no CDN, no emoji presentation selector', () => {
  for (const f of ['ui/OmniGateGear.js', 'ui/OmniGateForm.js', 'utils/OmniGate.js', 'utils/OmniGateSettings.js', 'utils/OmniSpaces.js', 'utils/OmniKeyGlyphs.js']) {
    const t = read(f)
    assert.ok(!/DevOmniStarIntro/.test(t.replace(/\/\*[\s\S]*?\*\//g, '')), f + ' imports a dev module')
    assert.ok(!/https?:\/\//.test(t.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), f + ' mentions a URL')
    assert.ok(!/️/.test(t), f + ' has an emoji variation selector')
  }
  assert.ok(!/cdn\.|jsdelivr|unpkg/.test(boot.replace(/\/\/[^\n]*/g, '')), 'the boot script loads nothing from a CDN')
})

test('the plexus is our own code with settings, not a library', () => {
  assert.ok(!/particles\.js|tsparticles/i.test(boot + read('utils/OmniSpaces.js') + html))
  for (const k of ['count', 'link', 'lineAlpha', 'speed', 'size']) assert.ok(k in Gate.DEFAULTS.plexus)
})
