/**
 * ui/OmniDrawModePicker.js — ⟐OmniDraw mode picker
 *
 * "Maybe a menu pops up and the user selects which draw they want?
 * The input from the user verifies the tool?" — this is that menu,
 * and it's the first real, concrete use of Desire/PrimaryForce: the
 * click IS Desire (forward, stated intent — "I want Dynamic"), and
 * whichever mode's own real behavior follows is what PrimaryForce
 * would eventually confirm against it.
 *
 * Takes over the '⟐OmniDraw' nav-select label itself — OmniDraw's
 * own panel (now Static) listens for '⟐OmniDrawStatic' instead.
 */

import gsap from 'gsap'
import { declareDesire } from '../utils/DesirePrimaryForce.js'
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { generateId } from '../systems/OmniNode.js'

const STYLES = `

.omni-draw-mode-picker {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(560px, 92vw); max-height: 82vh; overflow-y: auto; box-sizing: border-box;
  background: rgba(8,8,12,0.94); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 14px;
  font-family: 'Courier New', Courier, monospace; z-index: 65;
  opacity: 0; visibility: hidden; pointer-events: auto;
}
/* V164: the option list is a responsive grid of tiles (it was a one-row flex strip). */
.odmp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
.odmp-title { grid-column: 1 / -1; text-align: center; font-size: 10px; color: rgba(255,255,255,0.6); letter-spacing: 0.05em; padding-bottom: 2px; }
.odmp-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 0;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px; color: #fff; font-family: inherit; font-size: 12px;
  padding: 14px 8px; cursor: pointer; text-align: center;
}
.odmp-btn:hover, .odmp-btn:focus-visible { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); outline: none; }
.odmp-btn.is-active { background: rgba(255,179,71,0.16); border-color: rgba(255,179,71,0.7); }
.odmp-glyph { font-size: 20px; line-height: 1; opacity: 0.9; }
.odmp-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 520px) { .odmp-grid { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); } .odmp-btn { padding: 12px 4px; font-size: 11px; } }

`

function injectStyles () {
  if (document.getElementById('odmp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'odmp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniDrawModePicker {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
    this._onDocClick = null
  }

  init () {
    injectStyles()
    this._el = document.createElement('div')
    this._el.className = 'omni-draw-mode-picker'
    this._el.innerHTML = `
      <div class="odmp-grid">
        <span class="odmp-title">⟐OmniDraw — choose a mode</span>
        <button class="odmp-btn" data-mode="static" title="place &amp; shape a real object" aria-pressed="false"><span class="odmp-glyph">▣</span><span class="odmp-label">Static</span></button>
        <button class="odmp-btn" data-mode="dynamic" title="a string, read and shown over time" aria-pressed="false"><span class="odmp-glyph">≋</span><span class="odmp-label">Dynamic</span></button>
        <button class="odmp-btn" data-mode="jsonifier" title="a JSON tree, toggled open branch by branch" aria-pressed="false"><span class="odmp-glyph">{ }</span><span class="odmp-label">Jsonifier</span></button>
        <button class="odmp-btn" data-mode="omnicell" title="numerical data, straight to a real D3 chart" aria-pressed="false"><span class="odmp-glyph">▥</span><span class="odmp-label">OmniCell</span></button>
        <button class="odmp-btn" data-mode="chat" title="a live message/terminal build tool" aria-pressed="false"><span class="odmp-glyph">✉</span><span class="odmp-label">Chat</span></button>
        <button class="odmp-btn" data-mode="log" title="a blog post, genuinely paginated into real, in-scene pages" aria-pressed="false"><span class="odmp-glyph">☰</span><span class="odmp-label">Log</span></button>
        <button class="odmp-btn" data-mode="omninode" title="the real node registry — Essence Data and every other type" aria-pressed="false"><span class="odmp-glyph">◉</span><span class="odmp-label">OmniNode</span></button>
        <button class="odmp-btn" data-mode="behavior" title="a node that animates others: Orbit, Leader, Follower, Attract, Repel and more" aria-pressed="false"><span class="odmp-glyph">⟳</span><span class="odmp-label">BehaviorNode</span></button>
        <button class="odmp-btn" data-mode="sound" title="a SoundNode: a speaker you place; a note, a pad or a beat, with particles" aria-pressed="false"><span class="odmp-glyph">♪</span><span class="odmp-label">Sound</span></button>
        <button class="odmp-btn" data-mode="music" title="a MusicNode: a step sequencer you place; record from the keys or MIDI" aria-pressed="false"><span class="odmp-glyph">♫</span><span class="odmp-label">Music</span></button>
        <button class="odmp-btn" data-mode="song" title="a SongNode: arrange music nodes and audio clips on a timeline with a mixer; opens the song editor" aria-pressed="false"><span class="odmp-glyph">♬</span><span class="odmp-label">Song</span></button>
        <button class="odmp-btn" data-mode="mix" title="an OmniMusicMixNode: a mixing desk with DJ crossfader for songs, sounds and audio clips; opens the mixer" aria-pressed="false"><span class="odmp-glyph">♫♫</span><span class="odmp-label">Mix</span></button>
        <button class="odmp-btn" data-mode="doc" title="a DocNode: a flat sheet that shows a PDF, markdown, text, image or guide page inside the space; opens the document panel" aria-pressed="false"><span class="odmp-glyph">▤</span><span class="odmp-label">Doc</span></button>
        <button class="odmp-btn" data-mode="poly" title="a PolyNode: a cube, tetrahedron, octahedron, dodecahedron, icosahedron, plane, strip or ring whose every face holds its own colour, picture, text, document or sound; opens the poly panel" aria-pressed="false"><span class="odmp-glyph">⬡</span><span class="odmp-label">Poly</span></button>
        <button class="odmp-btn" data-mode="time" title="a TimeNode: a cube with six sides (start and end date and time, title, status), a ring and a spinning icosahedron that travels it as the time is fulfilled; add more to make a sequence. Opens its Inspector section" aria-pressed="false"><span class="odmp-glyph">◷</span><span class="odmp-label">Time</span></button>
        <button class="odmp-btn" data-mode="sticky" title="a small coloured sticky note; with a node selected it is stuck on that node and follows it" aria-pressed="false"><span class="odmp-glyph">❏</span><span class="odmp-label">Sticky</span></button>
        <button class="odmp-btn" data-mode="flash" title="a deck of flashcards in one node: text, pictures and sounds on each side" aria-pressed="false"><span class="odmp-glyph">▥</span><span class="odmp-label">Flashcards</span></button>
        <button class="odmp-btn" data-mode="rhythm" title="a beat source: every beat can pulse, bounce, spin or flash any node bound to it" aria-pressed="false"><span class="odmp-glyph">♩</span><span class="odmp-label">Rhythm</span></button>
        <button class="odmp-btn" data-mode="epistemics" title="one step in how a thing is passed down: event, observation, memory, rumour, gossip, narrative, record, absence, what-if" aria-pressed="false"><span class="odmp-glyph">◉</span><span class="odmp-label">Epistemics</span></button>
        <button class="odmp-btn" data-mode="voxel" title="a VoxelNode: makes the fixed-size voxel room in front of you (a node marks its centre) and opens the voxel panel" aria-pressed="false"><span class="odmp-glyph">▦</span><span class="odmp-label">Voxel</span></button>
        <button class="odmp-btn" data-mode="dimtext" title="a DimensionalTextNode: words floating in the space in front of you" aria-pressed="false"><span class="odmp-glyph">Aa</span><span class="odmp-label">Dimensional text</span></button>
        <button class="odmp-btn" data-mode="note" title="an OmniNote: a rich-text note (headings, lists, tables, pictures) shown on a sheet in the space" aria-pressed="false"><span class="odmp-glyph">✎</span><span class="odmp-label">Note</span></button>
        <button class="odmp-btn" data-mode="edgenode" title="how you travel a line between two nodes: ride it, go through it as a tunnel, loop a torus or circle an orbit" aria-pressed="false"><span class="odmp-glyph">⟷</span><span class="odmp-label">Edge node</span></button>
        <button class="odmp-btn" data-mode="storedvideo" title="a library video on a flat plane, with a chroma key to remove a green backdrop" aria-pressed="false"><span class="odmp-glyph">▭</span><span class="odmp-label">Stored video</span></button>
        <button class="odmp-btn" data-mode="storedreality" title="a whole course kept in one box: store nodes in it, expand it back out" aria-pressed="false"><span class="odmp-glyph">▣</span><span class="odmp-label">Stored reality</span></button>
        <button class="odmp-btn" data-mode="claim" title="a ClaimNode (DimensionalScripting): a claim that is true, false and undefined at the same time, with testimonies from people, bots, AI and sensors; public, or private behind a key" aria-pressed="false"><span class="odmp-glyph">⟐</span><span class="odmp-label">Claim</span></button>
        <button class="odmp-btn" data-mode="path" title="an OmniPathNode: an ordered path of nodes, linked or from the hierarchy; opens the node order panel" aria-pressed="false"><span class="odmp-glyph">⤳</span><span class="odmp-label">Path</span></button>
        <button class="odmp-btn" data-mode="terminal" title="a TerminalShellTunnel: an in-scene terminal that moves with the node" aria-pressed="false"><span class="odmp-glyph">›_</span><span class="odmp-label">Terminal</span></button>
        <button class="odmp-btn" data-mode="floor" title="Floor panels: Tetris-piece floor panels and a blueprint grid (opens FloorNodeMakerSettings)" aria-pressed="false"><span class="odmp-glyph">▦</span><span class="odmp-label">Floor panels</span></button>
      </div>
    `
    document.body.appendChild(this._el)

    this._el.querySelector('[data-mode="static"]').addEventListener('click', () => this._choose('static'))
    this._el.querySelector('[data-mode="dynamic"]').addEventListener('click', () => this._choose('dynamic'))
    this._el.querySelector('[data-mode="jsonifier"]').addEventListener('click', () => this._choose('jsonifier'))
    this._el.querySelector('[data-mode="omnicell"]').addEventListener('click', () => this._choose('omnicell'))
    this._el.querySelector('[data-mode="chat"]').addEventListener('click', () => this._choose('chat'))
    this._el.querySelector('[data-mode="log"]').addEventListener('click', () => this._choose('log'))
    this._el.querySelector('[data-mode="omninode"]').addEventListener('click', () => this._choose('omninode'))
    this._el.querySelector('[data-mode="behavior"]').addEventListener('click', () => this._choose('behavior'))
    this._el.querySelector('[data-mode="sound"]').addEventListener('click', () => this._choose('sound'))      // V196
    this._el.querySelector('[data-mode="music"]').addEventListener('click', () => this._choose('music'))
    this._el.querySelector('[data-mode="song"]').addEventListener('click', () => this._choose('song'))      // V198
    this._el.querySelector('[data-mode="mix"]').addEventListener('click', () => this._choose('mix'))        // V201
    this._el.querySelector('[data-mode="doc"]').addEventListener('click', () => this._choose('doc'))        // V203
    this._el.querySelector('[data-mode="poly"]').addEventListener('click', () => this._choose('poly'))      // V204
    for (const m of ['time', 'claim', 'sticky', 'flash', 'rhythm', 'epistemics', 'storedvideo', 'storedreality', 'edgenode', 'note', 'voxel', 'dimtext']) this._el.querySelector(`[data-mode="${m}"]`).addEventListener('click', () => this._choose(m))   // V260
    for (const m of ['path', 'terminal', 'floor']) this._el.querySelector(`[data-mode="${m}"]`).addEventListener('click', () => this._choose(m))   // V197

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDraw') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onDocClick = (e) => {
      if (!this._isOpen) return
      if (this._ignoreNextDocClick) return
      if (this._el.contains(e.target)) return
      this.close()
    }
    document.addEventListener('click', this._onDocClick)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    document.removeEventListener('click', this._onDocClick)
    this._el?.remove()
  }

  open () {
    this._isOpen = true
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: 1, duration: 0.2 })
    this._ignoreNextDocClick = true
    setTimeout(() => { this._ignoreNextDocClick = false }, 0)
  }

  close () {
    this._isOpen = false
    gsap.to(this._el, { opacity: 0, duration: 0.15, onComplete: () => { this._el.style.visibility = 'hidden' } })
  }

  _choose (mode) {
    declareDesire(`open-omnidraw-${mode}`, { mode })
    this._el.querySelectorAll('.odmp-btn').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)) })

    // OmniNode is a real, separate registry system (systems/OmniNode.js) —
    // it never listens for 'omni:nav-select' like the other five modes do,
    // only for 'omni:system-toggle' { system: 'omninode' }. Before this,
    // nothing anywhere actually dispatched that event, so its panel (with
    // the "+ Add Node" picker — Essence Data included) had no way to open
    // from the UI at all. This is the fix: real dispatch, real open.
    if (mode === 'omninode') {
      window.dispatchEvent(new CustomEvent('omni:system-toggle', { detail: { system: 'omninode' } }))
      this.close()
      return
    }

    // V196: Sound and Music create a real node (same events as the ribbon Create buttons) and open its editor.
    if (mode === 'sound' || mode === 'music') {
      window.dispatchEvent(new CustomEvent(mode === 'sound' ? 'omni:sound-node-create' : 'omni:music-node-create', { detail: { select: true } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: mode === 'sound' ? '⟐SoundNodeSettings' : '⟐OmniSequencer' } }))
      this.close()
      return
    }

    // V198: Song creates a real song node (same events as the ribbon Create button) and opens the song editor.
    if (mode === 'song') {
      window.dispatchEvent(new CustomEvent('omni:song-node-create', { detail: { select: true } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniSong' } }))
      this.close()
      return
    }

    // V201: Mix creates a real mix node (same event as the ribbon Create button) and opens the mixer.
    if (mode === 'mix') {
      window.dispatchEvent(new CustomEvent('omni:mix-node-create', { detail: { select: true } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniMix' } }))
      this.close()
      return
    }

    // V203: Doc creates a real doc node (same event as the ribbon Create button) and opens the document panel.
    if (mode === 'doc') {
      window.dispatchEvent(new CustomEvent('omni:doc-node-create', { detail: { select: true } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniDoc' } }))
      this.close()
      return
    }

    // V260: Time and Claim create real nodes (same events as the ribbon Create buttons) and open their Inspector sections.
    if (mode === 'time' || mode === 'claim') {
      window.dispatchEvent(new CustomEvent(`omni:${mode}-node-create`, { detail: { select: true } }))
      this.close()
      return
    }

    if (mode === 'voxel') {   // V279
      const r = SERVICES.voxel?.addRoomHere?.()
      if (r && r.ok === false) window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: 'Voxel', desc: r.error || 'Could not make a room here.', holdMs: 3500 } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniVoxel' } }))
      this.close()
      return
    }
    if (mode === 'dimtext') {   // V279: same node the keyboard makes, with words you type
      const cam = SERVICES.lineup?.context?.camera
      const text = (typeof window.prompt === 'function' ? window.prompt('Text for the node', 'Text') : 'Text')
      if (text && text.trim() && cam) {
        const f = new THREE.Vector3(); cam.getWorldDirection(f)
        window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: { id: generateId(), label: 'Text_' + text.trim().slice(0, 12), geometry: 'DimensionalText', primitive: 'objective', color: '#ffffff', text: text.trim().slice(0, 200), textSequence: null, position: [cam.position.x + f.x * 5, Math.max(0.5, cam.position.y + f.y * 5), cam.position.z + f.z * 5], parentId: null } }))
      }
      this.close()
      return
    }
    if (mode === 'note') {   // V278: it was in the Ribbon but not in this list
      window.dispatchEvent(new CustomEvent('omni:note-node-create', { detail: { select: true } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniNote' } }))
      this.close()
      return
    }
    if (mode === 'edgenode') {   // V278
      window.dispatchEvent(new CustomEvent('omni:edgenode-create', { detail: { select: true } }))
      this.close()
      return
    }
    if (mode === 'storedvideo' || mode === 'storedreality') {   // V277
      window.dispatchEvent(new CustomEvent(mode === 'storedvideo' ? 'omni:stored-video-node-create' : 'omni:stored-reality-node-create', { detail: { select: true } }))
      this.close()
      return
    }
    if (mode === 'epistemics') {   // V271
      window.dispatchEvent(new CustomEvent('omni:epistemics-node-create', { detail: { select: true, fromSelected: true } }))
      this.close()
      return
    }
    if (mode === 'rhythm') {   // V270
      window.dispatchEvent(new CustomEvent('omni:rhythm-node-create', { detail: { select: true, bindSelected: true, start: true } }))
      this.close()
      return
    }

    if (mode === 'flash') {   // V269
      window.dispatchEvent(new CustomEvent('omni:flash-node-create', { detail: { select: true } }))
      this.close()
      return
    }

    if (mode === 'sticky') {   // V266
      window.dispatchEvent(new CustomEvent('omni:sticky-note-create', { detail: { select: true, useSelected: true } }))
      this.close()
      return
    }

    // V204: Poly creates a real poly node (same event as the ribbon Create button) and opens the poly panel.
    if (mode === 'poly') {
      window.dispatchEvent(new CustomEvent('omni:poly-node-create', { detail: { select: true } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniPoly' } }))
      this.close()
      return
    }

    // V197: Path / Terminal / Floor panels, the same actions as the ribbon Create buttons.
    if (mode === 'path') {
      window.dispatchEvent(new CustomEvent('omni:path-create-request', { detail: { select: true } }))
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniNodeOrder' } }))
      this.close(); return
    }
    if (mode === 'terminal') {
      window.dispatchEvent(new CustomEvent('omni:terminal-shell-create-request', { detail: { select: true } }))
      this.close(); return
    }
    if (mode === 'floor') {
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐FloorNodeMakerSettings' } }))
      this.close(); return
    }

    const labels = { static: '⟐OmniDrawStatic', dynamic: '⟐OmniDrawDynamic', jsonifier: '⟐OmniDrawJsonifier', omnicell: '⟐OmniDrawCell', chat: '⟐OmniDrawChat', log: '⟐OmniDrawLog', behavior: '⟐OmniDrawBehavior' }
    window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: labels[mode] } }))
    this.close()
  }
}
