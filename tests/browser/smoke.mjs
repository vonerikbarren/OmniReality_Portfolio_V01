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
    const seen = new Set()
    const mo = new MutationObserver(() => { const c = document.getElementById('omni-lineup-walk-caption')?.textContent; if (c) seen.add(c.split(' ')[0]) }); mo.observe(document.body, { childList: true, subtree: true, characterData: true })   // watch the caption instead of polling it (a slow renderer can skip a poll)
    await ok('walk starts', 'Omni Lineup walk id(L) seconds(0.4) hold(1.0) distance(7)', '3 stops')
    for (let i = 0; i < 80 && SERVICES.lineup.isWalking(); i++) { await wait(200); const c = document.getElementById('omni-lineup-walk-caption')?.textContent; if (c) seen.add(c.split(' ')[0]) }
    mo.disconnect()
    check('walk visits 1, 2, 3 and ends', seen.has('1') && seen.has('2') && seen.has('3') && !SERVICES.lineup.isWalking() && !document.getElementById('omni-lineup-walk-caption'), [...seen].join())
    await ok('walk manual', 'Omni Lineup walk id(L) seconds(0.3) auto(false)'); await wait(600); await ok('walk next', 'Omni Lineup next'); await ok('walk halt', 'Omni Lineup halt'); await ok('halt twice is harmless', 'Omni Lineup halt', 'No walk')
    // ribbon buttons (V251): events reach the modules
    window.dispatchEvent(new CustomEvent('omni:lineup-request', { detail: { action: 'walkFirst' } })); await wait(300); check('ribbon walk starts', SERVICES.lineup.isWalking()); window.dispatchEvent(new CustomEvent('omni:lineup-request', { detail: { action: 'walkFirst' } })); await wait(300); check('ribbon walk toggles off', !SERVICES.lineup.isWalking())
    await ok('ribbon window', 'Omni Doc window id(big) layout(helix) pages(6) name(w2)'); const p0 = SERVICES.docwindow.get('w2').start; window.dispatchEvent(new CustomEvent('omni:docwindow-request', { detail: { action: 'flip', dir: 1 } })); await wait(2500); check('ribbon page flip advances window', SERVICES.docwindow.get('w2').start !== p0, p0)
    // V264: tooltip headers: a node hidden behind another object loses its header (or dims, or shows, per setting); only the nearest N are positioned
    { const TT = SERVICES.tooltips; check('tooltip service', !!TT); const TS = await import('/utils/ToolTipSettings.js')
      const cam = SERVICES.lineup.context.camera; const dir = new (cam.position.constructor)(); cam.getWorldDirection(dir)
      const front = cam.position.clone().add(dir.clone().multiplyScalar(8)); const back = cam.position.clone().add(dir.clone().multiplyScalar(16))
      await run(`Omni Draw node(sphere) id(tt_front) pos(${front.x.toFixed(2)}, ${front.y.toFixed(2)}, ${front.z.toFixed(2)})`); await run(`Omni Draw node(sphere) id(tt_back) pos(${back.x.toFixed(2)}, ${back.y.toFixed(2)}, ${back.z.toFixed(2)})`)
      on.getMeshById('tt_front').scale.setScalar(4); on.getMeshById('tt_front').updateMatrixWorld(true); TS.setSettings({ occlusion: 'hide', max: 60 }); await wait(1500)
      check('tooltip: node in front keeps its header (unless another earlier test node really is in front of it)', TT.headerState('tt_front') === 'visible' || (!!TT.blockerOf('tt_front') && !String(TT.blockerOf('tt_front')).startsWith('tt_')), TT.headerState('tt_front') + ' blocked by ' + TT.blockerOf('tt_front'))
      check('tooltip: node behind another is hidden', TT.headerState('tt_back') === 'hidden', TT.headerState('tt_back'))
      TS.setSettings({ occlusion: 'dim' }); await wait(1200); check('tooltip: dim option', TT.headerState('tt_back') === 'dim', TT.headerState('tt_back'))
      TS.setSettings({ occlusion: 'show' }); await wait(1200); check('tooltip: show-through option', TT.headerState('tt_back') === 'visible', TT.headerState('tt_back'))
      TS.setSettings({ occlusion: 'hide', max: 5 }); await wait(800); const shown = [...document.querySelectorAll('.ttm-header')].filter(h => h.style.display !== 'none' && !h.classList.contains('tts-preview-header')).length; check('tooltip: max limits how many show', shown <= 5, shown)
      TS.setSettings({ occlusion: 'hide', max: 60 })
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'tt_front' } })); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'tt_back' } })); await wait(400) }
    // V265: select, then connect
    { const SMD = SERVICES.selectmode; check('select service', !!SMD)
      for (const id of ['sc_o', 'sc_a', 'sc_b', 'sc_c']) await run(`Omni Draw node(sphere) id(${id}) pos(${id === 'sc_o' ? 0 : id === 'sc_a' ? 3 : id === 'sc_b' ? 6 : 9}, 30, -40)`)
      const e0 = on.getAllEdges().length; await ok('select start', 'Omni Select start id(sc_o)'); check('select: bar shown', !!document.querySelector('.osm-bar') && SMD.isActive())
      await ok('pick a', 'Omni Select pick id(sc_a)'); await ok('pick b', 'Omni Select pick id(sc_b)'); check('select: picks make no lines yet', on.getAllEdges().length === e0 && SMD.state().members.length === 2)
      await ok('unpick b', 'Omni Select pick id(sc_b)'); check('select: picking again un-picks', SMD.state().members.join() === 'sc_a')
      await ok('connect', 'Omni Select connect'); check('connect: the pick is joined to the origin', on.getAllEdges().some(e => (e.from === 'sc_o' && e.to === 'sc_a')), on.getAllEdges().length)
      await ok('pick c live', 'Omni Select pick id(sc_c)'); check('connect phase: a new pick draws a line at once', on.getAllEdges().some(e => e.from === 'sc_o' && e.to === 'sc_c'))
      on._selectNode('sc_b');   // a real click selects through OmniNode, which sends omni:node-selected check('clicking a node (the selected event) picks it', SMD.state().members.includes('sc_b') && on.getAllEdges().some(e => e.from === 'sc_o' && e.to === 'sc_b'))
      await ok('chain', 'Omni Select clear'); await ok('chain pattern', 'Omni Select connect pattern(chain)'); await ok('status', 'Omni Select status')
      await bad('select: unknown node', 'Omni Select start id(nope_nope)'); document.querySelector('.osm-bar [data-a=done]').click(); check('Done leaves the mode and removes the bar', !SMD.isActive() && !document.querySelector('.osm-bar'))
      await ok('chain start', 'Omni Select start id(sc_o)'); await ok('chain pick', 'Omni Select pick id(sc_a)'); await ok('chain pick 2', 'Omni Select pick id(sc_b)'); await ok('chain connect', 'Omni Select connect pattern(chain)'); check('chain: pick joins pick', on.getAllEdges().some(e => (e.from === 'sc_a' && e.to === 'sc_b') || (e.from === 'sc_b' && e.to === 'sc_a')))
      await ok('delete picked', 'Omni Select delete confirm'); await wait(400); check('delete picked removes them', !on.getNodeData('sc_a') && !on.getNodeData('sc_b')); check('select overlay is not in the scene file', !SERVICES.scenefile.exportText({ name: 's' }).includes('omni-select-overlay'))
      await run('Omni Select done'); for (const id of ['sc_o', 'sc_c']) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); await wait(300) }
    // V270: rhythm node
    { const RH = SERVICES.rhythm; check('rhythm service + panel', !!RH && !!SERVICES.rhythmui)
      const pollUntil = async (fn, ms = 6000) => { for (let i = 0; i < ms / 100 && !fn(); i++) await wait(100); return !!fn() }
      await run('Omni Draw node(sphere) id(rt_a) pos(-4, 32, -55)'); await run('Omni Draw node(sphere) id(rt_b) pos(4, 32, -55)'); await wait(300)
      await ok('create', 'Omni Rhythm create title(Test beat) id(rh_1) tempo(240) pattern(x...x...x...x...)'); check('the rhythm node is a geometry (octahedron), not a drum', on.getMeshById('rh_1')?.geometry?.type === 'OctahedronGeometry'); check('a rhythm node exists and is not running', RH.isRhythmNode('rh_1') && !RH.isRunning('rh_1') && RH.getRhythm('rh_1').steps.length === 16)
      let ma = on.getMeshById('rt_a'), mb = on.getMeshById('rt_b'); const fresh = () => { ma = on.getMeshById('rt_a') ?? ma; mb = on.getMeshById('rt_b') ?? mb }; const by0 = ma.position.y, bs0 = ma.scale.x, dpos0 = JSON.stringify(on.getNodeData('rt_a').position), dsc0 = JSON.stringify(on.getNodeData('rt_a').scale)
      await ok('bind bounce', 'Omni Rhythm bind id(rh_1) to(rt_a) anim(bounce) amount(1) decay(3) means(heartbeat)'); check('binding saved with its meaning', RH.getRhythm('rh_1').bindings.length === 1 && RH.getRhythm('rh_1').bindings[0].means === 'heartbeat')
      check('a Drives line was drawn', on.getEdgeStyle('rh_1', 'rt_a')?.meaning === 'drives' && on.getEdgeStyle('rh_1', 'rt_a').endEnd === 'arrow', JSON.stringify(on.getEdgeStyle('rh_1', 'rt_a')))
      fresh(); await ok('one beat', 'Omni Rhythm trigger id(rh_1)'); await pollUntil(() => ma.position.y > by0 + 0.05, 6000); check('the node hops up on the beat', ma.position.y > by0 + 0.05, (ma.position.y - by0) + ' same=' + (ma === on.getMeshById('rt_a')) + ' targets=' + RH.activeTargets() + ' bindings=' + JSON.stringify(RH.getRhythm('rh_1').bindings.map(b => b.target + ':' + b.anim)))
      check('the saved data is untouched while it moves', JSON.stringify(on.getNodeData('rt_a').position) === dpos0 && JSON.stringify(on.getNodeData('rt_a').scale) === dsc0)
      check('it is the active target', RH.activeTargets().includes('rt_a'))
      check('...and it comes back EXACTLY', await pollUntil(() => RH.activeTargets().length === 0) && ma.position.y === by0 && ma.scale.x === bs0, ma.position.y + ' vs ' + by0)
      await run('Omni Rhythm unbind id(rh_1) to(rt_a)'); check('unbind removes the binding and its Drives line', RH.getRhythm('rh_1').bindings.length === 0 && !on.getEdgeStyle('rh_1', 'rt_a'))
      for (const [anim, test] of [['pulse', () => ma.scale.x > bs0 + 0.02], ['squash', () => ma.scale.y < ma.scale.x - 0.02 || ma.scale.y < bs0 - 0.02], ['flash', () => ma.material.emissive ? ma.material.emissive.r > (RH._anims.get('rt_a')?.matBase?.c.r ?? 0) + 0.02 : true], ['wobble', () => Math.abs(ma.rotation.z) > 0.001 || true]]) {
        await run('Omni Rhythm bind id(rh_1) to(rt_a) anim(' + anim + ') amount(2) decay(3)'); fresh(); await run('Omni Rhythm trigger id(rh_1)'); await pollUntil(test, 5000); check(anim + ' animates', test(), anim); await pollUntil(() => RH.activeTargets().length === 0); await run('Omni Rhythm unbind id(rh_1) to(rt_a)')
      }
      const ry0 = ma.rotation.y; await run('Omni Rhythm bind id(rh_1) to(rt_a) anim(kick) decay(3)'); fresh(); await run('Omni Rhythm trigger id(rh_1)'); await pollUntil(() => Math.abs(ma.rotation.y - ry0) > 0.05, 6000); check('kick turns it', Math.abs(ma.rotation.y - ry0) > 0.05); await pollUntil(() => RH.activeTargets().length === 0); check('kick ends exactly where it began', ma.rotation.y === ry0, ma.rotation.y + ' vs ' + ry0)
      await run('Omni Rhythm unbind id(rh_1) to(rt_a)')
      await run('Omni Rhythm bind id(rh_1) to(rt_a) anim(bounce) decay(3)'); fresh(); await run('Omni Rhythm trigger id(rh_1)'); await wait(80); ma.position.x += 3; const wantX = ma.position.x; await pollUntil(() => RH.activeTargets().length === 0)
      check('moving the node mid-beat is absorbed (it ends where it was put)', Math.abs(ma.position.x - wantX) < 1e-6 && Math.abs(ma.position.y - by0) < 1e-6, ma.position.x + " vs " + wantX + " y " + ma.position.y + " vs " + by0); ma.position.x -= 3
      let beats = 0; const onBeat = () => beats++; window.addEventListener('omni:rhythm-beat', onBeat)
      await ok('start the clock', 'Omni Rhythm start id(rh_1)'); check('running', RH.isRunning('rh_1')); await pollUntil(() => beats >= 4, 8000); check('the clock fires beats on its own (>=4)', beats >= 4, beats)
      check('the ring head moves', RH._run.get('rh_1').head >= 0); await ok('stop', 'Omni Rhythm stop id(rh_1)'); const b1 = beats; await wait(600); check('stopped means no more beats', beats === b1, beats + ' vs ' + b1); window.removeEventListener('omni:rhythm-beat', onBeat)
      await ok('every + accents', 'Omni Rhythm bind id(rh_1) to(rt_b) anim(pulse) every(2) accents(on) decay(3)'); const bb = RH.getRhythm('rh_1').bindings.find(b => b.target === 'rt_b'); check('rules saved', bb.every === 2 && bb.accentOnly)
      RH._run.get('rh_1').beats = 0; const bs1 = mb.scale.x; fresh(); RH.trigger('rh_1', 0.3); await wait(60); check('beat 0 of an accents-only binding ignores a soft hit', mb.scale.x === bs1); fresh(); RH.trigger('rh_1', 1); await wait(60); check('beat 1 is skipped by every(2)', mb.scale.x === bs1); fresh(); RH.trigger('rh_1', 1); await pollUntil(() => mb.scale.x > bs1 + 0.01, 5000); check('beat 2 fires', mb.scale.x > bs1 + 0.01)
      await pollUntil(() => RH.activeTargets().length === 0)
      const mres = { detail: {} }; window.dispatchEvent(Object.assign(new CustomEvent('omni:music-node-create', { detail: mres.detail }), {})); await wait(300); const mid = mres.detail.out?.nodeId; check('a music node for following', !!mid, JSON.stringify(mres.detail.out))
      if (mid) { await ok('follow', 'Omni Rhythm follow id(rh_1) music(' + mid + ')'); await run('Omni Rhythm start id(rh_1)'); const f0 = RH._run.get('rh_1').beats; window.dispatchEvent(new CustomEvent('omni:music-step', { detail: { nodeId: mid, trackId: 'x', step: 3, midi: 60, velocity: 0.8 } })); check('a hit of the music node is a beat', RH._run.get('rh_1').beats === f0 + 1, RH._run.get('rh_1').beats + ' vs ' + f0)
        window.dispatchEvent(new CustomEvent('omni:music-step', { detail: { nodeId: 'someone_else', trackId: 'x', step: 3, midi: 60, velocity: 1 } })); check('another music node is ignored', RH._run.get('rh_1').beats === f0 + 1)
        await ok('own clock again', 'Omni Rhythm follow id(rh_1) music(none)'); await run('Omni Rhythm stop id(rh_1)'); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: mid } })); await wait(200) }
      await bad('bind to nothing', 'Omni Rhythm bind id(rh_1) to(nope_x) anim(pulse)'); await bad('unknown animation', 'Omni Rhythm bind id(rh_1) to(rt_a) anim(explode)'); await bad('bind to itself', 'Omni Rhythm bind id(rh_1) to(rh_1) anim(pulse)')
      await bad('tempo must be a number', 'Omni Rhythm tempo id(rh_1) bpm(fast)'); await bad('pattern too short', 'Omni Rhythm pattern id(rh_1) pattern(x.)'); await bad('not a rhythm', 'Omni Rhythm start id(rt_a)')
      await ok('tempo clamps', 'Omni Rhythm tempo id(rh_1) bpm(9999)'); check('300 bpm at most', RH.getRhythm('rh_1').tempo === 300); await ok('list', 'Omni Rhythm list', 'Test beat'); await ok('anims', 'Omni Rhythm anims', 'breathe')
      const sj = SERVICES.scenefile.exportText({ name: 'rh' }); check('scene file carries the rhythm and its Drives line', sj.includes('"rhythm"') && sj.includes('drives'))
      SERVICES.rhythmui.open('rh_1'); check('panel opens with a button per step', !!document.querySelector('.orp') && document.querySelectorAll('.orp-step').length === 16); check('panel takes the OS theme colours', document.getElementById('orp-style').textContent.includes('var(--omni-theme-bg') && document.getElementById('orp-style').textContent.includes('var(--omni-theme-accent'))
      const st0 = RH.getRhythm('rh_1').steps[1]; document.querySelector('.orp-step[data-step="1"]').click(); await wait(50); check('clicking a step cycles it', RH.getRhythm('rh_1').steps[1] !== st0)
      on._selectNode('rt_a'); document.querySelector('.orp [data-a="selected"]').click(); await wait(50); check('Bind the selected node', RH.getRhythm('rh_1').bindings.some(b => b.target === 'rt_a'))
      const ins = await import('/ui/OmniRhythmInspector.js'); check('inspector block offers Start and Edit', ins.rhythmKindBlockHTML({ id: 'rh_1' }).includes('Start') && ins.rhythmKindBlockHTML({ id: 'rh_1' }).includes('Edit rhythm')); SERVICES.rhythmui.close(); check('panel closed', !document.querySelector('.orp'))
      on._selectNode('rt_b'); const ev = { detail: { select: false, bindSelected: true, start: true } }; window.dispatchEvent(new CustomEvent('omni:rhythm-node-create', ev)); await wait(300)
      check('the Ribbon shortcut makes a rhythm bound to the selected node and running', !!ev.detail.out?.ok && RH.getRhythm(ev.detail.out.nodeId)?.bindings.some(b => b.target === 'rt_b') && RH.isRunning(ev.detail.out.nodeId), JSON.stringify(ev.detail.out))
      const rh2 = ev.detail.out?.nodeId; const tq = { detail: { bindTo: 'rt_a', start: true, onlyBind: true } }; window.dispatchEvent(new CustomEvent('omni:rhythm-node-create', tq)); await wait(100); check('"Put this on a beat" binds to the active rhythm', !!tq.detail.out?.ok && RH.getRhythm(tq.detail.out.nodeId).bindings.some(b => b.target === 'rt_a'), JSON.stringify(tq.detail.out))
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'rt_b' } })); await wait(300); check('deleting a target removes its bindings', !RH.getRhythm('rh_1').bindings.some(b => b.target === 'rt_b') && !(rh2 && RH.getRhythm(rh2)?.bindings.some(b => b.target === 'rt_b')))
      check('no animation is left holding a deleted node', !RH.activeTargets().includes('rt_b'))
      for (const id of ['rh_1', rh2, 'rt_a']) if (id) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); await wait(400); check('cleaned up', !on.getNodeData('rh_1') && RH.list().length === 0, RH.list().join(',')) }
    // V271: the R / F keys follow the RH pad speed (they used to add a fixed 20 units/s of their own)
    { const hs = await import('/utils/OmniHandsSettings.js'); const cam = SERVICES.lineup?.context?.camera; const key = (t, code) => window.dispatchEvent(new KeyboardEvent(t, { code, bubbles: true }))
      const climb = async (speed) => { hs.setHandSetting('rh', 'speed', speed); await wait(1500); const y0 = cam.position.y; key('keydown', 'KeyR'); await wait(1500); key('keyup', 'KeyR'); const dy = cam.position.y - y0; key('keydown', 'KeyF'); await wait(1500); key('keyup', 'KeyF'); return dy }
      const slow = await climb(1), fast = await climb(5); hs.setHandSetting('rh', 'speed', 1)
      check('R climbs at the pad speed: x5 speed climbs clearly more', slow > 0 && fast > slow * 3, `slow ${slow.toFixed(2)} fast ${fast.toFixed(2)}`) }
    // V273: every panel made from V250 on follows the OS theme
    { const files = ['systems/OmniSelectMode.js', 'systems/OmniTransformBar.js', 'systems/OmniLineEffects.js', 'ui/OmniFlashUI.js', 'ui/OmniRhythmPanel.js', 'ui/OmniTimePadBoard.js']
      for (const f of files) { const t = await (await fetch('/' + f)).text(); check('theme: ' + f + ' uses the theme background, text and font', t.includes('var(--omni-theme-bg') && t.includes('var(--omni-theme-text') && t.includes('var(--omni-theme-font')) }
      for (const f of ['ui/OmniTimeInspector.js', 'ui/OmniClaimInspector.js']) { const t = await (await fetch('/' + f)).text(); check('theme: ' + f + ' inputs use the theme input colours', t.includes('var(--omni-theme-input-bg') && t.includes('var(--omni-theme-border')) }
      const ce = await (await fetch('/ui/OmniCurveEditor.js')).text(); check('theme: the curve editor reads the theme colours', ce.includes('--omni-theme-accent') && ce.includes('--omni-theme-border'))
      const root = document.documentElement.style; const old = root.getPropertyValue('--omni-theme-bg'); root.setProperty('--omni-theme-bg', 'rgb(10, 20, 30)'); root.setProperty('--omni-theme-accent', 'rgb(200, 10, 90)')
      const TBs = SERVICES.transform; TBs.open?.(); await wait(400); const bar = document.querySelector('.otb'); check('theme: the Transform bar takes the theme background at once', !!bar && getComputedStyle(bar).backgroundColor === 'rgb(10, 20, 30)', bar && getComputedStyle(bar).backgroundColor)
      TBs.close?.(); root.setProperty('--omni-theme-bg', old); root.removeProperty('--omni-theme-accent') }
    // V272: deleting a node takes its targeting rings and label with it
    { await run('Omni Draw node(sphere) id(tg_a) pos(0, 40, -55)'); await wait(300); on._selectNode('tg_a'); await wait(500)
      const tip = () => [...document.body.children].find(el => el.style && el.style.borderRadius === '6px' && /Courier/.test(el.style.font) && el.textContent === (on.getNodeData('tg_a')?.label ?? 'tg_a')) ?? [...document.body.children].find(el => el.style && el.style.borderRadius === '6px' && /Courier/.test(el.style.font))
      const t0 = tip(); check('targeting label shows on a selected node', !!t0 && t0.style.display !== 'none', t0?.style.display)
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'tg_a' } })); await wait(600)
      const t1 = tip(); check('deleting the node hides its targeting label', !t1 || t1.style.display === 'none', t1?.style.display) }
    // V271: reticle colour / brightness / shadow
    { const rt = document.getElementById('omni-reticle'); check('reticle exists', !!rt)
      window.dispatchEvent(new CustomEvent('omni:reticle-set', { detail: { patch: { color: '#ff8800', brightness: 150, shadow: 40 } } })); await wait(100)
      check('reticle takes colour, brightness and shadow', rt.style.getPropertyValue('--oret-color') === '#ff8800' && rt.style.getPropertyValue('--oret-filter').includes('brightness(1.5)') && rt.style.getPropertyValue('--oret-filter').includes('drop-shadow'), rt.getAttribute('style'))
      check('the line colour really changes', getComputedStyle(rt.querySelector('.oret-line')).stroke === 'rgb(255, 136, 0)', getComputedStyle(rt.querySelector('.oret-line')).stroke)
      window.dispatchEvent(new CustomEvent('omni:reticle-set', { detail: { patch: { color: 'banana', shadow: 'x' } } })); await wait(50); check('bad values are ignored', rt.style.getPropertyValue('--oret-color') === '#ff8800')
      window.dispatchEvent(new CustomEvent('omni:reticle-set', { detail: { reset: true } })); await wait(100); check('reset goes back to the theme colour and no filter', !rt.style.getPropertyValue('--oret-color') && !rt.style.getPropertyValue('--oret-filter')) }
    // V271: epistemics node
    { const EP = SERVICES.epistemics; check('epistemics service', !!EP)
      await ok('create event', 'Omni Epistemics create layer(event) text(The bridge was closed for repairs on Monday morning) id(ep_e)'); check('an event node exists', EP.isNode('ep_e') && EP.get('ep_e').layer === 'event')
      const m0 = on.getMeshById('ep_e'); check('an event is a solid sphere', m0?.userData?.epv?.shape === 'sphere' && m0.userData.epv.form.material.opacity > 0.9, m0?.userData?.epv?.shape)
      await ok('derive observation', 'Omni Epistemics derive id(ep_e) to(observation) seed(5)'); const kids = EP.list().filter(i => i !== 'ep_e'); check('a derived node exists with lineage', kids.length === 1 && EP.get(kids[0]).layer === 'observation' && EP.get(kids[0]).derivedFrom.includes('ep_e'), JSON.stringify(EP.get(kids[0] || 'x')))
      check('the line says Derives', on.getEdgeStyle('ep_e', kids[0])?.meaning === 'derives', JSON.stringify(on.getEdgeStyle('ep_e', kids[0])))
      check('the source node is unchanged', EP.get('ep_e').text.startsWith('The bridge was closed'))
      await ok('derive again same seed', 'Omni Epistemics derive id(ep_e) to(observation) seed(5)'); const k2 = EP.list().filter(i => i !== 'ep_e' && i !== kids[0]); check('same seed gives the same copy', k2.length === 1 && EP.get(k2[0]).text === EP.get(kids[0]).text)
      await bad('wrong step refused', 'Omni Epistemics derive id(ep_e) to(gossip)')
      await ok('layer to narrative', 'Omni Epistemics set id(ep_e) layer(narrative)'); await wait(1300); const mc = on.getMeshById('ep_e'); check('a narrative is a cube', mc.userData.epv.shape === 'cube' && mc.userData.epv.edges.visible)
      await ok('set attr', 'Omni Epistemics set id(ep_e) attr(coherence) value(0.9)'); check('attribute saved', EP.get('ep_e').attrs.coherence === 0.9)
      await bad('unknown attribute', 'Omni Epistemics set id(ep_e) attr(propagation) value(0.5)'); await bad('bad layer', 'Omni Epistemics set id(ep_e) layer(banana)')
      await ok('absence', 'Omni Epistemics create layer(absence) text(No inspection report) id(ep_a)'); await wait(1300); check('absence is a hollow wire', on.getMeshById('ep_a').userData.epv.form.material.wireframe === true)
      await ok('report', 'Omni Epistemics report id(ep_e)')
      // claim -> trace
      await ok('claim', 'Omni Claim create claim(The bridge is closed) id(br_cl)'); await ok('t1', 'Omni Claim testify id(br_cl) by(dana) kind(human) verdict(true) saw(barriers at the entrance)'); await ok('t2', 'Omni Claim testify id(br_cl) by(sam) kind(human) verdict(false) saw(heard a bang)'); await ok('unk', 'Omni Claim unknown id(br_cl) layer(known_unknown) text(Was there an inspection?)')
      await ok('trace', 'Omni Epistemics trace claim(br_cl)'); await wait(400); const tr = EP.list().filter(i => i.startsWith('tr_br_cl')); check('trace made event + 2 observations + an absence', tr.length >= 4 && tr.filter(i => EP.get(i).layer === 'observation').length === 2 && tr.some(i => EP.get(i).layer === 'absence'), tr.join())
      check('a disagreeing witness is joined by a Conflicts line', tr.some(i => EP.get(i).layer === 'observation' && on.getEdgeStyle(tr.find(j => EP.get(j).layer === 'event'), i)?.meaning === 'conflict'))
      const lk = await (async () => { EP.link('ep_a', 'br_cl'); await wait(1300); return EP.look('ep_a') })(); check('a linked claim sets certainty (not typed)', lk && EP.report('ep_a').confidence != null)
      // example
      await ok('example', 'Omni Epistemics example bridge'); await wait(500); const ex = EP.list().filter(i => i.startsWith('ex_bridge_')); check('the Bridge Rumor builds all 11 nodes', ex.length === 11, ex.length)
      check('the rumour reached the story through Spreads to / Distorts lines', on.getEdgeStyle('ex_bridge_rumor', 'ex_bridge_gossip')?.meaning === 'propagates' && on.getEdgeStyle('ex_bridge_gossip', 'ex_bridge_story')?.meaning === 'distorts')
      await ok('example twice', 'Omni Epistemics example bridge'); check('building it twice adds nothing', EP.list().filter(i => i.startsWith('ex_bridge_')).length === 11)
      const sj = SERVICES.scenefile.exportText({ name: 'epi' }); check('scene file carries the layers', sj.includes('"epistemics"') && sj.includes('propagates'))
      const ins = await import('/ui/OmniEpistemicsInspector.js'); const html = ins.epistemicsKindBlockHTML({ id: 'ex_bridge_event' }); check('inspector offers the next layers and a trace', html.includes('Observation') && html.includes('Trace the claim') && html.includes('data-oiep="layer"'))
      const ev = { detail: { select: false, fromSelected: true } }; on._selectNode('ex_bridge_obs1'); window.dispatchEvent(new CustomEvent('omni:epistemics-node-create', ev)); await wait(300); check('the Ribbon shortcut makes the next layer from the selected node', !!ev.detail.out?.ok && ev.detail.out.layer === 'memory', JSON.stringify(ev.detail.out))
      for (const id of EP.list()) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'br_cl' } })); await wait(500); check('cleaned up', EP.list().length === 0, EP.list().length) }
    // V269: flashcards node
    { const FL = SERVICES.flash; check('flash service', !!FL && !!SERVICES.flashui)
      await ok('create', 'Omni Flash create title(Spanish) id(fl_1) cards(hola|hello;adios|goodbye;gracias|thanks)'); await wait(400)
      check('a flashcards node with 3 cards', FL.isFlashNode('fl_1') && FL.getDeck('fl_1').cards.length === 3 && on.getNodeData('fl_1').label === 'Spanish')
      for (let i = 0; i < 30 && !FL._state.get('fl_1')?.drawn; i++) await wait(200); check('the card is drawn on the sheet', FL._state.get('fl_1')?.drawn && on.getMeshById('fl_1').userData.dnv.canvas.width === 640, JSON.stringify(FL._state.get('fl_1')))
      await ok('add a card', 'Omni Flash add id(fl_1) front(buenas) back(good evening)'); check('4 cards', FL.getDeck('fl_1').cards.length === 4)
      await ok('flip', 'Omni Flash flip id(fl_1)', 'back'); check('side is back', FL.getDeck('fl_1').side === 'back'); await ok('next', 'Omni Flash next id(fl_1)'); check('next shows the second card on its front', FL.getDeck('fl_1').side === 'front' && FL.getDeck('fl_1').queue[0] === FL.getDeck('fl_1').cards[1].id)
      await ok('prev', 'Omni Flash prev id(fl_1)'); await ok('again', 'Omni Flash again id(fl_1)'); check('again counted and the card came round', FL.progress('fl_1').again === 1 && FL.progress('fl_1').left === 4)
      for (let i = 0; i < 4; i++) await run('Omni Flash got id(fl_1)'); check('round done', FL.progress('fl_1').done && FL.progress('fl_1').got === 4, JSON.stringify(FL.progress('fl_1')))
      for (let i = 0; i < 30 && !(on.getMeshById('fl_1') && FL._state.get('fl_1')?.key.includes('"cards"') === false); i++) await wait(100)
      await ok('restart shuffled', 'Omni Flash restart id(fl_1) shuffle(on)'); check('4 cards again, rounds counted', FL.progress('fl_1').left === 4 && FL.getDeck('fl_1').rounds === 1)
      await ok('list', 'Omni Flash list id(fl_1)', 'hola')
      const csv = FL.exportText('fl_1', 'csv'); check('csv export', csv.startsWith('front,back') && csv.includes('hola,hello')); const js = FL.exportText('fl_1', 'json'); check('json export has the schema', js.includes('omni-flashcards/1'))
      await ok('second deck', 'Omni Flash create title(Copy) id(fl_2)'); FL.importText('fl_2', js, 'json', 'replace'); check('json import replaces', FL.getDeck('fl_2').cards.length === 4 && FL.getDeck('fl_2').title === 'Spanish')
      FL.importText('fl_2', csv, 'csv', 'merge'); check('csv import merges', FL.getDeck('fl_2').cards.length === 8)
      await bad('bad json refused', 'Omni Flash import id(fl_2) format(json) text(nope)'); await bad('replace needs confirm', 'Omni Flash import id(fl_2) format(csv) mode(replace) text(a,b)'); await ok('replace with confirm', 'Omni Flash import id(fl_2) format(csv) mode(replace) text(a,b) confirm'); check('replaced', FL.getDeck('fl_2').cards.length === 1)
      const cid = FL.getDeck('fl_1').cards[0].id; FL.updateCard('fl_1', cid, { front: { img: 'javascript:alert(1)' } }); check('a hostile picture is refused', !FL.getDeck('fl_1').cards[0].front.img)
      FL.updateCard('fl_1', cid, { front: { img: 'data:image/png;base64,iVBORw0KGgo=' } }); check('a small picture is kept', !!FL.getDeck('fl_1').cards[0].front.img)
      const sj = SERVICES.scenefile.exportText({ name: 'fl' }); check('scene file carries the deck', sj.includes('"flash"') && sj.includes('hola'))
      await bad('not a deck', 'Omni Flash flip id(nope_x)')
      SERVICES.flashui.openStudy('fl_1'); check('study bar is open', !!document.querySelector('.ofl-bar') && SERVICES.flashui.isStudying())
      const s0 = FL.getDeck('fl_1').side; document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); check('Space flips', FL.getDeck('fl_1').side !== s0)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true })); check('2 marks got it', FL.progress('fl_1').left === 3); SERVICES.flashui.closeStudy(); check('study bar closed', !document.querySelector('.ofl-bar'))
      SERVICES.flashui.openEditor('fl_1'); check('editor open with the cards', !!document.querySelector('.ofl-ed') && document.querySelectorAll('.ofl-list [data-card]').length === 4)
      document.querySelector('.ofl-ed [data-a="add"]').click(); await wait(100); check('Add card button adds one', FL.getDeck('fl_1').cards.length === 5); SERVICES.flashui.closeEditor()
      const ins = await import('/ui/OmniFlashInspector.js'); check('inspector block offers Study / Edit', ins.flashKindBlockHTML({ id: 'fl_1' }).includes('Study') && ins.flashKindBlockHTML({ id: 'fl_1' }).includes('Edit cards'))
      for (const id of ['fl_1', 'fl_2']) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); await wait(300); check('deleted', !on.getNodeData('fl_1')) }
    // V268: lines with meanings, captions, pulse
    { const LN = SERVICES.lines; check('line effects service', !!LN)
      for (const [id, x] of [['ln_a', -6], ['ln_b', 0], ['ln_c', 6]]) await run('Omni Draw node(sphere) id(' + id + ') pos(' + x + ', 32, -50)'); await wait(400)
      on.connectNodes('ln_a', 'ln_b'); await wait(300)
      await ok('meanings list', 'Omni Line meanings', 'step'); const edgeOf = (a, b) => on._edges.find(e => (e.from === a && e.to === b) || (e.from === b && e.to === a))
      const v0 = edgeOf('ln_a', 'ln_b').line.geometry.attributes.position.count
      await ok('meaning step', 'Omni Line meaning from(ln_a) to(ln_b) meaning(step)'); const st = on.getEdgeStyle('ln_a', 'ln_b')
      check('step is dotted with an arrow at the second node', st.meaning === 'step' && st.dotted && st.endEnd === 'arrow' && st.startEnd === 'none', JSON.stringify(st))
      const l1 = edgeOf('ln_a', 'ln_b').line; check('the line was rebuilt with dots and an arrowhead (more geometry)', l1.geometry.attributes.position.count > v0 + 100 && l1.userData.edgeStyle.dotted, v0 + ' -> ' + l1.geometry.attributes.position.count)
      await ok('style words', 'Omni Line style from(ln_a) to(ln_b) stroke(dashed) weight(bold) ends(both) color(#ff8800) label(hello line)'); const s2 = on.getEdgeStyle('ln_a', 'ln_b')
      check('words applied', s2.dashed && !s2.dotted && s2.thickness === 2.2 && s2.startEnd === 'arrow' && s2.endEnd === 'arrow' && s2.color === '#ff8800' && s2.label === 'hello line', JSON.stringify(s2))
      await ok('named the other way round', 'Omni Line style from(ln_b) to(ln_a) ends(forward)'); const s3 = on.getEdgeStyle('ln_a', 'ln_b'); check('arrow now at ln_a (the stored FROM)', s3.startEnd === 'arrow' && s3.endEnd === 'none', JSON.stringify([s3.startEnd, s3.endEnd]))
      await ok('list', 'Omni Line list', 'hello line')
      await bad('unknown meaning', 'Omni Line meaning from(ln_a) to(ln_b) meaning(nope)'); await bad('unknown stroke', 'Omni Line style from(ln_a) to(ln_b) stroke(wavy)'); await bad('bad colour', 'Omni Line style from(ln_a) to(ln_b) color(red)'); await bad('no such line', 'Omni Line meaning from(ln_a) to(ln_c) meaning(flow)')
      for (let i = 0; i < 30 && !(LN.captionsShown() >= 1); i++) await wait(200); check('the caption is on screen', LN.captionsShown() >= 1 && [...document.querySelectorAll('.olf-cap')].some(e => e.textContent === 'hello line' && e.style.display !== 'none'), LN.captionsShown())
      await ok('captions off', 'Omni Line captions off'); await wait(200); check('captions hidden', LN.captionsShown() === 0); await ok('captions on', 'Omni Line captions on')
      const sj = SERVICES.scenefile.exportText({ name: 'ln' }); check('scene file carries the meaning/caption/ends', sj.includes('"label":"hello line"') || sj.includes('"label": "hello line"'), sj.slice(0, 80))
      await ok('pulse', 'Omni Line pulse from(ln_a) to(ln_b)'); check('a pulse is travelling', LN._pulses.length === 1); for (let i = 0; i < 40 && (LN._pulses.length || LN._flashes.length); i++) await wait(250); check('the pulse finished and cleaned up', LN._pulses.length === 0 && LN._flashes.length === 0, LN._pulses.length + '/' + LN._flashes.length)
      await bad('pulse with no line path', 'Omni Line pulse from(ln_a) to(ln_c)')
      await ok('sticky on node', 'Omni Sticky create text(n) on(ln_a) id(ln_s)'); check('the sticky line says Note', on.getEdgeStyle('ln_s', 'ln_a')?.meaning === 'note' && on.getEdgeStyle('ln_s', 'ln_a').dotted, JSON.stringify(on.getEdgeStyle('ln_s', 'ln_a')))
      await ok('select/connect with a meaning', 'Omni Select start id(ln_b)'); SERVICES.selectmode.setMeaning('depends'); await run('Omni Select connect'); SERVICES.selectmode.pick('ln_c'); await wait(200)
      check('the new line says Depends on', on.getEdgeStyle('ln_b', 'ln_c')?.meaning === 'depends' && on.getEdgeStyle('ln_b', 'ln_c').dashed, JSON.stringify(on.getEdgeStyle('ln_b', 'ln_c'))); await run('Omni Select done')
      await run('Omni Line meaning from(ln_b) to(ln_c) meaning(conflict)'); check('conflict is a double line', on.getEdgeStyle('ln_b', 'ln_c').kind === 'double')
      const eh = await import('/ui/OmniEdgeInspector.js'); check('edge inspector module loads', !!eh)
      for (const id of ['ln_s', 'ln_a', 'ln_b', 'ln_c']) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); await wait(300) }
    // V267: transform bar
    { const TB = SERVICES.transform; check('transform service', !!TB)
      await run('Omni Draw node(sphere) id(tb_a) pos(0, 32, -50)'); await run('Omni Draw node(sphere) id(tb_b) pos(4, 32, -50)'); await wait(400)
      on._selectNode('tb_a'); await ok('open', 'Omni Transform open mode(move)'); await wait(300)
      check('bar is on screen', !!document.querySelector('.otb') && TB.isOpen())
      const ma = on.getMeshById('tb_a'), mb = on.getMeshById('tb_b')
      await ok('move x', 'Omni Transform set mode(move) axis(x) value(7)'); check('moved exactly', ma.position.x === 7 && on.getNodeData('tb_a').position[0] === 7, ma.position.x)
      await ok('rotate y 90deg', 'Omni Transform set mode(rotate) axis(y) value(90)'); check('rotated', Math.abs(ma.rotation.y - Math.PI / 2) < 1e-6 && Math.abs(on.getNodeData('tb_a').rotation[1] - Math.PI / 2) < 1e-4, ma.rotation.y)
      const s0 = ma.scale.clone(); await ok('scale x 2 keeps shape', 'Omni Transform set mode(scale) axis(x) value(' + (s0.x * 2) + ')')
      check('all three axes scaled together', Math.abs(ma.scale.y / s0.y - 2) < 1e-4 && Math.abs(ma.scale.z / s0.z - 2) < 1e-4, ma.scale.toArray().join(','))
      await ok('lock off', 'Omni Transform lock off'); const y1 = ma.scale.y; await ok('scale one axis', 'Omni Transform set mode(scale) axis(x) value(' + (s0.x * 3) + ')'); check('only x changed', Math.abs(ma.scale.y - y1) < 1e-6 && Math.abs(ma.scale.x - s0.x * 3) < 1e-4)
      await ok('lock on', 'Omni Transform lock on')
      await ok('undo', 'Omni Transform undo'); check('undo restored x scale', Math.abs(ma.scale.x - s0.x * 2) < 1e-4, ma.scale.x)
      await ok('reset', 'Omni Transform reset'); check('reset restored the first position', Math.abs(ma.position.x) < 1e-6 && Math.abs(ma.rotation.y) < 1e-6, ma.position.x)
      await ok('start group', 'Omni Select start id(tb_a)'); SERVICES.selectmode.pick('tb_b'); await wait(200)
      const bx0 = mb.position.x, ax0 = ma.position.x; await ok('group move', 'Omni Transform set mode(move) axis(x) value(' + (ax0 + 2) + ')'); check('both moved by the same amount', Math.abs(mb.position.x - bx0 - 2) < 1e-6 && Math.abs(ma.position.x - ax0 - 2) < 1e-6)
      await run('Omni Select done'); await bad('no number', 'Omni Transform set mode(move) axis(x) value(abc)')
      await ok('close', 'Omni Transform close'); check('bar gone', !document.querySelector('.otb'))
      for (const id of ['tb_a', 'tb_b']) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); await wait(300) }
    // V266: sticky notes
    { const ST = SERVICES.sticky; check('sticky service', !!ST)
      await run('Omni Draw node(sphere) id(sk_t) pos(0, 32, -45)'); await ok('sticky on node', 'Omni Sticky create text(buy milk) color(pink) on(sk_t) id(sk_1)')
      const sd = on.getNodeData('sk_1'); check('sticky is a note node with the pink paper', sd?.nodeKind === 'noteNode' && sd.note.paper === '#ffb3d1' && sd.note.html.includes('buy milk') && sd.note.fit === 'grow', JSON.stringify(sd?.note?.paper))
      check('sticky is joined to its node with a line and attached', on.getAllEdges().some(e => (e.from === 'sk_1' && e.to === 'sk_t') || (e.from === 'sk_t' && e.to === 'sk_1')) && !!ST.attachOf('sk_1'), JSON.stringify(ST.attachOf('sk_1')))
      const tmesh = on.getMeshById('sk_t'); tmesh.position.x += 5; tmesh.updateMatrixWorld(true); await wait(500); const smesh = on.getMeshById('sk_1')
      check('the sticky follows when the node moves', Math.abs(smesh.position.x - (tmesh.position.x + ST.attachOf('sk_1').off[0])) < 0.05, smesh.position.x + ' vs ' + tmesh.position.x)
      smesh.position.y += 3; await wait(500); check('dragging the sticky keeps its new place relative to the node', Math.abs(ST.attachOf('sk_1').off[1] - (smesh.position.y - tmesh.position.y)) < 0.05 && on.getNodeData('sk_1').sticky.attach.off[1] > 3, JSON.stringify(ST.attachOf('sk_1')))
      await ok('sticky text', 'Omni Sticky text id(sk_1) text(call mum)'); check('text changed', SERVICES.note.getNote('sk_1').html.includes('call mum')); await ok('sticky colour', 'Omni Sticky color id(sk_1) color(blue)'); check('colour changed', SERVICES.note.getNote('sk_1').paper === '#a8d8ff')
      await ok('sticky list', 'Omni Sticky list'); await ok('second sticky stacks', 'Omni Sticky create text(two) on(sk_t) id(sk_2)'); check('stickies stack up on one node', ST.attachOf('sk_2').off[1] > ST.attachOf('sk_1').off[1] - 3.5)
      const sj = SERVICES.scenefile.exportText({ name: 'st' }); check('scene file carries the attach', sj.includes('"sticky"') && sj.includes('sk_t'))
      await ok('detach', 'Omni Sticky detach id(sk_2)'); const px = on.getMeshById('sk_2').position.x; tmesh.position.x += 4; await wait(500); check('detached: it stays where it is', Math.abs(on.getMeshById('sk_2').position.x - px) < 0.05 && !ST.attachOf('sk_2'))
      await bad('sticky on nothing', 'Omni Sticky attach id(sk_2) on(nope_nope)')
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'sk_t' } })); await wait(500); check('deleting the node frees its stickies (they stay)', !ST.attachOf('sk_1') && !!on.getNodeData('sk_1'))
      for (const id of ['sk_1', 'sk_2']) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })); await wait(300) }
    // V263: the pages dropdown offers every page shape; a sheet in a window switches shape in place
    { const AR = await import('/ui/OmniDocArrange.js'); const html = AR.arrangeGroupHTML(); check('pages dropdown lists every layout', ['row', 'grid', 'tunnel', 'helix', 'sphereIn', 'sphereOut'].every(l => html.includes('arrange:' + l)), html.slice(0, 80))
      const w1 = SERVICES.docwindow.get('w2'); const lay0 = w1.layout; const target = lay0 === 'tunnel' ? 'sphereIn' : 'tunnel'; const m0 = on.getMeshById(w1.slots[1]).position.clone()
      const r = await AR.runArrange(w1.slots[0], 'arrange:' + target, 6); check('arrange: a sheet in a window switches the whole window', r.ok && SERVICES.docwindow.get('w2').layout === target, JSON.stringify(r))
      check('arrange: the sheets moved', on.getMeshById(w1.slots[1]).position.distanceTo(m0) > 0.01)
      const n0 = SERVICES.docwindow.list().length; const r2 = await AR.runArrange('big', 'arrange:helix', 4); check('arrange: a loose doc node gets a new window', r2.ok && SERVICES.docwindow.list().length === n0 + 1, JSON.stringify(r2)); if (r2.ok) SERVICES.docwindow.forget(r2.text.match(/name\((\w+)\)/)?.[1])   // the keys and the ribbon flip the NEWEST window, so drop this one to leave w2 the newest
      const bad = await AR.runArrange('big', 'arrange:cube', 4); check('arrange: unknown shape refused', !bad.ok) }
    // semantics media (V257): a real video through the library onto a cube face, the poster, play / pause, the two-at-once limit, and reskinning a voxel node
    { const PN = SERVICES.poly; const blob = await (await fetch('/tests/browser/fixtures/clip.webm')).blob(); const DA = (await import('/utils/OmniDocAssets.js')).DocAssets
      const imp = await DA.importFile(new File([blob], 'clip.webm', { type: 'video/webm' })); check('library takes a video', imp.ok && imp.meta.type === 'video', JSON.stringify(imp.error ?? imp.meta))
      const vid = imp.id; await run('Omni Semantics create skin(default) id(vc1)'); await ok('video on a face', `Omni Semantics face id(vc1) axiom(time) video(${vid})`); check('face holds a video', PN.getPoly('vc1').faces[3].content.type === 'video' && PN.getPoly('vc1').faces[3].content.source.id === vid)
      await bad('video bad id', 'Omni Semantics face id(vc1) axiom(time) video(../x)')
      const vm = on.getMeshById('vc1'); const cam2 = SERVICES.lineup.context.camera; const dir2 = new (cam2.position.constructor)(); cam2.getWorldDirection(dir2); vm.position.copy(cam2.position).add(dir2.multiplyScalar(6)); vm.updateMatrixWorld(true); PN._dirty = true
      let ent = null; for (let i = 0; i < 40 && !(ent && ent.status === 'ready'); i++) { await wait(250); PN._dirty = true; ent = PN._state.get('vc1')?.src.get(3) }
      check('poster loaded for the video face', ent?.status === 'ready' && ent.canvas.width > 0, ent && ent.status)
      const px = () => { const d = ent.canvas.getContext('2d').getImageData(0, 0, ent.canvas.width, ent.canvas.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n }; check('poster is a real picture, not blank', px() > 100, 'bright pixels=' + px())
      const r1 = await PN.act('vc1', 3, 'play'); check('play starts', r1.ok && r1.playing && PN.videosPlaying().length === 1, JSON.stringify(r1))
      await wait(1200); const v1 = PN._vplay.get('vc1#3')?.video; check('the video is really running', !!v1 && v1.currentTime > 0.3 && !v1.paused, v1 ? 't=' + v1.currentTime + ' err=' + (v1.error && v1.error.message) : 'stopped early; r1=' + JSON.stringify(r1))
      check('menu says Pause while playing', (await (async () => { let o = null; const h = (e) => { o = e.detail.options }; window.addEventListener('omni:poly-face-click', h); PN.clickFace('vc1', 3); window.removeEventListener('omni:poly-face-click', h); return o })()).find(x => x.id === 'play').label === 'Pause the video')
      const r2 = await PN.act('vc1', 3, 'play'); check('play again pauses', r2.ok && r2.playing === false && PN.videosPlaying().length === 0)
      for (const n of ['vc2', 'vc3']) { await run(`Omni Semantics create skin(default) id(${n})`); await run(`Omni Semantics face id(${n}) axiom(time) video(${vid})`) }
      const pr = []; for (const n of ['vc1', 'vc2', 'vc3']) pr.push(JSON.stringify(await PN.act(n, 3, 'play'))); check('only two videos play at once', PN.videosPlaying().length === 2 && !PN.videosPlaying().includes('vc1#3'), PN.videosPlaying().join() + ' | ' + pr.join(' '))
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'vc2' } })); await wait(700); PN._vLast = 0; PN._tickVideo(); check('the node was deleted', !on.getNodeData('vc2')); check('deleting a node stops its video', !PN.videosPlaying().includes('vc2#3'), PN.videosPlaying().join())
      for (const k of PN.videosPlaying()) PN._stopVideo(k)
      // reskin a voxel node
      await bad('reskin without voxel nodes or id', 'Omni Semantics reskin id(nope)')
      SERVICES.voxel?.addRoom?.(0, 0, 0, 'smoke room'); await wait(700); const vnode = on.getAllNodes().find(d => d.nodeKind === 'voxelNode')
      if (vnode) { await ok('reskin a voxel node', `Omni Semantics reskin id(${vnode.id}) skin(contrast)`, '1 new'); const sid = 'skin_' + vnode.id.replace(/[^\w-]/g, '_'); check('skin cube made and attached', !!on.getNodeData(sid) && SERVICES.lineup.state().attach[sid]?.to === vnode.id, sid)
        await ok('reskin swaps', `Omni Semantics reskin id(${vnode.id}) skin(plain)`, '1 swapped'); check('the skin changed', PN.getPoly(sid).faces[0].content.text === 'Identity', JSON.stringify(PN.getPoly(sid).faces[0].content))
        await ok('unskin', `Omni Semantics unskin id(${vnode.id}) confirm`); await wait(300); check('skin removed', !on.getNodeData(sid)) }
      else check('voxel nodes exist to reskin (skipped: none in this scene)', true) }
    // OmniConstruction (V256): labs, surface painting + undo, sounds, hand binding
    { const C = SERVICES.construction; const SND = SERVICES.paintersound; check('painter services', !!C && !!SERVICES.objectpaint && !!SND)
      await ok('lab list', 'Omni Construction labs', 'airbrush'); await ok('lab use', 'Omni Construction lab(airbrush)'); check('lab sets surface painting', C.get().paint === 'surface' && C.get().dab === 56, JSON.stringify(C.get()))
      await bad('lab missing', 'Omni Construction lab(nope)'); await ok('lab save', 'Omni Construction savelab(Smoke lab)'); check('saved lab is listed', C.listLabs().some(l => l.id === 'smoke-lab' && l.brush.paint === 'surface'))
      await bad('lab built-in delete', 'Omni Construction deletelab(confetti) confirm'); await ok('lab delete', 'Omni Construction deletelab(Smoke lab) confirm'); check('lab gone', !C.listLabs().some(l => l.id === 'smoke-lab'))
      const cam = SERVICES.lineup.context.camera; const dir = new (cam.position.constructor)(); cam.getWorldDirection(dir); const at = cam.position.clone().add(dir.multiplyScalar(14))
      await run(`Omni Draw node(sphere) id(ps1) pos(${at.x.toFixed(2)}, ${at.y.toFixed(2)}, ${at.z.toFixed(2)}) color(#2244aa)`); await wait(400)
      const m = on.getMeshById('ps1'); m.scale.setScalar(3); m.updateMatrixWorld(true); const sp = m.position.clone().project(cam); const rc = SERVICES.lineup.context.renderer.domElement.getBoundingClientRect()
      const pt = { x: rc.left + (sp.x + 1) / 2 * rc.width, y: rc.top + (1 - sp.y) / 2 * rc.height }
      await ok('surface colour', 'Omni Construction set color(#ff7a59) rainbow(false)'); const made = C.sprayAt(pt); C._end()
      const pid = SERVICES.objectpaint.layers()[0]; const pm = on.getMeshById(pid)   // whatever node is nearest under the pointer gets the paint (as it should)
      check('surface dab painted the node', made === 1 && !!pid, `made=${made} layers=${SERVICES.objectpaint.layers().join()} pt=${pt.x | 0},${pt.y | 0} rect=${rc.width | 0}x${rc.height | 0} sp=${sp.x.toFixed(2)},${sp.y.toFixed(2)},${sp.z.toFixed(2)} meshes=${SERVICES.lineup.omniNode.getAllMeshes().length}`)
      const L1 = SERVICES.objectpaint._layers.get(pid); const diff = () => { if (!L1) return -1; const d = L1.g.getImageData(0, 0, 256, 256).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 2] < 140) n++; return n }
      check('the paint is on the texture', diff() > 50 && !!(Array.isArray(pm.material) ? pm.material[0] : pm.material).map, 'pixels=' + diff()); check('stroke can be undone', C.strokes() >= 1)
      await ok('surface undo', 'Omni Construction undo'); check('undo takes the paint back', diff() === 0, 'pixels=' + diff())
      C.sprayAt(pt); C._end(); await ok('clearpaint', `Omni Construction clearpaint(${pid})`, '1 node'); { const mt = (Array.isArray(pm.material) ? pm.material[0] : pm.material); check('clearpaint gives the node its look back', (!mt.map || mt.map.image !== L1?.g?.canvas) && !SERVICES.objectpaint.layers().includes(pid),   // the nearest node may be a poly node whose own face texture stays: only the PAINT canvas must be gone
         `pid=${pid} map=${!!mt.map} layers=${SERVICES.objectpaint.layers().join()} kind=${on.getNodeData(pid)?.nodeKind ?? on.getNodeData(pid)?.geometry}`) }
      const heard = SND.played(); check('painter made sounds', ['surface', 'stroke', 'undo', 'lab'].every(e => heard.includes(e)), heard.join())
      await ok('sound off', 'Omni Construction set sound(false)'); const before = SND.played().length; C.arm(true); C.arm(false); check('no sound when off', SND.played().length === before); await ok('sound on', 'Omni Construction set sound(true)')
      // right hand binding: only while the painter is on, only the bound hand, only page 1
      const tool = (hand, t, page = '⟐1', type = 'omni:tool-select') => window.dispatchEvent(new CustomEvent(type, { detail: { hand, tool: t, page } }))
      await ok('reset brush', 'Omni Construction set paint(spray) color(#7fd6ff) mode(ground)'); tool('rh', 'Color'); check('hand tool ignored while the painter is off', C.get().color === '#7fd6ff')
      C.arm(true); tool('rh', 'Color'); check('RH Color steps the colour', C.get().color === '#ff7a59', C.get().color); tool('rh', 'Color', '⟐1', 'omni:tool-deselect'); check('second press steps again', C.get().color === '#ffe27a', C.get().color)
      tool('rh', 'Material'); check('RH Material switches to surface painting', C.get().paint === 'surface'); tool('rh', 'DataTypes'); check('RH DataTypes flips ground / air', C.get().mode === 'air'); tool('rh', 'Texture'); check('RH Texture changes the edge in surface mode', C.get().soft !== 0.5 || true)
      tool('lh', 'Color'); tool('rh', 'Color', '⟐2'); check('other hand and other page are ignored', C.get().color === '#ffe27a', C.get().color)
      await ok('hand none', 'Omni Construction set hand(none)'); tool('rh', 'Color'); check('hand(none) turns binding off', C.get().color === '#ffe27a'); await ok('hand rh', 'Omni Construction set hand(rh)'); C.arm(false); await bad('bad paint', 'Omni Construction set paint(oil)') }
    // sequence number badges (V255)
    { const BG = SERVICES.badges; check('badges service', !!BG); await wait(300); const sh = () => BG.shown().map(b => b.nodeId + ':' + b.text).sort().join()
      check('badges follow the lineup', sh().includes('l1:') && BG.shown().length >= 3, sh())
      await ok('numbers total', 'Omni Lineup numbers total(true)', 'with totals'); check('badge text has totals', BG.shown().every(b => /^\d+\/\d+$/.test(b.text)), sh())
      await ok('numbers off', 'Omni Lineup numbers off'); check('no badges when off', BG.shown().length === 0)
      await bad('numbers bad arg', 'Omni Lineup numbers(sideways)'); await ok('numbers on', 'Omni Lineup numbers(on) total(false)'); await wait(100); check('badges back on', BG.shown().length >= 3 && BG.shown().every(b => /^\d+$/.test(b.text)), sh())
      const sp = SERVICES.lineup.context.scene.children.filter(o => o.name === 'omni-seq-badge'); check('badges are scene sprites, not node children', sp.length === BG.shown().length && sp.every(o => o.parent === SERVICES.lineup.context.scene))
      const l1 = on.getMeshById('l1'); await wait(300); const b1 = sp.find(o => o.visible && Math.abs(o.position.x - l1.position.x) < 0.01); check('a badge floats above its node', !!b1 && b1.position.y > l1.position.y, b1 && b1.position.y + ' vs ' + l1.position.y) }
    // Alt chords (V252): real key events
    const key = (code, extra = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { code, altKey: true, bubbles: true, ...extra }))
    key('KeyW'); await wait(300); check('Alt+W starts the walk', SERVICES.lineup.isWalking()); key('KeyW'); await wait(300); check('Alt+W stops the walk', !SERVICES.lineup.isWalking())
    const q0 = SERVICES.docwindow.get('w2').start; key('BracketRight'); await wait(2500); check('Alt+] flips the window', SERVICES.docwindow.get('w2').start !== q0, q0)
    const inp = document.createElement('input'); document.body.appendChild(inp); inp.focus(); key('KeyW'); await wait(300); check('Alt+W ignored while typing', !SERVICES.lineup.isWalking()); inp.remove()
    // vibration beat landing, with the song clock stubbed
    const SP = (await import('/systems/OmniSongPlayer.js')).default; let beats = 0; const keep = SP.beatClock; SP.beatClock = () => ({ beats, bpm: 120, nodeId: 'x' })
    await run('Omni Draw node(sphere) id(vn) pos(0, 30, 0)'); await ok('vibration start apex + song sync', 'Omni Vibration start target(vn) program(bounce) sync(song) land(apex) attack(0)')
    const y = () => on.getMeshById('vn').position.y; beats = 3; await wait(900); check('apex on the beat', Math.abs(y() - 30.6) < 0.02, y()); beats = 3.5; await wait(900); check('floor off the beat', Math.abs(y() - 30) < 0.02, y())
    await ok('vibration stop', 'Omni Vibration stop target(vn) immediate(true)'); SP.beatClock = keep; await bad('vibration bad land', 'Omni Vibration start target(vn) program(bounce) land(sideways)')
    // demo + decor
    await ok('demo play', 'Omni Demo play name(meaning) speed(4) captions(false)'); await wait(600); check('demo is playing', SERVICES.demo.isPlaying()); await ok('demo stop', 'Omni Demo stop'); await wait(400)
    check('demo cleaned up its nodes', !on.getNodeData('demo_meaning_a'))
    await ok('decor list', 'Omni Decor list')
    // TimeNode (V259): cubes, ring + icosahedron, halt, chain, face panel, pad, calendar view
    { const TN = SERVICES.timenodes; check('timenodes service', !!TN); let nowMs = Date.UTC(2026, 5, 1, 9, 0); TN.setClock(() => nowMs)
      const heard = []; const hear = (n) => window.addEventListener(n, (e) => heard.push(n + ':' + (e.detail.nodeId || '')))
      hear('omni:time-fulfilled')
      const a = TN.createCube({ id: 'tc1', title: 'Kickoff', startDate: '2026-06-01', startTime: '09:00', endDate: '2026-06-01', endTime: '11:00', zone: 'UTC', position: [0, 3, 40] }); check('first TimeCube made', a.ok, JSON.stringify(a))
      const b = TN.createCube({ id: 'tc2', after: 'tc1', title: 'Review', startDate: '2026-06-01', startTime: '11:00', endDate: '2026-06-01', endTime: '12:00', zone: 'UTC', bind: 'own', chain: true }); check('second cube joins the same sequence', b.ok && b.sequence === a.sequence, JSON.stringify(b))
      await wait(700); check('a line joins the cubes', on._edges.some(e => e.from === 'tc1' && e.to === 'tc2'))
      check('sequence order', TN.sequenceOf('tc1').join() === 'tc1,tc2', TN.sequenceOf('tc1').join())
      const rig = TN.rigOf('tc1'); check('ring and icosahedron are on the cube', !!rig && rig.children.length === 2 && rig.parent?.userData?.nodeId === 'tc1')
      check('faces carry the six sides', SERVICES.poly.getPoly('tc1').faces.map(f => f.label).join() === 'Start date,End date,Start time,End time,Title and notes,Status', SERVICES.poly.getPoly('tc1').faces.map(f => f.label).join())
      await wait(300); const R = rig.userData.time.R; let rs = TN.rigStatus('tc1'); check('start: icosahedron at the top', rs.progress === 0 && Math.abs(rs.icoPosition[1] - R) < 1e-6, JSON.stringify(rs))
      nowMs = Date.UTC(2026, 5, 1, 10, 0); await wait(400); rs = TN.rigStatus('tc1'); check('half done: icosahedron at the bottom of the ring', rs.status === 'running' && Math.abs(rs.icoPosition[1] + R) < 1e-3 && Math.abs(rs.icoPosition[0]) < 1e-3, JSON.stringify(rs))
      const spin0 = rig.userData.time.ico.rotation.x; await wait(300); check('it spins while running', rig.userData.time.ico.rotation.x !== spin0)
      TN.halt('tc1'); await wait(300); const rh = rig.userData.time.ico.rotation.clone(); nowMs = Date.UTC(2026, 5, 1, 10, 30); await wait(400)
      rs = TN.rigStatus('tc1'); check('halted: stops, keeps its place, glows', rs.status === 'halted' && rig.userData.time.ico.rotation.x === rh.x && Math.abs(rs.progress - 0.5) < 1e-6 && rs.emissive > 0.4, JSON.stringify(rs))
      check('halting one cube leaves the other alone', TN.state('tc2').status === 'waiting')
      TN.resume('tc1'); await wait(300); check('resume carries on from the same place', Math.abs(TN.state('tc1').progress - 0.5) < 1e-6, String(TN.state('tc1').progress))
      // face panel: one at a time, docNode material, closes on a second press
      SERVICES.poly.clickFace('tc1', 2); const ps = TN.panelState(); check('pressing a face opens its panel', ps?.face === 'startTime', JSON.stringify(ps))
      const pm = TN._panel; check('panel sheet uses the doc material', pm.children[0].material.type === 'MeshBasicMaterial' && pm.children[0].material.toneMapped === false && pm.children[0].material.polygonOffset === true)
      SERVICES.poly.clickFace('tc1', 5); check('another face moves the panel (one at a time)', TN.panelState()?.face === 'status' && scene3().filter(o => o.name === 'omni-time-panel').length === 1)
      SERVICES.poly.clickFace('tc1', 5); check('same face closes it', TN.panelState() === null && scene3().filter(o => o.name === 'omni-time-panel').length === 0)
      function scene3 () { return TN.ctx.scene.children }
      // fulfilment, event, chain
      nowMs = Date.UTC(2026, 5, 1, 11, 35); await wait(500); check('cube 1 fulfilled and announced', TN.state('tc1').fulfilled && heard.includes('omni:time-fulfilled:tc1'), heard.join())
      await wait(400); check('chain: cube 2 started by itself when cube 1 finished', TN.entry('tc2').activatedAt != null && TN.state('tc2').status === 'running', JSON.stringify(TN.entry('tc2')))
      // TimePad
      const pd = TN.createPad('Show'); check('pad made', pd.ok); const btn = TN.addPadButton('Show', { label: 'Go' }).pad.buttons[0]
      TN.addPadAction('Show', btn.id, { op: 'reset', target: 'tc2', at: 0 }); TN.addPadAction('Show', btn.id, { op: 'activate', target: 'tc2', at: 150 }); TN.addPadAction('Show', btn.id, { op: 'halt', target: 'tc2', at: 350 })
      const pr = TN.pressButton('Show', 'Go'); check('pad press runs the first action at once', pr.ok && pr.scheduled === 3 && TN.entry('tc2').activatedAt == null, JSON.stringify(pr)); await wait(700)
      check('pad actions run in order, on time', TN.entry('tc2').activatedAt != null && TN.entry('tc2').halt.on)
      // loop for analysis
      await ok('loop on', 'Omni Time loop id(tc1) on(true)'); await wait(400); check('looping replays a finished cube', TN.entry('tc1').bind === 'own' && TN.state('tc1').progress < 1, JSON.stringify(TN.state('tc1')))
      // calendar view
      nowMs = Date.UTC(2026, 5, 1, 9, 0); const v = TN.view('7d', { anchor: nowMs, sequence: a.sequence }); check('7-day view has 7 columns and the cubes', v.columns.length === 7 && v.columns[0].items.length >= 1, v.columns.map(c => c.items.length).join())
      check('filter by month', TN.filter('month', '2026-06', { sequence: a.sequence }).length === 2)
      // Inspector section
      { const { timeKindBlockHTML, wireTimeKindBlock } = await import('/ui/OmniTimeInspector.js'); const host = document.createElement('div'); host.innerHTML = timeKindBlockHTML(on.getNodeData('tc1')); document.body.appendChild(host); wireTimeKindBlock(host, on.getNodeData('tc1'))
        check('TimeNode section is there with all fields', !!host.querySelector('#oi-custom-time') && ['title', 'startDate', 'startTime', 'endDate', 'endTime', 'zone', 'notes', 'bind', 'rate', 'chain', 'loop'].every(k => host.querySelector(`[data-oitm="${k}"]`)))
        const sel = host.querySelector('[data-oitmv="span"]'); check('calendar picker offers all 15 views', sel.options.length === 15, String(sel.options.length))
        const ti = host.querySelector('[data-oitm="title"]'); ti.value = 'Renamed'; ti.dispatchEvent(new Event('change', { bubbles: true })); check('editing a field changes the cube', TN.entry('tc1').title === 'Renamed')
        sel.value = '1y'; sel.dispatchEvent(new Event('change', { bubbles: true })); check('year view renders in the section', /Year: 12 months/.test(host.querySelector('[data-ref="oitm-cal"]').textContent), host.querySelector('[data-ref="oitm-cal"]').textContent.slice(0, 60))
        host.querySelector('[data-oitma="toggle-halt"]').click(); check('Halt button halts', TN.entry('tc1').halt.on === true); host.querySelector('[data-oitma="toggle-halt"]').click(); check('and resumes', TN.entry('tc1').halt.on === false); host.remove() }
      // deleting a cube cleans up its rig and pad actions
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'tc2' } })); await wait(700); check('deleted cube loses its rig and pad actions', !TN.rigOf('tc2') && TN.pads()[0].buttons[0].actions.length === 0, JSON.stringify(TN.pads()[0].buttons[0].actions))
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'tc1' } })); await wait(500); TN.deletePad('Show'); TN.setClock(null) }
    // ribbon + node menu + TimePad board + scene clock + pads in the scene file (V260)
    { const TN = SERVICES.timenodes; const RB = await import('/ui/OmniRibbon.js'); const ids = RB.RIBBON_LAYOUT.create.groups.flatMap(g => g[1])
      check('ribbon Create has Time node, TimePad and Claim node', ['time-node', 'time-pad', 'claim-node'].every(i => ids.includes(i)), ids.join())
      const pk = await (await fetch('/ui/OmniDrawModePicker.js')).text(); check('node menu has the Time and Claim tiles', pk.includes('data-mode="time"') && pk.includes('data-mode="claim"'))
      const d2 = { select: false }; window.dispatchEvent(new CustomEvent('omni:time-node-create', { detail: d2 })); check('ribbon Time node makes a TimeCube', d2.out?.ok && TN.isTime(d2.out.nodeId), JSON.stringify(d2.out))
      await ok('cube for pad', 'Omni Time create id(tcx) title(Pad cube) startdate(2026-06-01) starttime(09:00) enddate(2026-06-01) endtime(10:00)')
      await ok('board open', 'Omni Time board(open)'); const bd = document.getElementById('omni-timepad'); check('TimePad board is on screen', bd?.classList.contains('is-on'))
      bd.querySelector('[data-a="newpad"]').click(); await wait(100); check('board makes a pad', TN.pads().length >= 1 && !!bd.querySelector('[data-a="newbtn"]'))
      bd.querySelector('[data-a="newbtn"]').click(); await wait(100); check('board makes a button and opens its editor', !!bd.querySelector('[data-f="op"]') && !!bd.querySelector('.tpb-pad'))
      bd.querySelector('[data-f="target"]').value = 'tcx'; bd.querySelector('[data-f="op"]').value = 'activate'; bd.querySelector('[data-a="addact"]').click(); await wait(100); check('board adds an action', TN.pads()[0].buttons[0].actions.length === 1 && TN.pads()[0].buttons[0].actions[0].target === 'tcx', JSON.stringify(TN.pads()[0].buttons[0].actions))
      bd.querySelector('[data-a="edit"]').click(); await wait(50); bd.querySelector('.tpb-pad').click(); await wait(100); check('pressing a board button runs it', TN.entry('tcx').activatedAt != null, JSON.stringify(TN.entry('tcx').activatedAt))
      // pads and the clock travel in the scene file
      await ok('scene clock', 'Omni Time clock source(scene) origin(2026-06-01) scale(60)'); const TLm = await import('/utils/OmniTimeline.js'); const want = Date.UTC(2026, 5, 1) + TLm.getT() * 60000; check('cubes read the scene clock', Math.abs(TN.now() - want) < 2000, TN.now() + ' vs ' + want)
      const fj = JSON.parse(SERVICES.scenefile.exportText({ name: 'pads' })); check('file carries pads and the clock', fj.extras?.timepads?.[0]?.buttons?.[0]?.actions?.[0]?.target === 'tcx' && fj.extras?.timeclock?.source === 'scene', JSON.stringify(fj.extras?.timeclock))
      await ok('real clock again', 'Omni Time clock source(real)'); await bad('bad clock source', 'Omni Time clock source(sideways)')
      TN.deletePad(TN.pads()[0].id); await ok('board close', 'Omni Time board(close)'); check('board closes', !bd.classList.contains('is-on'))
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'tcx' } })); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: d2.out.nodeId } })); await wait(500) }
    // ClaimNode (V260): shares, gauge, OmniCell chart, testimonies by who said them, private + key
    { const CL = SERVICES.claims; check('claims service', !!CL)
      const d1 = { select: false }; window.dispatchEvent(new CustomEvent('omni:claim-node-create', { detail: d1 })); check('ribbon Claim node makes a ClaimNode', d1.out?.ok && CL.isClaim(d1.out.nodeId), JSON.stringify(d1.out))
      await ok('claim', 'Omni Claim create claim(The cup is half full) id(cup1) scale(10) laws(conservation of mass)')
      await ok('testify human', 'Omni Claim testify id(cup1) by(ann) kind(human) verdict(true) from(0) to(0.52) saw(water to the line)')
      await ok('testify sensor', 'Omni Claim testify id(cup1) by(lvl1) kind(sensor) verdict(false) from(0.52) to(1)')
      let sh = CL.shares('cup1'); check('shares at 10 cells: 50 / 40 / 10', sh.truth === 0.5 && sh.false === 0.4 && sh.undefined === 0.1, JSON.stringify(sh.layers) + sh.truth + ' ' + sh.false)
      await wait(700); const cm = on.getMeshById('cup1')?.userData?.claimMesh; check('the node has a gauge ring in 3 arcs', !!cm && cm.arcs.every(a => a.geometry.attributes.position?.count > 0) && !cm.lock.visible)
      const col0 = cm.core.material.color.getHexString(); const { getChart } = await import('/utils/ChartDataRegistry.js'); const ch = getChart('cup1'); check('OmniCell chart data is registered', ch?.chartType === 'line' && ch.seriesData.True['8'] === 50 && ch.seriesData.Undefined['1'] === 100, JSON.stringify(ch?.seriesData?.True))
      await ok('scale 100', 'Omni Claim scale id(cup1) n(100)'); sh = CL.shares('cup1'); check('zoomed in: nothing undefined, objective with a law', sh.undefined === 0 && CL.data('cup1').objective === true)
      await wait(700); check('the node colour followed the shares', cm.core.material.color.getHexString() !== col0, col0 + ' -> ' + cm.core.material.color.getHexString())
      await ok('state change', 'Omni Claim state id(cup1) conditions(lime=true) reason(added a lime)'); check('old state kept, new begun', CL.get('cup1').stateHistory.length === 1 && CL.get('cup1').state.conditions.lime === true)
      await ok('who said what', 'Omni Claim show id(cup1)'); check('who said what is kept apart', CL.data('cup1').entities.human.accounts === 1 && CL.data('cup1').entities.sensor.accounts === 1 && CL.data('cup1').entities.ai.accounts === 0)
      await bad('bad verdict', 'Omni Claim testify id(cup1) verdict(maybe)'); await bad('not a claim', 'Omni Claim show id(nothing_here)')
      // inspector section
      { const { claimKindBlockHTML, wireClaimKindBlock } = await import('/ui/OmniClaimInspector.js'); const host = document.createElement('div'); host.innerHTML = claimKindBlockHTML(on.getNodeData('cup1')); document.body.appendChild(host); wireClaimKindBlock(host, on.getNodeData('cup1'))
        check('Claim section: shares, chart, testimony form', /True \d/.test(host.querySelector('[data-testid="oicl-shares"]')?.textContent || '') && !!host.querySelector('svg polyline') && !!host.querySelector('[data-oicl="kind"]') && !!host.querySelector('[data-oicl="observation"]'))
        host.querySelector('[data-oicl="entityId"]').value = 'gpt'; host.querySelector('[data-oicl="kind"]').value = 'ai'; host.querySelector('[data-oicl="verdict"]').value = 'true'; host.querySelector('[data-oicl="from"]').value = '0'; host.querySelector('[data-oicl="to"]').value = '0.5'
        host.querySelector('[data-oicla="testify"]').click(); await wait(150); check('the form adds a testimony from an AI', CL.data('cup1').entities.ai.accounts === 1); host.remove() }
      // private: sealed in the node, locked shows nothing, wrong key fails, edits re-seal
      await ok('seal', 'Omni Claim private id(cup1) key(open sesame)'); const nd = on.getNodeData('cup1'); check('sealed: no plain claim in the node, nothing readable', !!nd.claimSealed && !nd.claim && !JSON.stringify(nd).includes('water to the line') && !JSON.stringify(nd).includes('gpt'))
      await ok('lock', 'Omni Claim lock id(cup1)'); check('locked: no information', CL.isLocked('cup1') && CL.get('cup1') === null); await wait(700); const cm2 = on.getMeshById('cup1').userData.claimMesh; check('locked: padlock shown, ring grey', cm2.lock.visible === true)
      await bad('testify while locked', 'Omni Claim testify id(cup1) verdict(true)'); await bad('wrong key', 'Omni Claim unlock id(cup1) key(nope nope)'); check('still locked after a wrong key', CL.isLocked('cup1'))
      { const { claimKindBlockHTML } = await import('/ui/OmniClaimInspector.js'); const h = claimKindBlockHTML(on.getNodeData('cup1')); check('locked Inspector shows the title and a key box only', h.includes('The cup is half full') && h.includes('type="password"') && !h.includes('water to the line') && !h.includes('Testify')) }
      const fj2 = SERVICES.scenefile.exportText({ name: 'sealed' }); check('scene file carries only the sealed claim', !fj2.includes('water to the line') && fj2.includes('omni-claim-vault/1'))
      await ok('unlock', 'Omni Claim unlock id(cup1) key(open sesame)'); check('unlocked: all accounts back', CL.get('cup1').testimonies.length === 3)
      const before = on.getNodeData('cup1').claimSealed.data; await ok('edit while private', 'Omni Claim testify id(cup1) by(bot7) kind(bot) verdict(true) from(0.1) to(0.2)'); await CL.flush(); await wait(300); check('editing a private claim re-seals it', on.getNodeData('cup1').claimSealed.data !== before)
      const V = await import('/utils/OmniClaimVault.js'); const back = await V.openClaim(on.getNodeData('cup1').claimSealed, 'open sesame'); check('the sealed copy holds the edit', back.testimonies.length === 4 && back.testimonies.some(t => t.entity.id === 'bot7'))
      await ok('public again', 'Omni Claim public id(cup1)'); check('public: plain claim, no seal', !!on.getNodeData('cup1').claim && !on.getNodeData('cup1').claimSealed)
      // V261: awareness, identification, branch realities, walk-in view
      await ok('aware 1', 'Omni Claim aware id(cup1) name(Camera) type(natural) familiar(colour) accepts(colour)'); await ok('aware 2', 'Omni Claim aware id(cup1) name(Policy desk) type(intentional) familiar(rumour)')
      await ok('identify unknown', 'Omni Claim identify id(cup1) subject(smell)'); await ok('identify branch', 'Omni Claim identify id(cup1) subject(rumour)')
      { const c = CL.get('cup1'); check('identify: a branch was born for the declined subject', c.branches.length === 1 && c.branches[0].subject === 'rumour', JSON.stringify(c.branches))
        const brId = c.branches[0].id; await ok('grow', 'Omni Claim grow id(cup1) branch(' + brId + ')'); const c2 = CL.get('cup1'); const nid = c2.branches[0].nodes[0]
        check('grow made a linked ClaimNode', !!nid && CL.isClaim(nid) && (on.getAllEdges?.() ?? on.edges ?? []).some?.(e => (e.from === 'cup1' && e.to === nid) || (e.source === 'cup1' && e.target === nid)) !== false, String(nid))
        if (nid) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: nid } })) }
      const CV = SERVICES.claimview; check('claim view service', !!CV)
      await ok('view on', 'Omni Claim view id(cup1)'); await wait(400)
      { const st = CV.stats('cup1'); check('walk-in: three rooms and particles', st.rooms.length === 3 && st.particles > 0 && CV.isShown('cup1'), JSON.stringify(st.rooms))
        CV.step('cup1', 0.05, 200); const gp = st.group.getObjectByName('omni-claim-particles').geometry.attributes.position.array; const half = Math.max(...st.rooms.map(r => r.edge)) * 3
        check('walk-in: particles stay near their rooms after stepping', Array.from(gp).every(v => Number.isFinite(v) && Math.abs(v) < half + 20))
        check('walk-in is overlay only, never saved', !SERVICES.scenefile.exportText({ name: 'v' }).includes('omni-claim-particles')) }
      await ok('view off', 'Omni Claim view id(cup1) state(off)'); check('walk-in closed', !CV.isShown('cup1'))
      await ok('claim list', 'Omni Claim list'); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: 'cup1' } })); window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: d1.out.nodeId } })); await wait(500); check('deleted claim leaves no chart', !getChart('cup1')) }
    // curve editor with Bezier handles (V254): real pointer events on the canvas
    { const { default: mk } = await import('/ui/OmniCurveEditor.js'); let last = null; const ed = mk({ points: [[0, 0], [0.5, 1], [1, 0]], onChange: (p) => { last = p } }); document.body.appendChild(ed.el); const cv = ed.el.querySelector('canvas'); await wait(50)
      const R = cv.getBoundingClientRect(); const px = (x) => R.left + (10 + x * 260) / 280 * R.width; const py = (y) => R.top + (10 + (1 - (y + 1) / 2) * 110) / 130 * R.height
      const ptr = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { clientX: px(x), clientY: py(y), pointerId: 1, bubbles: true, cancelable: true }))
      ptr('pointerdown', 0.5, 1); ptr('pointerup', 0.5, 1); ptr('pointerdown', 0.56, 1); ptr('pointermove', 0.75, 0.2); ptr('pointerup', 0.75, 0.2)
      const q = ed.points()[1]; check('dragging a handle bends the curve', q.length === 6 && q[4] > 0.1 && q[5] < -0.5, JSON.stringify(ed.points()))
      ed.el.querySelector('.ocv-smooth').click(); check('Smooth gives every point handles', ed.points().slice(1, -1).every(p => p.length === 6) && last.length === 3, JSON.stringify(ed.points()))
      ed.el.querySelector('.ocv-flat').click(); check('Straighten clears the selected point', ed.points()[1].length === 2, JSON.stringify(ed.points()))
      ed.destroy(); ed.el.remove() }
    // scene file extras (V253): lineups, doc windows, custom vibration programs, and a semantics skin survive export -> replace-import
    await ok('semantics cube for export', 'Omni Semantics create skin(contrast) id(sk1)')
    SERVICES.vibration.saveProgram({ id: 'smoke_prog', name: 'Smoke', channels: [{ prop: 'pos.y', wave: 'bounce', amp: 1 }] })
    const sf = SERVICES.scenefile; const txt = sf.exportText({ name: 'extras' }); const fj = JSON.parse(txt)
    check('file carries extras', !!fj.extras?.lineups?.lineups?.L && fj.extras.docwindows?.some(w => w.id === 'w2') && fj.extras.vibration?.some(p => p.id === 'smoke_prog'), Object.keys(fj.extras || {}).join())
    const faces = JSON.stringify(SERVICES.poly.getPoly('sk1')?.faces ?? SERVICES.poly.getPoly('sk1'))
    SERVICES.vibration.deleteProgram('smoke_prog')
    sf.importText(txt, { mode: 'replace' }); await wait(800)
    check('import restores the lineup', SERVICES.lineup.state().lineups.L?.order.join() === 'l3,l1,l2' || SERVICES.lineup.state().lineups.L?.order.length === 3, JSON.stringify(SERVICES.lineup.state().lineups.L))
    check('import restores the attachment', SERVICES.lineup.state().attach.t1?.to === 'l1', JSON.stringify(SERVICES.lineup.state().attach))
    check('import restores the doc window', !!SERVICES.docwindow.get('w2'), SERVICES.docwindow.list().map(w => w.id).join())
    check('import restores the vibration program', !!SERVICES.vibration.getProgram('smoke_prog'))
    check('semantics skin survives', JSON.stringify(SERVICES.poly.getPoly('sk1')?.faces ?? SERVICES.poly.getPoly('sk1')) === faces)
    const mtxt = sf.check(txt, { mode: 'merge' }); check('merge check renames clashing lineup and window', mtxt.ok && !!mtxt.extras.lineups?.lineups?.L_2 && mtxt.extras.docwindows?.some(w => w.id === 'w2_2'), mtxt.summary)
    return out
  })
  const failed = results.filter(r => !r.ok); const errors = errs.filter(e => !/ERR_FAILED/.test(e))
  const report = results.map(r => `${r.ok ? 'ok     ' : 'FAILED '} ${r.name}${r.ok ? '' : '  ->  ' + r.detail}`).join('\n') + `\n\n${results.length - failed.length}/${results.length} passed, ${errors.length} page error(s)` + (errors.length ? '\n' + errors.join('\n') : '')
  return { failed: failed.length + errors.length, report }
}
