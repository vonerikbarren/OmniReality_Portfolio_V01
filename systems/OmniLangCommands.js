/**
 * systems/OmniLangCommands.js (V219) — the built-in vocabulary of the Omni command language (grammar: utils/OmniLang.js, registry: utils/OmniLangRegistry.js).
 *
 *   Help        Omni Help [Keyword [action]]
 *   Sandbox     spawn | add | remove | list | remix | show | hide | lock | unlock | centre | clear
 *   Construction on | off | set | get | undo   (the painter: shape() color() size() radius() density() spacing() mode() rainbow())
 *   Orb         open | close | fire | words | summon | list | clear   (hand(lh|rh|conscious|omnihand))
 *   Open        hand(lh|rh|conscious|omni) context(menu|pad|tools|orbiter) state(open|close|toggle)
 *   Demo        play | stop | list                (name(meaning) speed() captions() keep(); a 10-second sequence of meaning shown by change)
 *   Doc         layout | layouts               (id() layout(row|grid|tunnel|helix|sphereIn|sphereOut) pages(1|2|4|6|8|10|25) start(1): the pages of a doc node laid out in space)
 *   Semantics   create | face | list            (the six-face skin: skin(default|plain|contrast|blank) id() pos(); face id() axiom() icon() label() event())
 *   Lineup      create | place | take | arrange | delete | attach | detach | list | walk | next | prev | halt  (walk id() seconds() hold() distance() from() loop() auto(): the camera visits each node in sequence order)   (id() layout() ids(a, b, c) node() to() index(): a sequence of nodes on a shape; attach carries a node at another's core)
 *   Doc         window | flip | goto | windows | unwindow   (sheets in a layout that page through a long document, turned like a carousel)
 *   Decor       list | show | hide                 (name(landingRoom|portalSpheres|trackingNodes); the old starting shapes, off by default; reload to apply)
 *   Scene       export | check | import           (the .omni.json scene file: name() path() mode(replace|merge))
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
import * as TM from '../utils/OmniTimeModel.js'
import { registerOmni, listKeywords, getKeyword, getAction, runOmniScript, isOmniKeyword } from '../utils/OmniLangRegistry.js'
import { asVec3 } from '../utils/OmniLang.js'
import { formatOmniScript } from '../utils/OmniFormat.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as Hands from '../utils/OmniHandsSettings.js'
import * as Decor from '../utils/OmniSceneDecor.js'
import * as M_DEMO from '../utils/OmniMeaningDemoModel.js'
import * as DPL from '../utils/OmniDocPageLayouts.js'
import * as SK from '../utils/OmniSemanticsSkin.js'
import { describe as WM_DESCRIBE } from '../utils/OmniDocWindowModel.js'
import * as LU from '../utils/OmniLineupModel.js'
import { setFace as P_setFace } from '../utils/OmniPolyModel.js'
import { AXIOMS } from '../data/OmniAxiomData.js'
import { defaultPool } from '../utils/OmniOrbPotentials.js'

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

  registerOmni('IDE', 'theme', { arg: 'name', summary: 'Show or change the IDE theme: Omni IDE theme(midnight)  (omni-dark, midnight, paper, terminal, dusk). Saved in /home/settings_IDE.json', props: { name: 'theme name' },
    run (call) { const d = { name: call.arg !== undefined ? call.arg : call.props.name }; window.dispatchEvent(new CustomEvent('omni:ide-theme-request', { detail: d })); if (d.error) throw new Error(d.error); if (d.out === undefined) throw new Error('the IDE is not running here'); return d.name === undefined ? 'IDE theme: ' + d.out : 'IDE theme is now ' + d.out } })
  registerOmni('IDE', 'settings', { summary: 'Open /home/settings_IDE.json in the IDE (themes, fonts, opacity, text shadow, file-tree shade, bracket options, extensions)', props: {},
    run () { const d = {}; window.dispatchEvent(new CustomEvent('omni:ide-settings-request', { detail: d })); if (d.error) throw new Error(d.error); if (!d.out) throw new Error('the IDE is not running here'); return 'Opened ' + d.out + ' in the IDE. Save it (Ctrl/Cmd+S) to apply.' } })

  // ── Open (V233) ──
  const HAND_IDS = { omnihand: 'omnihand', omni: 'omnihand', conscious: 'conscious', consciousness: 'conscious', lh: 'lh', left: 'lh', lefthand: 'lh', rh: 'rh', right: 'rh', righthand: 'rh' }
  registerOmni('Open', 'hand', { keywordSummary: 'open parts of the interface from a script', arg: 'hand', summary: 'Open a hand\'s menu: Omni Open Hand(lh|rh|conscious|omni) [context(menu|pad|tools|orbiter)] [state(open|close|toggle)]  (context defaults to menu)',
    props: { context: 'menu (☰ drawer / panel) | pad (⚇) | tools (⬢ radial) | orbiter (⦿)', state: 'open (default) | close | toggle' },
    run (call) {
      const raw = String(call.arg ?? call.props.hand ?? call.words[0] ?? '').toLowerCase().replace(/[^a-z]/g, ''); const hand = HAND_IDS[raw]
      if (!hand) throw new Error(`give a hand: Omni Open Hand(${['lh', 'rh', 'conscious', 'omni'].join(' | ')})`)
      const part = String(call.props.context ?? 'menu').toLowerCase(), st = String(call.props.state ?? 'open').toLowerCase()
      if (!['open', 'close', 'toggle'].includes(st)) throw new Error('state is one of: open, close, toggle')
      const detail = { hand, part: part === 'tool' ? 'tools' : part, open: st === 'toggle' ? undefined : st === 'open' }
      window.dispatchEvent(new CustomEvent('omni:hand-open-request', { detail }))
      if (detail.error) throw new Error(detail.error)
      if (detail.out === undefined) throw new Error('that hand is not on screen (hands are not running here)')
      return `${hand} ${detail.part}: ${part === 'orbiter' ? 'fired' : detail.out ? 'open' : 'closed'}`
    } })

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

  // ── Orb (V221, V234: every hand has an orb; summon puts one in the scene) ──
  const ORB_HANDS = { lh: 'lh', left: 'lh', rh: 'rh', right: 'rh', conscious: 'conscious', omnihand: 'omnihand', omni: 'omnihand' }
  const orbHand = (call) => { const raw = String(call.props.hand ?? 'lh').toLowerCase().replace(/[^a-z]/g, ''); const h = ORB_HANDS[raw]; if (!h) throw new Error('hand(...) is one of: lh, rh, conscious, omnihand'); return h }
  const orbs3d = () => { if (!SERVICES.orbnodes) throw new Error('scene orbs are not running'); return SERVICES.orbnodes }
  registerOmni('Orb', 'open', { keywordSummary: 'the orbs of potential, one per hand (the ⦿ Orb-it cell)', summary: 'Open a hand\'s orb: Omni Orb open [hand(lh|rh|conscious|omnihand)]', props: { hand: 'lh | rh | conscious | omnihand (default lh)' }, run (call) { const h = orbHand(call); window.dispatchEvent(new CustomEvent('omni:orb-open', { detail: { hand: h } })); return `${h} orb open: its potentials orbit behind the tools menu` } })
  registerOmni('Orb', 'close', { summary: 'Close a hand\'s orb (no hand: close them all)', props: { hand: 'which hand' }, run (call) { const h = call.props.hand === undefined ? undefined : orbHand(call); window.dispatchEvent(new CustomEvent('omni:orb-close', { detail: { hand: h } })); return h ? `${h} orb closed` : 'All orbs closed' } })
  registerOmni('Orb', 'fire', { summary: 'Fire the loaded LH / RH ammo as the orb does. Charge 0.4+ is a stronger shot; 0.98+ is the strongest and reaches wider', props: { hand: 'lh | rh (default lh)', charge: '0..1 (default 0)' }, run (call) {
    const h = orbHand(call); if (h !== 'lh' && h !== 'rh') throw new Error('only the LH and RH orbs fire ammo; use Omni Orb summon')
    const c = Math.max(0, Math.min(1, Number(call.props.charge ?? 0) || 0)); window.dispatchEvent(new CustomEvent('omni:hand-activate', { detail: { hand: h, charge: c } })); return c >= 0.98 ? `Fired the loaded ${h.toUpperCase()} ammo (full charge)` : c >= 0.4 ? `Fired the loaded ${h.toUpperCase()} ammo (strong)` : `Fired the loaded ${h.toUpperCase()} ammo` } })
  registerOmni('Orb', 'words', { summary: 'Show or set a hand\'s potentials: Omni Orb words hand(rh) value("Ideas, Colors")  (value(reset) restores the full list)', props: { hand: 'which hand', value: 'comma separated words, or reset' }, run (call) {
    const h = orbHand(call)
    if (call.props.value === undefined) { return (Hands.getHandSetting(h, 'orbWords') ?? []).join(', ') }
    if (String(call.props.value).toLowerCase() === 'reset') { Hands.setHandSetting(h, 'orbWords', defaultPool(h)); return `${h} orb words reset (${(Hands.getHandSetting(h, 'orbWords') ?? []).length} words)` }
    const list = (Array.isArray(call.props.value) ? call.props.value : String(call.props.value).split(',')).map(w => String(w).trim()).filter(Boolean)
    Hands.setHandSetting(h, 'orbWords', list); return `${h} orb words: ` + (Hands.getHandSetting(h, 'orbWords') ?? []).join(', ') } })
  registerOmni('Orb', 'summon', { summary: 'Put an orb in the scene looping some words: Omni Orb summon hand(rh) words("Ideas, Colors") [pos(x, y, z)] [scale(1..3)]  (no words: the first few of the hand\'s list)', props: { hand: 'lh | rh | conscious | omnihand', words: 'comma separated', pos: 'x, y, z (default 8 units ahead of the camera)', scale: '0.5..3' },
    run (call) {
      const h = orbHand(call), list = call.props.words === undefined ? (Hands.getHandSetting(h, 'orbWords') ?? []).slice(0, 6) : (Array.isArray(call.props.words) ? call.props.words : String(call.props.words).split(',')).map(w => String(w).trim()).filter(Boolean)
      const r = orbs3d().summon({ hand: h, words: list, pos: call.props.pos === undefined ? undefined : asVec3(call.props.pos, 'pos'), scale: call.props.scale }); return `Summoned ${r.id}: ${r.words.join(', ')} at (${r.pos.join(', ')})` } })
  registerOmni('Orb', 'list', { summary: 'The orbs in the scene', props: {}, run () { const l = orbs3d().list(); return l.length ? l.map(o => `${o.id}  ${o.hand}  ${o.words.join(', ')}`).join('\n') : 'No orbs in the scene' } })
  registerOmni('Orb', 'clear', { summary: 'Remove every orb from the scene: Omni Orb clear confirm', destructive: true, props: {}, run: () => `Removed ${orbs3d().clear()} orb(s)` })

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
  const BRUSH_PROPS = { shape: 'box, sphere, cone, cylinder, torus, octahedron, icosahedron, dodecahedron, tetrahedron', color: '#rrggbb', size: 'piece size 0.1..4', radius: 'spray radius 0..10', density: 'pieces per step 1..8', spacing: 'min distance between steps 0.1..5', jitterColor: 'colour wobble 0..1', mode: 'ground | air', paint: 'spray | surface (surface paints colour onto a node itself)', dab: 'surface brush width 4..96', soft: 'surface edge 0 hard .. 1 airbrush', sound: 'true | false', volume: '0..1', hand: 'rh | none (the hand whose Color / Texture / Material / DataTypes tools steer the brush)', height: 'ground plane height', distance: 'air distance 2..60', rainbow: 'true cycles hues' }
  const brushPatch = (pr) => { const o = {}; for (const k of Object.keys(BRUSH_PROPS)) if (pr[k] !== undefined) o[k] = pr[k]; return o }
  registerOmni('Construction', 'on', { keywordSummary: 'the painter: drag to spray nodes into the Sandbox', summary: 'Omni Construction on [shape(box)] [color(#ff8800)] [size(.5)] [radius(1.5)] [density(3)] [mode(ground|air)] [rainbow(true)]', props: BRUSH_PROPS, run (call) { const p = brushPatch(call.props); if (Object.keys(p).length) cons().set(p); cons().arm(true); return 'Painter on: drag in the scene. Esc or Omni Construction off to stop.' } })
  registerOmni('Construction', 'off', { summary: 'Turn the painter off', props: {}, run: () => (cons().arm(false), 'Painter off') })
  registerOmni('Construction', 'set', { summary: 'Change the brush without turning it on', props: BRUSH_PROPS, run (call) { const s = cons().set(brushPatch(call.props)); return Object.entries(s).map(([k, v]) => `${k}: ${v}`).join('\n') } })
  registerOmni('Construction', 'get', { summary: 'Show the brush', props: {}, run: () => { const c = cons(); return `${c.armed ? 'ON' : 'off'}, ${c.strokes()} stroke(s) to undo\n` + Object.entries(c.get()).map(([k, v]) => `${k}: ${v}`).join('\n') } })
  registerOmni('Construction', 'undo', { summary: 'Take back the last stroke', props: {}, run: () => `Took back ${cons().undo()} piece(s)` })
  registerOmni('Construction', 'lab', { arg: 'name', keywordSummary: 'named brush setups', summary: 'Omni Construction lab(name) uses a lab; Omni Construction labs lists them; Omni Construction savelab(name) saves the brush as a lab; Omni Construction deletelab(name)', props: { name: 'the lab name' }, run (call) { const l = cons().useLab(need(call.props.name ?? call.arg, 'name(...)')); return `Using lab "${l.name}"` } })
  registerOmni('Construction', 'labs', { summary: 'List the brush labs (built in and yours)', props: {}, run: () => cons().listLabs().map(l => `${l.id}${l.builtin ? ' (built in)' : ''}: ${l.name}`).join('\n') })
  registerOmni('Construction', 'savelab', { arg: 'name', summary: 'Save the current brush as a lab: Omni Construction savelab(My lab)', props: { name: 'the lab name' }, run (call) { const l = cons().saveLab(need(call.props.name ?? call.arg, 'name(...)')); return `Saved lab "${l.name}" (${l.id})` } })
  registerOmni('Construction', 'deletelab', { arg: 'name', summary: 'Delete one of your labs: Omni Construction deletelab(My lab)', props: { name: 'the lab name' }, destructive: true, run (call) { const l = cons().deleteLab(need(call.props.name ?? call.arg, 'name(...)')); return `Deleted lab "${l.name}"` } })
  registerOmni('Construction', 'clearpaint', { arg: 'id', summary: 'Give painted nodes their own look back: Omni Construction clearpaint(id) for one node, no id for all', props: { id: 'a node id' }, run (call) { const op = SERVICES.objectpaint; if (!op) throw new Error('OmniObjectPainter is not running'); const n = op.clear(call.props.id ?? call.arg ?? null); return `Cleared the paint on ${n} node(s)` } })

  // ── Decor (V239) ──
  registerOmni('Decor', 'list', { keywordSummary: 'the old decoration shapes of the starting scene (off by default)', summary: 'Show which are on', props: {}, run: () => Object.entries(Decor.load()).map(([k, v]) => `${k}: ${v ? 'on' : 'off'}`).join('\n') + '\n(changes apply after a reload)' })
  registerOmni('Decor', 'show', { summary: 'Bring a decoration back after a reload: Omni Decor show name(landingRoom|portalSpheres|trackingNodes)', props: { name: 'landingRoom | portalSpheres | trackingNodes' }, run (call) { Decor.setDecor(String(need(call.props.name, 'name(...)')), true); return `${call.props.name} will be on after a reload` } })
  registerOmni('Decor', 'hide', { summary: 'Remove a decoration after a reload: Omni Decor hide name(...)', props: { name: 'landingRoom | portalSpheres | trackingNodes' }, run (call) { Decor.setDecor(String(need(call.props.name, 'name(...)')), false); return `${call.props.name} will be off after a reload` } })

  // ── Demo (V241) — the 10-second meaning demo ──
  const demo = () => { if (!SERVICES.demo) throw new Error('the demo module is not running'); return SERVICES.demo }
  registerOmni('Demo', 'play', { keywordSummary: 'a short sequence in the scene: meaning shown by change', summary: 'Omni Demo play name(meaning) [speed(1)] [captions(false)] [keep(true)]  (10 seconds, Esc stops)', props: { name: 'meaning (the only demo so far)', speed: '0.25..4 (default 1)', captions: 'false hides the captions (for testing whether people read the change)', keep: 'true leaves the three nodes afterwards' },
    run (call) { const n = String(call.props.name ?? 'meaning').toLowerCase(); if (n !== 'meaning') throw new Error('the demos are: meaning'); return demo().play({ speed: call.props.speed, captions: call.props.captions !== false && String(call.props.captions) !== 'false', keep: call.props.keep === true || String(call.props.keep) === 'true' }) } })
  registerOmni('Demo', 'stop', { summary: 'Stop the demo and remove its nodes', props: {}, run: () => (demo().stop() ? 'Stopped' : 'No demo is playing') })
  registerOmni('Demo', 'list', { summary: 'The demos and what each change shows', props: {}, run: () => 'meaning (10 s)\n' + M_DEMO.describe() })

  // ── Doc layouts (V242) ──
  registerOmni('Doc', 'layouts', { keywordSummary: 'lay a document out in space', summary: 'List the page layouts and counts', props: {}, run: () => DPL.describe() })
  registerOmni('Doc', 'layout', { summary: 'Omni Doc layout id(docNode) layout(tunnel) pages(4) [start(1)]  (makes one doc node per page; no id: the selected doc node)', props: { id: 'the doc node to take the source from', layout: DPL.LAYOUTS.join(' | '), pages: DPL.COUNTS.join(' | '), start: 'the first page, default 1' },
    run (call) {
      const d = SERVICES.doc; if (!d) throw new Error('the doc module is not running')
      const id = String(call.props.id ?? call.arg ?? d._selectedId ?? ''); if (!id) throw new Error('id(...) is needed, or select a doc node first')
      const out = d.createLayout({ from: id, layout: call.props.layout ?? call.words[0] ?? 'tunnel', count: call.props.pages ?? 4, start: call.props.start ?? 1 })
      if (!out.ok) throw new Error(out.error); return `Laid out ${out.count} pages as ${out.layout} (radius ${out.radius}): ${out.nodeIds.join(', ')}`
    } })

  // ── Doc windows (V250): a few sheets paging through a long document ──
  const dw = () => { if (!SERVICES.docwindow) throw new Error('the doc window module is not running'); return SERVICES.docwindow }
  registerOmni('Doc', 'window', { summary: 'Sheets in a layout that page through a long document: Omni Doc window id(docNode) [layout(helix)] [pages(8)] [name(w1)] [start(1)]  (then Omni Doc flip name(w1))', props: { id: 'the doc node to take the source from (no id: the selected one)', layout: DPL.LAYOUTS.join(' | '), pages: 'how many sheets, 1-25', name: 'window name', start: 'first page' },
    run (call) { const d = SERVICES.doc; const src = String(call.props.id ?? call.arg ?? d?._selectedId ?? ''); if (!src) throw new Error('id(...) is needed, or select a doc node first'); const w = dw().create({ from: src, layout: String(call.props.layout ?? 'helix'), count: call.props.pages ?? 8, id: call.props.name, start: call.props.start ?? 1 }); return `Window ${w.id}: ${w.count} sheets, pages ${w.start}-${w.start + w.count - 1}${w.pages ? ' of ' + w.pages : ''}. Turn it with: Omni Doc flip name(${w.id})` } })
  registerOmni('Doc', 'flip', { summary: 'Turn a window like a carousel: Omni Doc flip name(w1) [dir(-1)] [by(1)] [seconds(0.6)]', props: { name: 'window', dir: '1 forward (default) | -1 back', by: 'how many pages, 1-25', seconds: 'per page' },
    run (call) { const name = String(need(call.props.name ?? call.arg, 'name(...)')); const dir = Number(call.props.dir ?? 1) < 0 ? -1 : 1; const w0 = dw().get(name); if (!w0) throw new Error('no window ' + name + ' (Omni Doc windows lists them)'); dw().flip(name, { dir, by: call.props.by, seconds: call.props.seconds }).catch(() => {}); return `Turning ${name} ${dir > 0 ? 'forward' : 'back'} by ${Math.max(1, Math.min(25, Math.round(Number(call.props.by) || 1)))} from pages ${w0.start}-${w0.start + w0.count - 1}` } })
  registerOmni('Doc', 'goto', { summary: 'Jump a window to a first page: Omni Doc goto name(w1) page(120)', props: { name: 'window', page: 'first page to show' }, run (call) { const s = dw().goto(String(need(call.props.name, 'name(...)')), call.props.page); return `Now showing from page ${s}` } })
  registerOmni('Doc', 'windows', { summary: 'The windows and what they show', props: {}, run: () => dw().list().map(WM_DESCRIBE).join('\n') || 'No windows' })
  registerOmni('Doc', 'unwindow', { summary: 'Forget a window (the sheets stay): Omni Doc unwindow name(w1)', props: { name: 'window' }, run (call) { return dw().forget(String(need(call.props.name ?? call.arg, 'name(...)'))) ? 'Forgotten (the sheets stay in the scene)' : 'No such window' } })

  // ── Semantics skin (V243) — OmniSemanticsVoxelNode: a six-face cube, one face per axiom ──
  const poly = () => { if (!SERVICES.poly) throw new Error('the poly module is not running'); return SERVICES.poly }
  const axiomArg = (v) => { const k = String(need(v, 'axiom(...)')).toLowerCase(); const hit = SK.AXIOM_ORDER.find(a => a === k) ?? SK.AXIOM_ORDER[Number(k) - 1]; if (!hit) throw new Error('axiom(identity|information|space|time|power|expression, or 1-6)'); return hit }
  registerOmni('Semantics', 'list', { keywordSummary: 'the six-face meaning cube (skin): one face per axiom', summary: 'List the six faces and the skins', props: {}, run: () => SK.describe() })
  registerOmni('Semantics', 'create', { summary: 'Omni Semantics create [skin(default|plain|contrast|blank)] [id(name)] [pos(x, y, z)]  (a cube, one face per axiom; click a face)', props: { skin: SK.SKIN_NAMES.join(' | '), id: 'node id', pos: 'x, y, z' },
    run (call) {
      const skin = String(call.props.skin ?? call.arg ?? 'default'); if (!SK.SKIN_NAMES.includes(skin)) throw new Error('skin(' + SK.SKIN_NAMES.join('|') + ')')
      const id = call.props.id === undefined ? undefined : String(call.props.id); if (id !== undefined && !ID_OK.test(id)) throw new Error('id: letters, digits, _ and - (max 64)')
      const out = poly().createPolyNode({ poly: SK.skinToPoly(SK.presetSkin(skin)), id, label: 'Semantics ' + skin, position: call.props.pos === undefined ? undefined : asVec3(call.props.pos), select: true })
      if (!out.ok) throw new Error(out.error); return `Created ${out.nodeId} (skin ${skin})`
    } })
  registerOmni('Semantics', 'face', { summary: 'Change one face: Omni Semantics face id(name) axiom(time) [icon(⧖)] [label(Time)] [event(my:event)]', props: { id: 'the semantics cube', axiom: 'identity | information | space | time | power | expression (or 1-6)', icon: 'a symbol or emoji', label: 'text', event: 'event name', image: 'a picture from the document library (its id), or none', video: 'a video from the document library (its id), or none' },
    run (call) {
      const id = idOf(call); const axiom = axiomArg(call.props.axiom); const i = SK.AXIOM_ORDER.indexOf(axiom); const p = poly().getPoly(id); if (!p) throw new Error('no poly node ' + id)
      const cur = p.faces[i]; const text0 = cur?.content?.text ?? ''; const m = /^# (.*)\n?(.*)$/s.exec(text0)
      const icon = call.props.icon === undefined ? (m ? m[1] : '') : str(call.props.icon, 8); const label = call.props.label === undefined ? (m ? m[2] : (cur?.label ?? '')) : str(call.props.label, 40)
      const patch = { label: label || '(not defined)', content: { type: 'text', text: icon ? `# ${icon}\n${label}` : label } }
      const media = (k) => { const v = call.props[k]; if (v === undefined) return undefined; const t = String(v); if (t === 'none' || t === '') return null; if (!/^[A-Za-z0-9_-]{1,64}$/.test(t)) throw new Error(k + '(library id, or none)'); return t }
      const vid = media('video'); const img = media('image')
      if (vid) patch.content = { type: 'video', source: { type: 'video', id: vid }, page: 1 }
      else if (img) patch.content = { type: 'image', source: { type: 'image', id: img }, page: 1 }
      else if (vid === null || img === null) { /* picture or video taken off: back to the icon and label */ }
      else if (call.props.icon === undefined && call.props.label === undefined && (cur?.content?.type === 'image' || cur?.content?.type === 'video')) delete patch.content   // only the event / nothing else changed: keep the media
      if (call.props.event !== undefined) patch.event = String(call.props.event)
      const r = poly().edit(id, 'semantics-face', (m2) => P_setFace(m2, i, patch)); if (!r.ok) throw new Error(r.error || 'could not change the face')
      return `Face ${i + 1} (${axiom}) of ${id} changed`
    } })
  // V257: reskin voxel-room nodes. The voxel node (the diamond at the room's centre) is the SKELETON and stays; a semantics cube above it is the SKIN.
  const voxelIds = (ctx) => (nodes(ctx).getAllNodes?.() ?? []).filter(d => d?.nodeKind === 'voxelNode').map(d => d.id)
  registerOmni('Semantics', 'reskin', { keywordSummary: 'put a meaning cube (skin) on a voxel-room node, or swap its skin', summary: 'Omni Semantics reskin id(voxelNodeId) [skin(default|plain|contrast|blank)]   or   Omni Semantics reskin all(true) [skin(...)]  (the cube sits above the voxel and follows it; run it again with another skin to swap)', props: { id: 'a voxel node', all: 'true = every voxel node', skin: SK.SKIN_NAMES.join(' | ') },
    run (call, ctx) {
      const skin = String(call.props.skin ?? 'default'); if (!SK.SKIN_NAMES.includes(skin)) throw new Error('skin(' + SK.SKIN_NAMES.join('|') + ')')
      const all = String(call.props.all ?? '').toLowerCase() === 'true'; const known = voxelIds(ctx)
      const wanted = all ? known : [String(need(call.props.id ?? call.arg, 'id(...) or all(true)'))]
      if (!all && !known.includes(wanted[0])) throw new Error('no voxel node ' + wanted[0] + (known.length ? ' (voxel nodes: ' + known.slice(0, 8).join(', ') + ')' : ' (there are no voxel nodes; open ⟐OmniVoxel)'))
      if (!wanted.length) throw new Error('there are no voxel nodes; open ⟐OmniVoxel')
      const exist = (nodes(ctx).getAllNodes?.() ?? []).map(d => d.id); let made = 0, swapped = 0
      for (const step of SK.reskinPlan(wanted, exist)) {
        const p = SK.skinToPoly(SK.presetSkin(skin))
        if (step.action === 'swap') { const r = poly().edit(step.skinId, 'reskin', () => p); if (!r.ok) throw new Error(r.error || 'could not swap the skin'); swapped++; continue }
        const mesh = nodes(ctx).getMeshById?.(step.voxelId); const at = mesh ? [mesh.position.x, mesh.position.y + 1.6, mesh.position.z] : undefined
        const out = poly().createPolyNode({ poly: p, id: step.skinId, label: 'Skin ' + skin, position: at }); if (!out.ok) throw new Error(out.error)
        lu().attach({ node: step.skinId, to: step.voxelId, off: [0, 1.6, 0] }); made++
      }
      return `Reskinned ${made + swapped} voxel node(s) with the ${skin} skin (${made} new, ${swapped} swapped)`
    } })
  registerOmni('Semantics', 'unskin', { arg: 'id', summary: 'Take the skin cube off a voxel node: Omni Semantics unskin id(voxelNodeId) confirm', destructive: true, props: { id: 'a voxel node' },
    run (call, ctx) { const v = String(need(call.props.id ?? call.arg, 'id(...)')); const sid = SK.skinNodeId(v); if (!nodes(ctx).getNodeData?.(sid)) throw new Error('that voxel node has no skin'); try { lu().detach({ node: sid }) } catch (_) { /* not attached */ } window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: sid } })); return `Removed the skin from ${v}` } })

  // ── Lineups and attachments (V244) ──
  const lu = () => { if (!SERVICES.lineup) throw new Error('the lineup module is not running'); return SERVICES.lineup }
  const idList = (v) => String(v ?? '').split(/[\s,]+/).filter(Boolean)
  registerOmni('Lineup', 'create', { keywordSummary: 'put nodes in a sequence on a shape; they glide to their slots; attach carries a node at another\'s core', summary: 'Omni Lineup create id(name) [layout(row|grid|tunnel|helix|sphereIn|sphereOut)] [ids(a, b, c)] [center(x, y, z)] [spacing(3)]', props: { id: 'lineup name', layout: 'shape', ids: 'node ids in order', center: 'x, y, z (default: ahead of you)', spacing: 'node size, default 3' },
    run (call) { const r = lu().create({ id: String(need(call.props.id ?? call.arg, 'id(...)')), layout: String(call.props.layout ?? 'row'), ids: idList(call.props.ids), center: call.props.center === undefined ? undefined : asVec3(call.props.center), spacing: Number(call.props.spacing ?? 3) }); return `Lineup ${call.props.id ?? call.arg}: ${r.state.lineups[call.props.id ?? call.arg].order.length} nodes` } })
  registerOmni('Lineup', 'place', { summary: 'Put a node at a sequence number (1 = first; no index = last; it leaves any other lineup): Omni Lineup place id(name) node(nodeId) [index(2)]', props: { id: 'lineup', node: 'node id', index: 'sequence number' },
    run (call) { const r = lu().place({ id: String(need(call.props.id, 'id(...)')), node: String(need(call.props.node, 'node(...)')), index: call.props.index === undefined ? null : Number(call.props.index) }); return `${call.props.node} is now number ${r.index} in ${call.props.id}` } })
  registerOmni('Lineup', 'take', { summary: 'Take a node out of a lineup: Omni Lineup take id(name) node(nodeId)', props: { id: 'lineup', node: 'node id' }, run (call) { lu().take({ id: String(need(call.props.id, 'id(...)')), node: String(need(call.props.node, 'node(...)')) }); return 'Taken out' } })
  registerOmni('Lineup', 'arrange', { summary: 'Glide every lineup node back to its slot (after you dragged some)', props: {}, run: () => { lu().arrange(); return 'Arranging' } })
  registerOmni('Lineup', 'delete', { summary: 'Delete a lineup (the nodes stay where they are): Omni Lineup delete id(name)', props: { id: 'lineup' }, run (call) { lu().delete({ id: String(need(call.props.id ?? call.arg, 'id(...)')) }); return 'Deleted' } })
  registerOmni('Lineup', 'attach', { summary: 'Carry a node at another node\'s core, keeping its offset: Omni Lineup attach node(a) to(b) [off(x, y, z)]', props: { node: 'the carried node', to: 'the carrier', off: 'offset (default: where it is now)' },
    run (call) { lu().attach({ node: String(need(call.props.node, 'node(...)')), to: String(need(call.props.to, 'to(...)')), off: call.props.off === undefined ? null : asVec3(call.props.off) }); return `${call.props.node} now travels with ${call.props.to}` } })
  registerOmni('Lineup', 'detach', { summary: 'Let a carried node go: Omni Lineup detach node(a)', props: { node: 'node' }, run (call) { lu().detach({ node: String(need(call.props.node ?? call.arg, 'node(...)')) }); return 'Detached' } })
  registerOmni('Lineup', 'walk', { summary: 'Fly the camera through a lineup in sequence order: Omni Lineup walk id(story) [seconds(2.5)] [hold(1.5)] [distance(8)] [from(1)] [loop(true)] [auto(false)] [captions(false)]  (Esc stops; auto(false) waits for Omni Lineup next / prev)', props: { id: 'lineup', seconds: 'flight time per stop', hold: 'seconds to stay at each stop', distance: 'how far from the node, 2-60', from: 'first sequence number', loop: 'true = wrap around to the start', auto: 'false = step by hand with next / prev', captions: 'false = no "2 / 5 · label" text' },
    run (call) { const p = call.props; const n = lu().walk({ id: String(need(p.id ?? call.arg, 'id(...)')), seconds: p.seconds, hold: p.hold, distance: p.distance, from: p.from, loop: p.loop === true, auto: p.auto !== false, captions: p.captions !== false }); return `Walking ${n} stops (Esc stops)` } })
  registerOmni('Lineup', 'next', { summary: 'Go to the next stop of the walk', props: {}, run: () => (lu().next() ? 'Next' : 'No next stop (is a walk running?)') })
  registerOmni('Lineup', 'prev', { summary: 'Go back one stop of the walk', props: {}, run: () => (lu().prev() ? 'Back' : 'No previous stop (is a walk running?)') })
  registerOmni('Lineup', 'halt', { summary: 'End the walk and give the camera back', props: {}, run: () => (lu().halt() ? 'Walk ended' : 'No walk is running') })
  registerOmni('Lineup', 'numbers', { arg: 'state', summary: 'Omni Lineup numbers(on|off|toggle) [total(true|false)]  (a small number above each node in a lineup: its place in the sequence)', props: { state: 'on, off or toggle', total: 'true shows 2/6 instead of 2' }, run (call) {
    const b = SERVICES.badges; if (!b) throw new Error('the number badges module is not running')
    const a = String(call.props.state ?? call.arg ?? '').toLowerCase()
    if (a && !['on', 'off', 'toggle'].includes(a)) throw new Error('numbers on | off | toggle')
    const patch = {}; if (a === 'on') patch.on = true; else if (a === 'off') patch.on = false; else if (a === 'toggle' || (!a && call.props.total === undefined)) patch.on = !b.get().on
    if (call.props.total !== undefined) { const t = String(call.props.total).toLowerCase(); if (!['true', 'false'].includes(t)) throw new Error('total(true|false)'); patch.showTotal = t === 'true' }
    const p = b.set(patch); return `Numbers ${p.on ? 'on' : 'off'}${p.showTotal ? ' (with totals)' : ''}`
  } })
  registerOmni('Lineup', 'list', { summary: 'The lineups (in sequence order) and what carries what', props: {}, run () { const s = lu().state(); const a = Object.entries(s.lineups).map(([id, l]) => `${id} [${l.layout}] ${l.order.map((n, i) => (i + 1) + ':' + n).join(' ') || '(empty)'}`); const c = Object.entries(s.attach).map(([n, x]) => `${n} carried by ${x.to}`); return [...a, ...c].join('\n') || 'No lineups or attachments' } })


  // ── TimeNode and TimePad (V259) ──
  const tn = () => { if (!SERVICES.timenodes) throw new Error('the time module is not running'); return SERVICES.timenodes }
  const tid = (call) => String(need(call.props.id ?? call.arg ?? call.words[0], 'id(...)'))
  const okr = (r, msg) => { if (!r || r.ok === false) throw new Error(r?.error || 'that did not work'); return msg }
  const timeFields = (p) => { const o = {}; for (const k of ['title', 'notes', 'zone', 'bind', 'label']) if (p[k] !== undefined) o[k] = String(p[k]); for (const [lk, ck] of [['startdate', 'startDate'], ['enddate', 'endDate'], ['starttime', 'startTime'], ['endtime', 'endTime']]) if (p[lk] !== undefined) o[ck] = String(p[lk]); if (p.rate !== undefined) o.rate = Number(p.rate); if (p.chain !== undefined) o.chain = p.chain === true || p.chain === 'true'; if (p.loop !== undefined) o.loop = p.loop === true || p.loop === 'true'; if (p.repeat !== undefined) o.repeat = { every: String(p.repeat), times: Number(p.times ?? 0) }; return o }
  const TPROPS = { id: 'node id', title: 'name', startdate: 'YYYY-MM-DD', starttime: 'HH:MM', enddate: 'YYYY-MM-DD', endtime: 'HH:MM', zone: 'IANA zone such as America/New_York (default UTC)', bind: 'node (the calendar) | own (starts when activated)', rate: 'speed of its own clock', chain: 'start when the cube before it is fulfilled', loop: 'replay when finished (analysis)', repeat: 'none | day | week | month | year', times: 'how many repeats (0 = forever)' }
  registerOmni('Time', 'create', { keywordSummary: 'TimeCubes: a cube with a ring and a spinning icosahedron that follows a time; a line of them is a sequence', summary: 'Omni Time create [after(cubeId)] title(Kickoff) startDate(2026-06-01) startTime(09:00) endDate(2026-06-01) endTime(11:00) [zone(America/New_York)] [bind(own)]  (after: joins the cube before it by a line, in the same sequence)', props: { ...TPROPS, after: 'the cube this one follows' },
    run (call) { const r = tn().createCube({ ...timeFields(call.props), id: call.props.id, after: call.props.after }); return okr(r, `TimeCube ${r.nodeId} (sequence ${r.sequence})`) } })
  registerOmni('Time', 'set', { summary: 'Change a TimeCube: Omni Time set id(cube) title(...) startDate(...) ...', props: TPROPS, run (call) { return okr(tn().setEntry(tid(call), timeFields(call.props)), 'Updated') } })
  for (const [op, past, sum] of [['activate', 'Activated', 'Start a cube on its own clock now'], ['halt', 'Halted', 'Pause just this cube (its icosahedron stops and glows)'], ['resume', 'Resumed', 'Let a halted cube carry on'], ['reset', 'Reset', 'Put a cube back to waiting'], ['replay', 'Replaying', 'Start a finished cube over (analysis)']]) {
    registerOmni('Time', op, { summary: `Omni Time ${op} id(cube)  (${sum})`, props: { id: 'cube' }, run (call) { return okr(tn()[op](tid(call)), `${past} ${tid(call)}`) } })
  }
  registerOmni('Time', 'loop', { summary: 'Loop a cube for analysis: Omni Time loop id(cube) on(true|false)', props: { id: 'cube', on: 'true | false' }, run (call) { const on = call.props.on === undefined ? true : (call.props.on === true || call.props.on === 'true'); return okr(tn().setEntry(tid(call), { loop: on }), `Loop ${on ? 'on' : 'off'}`) } })
  registerOmni('Time', 'status', { summary: 'Where a cube is: Omni Time status id(cube)', props: { id: 'cube' }, run (call) { const s = tn().state(tid(call)); if (!s) throw new Error('that is not a TimeCube'); return `${s.status} ${Math.round(s.progress * 100)}%` } })
  registerOmni('Time', 'list', { summary: 'Every sequence of cubes and where each is', props: {}, run () { const q = tn().sequences(); return q.length ? q.map(s => `${s.sequence}: ` + s.ids.map(i => `${i} ${tn().state(i)?.status}`).join(' → ')).join('\n') : 'No TimeCubes yet. Omni Time create ...' } })
  registerOmni('Time', 'view', { summary: 'A calendar view of the cubes: Omni Time view span(7d) [anchor(2026-06-01)] [zone(UTC)] [seq(name)]  (spans: 1d 3d 5d 7d 14d 1m 3m 6m 1y 2y 3y 5y 10y 20y custom [days(45)])', props: { span: '1d | 3d | 5d | 7d | 14d | 1m | 3m | 6m | 1y | 2y | 3y | 5y | 10y | 20y | custom', anchor: 'a date', zone: 'zone', seq: 'sequence', days: 'for custom' },
    run (call) { const T = TM; const span = String(call.props.span ?? '7d'); if (!T.SPANS.includes(span)) throw new Error('span: ' + T.SPANS.join(' ')); const zone = call.props.zone ? String(call.props.zone) : 'UTC'; const d = call.props.anchor ? T.parseDate(String(call.props.anchor)) : null; if (call.props.anchor && !d) throw new Error('anchor(YYYY-MM-DD)')
      const v = tn().view(span, { sequence: call.props.seq ? String(call.props.seq) : null, anchor: d ? T.zonedToUtc({ ...d }, zone) : null, zone, customDays: Number(call.props.days ?? 30) }); return `${v.range.label}: ${v.columns.length} ${v.range.unit}s\n` + v.columns.filter(c => c.items.length).map(c => `${c.label}: ${c.items.map(i => i.title || i.entryId).join(', ')}`).join('\n') } })
  registerOmni('Time', 'filter', { summary: 'Which cubes fall in a minute/hour/day/week/month/year: Omni Time filter unit(month) key(2026-06) [zone(UTC)]  (keys: 2026-06-01T09:30, 2026-06-01T09, 2026-06-01, W2026-06-01, 2026-06, 2026)', props: { unit: 'minute | hour | day | week | month | year', key: 'the bucket', zone: 'zone' }, run (call) { const ids = tn().filter(String(need(call.props.unit, 'unit(...)')), String(need(call.props.key, 'key(...)')), { zone: call.props.zone ? String(call.props.zone) : 'UTC' }); return ids.length ? ids.join(', ') : 'None' } })
  registerOmni('Time', 'pad', { summary: 'The TimePad, a board of buttons that start and stop cubes: Omni Time pad name(Show) | Omni Time button pad(Show) label(Go) | Omni Time action pad(Show) button(Go) op(activate) target(cube) [at(500)] | Omni Time press pad(Show) button(Go)', props: { name: 'pad name' }, run (call) { return okr(tn().createPad(String(need(call.props.name ?? call.arg, 'name(...)'))), 'Pad made') } })
  registerOmni('Time', 'button', { summary: 'Add a button to a pad: Omni Time button pad(Show) label(Go) [color(#4aa3ff)]', props: { pad: 'pad', label: 'button name', color: 'colour' }, run (call) { return okr(tn().addPadButton(String(need(call.props.pad, 'pad(...)')), { label: call.props.label, color: call.props.color }), 'Button added') } })
  registerOmni('Time', 'action', { summary: 'Add an action to a button: Omni Time action pad(Show) button(Go) op(activate|halt|resume|reset|replay|loop-on|loop-off) target(cube) [at(ms after the press)]', props: { pad: 'pad', button: 'button label or id', op: 'what to do', target: 'cube', at: 'delay in ms' }, run (call) { const t = tn(); const pad = t.pads().find(p => p.id === call.props.pad || p.name === call.props.pad); const b = pad?.buttons.find(x => x.id === call.props.button || x.label === call.props.button); if (!pad || !b) throw new Error('pad(...) and button(...) must exist'); return okr(t.addPadAction(pad.id, b.id, { op: String(call.props.op), target: String(call.props.target), at: Number(call.props.at ?? 0) }), 'Action added') } })
  registerOmni('Time', 'press', { summary: 'Press a pad button: Omni Time press pad(Show) button(Go)', props: { pad: 'pad', button: 'button' }, run (call) { const r = tn().pressButton(String(need(call.props.pad, 'pad(...)')), String(need(call.props.button, 'button(...)'))); return okr(r, `Pressed (${r.scheduled} actions)`) } })
  registerOmni('Time', 'pads', { summary: 'List the pads and their buttons', props: {}, run () { const p = tn().pads(); return p.length ? p.map(x => `${x.name}: ` + x.buttons.map(b => `${b.label}(${b.actions.length})`).join(', ')).join('\n') : 'No pads. Omni Time pad name(Show)' } })
  registerOmni('Time', 'board', { arg: 'state', summary: 'Show or hide the on-screen TimePad: Omni Time board(open|close|toggle)', props: { state: 'open | close | toggle' }, run (call) { const a = String(call.props.state ?? call.arg ?? 'toggle').toLowerCase(); if (!['open', 'close', 'toggle'].includes(a)) throw new Error('board open | close | toggle'); window.dispatchEvent(new CustomEvent('omni:timepad-board', { detail: { action: a } })); return 'TimePad ' + a } })
  registerOmni('Time', 'clock', { summary: 'Which clock the cubes read: Omni Time clock source(real|scene) [origin(2026-06-01)] [scale(60)]  (scene = the OmniChronos playhead: origin is what playhead 0 means; scale is scene seconds per playhead second)', props: { source: 'real | scene', origin: 'a date (YYYY-MM-DD) or YYYY-MM-DDTHH:MM', scale: 'scene seconds per playhead second (1 = real speed)', zone: 'zone for origin' },
    run (call) { const cfg = {}; if (call.props.source !== undefined) { const v = String(call.props.source).toLowerCase(); if (!['real', 'scene'].includes(v)) throw new Error('source(real|scene)'); cfg.source = v }
      if (call.props.origin !== undefined) { const [d, t = '00:00'] = String(call.props.origin).split('T'); const dd = TM.parseDate(d); const tt = TM.parseTime(t); if (!dd || !tt) throw new Error('origin(YYYY-MM-DD) or origin(YYYY-MM-DDTHH:MM)'); cfg.origin = TM.zonedToUtc({ ...dd, ...tt, s: 0 }, call.props.zone ? String(call.props.zone) : 'UTC') }
      if (call.props.scale !== undefined) { const n = Number(call.props.scale); if (!(n > 0)) throw new Error('scale(a number above 0)'); cfg.scale = n }
      const c = tn().setClockConfig(cfg); return c.source === 'scene' ? `Cubes follow the scene clock (playhead 0 = ${new Date(c.origin).toISOString().slice(0, 16)}Z, x${c.scale})` : 'Cubes follow the computer clock' } })
  registerOmni('Time', 'panel', { summary: 'Close the face panel: Omni Time panel close', props: {}, run () { return tn().closePanel() ? 'Closed' : 'No panel is open' } })


  // ── ClaimNode / DimensionalScripting (V260) ──
  const cl = () => { if (!SERVICES.claims) throw new Error('the claim module is not running'); return SERVICES.claims }
  const cid = (call) => String(need(call.props.id ?? call.arg ?? call.words[0], 'id(...)'))
  const kv = (t) => { const o = {}; for (const part of String(t ?? '').split(/[,;]/)) { const [k, ...r] = part.split('='); if (k.trim() && r.length) { const v = r.join('=').trim(); o[k.trim()] = v === 'true' ? true : v === 'false' ? false : (v !== '' && Number.isFinite(Number(v)) ? Number(v) : v) } } return o }
  const shareLine = (id) => { const s = cl().shares(id); return `true ${Math.round(s.truth * 1000) / 10}% · false ${Math.round(s.false * 1000) / 10}% · undefined ${Math.round(s.undefined * 1000) / 10}% at scale ${s.scale}` }
  registerOmni('Claim', 'create', { keywordSummary: 'a claim that is true, false and undefined at once, with testimonies kept apart by who said them; public or sealed with a key', summary: 'Omni Claim create claim(The cup is half full) [id(cup)] [scale(10)] [laws(conservation of mass; ...)] [conditions(temp=20)] [identity(water in a cup)]', props: { claim: 'the statement', id: 'node id', scale: 'cells to judge it in, 1-4096', laws: 'Laws, separated by ;', conditions: 'k=v, k=v', identity: 'what it is' },
    run (call) { const p = call.props; const r = cl().createClaimNode({ claim: String(need(p.claim ?? call.arg, 'claim(...)')), id: p.id, scale: p.scale === undefined ? 10 : Number(p.scale), laws: p.laws ? String(p.laws).split(';').map(x => x.trim()).filter(Boolean) : [], conditions: p.conditions ? kv(p.conditions) : {}, identity: p.identity }); if (!r.ok) throw new Error(r.error); return `ClaimNode ${r.nodeId}` } })
  registerOmni('Claim', 'testify', { summary: 'Add a testimony: Omni Claim testify id(cup) by(ann) kind(human|bot|ai|sensor|animal|other) verdict(true|false|undefined) [from(0)] [to(0.5)] [saw(...)] [means(...)] [resolution(0.01)] [weight(1)] [conditions(light=day)] [source(...)]', props: { id: 'claim', by: 'name or id', kind: 'human | bot | ai | sensor | animal | other | unknown', verdict: 'true | false | undefined', from: '0-1', to: '0-1', saw: 'observation', means: 'interpretation', resolution: 'finest detail it can see, 0-1', weight: 'how much it counts', conditions: 'k=v, k=v', source: 'same source counts once' },
    run (call) { const p = call.props; const id = cid(call); const v = String(need(p.verdict, 'verdict(true|false|undefined)')).toLowerCase(); if (!['true', 'false', 'undefined'].includes(v)) throw new Error('verdict(true|false|undefined)'); cl().testify(id, { entity: { kind: p.kind ?? 'human', id: p.by ?? '', resolution: Number(p.resolution ?? 0) }, verdict: v, region: [Number(p.from ?? 0), Number(p.to ?? 1)], observation: p.saw ?? '', interpretation: p.means ?? '', weight: Number(p.weight ?? 1), conditions: p.conditions ? kv(p.conditions) : {}, sourceKey: p.source ?? '' }); return 'Testimony added: ' + shareLine(id) } })
  registerOmni('Claim', 'scale', { arg: 'n', summary: 'Judge the claim in n cells (1-4096): Omni Claim scale id(cup) n(100)', props: { id: 'claim', n: 'cells' }, run (call) { const id = cid(call); cl().setScale(id, Number(need(call.props.n ?? call.words[1], 'n(...)'))); return shareLine(id) } })
  registerOmni('Claim', 'show', { summary: 'The shares at the claim scale (or n): Omni Claim show id(cup) [n(100)]', props: { id: 'claim', n: 'cells' }, run (call) { const id = cid(call); const n = call.props.n === undefined ? null : Number(call.props.n); const s = cl().shares(id, n); const d = cl().data(id, n); return `${cl().title(id)}\ntrue ${Math.round(s.truth * 1000) / 10}% · false ${Math.round(s.false * 1000) / 10}% · undefined ${Math.round(s.undefined * 1000) / 10}% at ${s.scale} cells\nundefined because: conflict ${s.layers.conflict}, absence ${s.layers.absence}, mixed ${s.layers.mixed}, too coarse ${s.layers.known_unknown}\n${d.objective ? 'OBJECTIVE' : 'not objective'} · ${d.accounts} accounts · independence ${d.independence}` } })
  registerOmni('Claim', 'state', { summary: 'Change the conditions (the old state is closed and kept): Omni Claim state id(cup) [conditions(lime=true)] [laws(...; ...)] [identity(...)] reason(added a lime)', props: { id: 'claim', conditions: 'k=v', laws: 'Laws, ;', identity: 'what it is now', reason: 'why' }, run (call) { const p = call.props; const ch = {}; if (p.conditions !== undefined) ch.conditions = kv(p.conditions); if (p.laws !== undefined) ch.laws = String(p.laws).split(';').map(x => x.trim()).filter(Boolean); if (p.identity !== undefined) ch.identity = String(p.identity); cl().setState(cid(call), ch, String(p.reason ?? '')); return 'New state begun; the old one is kept' } })
  registerOmni('Claim', 'unknown', { summary: 'Put something undefined on the record: Omni Claim unknown id(cup) layer(known_unknown|unknown_unknown|declined) text(...) [by(ann)]', props: { id: 'claim', layer: 'known_unknown | unknown_unknown | declined', text: 'what', by: 'who' }, run (call) { cl().addUnknown(cid(call), String(need(call.props.layer, 'layer(...)')), String(need(call.props.text, 'text(...)')), String(call.props.by ?? '')); return 'Recorded' } })
  registerOmni('Claim', 'promote', { summary: 'Promote testimonies that pass the test (independent sources, varied conditions) to subjective truth: Omni Claim promote id(cup)', props: { id: 'claim' }, run (call) { const id = cid(call); const n0 = cl().get(id).testimonies.filter(t => t.truthType === 'subjective').length; cl().promote(id); const n = cl().get(id).testimonies.filter(t => t.truthType === 'subjective').length - n0; return n ? `${n} promoted` : 'Nothing passes yet' } })
  registerOmni('Claim', 'theory', { summary: 'Stage a theory the current testimonies support: Omni Claim theory id(cup) text(it is half full by volume)', props: { id: 'claim', text: 'the theory' }, run (call) { const id = cid(call); cl().stage(id, String(need(call.props.text, 'text(...)')), cl().get(id).testimonies.map(t => t.id)); const t = cl().get(id).theories.slice(-1)[0]; return `Staged ${t.id}` } })
  for (const [name, ok] of [['confirm', true], ['reject', false]]) {
    registerOmni('Claim', name, { summary: `Omni Claim ${name} id(cup) theory(thId) reason(...)  (a rejected theory is kept, with its reason)`, props: { id: 'claim', theory: 'theory id', reason: 'why' }, run (call) { cl().resolve(cid(call), String(need(call.props.theory, 'theory(...)')), ok, String(call.props.reason ?? '')); return ok ? 'Confirmed' : 'Rejected, and kept' } })
  }
  registerOmni('Claim', 'aware', { summary: 'Add an awareness (something that can identify): Omni Claim aware id(cup) name(Camera) [type(natural|intentional)] [familiar(colour; shape)] [accepts(colour)] [resolution(0.01)]  (intentional: what it declines reveals its values)', props: { id: 'claim', name: 'its name', type: 'natural | intentional', familiar: 'what it can resolve, separated by ;', accepts: 'what it accepts once resolved, separated by ;', resolution: '0-1' },
    run (call) { const p = call.props; const list = (t) => String(t ?? '').split(';').map(x => x.trim()).filter(Boolean); const id = cid(call); cl().addAwareness(id, { name: String(need(p.name, 'name(...)')), systemType: p.type ?? 'natural', familiarity: list(p.familiar), scope: list(p.accepts), resolution: Number(p.resolution ?? 0) }); return 'Awareness added: ' + cl().get(id).awarenesses.slice(-1)[0].id } })
  registerOmni('Claim', 'familiar', { summary: 'An awareness becomes able to resolve a subject: Omni Claim familiar id(cup) awareness(Camera) subject(shape)', props: { id: 'claim', awareness: 'name or id', subject: 'what' }, run (call) { cl().becomeFamiliar(cid(call), String(need(call.props.awareness, 'awareness(...)')), String(need(call.props.subject, 'subject(...)'))); return 'Now familiar' } })
  registerOmni('Claim', 'accept', { summary: 'An awareness accepts a subject into its scope: Omni Claim accept id(cup) awareness(Policy desk) subject(rumour)', props: { id: 'claim', awareness: 'name or id', subject: 'what' }, run (call) { cl().accept(cid(call), String(need(call.props.awareness, 'awareness(...)')), String(need(call.props.subject, 'subject(...)'))); return 'Accepted' } })
  registerOmni('Claim', 'identify', { summary: 'Ask every awareness to identify a subject: Omni Claim identify id(cup) subject(rumour)  (not familiar = undefined; familiar but declined = a branch reality is born)', props: { id: 'claim', subject: 'what' }, run (call) { const id = cid(call); const r = cl().identify(id, String(need(call.props.subject, 'subject(...)'))); const aw = cl().get(id).awarenesses; return r.map(o => `${aw.find(a => a.id === o.awareness)?.name ?? o.awareness}: ${o.result}${o.revealsValues ? ' (reveals values)' : ''}`).join('\n') } })
  registerOmni('Claim', 'branches', { summary: 'The branch realities of a claim: Omni Claim branches id(cup)', props: { id: 'claim' }, run (call) { const b = cl().get(cid(call)).branches; return b.length ? b.map(x => `${x.id}: "${x.subject}" ${x.status}${x.nodes.length ? ' → ' + x.nodes.join(', ') : ''}`).join('\n') : 'No branches' } })
  registerOmni('Claim', 'branch', { summary: 'Move a branch: Omni Claim branch id(cup) branch(brId) status(dormant|forked|merged|active) reason(...)  (merged: the declining awareness widens its scope and accepts it)', props: { id: 'claim', branch: 'branch id', status: 'active | dormant | forked | merged', reason: 'why' }, run (call) { cl().setBranch(cid(call), String(need(call.props.branch, 'branch(...)')), String(need(call.props.status, 'status(...)')), String(call.props.reason ?? '')); return 'Branch ' + call.props.status } })
  registerOmni('Claim', 'grow', { summary: 'Grow a branch into a reality of its own, a new ClaimNode joined by a line: Omni Claim grow id(cup) branch(brId)', props: { id: 'claim', branch: 'branch id' }, run (call) { return 'Grew ' + cl().growBranch(cid(call), String(need(call.props.branch, 'branch(...)'))) } })
  registerOmni('Claim', 'effect', { summary: 'Score how well an awareness did on a subject, once it is verified: Omni Claim effect id(cup) awareness(Camera) subject(rumour) score(0.9)', props: { id: 'claim', awareness: 'name or id', subject: 'what', score: '0-1' }, run (call) { cl().scoreEffectiveness(cid(call), String(need(call.props.awareness, 'awareness(...)')), String(need(call.props.subject, 'subject(...)')), Number(need(call.props.score, 'score(...)'))); return 'Scored' } })
  registerOmni('Claim', 'view', { summary: 'Walk into a claim: three rooms (true, false, undefined) sized by their shares, and the testimonies as particles coloured by who said them: Omni Claim view id(cup) [state(on|off|toggle)]', props: { id: 'claim', state: 'on | off | toggle' },
    run (call) { const v = SERVICES.claimview; if (!v) throw new Error('the claim view module is not running'); const id = cid(call); const a = String(call.props.state ?? 'on').toLowerCase(); if (!['on', 'off', 'toggle'].includes(a)) throw new Error('state(on|off|toggle)'); if (a === 'off') return v.hide(id) ? 'Rooms closed' : 'Not open'; if (a === 'toggle') { v.toggle(id); return v.isShown(id) ? 'Rooms open' : 'Rooms closed' } v.show(id); return 'Rooms open: ' + v.stats(id).rooms.map(r => `${r.key} ${Math.round(r.share * 100)}%`).join(' · ') + ' — ' + v.stats(id).particles + ' particles' } })
  registerOmni('Claim', 'path', { summary: 'The history of a claim, oldest first: Omni Claim path id(cup)', props: { id: 'claim' }, run (call) { return cl().path(cid(call)).map(e => `${new Date(e.at).toISOString().slice(0, 19)}Z ${e.type}${e.to ? ' → ' + e.to : ''}${e.reason ? ' (' + e.reason + ')' : ''}`).join('\n') || 'Nothing yet' } })
  registerOmni('Claim', 'private', { summary: 'Seal a claim under a key (the key is never saved): Omni Claim private id(cup) key(my secret)', props: { id: 'claim', key: '4+ characters' }, async run (call) { await cl().makePrivate(cid(call), String(need(call.props.key, 'key(...)'))); return 'Sealed. Without the key only the title is visible.' } })
  registerOmni('Claim', 'unlock', { summary: 'Open a private claim for this session: Omni Claim unlock id(cup) key(...)', props: { id: 'claim', key: 'the key' }, async run (call) { await cl().unlock(cid(call), String(need(call.props.key, 'key(...)'))); return 'Unlocked for this session' } })
  registerOmni('Claim', 'lock', { summary: 'Seal an unlocked private claim again (forgets the key): Omni Claim lock id(cup)', props: { id: 'claim' }, async run (call) { await cl().lock(cid(call)); return 'Locked' } })
  registerOmni('Claim', 'public', { summary: 'Take the seal off an unlocked private claim: Omni Claim public id(cup)', props: { id: 'claim' }, run (call) { cl().makePublic(cid(call)); return 'Now public' } })
  registerOmni('Claim', 'list', { summary: 'The claims in the scene (private ones show only their title)', props: {}, run () { const a = cl().list(); return a.length ? a.map(id => cl().isLocked(id) ? `${id}: 🔒 ${cl().title(id)}` : `${id}: ${cl().title(id)} — ${shareLine(id)}`).join('\n') : 'No claims yet. Omni Claim create claim(...)' } })

  // ── Scene file (V236) — the .omni.json scene ──
  const sf = () => { if (!SERVICES.scenefile) throw new Error('the scene file module is not running'); return SERVICES.scenefile }
  const sfMode = (call) => { const m = String(call.props.mode ?? 'replace').toLowerCase(); if (m !== 'replace' && m !== 'merge') throw new Error('mode(replace|merge)'); return m }
  registerOmni('Scene', 'export', { keywordSummary: 'save the whole scene as a .omni.json file, or load one back', summary: 'Omni Scene export [name(My reality)] [path(/home/scenes/a)]  (no path: the browser downloads it)', props: { name: 'a name for the file', path: 'write into the in-browser file system instead of downloading' },
    run (call) { const name = call.props.name === undefined ? '' : str(call.props.name, 80); if (call.props.path !== undefined) return 'Saved ' + sf().saveTo(String(call.props.path), { name }); return 'Downloaded ' + sf().download({ name }) } })
  registerOmni('Scene', 'check', { summary: 'Read a scene file from the in-browser file system and say what is in it, without loading it: Omni Scene check path(/home/scenes/a.omni.json) [mode(merge)]', props: { path: 'the file', mode: 'replace (default) | merge' },
    run (call) { const fs = SERVICES.fs; if (!fs) throw new Error('the file system is not running'); const r = sf().check(fs.read(String(need(call.props.path, 'path(...)'))), { mode: sfMode(call) }); return (r.ok ? 'OK: ' : 'Cannot load: ') + r.summary + (r.warnings.length ? '\n' + r.warnings.slice(0, 10).map(w => '• ' + w).join('\n') : '') } })
  registerOmni('Scene', 'import', { summary: 'Load a scene file. mode(replace) clears the scene first and needs confirm; mode(merge) adds. No path: opens the file picker. Omni Scene import path(/home/scenes/a.omni.json) mode(merge)', destructive: false, props: { path: 'a file in the in-browser file system (omit for the file picker)', mode: 'replace (default, needs the word confirm) | merge', confirm: 'required for replace' },
    run (call) { const mode = sfMode(call); if (mode === 'replace' && !(call.words.some(w => w.toLowerCase() === 'confirm') || call.props.confirm === true)) throw new Error('replace clears the scene first: add the word "confirm", or use mode(merge)'); if (call.props.path === undefined) { sf().pick({ mode }).then(t => send('omni:notify-info', { text: t.split('\n')[0] }), e => send('omni:notify-info', { text: 'Scene file: ' + e.message })); return 'Choose a .omni.json file in the picker' } return sf().importFromPath(String(call.props.path), { mode }) } })

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
  registerOmni('Vibration', 'start', { keywordSummary: 'looped, rhythmic motion', summary: 'Omni Vibration start target(user) program(bounce) hold(5)', props: { target: 'user or a node id', program: 'bounce, hop, sway, pulse, shake, float, dance or yours', hold: 'seconds to sustain, 0 = until stopped', attack: 'seconds', release: 'seconds', bpm: 'beats per minute (beat timing)', land: 'where the beat falls: apex (in the air) | ground | middle | none', offset: 'beats, -0.5..0.5: the beat lands a little later (+) or earlier (-) than that point', sync: 'song = follow the playing song\'s beat and tempo | none' }, run (call) {
    const p = call.props
    if (p.land !== undefined && !['none', 'ground', 'middle', 'apex'].includes(String(p.land))) throw new Error('land(apex|ground|middle|none)')
    if (p.sync !== undefined && !['none', 'song'].includes(String(p.sync))) throw new Error('sync(song|none)')
    const id = vb().start(String(p.target ?? 'user'), String(p.program ?? 'bounce'), { hold: p.hold, attack: p.attack, release: p.release, bpm: p.bpm, land: p.land, landOffset: p.offset, sync: p.sync })
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
