/**
 * systems/OmniLangCommands.js (V219) — the built-in vocabulary of the Omni command language (grammar: utils/OmniLang.js, registry: utils/OmniLangRegistry.js).
 *
 *   Help        Omni Help [Keyword [action]]
 *   Sandbox     spawn | add | remove | list | remix | show | hide | lock | unlock | centre | clear
 *   Construction on | off | set | get | undo   (the painter: shape() color() size() radius() density() spacing() mode() rainbow())
 *   Remix       roll | undo | sparks            (scope() seed() what() scheme() layout() axiom())
 *   Draw        Omni Draw node(static|box|sphere|cone|cylinder|torus|...|note|dimensional) pos(x, y, z) label(...) color(#hex|name) scale(n | x, y, z) rotation(x, y, z) id(name) wireframe
 *   Node        list | get | set | select | delete   (id(name))
 *   Setting     list | get | set                    (path(hands.omnihand.speed) value(5))
 *   Axiom       get | set | list                    (axiom() perspective() mult())
 *   Vibration   start | stop | list                 (target(user|id) program() hold() attack() release())
 *   Dimension   create | tune | demo | undemo | list
 *   Space       create | list | plane | assign
 *   File        ls cat write mkdir rm mv cp cd pwd tree find usage run     (the OmniTerminal's own file system, utils/OmniVFS.js)
 * Handlers get (call, ctx) where ctx = { omniNode, camera, fs, depth }.  Every handler returns the text to print, or throws an Error with a plain message.
 */
import * as THREE from 'three'
import { registerOmni, listKeywords, getKeyword, getAction, runOmniScript, isOmniKeyword } from '../utils/OmniLangRegistry.js'
import { asVec3 } from '../utils/OmniLang.js'
import { formatOmniScript } from '../utils/OmniFormat.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as Hands from '../utils/OmniHandsSettings.js'
import { AXIOMS } from '../data/OmniAxiomData.js'

const GEOS = { static: 'BoxGeometry', box: 'BoxGeometry', sphere: 'SphereGeometry', cylinder: 'CylinderGeometry', cone: 'ConeGeometry', torus: 'TorusGeometry', torusknot: 'TorusKnotGeometry',
  octahedron: 'OctahedronGeometry', tetrahedron: 'TetrahedronGeometry', icosahedron: 'IcosahedronGeometry', dodecahedron: 'DodecahedronGeometry', plane: 'PlaneGeometry', circle: 'CircleGeometry', ring: 'RingGeometry', capsule: 'CapsuleGeometry' }
export const NODE_TYPES = [...Object.keys(GEOS), 'note', 'dimensional']
const ID_OK = /^[\w-]{1,64}$/
const rid = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const f3 = (v) => `(${v.map(x => +Number(x).toFixed(3)).join(', ')})`
const need = (v, what) => { if (v === undefined || v === null || v === '') throw new Error(`${what} is needed`); return v }
const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max)
function colorHex (v) {
  const c = new THREE.Color(); const t = String(v).trim()
  try { c.setStyle(/^[0-9a-f]{6}$/i.test(t) ? '#' + t : t) } catch (_) { throw new Error(`"${t}" is not a colour (try #ff8800 or a name like orange)`) }
  return '#' + c.getHexString()
}
function nodes (ctx) { if (!ctx.omniNode) throw new Error('the node system is not available here'); return ctx.omniNode }
function frontOfCamera (ctx) {
  const cam = ctx.camera; if (!cam) return [0, 1, 0]
  const d = new THREE.Vector3(); cam.getWorldDirection(d); const p = cam.position.clone().addScaledVector(d, 7); return [p.x, p.y, p.z]
}
const idOf = (call) => String(need(call.props.id ?? call.arg ?? call.words[0], 'id(...)'))
const send = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))
function fsOf (ctx) { const f = ctx.fs ?? SERVICES.fs; if (!f || !f._ready) throw new Error('the file system is still loading, try again in a moment'); return f }
const PATH = 'a file or folder path'
const pathOf = (call, i = 0, name = 'path') => String(need(call.props[name] ?? call.words.filter(w => w.toLowerCase() !== 'confirm' && w.toLowerCase() !== 'recursive' && w.toLowerCase() !== 'append' && w.toLowerCase() !== 'dry')[i], `${name}(...)`))

let done = false
export function registerOmniBuiltins () {
  if (done) return; done = true

  registerOmni('Help', 'show', { keywordSummary: 'what the language can do', keywordBare: true, summary: 'List keywords, or the actions of one: Omni Help Draw', props: {}, run (call) {
    const [kw, act] = call.words
    if (!kw) return listKeywords().map(k => `${k.name.padEnd(10)} ${k.summary}\n           ${k.actions.join(', ')}`).join('\n') + '\n\nOmni Help <Keyword> for one keyword, Omni Help <Keyword> <action> for one action.'
    const K = getKeyword(kw); if (!K) throw new Error(`no keyword "${kw}"`)
    if (!act) return `${K.name}: ${K.summary}\n` + [...K.actions.values()].map(a => `  ${a.name.padEnd(9)} ${a.summary ?? ''}`).join('\n')
    const A = getAction(kw, act); if (!A) throw new Error(`${K.name} has no action "${act}"`)
    return `Omni ${K.name} ${A.name}${A.arg ? `(${A.arg})` : ''}  ${A.summary ?? ''}\n` + Object.entries(A.props ?? {}).map(([p, d]) => `  ${p}(…)  ${d}`).join('\n') + (A.destructive ? '\n  confirm   required' : '')
  } })

  // ── Communication (V223): Receive / Route ──
  const comm = () => { const c = SERVICES.communication; if (!c) throw new Error('Communication is not running'); return c }
  const TUN = 'a tunnel: conscious, omnihand, lh, rh, x, y, z'
  const tun = (call, key = 'tunnel') => String(need(call.props[key] ?? call.words[0], `${key}(...)`)).toLowerCase()
  const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map(x => String(x).toLowerCase())
  registerOmni('Communication', 'status', { keywordSummary: 'tunnels as fields: receive, send and route nodes and messages', summary: 'Which tunnels are open and what they hold', props: {},
    run () { return comm().status().map(s => `${s.name.padEnd(13)} ${s.open ? 'OPEN  ' : 'closed'} ${s.muted ? 'muted ' : '      '} ${s.count}/${s.cap}  allow: ${s.allow.join(',') || 'nobody'}`).join('\n') } })
  registerOmni('Communication', 'receive', { summary: 'Open or close a tunnel to receive: Omni Communication receive tunnel(lh) open(true)', props: { tunnel: TUN, open: 'true | false (default true)' },
    run (call) { const t = tun(call), o = call.props.open === undefined ? true : call.props.open !== false; comm().setReceive(t, o); return `${t} is now ${o ? 'open to receive' : 'closed'}` } })
  registerOmni('Communication', 'mute', { summary: 'Mute a tunnel (stores arrivals silently)', props: { tunnel: TUN, on: 'true | false (default true)' },
    run (call) { const t = tun(call), o = call.props.on === undefined ? true : call.props.on !== false; comm().setMuted(t, o); return `${t} ${o ? 'muted' : 'unmuted'}` } })
  registerOmni('Communication', 'allow', { summary: 'Who may send to a tunnel: Omni Communication allow tunnel(lh) from(user, rh)  (from(*) = anyone)', props: { tunnel: TUN, from: '*, user, external or tunnels' },
    run (call) { const t = tun(call); return `${t} allows: ${comm().setAllow(t, list(call.props.from)).join(', ') || 'nobody'}` } })
  registerOmni('Communication', 'cap', { summary: 'How many pieces a tunnel holds (1..24)', props: { tunnel: TUN, n: 'number' }, run (call) { const t = tun(call); return `${t} holds up to ${comm().setCap(t, need(call.props.n, 'n(...)'))}` } })
  registerOmni('Communication', 'send', { summary: 'Send a node or a message into a tunnel: Omni Communication send to(lh) node(<id>) [via(x, rh)]  or  text("hello")', props: { to: TUN, node: 'node id', text: 'message', via: 'relay tunnels', label: 'title' },
    run (call) {
      const r = comm().send({ to: String(need(call.props.to, 'to(...)')).toLowerCase(), via: list(call.props.via), node: call.props.node, text: call.props.text === undefined ? undefined : String(call.props.text), label: call.props.label })
      if (!r.ok) throw new Error(r.error); return `Sent "${r.packet.label}" to ${r.packet.to} (id ${r.packet.id})` } })
  registerOmni('Communication', 'route', { summary: 'Move a held piece: Omni Communication route id(<piece>) from(lh) to(rh) [via(x)]', props: { id: 'piece id', from: TUN, to: TUN, via: 'relay tunnels' },
    run (call) {
      const r = comm().route({ id: String(need(call.props.id, 'id(...)')), from: String(need(call.props.from, 'from(...)')).toLowerCase(), to: String(need(call.props.to, 'to(...)')).toLowerCase(), via: list(call.props.via) })
      if (!r.ok) throw new Error(r.error); return `Routed "${r.packet.label}" to ${r.packet.to}` } })
  registerOmni('Communication', 'inbox', { summary: 'List what a tunnel holds', props: { tunnel: TUN },
    run (call) { const t = tun(call), l = comm().inbox(t); return l.length ? l.map(p => `${p.id}  ${p.pinned ? '📌' : '  '} ${p.kind === 'node' ? '◆' : '¶'} ${p.label}  (from ${p.from}${p.via.length ? ' via ' + p.via.join(',') : ''}, ${p.state})`).join('\n') : `${t} is empty` } })
  registerOmni('Communication', 'take', { summary: 'Place a held piece in the space: Omni Communication take tunnel(lh) id(<piece>) [pos(x, y, z)]', props: { tunnel: TUN, id: 'piece id', pos: 'x, y, z (default in front of you)' },
    run (call) { const r = comm().acquire(tun(call), String(need(call.props.id, 'id(...)')), { position: call.props.pos === undefined ? undefined : asVec3(call.props.pos, 'pos') }); if (!r.ok) throw new Error(r.error); return `Placed at (${r.position.join(', ')})` } })
  registerOmni('Communication', 'drop', { summary: 'Remove a held piece', props: { tunnel: TUN, id: 'piece id' }, run (call) { return comm().drop(tun(call), String(need(call.props.id, 'id(...)'))) ? 'Dropped' : 'No such piece' } })
  registerOmni('Communication', 'clear', { summary: 'Empty a tunnel (pinned pieces stay): Omni Communication clear tunnel(lh)', destructive: true, props: { tunnel: TUN }, run (call) { return `Cleared ${comm().clear(tun(call))} piece(s)` } })
  registerOmni('Communication', 'open', { summary: 'Open the OmniNodeAcquisitioner panel on a tunnel', props: { tunnel: TUN }, run (call) { const t = call.props.tunnel ?? call.words[0] ?? 'lh'; window.dispatchEvent(new CustomEvent('omni:acquisitioner-open', { detail: { tunnel: String(t).toLowerCase() } })); return 'OmniNodeAcquisitioner open' } })

  // ── IDE (V222) ──
  registerOmni('IDE', 'open', { keywordSummary: 'the in-space code editor', summary: 'Open the IDE, optionally on a file: Omni IDE open file(/home/scripts/hello.omni)', props: { file: PATH },
    run (call) { const p = call.props.file ?? call.props.path ?? call.words[0]; window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniIDE' } })); if (p !== undefined) window.dispatchEvent(new CustomEvent('omni:ide-open', { detail: { path: String(p) } })); return 'OmniIDE open' + (p !== undefined ? ': ' + p : '') } })

  // ── Boost (V220) ──
  const boostHand = (call) => { const h = String(call.props.hand ?? 'lh').toLowerCase(); if (h !== 'lh' && h !== 'rh') throw new Error('hand(...) must be lh or rh'); return h }
  const boosts = () => { const b = SERVICES.boost; if (!b) throw new Error('Boost is not running'); return b }
  registerOmni('Boost', 'start', { keywordSummary: 'hold-to-go-faster for the LH / RH', summary: 'Start boosting a hand until Omni Boost stop', props: { hand: 'lh | rh (default lh)' },
    run (call) { const h = boostHand(call); boosts().press(h); return `${h.toUpperCase()} boost on (×${boosts().factor(h).toFixed(1)} and rising)` } })
  registerOmni('Boost', 'stop', { summary: 'Stop boosting a hand', props: { hand: 'lh | rh (default lh)' },
    run (call) { const h = boostHand(call); boosts().release(h); return `${h.toUpperCase()} boost released` } })
  registerOmni('Boost', 'set', { summary: 'Change a boost setting: Omni Boost set key(mult) value(5)', props: { hand: 'lh | rh', key: 'mult|ramp|sustain|vibration|afterimage|glitch|blink|blinkms|blinkradius|ghostms', value: 'the new value' },
    run (call) {
      const h = boostHand(call); const map = { mult: 'boostMult', ramp: 'boostRamp', sustain: 'boostSustain', vibration: 'boostVibration', afterimage: 'boostAfterimage', glitch: 'boostGlitch', blink: 'boostBlink', blinkms: 'boostBlinkMs', blinkradius: 'boostBlinkRadius', ghostms: 'boostGhostMs' }
      const k = map[String(call.props.key ?? '').toLowerCase()]; if (!k) throw new Error('key(...) is one of: ' + Object.keys(map).join(', '))
      if (call.props.value === undefined) throw new Error('value(...) is needed')
      const v = Hands.setHandSetting(h, k, call.props.value); return `${h.toUpperCase()} ${k} = ${v}` } })

  // ── Orb (V221) ──
  registerOmni('Orb', 'open', { keywordSummary: 'the LH orb of possibility', summary: 'Open the LH orb', props: {}, run () { window.dispatchEvent(new CustomEvent('omni:orb-open', { detail: { hand: 'lh' } })); return 'LH orb open' } })
  registerOmni('Orb', 'close', { summary: 'Close the LH orb', props: {}, run () { window.dispatchEvent(new CustomEvent('omni:orb-close')); return 'LH orb closed' } })
  registerOmni('Orb', 'fire', { summary: 'Fire the loaded LH ammo as the orb does. Charge 0.4+ is a stronger shot; 0.98+ is the strongest and reaches wider', props: { charge: '0..1 (default 0)' }, run (call) {
    const c = Math.max(0, Math.min(1, Number(call.props.charge ?? 0) || 0)); window.dispatchEvent(new CustomEvent('omni:hand-activate', { detail: { hand: 'lh', charge: c } })); return c >= 0.98 ? 'Fired the loaded LH ammo (full charge)' : c >= 0.4 ? 'Fired the loaded LH ammo (strong)' : 'Fired the loaded LH ammo' } })
  registerOmni('Orb', 'words', { summary: 'Set the orbiting words: Omni Orb words value("Maybe, Open, ?")', props: { value: 'comma separated words' }, run (call) {
    if (call.props.value === undefined) { return (Hands.getHandSetting('lh', 'orbWords') ?? []).join(', ') }
    const list = (Array.isArray(call.props.value) ? call.props.value : String(call.props.value).split(',')).map(w => String(w).trim()).filter(Boolean)
    Hands.setHandSetting('lh', 'orbWords', list); return 'Orb words: ' + (Hands.getHandSetting('lh', 'orbWords') ?? []).join(', ') } })

  // ── Sandbox (V226) ──
  const sbx = () => { if (!SERVICES.sandbox) throw new Error('the sandbox is not running'); return SERVICES.sandbox }
  registerOmni('Sandbox', 'spawn', { keywordSummary: 'a marked-off area for experiments, apart from your portfolio', summary: 'Omni Sandbox spawn [n(6)] [seed(7)] [layout(ring)] [scheme(triad)] [axiom(time)]  (add remix(false) to leave them plain)',
    props: { n: 'how many (1..24, default 6)', seed: 'any number or word', layout: 'scatter | ring | spiral | grid | stack', scheme: 'analogous | triad | complement | split | mono', axiom: 'limit the labels to one axiom', remix: 'false leaves the new nodes plain' },
    run (call) { const p = call.props; return sbx().spawn({ n: p.n, seed: p.seed, layout: p.layout === undefined ? undefined : String(p.layout).toLowerCase(), scheme: p.scheme === undefined ? undefined : String(p.scheme).toLowerCase(), axiom: p.axiom === undefined ? undefined : String(p.axiom).toLowerCase(), remix: p.remix === false || String(p.remix).toLowerCase() === 'false' ? false : true }).text } })
  registerOmni('Sandbox', 'add', { arg: 'id', summary: 'Move an existing node into the Sandbox: Omni Sandbox add(id)  (leave out id for the selected node)', props: { id: 'node id' }, run (call, ctx) { const id = call.arg !== undefined ? String(call.arg) : (call.props.id ?? nodes(ctx).getSelectedId?.()); if (!id) throw new Error('give an id, or select a node'); sbx().add(String(id)); return `Added ${id} to the Sandbox (it stays where it is)` } })
  registerOmni('Sandbox', 'remove', { arg: 'id', summary: 'Take a node out of the Sandbox (it is not deleted)', props: { id: 'node id' }, run (call, ctx) { const id = call.arg !== undefined ? String(call.arg) : (call.props.id ?? nodes(ctx).getSelectedId?.()); if (!id) throw new Error('give an id, or select a node'); sbx().remove(String(id)); return `Took ${id} out of the Sandbox` } })
  registerOmni('Sandbox', 'list', { summary: 'What is in the Sandbox and where it is', props: {}, run (call, ctx) { const ids = sbx().ids(), on = nodes(ctx); return `Spawn point (${sbx().getCentre().join(', ')})  ${ids.length} node(s)` + (ids.length ? '\n' + ids.map(i => `  ${i}  ${on.getNodeData?.(i)?.label ?? ''}`).join('\n') : '') } })
  registerOmni('Sandbox', 'remix', { summary: 'Remix only the Sandbox: Omni Sandbox remix [seed()] [what()] [scheme()] [layout()] [axiom()]', props: { seed: 'any number or word', what: 'color, scale, spin, label, motion, layout', scheme: 'analogous | triad | complement | split | mono', layout: 'scatter | ring | spiral | grid | stack', axiom: 'limit the labels to one axiom' },
    run (call) { const p = call.props; return sbx().remix({ seed: p.seed, what: words(p.what), scheme: p.scheme === undefined ? undefined : String(p.scheme).toLowerCase(), layout: p.layout === undefined ? undefined : String(p.layout).toLowerCase(), axiom: p.axiom === undefined ? undefined : String(p.axiom).toLowerCase() }).text } })
  registerOmni('Sandbox', 'show', { summary: 'Show the Sandbox', props: {}, run: () => (sbx().setShown(true), 'Sandbox shown') })
  registerOmni('Sandbox', 'hide', { summary: 'Hide the Sandbox (your portfolio view stays clean)', props: {}, run: () => (sbx().setShown(false), 'Sandbox hidden') })
  registerOmni('Sandbox', 'lock', { summary: 'Lock the Sandbox so behaviours stop moving its nodes', props: {}, run: () => (sbx().setLocked(true), 'Sandbox locked') })
  registerOmni('Sandbox', 'unlock', { summary: 'Unlock the Sandbox', props: {}, run: () => (sbx().setLocked(false), 'Sandbox unlocked') })
  registerOmni('Sandbox', 'centre', { summary: 'Where new Sandbox nodes appear: Omni Sandbox centre pos(60, 1, 0)  (no pos: use the spot in front of the camera)', props: { pos: 'x, y, z' }, run (call, ctx) { const c = call.props.pos !== undefined ? asVec3(call.props.pos, 'pos') : frontOfCamera(ctx); return `Sandbox spawn point (${sbx().centre(c).join(', ')})` } })
  registerOmni('Sandbox', 'clear', { summary: 'Delete every node in the Sandbox and nothing else: Omni Sandbox clear confirm', destructive: true, props: {}, run: () => `Deleted ${sbx().clear()} Sandbox node(s)` })

  // ── Construction (V232) ──
  const cons = () => { if (!SERVICES.construction) throw new Error('OmniConstruction is not running'); return SERVICES.construction }
  const BRUSH_PROPS = { shape: 'box, sphere, cone, cylinder, torus, octahedron, icosahedron, dodecahedron, tetrahedron', color: '#rrggbb', size: 'piece size 0.1..4', radius: 'spray radius 0..10', density: 'pieces per step 1..8', spacing: 'min distance between steps 0.1..5', jitterColor: 'colour wobble 0..1', mode: 'ground | air', height: 'ground plane height', distance: 'air distance 2..60', rainbow: 'true cycles hues' }
  const brushPatch = (pr) => { const o = {}; for (const k of Object.keys(BRUSH_PROPS)) if (pr[k] !== undefined) o[k] = pr[k]; return o }
  registerOmni('Construction', 'on', { keywordSummary: 'the painter: drag to spray nodes into the Sandbox', summary: 'Omni Construction on [shape(box)] [color(#ff8800)] [size(.5)] [radius(1.5)] [density(3)] [mode(ground|air)] [rainbow(true)]', props: BRUSH_PROPS, run (call) { const p = brushPatch(call.props); if (Object.keys(p).length) cons().set(p); cons().arm(true); return 'Painter on: drag in the scene. Esc or Omni Construction off to stop.' } })
  registerOmni('Construction', 'off', { summary: 'Turn the painter off', props: {}, run: () => (cons().arm(false), 'Painter off') })
  registerOmni('Construction', 'set', { summary: 'Change the brush without turning it on', props: BRUSH_PROPS, run (call) { const s = cons().set(brushPatch(call.props)); return Object.entries(s).map(([k, v]) => `${k}: ${v}`).join('\n') } })
  registerOmni('Construction', 'get', { summary: 'Show the brush', props: {}, run: () => { const c = cons(); return `${c.armed ? 'ON' : 'off'}, ${c.strokes()} stroke(s) to undo\n` + Object.entries(c.get()).map(([k, v]) => `${k}: ${v}`).join('\n') } })
  registerOmni('Construction', 'undo', { summary: 'Take back the last stroke', props: {}, run: () => `Took back ${cons().undo()} piece(s)` })

  // ── Remix (V226) ──
  const rmx = () => { if (!SERVICES.remix) throw new Error('the remix system is not running'); return SERVICES.remix }
  const words = (v) => v === undefined ? undefined : (Array.isArray(v) ? v : String(v).split(/[,\s]+/)).map(x => String(x).trim().toLowerCase()).filter(Boolean)
  registerOmni('Remix', 'roll', { keywordSummary: 'random combinations on the nodes, for ideas', summary: 'Omni Remix roll [scope(all|selected|sandbox)] [seed(7)] [what(color, scale, spin, label, motion, layout)] [scheme(triad)] [layout(ring)] [axiom(time)]',
    props: { scope: 'all (default) | selected | sandbox', seed: 'any number or word: the same seed deals the same again', what: 'color, scale, spin, label, motion, layout (default: color, scale, spin, label)', scheme: 'analogous | triad | complement | split | mono', layout: 'scatter | ring | spiral | grid | stack', axiom: 'limit the labels to one axiom' },
    run (call) { const p = call.props; return rmx().roll({ scope: p.scope === undefined ? (rmx()._selectedId() ? 'selected' : 'all') : String(p.scope).toLowerCase(), seed: p.seed, what: words(p.what), scheme: p.scheme === undefined ? undefined : String(p.scheme).toLowerCase(), layout: p.layout === undefined ? undefined : String(p.layout).toLowerCase(), axiom: p.axiom === undefined ? undefined : String(p.axiom).toLowerCase() }).text } })
  registerOmni('Remix', 'undo', { summary: 'Put the last remix back', props: {}, run: () => `Restored ${rmx().undo()} node(s)` })
  registerOmni('Remix', 'sparks', { summary: 'Ideas as text only; nothing changes: Omni Remix sparks n(5)', props: { n: 'how many (1..12)', seed: 'any number or word' }, run (call) { return rmx().sparks(Number(call.props.n ?? 5) || 5, call.props.seed).join('\n') } })

  // ── Draw ──
  registerOmni('Draw', 'node', { keywordSummary: 'put things in the space', arg: 'type', summary: 'Create a node. Types: ' + NODE_TYPES.join(', ') + ' (static = a plain box that nothing moves)',
    props: { pos: 'x, y, z (default: in front of the camera)', label: 'the name shown', color: '#hex or a colour name', scale: 'one number or x, y, z', rotation: 'x, y, z in degrees', id: 'your own id to refer to it later' },
    run (call, ctx) {
      const type = String(call.arg ?? 'static').toLowerCase()
      if (!NODE_TYPES.includes(type)) throw new Error(`"${call.arg}" is not a node type (${NODE_TYPES.join(', ')})`)
      const on = nodes(ctx), p = call.props
      const id = p.id !== undefined ? String(p.id) : rid(); if (!ID_OK.test(id)) throw new Error('id(...) can use letters, numbers, - and _ (up to 64)')
      if (on.getNodeData?.(id)) throw new Error(`a node with id "${id}" already exists`)
      const position = p.pos !== undefined ? asVec3(p.pos, 'pos') : frontOfCamera(ctx)
      const label = p.label !== undefined ? str(p.label, 40) : undefined
      if (type === 'note') send('omni:note-node-create', { id, position, label, select: false })
      else if (type === 'dimensional') { const r = SERVICES.dimensional?.create({ id, position, label }); if (!r?.ok) throw new Error(r?.error ?? 'the dimensional node system is not running') }
      else {
        const scale = p.scale === undefined ? [1, 1, 1] : (typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : asVec3(p.scale, 'scale'))
        const rot = p.rotation === undefined ? [0, 0, 0] : asVec3(p.rotation, 'rotation').map(d => d * Math.PI / 180)
        send('omni:node-create-request', { id, label, geometry: GEOS[type], primitive: 'objective', color: p.color !== undefined ? colorHex(p.color) : '#ffffff', position, scale, rotation: rot, wireframe: call.has('wireframe') || p.wireframe === true, noParent: true, noSelect: true })
      }
      if (!on.getNodeData?.(id)) throw new Error('the node could not be created')
      if (p.color !== undefined && (type === 'note' || type === 'dimensional')) send('omni:node-color-set', { id, color: colorHex(p.color) })
      return `Created ${type} node ${id} at ${f3(position)}`
    } })

  // ── Node ──
  const NODE_PROPS = { id: 'the node id', pos: 'x, y, z', rotation: 'x, y, z in degrees', scale: 'n or x, y, z', label: 'new name', color: '#hex or a colour name' }
  registerOmni('Node', 'list', { keywordSummary: 'find and change nodes', summary: 'List nodes (up to 100)', props: {}, run (call, ctx) {
    const all = nodes(ctx).getAllNodes?.() ?? []; if (!all.length) return 'No nodes yet.'
    return all.slice(0, 100).map(n => `${n.id}  ${n.label ?? ''}  ${n.geometry ?? ''}  ${n.position ? f3(n.position) : ''}`).join('\n') + (all.length > 100 ? `\n… and ${all.length - 100} more` : '')
  } })
  registerOmni('Node', 'get', { arg: 'id', summary: 'Show one node', props: { id: NODE_PROPS.id }, run (call, ctx) {
    const id = idOf(call), d = nodes(ctx).getNodeData?.(id); if (!d) throw new Error(`no node "${id}"`)
    const m = nodes(ctx).getMeshById?.(id), p = m ? [m.position.x, m.position.y, m.position.z] : d.position
    return [`id        ${d.id}`, `label     ${d.label ?? ''}`, `kind      ${d.nodeKind ?? d.geometry ?? ''}`, `pos       ${f3(p ?? [0, 0, 0])}`, `color     ${d.color ?? ''}`, `scale     ${d.scale ? f3(d.scale) : ''}`].join('\n')
  } })
  registerOmni('Node', 'set', { arg: 'id', summary: 'Change a node', props: NODE_PROPS, run (call, ctx) {
    const id = idOf(call), on = nodes(ctx), m = on.getMeshById?.(id), p = call.props; if (!m || !on.getNodeData?.(id)) throw new Error(`no node "${id}"`)
    const did = []
    if (p.pos !== undefined) { const v = asVec3(p.pos, 'pos'); m.position.set(...v); send('omni:node-pos-set', { id, position: v }); did.push('pos') }
    if (p.rotation !== undefined) { const v = asVec3(p.rotation, 'rotation').map(d => d * Math.PI / 180); m.rotation.set(...v); send('omni:node-rotation-set', { id, rotation: v }); did.push('rotation') }
    if (p.scale !== undefined) { const v = typeof p.scale === 'number' ? [p.scale, p.scale, p.scale] : asVec3(p.scale, 'scale'); m.scale.set(...v); send('omni:node-scale-set', { id, scale: v }); did.push('scale') }
    if (p.label !== undefined) { send('omni:node-label-set', { id, label: str(p.label, 40) }); did.push('label') }
    if (p.color !== undefined) { send('omni:node-color-set', { id, color: colorHex(p.color) }); did.push('color') }
    if (!did.length) throw new Error('nothing to change: give pos(...), rotation(...), scale(...), label(...) or color(...)')
    return `Changed ${id}: ${did.join(', ')}`
  } })
  registerOmni('Node', 'select', { arg: 'id', summary: 'Select a node', props: { id: NODE_PROPS.id }, run (call, ctx) { const id = idOf(call); if (!nodes(ctx).getNodeData?.(id)) throw new Error(`no node "${id}"`); send('omni:node-select-by-id', { id }); return `Selected ${id}` } })
  registerOmni('Node', 'delete', { arg: 'id', summary: 'Delete a node for good', destructive: true, props: { id: NODE_PROPS.id }, run (call, ctx) { const id = idOf(call); if (!nodes(ctx).getNodeData?.(id)) throw new Error(`no node "${id}"`); send('omni:node-delete-request', { id }); return `Deleted ${id}` } })

  // ── Setting ──
  const handPath = (path) => { const m = /^hands\.(lh|rh|conscious|omnihand)\.(\w+)$/i.exec(String(path ?? '')); if (!m) throw new Error('path looks like hands.omnihand.speed (hands.<lh|rh|conscious|omnihand>.<setting>)'); return [m[1].toLowerCase(), m[2]] }
  registerOmni('Setting', 'list', { keywordSummary: 'read and change settings', summary: 'List the hand settings you can reach', props: { path: 'hands.<hand> to list one hand' }, run (call) {
    const hands = call.props.path ? [handPath(call.props.path + '.x')[0]] : Hands.HAND_IDS
    return hands.map(h => Object.entries(Hands.getHandSettings(h)).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `hands.${h}.${k} = ${v}`).join('\n')).join('\n')
  } })
  registerOmni('Setting', 'get', { arg: 'path', summary: 'Read one setting: Omni Setting get path(hands.omnihand.speed)', props: { path: 'hands.<hand>.<setting>' }, run (call) { const [h, k] = handPath(call.props.path ?? call.arg); const v = Hands.getHandSetting(h, k); if (v === undefined) throw new Error(`"${k}" is not a setting of ${h}`); return `hands.${h}.${k} = ${Array.isArray(v) ? v.join(', ') : v}` } })
  registerOmni('Setting', 'set', { arg: 'path', summary: 'Change one setting: Omni Setting set path(hands.omnihand.speed) value(5)', props: { path: 'hands.<hand>.<setting>', value: 'the new value' }, run (call) {
    const [h, k] = handPath(call.props.path ?? call.arg); if (Hands.getHandSetting(h, k) === undefined) throw new Error(`"${k}" is not a setting of ${h}`)
    const v = Hands.setHandSetting(h, k, call.props.value); return `hands.${h}.${k} = ${v}`
  } })

  // ── Axiom ──
  const ax = () => { if (!SERVICES.axioms) throw new Error('the axiom system is not running'); return SERVICES.axioms }
  const axText = () => { const a = ax(); return `${a.axiomDef.name} / ${a.perspectiveDef.name}${a.perspectiveDef.mult ? ` ×${a.mult}` : ''}  (motion ×${+a.timeScale().toFixed(3)})` }
  registerOmni('Axiom', 'get', { keywordSummary: 'the OmniHand axiom and ConsciousHand perspective', summary: 'Show the current axiom and perspective', props: {}, run: () => axText() })
  registerOmni('Axiom', 'list', { summary: 'List the axioms and their perspectives', props: {}, run: () => AXIOMS.map(a => `${a.name}: ${a.perspectives.map(p => p.id).join(', ')}`).join('\n') })
  registerOmni('Axiom', 'set', { summary: 'Omni Axiom set axiom(time) perspective(slowmo) mult(10)', props: { axiom: 'identity | information | space | time | power | expression', perspective: 'a perspective id of that axiom', mult: 'the multiplier, where the perspective has one' }, run (call) {
    const a = ax(), p = call.props
    if (p.axiom !== undefined && !a.setAxiom(String(p.axiom).toLowerCase()) && a.axiom !== String(p.axiom).toLowerCase()) throw new Error(`no axiom "${p.axiom}"`)
    if (p.perspective !== undefined && !a.setPerspective(String(p.perspective).toLowerCase()) && a.perspective !== String(p.perspective).toLowerCase()) throw new Error(`"${p.perspective}" is not a perspective of ${a.axiomDef.name}`)
    if (p.mult !== undefined) a.setMult(p.mult)
    return axText()
  } })

  // ── Vibration ──
  const vb = () => { if (!SERVICES.vibration) throw new Error('the vibration system is not running'); return SERVICES.vibration }
  registerOmni('Vibration', 'start', { keywordSummary: 'looped, rhythmic motion', summary: 'Omni Vibration start target(user) program(bounce) hold(5)', props: { target: 'user or a node id', program: 'bounce, hop, sway, pulse, shake, float, dance or yours', hold: 'seconds to sustain, 0 = until stopped', attack: 'seconds', release: 'seconds' }, run (call) {
    const p = call.props, id = vb().start(String(p.target ?? 'user'), String(p.program ?? 'bounce'), { hold: p.hold, attack: p.attack, release: p.release })
    if (!id) throw new Error('could not start (check target(...) and program(...))'); return `Started ${p.program ?? 'bounce'} on ${p.target ?? 'user'} (${id})`
  } })
  registerOmni('Vibration', 'stop', { summary: 'Stop a target (releases): Omni Vibration stop target(user)', props: { target: 'user or a node id; leave out for all', immediate: 'true to snap back' }, run (call) {
    const p = call.props, n = p.target === undefined ? vb().stopAll({ immediate: p.immediate === true }) : vb().stop(String(p.target), { immediate: p.immediate === true }); return `Stopping ${n} vibration${n === 1 ? '' : 's'}`
  } })
  registerOmni('Vibration', 'list', { summary: 'What is vibrating, and the programs', props: {}, run: () => `Running: ${vb().runs().map(r => `${r.target}:${r.program}`).join(', ') || 'nothing'}\nPrograms: ${vb().programs().map(p => p.id).join(', ')}` })

  // ── Dimension ──
  const dm = () => { if (!SERVICES.dimensional) throw new Error('the dimensional node system is not running'); return SERVICES.dimensional }
  registerOmni('Dimension', 'create', { keywordSummary: 'dimensional nodes', summary: 'Omni Dimension create axiom(time) perspective(slowmo) signature("Lag") pos(0, 2, 0)', props: { axiom: 'axiom id', perspective: 'perspective id or *', signature: 'text shown when revealed', mode: 'xray | signature', pos: 'x, y, z', id: 'your own id' }, run (call, ctx) {
    const p = call.props, r = dm().create({ id: p.id !== undefined ? String(p.id) : undefined, position: p.pos !== undefined ? asVec3(p.pos, 'pos') : frontOfCamera(ctx), dimensional: { axiom: p.axiom !== undefined ? String(p.axiom).toLowerCase() : (SERVICES.axioms?.axiom ?? 'time'), perspective: p.perspective !== undefined ? String(p.perspective).toLowerCase() : '*', signature: p.signature !== undefined ? str(p.signature, 60) : 'Signature', mode: p.mode } })
    if (!r.ok) throw new Error(r.error); return `Created dimensional node ${r.nodeId}`
  } })
  registerOmni('Dimension', 'tune', { arg: 'id', summary: 'Retune a dimensional node', props: { id: 'node id', axiom: 'axiom id', perspective: 'perspective id or *', signature: 'text', mode: 'xray | signature' }, run (call) {
    const id = idOf(call), p = call.props, patch = {}; for (const k of ['axiom', 'perspective', 'signature', 'mode']) if (p[k] !== undefined) patch[k] = k === 'signature' ? str(p[k], 60) : String(p[k]).toLowerCase()
    if (!dm().tune(id, patch)) throw new Error(`"${id}" is not a dimensional node`); return `Tuned ${id}`
  } })
  registerOmni('Dimension', 'demo', { summary: 'Scatter the demo nodes', props: {}, run: () => `${dm().spawnDemo()} demo nodes scattered` })
  registerOmni('Dimension', 'undemo', { summary: 'Remove the demo nodes', props: {}, run: () => `${dm().removeDemo()} demo nodes removed` })
  registerOmni('Dimension', 'list', { summary: 'List dimensional nodes and whether this view reveals them', props: {}, run: () => dm().list().map(id => `${id}  ${dm().isRevealed(id) ? 'revealed' : 'veiled'}`).join('\n') || 'No dimensional nodes.' })

  // ── Space ──
  const sp = () => { if (!SERVICES.spaces) throw new Error('the spaces system is not running'); return SERVICES.spaces }
  registerOmni('Space', 'create', { keywordSummary: 'dimensional spaces and planes', summary: 'Omni Space create name(Hall)', props: { name: 'the space name' }, run (call) { const s = sp().createSpace(call.props.name !== undefined ? str(call.props.name, 30) : undefined); if (!s) throw new Error('could not create a space'); return `Created space ${s.name} (${s.id})` } })
  registerOmni('Space', 'list', { summary: 'List spaces and planes', props: {}, run: () => sp().spaces.map(s => `${s.name} (${s.id})\n` + s.planes.map(p => `  ${p.name} (${p.id}) ${p.visible ? 'shown' : 'hidden'}${p.locked ? ' locked' : ''}  ${Object.values(s.members).filter(v => v === p.id).length} nodes`).join('\n')).join('\n') || 'No spaces.' })
  registerOmni('Space', 'plane', { summary: 'Add or change a plane: Omni Space plane space(sp_x) name(Upper) visible(false) locked(true) plane(pl_x)', props: { space: 'space id', plane: 'plane id (to change one)', name: 'name', visible: 'true | false', locked: 'true | false' }, run (call) {
    const p = call.props, id = String(need(p.space, 'space(...)'))
    if (p.plane === undefined) { const pl = sp().addPlane(id, p.name !== undefined ? str(p.name, 30) : undefined); if (!pl) throw new Error('could not add a plane'); return `Added plane ${pl.name} (${pl.id})` }
    const patch = {}; if (p.name !== undefined) patch.name = str(p.name, 30); if (typeof p.visible === 'boolean') patch.visible = p.visible; if (typeof p.locked === 'boolean') patch.locked = p.locked
    if (!sp().setPlane(id, String(p.plane), patch)) throw new Error('no such space or plane'); return 'Plane changed'
  } })
  registerOmni('Space', 'assign', { summary: 'Omni Space assign id(node) space(sp_x) plane(pl_x)', props: { id: 'node id', space: 'space id (leave out to take the node out of its space)', plane: 'plane id' }, run (call) {
    const p = call.props, id = String(need(p.id, 'id(...)'))
    if (p.space === undefined) return sp().unassign(id) ? `Took ${id} out` : `${id} was not in a space`
    if (!sp().assign(id, String(p.space), p.plane !== undefined ? String(p.plane) : undefined)) throw new Error('could not assign (check space(...) and plane(...))'); return `Assigned ${id}`
  } })

  // ── File ──
  const rows = (list) => list.map(e => `${e.type === 'dir' ? 'd' : '-'} ${String(e.size).padStart(8)}  ${e.name}${e.type === 'dir' ? '/' : ''}`).join('\n') || '(empty)'
  registerOmni('File', 'ls', { keywordSummary: 'the OmniTerminal file system (kept in this browser)', summary: 'List a folder: Omni File ls /home', props: { path: PATH }, run: (call, ctx) => rows(fsOf(ctx).ls(call.props.path ?? call.words[0] ?? '.')) })
  registerOmni('File', 'cat', { summary: 'Show a file: Omni File cat /home/readme.txt', props: { path: PATH }, run: (call, ctx) => fsOf(ctx).read(pathOf(call)) })
  registerOmni('File', 'write', { summary: 'Write text: Omni File write /home/notes/a.txt text("hello") [append]', props: { path: PATH, text: 'the text' }, run (call, ctx) { const r = fsOf(ctx).write(pathOf(call), str(call.props.text ?? '', 1_000_000).replace(/\\n/g, '\n'), { append: call.has('append') }); return `Wrote ${r.size} characters to ${r.path}` } })
  registerOmni('File', 'mkdir', { summary: 'Make a folder', props: { path: PATH }, run: (call, ctx) => `Made ${fsOf(ctx).mkdir(pathOf(call))}` })
  registerOmni('File', 'rm', { summary: 'Remove a file or folder for good: Omni File rm /tmp/x confirm [recursive]', destructive: true, props: { path: PATH }, run: (call, ctx) => `Removed ${fsOf(ctx).rm(pathOf(call), { recursive: call.has('recursive') })}` })
  registerOmni('File', 'mv', { summary: 'Move or rename: Omni File mv from(/tmp/a) to(/home/a)', props: { from: PATH, to: PATH }, run: (call, ctx) => `Moved to ${fsOf(ctx).mv(pathOf(call, 0, 'from'), String(need(call.props.to ?? call.words[1], 'to(...)')))}` })
  registerOmni('File', 'cp', { summary: 'Copy: Omni File cp from(/tmp/a) to(/home/a)', props: { from: PATH, to: PATH }, run: (call, ctx) => `Copied to ${fsOf(ctx).cp(pathOf(call, 0, 'from'), String(need(call.props.to ?? call.words[1], 'to(...)')))}` })
  registerOmni('File', 'cd', { summary: 'Change the working folder', props: { path: PATH }, run: (call, ctx) => fsOf(ctx).cd(pathOf(call)) })
  registerOmni('File', 'pwd', { summary: 'Show the working folder', props: {}, run: (call, ctx) => fsOf(ctx).pwd() })
  registerOmni('File', 'tree', { summary: 'Show a folder as a tree', props: { path: PATH }, run: (call, ctx) => fsOf(ctx).tree(call.props.path ?? call.words[0] ?? '.').join('\n') })
  registerOmni('File', 'find', { summary: 'Find by name: Omni File find pattern(*.omni)', props: { pattern: 'name with * and ?', path: 'where to look' }, run: (call, ctx) => fsOf(ctx).find(String(need(call.props.pattern ?? call.words[0], 'pattern(...)')), call.props.path ?? '/').join('\n') || 'Nothing found.' })
  registerOmni('File', 'usage', { summary: 'How much of the file system is used', props: {}, run: (call, ctx) => { const u = fsOf(ctx).usage(); return `${u.entries} of ${u.limits.entries} entries, ${u.chars.toLocaleString()} of ${u.limits.total.toLocaleString()} characters` } })
  registerOmni('File', 'format', { summary: 'Tidy an .omni script in place: Omni File format /home/scripts/hello.omni [prefix(remove)]', props: { path: PATH, prefix: 'add (default) | remove | keep' }, run (call, ctx) {
    const path = pathOf(call), pre = String(call.props.prefix ?? 'add').toLowerCase(); if (!['add', 'remove', 'keep'].includes(pre)) throw new Error('prefix(...) is add, remove or keep')
    const r = formatOmniScript(fsOf(ctx).read(path), { prefix: pre }); if (r.changed) fsOf(ctx).write(path, r.text)
    return `${path}: ${r.changed ? 'formatted' : 'already tidy'}${r.errors.length ? `; ${r.errors.length} line(s) could not be read: ${r.errors.map(e => `line ${e.line} (${e.message})`).join(', ')}` : ''}` } })
  registerOmni('File', 'run', { summary: 'Run a script of Omni commands: Omni File run /home/scripts/hello.omni [dry]', props: { path: PATH }, async run (call, ctx) {
    if ((ctx.depth ?? 0) >= 3) throw new Error('scripts can run other scripts only 3 deep')
    const path = pathOf(call), text = fsOf(ctx).read(path)
    const res = await runOmniScript(text, { ...ctx, depth: (ctx.depth ?? 0) + 1 }, { dry: call.has('dry') })
    const lines = res.results.map(r => `${String(r.line).padStart(3)}  ${r.ok ? '✓' : '✗'} ${r.ok ? r.output : r.error}`)
    if (!res.ok) throw new Error(`${path} stopped at line ${res.results.at(-1).line}\n${lines.join('\n')}`)
    return `${path}: ${res.results.length} command${res.results.length === 1 ? '' : 's'} ${call.has('dry') ? 'checked' : 'ran'}\n${lines.join('\n')}`
  } })
}
export { isOmniKeyword }
