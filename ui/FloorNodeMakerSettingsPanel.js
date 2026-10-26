/**
 * ui/FloorNodeMakerSettingsPanel.js — ⟐FloorNodeMakerSettings: the USER's panel for making floor panel nodes (V191, Admin slot 20, class-A window).
 *
 * <System>Settings convention (user-facing, Admin area). It never imports a Dev* module.
 *
 *   PIECES     eleven Tetris-style pieces (I O T S Z J L + single, domino, two triominoes): pick one, rotate right / left, mirror. A small diagram of the
 *              current orientation is shown on every piece button.
 *   GRID       a visible 2D grid (6..24 cells a side, default 12) = the BLUEPRINT. The piece follows the pointer as a ghost (green fits, red does not);
 *              click an empty cell to put the piece there, click a panel to remove that one panel. "Face" mode: click a panel to give it a picture / GIF /
 *              video (file or https link) or clear it.
 *   PLACE      "Place in scene" stamps the blueprint on the floor at the camera target (or at the floor cell typed in); "Place with pointer" arms the scene:
 *              the same piece follows the pointer on the floor grid and a click places it (utils/OmniFloorPieces.js snapping, systems/OmniFloorPanels.js).
 *   SETTINGS   grid size, cell size (default = the floor's grid unit), thickness, colour, opacity, snap, scene grid overlay, max panels
 *              (utils/FloorNodeMakerSettings.js validates and migrates them).
 *   MEDIA      the files kept for panel faces (IndexedDB): list, delete, clean unused.
 */

import OmniSettingsPanelBase, { esc, PHONE_MAX } from './OmniSettingsPanelBase.js'
import * as S from '../utils/FloorNodeMakerSettings.js'
import * as P from '../utils/OmniFloorPieces.js'
import * as M from '../utils/FloorPanelMedia.js'
import * as Extra from '../utils/OmniExtraKinds.js'

export const NAV_ITEM = '⟐FloorNodeMakerSettings'
export const PANEL_ID = 'floornodemaker'
const tip = (name, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="—" data-omni-tip-desc="${esc(desc)}"`
const COLORS = ['#7fd6ff', '#ffb02e', '#8fe3a2', '#ff8ad0', '#c4a6ff', '#ff7a7a']
const KIND_ICON = { image: '🖼', gif: '🎞', video: '🎬' }

const STYLES = `
.fnm-panel .fnm-pieces { display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)); gap: 4px; margin: 4px 0; }
.fnm-panel .fnm-piece { padding: 3px; min-height: 44px; border-radius: 6px; cursor: pointer; color: inherit; font: inherit; font-size: 9px; background: rgba(255,255,255,.06); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); display: flex; flex-direction: column; align-items: center; gap: 2px; }
.fnm-panel .fnm-piece.is-on { background: rgba(127,214,255,.25); border-color: rgba(127,214,255,.9); }
.fnm-panel .fnm-mini { display: grid; gap: 1px; } .fnm-panel .fnm-mini i { width: 7px; height: 7px; background: transparent; display: block; } .fnm-panel .fnm-mini i.on { background: currentColor; }
.fnm-panel .fnm-grid { display: grid; gap: 1px; margin: 6px 0; width: 100%; max-width: 100%; touch-action: manipulation; }
.fnm-panel .fnm-c { aspect-ratio: 1 / 1; min-width: 0; padding: 0; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.035); color: #111; font-size: 10px; line-height: 1; cursor: pointer; border-radius: 2px; }
.fnm-panel .fnm-c.is-ghost { background: rgba(102,255,153,.55); } .fnm-panel .fnm-c.is-bad { background: rgba(255,102,102,.55); }
.fnm-panel .fnm-c.is-sel { outline: 2px solid #ffd27f; outline-offset: -2px; }
.fnm-panel .fnm-note { font-size: 10px; line-height: 1.4; opacity: .75; margin: 4px 0; }
.fnm-panel .fnm-fld { display: flex; flex-direction: column; gap: 2px; flex: 1 1 100px; font-size: 10px; }
.fnm-panel details > summary { cursor: pointer; padding: 4px 0; }
.fnm-panel .fnm-lib { display: flex; gap: 6px; align-items: center; margin: 2px 0; font-size: 10px; }
@media (max-width: ${PHONE_MAX}px) { .fnm-panel .fnm-piece { min-height: 48px; } .fnm-panel .fnm-grid { max-height: 50vh; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('fnm-styles')) return
  const s = document.createElement('style'); s.id = 'fnm-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class FloorNodeMakerSettingsPanel extends OmniSettingsPanelBase {
  /** @param panels the systems/OmniFloorPanels.js instance (place, stamp, arm, counts). */
  constructor (panels) {
    super({ id: PANEL_ID, label: '⟐FloorNodeMakerSettings', iconLabel: '⟐F', navItems: [NAV_ITEM], className: 'fnm-panel', wide: true })
    this.fp = panels
    this.tool = 'piece'          // 'piece' | 'face'
    this.sel = null              // { gx, gz } in the mini grid (face tool)
    this.msg = { text: '', err: false }
    this._h = null
    this._rq = 0
  }

  onInit () {
    injectStyles()
    this._h = () => { if (!this._isOpen || this._rq) return; if (typeof requestAnimationFrame === 'function') this._rq = requestAnimationFrame(() => { this._rq = 0; this.refresh() }); else this.refresh() }
    for (const n of [S.CHANGED_EVENT, 'omni:floorpanel-changed', 'omni:floorpanel-armed-changed', 'omni:node-created', 'omni:node-deleted']) window.addEventListener(n, this._h)
  }
  onDestroy () { if (this._h) for (const n of [S.CHANGED_EVENT, 'omni:floorpanel-changed', 'omni:floorpanel-armed-changed', 'omni:node-created', 'omni:node-deleted']) window.removeEventListener(n, this._h); this._h = null }

  say (text, err = false) { this.msg = { text, err }; const m = this.body?.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'oss-msg ' + (err ? 'is-err' : 'is-ok') } }

  buildBody (body) {
    body.innerHTML = '<div data-ref="main"></div>'
    body.addEventListener('click', (e) => this._click(e))
    body.addEventListener('change', (e) => this._change(e))
    body.addEventListener('mouseover', (e) => this._hover(e))
    body.addEventListener('mouseleave', () => this._clearGhost())
    body.addEventListener('focusin', (e) => this._hover(e))
  }

  // ── Mini grid helpers ───────────────────────────────────────────────────────

  _cells () { const s = S.getSettings(); return P.transformPiece(s.pieceId, s.rot, s.mirror) }

  _clearGhost () { this.body?.querySelectorAll('.fnm-c.is-ghost,.fnm-c.is-bad').forEach(c => c.classList.remove('is-ghost', 'is-bad')) }
  _hover (e) {
    const c = e.target.closest?.('.fnm-c'); this._clearGhost()
    if (!c || this.tool !== 'piece') return
    const gx = Number(c.dataset.gx); const gz = Number(c.dataset.gz); const st = S.getSettings()
    const abs = this._cells().map(([x, z]) => [x + gx, z + gz])
    const bp = S.getBlueprint(); const occ = S.blueprintOccupied(bp)
    const bad = abs.some(([x, z]) => x >= st.gridN || z >= st.gridN || occ.has(x + ',' + z))
    const grid = this.body.querySelector('.fnm-grid')
    abs.forEach(([x, z]) => grid?.querySelector(`.fnm-c[data-gx="${x}"][data-gz="${z}"]`)?.classList.add(bad ? 'is-bad' : 'is-ghost'))
  }

  /** What a click on blueprint cell (gx, gz) does in the current tool. Public so tests use the same code the buttons do. */
  clickCell (gx, gz) {
    const st = S.getSettings(); const bp = S.getBlueprint(); const occ = S.blueprintOccupied(bp)
    const used = occ.has(gx + ',' + gz)
    if (this.tool === 'face') {
      if (!used) { this.sel = null; this.say('Click a panel to choose it.'); return { ok: false } }
      this.sel = { gx, gz }; this.refresh(); return { ok: true, selected: true }
    }
    if (used) {
      const r = S.blueprintRemoveCell(bp, gx, gz)
      if (r.ok) S.setBlueprint(r.bp)
      this.say('Panel removed from the blueprint.')
      return r
    }
    const r = S.blueprintPlace(bp, st.gridN, st.pieceId, st.rot, st.mirror, gx, gz)
    if (r.ok) { S.setBlueprint(r.bp); this.say(`${P.PIECES[st.pieceId].name} placed on the grid.`) } else this.say(r.error, true)
    return r
  }

  async placeInScene (gx = null, gz = null) {
    const r = this.fp?.stampBlueprint(gx, gz) ?? { ok: false, error: 'The floor panel system is not running.' }
    if (r.ok) this.say(`Placed ${r.placed} panel${r.placed === 1 ? '' : 's'} in ${r.sections} section${r.sections === 1 ? '' : 's'} at floor cell ${r.at.gx}, ${r.at.gz}${r.skippedSections ? ` (${r.skippedSections} section${r.skippedSections === 1 ? '' : 's'} skipped: ${r.errors[0]})` : ''}.`)
    else this.say(r.error || 'Nothing placed.', true)
    this.refresh()
    return r
  }

  async _attach (file) {
    if (!this.sel) return this.say('Choose a panel first (Face tool).', true)
    const saved = await M.saveFile(file)
    if (!saved.ok) return this.say(saved.error, true)
    const r = S.blueprintSetMedia(S.getBlueprint(), this.sel.gx, this.sel.gz, saved.ref)
    if (r.ok) { S.setBlueprint(r.bp); this.say('Face set. It is stamped into the scene with the blueprint.') } else this.say('Could not set the face.', true)
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  _click (e) {
    const cell = e.target.closest?.('.fnm-c')
    if (cell) { this.clickCell(Number(cell.dataset.gx), Number(cell.dataset.gz)); return }
    const pc = e.target.closest?.('[data-piece]')
    if (pc) { S.setSettings({ pieceId: pc.dataset.piece }); return }
    const b = e.target.closest?.('[data-act]'); if (!b || b.disabled) return
    const st = S.getSettings(); const a = b.dataset.act
    switch (a) {
      case 'rot-cw': S.setSettings({ rot: (st.rot + 1) % 4 }); break
      case 'rot-ccw': S.setSettings({ rot: (st.rot + 3) % 4 }); break
      case 'mirror': S.setSettings({ mirror: !st.mirror }); break
      case 'tool-piece': this.tool = 'piece'; this.refresh(); break
      case 'tool-face': this.tool = 'face'; this.refresh(); break
      case 'clear': S.setBlueprint({ v: 1, sections: [] }); this.sel = null; this.say('Blueprint cleared.'); break
      case 'place': this.placeInScene(); break
      case 'place-at': { const gx = parseInt(this.body.querySelector('[data-f="atx"]')?.value, 10); const gz = parseInt(this.body.querySelector('[data-f="atz"]')?.value, 10); if (Number.isInteger(gx) && Number.isInteger(gz)) this.placeInScene(gx, gz); else this.say('Type a whole floor cell number in both boxes.', true); break }
      case 'arm': this.fp?.arm(!this.fp.armed); this.say(this.fp?.armed ? 'Place mode on: click the floor.' : 'Place mode off.'); break
      case 'reset': S.resetSettings(); this.say('Settings reset.'); break
      case 'unit': S.setSettings({ cellSize: S.FLOOR_GRID_UNIT }); break
      case 'file': this.body.querySelector('[data-f="file"]')?.click(); break
      case 'url': { const v = M.validateUrl(this.body.querySelector('[data-f="url"]')?.value, this.body.querySelector('[data-f="kind"]')?.value || null); if (!v.ok) { this.say(v.error, true); break } if (!this.sel) { this.say('Choose a panel first (Face tool).', true); break } const r = S.blueprintSetMedia(S.getBlueprint(), this.sel.gx, this.sel.gz, { kind: v.kind, url: v.url }); if (r.ok) { S.setBlueprint(r.bp); this.say('Link set.') } break }
      case 'clear-face': { if (!this.sel) break; const r = S.blueprintSetMedia(S.getBlueprint(), this.sel.gx, this.sel.gz, null); if (r.ok) S.setBlueprint(r.bp); this.say('Face cleared.'); break }
      case 'lib-del': { const slot = Number(b.dataset.slot); M.mediaStore.deleteWallpaper(slot).then(() => { this.say('File deleted.'); this.refresh() }).catch(() => this.say('Could not delete.', true)); break }
      case 'lib-clean': this.cleanUnused(); break
      default: break
    }
  }

  _change (e) {
    const el = e.target; const f = el.dataset?.f; if (!f) return
    if (f === 'file') { const file = el.files?.[0]; if (file) this._attach(file).then(() => { el.value = '' }); return }
    if (f === 'snap' || f === 'overlay') { S.setSettings({ [f]: el.checked }); return }
    if (f === 'color') { S.setSettings({ color: el.value }); return }
    if (['gridN', 'cellSize', 'thickness', 'opacity', 'maxPanels'].includes(f)) {
      const before = S.getSettings()[f]
      const after = S.setSettings({ [f]: el.value })[f]
      if (String(after) !== String(el.value)) this.say(`${f} must be between ${S.RANGES[f].join(' and ')}: using ${after}.`, true)
      if (f === 'gridN' && after < before) {   // shrinking the grid drops sections that no longer fit
        const bp = S.getBlueprint(); S.setBlueprint({ v: 1, sections: bp.sections.filter(s => P.placementCells(s).every(c => c.gx < after && c.gz < after)) })
      }
    }
  }

  /** Delete the media files no blueprint cell and no placed panel uses. Resolves the number deleted. */
  async cleanUnused () {
    let list = []
    try { list = await M.mediaStore.listWallpapers() } catch (_) { this.say('Browser storage is not available.', true); return 0 }
    const used = this._usedSlots()
    let n = 0
    for (const r of list) if (!used.has(r.slot)) { try { await M.mediaStore.deleteWallpaper(r.slot); n++ } catch (_) { /* skip */ } }
    this.say(n ? `Deleted ${n} unused file${n === 1 ? '' : 's'}.` : 'Every file is in use.')
    this.refresh()
    return n
  }
  _usedSlots () {
    const used = new Set()
    for (const s of S.getBlueprint().sections) for (const c of s.cells) if (c.media?.slot) used.add(c.media.slot)
    for (const m of Extra.liveFloorPanelMeshes()) for (const c of m.userData.extraKind.data?.cells ?? []) if (c.media?.slot) used.add(c.media.slot)
    return used
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  _miniHTML (cells, on = true) {
    const b = P.bounds(cells); const w = Math.max(b.w, 1); const h = Math.max(b.h, 1)
    const set = new Set(cells.map(c => c.join(',')))
    let html = `<span class="fnm-mini" style="grid-template-columns:repeat(${w},7px)" aria-hidden="true">`
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) html += `<i class="${set.has(x + ',' + z) && on ? 'on' : ''}"></i>`
    return html + '</span>'
  }

  refresh () {
    const body = this.body; if (!body) return
    const st = S.getSettings(); const bp = S.getBlueprint(); const cells = this._cells()
    const sec = new Map()   // 'gx,gz' -> { index, media }
    bp.sections.forEach((s, i) => P.placementCells(s).forEach(c => sec.set(c.gx + ',' + c.gz, { i, media: c.media })))
    if (this.sel && !sec.has(this.sel.gx + ',' + this.sel.gz)) this.sel = null
    const sel = this.sel ? sec.get(this.sel.gx + ',' + this.sel.gz) : null
    let grid = `<div class="fnm-grid" style="grid-template-columns:repeat(${st.gridN},1fr)" data-testid="fnm-grid" role="grid" aria-label="Blueprint grid ${st.gridN} by ${st.gridN}">`
    for (let z = 0; z < st.gridN; z++) for (let x = 0; x < st.gridN; x++) {
      const o = sec.get(x + ',' + z)
      const isSel = this.sel && this.sel.gx === x && this.sel.gz === z
      grid += `<button class="fnm-c ${isSel ? 'is-sel' : ''}" data-gx="${x}" data-gz="${z}" role="gridcell" aria-label="Cell ${x},${z}${o ? ' has a panel' : ''}" style="${o ? 'background:' + COLORS[o.i % COLORS.length] : ''}">${o?.media ? KIND_ICON[o.media.kind] ?? '' : ''}</button>`
    }
    grid += '</div>'
    const armed = !!this.fp?.armed
    const total = this.fp?.panelCount?.() ?? 0
    const blueCount = S.blueprintCount(bp)
    body.querySelector('[data-ref="main"]').innerHTML = `
      <div class="oss-sec">Piece</div>
      <div class="fnm-pieces" role="group" aria-label="Pieces">${P.PIECE_IDS.map(id => `<button class="fnm-piece ${st.pieceId === id ? 'is-on' : ''}" data-piece="${id}" aria-pressed="${st.pieceId === id}" ${tip(P.PIECES[id].name, 'Pick this piece. It is placed as one section of connected panels.')}>${this._miniHTML(P.PIECES[id].cells)}<span>${esc(id.length <= 1 ? id : P.PIECES[id].name.split(' ')[0])}</span></button>`).join('')}</div>
      <div class="oss-row">
        <button class="oss-btn" data-act="rot-ccw" ${tip('Rotate left', 'Turns the piece a quarter turn counter-clockwise.')}>⟲ Left</button>
        <button class="oss-btn" data-act="rot-cw" ${tip('Rotate right', 'Turns the piece a quarter turn clockwise.')}>⟳ Right</button>
        <button class="oss-btn ${st.mirror ? 'is-on' : ''}" data-act="mirror" aria-pressed="${st.mirror}" ${tip('Mirror', 'Flips the piece left to right.')}>⇋ Mirror</button>
        <span class="oss-dim" data-testid="fnm-orient">${esc(P.PIECES[st.pieceId].name)} · ${st.rot * 90}°${st.mirror ? ' · mirrored' : ''} ${this._miniHTML(cells)}</span>
      </div>
      <div class="oss-sec">Grid ${st.gridN} × ${st.gridN} (blueprint)</div>
      <div class="oss-row">
        <button class="oss-btn ${this.tool === 'piece' ? 'is-on' : ''}" data-act="tool-piece" aria-pressed="${this.tool === 'piece'}" ${tip('Piece tool', 'Click an empty cell to put the piece there. Click a panel to remove that one panel.')}>▦ Piece</button>
        <button class="oss-btn ${this.tool === 'face' ? 'is-on' : ''}" data-act="tool-face" aria-pressed="${this.tool === 'face'}" ${tip('Face tool', 'Click a panel to choose it, then give it a picture, GIF or video.')}>🖼 Face</button>
        <button class="oss-btn is-danger" data-act="clear" ${blueCount ? '' : 'disabled'} ${tip('Clear grid', 'Empties the blueprint grid. Nothing in the scene changes.')}>Clear grid</button>
      </div>
      ${grid}
      <div class="fnm-note" data-testid="fnm-count">${blueCount} panel${blueCount === 1 ? '' : 's'} in ${bp.sections.length} section${bp.sections.length === 1 ? '' : 's'} on the grid.</div>
      ${this.tool === 'face' ? `
      <div class="oss-row" data-testid="fnm-face">
        <span class="oss-dim">${sel ? `Panel ${this.sel.gx}, ${this.sel.gz}: ${sel.media ? KIND_ICON[sel.media.kind] + ' ' + esc(sel.media.slot ? 'file ' + sel.media.slot : sel.media.url) : 'no face'}` : 'Click a panel on the grid.'}</span>
      </div>
      <div class="oss-row">
        <button class="oss-btn" data-act="file" ${sel ? '' : 'disabled'} ${tip('Choose a file', 'Picture (png, jpg, webp, up to 2 MB), GIF (up to 4 MB) or video (mp4, webm, up to 8 MB).')}>Choose file…</button>
        <input type="file" data-f="file" accept="${esc(M.ACCEPT)}" style="display:none">
        <button class="oss-btn" data-act="clear-face" ${sel?.media ? '' : 'disabled'} ${tip('Clear face', 'Removes the picture / GIF / video from this panel.')}>Clear</button>
      </div>
      <div class="oss-row">
        <input class="oss-input is-wide" data-f="url" placeholder="https:// link" maxlength="${M.MAX_URL}" ${tip('Link', 'An https link; the site must allow other pages to use it (CORS).')}>
        <select class="oss-select" data-f="kind" ${tip('Link kind', 'What the link is.')}><option value="">auto</option><option value="image">picture</option><option value="gif">GIF</option><option value="video">video</option></select>
        <button class="oss-btn" data-act="url" ${sel ? '' : 'disabled'} ${tip('Use link', 'Puts the link on the chosen panel.')}>Use link</button>
      </div>` : ''}
      <div class="oss-sec">Place in the scene</div>
      <div class="oss-row">
        <button class="oss-btn is-on" data-act="place" ${blueCount ? '' : 'disabled'} ${tip('Place in scene', 'Stamps the blueprint on the floor at the cell the camera looks at. Each piece becomes one node; the faces go with it.')}>⬇ Place in scene</button>
        <button class="oss-btn ${armed ? 'is-on' : ''}" data-act="arm" aria-pressed="${armed}" ${tip('Place with pointer', 'Arms the floor: the piece follows the pointer on the grid and a click or tap places it. Escape stops.')}>✛ Place with pointer</button>
      </div>
      <div class="oss-row">
        <label class="fnm-fld">Floor cell X<input class="oss-input" type="number" step="1" data-f="atx" placeholder="camera" aria-label="Floor cell X" ${tip('Floor cell X', 'Whole floor cell number; leave empty to use the camera target.')}></label>
        <label class="fnm-fld">Floor cell Z<input class="oss-input" type="number" step="1" data-f="atz" placeholder="camera" aria-label="Floor cell Z" ${tip('Floor cell Z', 'Whole floor cell number; leave empty to use the camera target.')}></label>
        <button class="oss-btn" data-act="place-at" ${blueCount ? '' : 'disabled'} ${tip('Place at cell', 'Stamps the blueprint with its top-left cell on this floor cell.')}>Place at cell</button>
      </div>
      <div class="fnm-note" data-testid="fnm-total">${total} of ${st.maxPanels} panels in the scene.</div>
      <div class="oss-sec">Settings</div>
      <div class="oss-row">
        <label class="fnm-fld">Grid size (${S.RANGES.gridN.join('–')})<input class="oss-input" type="number" min="${S.RANGES.gridN[0]}" max="${S.RANGES.gridN[1]}" step="1" data-f="gridN" value="${st.gridN}" ${tip('Grid size', 'How many cells wide and tall the blueprint grid is (6 to 24).')}></label>
        <label class="fnm-fld">Cell size <input class="oss-input" type="number" min="${S.RANGES.cellSize[0]}" max="${S.RANGES.cellSize[1]}" step="any" data-f="cellSize" value="${st.cellSize}" ${tip('Cell size', 'World units of one panel. The floor grid unit is 20.')}></label>
        <button class="oss-btn" data-act="unit" ${st.cellSize === S.FLOOR_GRID_UNIT ? 'disabled' : ''} ${tip('Floor grid unit', 'Sets the cell size to the floor grid unit (20) so panels line up with the floor lines.')}>= floor unit</button>
      </div>
      <div class="oss-row">
        <label class="fnm-fld">Thickness<input class="oss-input" type="number" min="${S.RANGES.thickness[0]}" max="${S.RANGES.thickness[1]}" step="0.05" data-f="thickness" value="${st.thickness}" ${tip('Thickness', 'How thick a panel is (0.02 to 2).')}></label>
        <label class="fnm-fld">Opacity<input class="oss-input" type="number" min="${S.RANGES.opacity[0]}" max="1" step="0.05" data-f="opacity" value="${st.opacity}" ${tip('Opacity', 'Default opacity of new panels (0.1 to 1).')}></label>
        <label class="fnm-fld">Colour<input type="color" data-f="color" value="${esc(st.color)}" ${tip('Colour', 'Default colour of new panels.')}></label>
        <label class="fnm-fld">Max panels<input class="oss-input" type="number" min="${S.RANGES.maxPanels[0]}" max="${S.RANGES.maxPanels[1]}" step="10" data-f="maxPanels" value="${st.maxPanels}" ${tip('Max panels', 'The most panels allowed in the scene at once (20 to 1000).')}></label>
      </div>
      <div class="oss-row">
        <label ${tip('Snap', 'On: pieces sit exactly on floor cells. Off: a piece keeps the exact spot you point at inside the cell.')}><input type="checkbox" data-f="snap" ${st.snap ? 'checked' : ''}> Snap to the floor grid</label>
        <label ${tip('Grid overlay', 'Draws the placement grid on the floor around the camera target.')}><input type="checkbox" data-f="overlay" ${st.overlay ? 'checked' : ''}> Grid overlay on the floor</label>
        <button class="oss-btn" data-act="reset" ${tip('Reset settings', 'Puts every setting above back to its default. The blueprint and the scene are not touched.')}>Reset</button>
      </div>
      <details data-ref="lib"><summary>Media files (${M.MEDIA_SLOTS} max)</summary><div data-ref="liblist" class="fnm-note">Loading…</div>
        <button class="oss-btn" data-act="lib-clean" ${tip('Clean unused', 'Deletes the stored files that no blueprint cell and no panel in the scene uses.')}>Clean unused</button></details>
      <div class="oss-msg ${this.msg.err ? 'is-err' : 'is-ok'}" data-ref="msg" role="status" aria-live="polite">${esc(this.msg.text)}</div>
      <div class="fnm-note">Panels are Tetris-piece shaped path sections on the floor. Each cell can show a picture, GIF or video (at most ${M.MAX_PLAYING} animated faces play at once). Nothing here costs money.</div>`
    this._renderLibrary()
  }

  async _renderLibrary () {
    const host = this.body?.querySelector('[data-ref="liblist"]'); if (!host) return
    let list = []
    try { list = await M.mediaStore.listWallpapers() } catch (_) { host.textContent = 'Browser storage is not available.'; return }
    const used = this._usedSlots()
    host.innerHTML = list.length ? list.sort((a, b) => a.slot - b.slot).map(r => `<div class="fnm-lib"><span>#${r.slot}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(r.name || 'file')}</span><span>${used.has(r.slot) ? 'in use' : 'unused'}</span><button class="oss-btn" data-act="lib-del" data-slot="${r.slot}" aria-label="Delete file ${r.slot}" ${tip('Delete file', 'Deletes this stored file. Panels that use it show a grey face.')}>✕</button></div>`).join('') : 'No files stored.'
  }
}
