/**
 * ui/OmniNodeOrderPanel.js — ⟐OmniNodeOrder: the editor of an OmniPathNode's ORDER (V191, class-A window panel).
 *
 * Lists the members of the chosen path in order (utils/OmniPathModel.js) and lets the user:
 *   - reorder   drag a row by its ⠿ handle (mouse: HTML5 drag and drop; touch: a pointer drag on the handle) or use ▲ ▼;
 *   - jump      ⌖ selects the node and flies the camera to it (systems/OmniPathNodes.js jumpTo: omni:node-select-by-id + the Inspector's travel);
 *   - remove    ✕ takes the node out of the path (the node itself is never deleted); Undo brings the last edit back (30 steps);
 *   - add       "Add selected" appends the node selected in the scene; "Record links" appends every node you select, one after another (LINK mode);
 *   - genealogy choose the ROOT ("Use selected as root"), pre-order or breadth first, then "Build from hierarchy" (GENEALOGY mode);
 *   - manage    New path, Delete path, rename, choose which path, mode, closed loop, show / hide the line.
 * A member that no longer exists is shown as ❓ and can be removed; nodes dropped because they were deleted are noted under the list.
 *
 * Built on ui/OmniSettingsPanelBase.js (WindowManager registration => resize + maximize from utils/OmniWindowChrome.js, bottom sheet on phones).
 * Opened by omni:nav-select '⟐OmniNodeOrder' (Inspector block, ribbon Home > Create > Node order, Admin / dock lists).
 */

import OmniSettingsPanelBase, { esc, PHONE_MAX } from './OmniSettingsPanelBase.js'
import * as Paths from '../utils/OmniPathModel.js'

export const NAV_ITEM = '⟐OmniNodeOrder'
export const PANEL_ID = 'omninodeorder'
const tip = (name, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="—" data-omni-tip-desc="${esc(desc)}"`

const STYLES = `
.ono-panel .ono-list { list-style: none; margin: 6px 0; padding: 0; max-height: 46vh; overflow-y: auto; }
.ono-panel .ono-item { display: flex; align-items: center; gap: 4px; padding: 2px 4px; margin: 2px 0; border-radius: 6px; background: rgba(255,255,255,.05); border: 1px solid transparent; }
.ono-panel .ono-item.is-over { border-color: #ffd27f; background: rgba(255,210,127,.14); }
.ono-panel .ono-item.is-drag { opacity: .45; }
.ono-panel .ono-item.is-missing { border: 1px dashed rgba(255,255,255,.35); }
.ono-panel .ono-handle { cursor: grab; touch-action: none; user-select: none; padding: 0 4px; opacity: .7; }
.ono-panel .ono-idx { min-width: 22px; text-align: right; opacity: .6; }
.ono-panel .ono-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ono-panel .ono-b { width: 28px; min-width: 28px; height: 28px; padding: 0; border-radius: 5px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); background: rgba(255,255,255,.07); color: inherit; cursor: pointer; font: inherit; }
.ono-panel .ono-b:hover:not(:disabled) { background: rgba(255,255,255,.2); } .ono-panel .ono-b:disabled { opacity: .3; cursor: default; }
.ono-panel .ono-note { font-size: 10px; line-height: 1.4; opacity: .75; margin: 4px 0; }
.ono-panel .ono-empty { padding: 10px; text-align: center; opacity: .7; border: 1px dashed rgba(255,255,255,.25); border-radius: 6px; }
@media (max-width: ${PHONE_MAX}px) { .ono-panel .ono-b { width: 40px; min-width: 40px; height: 40px; } .ono-panel .ono-list { max-height: 24vh; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('ono-styles')) return
  const s = document.createElement('style'); s.id = 'ono-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniNodeOrderPanel extends OmniSettingsPanelBase {
  /** @param pathNodes the systems/OmniPathNodes.js instance (labels, selection, recording, camera jumps). */
  constructor (pathNodes) {
    super({ id: PANEL_ID, label: '⟐OmniNodeOrder', iconLabel: '⟐P', navItems: [NAV_ITEM, '⟐OmniNodeOrderPanel'], className: 'ono-panel', wide: true })
    this.pn = pathNodes
    this._msg = { text: '', err: false }
    this._drag = null
    this._rq = 0
    this._h = null
  }

  onInit () {
    injectStyles()
    const again = () => { if (!this._isOpen || this._rq) return; if (typeof requestAnimationFrame === 'function') this._rq = requestAnimationFrame(() => { this._rq = 0; this.refresh() }); else this.refresh() }
    this._h = again
    for (const n of [Paths.CHANGED_EVENT, 'omni:path-recording-changed', 'omni:node-selected', 'omni:node-deselected', 'omni:node-deleted', 'omni:nodes-updated']) window.addEventListener(n, again)
  }
  onDestroy () {
    if (this._h) for (const n of [Paths.CHANGED_EVENT, 'omni:path-recording-changed', 'omni:node-selected', 'omni:node-deselected', 'omni:node-deleted', 'omni:nodes-updated']) window.removeEventListener(n, this._h)
    this._h = null
  }

  close () {
    if (this._el && this.pn?.recordingId) this.pn.stopRecording()   // closing the panel ends link recording
    super.close()
  }

  say (text, err = false) { this._msg = { text, err }; const m = this.body?.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'oss-msg ' + (err ? 'is-err' : 'is-ok') } }

  buildBody (body) {
    body.innerHTML = '<div data-ref="top"></div><ol class="ono-list" data-ref="list" aria-label="Nodes of the path in order"></ol><div data-ref="foot"></div>'
    body.addEventListener('click', (e) => this._click(e))
    body.addEventListener('change', (e) => this._change(e))
    const list = body.querySelector('[data-ref="list"]')
    // mouse: HTML5 drag and drop of the rows
    list.addEventListener('dragstart', (e) => { const li = e.target.closest?.('.ono-item'); if (!li) return; this._drag = Number(li.dataset.i); li.classList.add('is-drag'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(this._drag)) } catch (_) { /* jsdom */ } })
    list.addEventListener('dragover', (e) => { if (this._drag == null) return; e.preventDefault(); list.querySelectorAll('.is-over').forEach(x => x.classList.remove('is-over')); e.target.closest?.('.ono-item')?.classList.add('is-over') })
    list.addEventListener('dragend', () => { this._drag = null; list.querySelectorAll('.is-over,.is-drag').forEach(x => x.classList.remove('is-over', 'is-drag')) })
    list.addEventListener('drop', (e) => {
      e.preventDefault()
      const li = e.target.closest?.('.ono-item'); const from = this._drag; this._drag = null
      if (!li || from == null) return
      this.moveTo(from, Number(li.dataset.i))
    })
    // touch / pen: a pointer drag on the ⠿ handle
    list.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return
      const h = e.target.closest?.('.ono-handle'); if (!h) return
      this._drag = Number(h.closest('.ono-item').dataset.i); this._touch = true
      try { h.setPointerCapture?.(e.pointerId) } catch (_) { /* no capture */ }
    })
    list.addEventListener('pointermove', (e) => {
      if (!this._touch || this._drag == null) return
      const under = document.elementFromPoint?.(e.clientX, e.clientY)?.closest?.('.ono-item')
      list.querySelectorAll('.is-over').forEach(x => x.classList.remove('is-over')); under?.classList.add('is-over')
    })
    list.addEventListener('pointerup', (e) => {
      if (!this._touch) return
      this._touch = false
      const under = document.elementFromPoint?.(e.clientX, e.clientY)?.closest?.('.ono-item'); const from = this._drag; this._drag = null
      list.querySelectorAll('.is-over').forEach(x => x.classList.remove('is-over'))
      if (under && from != null) this.moveTo(from, Number(under.dataset.i))
    })
  }

  // ── Actions (public so tests and other panels use the same code the buttons do) ──

  get pathId () { return Paths.getActiveId() }
  moveTo (from, to) { const r = Paths.move(this.pathId, from, to); this.say(r.ok ? 'Moved.' : (r.error ?? 'Could not move.'), !r.ok); return r }
  newPath () {
    const r = this.pn?.createPathNode({ name: undefined, select: false }) ?? Paths.createPath({})
    this.say(r.ok ? 'New path created: a path node is in front of you.' : r.error, !r.ok); return r
  }
  deletePath () {
    const p = Paths.getPath(this.pathId); if (!p) return false
    if (p.nodeId && this.pn?.omniNode?.getNodeData?.(p.nodeId)) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: p.nodeId } }))   // deleting the node removes the path (dropNode)
    Paths.deletePath(p.id)
    this.say(`Deleted "${p.name}". The nodes in it were not touched.`); return true
  }

  _click (e) {
    const b = e.target.closest?.('[data-act]'); if (!b || b.disabled) return
    const id = this.pathId; const act = b.dataset.act; const i = Number(b.closest('.ono-item')?.dataset.i)
    const say = (r, ok) => this.say(r.ok ? ok : (r.error || 'Not possible.'), !r.ok)
    switch (act) {
      case 'new': this.newPath(); break
      case 'delete': this.deletePath(); break
      case 'up': say(Paths.moveUp(id, i), 'Moved up.'); break
      case 'down': say(Paths.moveDown(id, i), 'Moved down.'); break
      case 'remove': say(Paths.removeAt(id, i), 'Removed from the path (the node is untouched).'); break
      case 'jump': this.pn?.jumpToIndex(id, i); break
      case 'add': say(this.pn?.addSelected(id) ?? { ok: false, error: 'Not available.' }, 'Added.'); break
      case 'record': if (this.pn?.recordingId === id) { this.pn.stopRecording(); this.say('Recording stopped.') } else { this.pn?.startRecording(id); this.say('Recording: select nodes one after another.') } break
      case 'root': say(this.pn?.useSelectedAsRoot(id) ?? { ok: false, error: 'Not available.' }, 'Root set.'); break
      case 'build': say(this.pn?.buildGenealogy(id) ?? { ok: false, error: 'Not available.' }, 'Built from the hierarchy.'); break
      case 'undo': say(Paths.undoLast(id), 'Undone.'); break
      case 'clear': say(Paths.clearMembers(id), 'Cleared (Undo brings it back).'); break
      case 'closed': { const p = Paths.getPath(id); say(Paths.setClosed(id, !p?.closed), p?.closed ? 'Loop opened.' : 'Loop closed.'); break }
      case 'line': { const p = Paths.getPath(id); Paths.setVisible(id, !p?.visible); this.say(p?.visible ? 'Line hidden.' : 'Line shown.'); break }
      case 'notes': Paths.clearNotes(id); break
      case 'check': { const gone = (Paths.getPath(id)?.members ?? []).filter(m => !this.pn?.nodeInfo(m).exists).length; this.say(gone ? `${gone} node${gone > 1 ? 's are' : ' is'} missing (marked ❓).` : 'All nodes exist.'); break }
      default: break
    }
  }

  _change (e) {
    const el = e.target; const f = el.dataset?.f; const id = this.pathId
    if (f === 'pick') { Paths.setActive(el.value); return }
    if (!id) return
    if (f === 'name') { const r = Paths.rename(id, el.value); this.say(r.ok ? 'Renamed.' : r.error, !r.ok) }
    else if (f === 'mode') { const r = Paths.setMode(id, el.value); this.say(r.ok ? (el.value === 'link' ? 'LINK mode: attach one node to the next.' : 'GENEALOGY mode: the order follows the hierarchy.') : r.error, !r.ok) }
    else if (f === 'order') { const r = Paths.setOrderKind(id, el.value); this.say(r.ok ? 'Traversal changed. Press Build from hierarchy to apply it.' : r.error, !r.ok) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  refresh () {
    const body = this.body; if (!body) return
    const paths = Paths.listPaths(); const p = Paths.getPath(Paths.getActiveId())
    const rec = !!p && this.pn?.recordingId === p.id
    const top = body.querySelector('[data-ref="top"]')
    const sel = this.pn?.selectedId ? this.pn.nodeInfo(this.pn.selectedId) : null
    if (!p) {
      top.innerHTML = `<div class="oss-row"><button class="oss-btn" data-act="new" ${tip('New path', 'Creates a path and its OmniPathNode in front of the camera.')}>＋ New path</button></div><div class="ono-empty" data-testid="ono-empty">No paths yet. Create one, then attach nodes one after another (LINK) or build it from the hierarchy (GENEALOGY).</div>`
      body.querySelector('[data-ref="list"]').innerHTML = ''; body.querySelector('[data-ref="foot"]').innerHTML = `<div class="oss-msg" data-ref="msg" role="status" aria-live="polite"></div>`
      return
    }
    const rootLabel = p.rootId ? this.pn?.nodeInfo(p.rootId).label ?? p.rootId : 'none'
    top.innerHTML = `
      <div class="oss-row">
        <select class="oss-select" data-f="pick" aria-label="Path" ${tip('Choose path', 'Which path to edit.')}>${paths.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)} (${x.members.length})</option>`).join('')}</select>
        <button class="oss-btn" data-act="new" ${tip('New path', 'Creates a path and its OmniPathNode in front of the camera.')}>＋ New</button>
        <button class="oss-btn is-danger" data-act="delete" ${tip('Delete path', 'Deletes this path and its path node. The nodes in the path are not touched.')}>Delete</button>
      </div>
      <div class="oss-row">
        <input class="oss-input is-wide" data-f="name" maxlength="40" value="${esc(p.name)}" aria-label="Path name" ${tip('Path name', 'Rename the path (the path node is renamed too).')}>
        <select class="oss-select" data-f="mode" aria-label="Mode" ${tip('Mode', 'LINK: attach from one node to the next. GENEALOGY: the order comes from the parent / child hierarchy under a root.')}>
          <option value="link" ${p.mode === 'link' ? 'selected' : ''}>LINK: node to node</option><option value="genealogy" ${p.mode === 'genealogy' ? 'selected' : ''}>GENEALOGY: hierarchy</option></select>
      </div>
      ${p.mode === 'link' ? `
      <div class="oss-row">
        <button class="oss-btn ${rec ? 'is-on' : ''}" data-act="record" aria-pressed="${rec}" ${tip(rec ? 'Stop recording' : 'Record links', 'While recording, every node you select in the scene is appended to the path: select A, then B, then C. Escape or closing this panel stops.')}>${rec ? '■ Stop recording' : '● Record links'}</button>
        <button class="oss-btn" data-act="add" ${tip('Add selected', 'Appends the node that is selected in the scene.')}>＋ Add selected${sel ? ` (${esc(sel.label)})` : ''}</button>
      </div>` : `
      <div class="oss-row">
        <span class="oss-dim" data-testid="ono-root">Root: <b>${esc(rootLabel)}</b></span>
        <button class="oss-btn" data-act="root" ${tip('Use selected as root', 'Makes the node selected in the scene the root of the genealogy path.')}>Use selected${sel ? ` (${esc(sel.label)})` : ''} as root</button>
      </div>
      <div class="oss-row">
        <select class="oss-select" data-f="order" aria-label="Traversal" ${tip('Traversal', 'Pre-order: follow a branch all the way down before its sibling. Breadth first: the root, then all its children, then all grandchildren.')}>
          <option value="preorder" ${p.order === 'preorder' ? 'selected' : ''}>Pre-order (depth first)</option><option value="breadth" ${p.order === 'breadth' ? 'selected' : ''}>Breadth first</option></select>
        <button class="oss-btn" data-act="build" ${tip('Build from hierarchy', 'Replaces the order with the root and all its descendants. Undo brings the old order back.')}>Build from hierarchy</button>
      </div>`}
      <div class="oss-row">
        <button class="oss-btn" data-act="undo" ${Paths.canUndo(p.id) ? '' : 'disabled'} ${tip('Undo', 'Takes back the last change to this path (30 steps).')}>↶ Undo</button>
        <button class="oss-btn" data-act="clear" ${p.members.length ? '' : 'disabled'} ${tip('Clear', 'Empties the path (the nodes are not touched).')}>Clear</button>
        <button class="oss-btn ${p.closed ? 'is-on' : ''}" data-act="closed" aria-pressed="${p.closed}" ${tip('Closed loop', 'Joins the last node back to the first.')}>⟲ Loop</button>
        <button class="oss-btn ${p.visible ? 'is-on' : ''}" data-act="line" aria-pressed="${p.visible}" ${tip('Path line', 'Shows or hides the line drawn through the nodes in the scene.')}>Line</button>
        <button class="oss-btn" data-act="check" ${tip('Check nodes', 'Counts members that no longer exist.')}>Check</button>
      </div>`
    const depths = p.mode === 'genealogy' && p.rootId && this.pn ? Paths.genealogyDepths(this.pn.hierarchy(), p.rootId) : {}
    const list = body.querySelector('[data-ref="list"]')
    list.innerHTML = p.members.length ? p.members.map((m, i) => {
      const info = this.pn?.nodeInfo(m) ?? { exists: true, label: m }
      const pad = (depths[m] ?? 0) * 12
      return `<li class="ono-item ${info.exists ? '' : 'is-missing'}" draggable="true" data-i="${i}" data-id="${esc(m)}">
        <span class="ono-handle" aria-hidden="true" ${tip('Drag to reorder', 'Drag this handle up or down to move the node in the order.')}>⠿</span><span class="ono-idx">${i + 1}</span>
        <span class="ono-name" style="padding-left:${pad}px" title="${esc(info.label)}">${info.exists ? '' : '❓ '}${esc(info.exists ? info.label : 'missing node ' + m)}</span>
        <button class="ono-b" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up" ${tip('Move up', 'One place earlier in the order.')}>▲</button>
        <button class="ono-b" data-act="down" ${i === p.members.length - 1 ? 'disabled' : ''} aria-label="Move down" ${tip('Move down', 'One place later in the order.')}>▼</button>
        <button class="ono-b" data-act="jump" ${info.exists ? '' : 'disabled'} aria-label="Jump to node" ${tip('Jump to node', 'Selects the node and flies the camera to it.')}>⌖</button>
        <button class="ono-b" data-act="remove" aria-label="Remove from path" ${tip('Remove from path', 'Takes the node out of this path. The node itself is not deleted.')}>✕</button></li>`
    }).join('') : `<li class="ono-empty" data-testid="ono-empty">${p.mode === 'link' ? 'No nodes yet. Press Record links and select nodes one after another, or select a node and press Add selected.' : 'No nodes yet. Select the root node, press Use selected as root, then Build from hierarchy.'}</li>`
    const dropNote = p.droppedCount ? `<div class="ono-note" data-testid="ono-dropped">${p.droppedCount} deleted node${p.droppedCount > 1 ? 's were' : ' was'} dropped from this path${p.dropped.length ? ' (latest: ' + p.dropped.map(d => esc(d.label || d.id)).join(', ') + ')' : ''}. <button class="oss-btn" data-act="notes">Dismiss</button></div>` : ''
    body.querySelector('[data-ref="foot"]').innerHTML = `${dropNote}<div class="ono-note">${p.members.length} of ${Paths.MAX_MEMBERS} nodes · ${paths.length} of ${Paths.MAX_PATHS} paths. Only references are saved; deleting a node drops it from the order.</div><div class="oss-msg ${this._msg.err ? 'is-err' : 'is-ok'}" data-ref="msg" role="status" aria-live="polite">${esc(this._msg.text)}</div>`
  }
}
