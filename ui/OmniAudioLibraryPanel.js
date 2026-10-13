/**
 * ui/OmniAudioLibraryPanel.js (V198) — ⟐OmniAudioLibrary: the sound files you imported (class-A window; resize + maximize from utils/OmniWindowChrome.js via WindowManager.register).
 * Import with the button (several files) or by dropping files on the window (while it is open the whole screen accepts a drop). Each row: name, length, format guess,
 * size, date, a waveform (2D canvas drawn from AudioAssets.getPeaks), preview play / stop, rename, delete (asks first; says how many songs use it).
 * The storage meter shows used / limit and whether the files are kept after the page closes (persistent) or only until you close it (private mode / blocked storage).
 * The files themselves are in IndexedDB (utils/OmniAudioAssets.js); songs reference them by id. Nothing sounds until you press a preview button: the preview makes its OWN
 * AudioContext in that click (never the sound engine's) and closes it again when the preview stops, the window closes or another preview starts.
 * Opened by the nav item '⟐OmniAudioLibrary' (ribbon Home > Tools "Audio library", OmniStarLight). Reusable chooser for other panels: ui/OmniAudioPicker.js openAudioPicker({onPick}).
 */

import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { AudioAssets, EVENT } from '../utils/OmniAudioAssets.js'
import { fmtDuration, fmtBytes, fmtDate, importFilesNotify } from './OmniAudioPicker.js'

export const PANEL_ID = 'omniaudiolibrary'
export const NAV_ITEM = '⟐OmniAudioLibrary'
const PEAK_POINTS = 512

let usageProvider = () => []
/** Tell the panel where to find the nodes (fn returns an array of node data objects, e.g. omniNode.getAllNodes()). Used to count the songs that use a file. */
export function setUsageProvider (fn) { usageProvider = typeof fn === 'function' ? fn : () => [] }

/** How many song nodes have an audio clip that references `id`. Defensive: any malformed node is skipped. Pure apart from the provider call. */
export function countSongUsage (id, nodes) {
  let n = 0
  try {
    for (const d of (nodes ?? usageProvider()) || []) {
      const clips = d && d.song && Array.isArray(d.song.clips) ? d.song.clips : null
      if (!clips) continue
      if (clips.some(c => c && c.ref && c.ref.type === 'audio' && c.ref.id === id)) n++
    }
  } catch (_) { /* ignore */ }
  return n
}

const STYLES = `
.oss-panel.oal-panel { width: 560px; height: 520px; max-width: calc(100vw - 16px); }
.oal-panel .oss-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.oal-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.oal-meter { flex: 1 1 200px; min-width: 150px; }
.oal-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,.1); overflow: hidden; }
.oal-bar > i { display: block; height: 100%; background: #62c4ff; width: 0; }
.oal-bar.is-high > i { background: #ffb02e; }
.oal-meter .t { margin-top: 3px; font-size: 10px; color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); }
.oal-warn { padding: 6px 8px; border-radius: 6px; background: rgba(255,176,46,.18); border: 1px solid rgba(255,176,46,.6); font-size: 10px; line-height: 1.4; }
.oal-errs { display: flex; flex-direction: column; gap: 4px; max-height: 76px; overflow-y: auto; flex: 0 0 auto; }
.oal-errs:empty { display: none; }
.oal-clear { align-self: flex-end; min-height: 22px; padding: 0 8px; font-size: 10px; }
.oal-err { display: flex; gap: 6px; align-items: flex-start; padding: 5px 8px; border-radius: 6px; font-size: 10px; line-height: 1.4; background: rgba(255,90,90,.16); border: 1px solid rgba(255,120,120,.55); }
.oal-err.is-ok { background: rgba(143,227,162,.14); border-color: rgba(143,227,162,.55); }
.oal-err span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.oal-err button { min-height: 22px; padding: 0 6px; font: inherit; color: inherit; background: transparent; border: 0; cursor: pointer; }
.oal-list { flex: 1 1 auto; min-height: 90px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.oal-row { padding: 7px 8px; border-radius: 8px; background: rgba(255,255,255,.05); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); }
.oal-row.is-playing { border-color: #62c4ff; }
.oal-line { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.oal-name { flex: 1 1 140px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oal-name-in { flex: 1 1 140px; min-width: 0; }
.oal-sub { font-size: 10px; color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); margin: 2px 0 4px; }
.oal-wave { display: block; width: 100%; height: 40px; border-radius: 4px; background: rgba(0,0,0,.28); cursor: pointer; touch-action: none; }
.oal-empty { padding: 26px 12px; text-align: center; line-height: 1.6; color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); border: 1px dashed var(--omni-theme-border, rgba(255,255,255,.25)); border-radius: 10px; }
.oal-confirm { margin-top: 5px; padding: 6px 8px; border-radius: 6px; background: rgba(255,90,90,.18); border: 1px solid rgba(255,120,120,.6); font-size: 11px; }
.oal-confirm .oss-row { margin: 5px 0 0; }
.oal-drop { position: fixed; inset: 0; z-index: 89000; display: none; align-items: center; justify-content: center; background: rgba(8,16,24,.72); color: #fff; font: 15px 'Courier New', monospace; text-align: center; pointer-events: auto; border: 3px dashed #62c4ff; box-sizing: border-box; }
.oal-drop.is-on { display: flex; }
@media (max-width: ${PHONE_MAX}px) {
  .oss-panel.oal-panel.oal-panel { max-height: 72vh; height: 72vh; }
  .oal-row .oss-btn { min-width: 44px; }
}
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oal-panel-styles')) return
  const s = document.createElement('style'); s.id = 'oal-panel-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const tip = (el, name, key, desc) => { el.setAttribute('data-omni-tip', name); el.setAttribute('data-omni-tip-key', key); el.setAttribute('data-omni-tip-desc', desc); return el }
const mkBtn = (text, cls, name, key, desc) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'oss-btn' + (cls ? ' ' + cls : ''); b.textContent = text; return tip(b, name, key, desc) }

/** Draw min/max pairs (utils/OmniAudioAssets.js getPeaks) on a 2D canvas, with an optional playhead 0..1. Pure drawing; exported for tests. */
export function drawWave (canvas, peaks, playhead = -1) {
  if (!canvas || !canvas.getContext) return
  const dpr = Math.max(1, Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1))
  const cw = canvas.clientWidth || canvas.width || 300, ch = canvas.clientHeight || canvas.height || 40
  const W = Math.max(1, Math.round(cw * dpr)), H = Math.max(1, Math.round(ch * dpr))
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H
  const g = canvas.getContext('2d'); if (!g) return
  g.clearRect(0, 0, W, H)
  const mid = H / 2
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, Math.floor(mid), W, Math.max(1, dpr))
  if (peaks && peaks.length >= 2) {
    const n = Math.floor(peaks.length / 2)
    g.fillStyle = '#62c4ff'
    for (let x = 0; x < W; x++) {
      const i = Math.min(n - 1, Math.floor(x * n / W))
      const mn = peaks[2 * i], mx = peaks[2 * i + 1]
      const y0 = mid - Math.max(0, mx) * (mid - 1), y1 = mid - Math.min(0, mn) * (mid - 1)
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0))
    }
  }
  if (playhead >= 0 && playhead <= 1) { g.fillStyle = '#fff'; g.fillRect(Math.round(playhead * (W - 1)), 0, Math.max(1, dpr), H) }
}

export default class OmniAudioLibraryPanel extends OmniSettingsPanelBase {
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐Audio', navItems: [NAV_ITEM], className: 'oal-panel', wide: true })
    this._assets = opts.assets || AudioAssets
    this._items = []; this._peaks = new Map(); this._errs = []
    this._rows = new Map(); this._preview = null; this._drop = null; this._onChanged = null; this._refreshT = null; this._renaming = null; this._confirm = null
    this._winDrag = null
  }
  onInit () { injectStyles() }
  buildBody (body) {
    const top = document.createElement('div'); top.className = 'oal-top'
    this._importBtn = mkBtn('Import audio', '', 'Import audio', '—', 'Choose one or more sound files (WAV, MP3, OGG, M4A, FLAC ... whatever your browser can play). You can also drop files on this window.')
    this._input = document.createElement('input'); this._input.type = 'file'; this._input.multiple = true; this._input.hidden = true
    this._input.accept = 'audio/*,.wav,.mp3,.ogg,.oga,.opus,.m4a,.aac,.flac,.weba,.aif,.aiff'
    this._importBtn.addEventListener('click', () => this._input.click())
    this._input.addEventListener('change', () => { const f = Array.from(this._input.files || []); this._input.value = ''; if (f.length) this.importFiles(f) })
    const meter = document.createElement('div'); meter.className = 'oal-meter'
    this._bar = document.createElement('div'); this._bar.className = 'oal-bar'; this._bar.innerHTML = '<i></i>'
    this._meterT = document.createElement('div'); this._meterT.className = 't'
    meter.append(this._bar, this._meterT)
    top.append(this._importBtn, meter, this._input)
    this._warn = document.createElement('div'); this._warn.className = 'oal-warn'; this._warn.hidden = true
    this._errsEl = document.createElement('div'); this._errsEl.className = 'oal-errs'
    this._listEl = document.createElement('div'); this._listEl.className = 'oal-list'
    body.append(top, this._warn, this._errsEl, this._listEl)
    // the body also takes drops directly (the window-level overlay covers the rest of the screen)
    body.addEventListener('dragover', (e) => { if (this._hasFiles(e)) e.preventDefault() })
    body.addEventListener('drop', (e) => this._onDrop(e))
  }
  onOpened () {
    this._bindGlobal()
    this.reload()
  }
  close () {
    this.stopPreview()
    this._unbindGlobal()
    super.close()
  }
  onDestroy () { this.stopPreview(); this._unbindGlobal(); if (this._refreshT) clearTimeout(this._refreshT) }

  // ── window-level drop zone + library changes (only while open) ─────────────
  _hasFiles (e) { return !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files') }
  _bindGlobal () {
    if (this._winDrag) return
    if (!this._drop) {
      this._drop = document.createElement('div'); this._drop.className = 'oal-drop'; this._drop.dataset.role = 'drop'
      this._drop.textContent = 'Drop sound files to add them to the audio library'
      this._drop.addEventListener('dragover', (e) => { if (this._hasFiles(e)) e.preventDefault() })
      this._drop.addEventListener('dragleave', (e) => { if (e.target === this._drop) this._drop.classList.remove('is-on') })
      this._drop.addEventListener('drop', (e) => this._onDrop(e))
      ;(document.getElementById('omni-ui') || document.body).appendChild(this._drop)
    }
    const enter = (e) => { if (this._isOpen && this._hasFiles(e)) this._drop.classList.add('is-on') }
    const end = () => this._drop && this._drop.classList.remove('is-on')
    const over = (e) => { if (this._isOpen && this._hasFiles(e)) e.preventDefault() }
    window.addEventListener('dragenter', enter); window.addEventListener('dragover', over); window.addEventListener('dragend', end); window.addEventListener('drop', end)
    this._onChanged = () => { clearTimeout(this._refreshT); this._refreshT = setTimeout(() => { this._refreshT = null; if (this._isOpen) this.reload() }, 30) }
    window.addEventListener(EVENT, this._onChanged)
    this._winDrag = { enter, end, over }
  }
  _unbindGlobal () {
    const w = this._winDrag; if (!w) return
    window.removeEventListener('dragenter', w.enter); window.removeEventListener('dragover', w.over); window.removeEventListener('dragend', w.end); window.removeEventListener('drop', w.end)
    window.removeEventListener(EVENT, this._onChanged)
    this._winDrag = null
    if (this._drop) { this._drop.remove(); this._drop = null }
  }
  _onDrop (e) {
    if (!this._hasFiles(e)) return
    e.preventDefault(); e.stopPropagation()
    this._drop && this._drop.classList.remove('is-on')
    const f = Array.from(e.dataTransfer.files || [])
    if (f.length) this.importFiles(f)
  }

  // ── import ─────────────────────────────────────────────────────────────────
  /** Import files (File[]), show each result in the error list and as a toast. Resolves the per-file results. */
  async importFiles (files) {
    const out = await importFilesNotify(files, { assets: this._assets })
    for (const { file, res } of out) {
      const nm = (file && file.name) || 'file'
      this._errs.push(res.ok ? { ok: true, text: `Added "${res.meta.name}" (${fmtDuration(res.meta.duration)}).` } : { ok: false, text: res.error?.message || res.message || `"${nm}" could not be imported.` })
    }
    this._errs = this._errs.slice(-12)
    await this.reload()
    return out
  }

  // ── list / render ──────────────────────────────────────────────────────────
  async reload () {
    if (!this._el) return
    const [items, use] = await Promise.all([this._assets.list(), this._assets.usage()])
    this._items = items.slice().reverse()   // newest first
    this._usage = use
    if (this._preview && !items.some(m => m.id === this._preview.id)) this.stopPreview()
    this._renderMeter(); this._renderErrs(); this._renderList()
    for (const m of this._items) this._loadPeaks(m.id)
  }
  refresh () { if (this._el && this._isOpen) this.reload() }
  _renderMeter () {
    const u = this._usage || { bytes: 0, limitBytes: 1, persistent: true, count: 0 }
    const f = Math.min(1, u.bytes / (u.limitBytes || 1))
    this._bar.firstChild.style.width = (u.bytes > 0 ? Math.max(1, f * 100) : 0).toFixed(1) + '%'
    this._bar.classList.toggle('is-high', f > 0.85)
    this._meterT.textContent = `${fmtBytes(u.bytes)} of ${fmtBytes(u.limitBytes)} used · ${u.count} file${u.count === 1 ? '' : 's'} · max ${fmtBytes(u.fileLimitBytes || 0)} each · ${u.persistent ? 'saved in this browser' : 'NOT saved (memory only)'}`
    this._warn.hidden = u.persistent !== false
    if (u.persistent === false) this._warn.textContent = 'Private mode or blocked storage: these files only live until you close this tab. Open the app in a normal window to keep them.' + (u.reason ? ` (${u.reason})` : '')
  }
  _renderErrs () {
    this._errsEl.textContent = ''
    if (this._errs.length > 1) {
      const c = mkBtn('Clear messages', 'oal-clear', 'Clear messages', '—', 'Hide all the import result lines.'); c.dataset.act = 'clear-msgs'
      c.addEventListener('click', () => { this._errs = []; this._renderErrs() })
      this._errsEl.appendChild(c)
    }
    this._errs.forEach((e, i) => {
      const d = document.createElement('div'); d.className = 'oal-err' + (e.ok ? ' is-ok' : ''); d.dataset.role = e.ok ? 'result-ok' : 'result-error'
      const s = document.createElement('span'); s.textContent = e.text
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Dismiss')
      tip(x, 'Dismiss', '—', 'Hide this message.')
      x.addEventListener('click', () => { this._errs.splice(i, 1); this._renderErrs() })
      d.append(s, x); this._errsEl.appendChild(d)
    })
  }
  _renderList () {
    this._listEl.textContent = ''; this._rows.clear()
    if (!this._items.length) {
      const d = document.createElement('div'); d.className = 'oal-empty'; d.dataset.role = 'empty'
      d.innerHTML = 'No audio yet.<br>Press <b>Import audio</b> or drop sound files here (WAV, MP3, OGG, M4A ... the browser decides what it can open).'
      this._listEl.appendChild(d); return
    }
    for (const m of this._items) this._listEl.appendChild(this._row(m))
  }
  _row (m) {
    const row = document.createElement('div'); row.className = 'oal-row'; row.dataset.id = m.id
    if (this._preview && this._preview.id === m.id) row.classList.add('is-playing')
    const line = document.createElement('div'); line.className = 'oal-line'
    const play = mkBtn(this._preview && this._preview.id === m.id ? '■' : '▶', '', 'Preview', 'click', 'Plays this file so you can hear it. Click again to stop.'); play.dataset.act = 'play'
    play.setAttribute('aria-label', 'Preview ' + m.name)
    play.addEventListener('click', () => this.togglePreview(m.id))
    line.appendChild(play)
    if (this._renaming === m.id) {
      const inp = document.createElement('input'); inp.className = 'oss-input oal-name-in'; inp.value = m.name; inp.maxLength = 60; inp.dataset.role = 'rename-input'
      tip(inp, 'Rename', 'Enter', 'Type a new name; Enter saves, Esc cancels.')
      const commit = async () => { const v = inp.value; this._renaming = null; await this._assets.rename(m.id, v); await this.reload() }
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') { e.stopPropagation(); this._renaming = null; this._renderList() } })
      inp.addEventListener('blur', () => { if (this._renaming === m.id) commit() })
      line.appendChild(inp)
      setTimeout(() => { try { inp.focus(); inp.select() } catch (_) { /* ignore */ } }, 0)
    } else {
      const nm = document.createElement('span'); nm.className = 'oal-name'; nm.textContent = m.name; nm.title = m.name; nm.dataset.role = 'name'
      line.appendChild(nm)
    }
    const ren = mkBtn('Rename', '', 'Rename', '—', 'Change this file\'s name. Songs keep using it (they point to it by id, not by name).'); ren.dataset.act = 'rename'
    ren.addEventListener('click', () => { this._renaming = m.id; this._renderList() })
    const del = mkBtn('Delete', '', 'Delete', '—', 'Remove this file from the library. Asks first.'); del.dataset.act = 'delete'
    del.addEventListener('click', () => { this._confirm = this._confirm === m.id ? null : m.id; this._renderList() })
    line.append(ren, del)
    const sub = document.createElement('div'); sub.className = 'oal-sub'; sub.dataset.role = 'sub'
    const uses = countSongUsage(m.id)
    sub.textContent = `${fmtDuration(m.duration)} · ${String(m.format || '?').toUpperCase()} · ${m.channels === 1 ? 'mono' : m.channels === 2 ? 'stereo' : m.channels + ' ch'}${m.sampleRate ? ' · ' + Math.round(m.sampleRate / 100) / 10 + ' kHz' : ''} · ${fmtBytes(m.bytes)} · ${fmtDate(m.addedAt)}${uses ? ` · used in ${uses} song${uses === 1 ? '' : 's'}` : ''}`
    const cv = document.createElement('canvas'); cv.className = 'oal-wave'; cv.dataset.role = 'wave'
    tip(cv, 'Waveform', 'click', 'The shape of the sound. Click to preview from that point.')
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); const x = r.width ? (e.clientX - r.left) / r.width : 0; this.togglePreview(m.id, Math.max(0, Math.min(0.999, x)), true) })
    row.append(line, sub, cv)
    if (this._confirm === m.id) {
      const c = document.createElement('div'); c.className = 'oal-confirm'; c.dataset.role = 'confirm'
      c.textContent = uses ? `Delete "${m.name}"? ${uses} song${uses === 1 ? ' uses' : 's use'} it: ${uses === 1 ? 'its clips' : 'their clips'} will show as missing.` : `Delete "${m.name}"? This cannot be undone.`
      const r = document.createElement('div'); r.className = 'oss-row'
      const yes = mkBtn('Delete it', 'is-danger', 'Confirm delete', '—', 'Permanently removes this file from the library.'); yes.dataset.act = 'delete-yes'
      const no = mkBtn('Keep it', '', 'Cancel', 'Esc', 'Keep the file.'); no.dataset.act = 'delete-no'
      yes.addEventListener('click', async () => { this._confirm = null; if (this._preview && this._preview.id === m.id) this.stopPreview(); await this._assets.remove(m.id); await this.reload() })
      no.addEventListener('click', () => { this._confirm = null; this._renderList() })
      r.append(yes, no); c.appendChild(r); row.appendChild(c)
      setTimeout(() => { try { c.scrollIntoView({ block: 'nearest' }) } catch (_) { /* ignore */ } }, 0)
    }
    this._rows.set(m.id, { row, cv, play })
    const pk = this._peaks.get(m.id); if (pk) drawWave(cv, pk, this._playhead(m.id))
    return row
  }
  async _loadPeaks (id) {
    if (this._peaks.has(id)) { const r = this._rows.get(id); if (r) drawWave(r.cv, this._peaks.get(id), this._playhead(id)); return }
    const pk = await this._assets.getPeaks(id, PEAK_POINTS)
    if (!pk) return
    this._peaks.set(id, pk)
    const r = this._rows.get(id); if (r) drawWave(r.cv, pk, this._playhead(id))
  }
  _playhead (id) {
    const p = this._preview; if (!p || p.id !== id || !p.ctx || !p.dur) return -1
    return Math.max(0, Math.min(1, (p.ctx.currentTime - p.t0 + p.from) / p.dur))
  }

  // ── preview (own AudioContext, created inside the user's click) ────────────
  get previewing () { return this._preview ? this._preview.id : null }
  /** The preview's analyser (tests / meters) or null. */
  get previewAnalyser () { return this._preview ? this._preview.an : null }
  async togglePreview (id, fraction = 0, forceStart = false) {
    if (this._preview && this._preview.id === id && !forceStart) { this.stopPreview(); return }
    this.stopPreview()
    const meta = this._items.find(m => m.id === id) || await this._assets.getMeta(id)
    if (!meta) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) { this._errs.push({ ok: false, text: 'This browser has no Web Audio, so previews cannot play.' }); this._renderErrs(); return }
    let ctx
    try { ctx = new AC(); const r = ctx.resume && ctx.resume(); r && r.catch && r.catch(() => {}) } catch (e) { this._errs.push({ ok: false, text: 'The browser would not start audio: ' + (e?.message || e) }); this._renderErrs(); return }
    const gain = ctx.createGain(); gain.gain.value = 0.8
    const an = ctx.createAnalyser(); an.fftSize = 1024
    gain.connect(an); an.connect(ctx.destination)
    const from = Math.max(0, Math.min(1, fraction)) * (meta.duration || 0)
    const st = { id, ctx, gain, an, h: null, dur: meta.duration || 0, from, t0: ctx.currentTime, raf: 0 }
    this._preview = st
    const h = this._assets.playClip(ctx, id, { when: ctx.currentTime + 0.03, offset: from, gain: 1, fadeIn: 0.01, fadeOut: 0.03, dest: gain })
    st.h = h
    // the first frame can arrive late (decode); the playhead restarts when the clip actually starts
    st.t0 = ctx.currentTime
    h.done.then(() => { if (this._preview === st) this.stopPreview() })
    this._renderPlayState()
    const tick = () => {
      if (this._preview !== st) return
      const r = this._rows.get(id); const pk = this._peaks.get(id)
      if (r && pk) drawWave(r.cv, pk, this._playhead(id))
      st.raf = (window.requestAnimationFrame || ((f) => setTimeout(f, 50)))(tick)
    }
    tick()
  }
  stopPreview () {
    const st = this._preview; if (!st) return
    this._preview = null
    try { if (st.raf && window.cancelAnimationFrame) window.cancelAnimationFrame(st.raf) } catch (_) { /* ignore */ }
    try { st.h && st.h.stop() } catch (_) { /* ignore */ }
    setTimeout(() => { try { st.ctx.close && st.ctx.close() } catch (_) { /* ignore */ } }, 120)
    this._renderPlayState()
    const r = this._rows.get(st.id); const pk = this._peaks.get(st.id); if (r && pk) drawWave(r.cv, pk, -1)
  }
  _renderPlayState () {
    for (const [id, r] of this._rows) {
      const on = !!this._preview && this._preview.id === id
      r.play.textContent = on ? '■' : '▶'; r.row.classList.toggle('is-playing', on)
    }
  }
}
