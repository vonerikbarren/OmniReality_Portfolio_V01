/**
 * ui/OmniBeatPad.js (V195) — the OmniBeatPad: a strict 4x4 pad grid (16 pads). Two faces of the same thing:
 *   - registry content 'beatpad' of the OmniExpression quadrants (registerBeatPadContent / mountBeatPad), and
 *   - a window of its own: nav item 'OmniBeatPad' (also '⟐OmniBeatPad'), ribbon Home > Tools, OmniStarLight (class OmniBeatPad, window-chrome class A).
 * Model, presets, key hints: utils/OmniBeatPadModel.js (saved as `omni:beatpad-v1`, shared by every instance: edit a pad in the window and the
 * quadrant shows it).
 *
 * PLAY: pointer events (several fingers = several pads). Velocity = pen / touch pressure when the device really has it, else the position inside
 * the pad (top soft, bottom hard); times the pad's own volume. A pad plays through the InputBus (hand 'X', source 'pad', midi = the pad note
 * 36..51 like GM drum pads, or the note it is bound to) AND, when it is bound to a sound node, directly through the window event
 * `omni:sound-play-request` { nodeId } (and `omni:sound-stop-request` when a hold / toggle pad ends). Modes: one-shot, hold, toggle-loop.
 * Choke groups 1..8: a hit silences the other sounding pads of its group. Everything that sounds is released on pointer up / cancel / lost capture,
 * window blur and destroy.
 * KEYS (hint): only while the pad GRID HAS FOCUS and Expression mode is off: 1-4 / Q-R / A-F / Z-V (by key code). In Expression mode the capture
 * layer owns the keys, so the grid ignores them.
 * EDIT: the Edit button, or a long press on a pad (about 0.55 s) switches to edit mode; tapping a pad then selects it and the editor shows its
 * label, colour, binding (none / note / sound node / sample slot), mode, choke group, volume and a Test button.
 */
import * as Bus from '../utils/OmniInputBus.js'
import * as B from '../utils/OmniBeatPadModel.js'
import { velocityFrom, yFraction, noteName } from '../utils/OmniExpressionPanelModel.js'
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { handsSafe } from '../utils/OmniStoreLayout.js'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`
const LONG_PRESS_MS = 550
const ONESHOT_MS = 140
const PULSE_MS = 170

// ── shared store + engine (module level, so every instance agrees) ─────────────────────────────────────────────────────────

let state = null
const stateSubs = new Set()
const padSubs = new Set()
const rt = Array.from({ length: B.PAD_COUNT }, () => ({ on: false, held: new Set(), timer: 0 }))
let nodeSource = { omniNode: null }
let soundNodesFn = null

export function setBeatPadContext (ctx = {}) { nodeSource = { omniNode: ctx.omniNode || null } }
/** Defensive: systems/OmniSoundScene.js getSoundNodes (ids of the enabled sound nodes), imported lazily; any failure -> the omniNode fallback. */
export function primeSoundNodes (importer = () => import('../systems/OmniSoundScene.js')) {
  try { Promise.resolve(importer()).then(m => { if (typeof m?.getSoundNodes === 'function') soundNodesFn = m.getSoundNodes }).catch(() => {}) } catch (_) { /* no module */ }
}
/** [{ id, label }] of the scene's sound nodes. Never throws. */
export function listSoundNodes () {
  let ids = []
  try { if (soundNodesFn) ids = soundNodesFn() || [] } catch (_) { ids = [] }
  const on = nodeSource.omniNode
  if (!ids.length && on) { try { ids = (on.getAllNodes?.() || []).filter(d => d && d.id && d.sound && d.sound.enabled).map(d => d.id) } catch (_) { ids = [] } }
  return ids.filter(i => typeof i === 'string').map(id => { let label = id; try { label = on?.getNodeData?.(id)?.label || id } catch (_) { /* ignore */ } return { id, label: String(label).slice(0, 24) } })
}

export function getState () { if (!state) state = B.loadState(); return state }
export function _resetStore () { state = null; stopAll(); stateSubs.clear(); padSubs.clear() }
function commit () { B.saveState(state); for (const f of [...stateSubs]) { try { f() } catch (_) { /* ignore */ } } }
export function subscribeState (fn) { stateSubs.add(fn); return () => stateSubs.delete(fn) }
export function subscribePads (fn) { padSubs.add(fn); return () => padSubs.delete(fn) }
const emitPad = (idx, kind) => { for (const f of [...padSubs]) { try { f(idx, kind) } catch (_) { /* ignore */ } } }
export function updatePad (idx, patch) {
  if (!(idx >= 0 && idx < B.PAD_COUNT) || !patch || typeof patch !== 'object') return false
  const s = getState(); s.pads[idx] = B.sanitizePad({ ...s.pads[idx], ...patch }, idx); commit(); return true
}
export function applyKit (id) {
  stopAll(); state = B.applyPreset(id, { soundNodes: listSoundNodes() }); commit(); return state
}

const fire = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* no window */ } }
const noteOf = (pad, idx) => (pad.binding && pad.binding.kind === 'note' ? pad.binding.midi : B.padNote(idx))
const nodeOf = (pad) => (pad.binding && (pad.binding.kind === 'sound' || pad.binding.kind === 'sample') && pad.binding.nodeId ? pad.binding.nodeId : null)

function startPad (idx, velocity, bus) {
  const pad = getState().pads[idx], r = rt[idx]
  if (pad.choke > 0) getState().pads.forEach((o, j) => { if (j !== idx && o.choke === pad.choke && rt[j].on) stopPad(j, bus) })
  const vel = Math.min(1, Math.max(0.05, velocity * pad.volume))
  bus.noteOn({ midi: noteOf(pad, idx), velocity: vel, hand: 'X', source: 'pad', keyId: `pad:${idx}` })
  const node = nodeOf(pad)
  if (node) fire('omni:sound-play-request', { nodeId: node, velocity: vel, volume: pad.volume, source: 'pad', pad: idx })
  r.on = true; r.midi = noteOf(pad, idx); r.node = node; r.mode = pad.mode
  emitPad(idx, 'on')
}
function stopPad (idx, bus) {
  const r = rt[idx]; if (!r.on) return
  clearTimeout(r.timer); r.timer = 0
  r.on = false
  bus.noteOff({ midi: r.midi, hand: 'X', source: 'pad', keyId: `pad:${idx}` })
  if (r.node && r.mode !== 'oneshot') fire('omni:sound-stop-request', { nodeId: r.node, source: 'pad', pad: idx })
  emitPad(idx, 'off')
}
/** A pad is pressed. `keyId` tells holders apart (pointer id, key code). */
export function padDown (idx, { velocity = 0.8, keyId = 'ui', bus = Bus } = {}) {
  if (!(idx >= 0 && idx < B.PAD_COUNT)) return false
  const pad = getState().pads[idx], r = rt[idx]
  r.held.add(keyId)
  if (pad.mode === 'toggle') { if (r.on) stopPad(idx, bus); else startPad(idx, velocity, bus); return true }
  if (r.on) stopPad(idx, bus)   // re-hit: retrigger
  startPad(idx, velocity, bus)
  if (pad.mode === 'oneshot') r.timer = setTimeout(() => { r.timer = 0; stopPad(idx, bus) }, ONESHOT_MS)
  return true
}
export function padUp (idx, { keyId = 'ui', bus = Bus } = {}) {
  if (!(idx >= 0 && idx < B.PAD_COUNT)) return false
  const r = rt[idx]; r.held.delete(keyId)
  if (getState().pads[idx].mode === 'hold' && r.held.size === 0) stopPad(idx, bus)
  return true
}
export function isPadOn (idx) { return !!rt[idx]?.on }
/** Silence everything (toggle loops included). */
export function stopAll (bus = Bus) { for (let i = 0; i < B.PAD_COUNT; i++) { rt[i].held.clear(); stopPad(i, bus) } }

// ── styles ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const PAD_STYLES = `
.bp { box-sizing: border-box; height: 100%; width: 100%; container-type: size; padding: 6px; color: var(--omni-theme-text, rgba(255,255,255,.93)); font-family: 'Courier New', Courier, monospace; font-size: 11px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.bp-main { height: 100%; display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.bp-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex: 0 0 auto; }
.bp-bar .bp-sel { flex: 1 1 110px; min-width: 0; }
.bp-btn, .bp-sel, .bp-in { min-height: 28px; box-sizing: border-box; padding: 2px 8px; font: inherit; color: inherit; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.bp-btn { cursor: pointer; touch-action: manipulation; } .bp-btn:hover { background: rgba(255,255,255,.17); }
.bp-btn.is-on { background: var(--omni-theme-accent, #7fd8ff); color: var(--omni-theme-bg, #08080c); border-color: transparent; }
.bp-sel option { color: #111; background: #fff; }
.bp-wrap { position: relative; flex: 1 1 auto; min-height: 0; container-type: size; display: flex; align-items: center; justify-content: center; }
.bp-grid { width: min(100cqw, 100cqh); height: min(100cqw, 100cqh); display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 6px; outline: none; touch-action: none; border-radius: 10px; }
.bp-grid:focus-visible { box-shadow: 0 0 0 2px var(--omni-theme-accent, #7fd8ff); }
.bp-pad { --pc: #7fd8ff; position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 9px; border: 1px solid color-mix(in srgb, var(--pc) 70%, transparent); background: color-mix(in srgb, var(--pc) 16%, rgba(0,0,0,.35)); cursor: pointer; overflow: hidden; touch-action: none; transition: transform .07s; }
.bp-pad .bp-l { font-size: 12px; font-weight: bold; max-width: 94%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-pad .bp-s { font-size: 9px; opacity: .65; }
.bp-pad .bp-k { position: absolute; top: 3px; left: 5px; font-size: 9px; opacity: .55; }
.bp-pad .bp-m { position: absolute; top: 3px; right: 5px; font-size: 9px; opacity: .8; }
.bp-pad.is-sel { box-shadow: 0 0 0 2px #fff inset; }
.bp-pad.is-on { background: color-mix(in srgb, var(--pc) 75%, rgba(0,0,0,.2)); }
.bp-pad.is-hit { transform: scale(.94); animation: bp-pulse ${PULSE_MS}ms ease-out; }
@keyframes bp-pulse { 0% { box-shadow: 0 0 0 0 var(--pc), 0 0 22px var(--pc); } 100% { box-shadow: 0 0 0 10px transparent, 0 0 0 transparent; } }
.bp-hint { flex: 0 0 auto; min-height: 13px; font-size: 10px; opacity: .7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-edit { flex: 0 0 auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 8px; padding: 6px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 8px; background: rgba(0,0,0,.25); }
.bp-edit[hidden] { display: none; }
.bp-edit label { display: flex; flex-direction: column; gap: 2px; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; opacity: .9; min-width: 0; }
.bp-edit label.is-wide { grid-column: 1 / -1; }
.bp-edit .bp-in, .bp-edit .bp-sel { width: 100%; text-transform: none; letter-spacing: 0; font-size: 11px; }
.bp-edit input[type=color] { padding: 0 2px; }
.bp-edit input[type=range] { width: 100%; }
/* a wide, short place (a maximized quadrant): the tools go to a column on the left and the grid gets the full height; the editor to the right */
@container (max-aspect-ratio: 3/2) { .bp-wrap { flex: 0 0 auto; height: min(100cqw, 62cqh); } }
@container (min-aspect-ratio: 3/2) {
  .bp-main { flex-direction: row; overflow: hidden; }
  .bp-bar { flex-direction: column; align-items: stretch; flex: 0 0 112px; }
  .bp-bar .bp-sel { flex: 0 0 auto; }
  .bp-hint { display: none; }
  .bp-edit { flex: 0 0 230px; grid-template-columns: 1fr; overflow: auto; }
}
@media (max-width: 700px) { .bp-btn, .bp-sel, .bp-in { min-height: 38px; } .bp-edit { grid-template-columns: 1fr; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('bp-styles')) return
  const s = document.createElement('style'); s.id = 'bp-styles'; s.textContent = PAD_STYLES; document.head.appendChild(s)
}

// ── the grid component ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** mountBeatPad(host, ctx, { bus }) -> { el, destroy, onResize, focus, setEdit, getSelected } */
export function mountBeatPad (host, ctx = {}, opts = {}) {
  injectStyles()
  const bus = opts.bus || Bus
  let destroyed = false, edit = false, sel = -1, exprOn = false
  let pending = null   // { idx, kind }: a kind the user picked that cannot be stored yet (sound with no sound nodes in the scene)
  const root = document.createElement('div'); root.className = 'bp'; root.dataset.bp = '1'
  root.innerHTML = `<div class="bp-main">
    <div class="bp-bar">
      <button type="button" class="bp-btn" data-a="edit" aria-pressed="false" ${tip('Edit pads', 'Edit mode: tap a pad to choose it and change its label, colour, sound, mode, choke group and volume. A long press on a pad does the same.', 'long press')}>Edit</button>
      <select class="bp-sel" data-r="kit" aria-label="Kit" ${tip('Kit', 'Loads a kit preset into all 16 pads (this replaces the current pads).')}>${B.PRESETS.map(p => `<option value="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</option>`).join('')}</select>
      <button type="button" class="bp-btn" data-a="stop" ${tip('Stop all', 'Stops every sounding pad, loops included.')}>Stop</button>
    </div>
    <div class="bp-wrap"><div class="bp-grid" role="grid" tabindex="0" aria-label="Beat pad, 16 pads" data-r="grid"></div></div>
    <div class="bp-hint" data-r="hint" aria-live="off"></div>
    <div class="bp-edit" data-r="editor" hidden></div></div>`
  host.appendChild(root)
  const q = (r) => root.querySelector(`[data-r="${r}"]`)
  const grid = q('grid'), editor = q('editor'), kitSel = q('kit'), editBtn = root.querySelector('[data-a="edit"]')
  const padEls = []
  B.DISPLAY_ORDER.forEach((idx) => {
    const el = document.createElement('div'); el.className = 'bp-pad'; el.dataset.i = String(idx); el.setAttribute('role', 'gridcell')
    el.innerHTML = '<span class="bp-k"></span><span class="bp-m"></span><span class="bp-l"></span><span class="bp-s"></span>'
    grid.appendChild(el); padEls[idx] = el
  })
  const timers = new Set()
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn() }, ms); timers.add(t); return t }

  function renderPad (idx) {
    const p = getState().pads[idx], el = padEls[idx]
    el.style.setProperty('--pc', p.colour)
    el.querySelector('.bp-l').textContent = p.label || ' '
    el.querySelector('.bp-k').textContent = B.keyLabelOf(idx)
    el.querySelector('.bp-m').textContent = p.mode === 'hold' ? 'H' : p.mode === 'toggle' ? '∞' : ''
    const b = p.binding
    el.querySelector('.bp-s').textContent = !b ? 'note ' + B.padNote(idx) : b.kind === 'note' ? noteName(b.midi) : b.kind === 'sound' ? 'sound' : 'sample ' + b.sampleSlot
    el.setAttribute('aria-label', `Pad ${idx + 1}, ${p.label || 'blank'}`)
    el.classList.toggle('is-sel', edit && idx === sel)
    el.classList.toggle('is-on', isPadOn(idx))
  }
  const renderAll = () => { for (let i = 0; i < B.PAD_COUNT; i++) renderPad(i); kitSel.value = getState().kit; renderHint(); renderEditor() }
  function renderHint () {
    q('hint').textContent = edit ? (sel >= 0 ? `Editing pad ${sel + 1}. Tap another pad to choose it.` : 'Edit mode: tap a pad to choose it.') : exprOn ? 'Expression mode is on: the computer keys play the keyboard, not the pads.' : 'Click the pads, or focus them and use 1-4 / Q-R / A-F / Z-V.'
  }
  function setEdit (on, idx) {
    edit = !!on; if (idx !== undefined) sel = idx; if (!edit) sel = -1
    editBtn.classList.toggle('is-on', edit); editBtn.setAttribute('aria-pressed', String(edit))
    renderAll()
  }

  function renderEditor () {
    if (!edit || sel < 0) { editor.hidden = true; editor.textContent = ''; return }
    const p = getState().pads[sel], b = p.binding, nodes = listSoundNodes()
    const kind = b ? b.kind : (pending && pending.idx === sel ? pending.kind : 'none')
    const nodeOpts = (cur) => nodes.length ? nodes.map(n => `<option value="${esc(n.id)}"${n.id === cur ? ' selected' : ''}>${esc(n.label)}</option>`).join('') : '<option value="" disabled selected>No sound nodes in this scene</option>'
    editor.hidden = false
    editor.innerHTML = `
      <label>Label<input class="bp-in" data-f="label" maxlength="14" value="${esc(p.label)}"></label>
      <label>Colour<input class="bp-in" type="color" data-f="colour" value="${esc(p.colour)}"></label>
      <label>Plays<select class="bp-sel" data-f="kind"><option value="none"${kind === 'none' ? ' selected' : ''}>Pad note only</option><option value="note"${kind === 'note' ? ' selected' : ''}>A note</option><option value="sound"${kind === 'sound' ? ' selected' : ''}>A sound node</option><option value="sample"${kind === 'sample' ? ' selected' : ''}>A sample slot</option></select></label>
      ${kind === 'note' ? `<label>Note (0-127, ${esc(noteName(b.midi))})<input class="bp-in" type="number" min="0" max="127" data-f="midi" value="${b.midi}"></label>` : ''}
      ${kind === 'sound' ? `<label>Sound node<select class="bp-sel" data-f="nodeId">${nodeOpts(b ? b.nodeId : '')}</select></label>` : ''}
      ${kind === 'sample' ? `<label>Slot (1-15)<input class="bp-in" type="number" min="1" max="15" data-f="sampleSlot" value="${b.sampleSlot}"></label><label>Also play node<select class="bp-sel" data-f="nodeId"><option value="">(none)</option>${nodeOpts(b.nodeId)}</select></label>` : ''}
      <label>Mode<select class="bp-sel" data-f="mode">${B.MODES.map(m => `<option value="${m}"${m === p.mode ? ' selected' : ''}>${B.MODE_LABELS[m]}</option>`).join('')}</select></label>
      <label>Choke group<select class="bp-sel" data-f="choke">${Array.from({ length: B.CHOKE_MAX + 1 }, (_, i) => `<option value="${i}"${i === p.choke ? ' selected' : ''}>${i === 0 ? 'None' : 'Group ' + i}</option>`).join('')}</select></label>
      <label class="is-wide">Volume ${Math.round(p.volume * 100)}%<input type="range" min="0" max="100" data-f="volume" value="${Math.round(p.volume * 100)}"></label>
      <button type="button" class="bp-btn" data-a="test">Test pad</button><button type="button" class="bp-btn" data-a="reset">Reset pad</button>`
  }
  editor.addEventListener('change', (e) => {
    const f = e.target.dataset?.f; if (!f || sel < 0) return
    const p = getState().pads[sel]; let v = e.target.value
    if (f === 'kind') {
      pending = { idx: sel, kind: v }
      const patch = v === 'none' ? { binding: null } : v === 'note' ? { binding: { kind: 'note', midi: B.padNote(sel) } } : v === 'sound' ? { binding: { kind: 'sound', nodeId: listSoundNodes()[0]?.id ?? '' } } : { binding: { kind: 'sample', sampleSlot: 1 } }
      updatePad(sel, patch)
    } else if (f === 'midi') updatePad(sel, { binding: { kind: 'note', midi: Number(v) } })
    else if (f === 'nodeId') updatePad(sel, { binding: { ...(p.binding || { kind: 'sound' }), nodeId: v || undefined } })
    else if (f === 'sampleSlot') updatePad(sel, { binding: { ...(p.binding || { kind: 'sample' }), sampleSlot: Number(v) } })
    else if (f === 'volume') updatePad(sel, { volume: Number(v) / 100 })
    else if (f === 'choke') updatePad(sel, { choke: Number(v) })
    else updatePad(sel, { [f]: v })
  })
  editor.addEventListener('input', (e) => { const f = e.target.dataset?.f; if (f === 'label' && sel >= 0) { updatePad(sel, { label: e.target.value }) } else if (f === 'colour' && sel >= 0) updatePad(sel, { colour: e.target.value }) })

  root.addEventListener('click', (e) => {
    const a = e.target.closest?.('[data-a]')?.dataset.a; if (!a) return
    if (a === 'edit') setEdit(!edit, edit ? -1 : (sel >= 0 ? sel : 0))
    else if (a === 'stop') stopAll(bus)
    else if (a === 'test' && sel >= 0) { padDown(sel, { velocity: 0.9, keyId: 'test', bus }); later(() => padUp(sel, { keyId: 'test', bus }), 260) }
    else if (a === 'reset' && sel >= 0) { updatePad(sel, B.defaultPad(sel)) }
  })
  kitSel.addEventListener('change', () => { applyKit(kitSel.value) })

  // ── pointers ───────────────────────────────────────────────────────────
  const ptrs = new Map()   // pointerId -> { idx, keyId, x, y, lp, edited }
  const idxOf = (t) => { const el = t?.closest?.('.bp-pad'); return el && root.contains(el) ? Number(el.dataset.i) : -1 }
  grid.addEventListener('pointerdown', (e) => {
    if (destroyed || (e.pointerType === 'mouse' && e.button !== 0)) return
    const idx = idxOf(e.target); if (idx < 0) return
    e.preventDefault(); if (pending && pending.idx !== idx) pending = null
    try { grid.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
    if (edit) { sel = idx; renderAll(); return }
    try { grid.setPointerCapture?.(e.pointerId) } catch (_) { /* synthetic pointer */ }
    const keyId = `ptr:${e.pointerId}`
    const rect = padEls[idx].getBoundingClientRect()
    const rec = { idx, keyId, x: e.clientX, y: e.clientY, lp: 0 }
    ptrs.set(e.pointerId, rec)
    padDown(idx, { velocity: velocityFrom({ pointerType: e.pointerType, pressure: e.pressure, yFrac: yFraction(rect, e.clientY) }), keyId, bus })
    rec.lp = later(() => { if (!ptrs.has(e.pointerId)) return; padUp(idx, { keyId, bus }); ptrs.delete(e.pointerId); if (rt[idx].mode === 'oneshot') { /* already ringing out */ } setEdit(true, idx) }, LONG_PRESS_MS)
  })
  grid.addEventListener('pointermove', (e) => {
    const r = ptrs.get(e.pointerId); if (!r || !r.lp) return
    if (Math.hypot(e.clientX - r.x, e.clientY - r.y) > 10) { clearTimeout(r.lp); timers.delete(r.lp); r.lp = 0 }
  })
  const release = (e) => {
    const r = ptrs.get(e.pointerId); if (!r) return
    ptrs.delete(e.pointerId); if (r.lp) { clearTimeout(r.lp); timers.delete(r.lp) }
    padUp(r.idx, { keyId: r.keyId, bus })
  }
  grid.addEventListener('pointerup', release); grid.addEventListener('pointercancel', release); grid.addEventListener('lostpointercapture', release)
  grid.addEventListener('contextmenu', (e) => e.preventDefault())

  // ── keys (hint): only on the focused grid ──────────────────────────────
  const keyHeld = new Map()  // code -> idx
  grid.addEventListener('keydown', (e) => {
    if (exprOn || e.metaKey || e.ctrlKey || e.altKey) return
    const idx = B.KEY_TO_PAD[e.code]; if (idx === undefined) return
    e.preventDefault()
    if (e.repeat || keyHeld.has(e.code)) return
    keyHeld.set(e.code, idx)
    if (edit) { sel = idx; renderAll(); return }
    padDown(idx, { velocity: 0.8, keyId: 'key:' + e.code, bus })
  })
  grid.addEventListener('keyup', (e) => { const idx = keyHeld.get(e.code); if (idx === undefined) return; keyHeld.delete(e.code); padUp(idx, { keyId: 'key:' + e.code, bus }) })
  const releaseLocal = () => {
    for (const [pid, r] of [...ptrs]) { ptrs.delete(pid); if (r.lp) clearTimeout(r.lp); padUp(r.idx, { keyId: r.keyId, bus }) }
    for (const [code, idx] of [...keyHeld]) { keyHeld.delete(code); padUp(idx, { keyId: 'key:' + code, bus }) }
  }
  grid.addEventListener('blur', () => { for (const [code, idx] of [...keyHeld]) { keyHeld.delete(code); padUp(idx, { keyId: 'key:' + code, bus }) } })
  const onBlur = () => releaseLocal()
  window.addEventListener('blur', onBlur)
  const onMode = (e) => { exprOn = !!e.detail?.on; if (exprOn) releaseLocal(); renderHint() }
  window.addEventListener('omni:expression-mode', onMode)

  // ── store + pulse ──────────────────────────────────────────────────────
  const unState = subscribeState(() => { if (!destroyed) renderAll() })
  const unPads = subscribePads((idx, kind) => {
    if (destroyed) return
    const el = padEls[idx]; if (!el) return
    el.classList.toggle('is-on', isPadOn(idx))
    if (kind === 'on') { el.classList.remove('is-hit'); void el.offsetWidth; el.classList.add('is-hit'); later(() => el.classList.remove('is-hit'), PULSE_MS) }
  })
  renderAll()

  return {
    el: root,
    focus () { try { grid.focus({ preventScroll: true }) } catch (_) { /* ignore */ } },
    setEdit, getSelected: () => sel, isEditing: () => edit,
    onResize () {},
    destroy () {
      if (destroyed) return
      destroyed = true
      releaseLocal(); timers.forEach(t => clearTimeout(t)); timers.clear()
      unState(); unPads()
      window.removeEventListener('blur', onBlur); window.removeEventListener('omni:expression-mode', onMode)
      root.remove()
    }
  }
}

export function registerBeatPadContent (registry) {
  return registry.registerQuadrantContent('beatpad', { label: 'BeatPad', order: 20, mount: (host, ctx) => mountBeatPad(host, ctx) })
}

// ── the standalone window ──────────────────────────────────────────────────────────────────────────────────────────────────

export const PANEL_ID = 'beatpad'
export const NAV_ITEM = '⟐OmniBeatPad'
export const NAV_ITEMS = ['OmniBeatPad', '⟐OmniBeatPad']

export default class OmniBeatPad extends OmniSettingsPanelBase {
  constructor (omniNode = null) {
    super({ id: PANEL_ID, label: 'OmniBeatPad', iconLabel: '⟐BP', navItems: NAV_ITEMS, className: 'bp-panel' })
    this.omniNode = omniNode
    this._pad = null
  }
  onInit () {
    setBeatPadContext({ omniNode: this.omniNode }); primeSoundNodes()
    const s = document.getElementById('bp-win-styles'); if (!s) { const t = document.createElement('style'); t.id = 'bp-win-styles'; t.textContent = `.oss-panel.bp-panel { width: 380px; height: 560px; } .bp-panel .oss-body { padding: 0; overflow: hidden; display: flex; } @media (max-width: ${PHONE_MAX}px) { .oss-panel.bp-panel.bp-panel { height: 66vh; max-height: 66vh; width: 100%; max-width: 100vw; } }`; document.head.appendChild(t) }
  }
  onDestroy () { this._pad?.destroy(); this._pad = null }
  buildBody (body) { this._body = body }
  onOpened () {
    if (!this._pad) this._pad = mountBeatPad(this._el.querySelector('.oss-body'), { quadrant: null, maximized: false })
  }
  close () { this._pad?.destroy(); this._pad = null; super.close() }
  _place () {
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--omni-top-stack')) || 200) + 8
    const w = this._el.offsetWidth || 380
    const sf = handsSafe(top, top + 520)
    this._el.style.top = top + 'px'
    this._el.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, sf.right - w - 20)) + 'px'
    this._el.style.maxHeight = Math.max(300, window.innerHeight - top - 70) + 'px'
  }
}
