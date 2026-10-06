/**
 * ui/OmniNodeBehaviorForm.js — the shared NodeBehavior parameter form.
 *
 * Generated entirely from systems/OmniNodeBehavior.js's BEHAVIOR_TABLE
 * (so a new table row gets a form for free). Used by BOTH
 * ui/OmniDrawBehavior.js (creation) and systems/OmniInspector.js (edit).
 *
 *   const f = createBehaviorForm({ cfg, hostId, onChange })
 *   container.appendChild(f.el);  …  f.destroy()
 *
 * Targets can be added two ways: a dropdown of existing nodes, or
 * "Pick in scene" — while armed, every omni:node-selected adds that node
 * (and, when hostId is known, re-selects the host so the Inspector comes
 * back). All DOM is built with textContent (node labels are user data).
 */

import { BEHAVIOR_TABLE, behaviorSchema, behaviorDefaults, normalizeBehavior, CLASS_COLORS } from '../systems/OmniNodeBehavior.js'

const STYLES = `
.bhf { font-family: 'Courier New', Courier, monospace; font-size: 11px; display: flex; flex-direction: column; gap: 6px; color: inherit; }
.bhf-tier { font-size: 9px; line-height: 1.5; opacity: 0.8; border-left: 3px solid var(--bhf-c, #888); padding-left: 6px; }
.bhf-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.bhf-row > label { flex: 0 0 38%; font-size: 10px; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bhf-row input[type=range] { flex: 1 1 auto; min-width: 0; }
.bhf-row input[type=number], .bhf-row select, .bhf-add select {
  flex: 1 1 auto; min-width: 0; background: rgba(128,128,128,0.15); border: 1px solid rgba(128,128,128,0.4);
  color: inherit; font: inherit; font-size: 10px; padding: 3px 4px; border-radius: 4px;
}
.bhf-val { flex: 0 0 44px; text-align: right; font-size: 10px; opacity: 0.75; }
.bhf-h { font-size: 10px; letter-spacing: 0.05em; opacity: 0.7; margin-top: 4px; }
.bhf-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.bhf-chip { display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(128,128,128,0.5); border-radius: 10px; padding: 1px 4px 1px 7px; font-size: 10px; }
.bhf-chip.is-missing { opacity: 0.45; text-decoration: line-through; }
.bhf-chip button { background: none; border: none; color: inherit; cursor: pointer; font-size: 11px; padding: 0 2px; }
.bhf-add { display: flex; gap: 4px; }
.bhf-btn { background: rgba(128,128,128,0.18); border: 1px solid rgba(128,128,128,0.45); color: inherit; font: inherit; font-size: 10px; padding: 3px 7px; border-radius: 4px; cursor: pointer; }
.bhf-btn:hover { background: rgba(128,128,128,0.32); }
.bhf-btn.is-on { background: var(--bhf-c, #888); color: #111; border-color: transparent; }
.bhf-empty { font-size: 9px; opacity: 0.6; }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('bhf-styles')) return
  const t = document.createElement('style'); t.id = 'bhf-styles'; t.textContent = STYLES; document.head.appendChild(t)
}

// Shared, lightly cached node list (id + label) from the omni:nodes-updated broadcasts.
let _nodes = []
let _listenerCount = 0
const _subs = new Set()
function _onNodesUpdated (e) {
  const list = e.detail?.nodes
  if (!Array.isArray(list)) return
  _nodes = list.filter(n => n?.id).map(n => ({ id: n.id, label: n.label ?? n.id }))
  _subs.forEach(fn => fn())
}
function subscribeNodes (fn) {
  if (_listenerCount++ === 0) window.addEventListener('omni:nodes-updated', _onNodesUpdated)
  _subs.add(fn)
  window.dispatchEvent(new CustomEvent('omni:nodes-request'))
  return () => { _subs.delete(fn); if (--_listenerCount === 0) window.removeEventListener('omni:nodes-updated', _onNodesUpdated) }
}
export function knownNodes () { return _nodes }

const hex = (n) => '#' + n.toString(16).padStart(6, '0')

function el (tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

/**
 * @param {object} o
 * @param {object} o.cfg       { type, params, targets, enabled, role } — copied, never mutated
 * @param {string} [o.hostId]  the node the behaviour lives on (excluded from targets; re-selected after a pick)
 * @param {(cfg:object)=>void} o.onChange
 */
export function createBehaviorForm ({ cfg, hostId = null, onChange }) {
  injectStyles()
  const row = BEHAVIOR_TABLE[cfg.type]
  const work = normalizeBehavior(cfg, hostId) ?? { type: cfg.type, params: behaviorDefaults(cfg.type), targets: [], enabled: true, role: null }
  const root = el('div', 'bhf')
  root.style.setProperty('--bhf-c', hex(CLASS_COLORS[row?.cls] ?? 0x888888))
  let picking = false
  let onSel = null
  const emit = () => onChange?.(JSON.parse(JSON.stringify(work)))

  if (row) {
    const tier = el('div', 'bhf-tier')
    tier.textContent = (row.tier === 'B'
      ? 'Signal metaphor — beads travel along tethers. It illustrates the idea; there is no real signal/data layer yet and nothing here computes anything. '
      : 'Real motion on real nodes. ') + (row.hint ?? '')
    root.appendChild(tier)
  }

  for (const f of behaviorSchema(cfg.type)) {
    const r = el('div', 'bhf-row')
    const lab = el('label', null, f.label); lab.title = f.key
    r.appendChild(lab)
    if (f.type === 'number') {
      const inp = el('input'); inp.type = 'range'; inp.min = f.min; inp.max = f.max; inp.step = f.step; inp.value = work.params[f.key]
      const val = el('span', 'bhf-val', String(Number(work.params[f.key]).toFixed(2)))
      inp.addEventListener('input', () => { work.params[f.key] = Number(inp.value); val.textContent = Number(inp.value).toFixed(2); emit() })
      r.append(inp, val)
    } else if (f.type === 'select') {
      const sel = el('select')
      for (const o of f.options) { const op = el('option', null, o); op.value = o; sel.appendChild(op) }
      sel.value = work.params[f.key]
      sel.addEventListener('change', () => { work.params[f.key] = sel.value; emit() })
      r.appendChild(sel)
    } else {
      const b = el('button', 'bhf-btn' + (work.params[f.key] ? ' is-on' : ''), work.params[f.key] ? 'on' : 'off')
      b.type = 'button'
      b.addEventListener('click', () => { work.params[f.key] = !work.params[f.key]; b.classList.toggle('is-on', work.params[f.key]); b.textContent = work.params[f.key] ? 'on' : 'off'; emit() })
      r.appendChild(b)
    }
    root.appendChild(r)
  }

  // ── targets ──
  root.appendChild(el('div', 'bhf-h', row?.needs === 'self' ? 'TARGETS (optional — acts on itself)' : 'TARGETS (' + (row?.needs === 'target' ? 'first one is used' : 'in order') + ')'))
  const chips = el('div', 'bhf-chips')
  const empty = el('div', 'bhf-empty', 'None yet — add from the list or pick nodes in the scene.')
  const addRow = el('div', 'bhf-add')
  const sel = el('select'); sel.title = 'Existing nodes'
  const addBtn = el('button', 'bhf-btn', '+ Add'); addBtn.type = 'button'
  const pickBtn = el('button', 'bhf-btn', 'Pick in scene'); pickBtn.type = 'button'
  addRow.append(sel, addBtn)
  root.append(chips, empty, addRow, pickBtn)

  const labelOf = (id) => _nodes.find(n => n.id === id)?.label ?? id
  const renderChips = () => {
    chips.textContent = ''
    work.targets.forEach((id, i) => {
      const known = _nodes.some(n => n.id === id)
      const c = el('span', 'bhf-chip' + (known ? '' : ' is-missing'))
      c.appendChild(el('span', null, (i + 1) + '. ' + labelOf(id)))
      const x = el('button', null, '×'); x.type = 'button'; x.title = 'Remove target'
      x.addEventListener('click', () => { work.targets.splice(i, 1); renderChips(); emit() })
      c.appendChild(x); chips.appendChild(c)
    })
    empty.style.display = work.targets.length ? 'none' : ''
  }
  const renderSelect = () => {
    const keep = sel.value
    sel.textContent = ''
    const none = el('option', null, '— choose a node —'); none.value = ''; sel.appendChild(none)
    for (const n of _nodes) {
      if (n.id === hostId || work.targets.includes(n.id)) continue
      const o = el('option', null, n.label); o.value = n.id; sel.appendChild(o)
    }
    sel.value = keep
  }
  const addTarget = (id) => {
    if (!id || id === hostId || work.targets.includes(id) || work.targets.length >= 32) return
    work.targets.push(id); renderChips(); renderSelect(); emit()
  }
  addBtn.addEventListener('click', () => { addTarget(sel.value); sel.value = '' })

  pickBtn.addEventListener('click', () => {
    picking = !picking
    pickBtn.classList.toggle('is-on', picking)
    pickBtn.textContent = picking ? 'Picking… click nodes (click again to stop)' : 'Pick in scene'
    if (picking && !onSel) {
      onSel = (e) => {
        const id = e.detail?.node?.id
        if (!id || id === hostId) return
        addTarget(id)
        if (hostId) window.dispatchEvent(new CustomEvent('omni:node-select-by-id', { detail: { id: hostId } }))
      }
      window.addEventListener('omni:node-selected', onSel)
    } else if (!picking && onSel) { window.removeEventListener('omni:node-selected', onSel); onSel = null }
  })

  const unsub = subscribeNodes(() => { renderChips(); renderSelect() })
  renderChips(); renderSelect()

  return {
    el: root,
    getConfig: () => JSON.parse(JSON.stringify(work)),
    destroy () { unsub(); if (onSel) window.removeEventListener('omni:node-selected', onSel); onSel = null },
  }
}
