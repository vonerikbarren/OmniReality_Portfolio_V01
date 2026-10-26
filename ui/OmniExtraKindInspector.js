/**
 * ui/OmniExtraKindInspector.js — the Inspector block for the OmniPathNode and the floorPanelNode (V191).
 *
 * systems/OmniInspector.js shows it inside its Appearance section next to the V183 kind block (no new icon-strip section): `_customOptionsHTML` returns
 * extraOptionsHTML(data) and `_wireCustomOptions` calls wireExtraOptions(body, data). Everything is read LIVE from the models / runtimes
 * (utils/OmniPathModel.js, systems/OmniFloorPanels.js through Extra.SERVICES) each time the block is built; the block re-renders itself when
 * omni:paths-changed / omni:floorpanel-changed arrive, so the Inspector needs no refresh code of its own.
 *
 * OmniPathNode   name, mode, member count, root, dropped-node note; Open order panel, Record links (LINK mode), Build from hierarchy (GENEALOGY),
 *                Show line, Closed loop.
 * floorPanelNode piece, grid cell, size; Rotate right / left, Mirror, Snap to grid; a MINI GRID of the section's panels: click a panel to select it, then
 *                give its face a picture / GIF / video (file or https link), clear it, apply it to all panels, or remove that panel.
 */

import * as Paths from '../utils/OmniPathModel.js'
import * as Extra from '../utils/OmniExtraKinds.js'
import * as Media from '../utils/FloorPanelMedia.js'
import { PIECES } from '../utils/OmniFloorPieces.js'
import * as Shells from '../utils/TerminalShells.js'
import { terminalFormHTML, wireTerminalForm } from './TerminalSettingsForm.js'   // V192: TerminalShellTunnel — the Terminal settings section
import { soundKindBlockHTML, wireSoundKindBlock } from './OmniSoundInspector.js'   // V194: SoundNode — the short sound block (the full 'Sound' section is the Inspector's own)
import { songKindBlockHTML, wireSongKindBlock } from './OmniSongInspector.js'
import { docKindBlockHTML, wireDocKindBlock } from './OmniDocInspector.js'   // V203: DocNode — document, page turns, width, Open ⟐OmniDoc
import { noteKindBlockHTML, wireNoteKindBlock } from './OmniNoteInspector.js'   // V213
import { voxelKindBlockHTML, wireVoxelKindBlock } from './OmniVoxelNodeInspector.js'   // V211
import { polyKindBlockHTML, wirePolyKindBlock } from './OmniPolyInspector.js'   // V204: PolyNode — shape, edge, Open ⟐OmniPoly
import { mixKindBlockHTML, wireMixKindBlock } from './OmniMixInspector.js'   // V201: OmniMusicMixNode — strips, Play / Stop, Record, Open mixer   // V198: SongNode — tempo, length, Play / Pause / Stop, Open song editor
import { musicKindBlockHTML, wireMusicKindBlock } from './OmniMusicInspector.js'   // V195: MusicNode — tempo, Play / Stop / Record, Open sequencer

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const tip = (name, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="—" data-omni-tip-desc="${esc(desc)}"`

const STYLES = `
#oi-custom-extra .oix-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; align-items: center; }
#oi-custom-extra .oix-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
#oi-custom-extra .oix-val { flex: 1 1 auto; min-width: 0; font-size: 10.5px; line-height: 1.35; overflow-wrap: anywhere; color: var(--oi-text, rgba(255,255,255,.92)); }
#oi-custom-extra .oix-in { flex: 1 1 120px; min-width: 0; min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
#oi-custom-extra .oix-in option { color: #111; background: #fff; }
#oi-custom-extra .oix-grid { display: grid; gap: 3px; margin: 6px 0; justify-content: start; }
#oi-custom-extra .oix-cell { width: 34px; height: 34px; border-radius: 4px; border: 1px solid rgba(255,255,255,.25); background: rgba(255,255,255,.04); color: inherit; font-size: 14px; cursor: pointer; padding: 0; }
#oi-custom-extra .oix-cell.is-on { background: rgba(127,214,255,.35); border-color: rgba(127,214,255,.9); }
#oi-custom-extra .oix-cell.is-sel { outline: 2px solid #ffd27f; }
#oi-custom-extra .oix-cell.is-empty { visibility: hidden; }
#oi-custom-extra .oix-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; }
#oi-custom-extra .oix-msg.is-err { color: #ff9c9c; }
#oi-custom-extra .oix-note { font-size: 9.5px; opacity: .75; line-height: 1.4; }
@media (max-width: 700px) { #oi-custom-extra .oix-row .oi-btn-small, #oi-custom-extra .oix-in { min-height: 40px; } #oi-custom-extra .oix-cell { width: 44px; height: 44px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oix-styles')) return
  const s = document.createElement('style'); s.id = 'oix-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const SEL = { id: null, key: null }   // the selected panel cell of the selected floorPanel node, as 'x,z'
const MSG = { id: null, text: '', err: false }
const say = (id, text, err = false) => { MSG.id = id; MSG.text = text; MSG.err = err }
const KIND_ICON = { image: '🖼', gif: '🎞', video: '🎬' }

// ── OmniPathNode ──────────────────────────────────────────────────────────────

function pathHTML (d) {
  const p = Paths.getPath(d.pathId)
  if (!p) return `<div class="oik-missing" data-testid="path-missing">❓ This path no longer exists. The node can be deleted.</div>`
  const rec = Extra.SERVICES.paths?.recordingId === p.id
  const root = p.rootId ? esc(Extra.SERVICES.paths?.nodeInfo(p.rootId).label ?? p.rootId) : 'none'
  return `
    <div class="oix-row"><span class="oi-label">Name</span><input class="oix-in" data-f="name" maxlength="40" value="${esc(p.name)}" ${tip('Path name', 'Renames the path (and this node).')}></div>
    <div class="oix-row"><span class="oi-label">Nodes</span><span class="oix-val" data-testid="path-count">${p.members.length} in order · ${p.mode === 'link' ? 'attached one to the next' : 'from the hierarchy'}${p.closed ? ' · closed loop' : ''}</span></div>
    ${p.mode === 'genealogy' ? `<div class="oix-row"><span class="oi-label">Root</span><span class="oix-val">${root}</span></div>` : ''}
    ${p.droppedCount ? `<div class="oix-note" data-testid="path-dropped">${p.droppedCount} deleted node${p.droppedCount > 1 ? 's were' : ' was'} dropped from the order${p.dropped[0] ? ' (last: ' + esc(p.dropped[0].label || p.dropped[0].id) + ')' : ''}.</div>` : ''}
    <div class="oix-row">
      <button class="oi-btn-small" data-xact="order" ${tip('Open node order panel', 'Opens ⟐OmniNodeOrder: the members in order, drag to reorder, jump to a node, add, remove.')}>Open order panel</button>
      <button class="oi-btn-small ${rec ? 'is-active' : ''}" data-xact="record" aria-pressed="${rec}" ${tip(rec ? 'Stop recording' : 'Record links', 'LINK mode: while recording, every node you select is appended to this path, so select A, then B, then C. Escape stops.')}>${rec ? '■ Stop recording' : '● Record links'}</button>
    </div>
    <div class="oix-row">
      <button class="oi-btn-small" data-xact="genealogy" ${tip('Build from hierarchy', 'GENEALOGY mode: replaces the order with the root node, its children, their children... (the root is set in the order panel: select a node, then Use selected as root).')}>Build from hierarchy</button>
      <button class="oi-btn-small" data-xact="line" aria-pressed="${p.visible}" ${tip('Show path line', 'Shows or hides the line drawn through the nodes of this path.')}>${p.visible ? 'Hide line' : 'Show line'}</button>
      <button class="oi-btn-small" data-xact="closed" aria-pressed="${p.closed}" ${tip('Closed loop', 'Joins the last node back to the first.')}>${p.closed ? 'Open the loop' : 'Close the loop'}</button>
    </div>`
}

// ── floorPanelNode ────────────────────────────────────────────────────────────

function panelHTML (d) {
  const svc = Extra.SERVICES.panels
  const live = svc?.getSection(d.id) ?? d
  if (!live || !Array.isArray(live.cells)) return `<div class="oik-missing">❓ This floor panel node has no cells.</div>`
  if (SEL.id !== d.id || !live.cells.some(c => c.x + ',' + c.z === SEL.key)) { SEL.id = d.id; SEL.key = live.cells[0] ? live.cells[0].x + ',' + live.cells[0].z : null }
  const w = Math.max(...live.cells.map(c => c.x)) + 1; const h = Math.max(...live.cells.map(c => c.z)) + 1
  const by = new Map(live.cells.map(c => [c.x + ',' + c.z, c]))
  let grid = ''
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const c = by.get(x + ',' + z)
    grid += c
      ? `<button class="oix-cell is-on ${SEL.key === x + ',' + z ? 'is-sel' : ''}" data-cell="${x},${z}" aria-label="Panel ${x},${z}" ${tip('Panel ' + x + ',' + z, 'Click to choose this panel, then give its face a picture, GIF or video.')}>${c.media ? KIND_ICON[c.media.kind] ?? '▣' : ''}</button>`
      : `<span class="oix-cell is-empty"></span>`
  }
  const sel = by.get(SEL.key)
  const st = sel?.media ? svc?.media.stateOf(sel.media) : 'none'
  const mediaLine = sel?.media ? `${KIND_ICON[sel.media.kind]} ${esc(sel.media.slot ? 'file ' + sel.media.slot : sel.media.url)} · ${esc(st)}${st === 'error' ? ' (' + esc(svc.media.errorOf(sel.media)) + ')' : ''}` : 'no picture, GIF or video'
  return `
    <div class="oix-row"><span class="oi-label">Piece</span><span class="oix-val" data-testid="fp-piece">${esc(PIECES[live.pieceId]?.name ?? live.pieceId)} · turned ${live.rot * 90}°${live.mirror ? ' · mirrored' : ''} · ${live.cells.length} panel${live.cells.length === 1 ? '' : 's'}</span></div>
    <div class="oix-row"><span class="oi-label">Floor cell</span><span class="oix-val" data-testid="fp-cell">${live.gx}, ${live.gz} · cell ${live.cellSize} units</span></div>
    <div class="oix-row">
      <button class="oi-btn-small" data-xact="rot-cw" ${tip('Rotate right', 'Turns the whole section a quarter turn clockwise (refused if it would overlap another panel).')}>⟳ Right</button>
      <button class="oi-btn-small" data-xact="rot-ccw" ${tip('Rotate left', 'Turns the whole section a quarter turn counter-clockwise.')}>⟲ Left</button>
      <button class="oi-btn-small" data-xact="mirror" ${tip('Mirror', 'Flips the section left to right.')}>⇋ Mirror</button>
      <button class="oi-btn-small" data-xact="snap" ${tip('Snap to grid', 'Puts the section back on the floor cell it is over (after you dragged it).')}>Snap</button>
    </div>
    <div class="oi-custom-title" style="margin-top:6px">Panels</div>
    <div class="oix-grid" style="grid-template-columns: repeat(${w}, auto)" data-testid="fp-grid" role="group" aria-label="Panels of this section">${grid}</div>
    <div class="oix-row"><span class="oi-label">Face</span><span class="oix-val" data-testid="fp-media">${mediaLine}</span></div>
    <div class="oix-row">
      <button class="oi-btn-small" data-xact="file" ${tip('Choose a file', 'Picture (png, jpg, webp, up to 2 MB), GIF (up to 4 MB) or video (mp4, webm, up to 8 MB, muted and looping) for the chosen panel.')}>Choose file…</button>
      <input type="file" data-f="file" accept="${esc(Media.ACCEPT)}" style="display:none">
      <button class="oi-btn-small" data-xact="all-file" ${tip('File for all panels', 'The same file on every panel of this section.')}>File for all…</button>
      <button class="oi-btn-small" data-xact="clear" ${tip('Clear the face', 'Removes the picture / GIF / video from the chosen panel.')}>Clear</button>
    </div>
    <div class="oix-row">
      <input class="oix-in" data-f="url" placeholder="https:// link to a picture, GIF or video" maxlength="${Media.MAX_URL}" ${tip('Link', 'An https link. The site must allow other pages to use the file (CORS), otherwise the face stays grey.')}>
      <select class="oix-in" data-f="kind" style="flex:0 0 84px" ${tip('Link kind', 'What the link is. Auto guesses from the end of the link.')}><option value="">auto</option><option value="image">picture</option><option value="gif">GIF</option><option value="video">video</option></select>
      <button class="oi-btn-small" data-xact="url" ${tip('Use link', 'Puts the link on the chosen panel.')}>Use link</button>
      <button class="oi-btn-small" data-xact="all-url" ${tip('Link for all panels', 'Puts the link on every panel of this section.')}>For all</button>
    </div>
    <div class="oix-row">
      <label class="oix-val" style="flex:1 1 140px">Opacity <input type="range" data-f="opacity" min="0.1" max="1" step="0.05" value="${live.panelOpacity ?? 0.9}" ${tip('Panel opacity', 'How see-through the panels of this section are.')}></label>
      <button class="oi-btn-small" data-xact="remove" ${tip('Remove this panel', 'Deletes the chosen panel only. The node goes when its last panel goes.')}>Remove panel</button>
    </div>`
}

// ── TerminalShellTunnel (V192) ────────────────────────────────────────────────

function terminalHTML (d) {
  const sh = Shells.getShell(d.shellId)
  const on = Shells.isOn()
  return `
    <div class="oix-row"><span class="oi-label">Terminals</span><span class="oix-val" data-testid="ts-state">${on ? 'ON' : 'OFF'} · ${Shells.shellCount()} shell node${Shells.shellCount() === 1 ? '' : 's'} + the built-in tunnel</span>
      <button class="oi-btn-small" data-xact="ts-toggle" aria-pressed="${on}" ${tip('Switch all terminals', 'The same as the Terminal button: switches the built-in tunnel and every TerminalShellTunnel node on or off together.')}>${on ? 'Switch all off' : 'Switch all on'}</button></div>
    ${sh ? '' : '<div class="oik-missing" data-testid="ts-missing">The settings of this shell were not found; they are created again when the node is next used.</div>'}
    <div data-ref="ts-form">${terminalFormHTML({ scope: 'shell', shellId: d.shellId })}</div>`
}

/** The whole block (an element with id="oi-custom-extra"). */
export function extraOptionsHTML (data) {
  if (data.nodeKind === Extra.KIND_SOUND) return soundKindBlockHTML(data)   // V194
  if (data.nodeKind === Extra.KIND_MUSIC) return musicKindBlockHTML(data)   // V195
  if (data.nodeKind === Extra.KIND_SONG) return songKindBlockHTML(data)   // V198
  if (data.nodeKind === Extra.KIND_MIX) return mixKindBlockHTML(data)   // V201
  if (data.nodeKind === Extra.KIND_DOC) return docKindBlockHTML(data)   // V203
  if (data.nodeKind === Extra.KIND_POLY) return polyKindBlockHTML(data)   // V204
  if (data.nodeKind === Extra.KIND_VOXEL) return voxelKindBlockHTML(data)   // V211
  if (data.nodeKind === Extra.KIND_NOTE) return noteKindBlockHTML(data)   // V213
  injectStyles(); bindLiveRefresh()
  if (data.nodeKind === Extra.KIND_TERMINAL_SHELL) {
    return `
    <div class="oi-custom-section" id="oi-custom-extra" data-kind="${esc(data.nodeKind)}" data-node-id="${esc(data.id)}">
      <div class="oi-custom-title">›_ Terminal settings</div>
      ${terminalHTML(data)}
      <div class="oix-msg" role="status" aria-live="polite" data-ref="extra-msg"></div>
      <div class="oix-note">A TerminalShellTunnel node is an in-scene terminal that moves with the node. It is a reference: the settings are kept in ⟐TerminalSettings' shell list, not copied into the node. You can have several.</div>
    </div>`
  }
  const isPath = data.nodeKind === Extra.KIND_PATH
  const msg = MSG.id === data.id ? MSG.text : ''
  return `
    <div class="oi-custom-section" id="oi-custom-extra" data-kind="${esc(data.nodeKind)}" data-node-id="${esc(data.id)}">
      <div class="oi-custom-title">${isPath ? '⤳ Path' : '▦ Floor panels'}</div>
      ${isPath ? pathHTML(data) : panelHTML(data)}
      <div class="oix-msg ${MSG.err && msg ? 'is-err' : ''}" role="status" aria-live="polite" data-ref="extra-msg">${esc(msg)}</div>
      <div class="oix-note">${isPath ? 'The node stands for the path; the order lives in the node order panel. Deleting a member node drops it from the order.' : 'One section = one node. Panels sit on the floor grid; the face media is kept in this browser and loads when the section is on screen.'}</div>
    </div>`
}

const ev = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))

/** Run one action. Returns { ok, text }. Exported so the tests (and other panels) call the same code the buttons do. */
export async function runExtraAction (data, act, ctx = {}) {
  const out = (ok, text) => ({ ok: !!ok, text })
  const res = (r, okText) => (r.ok ? out(true, okText) : out(false, r.error || 'Not possible.'))
  if (data.nodeKind === Extra.KIND_TERMINAL_SHELL) {
    if (act === 'ts-toggle') { ev('omni:terminal-invoke', { toggle: true }); return out(true, Shells.isOn() ? 'All terminals are on.' : 'All terminals are off.') }
    return out(true, '')
  }
  if (data.nodeKind === Extra.KIND_PATH) {
    const svc = Extra.SERVICES.paths
    const p = Paths.getPath(data.pathId)
    if (!p) return out(false, 'This path no longer exists.')
    switch (act) {
      case 'order': Paths.setActive(p.id); ev('omni:nav-select', { drawer: 'inspector', item: '⟐OmniNodeOrder', parent: null, path: 'inspector/⟐OmniNodeOrder' }); return out(true, 'Opened the node order panel.')
      case 'record': if (svc?.recordingId === p.id) { svc.stopRecording(); return out(true, 'Recording stopped.') } return svc?.startRecording(p.id) ? out(true, 'Recording: select the nodes one after another.') : out(false, 'Recording is not available.')
      case 'genealogy': { const r = svc?.buildGenealogy(p.id) ?? { ok: false, error: 'Not available.' }; return r.ok ? out(true, `Built from the hierarchy: ${r.path.members.length} nodes.`) : out(false, r.error) }
      case 'line': Paths.setVisible(p.id, !p.visible); return out(true, p.visible ? 'Line hidden.' : 'Line shown.')
      case 'closed': Paths.setClosed(p.id, !p.closed); return out(true, p.closed ? 'Loop opened.' : 'Loop closed.')
      case 'rename': return res(Paths.rename(p.id, ctx.name), 'Renamed.')
      default: return out(true, '')
    }
  }
  const svc = Extra.SERVICES.panels
  if (!svc) return out(false, 'The floor panel system is not running.')
  const id = data.id
  const [x, z] = (SEL.key ?? '0,0').split(',').map(Number)
  switch (act) {
    case 'rot-cw': return res(svc.transformNode(id, 'cw'), 'Turned right.')
    case 'rot-ccw': return res(svc.transformNode(id, 'ccw'), 'Turned left.')
    case 'mirror': return res(svc.transformNode(id, 'mirror'), 'Mirrored.')
    case 'snap': return res(svc.snapNode(id), 'Snapped to the grid.')
    case 'clear': return res(svc.setCellMedia(id, x, z, null), 'Face cleared.')
    case 'remove': { const r = svc.removePanel(id, x, z); if (r.deleted) SEL.id = null; return res(r, r.deleted ? 'Last panel removed; the node is gone.' : 'Panel removed.') }
    case 'url': return res(svc.attachUrl(id, x, z, ctx.url, ctx.kind || null), 'Link set.')
    case 'all-url': return res(svc.attachUrl(id, x, z, ctx.url, ctx.kind || null, true), 'Link set on all panels.')
    case 'file': case 'all-file': return res(await svc.attachFile(id, x, z, ctx.file, act === 'all-file'), act === 'all-file' ? 'File set on all panels.' : 'File set.')
    case 'opacity': { const d = svc.getSection(id); if (!d) return out(false, ''); d.panelOpacity = Math.min(1, Math.max(0.1, Number(ctx.value) || 0.9)); ev('omni:force-save', {}); ev('omni:floorpanel-changed', { id }); return out(true, 'Opacity set.') }
    default: return out(true, '')
  }
}

function rerender (root) {
  const sec = root.querySelector?.('#oi-custom-extra') ?? document.getElementById('oi-custom-extra')
  if (!sec) return
  const id = sec.dataset.nodeId
  const data = Extra.SERVICES.panels?.getSection(id) ?? Extra.SERVICES.paths?.omniNode?.getNodeData?.(id) ?? Extra.SERVICES.shells?.omniNode?.getNodeData?.(id)
  if (!data) return
  const tmp = document.createElement('div'); tmp.innerHTML = extraOptionsHTML(data)
  const fresh = tmp.firstElementChild
  sec.replaceWith(fresh)
  wireExtraOptions(fresh.parentElement ?? document, data)
}

/** Wire the controls of the block that extraOptionsHTML rendered. */
export function wireExtraOptions (root, data) {
  if (data.nodeKind === Extra.KIND_SOUND) { wireSoundKindBlock(root, data); return }   // V194
  if (data.nodeKind === Extra.KIND_MUSIC) { wireMusicKindBlock(root, data); return }   // V195
  if (data.nodeKind === Extra.KIND_SONG) { wireSongKindBlock(root, data); return }   // V198
  if (data.nodeKind === Extra.KIND_MIX) { wireMixKindBlock(root, data); return }   // V201
  if (data.nodeKind === Extra.KIND_DOC) { wireDocKindBlock(root, data); return }   // V203
  if (data.nodeKind === Extra.KIND_POLY) { wirePolyKindBlock(root, data); return }   // V204
  if (data.nodeKind === Extra.KIND_VOXEL) { wireVoxelKindBlock(root, data); return }   // V211
  if (data.nodeKind === Extra.KIND_NOTE) { wireNoteKindBlock(root, data); return }   // V213
  const sec = root.querySelector?.('#oi-custom-extra')
  if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  if (data.nodeKind === Extra.KIND_TERMINAL_SHELL) {
    const host = sec.querySelector('[data-ref="ts-form"]')
    if (host) wireTerminalForm(host, { scope: 'shell', shellId: data.shellId })
    sec.addEventListener('click', async (e) => {
      const b = e.target.closest?.('[data-xact]')
      if (!b || b.disabled) return
      const r = await runExtraAction(data, b.dataset.xact)
      say(data.id, r.text, !r.ok)
      const m = sec.querySelector('[data-ref="extra-msg"]'); if (m) m.textContent = r.text
    })
    return
  }
  const finish = (text, err) => { say(data.id, text, !!err); const m = sec.querySelector('[data-ref="extra-msg"]'); if (m) { m.textContent = text; m.classList.toggle('is-err', !!err) } rerender(sec.parentElement ?? document) }
  const fileIn = sec.querySelector('[data-f="file"]')
  let allFiles = false
  sec.addEventListener('click', async (e) => {
    const cell = e.target.closest?.('[data-cell]')
    if (cell) { SEL.id = data.id; SEL.key = cell.dataset.cell; rerender(sec.parentElement ?? document); return }
    const b = e.target.closest?.('[data-xact]')
    if (!b || b.disabled) return
    const act = b.dataset.xact
    if (act === 'file' || act === 'all-file') { allFiles = act === 'all-file'; fileIn?.click(); return }
    const url = sec.querySelector('[data-f="url"]')?.value ?? ''; const kind = sec.querySelector('[data-f="kind"]')?.value ?? ''
    const r = await runExtraAction(data, act, { url, kind })
    finish(r.text, !r.ok)
  })
  fileIn?.addEventListener('change', async () => {
    const f = fileIn.files?.[0]; if (!f) return
    const r = await runExtraAction(data, allFiles ? 'all-file' : 'file', { file: f })
    fileIn.value = ''
    finish(r.text, !r.ok)
  })
  sec.querySelector('[data-f="name"]')?.addEventListener('change', async (e) => { const r = await runExtraAction(data, 'rename', { name: e.target.value }); finish(r.text, !r.ok) })
  sec.querySelector('[data-f="opacity"]')?.addEventListener('input', (e) => { runExtraAction(data, 'opacity', { value: e.target.value }) })
}

let LIVE_BOUND = false
/** Re-render an open block when the models change (called once; harmless to call again). */
export function bindLiveRefresh () {
  if (LIVE_BOUND || typeof window === 'undefined') return
  LIVE_BOUND = true
  const h = () => { if (typeof document !== 'undefined' && document.getElementById('oi-custom-extra')) rerender(document) }
  window.addEventListener('omni:floorpanel-changed', h)
  window.addEventListener(Paths.CHANGED_EVENT, h)
  window.addEventListener('omni:path-recording-changed', h)
  // V192: the Terminal block re-renders for the on / off state of the terminals (the form inside it keeps itself in sync)
  window.addEventListener(Shells.STATE_EVENT, () => { const sec = typeof document !== 'undefined' ? document.getElementById('oi-custom-extra') : null; if (sec?.dataset.kind === Extra.KIND_TERMINAL_SHELL) rerender(document) })
}
