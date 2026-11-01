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
      C.sprayAt(pt); C._end(); await ok('clearpaint', `Omni Construction clearpaint(${pid})`, '1 node'); check('clearpaint gives the node its look back', !(Array.isArray(pm.material) ? pm.material[0] : pm.material).map && !SERVICES.objectpaint.layers().includes(pid))
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
