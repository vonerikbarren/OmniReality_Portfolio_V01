/**
 * ui/OmniExpressionKeyboard.js (V195) — the on-screen keyboard of the OmniExpression panel: one or two hand blocks (LH / RH), each with a black
 * row and two white rows labelled with the computer key and the note name. Used by the panel (both hands together), by the split panels (one
 * hand each) and by the quadrants ('keysL' / 'keysR'). Module-style component: mountKeyboard(host, opts) -> { el, destroy, onResize, ... }.
 *
 * PRODUCER (touch / mouse / pen): pointer events on the keyboard root, one pointer = one note (keyId `touch:<pointerId>`), several fingers =
 * several notes. Velocity from the pressure when the device really has it, else from the vertical position inside the key (utils/
 * OmniExpressionPanelModel.js velocityFrom). A finger that slides over the keys glides: the old note is released, the new one starts. Pointer
 * up / cancel / lost capture, window blur, page hidden and destroy() ALWAYS release (InputBus.noteOff / allOff for our own keys only).
 * Notes go to utils/OmniInputBus.js: noteOn/noteOff { midi, velocity, hand:'L'|'R', source:'touch', keyId }.
 * CONSUMER: the keys light up from the bus events (computer keys, MIDI, the sequencer echo, our own touches), sustain / bend / mod lamps too.
 * OCTAVE: each hand has an octave readout with - / + buttons (the touch keyboard's octave). It also follows the octave of the computer keys:
 * when a note of that hand arrives that is outside the shown block, the block moves to it; the event `omni:expression-octave` {hand, octave}
 * (proposed in OMNIEXPRESSION_PANEL_DESIGN.md) sets it explicitly.
 */
import * as Bus from '../utils/OmniInputBus.js'
import * as M from '../utils/OmniExpressionPanelModel.js'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`

export const KB_STYLES = `
.xk { box-sizing: border-box; width: 100%; display: flex; flex-direction: column; gap: 6px; container-type: inline-size; color: var(--omni-theme-text, rgba(255,255,255,.93)); font-family: 'Courier New', Courier, monospace; font-size: 11px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.xk.is-fill { height: 100%; container-type: size; }
.xk-hands { display: flex; flex-wrap: wrap; gap: 10px 18px; justify-content: center; flex: 1 1 auto; min-height: 0; }
.xk.is-fill .xk-hands { flex-wrap: nowrap; }
.xk-hand { --kw: 44px; flex: 0 1 auto; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.xk.is-fill .xk-hand { flex: 1 1 0; }
.xk-hhead { display: flex; align-items: center; gap: 6px; height: 24px; flex: 0 0 auto; }
.xk-hname { letter-spacing: .08em; text-transform: uppercase; font-size: 9px; opacity: .7; flex: 1 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.xk-oct { min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; font-size: 11px; }
.xk-ob { width: 26px; height: 22px; padding: 0; border-radius: 5px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); background: rgba(255,255,255,.07); color: inherit; font: inherit; cursor: pointer; touch-action: manipulation; }
.xk-ob:hover { background: rgba(255,255,255,.18); }
.xk-rows { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; min-height: 0; }
.xk-row { display: flex; gap: 4px; flex: 0 0 auto; }
.xk.is-fill .xk-row { flex: 1 1 0; min-height: 26px; }
.xk-row[data-row="home"] { padding-left: calc(var(--kw) * .25); }
.xk-row[data-row="bottom"] { padding-left: calc(var(--kw) * .75); }
.xk-key { position: relative; box-sizing: border-box; flex: 0 0 var(--kw); width: var(--kw); height: calc(var(--kw) * .8); min-height: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; border-radius: 7px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.22)); touch-action: none; cursor: pointer; }   /* no transition on the light: an instrument must answer at once (and a stalled animation timeline would leave the key half lit) */
.xk.is-fill .xk-key { height: auto; }
.xk-key[data-row="home"], .xk-key[data-row="bottom"] { background: rgba(255,255,255,.12); }
.xk-key[data-row="black"] { background: rgba(0,0,0,.55); border-color: rgba(255,255,255,.14); }
.xk-key .xk-l { font-size: 13px; font-weight: bold; line-height: 1; }
.xk-key .xk-n { font-size: 9px; opacity: .72; line-height: 1; }
.xk-key.is-on { background: var(--omni-theme-accent, #7fd8ff); color: var(--omni-theme-bg, #08080c); border-color: transparent; transform: translateY(1px) scale(.97); box-shadow: 0 0 14px var(--omni-theme-accent, #7fd8ff); }
.xk-key.is-on .xk-n { opacity: 1; }
.xk-status { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px 14px; flex: 0 0 auto; min-height: 22px; font-size: 10px; letter-spacing: .06em; }
.xk-lamp { display: inline-flex; align-items: center; gap: 5px; padding: 1px 7px; border-radius: 10px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); background: rgba(255,255,255,.05); color: inherit; font: inherit; cursor: pointer; touch-action: manipulation; }
.xk-lamp::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.25); }
.xk-lamp.is-on::before { background: var(--omni-theme-accent, #7fd8ff); box-shadow: 0 0 8px var(--omni-theme-accent, #7fd8ff); }
.xk-meter { display: inline-flex; align-items: center; gap: 5px; }
.xk-meter i { display: inline-block; position: relative; width: 56px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.14); overflow: hidden; }
.xk-meter i b { position: absolute; top: 0; bottom: 0; left: 0; width: 0; background: var(--omni-theme-accent, #7fd8ff); }
.xk-meter.is-bipolar i b { left: 50%; }
.xk-meter.is-bipolar i::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,.5); }
@container (min-width: 20px) { .xk-hand { --kw: clamp(30px, calc((100cqw - 16px) / 6.1), 70px); } }
@container (min-width: 700px) { .xk:not(.is-single) .xk-hand { --kw: clamp(30px, calc((100cqw - 56px) / 12.3), 64px); } }
.xk.is-fill .xk-hand { --kw: clamp(26px, calc((100cqw - 24px) / (var(--xk-n, 1) * 6.1)), 120px); }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('xk-styles')) return
  const s = document.createElement('style'); s.id = 'xk-styles'; s.textContent = KB_STYLES; document.head.appendChild(s)
}

/**
 * mountKeyboard(host, { hands: ['L','R'] | ['L'] | ['R'], fill?: bool, octave?: {L,R}, onOctave?(hand, octave), bus?, rows? })
 * Returns { el, destroy, onResize, getOctave(hand), setOctave(hand, n), releaseAll(), activePointers() }.
 */
export function mountKeyboard (host, opts = {}) {
  injectStyles()
  const bus = opts.bus || Bus
  const hands = (Array.isArray(opts.hands) ? opts.hands : ['L', 'R']).filter(h => h === 'L' || h === 'R')
  if (!hands.length) hands.push('L')
  let rows = opts.rows || M.KEY_ROWS
  const oct = { L: M.BASE_OCTAVE.L, R: M.BASE_OCTAVE.R, ...(opts.octave || {}) }
  const root = document.createElement('div')
  root.className = 'xk' + (opts.fill ? ' is-fill' : '') + (hands.length === 1 ? ' is-single' : '')
  root.style.setProperty('--xk-n', String(hands.length))
  root.setAttribute('role', 'group'); root.setAttribute('aria-label', hands.length === 1 ? M.HAND_NAME[hands[0]] + ' keyboard' : 'Keyboard, both hands')
  root.dataset.xk = '1'
  const keyEls = new Map()      // 'L:KeyA' -> element
  const keyInfo = new Map()     // element -> { hand, code, semi, midi }
  const lit = new Map()         // midi -> count of sources (we recompute from events)
  let destroyed = false

  const handBlock = (h) => `
    <div class="xk-hand" data-hand="${h}">
      <div class="xk-hhead"><span class="xk-hname">${M.HAND_NAME[h]}</span>
        <button type="button" class="xk-ob" data-oct="${h}:-1" aria-label="${M.HAND_NAME[h]} octave down" ${tip(M.HAND_NAME[h] + ' octave down', 'Moves this keyboard one octave down (the touch keys). The computer keys use b for the same.', 'b')}>−</button>
        <span class="xk-oct" data-r="oct-${h}" aria-live="polite"></span>
        <button type="button" class="xk-ob" data-oct="${h}:1" aria-label="${M.HAND_NAME[h]} octave up" ${tip(M.HAND_NAME[h] + ' octave up', 'Moves this keyboard one octave up (the touch keys). The computer keys use n for the same.', 'n')}>＋</button>
      </div>
      <div class="xk-rows">${M.ROW_IDS.map(r => `<div class="xk-row" data-row="${r}"></div>`).join('')}</div>
    </div>`
  root.innerHTML = `<div class="xk-hands">${hands.map(handBlock).join('')}</div>
    <div class="xk-status" role="status" aria-label="Sustain, bend and modulation">
      <button type="button" class="xk-lamp" data-r="sus" aria-pressed="false" ${tip('Sustain', 'Holds the notes after you let go. Tap to switch it on or off; the Space bar does the same on the computer keyboard.', 'Space')}>SUS</button>
      <span class="xk-meter is-bipolar" ${tip('Pitch bend', 'Shows the pitch bend (Right Shift + Up / Down).', 'R-Shift ↑↓')}>BEND <i><b data-r="bend"></b></i></span>
      <span class="xk-meter" ${tip('Modulation', 'Shows the modulation (Left Shift + Up / Down).', 'L-Shift ↑↓')}>MOD <i><b data-r="mod"></b></i></span>
    </div>`
  host.appendChild(root)

  function fillKeys (h) {
    const block = root.querySelector(`.xk-hand[data-hand="${h}"]`)
    if (!block) return
    for (const [k, el] of [...keyEls]) if (k.startsWith(h + ':')) { keyEls.delete(k); keyInfo.delete(el) }
    for (const row of M.ROW_IDS) {
      const rowEl = block.querySelector(`.xk-row[data-row="${row}"]`)
      rowEl.textContent = ''
      for (const k of M.buildHandKeys(h, oct[h], rows).filter(x => x.row === row)) {
        const el = document.createElement('div')
        el.className = 'xk-key'; el.dataset.hand = h; el.dataset.row = row; el.dataset.code = k.code; el.dataset.midi = String(k.midi)
        el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${M.HAND_NAME[h]} ${k.label}, ${k.name}`)
        el.innerHTML = `<span class="xk-l">${esc(k.label)}</span><span class="xk-n">${esc(k.name)}</span>`
        rowEl.appendChild(el); keyEls.set(h + ':' + k.code, el); keyInfo.set(el, { hand: h, code: k.code, semi: k.semi, midi: k.midi })
      }
    }
    const o = root.querySelector(`[data-r="oct-${h}"]`); if (o) o.textContent = 'Oct ' + oct[h]
  }
  hands.forEach(fillKeys)

  // ── lights (from the bus) ────────────────────────────────────────────────
  const heldMidi = new Set()
  function paintLights () {
    for (const [el, info] of keyInfo) {
      const on = heldMidi.has(info.midi)
      if (on !== el.classList.contains('is-on')) el.classList.toggle('is-on', on)
    }
  }
  const setMeter = (name, frac, bipolar) => {
    const b = root.querySelector(`[data-r="${name}"]`); if (!b) return
    if (bipolar) { const f = Math.max(-1, Math.min(1, frac)); b.style.width = Math.abs(f) * 50 + '%'; b.style.left = f >= 0 ? '50%' : (50 + f * 50) + '%' } else b.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'
  }
  const sus = root.querySelector('[data-r="sus"]')
  const setSusLamp = (on) => { sus.classList.toggle('is-on', !!on); sus.setAttribute('aria-pressed', on ? 'true' : 'false') }
  function followOctave (evt) {
    // a note of one hand outside the shown block: the block follows the octave of the computer keys
    if (evt.source !== 'keys' || (evt.hand !== 'L' && evt.hand !== 'R') || !hands.includes(evt.hand)) return
    if (!M.blockContains(oct[evt.hand], evt.midi)) setOctave(evt.hand, M.octaveFor(evt.midi), false)
  }
  const unsub = bus.subscribe((evt) => {
    if (destroyed || !evt) return
    if (evt.type === 'noteOn') { followOctave(evt); heldMidi.add(evt.midi); paintLights() }
    else if (evt.type === 'noteOff') { heldMidi.delete(evt.midi); paintLights() }
    else if (evt.type === 'allOff') { heldMidi.clear(); paintLights(); setSusLamp(false) }   // the bus keeps bend / mod through allOff, so do the meters
    else if (evt.type === 'controller') {
      if (evt.kind === 'sustain') setSusLamp(evt.value >= 0.5)
      else if (evt.kind === 'bend') setMeter('bend', evt.value, true)
      else if (evt.kind === 'mod') setMeter('mod', evt.value)
    }
  })
  try { const st = bus.getState(); (st.held || []).forEach(m => heldMidi.add(m)); setSusLamp(st.sustain); setMeter('bend', st.bend || 0, true); setMeter('mod', st.mod || 0); paintLights() } catch (_) { /* no state */ }

  // ── octave ───────────────────────────────────────────────────────────────
  function setOctave (h, n, announce = true) {
    if (!hands.includes(h)) return oct[h]
    const v = Math.min(M.OCT_MAX, Math.max(M.OCT_MIN, Math.round(Number(n))))
    if (!Number.isFinite(v) || v === oct[h]) return oct[h]
    releaseHand(h)
    oct[h] = v; fillKeys(h); paintLights()
    if (announce) { try { opts.onOctave?.(h, v) } catch (_) { /* ignore */ } }
    return v
  }
  const onOctEvent = (e) => { const d = e.detail; if (d && (d.hand === 'L' || d.hand === 'R') && Number.isFinite(d.octave)) setOctave(d.hand, d.octave, false) }
  window.addEventListener('omni:expression-octave', onOctEvent)

  // ── pointers (producer) ──────────────────────────────────────────────────
  const active = new Map()   // pointerId -> { el, hand, midi, keyId }
  const keyIdOf = (pid) => `touch:${pid}`
  function rectItems () { return [...keyInfo.keys()].map(el => ({ id: el, rect: el.getBoundingClientRect() })) }
  function startNote (pid, el, e) {
    const info = keyInfo.get(el); if (!info) return
    const rect = el.getBoundingClientRect()
    const velocity = M.velocityFrom({ pointerType: e.pointerType, pressure: e.pressure, yFrac: M.yFraction(rect, e.clientY) })
    const keyId = keyIdOf(pid)
    active.set(pid, { el, hand: info.hand, midi: info.midi, keyId })
    bus.noteOn({ midi: info.midi, velocity, hand: info.hand, source: 'touch', keyId })
  }
  function stopNote (pid) {
    const a = active.get(pid); if (!a) return
    active.delete(pid)
    bus.noteOff({ midi: a.midi, hand: a.hand, source: 'touch', keyId: a.keyId })
  }
  function releaseHand (h) { for (const [pid, a] of [...active]) if (a.hand === h) stopNote(pid) }
  function releaseAll () { for (const pid of [...active.keys()]) stopNote(pid) }
  const keyUnder = (e) => {
    const t = e.target && e.target.closest ? e.target.closest('.xk-key') : null
    if (t && root.contains(t) && (e.type === 'pointerdown')) return t
    return M.hitTest(rectItems(), e.clientX, e.clientY)
  }
  root.addEventListener('pointerdown', (e) => {
    if (destroyed) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = keyUnder(e); if (!el) return
    e.preventDefault()
    try { root.setPointerCapture?.(e.pointerId) } catch (_) { /* synthetic pointer */ }
    if (active.has(e.pointerId)) stopNote(e.pointerId)
    startNote(e.pointerId, el, e)
  })
  root.addEventListener('pointermove', (e) => {
    const a = active.get(e.pointerId); if (!a) return
    const el = M.hitTest(rectItems(), e.clientX, e.clientY)
    if (el && el !== a.el) { stopNote(e.pointerId); startNote(e.pointerId, el, e) }
  })
  const up = (e) => stopNote(e.pointerId)
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', up)
  root.addEventListener('lostpointercapture', up)
  root.addEventListener('contextmenu', (e) => { if (e.target.closest?.('.xk-key')) e.preventDefault() })
  root.addEventListener('click', (e) => {
    const ob = e.target.closest?.('[data-oct]')
    if (ob) { const [h, d] = ob.dataset.oct.split(':'); setOctave(h, oct[h] + Number(d)); return }
    if (e.target.closest?.('[data-r="sus"]')) { try { bus.setSustain(!bus.getState().sustain) } catch (_) { /* ignore */ } }
  })
  const onBlur = () => releaseAll()
  const onVis = () => { if (typeof document !== 'undefined' && document.hidden) releaseAll() }
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVis)

  return {
    el: root,
    getOctave: (h) => oct[h],
    setOctave: (h, n) => setOctave(h, n),
    releaseAll,
    activePointers: () => active.size,
    setRows (r) { rows = r || M.KEY_ROWS; hands.forEach(fillKeys); paintLights() },
    onResize () { /* layout is pure CSS (container queries) */ },
    destroy () {
      if (destroyed) return
      destroyed = true
      releaseAll()
      unsub()
      window.removeEventListener('omni:expression-octave', onOctEvent)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
      root.remove(); keyEls.clear(); keyInfo.clear(); heldMidi.clear()
    }
  }
}

export default mountKeyboard
