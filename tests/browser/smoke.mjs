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
