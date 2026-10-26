/**
 * ui/OmniMixView.js — ⟐OmniMix: the mixing desk of an OmniMusicMixNode (V201). DOM only (DOM first, 3D second).
 *
 * Layout: a header (which mix node, new, name, tempo, transport, record, undo / redo), the channel strips side by side (source, name, fader, pan, filter, EQ, sends, A / T / B,
 * mute / solo, loop, tempo sync, level meter), then the master (fader, limiter, crossfader with curve) and the DJ tools (crossfade, fade, filter sweep over N seconds, written as
 * automation so a transition is replayable), then the automation lanes (clear one / all) and the warnings.
 * Everything is read and written through systems/OmniMixNodes.js (Extra.SERVICES.mix): each edit is ONE immutable model op = one undo step (a fader drag shares one).
 * The view never plays audio itself. Keyboard: Space = play / stop while a control inside has focus (not in text fields); strips are plain buttons and ranges (tab order).
 */

import * as X from '../utils/OmniMixModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const NAV_ITEM = '⟐OmniMix'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmt = (s) => { const t = Math.max(0, Number(s) || 0); const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}` }

export function injectMixStyles () {
  if (typeof document === 'undefined' || document.getElementById('omx-styles')) return
  const s = document.createElement('style'); s.id = 'omx-styles'
  s.textContent = `
.omx { display: flex; flex-direction: column; gap: 8px; font-size: 11px; }
.omx button, .omx select, .omx input { font: inherit; color: inherit; }
.omx button { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 3px 8px; cursor: pointer; }
.omx button:hover { background: rgba(255,255,255,.15); }
.omx button.is-on { background: rgba(255,180,90,.35); border-color: rgba(255,180,90,.8); }
.omx button.is-rec.is-on { background: rgba(255,70,70,.45); border-color: #ff6060; }
.omx select, .omx input[type=text], .omx input[type=number] { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; padding: 2px 5px; }
.omx input[type=number] { width: 58px; }
.omx-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.omx-strips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 6px; }
.omx-strip { flex: 0 0 178px; border: 1px solid rgba(255,255,255,.16); border-top: 3px solid var(--c, #888); border-radius: 8px; padding: 6px; display: flex; flex-direction: column; gap: 4px; background: rgba(255,255,255,.03); }
.omx-strip.is-silent { opacity: .55; }
.omx-strip input[type=text] { width: 100%; box-sizing: border-box; }
.omx-strip select { width: 100%; }
.omx-fader { display: flex; gap: 6px; align-items: stretch; justify-content: center; height: 84px; }
.omx-fader input[type=range] { writing-mode: vertical-lr; direction: rtl; width: 22px; height: 100%; }
.omx-meter { width: 8px; background: rgba(255,255,255,.1); border-radius: 4px; position: relative; overflow: hidden; }
.omx-meter i { position: absolute; left: 0; right: 0; bottom: 0; height: 0%; background: linear-gradient(0deg, #6be8a0, #ffd45c 70%, #ff6060); }
.omx-knobs { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 8px; }
.omx-knob { display: flex; flex-direction: column; font-size: 9px; opacity: .92; line-height: 1.1; }
.omx-knob input[type=range] { width: 100%; min-width: 0; margin: 0; height: 14px; }
.omx-btns { display: flex; gap: 3px; flex-wrap: wrap; }
.omx-btns button { padding: 1px 6px; }
.omx-master { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; border-top: 1px solid rgba(255,255,255,.14); padding-top: 6px; }
.omx-master input[type=range] { width: 140px; }
.omx-lane { display: flex; gap: 6px; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,.12); border-radius: 6px; padding: 2px 6px; }
.omx-warn { color: #ffd45c; line-height: 1.4; }
.omx-msg { min-height: 14px; opacity: .85; }
.omx-notice { padding: 8px; border: 1px dashed rgba(255,255,255,.35); border-radius: 8px; line-height: 1.45; }
.omx-deck { border-top: 1px dashed rgba(255,255,255,.2); padding-top: 4px; display: flex; flex-direction: column; gap: 3px; }
.omx-wave { position: relative; height: 34px; background: rgba(0,0,0,.35); border-radius: 4px; overflow: hidden; cursor: pointer; }
.omx-wave canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.omx-wave .lp { position: absolute; top: 0; bottom: 0; background: rgba(255,180,90,.22); border-left: 1px solid #ffb35c; border-right: 1px solid #ffb35c; }
.omx-wave .lp.off { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.35); }
.omx-wave .cu { position: absolute; top: 0; bottom: 0; width: 2px; background: #6be8a0; }
.omx-wave .hc { position: absolute; top: 0; height: 8px; width: 6px; margin-left: -3px; background: #ff6b9a; border-radius: 0 0 3px 3px; }
.omx-wave .ph { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; box-shadow: 0 0 4px #fff; left: 0; }
.omx-btns.hot button { min-width: 30px; }
.omx-btns.hot button.set { border-color: #ff6b9a; color: #ff9fbd; }
.omx-btns button.sm { padding: 1px 4px; font-size: 10px; }
.omx-tempo { font-size: 10px; opacity: .9; text-align: center; font-variant-numeric: tabular-nums; }
.omx-time { min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; }
`
  document.head.appendChild(s)
}

export default class OmniMixView {
  /** @param host the element to fill. @param opts { svc?, active?:()=>bool, compact? } */
  constructor (host, opts = {}) {
    this.host = host
    this.opts = opts
    this.nodeId = null
    this._bound = []
    this._raf = null
    this._sig = ''
    this._msg = ''
  }
  get svc () { return this.opts.svc ?? SERVICES.mix }

  mount () {
    injectMixStyles()
    this.host.innerHTML = '<div class="omx" data-ref="root"></div>'
    const on = (t, n, f) => { t.addEventListener(n, f); this._bound.push([t, n, f]) }
    on(this.host, 'click', (e) => this._click(e))
    on(this.host, 'input', (e) => this._input(e))
    on(this.host, 'click', (e) => this._waveClick(e))
    on(this.host, 'change', (e) => this._change(e))
    on(this.host, 'pointerdown', (e) => { if (e.target?.type === 'range') this.svc?.beginStroke?.(this.nodeId) })
    on(window, 'pointerup', () => this.svc?.endStroke?.())
    on(this.host, 'keydown', (e) => { if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName) || (e.code === 'Space' && e.target?.type === 'range')) { e.preventDefault(); this._transport('toggle') } })
    const ev = (name, fn) => { const f = (e) => fn(e.detail ?? {}); window.addEventListener(name, f); this._bound.push([window, name, f]) }
    ev('omni:mix-changed', (d) => { if (d.nodeId === this.nodeId) this._sync() })
    ev('omni:mix-transport', () => { this._sync(); this._startRaf() })
    ev('omni:mix-sources-changed', () => this._sync(true))
    ev('omni:node-selected', (d) => { const id = d.node?.id; if (id && d.node?.nodeKind === 'mixNode' && id !== this.nodeId) { this.setNode(id) } })
    ev('omni:node-created', () => this._sync(true))
    ev('omni:node-deleted', (d) => { if (d.id === this.nodeId) this.setNode(null); else this._sync(true) })
    this.refresh()
  }

  destroy () {
    for (const [t, n, f] of this._bound) { try { t.removeEventListener(n, f) } catch (_) { /* gone */ } }
    this._bound = []
    if (this._raf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf)
    this._raf = null
    this.host.innerHTML = ''
  }
  onOpened () { this.refresh(); this._startRaf() }
  onResize () {}

  setNode (id) {
    this.nodeId = id && this.svc?.isMixNode?.(id) ? id : null
    this._sig = ''
    this.refresh()
  }
  _pick () {
    const s = this.svc; if (!s) return
    if (this.nodeId && s.isMixNode(this.nodeId)) return
    const sel = s.selectedId
    if (sel && s.isMixNode(sel)) { this.nodeId = sel; return }
    this.nodeId = s.listMixNodes()[0] ?? null
  }

  refresh () { this._sig = ''; this._sync(true) }
  _mix () { return this.nodeId ? this.svc?.getMix?.(this.nodeId) ?? null : null }

  _sync (force = false) {
    const root = this.host.querySelector('[data-ref=root]'); if (!root) return
    this._pick()
    const svc = this.svc
    const mix = this._mix()
    const playing = !!(svc && this.nodeId && svc.isPlaying(this.nodeId))
    const rec = !!svc?.recording
    const sig = JSON.stringify([this.nodeId, mix, playing, rec, svc?.listMixNodes?.() ?? [], svc?.canUndo?.(this.nodeId), svc?.canRedo?.(this.nodeId), this._msg, svc?.getWarnings?.() ?? []])
    if (!force && sig === this._sig) return
    // do not rebuild while the user drags a range inside the panel
    const active = document.activeElement
    if (!force && active && active.type === 'range' && this.host.contains(active)) { this._patchValues(mix); this._sig = sig; return }
    this._sig = sig
    root.innerHTML = this._html(svc, mix, playing, rec)
    this._marked = false
    try { this._decorateDecks() } catch (_) { /* a drawing problem must not break the mixer */ }
  }

  /** Update only the values of ranges (a drag in progress must not lose focus). */
  _patchValues (mix) {
    if (!mix) return
    const set = (sel, v) => { const el = this.host.querySelector(sel); if (el && el !== document.activeElement) el.value = String(v) }
    for (const s of mix.strips) {
      set(`[data-t="${s.id}.volume"]`, s.volume); set(`[data-deck="${s.id}"] [data-act=pitch]`, s.pitch); set(`[data-t="${s.id}.pan"]`, s.pan); set(`[data-t="${s.id}.filter"]`, s.filter)
    }
    set('[data-t="master.gain"]', mix.master.gain); set('[data-t="cross.pos"]', mix.cross.pos)
  }

  _html (svc, mix, playing, rec) {
    if (!svc) return '<div class="omx-notice">The mixer is not available.</div>'
    const nodes = svc.listMixNodes()
    if (!this.nodeId || !mix) {
      return `<div class="omx-notice">No mix node yet. A mix node is a mixing desk: it plays songs, sounds and audio clips on channel strips, with a crossfader for DJ-style transitions.<div class="omx-row" style="margin-top:6px"><button data-act="create">Create a mix node</button></div></div>`
    }
    const src = svc.listSources()
    const levels = playing ? svc.getLevels() : null
    const pos = svc.getPosition()
    const sel = `<select data-act="pick" aria-label="Mix node">${nodes.map(id => `<option value="${esc(id)}"${id === this.nodeId ? ' selected' : ''}>${esc(svc.getNodeData(id)?.label || id)}</option>`).join('')}</select>`
    const head = `<div class="omx-row">${sel}<button data-act="create" title="New mix node">+ Mix</button>
      <input type="text" data-act="name" value="${esc(mix.name)}" maxlength="64" aria-label="Mix name" style="width:120px">
      <label>bpm <input type="number" data-act="bpm" value="${mix.bpm}" min="${X.MIX_LIMITS.bpmMin}" max="${X.MIX_LIMITS.bpmMax}" step="1"></label>
      <button data-act="toggle" class="${playing ? 'is-on' : ''}" aria-label="${playing ? 'Stop' : 'Play'}">${playing ? '■ Stop' : '▶ Play'}</button>
      <span class="omx-time" data-ref="time">${playing ? fmt(pos.t) : '0:00.0'}</span>
      <button data-act="rec" class="is-rec ${rec ? 'is-on' : ''}" aria-pressed="${rec}" title="Record fader moves as automation while the mix plays">● Rec</button>
      <button data-act="undo" ${svc.canUndo(this.nodeId) ? '' : 'disabled'}>Undo</button><button data-act="redo" ${svc.canRedo(this.nodeId) ? '' : 'disabled'}>Redo</button></div>`
    const opt = (list, cur) => list.map(x => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.name)}</option>`).join('')
    const strips = mix.strips.map((s, i) => {
      const lv = levels?.strips?.[s.id] ?? 0
      const list = s.source.type === 'song' ? src.songs : s.source.type === 'sound' ? src.sounds : src.audio
      const known = list.some(x => x.id === s.source.id)
      const rng = (t, min, max, step, v, label) => `<label class="omx-knob"><span>${label}</span><input type="range" data-t="${esc(s.id)}.${t}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${esc(s.name)} ${label}"></label>`
      return `<div class="omx-strip ${X.stripAudible(mix, s) ? '' : 'is-silent'}" style="--c:${esc(s.color)}" data-strip="${esc(s.id)}">
        <input type="text" data-act="sname" value="${esc(s.name)}" maxlength="32" aria-label="Strip name">
        <select data-act="stype" aria-label="Source type">${['song', 'sound', 'audio'].map(t => `<option value="${t}"${t === s.source.type ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <select data-act="ssrc" aria-label="Source"><option value="">— none —</option>${known || !s.source.id ? '' : `<option value="${esc(s.source.id)}" selected>(missing) ${esc(s.source.id)}</option>`}${opt(list, s.source.id)}</select>
        <div class="omx-fader"><input type="range" data-t="${esc(s.id)}.volume" min="0" max="1" step="0.01" value="${s.volume}" aria-label="${esc(s.name)} volume"><span class="omx-meter"><i data-meter="${esc(s.id)}" style="height:${Math.round(lv * 100)}%"></i></span></div>
        <div class="omx-knobs">${rng('pan', -1, 1, 0.01, s.pan, 'pan')}${rng('filter', 0, 1, 0.01, s.filter, 'filter')}
        ${rng('eqLow', 0, 1, 0.01, s.eq.low, 'low')}${rng('eqMid', 0, 1, 0.01, s.eq.mid, 'mid')}${rng('eqHigh', 0, 1, 0.01, s.eq.high, 'high')}${rng('sendReverb', 0, 1, 0.01, s.sends.reverb, 'reverb')}
        ${rng('sendDelay', 0, 1, 0.01, s.sends.delay, 'delay')}</div>
        <div class="omx-btns"><button data-act="assign" data-v="A" class="${s.assign === 'A' ? 'is-on' : ''}" title="Crossfader side A">A</button><button data-act="assign" data-v="T" class="${s.assign === 'T' ? 'is-on' : ''}" title="Through (not crossfaded)">T</button><button data-act="assign" data-v="B" class="${s.assign === 'B' ? 'is-on' : ''}" title="Crossfader side B">B</button></div>
        <div class="omx-btns"><button data-act="mute" class="${s.mute ? 'is-on' : ''}" aria-pressed="${s.mute}">M</button><button data-act="solo" class="${s.solo ? 'is-on' : ''}" aria-pressed="${s.solo}">S</button><button data-act="loop" class="${s.loop ? 'is-on' : ''}" aria-pressed="${s.loop}" title="Loop an audio clip">⟲</button><button data-act="left" ${i === 0 ? 'disabled' : ''} aria-label="Move left">◀</button><button data-act="right" ${i === mix.strips.length - 1 ? 'disabled' : ''} aria-label="Move right">▶</button><button data-act="remove" aria-label="Remove strip">×</button></div>
        <div class="omx-row"><label title="This strip's own tempo (for sync)">bpm <input type="number" data-act="sbpm" value="${s.bpm || ''}" min="${X.MIX_LIMITS.bpmMin}" max="${X.MIX_LIMITS.bpmMax}" placeholder="–"></label><button data-act="sync" class="${s.sync ? 'is-on' : ''}" aria-pressed="${s.sync}" title="Match this strip to the mix tempo">sync</button></div>
        ${s.source.type === 'audio' ? this._deckHTML(mix, s) : ''}
      </div>`
    }).join('')
    const add = `<div class="omx-row"><select data-ref="addtype" aria-label="New strip type"><option value="audio">audio clip</option><option value="sound">sound node</option><option value="song">song node</option></select><button data-act="add" ${mix.strips.length >= X.MIX_LIMITS.strips ? 'disabled' : ''}>+ Add strip</button><span>${mix.strips.length}/${X.MIX_LIMITS.strips}</span></div>`
    const m = mix.master
    const master = `<div class="omx-master">
      <label>master <input type="range" data-t="master.gain" min="0" max="1" step="0.01" value="${m.gain}" aria-label="Master volume"></label>
      <button data-act="limiter" class="${m.limiter ? 'is-on' : ''}" aria-pressed="${m.limiter}">Limiter</button>
      <label>rev <input type="range" data-act="revmix" min="0" max="1" step="0.01" value="${m.reverbMix}" style="width:70px"></label><label>dly <input type="range" data-act="delmix" min="0" max="1" step="0.01" value="${m.delayMix}" style="width:70px"></label>
      <label>A <input type="range" data-t="cross.pos" min="-1" max="1" step="0.01" value="${mix.cross.pos}" aria-label="Crossfader"> B</label>
      <select data-act="curve" aria-label="Crossfader curve">${X.CURVES.map(c => `<option value="${c}"${c === mix.cross.curve ? ' selected' : ''}>${c}</option>`).join('')}</select></div>`
    const secs = `<label>over <input type="number" data-ref="secs" value="8" min="0.1" max="600" step="0.5">s</label>`
    const dj = `<div class="omx-row"><b>DJ moves</b> ${secs}<button data-act="xfadeB">Crossfade → B</button><button data-act="xfadeA">Crossfade → A</button><span>strip:</span><select data-ref="djstrip" aria-label="Strip for fades">${mix.strips.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><button data-act="fadeout">Fade out</button><button data-act="fadein">Fade in</button><button data-act="sweep">Filter sweep</button></div>
      <div class="omx-row">Moves start at the play position (or at 0 when stopped) and are saved as automation.</div>`
    const lanes = mix.automation.length ? mix.automation.map(a => `<div class="omx-lane"><span>${esc(a.target)} · ${a.points.length} points · ${fmt(a.points[0].t)}–${fmt(a.points[a.points.length - 1].t)}</span><button data-act="clearlane" data-v="${esc(a.target)}">Clear</button></div>`).join('') + '<div class="omx-row"><button data-act="clearall">Clear all automation</button></div>' : '<div class="omx-row">No automation yet. Press ● Rec while playing and move a fader, or use a DJ move.</div>'
    const warn = svc.getWarnings().map(w => `<div class="omx-warn">⚠ ${esc(w)}</div>`).join('')
    return `${head}<div class="omx-strips" data-ref="strips">${strips}${mix.strips.length ? '' : '<div class="omx-notice">No strips yet. Add one below: pick the type, then choose the song, sound or clip on the strip.</div>'}</div>${add}${master}${dj}${lanes}${warn}<div class="omx-msg" role="status" aria-live="polite">${esc(this._msg)}</div>`
  }

  _deckHTML (mix, s) {
    const hot = s.hot.map((t, i) => `<button data-act="deck" data-a="hot" data-v="${i}" class="${t !== null ? 'set' : ''}" title="${t !== null ? 'Jump to hot cue ' + (i + 1) + ' (' + t.toFixed(2) + ' s). Shift-click clears it.' : 'Store hot cue ' + (i + 1) + ' at the playhead'}" aria-label="Hot cue ${i + 1}">${i + 1}</button>`).join('')
    const loops = [0.5, 1, 2, 4, 8].map(b => `<button class="sm" data-act="deck" data-a="loop" data-v="${b}" title="Loop ${b} beat${b === 1 ? '' : 's'} from the beat you are in">${b === 0.5 ? '½' : b}</button>`).join('')
    const eff = X.stripTempo(mix, s)
    const rate = X.deckRateOf(mix, s)
    return `<div class="omx-deck" data-deck="${esc(s.id)}">
      <div class="omx-wave" data-wave="${esc(s.id)}" title="Click to jump"><canvas width="340" height="68"></canvas><div class="lp ${s.loopOn ? '' : 'off'}" data-lp style="display:none"></div><div class="cu" data-cu style="display:none"></div><div data-hcs></div><div class="ph" data-ph></div></div>
      <div class="omx-btns"><button data-act="deck" data-a="cue" title="Jump to the cue point">CUE</button><button data-act="deck" data-a="setcue" class="sm" title="Set the cue point at the playhead (snaps to the beat grid)">set</button><button data-act="deck" data-a="pause" class="sm" aria-label="Pause deck">❚❚</button><button data-act="deck" data-a="play" class="sm" aria-label="Play deck">▶</button><button data-act="deck" data-a="tap" class="sm" title="Tap the beat 3 or more times to find the clip's bpm">tap</button><button data-act="deck" data-a="grid" class="sm" title="The first beat is here">grid</button></div>
      <div class="omx-btns hot">${hot}<button class="sm" data-act="hotclearall" title="Clear all hot cues">×</button></div>
      <div class="omx-btns"><button data-act="deck" data-a="looptoggle" class="sm ${s.loopOn ? 'is-on' : ''}" aria-pressed="${s.loopOn}" title="Loop on / off">⟲</button>${loops}<button class="sm" data-act="deck" data-a="half" title="Halve the loop">÷2</button><button class="sm" data-act="deck" data-a="double" title="Double the loop">×2</button><button class="sm" data-act="deck" data-a="back" title="Move the loop back">◂</button><button class="sm" data-act="deck" data-a="fwd" title="Move the loop forward">▸</button></div>
      <label class="omx-knob"><span>pitch ${(s.pitch * 8).toFixed(1)}%</span><input type="range" data-act="pitch" min="-1" max="1" step="0.005" value="${s.pitch}" aria-label="${esc(s.name)} pitch"></label>
      <div class="omx-btns"><button data-act="deck" data-a="keylock" class="sm ${s.keyLock ? 'is-on' : ''}" aria-pressed="${s.keyLock}" title="Key lock: change tempo without changing pitch (time-stretch)">key</button><button data-act="deck" data-a="pitchreset" class="sm" title="Pitch back to 0">0</button><button data-act="deck" data-a="mastertempo" class="sm" title="Make the mix tempo this strip's tempo">→ mix</button></div>
      <div class="omx-tempo" data-tempo="${esc(s.id)}">${s.bpm ? eff.toFixed(1) + ' bpm · ×' + rate.toFixed(3) : 'no tempo: tap or type the bpm'}</div></div>`
  }

  /** Draw each deck's waveform once per clip (peaks come from the audio library) and place the loop / cue marks. */
  _decorateDecks () {
    const svc = this.svc; const mix = this._mix(); if (!svc || !mix || !this.nodeId) return
    this._peaks = this._peaks ?? new Map()
    this.host.querySelectorAll('[data-wave]').forEach((box) => {
      const id = box.dataset.wave; const s = X.stripById(mix, id); if (!s) return
      const cv = box.querySelector('canvas'); const key = s.source.id
      const draw = (pk) => {
        const c = cv && cv.getContext ? cv.getContext('2d') : null; if (!c || !pk) return
        const w = cv.width; const h = cv.height; c.clearRect(0, 0, w, h); c.fillStyle = s.color || '#ffb35c'
        const n = pk.length / 2
        for (let x = 0; x < w; x++) { const i = Math.min(n - 1, Math.floor(x / w * n)); const lo = pk[i * 2]; const hi = pk[i * 2 + 1]; c.fillRect(x, h / 2 - hi * h / 2, 1, Math.max(1, (hi - lo) * h / 2)) }
      }
      if (this._peaks.has(key)) draw(this._peaks.get(key))
      else if (key) svc.getDeckPeaks(this.nodeId, id, 170).then((pk) => { if (pk) { this._peaks.set(key, pk); draw(pk) } }, () => {})
    })
    this._placeMarks(mix, null)
  }
  /** Loop region, cue and hot cue marks as % of the clip; `decks` = live deck states (for the length) or null to use the cached ones. */
  _placeMarks (mix, live) {
    this.host.querySelectorAll('[data-deck]').forEach((box) => {
      const id = box.dataset.deck; const s = X.stripById(mix, id); if (!s) return
      const dur = (live && live[id]?.dur) || this._durs?.[id] || 0
      if (live && live[id]) { this._durs = this._durs ?? {}; this._durs[id] = live[id].dur }
      const pc = (t) => (dur > 0 ? Math.min(100, Math.max(0, t / dur * 100)) : 0)
      const lp = box.querySelector('[data-lp]'); const cu = box.querySelector('[data-cu]'); const hcs = box.querySelector('[data-hcs]')
      if (lp) { const has = dur > 0 && s.loopOut - s.loopIn > 0; lp.style.display = has ? '' : 'none'; if (has) { lp.style.left = pc(s.loopIn) + '%'; lp.style.width = Math.max(0.5, pc(s.loopOut) - pc(s.loopIn)) + '%'; lp.classList.toggle('off', !s.loopOn) } }
      if (cu) { cu.style.display = dur > 0 ? '' : 'none'; cu.style.left = pc(s.cue) + '%' }
      if (hcs) hcs.innerHTML = dur > 0 ? s.hot.map(t => (t === null ? '' : `<div class="hc" style="left:${pc(t)}%"></div>`)).join('') : ''
    })
  }

  // ── level meters + time (cheap, only while open and playing) ─────────────────
  _startRaf () {
    if (this._raf != null || typeof requestAnimationFrame !== 'function') return
    const step = () => {
      this._raf = null
      const svc = this.svc
      const open = this.opts.active ? this.opts.active() : true
      if (!open || !svc || !this.nodeId || !svc.isPlaying(this.nodeId)) return
      const lv = svc.getLevels(); const p = svc.getPosition()
      const t = this.host.querySelector('[data-ref=time]'); if (t) t.textContent = fmt(p.t)
      this.host.querySelectorAll('[data-meter]').forEach(el => { el.style.height = Math.round((lv.strips?.[el.dataset.meter] ?? 0) * 100) + '%' })
      const decks = {}
      this.host.querySelectorAll('[data-deck]').forEach((box) => {
        const id = box.dataset.deck; const d = svc.getDeck?.(id); if (!d) return
        decks[id] = d
        const ph = box.querySelector('[data-ph]'); if (ph && d.dur > 0) ph.style.left = (Math.min(1, d.pos / d.dur) * 100) + '%'
      })
      if (Object.keys(decks).length && !this._marked) { this._marked = true; const m = this._mix(); if (m) this._placeMarks(m, decks) }
      this._raf = requestAnimationFrame(step)
    }
    this._raf = requestAnimationFrame(step)
  }

  // ── actions ──────────────────────────────────────────────────────────────────
  _say (t) { this._msg = t; this._sync(true) }
  _edit (reason, fn, coalesce = null) {
    const r = this.svc?.edit?.(this.nodeId, reason, fn, coalesce)
    if (r && r.ok === false) this._say(r.error || 'That did not work.')
    return r
  }
  _transport (action) {
    if (!this.nodeId) return
    const r = this.svc.transport(action, this.nodeId)
    if (r && r.ok === false && r.error) this._say(r.error); else this._sync(true)
    this._startRaf()
  }
  _stripId (el) { return el?.closest?.('[data-strip]')?.dataset?.strip ?? null }
  _secs () { const v = Number(this.host.querySelector('[data-ref=secs]')?.value); return Number.isFinite(v) && v > 0 ? v : 8 }
  _startT () { const s = this.svc; return s && s.isPlaying(this.nodeId) ? s.getPosition().t : 0 }

  _click (e) {
    const b = e.target?.closest?.('button[data-act]'); if (!b || !this.host.contains(b)) return
    const act = b.dataset.act; const id = this._stripId(b); const svc = this.svc; if (!svc) return
    switch (act) {
      case 'create': { const r = svc.createMixNode({ select: true }); if (r.ok) { this.nodeId = r.nodeId; this.refresh() } else this._say(r.error); return }
      case 'toggle': return this._transport('toggle')
      case 'rec': svc.setRecording(!svc.recording); return this._sync(true)
      case 'undo': svc.undo(this.nodeId); return this._sync(true)
      case 'redo': svc.redo(this.nodeId); return this._sync(true)
      case 'add': { const type = this.host.querySelector('[data-ref=addtype]')?.value || 'audio'; this._edit('add-strip', (m) => X.addStrip(m, { source: { type, id: '' } })); return }
      case 'remove': this._edit('remove-strip', (m) => X.removeStrip(m, id)); return
      case 'mute': this._edit('mute', (m) => X.updateStrip(m, id, { mute: !X.stripById(m, id).mute })); return
      case 'solo': this._edit('solo', (m) => X.toggleSolo(m, id, e.shiftKey === false)); return
      case 'loop': this._edit('loop', (m) => X.updateStrip(m, id, { loop: !X.stripById(m, id).loop })); return
      case 'sync': this._edit('sync', (m) => X.updateStrip(m, id, { sync: !X.stripById(m, id).sync })); return
      case 'assign': this._edit('assign', (m) => X.updateStrip(m, id, { assign: b.dataset.v })); return
      case 'left': case 'right': this._edit('move', (m) => X.moveStrip(m, id, m.strips.findIndex(s => s.id === id) + (act === 'left' ? -1 : 1))); return
      case 'limiter': this._edit('limiter', (m) => X.setMaster(m, { limiter: !m.master.limiter })); return
      case 'xfadeB': this._edit('xfade', (m) => X.crossfadeTransition(m, 1, this._startT(), this._secs())); return
      case 'xfadeA': this._edit('xfade', (m) => X.crossfadeTransition(m, -1, this._startT(), this._secs())); return
      case 'fadeout': case 'fadein': case 'sweep': {
        const sid = this.host.querySelector('[data-ref=djstrip]')?.value; if (!sid) return this._say('Add a strip first.')
        const t = this._startT(); const d = this._secs()
        this._edit(act, (m) => act === 'fadeout' ? X.fadeStrip(m, sid, 0, t, d) : act === 'fadein' ? X.fadeStrip(m, sid, 1, t, d) : X.filterSweep(m, sid, 0.15, t, d)); return
      }
      case 'deck': { const r = svc.deck(this.nodeId, id, b.dataset.a, b.dataset.a === 'hot' && e.shiftKey ? null : b.dataset.v ?? null); if (b.dataset.a === 'hot' && e.shiftKey) svc.deck(this.nodeId, id, 'hotclear', b.dataset.v); if (r && r.ok === false) this._say(r.error || 'That did not work.'); else if (b.dataset.a === 'tap' && r && r.taps < 3) this._say('Keep tapping the beat (' + r.taps + ' of 3).'); else this._sync(true); return }
      case 'hotclearall': this._edit('hot-cue', (m) => [0, 1, 2, 3].reduce((mm, i) => X.setHotCue(mm, id, i, null), m)); return
      case 'clearlane': this._edit('clear-lane', (m) => X.clearAuto(m, b.dataset.v)); return
      case 'clearall': this._edit('clear-auto', (m) => X.clearAuto(m)); return
      default:
    }
  }

  _waveClick (e) {
    const box = e.target?.closest?.('[data-wave]'); if (!box || !this.host.contains(box)) return
    const svc = this.svc; const id = box.dataset.wave; const d = svc?.getDeck?.(id); if (!d || !(d.dur > 0)) return
    const r = box.getBoundingClientRect(); if (!(r.width > 0)) return
    svc.jumpDeck?.(this.nodeId, id, Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * d.dur)
  }

  _input (e) {
    const el = e.target; const svc = this.svc; if (!svc || !this.nodeId) return
    if (el.dataset?.t) { svc.setParam(this.nodeId, el.dataset.t, Number(el.value)); return }
    const act = el.dataset?.act
    if (act === 'pitch') { svc.deck(this.nodeId, this._stripId(el), 'pitch', Number(el.value)); return }
    if (act === 'revmix') this._edit('master', (m) => X.setMaster(m, { reverbMix: Number(el.value) }), 'revmix')
    else if (act === 'delmix') this._edit('master', (m) => X.setMaster(m, { delayMix: Number(el.value) }), 'delmix')
  }

  _change (e) {
    const el = e.target; const act = el.dataset?.act; const id = this._stripId(el); const svc = this.svc; if (!svc) return
    switch (act) {
      case 'pick': this.setNode(el.value); return
      case 'name': this._edit('rename', (m) => X.setName(m, el.value)); return
      case 'bpm': this._edit('bpm', (m) => X.setBpm(m, Number(el.value))); return
      case 'sname': this._edit('strip-name', (m) => X.updateStrip(m, id, { name: el.value })); return
      case 'stype': this._edit('strip-type', (m) => X.updateStrip(m, id, { source: { type: el.value, id: '' } })); return
      case 'ssrc': {
        const m0 = this._mix(); const s = m0 && X.stripById(m0, id)
        this._edit('strip-source', (m) => X.updateStrip(m, id, { source: { type: s?.source.type ?? 'audio', id: el.value }, ...(s && /^Strip \d+$/.test(s.name) && el.value ? { name: el.options[el.selectedIndex].textContent.replace(/^\(missing\) /, '').slice(0, 32) } : {}) })); return
      }
      case 'sbpm': this._edit('strip-bpm', (m) => X.updateStrip(m, id, { bpm: el.value === '' ? 0 : Number(el.value) })); return
      case 'curve': this._edit('curve', (m) => X.setCross(m, { curve: el.value })); return
      default:
    }
  }
}
