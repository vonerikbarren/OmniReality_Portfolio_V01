// The smoke steps: boot, then drive the Omni command language and the services against the live scene. Returns { failed, report }.
export default async function smoke (pg, errs) {
  await pg.waitForSelector('#boot-enter-btn.is-ready', { timeout: 280000 })
  await pg.evaluate(() => document.getElementById('boot-enter-btn').click())
  await pg.waitForFunction(() => !document.getElementById('omni-boot'), null, { timeout: 120000 }).catch(() => {})
  await pg.waitForTimeout(4000)
  const results = await pg.evaluate(async () => {
    const out = []; const check = (name, ok, detail = '') => out.push({ name, ok: !!ok, detail: String(detail).slice(0, 220) })
    const { SERVICES } = await import('/utils/OmniExtraKinds.js'); const { runOmniScript, listKeywords } = await import('/utils/OmniLangRegistry.js')
    const on = SERVICES.lineup?.omniNode; const cam = SERVICES.lineup?.context?.camera
    check('services running', ['lineup', 'doc', 'poly', 'vibration', 'demo', 'scenefile'].every(k => SERVICES[k]), Object.keys(SERVICES).filter(k => !SERVICES[k]).join())
    const run = async (t) => { const r = (await runOmniScript(t, { omniNode: on, camera: cam })).results[0]; return r }
    const ok = async (name, t, expect = null) => { let r; try { r = await run(t) } catch (e) { return check(name, false, 'threw ' + e.message) } check(name, r.ok && (!expect || String(r.output).includes(expect)), r.output || r.error) }
    const bad = async (name, t) => { let r; try { r = await run(t) } catch (e) { return check(name, false, 'threw ' + e.message) } check(name, r.ok === false, r.output || r.error) }
    const wait = (ms) => new Promise(r => setTimeout(r, ms))
    const kw = listKeywords().map(k => k.name)
    check('all keywords registered', ['Help', 'Draw', 'Node', 'Setting', 'Axiom', 'Vibration', 'Dimension', 'Space', 'File', 'Orb', 'Open', 'Demo', 'Decor', 'Scene', 'Remix', 'Doc', 'Semantics', 'Lineup'].every(k => kw.includes(k)), kw.join())
    for (const k of kw) { const r = await run('Omni Help ' + k).catch(e => ({ ok: false, error: e.message })); if (!r.ok) check('help ' + k, false, r.error) }
    // nodes
    await ok('draw node', 'Omni Draw node(sphere) id(t1) label(T1) pos(0, 60, 0)'); await ok('draw node 2', 'Omni Draw node(box) id(t2) pos(3, 60, 0)')
    await ok('node list', 'Omni Node list', 't1'); await bad('draw bad type', 'Omni Draw node(nope) id(t9)'); await bad('node delete needs confirm', 'Omni Node delete id(t2)')
    // scene file round trip
    const text = SERVICES.scenefile.exportText({ name: 'smoke' }); const chk = SERVICES.scenefile.check(text, { mode: 'merge' }); check('scene export + check', chk.ok && chk.nodes.length >= 2, chk.summary)
    // semantics cube
    await ok('semantics create', 'Omni Semantics create skin(default) id(s1) pos(0, 70, 0)'); await ok('semantics face', 'Omni Semantics face id(s1) axiom(time) icon(T) label(Clock)'); await bad('semantics bad axiom', 'Omni Semantics face id(s1) axiom(9)')
    const poly = SERVICES.poly.getPoly('s1'); check('semantics cube has 6 faces tagged by axiom', poly?.faces?.length === 6 && poly.faces[3].tags.includes('time') && poly.faces[3].label === 'Clock', JSON.stringify(poly?.faces?.[3]))
    // docs: layouts
    SERVICES.doc.createDocNode({ position: [0, 80, 0], id: 'd1' })
    for (const layout of ['row', 'grid', 'tunnel', 'helix', 'sphereIn', 'sphereOut']) { const r = SERVICES.doc.createLayout({ from: 'd1', layout, count: 4, center: [0, 90, 0] }); check('doc layout ' + layout, r.ok && r.nodeIds.length === 4, r.error) }
    await bad('doc layout no source', 'Omni Doc layout id(nope) layout(tunnel)')
    // doc windows: a few sheets paging through a long document
    SERVICES.doc.createDocNode({ position: [0, 85, 0], id: 'big', doc: { pages: 300, source: { type: 'none', id: '' } } })
    await ok('doc window', 'Omni Doc window id(big) layout(helix) pages(6) name(w1)'); const W = SERVICES.docwindow; const pgs = () => W.get('w1').slots.map(id => SERVICES.doc.getDoc(id).page)
    check('window shows pages 1-6', pgs().join() === '1,2,3,4,5,6', pgs().join()); const g = (await import('gsap')).default; g.ticker.lagSmoothing(0)
    await W.flip('w1', { by: 3, seconds: 0.2 }); check('flip 3 -> pages 4-9', pgs().sort((a, b) => a - b).join() === '4,5,6,7,8,9', pgs().join())
    const fp = W.flip('w1', { by: 3, seconds: 0.5 }); await wait(150); W.goto('w1', 295); const fr = await Promise.race([fp, wait(2500).then(() => 'HUNG')]); check('goto during a flip does not hang', fr !== 'HUNG' && W.get('w1').start === 295, fr)
    check('sheets full size after goto', W.get('w1').slots.every(id => Math.abs(on.getMeshById(id).scale.x - 1) < 1e-6)); await bad('flip missing window', 'Omni Doc flip name(nope)'); await ok('unwindow', 'Omni Doc unwindow name(w1)')
    // lineups
    for (const n of ['l1', 'l2', 'l3']) await run(`Omni Draw node(sphere) id(${n}) pos(0, 100, 0)`)
    await ok('lineup create', 'Omni Lineup create id(L) layout(helix) ids(l1, l2, l3) center(0, 100, 0) spacing(4)'); await ok('lineup place', 'Omni Lineup place id(L) node(l3) index(1)'); await bad('lineup place missing node', 'Omni Lineup place id(L) node(nope)')
    await ok('lineup attach', 'Omni Lineup attach node(t1) to(l1) off(0, 3, 0)'); await bad('attach loop', 'Omni Lineup attach node(l1) to(t1)'); await ok('lineup list', 'Omni Lineup list', '1:l3')
    await wait(2500); const p1 = on.getMeshById('l1').position; const pt = on.getMeshById('t1').position
    check('carried node follows its carrier', Math.abs(pt.y - (p1.y + 3)) < 0.05 && Math.abs(pt.x - p1.x) < 0.05, `${pt.toArray()} vs ${p1.toArray()}`)
    // camera walk (lag smoothing off so a slow software renderer finishes in real time)
    const gs = (await import('gsap')).default; gs.ticker.lagSmoothing(0)
    await ok('walk starts', 'Omni Lineup walk id(L) seconds(0.4) hold(0.2) distance(7)', '3 stops'); const seen = new Set()
    for (let i = 0; i < 80 && SERVICES.lineup.isWalking(); i++) { await wait(200); const c = document.getElementById('omni-lineup-walk-caption')?.textContent; if (c) seen.add(c.split(' ')[0]) }
    check('walk visits 1, 2, 3 and ends', seen.has('1') && seen.has('2') && seen.has('3') && !SERVICES.lineup.isWalking() && !document.getElementById('omni-lineup-walk-caption'), [...seen].join())
    await ok('walk manual', 'Omni Lineup walk id(L) seconds(0.3) auto(false)'); await wait(600); await ok('walk next', 'Omni Lineup next'); await ok('walk halt', 'Omni Lineup halt'); await ok('halt twice is harmless', 'Omni Lineup halt', 'No walk')
    // ribbon buttons (V251): events reach the modules
    window.dispatchEvent(new CustomEvent('omni:lineup-request', { detail: { action: 'walkFirst' } })); await wait(300); check('ribbon walk starts', SERVICES.lineup.isWalking()); window.dispatchEvent(new CustomEvent('omni:lineup-request', { detail: { action: 'walkFirst' } })); await wait(300); check('ribbon walk toggles off', !SERVICES.lineup.isWalking())
    await ok('ribbon window', 'Omni Doc window id(big) layout(helix) pages(6) name(w2)'); const p0 = SERVICES.docwindow.get('w2').start; window.dispatchEvent(new CustomEvent('omni:docwindow-request', { detail: { action: 'flip', dir: 1 } })); await wait(2500); check('ribbon page flip advances window', SERVICES.docwindow.get('w2').start !== p0, p0)
    // vibration beat landing, with the song clock stubbed
    const SP = (await import('/systems/OmniSongPlayer.js')).default; let beats = 0; const keep = SP.beatClock; SP.beatClock = () => ({ beats, bpm: 120, nodeId: 'x' })
    await run('Omni Draw node(sphere) id(vn) pos(0, 30, 0)'); await ok('vibration start apex + song sync', 'Omni Vibration start target(vn) program(bounce) sync(song) land(apex) attack(0)')
    const y = () => on.getMeshById('vn').position.y; beats = 3; await wait(900); check('apex on the beat', Math.abs(y() - 30.6) < 0.02, y()); beats = 3.5; await wait(900); check('floor off the beat', Math.abs(y() - 30) < 0.02, y())
    await ok('vibration stop', 'Omni Vibration stop target(vn) immediate(true)'); SP.beatClock = keep; await bad('vibration bad land', 'Omni Vibration start target(vn) program(bounce) land(sideways)')
    // demo + decor
    await ok('demo play', 'Omni Demo play name(meaning) speed(4) captions(false)'); await wait(600); check('demo is playing', SERVICES.demo.isPlaying()); await ok('demo stop', 'Omni Demo stop'); await wait(400)
    check('demo cleaned up its nodes', !on.getNodeData('demo_meaning_a'))
    await ok('decor list', 'Omni Decor list')
    return out
  })
  const failed = results.filter(r => !r.ok); const errors = errs.filter(e => !/ERR_FAILED/.test(e))
  const report = results.map(r => `${r.ok ? 'ok     ' : 'FAILED '} ${r.name}${r.ok ? '' : '  ->  ' + r.detail}`).join('\n') + `\n\n${results.length - failed.length}/${results.length} passed, ${errors.length} page error(s)` + (errors.length ? '\n' + errors.join('\n') : '')
  return { failed: failed.length + errors.length, report }
}
