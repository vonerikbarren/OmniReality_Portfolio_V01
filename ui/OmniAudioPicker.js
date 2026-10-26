/**
 * ui/OmniAudioPicker.js (V198) — a small modal list of the audio library, for other panels (the song panel's "add audio clip").
 *
 *   import { openAudioPicker } from './OmniAudioPicker.js'
 *   const h = openAudioPicker({ onPick: (meta) => { ... }, onClose, title, importLabel, pickAfterImport: true })
 *   h.close()   // optional; Esc, the backdrop and the Close button also close it
 *
 * onPick(meta) gets the asset meta {id, name, duration, sampleRate, channels, bytes, addedAt, format} and the picker closes.
 * The picker has an "Import audio" button (several files at once; the first file that imports is picked when pickAfterImport is true, the default),
 * and accepts dropped files. Import results are announced through omni:notify-info. One picker at a time (opening a second closes the first).
 * Also exported for the audio library window: fmtDuration, fmtBytes, fmtDate, importFilesNotify (import + per-file toast + a summary).
 * No audio is started here (no AudioContext); the picker only reads the library through utils/OmniAudioAssets.js.
 */

import { AudioAssets, EVENT } from '../utils/OmniAudioAssets.js'

export const fmtDuration = (s) => {
  s = Number(s); if (!Number.isFinite(s) || s < 0) return '0:00'
  if (s < 10) return s.toFixed(1) + ' s'
  const m = Math.floor(s / 60), r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}
export const fmtBytes = (b) => { b = Number(b) || 0; return b >= 1048576 ? (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B' }
export const fmtDate = (t) => { try { return new Date(t).toISOString().slice(0, 10) } catch (_) { return '' } }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const notify = (name, desc, holdMs = 4200) => { try { window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name, desc, holdMs } })) } catch (_) { /* no window */ } }

/** Import files one after another, announce each result (max 4 toasts, then one summary). Resolves [{file, res}]. Never throws. */
export async function importFilesNotify (files, { assets = AudioAssets, onResult } = {}) {
  const list = Array.from(files || []).filter(Boolean)
  const out = []
  let okN = 0, failN = 0, toasts = 0
  for (const f of list) {
    let res
    try { res = await assets.importFile(f) } catch (e) { res = { ok: false, error: { code: 'storage', message: String(e?.message || e) }, message: String(e?.message || e) } }
    out.push({ file: f, res })
    if (res.ok) okN++; else failN++
    if (toasts < 4) { toasts++; notify(res.ok ? 'Audio added' : 'Audio not added', res.ok ? `"${res.meta.name}" · ${fmtDuration(res.meta.duration)}` : (res.error?.message || res.message || 'Could not import this file.')) }
    try { onResult && onResult(f, res) } catch (_) { /* ignore */ }
  }
  if (list.length > 4) notify('Audio library', `${okN} added, ${failN} not added (${list.length} files).`)
  return out
}

const STYLES = `
.oap-back { position: fixed; inset: 0; z-index: 90000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); pointer-events: auto; }
.oap { width: min(460px, calc(100vw - 24px)); max-height: min(560px, calc(100vh - 80px)); display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
  background: var(--omni-theme-bg, rgba(8,8,12,.97)); color: var(--omni-theme-text, rgba(255,255,255,.93)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); border-radius: 12px;
  font-family: 'Courier New', Courier, monospace; font-size: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.6); }
.oap-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); }
.oap-head b { flex: 1; font-weight: normal; letter-spacing: .06em; }
.oap-list { flex: 1 1 auto; min-height: 80px; overflow-y: auto; padding: 6px; }
.oap-item { display: flex; align-items: center; gap: 8px; width: 100%; box-sizing: border-box; min-height: 44px; padding: 6px 10px; margin: 0 0 4px; text-align: left; font: inherit; color: inherit; cursor: pointer;
  background: rgba(255,255,255,.06); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 8px; }
.oap-item:hover, .oap-item:focus-visible { background: rgba(255,255,255,.16); outline: none; }
.oap-item .n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oap-item .d { color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); white-space: nowrap; font-size: 10px; }
.oap-empty { padding: 18px 10px; text-align: center; color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); line-height: 1.5; }
.oap-foot { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-top: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); flex-wrap: wrap; }
.oap-foot .msg { flex: 1; min-width: 100px; color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); font-size: 10px; }
.oap-btn { min-height: 36px; padding: 2px 12px; font: inherit; color: inherit; cursor: pointer; border-radius: 6px; background: rgba(255,255,255,.08); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); }
.oap-btn:hover { background: rgba(255,255,255,.2); }
.oap-back.is-drop .oap { outline: 2px dashed #8fe3a2; }
@media (max-width: 700px) { .oap-back { align-items: flex-end; } .oap { width: 100vw; max-height: 80vh; border-radius: 14px 14px 0 0; } .oap-item { min-height: 48px; } }
`
let current = null

export function openAudioPicker (opts = {}) {
  const o = { onPick: null, onClose: null, title: 'Choose audio', importLabel: 'Import audio', pickAfterImport: true, assets: AudioAssets, ...opts }
  if (typeof document === 'undefined') return { close () {}, el: null }
  if (current) current.close()
  if (!document.getElementById('oap-styles')) { const s = document.createElement('style'); s.id = 'oap-styles'; s.textContent = STYLES; document.head.appendChild(s) }
  const back = document.createElement('div'); back.className = 'oap-back'; back.dataset.omniAudioPicker = '1'
  back.innerHTML = `<div class="oap" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
    <div class="oap-head"><b>${esc(o.title)}</b><button type="button" class="oap-btn" data-act="close" aria-label="Close" data-omni-tip="Close" data-omni-tip-key="Esc" data-omni-tip-desc="Close the audio picker without choosing.">×</button></div>
    <div class="oap-list" data-role="list"></div>
    <div class="oap-foot"><button type="button" class="oap-btn" data-act="import" data-omni-tip="Import audio" data-omni-tip-key="—" data-omni-tip-desc="Pick one or more sound files (WAV, MP3, OGG, M4A and others your browser can play). They are stored in this browser."></button><span class="msg" data-role="msg">Drop sound files here, or use Import.</span></div>
    <input type="file" multiple accept="audio/*,.wav,.mp3,.ogg,.oga,.opus,.m4a,.aac,.flac,.weba,.aif,.aiff" hidden data-role="file"></div>`
  back.querySelector('[data-act="import"]').textContent = o.importLabel
  const list = back.querySelector('[data-role="list"]'), msg = back.querySelector('[data-role="msg"]'), input = back.querySelector('[data-role="file"]')
  let closed = false
  const close = () => {
    if (closed) return; closed = true
    window.removeEventListener('keydown', onKey, true); window.removeEventListener(EVENT, onChanged)
    back.remove(); if (current === handle) current = null
    try { o.onClose && o.onClose() } catch (_) { /* ignore */ }
  }
  const pick = (meta) => { try { o.onPick && o.onPick(meta) } finally { close() } }
  const render = async () => {
    const items = (await o.assets.list()).slice().reverse()
    if (closed) return
    list.textContent = ''
    if (!items.length) { const d = document.createElement('div'); d.className = 'oap-empty'; d.textContent = 'The audio library is empty. Import a sound file to use it here.'; list.appendChild(d); return }
    for (const m of items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'oap-item'; b.dataset.id = m.id
      b.setAttribute('data-omni-tip', m.name); b.setAttribute('data-omni-tip-key', 'click'); b.setAttribute('data-omni-tip-desc', `Use "${m.name}" (${fmtDuration(m.duration)}).`)
      b.innerHTML = `<span class="n">${esc(m.name)}</span><span class="d">${esc(fmtDuration(m.duration))} · ${esc(String(m.format || '').toUpperCase())} · ${esc(fmtBytes(m.bytes))}</span>`
      b.addEventListener('click', () => pick(m)); list.appendChild(b)
    }
  }
  const onChanged = () => { render() }
  const doImport = async (files) => {
    msg.textContent = 'Importing…'
    const res = await importFilesNotify(files, { assets: o.assets })
    const good = res.filter(r => r.res.ok), bad = res.filter(r => !r.res.ok)
    msg.textContent = bad.length ? bad[0].res.error?.message || 'Could not import this file.' : `${good.length} added.`
    if (o.pickAfterImport && good.length && !closed) pick(good[0].res.meta)
    else await render()
  }
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close() } }
  back.querySelector('[data-act="close"]').addEventListener('click', close)
  back.addEventListener('mousedown', (e) => { if (e.target === back) close() })
  back.querySelector('[data-act="import"]').addEventListener('click', () => input.click())
  input.addEventListener('change', () => { const f = Array.from(input.files || []); input.value = ''; if (f.length) doImport(f) })
  const hasFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')
  back.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); back.classList.add('is-drop') } })
  back.addEventListener('dragleave', (e) => { if (e.target === back) back.classList.remove('is-drop') })
  back.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); back.classList.remove('is-drop'); const f = Array.from(e.dataTransfer.files || []); if (f.length) doImport(f) })
  window.addEventListener('keydown', onKey, true); window.addEventListener(EVENT, onChanged)
  const shell = document.getElementById('omni-ui') || document.body
  shell.appendChild(back)
  const handle = { close, el: back, refresh: render, input }
  current = handle
  render()
  return handle
}
export default openAudioPicker
