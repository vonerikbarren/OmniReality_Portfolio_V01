/**
 * ui/OmniSongView.js — the song TIMELINE EDITOR of a SongNode (V198): the content of the ⟐OmniSong window and of the 'song' quadrant.
 *
 * 2D DOM + <canvas> only (no WebGL context). Layout (desktop):
 *   toolbar     transport (rewind / play-pause / stop), loop + region, position (bar.beat and mm:ss), bpm, time signature, key, zoom, snap, undo / redo, split, duplicate
 *   ruler       sections band (click: add / edit a section), marker flags, bar numbers; click = seek (drag scrubs), Shift-drag = loop region, right click / long press = menu
 *   tempo track click adds a tempo point, drag moves it (the first point is the base bpm), double click / right click / Delete removes one
 *   lanes       LANE HEADERS ARE THE MIXER: colour, name, volume fader, pan / reverb / delay knobs, mute, solo, level meter, automation, delete. The lane's clips are blocks:
 *               drag = move (snaps, across lanes of the same kind), drag an edge = resize, a pattern clip shows a mini preview of its MusicNode, an audio clip its waveform
 *   automation  per lane: volume / pan / filter / reverb send / delay send; click adds a point, drag moves it, right click / Delete removes it
 *   clip bar    the selected clip: name, start, length, repeat, gain, transpose (pattern) / fades (audio), split, duplicate, delete, Make unique, Open in sequencer
 *   library     the scene's MusicNodes and the imported audio (drag onto a lane, or Add); Import audio / drop files on the window
 *   master      gain, limiter (on, threshold), reverb size / mix, delay time / feedback / mix, master meter
 * PHONE (<= 700 px) and the compact quadrant: a simplified VERTICAL lane view (a card per lane with a thin clip strip; tap a lane to open its mixer controls).
 * Everything is read and written through systems/OmniSongNodes.js (Extra.SERVICES.song): every edit is ONE immutable model op = one undo step (a drag is one), applied live
 * through SongPlayer.update and saved after 300 ms. The playhead / meters follow SongPlayer.getPosition / getLevels from a <= 30 fps timer that runs only while the view is
 * visible AND the song plays. Clips outside the viewport are not in the DOM. Keyboard shortcuts work only while the view has focus.
 * User-facing: imports no Dev* module. Audio assets are loaded defensively (the editor opens without them).
 */

import * as SM from '../utils/OmniSongModel.js'
import * as MM from '../utils/OmniMusicModel.js'
import { SERVICES, KIND_SONG } from '../utils/OmniExtraKinds.js'
import { esc, tip } from './OmniSoundFields.js'
import * as D from './OmniSongDraw.js'

export const NAV_ITEM = '⟐OmniSong'
export const PREF_KEY = 'omni:song-panel-v1'
const SEQ_NAV = '⟐OmniSequencer'
export const HW = 236                // lane header width (desktop)
export const LANE_H = 82
const LONG_MS = 450
const BAR_MIN = 6
const BAR_MAX = 320
const SNAPS = [['0.25', '1/4 bar'], ['0.5', '1/2 bar'], ['1', '1 bar']]
const KEYS = ['C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'Eb', 'Ebm', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'Ab', 'Abm', 'A', 'Am', 'Bb', 'Bbm', 'B', 'Bm']
const ERRORS = {
  unsupported: 'This file is not audio the browser can open. Try a WAV, MP3, OGG or M4A file.',
  'too-large': 'That file is too big (the limit is 40 MB per file).',
  quota: 'There is no room left in the audio storage. Remove an audio file in the audio library first.',
  decode: 'The file could not be decoded. It may be damaged.',
}
const T = (name, desc, key = '—') => tip(name, key, desc)
const clamp = D.clamp
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

export const STYLES = `
.osg { position: relative; font-size: 11px; outline: none; }
.osg .osg-row2 { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px 0; }
.osg .osg-notice { padding: 8px; margin: 6px 0; border: 1px dashed var(--omni-theme-border, rgba(255,255,255,.35)); border-radius: 8px; line-height: 1.45; }
.osg .osg-who { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 2px 0 4px; }
.osg .osg-who b { color: var(--omni-theme-accent, #7ad7f0); }
.osg .osg-st { margin-left: auto; font-size: 10px; opacity: .85; } .osg .osg-st.is-live { color: #8cffb4; opacity: 1; }
.osg button, .osg input, .osg select { font: inherit; color: inherit; box-sizing: border-box; }
.osg .osg-btn, .osg .osg-in, .osg .osg-sel { min-height: 26px; padding: 2px 7px; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); }
.osg .osg-btn { cursor: pointer; } .osg .osg-btn:hover:not(:disabled) { background: rgba(255,255,255,.17); } .osg .osg-btn:disabled { opacity: .38; cursor: default; }
.osg .osg-btn.is-on { background: rgba(122,215,240,.3); border-color: rgba(122,215,240,.85); }
.osg .osg-btn.is-danger { background: rgba(255,90,90,.2); border-color: rgba(255,120,120,.6); }
.osg .osg-sel option { color: #111; background: #fff; }
.osg .osg-in { width: 54px; } .osg .osg-in.is-wide { width: 120px; } .osg .osg-in.is-name { width: 110px; }
.osg .osg-tb { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin: 4px 0; padding: 4px; border-radius: 8px; background: rgba(255,255,255,.04); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.12)); }
.osg .osg-sep { width: 1px; align-self: stretch; background: var(--omni-theme-border, rgba(255,255,255,.18)); margin: 0 2px; }
.osg .osg-pos { font-variant-numeric: tabular-nums; min-width: 92px; text-align: center; padding: 3px 6px; border-radius: 6px; background: rgba(0,0,0,.35); letter-spacing: .04em; }
.osg .osg-lab { display: inline-flex; gap: 3px; align-items: center; opacity: .95; } .osg .osg-lab > span { opacity: .65; font-size: 9.5px; }
.osg .osg-clipbar { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin: 4px 0; padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(122,215,240,.5); background: rgba(122,215,240,.06); }
.osg .osg-clipbar[hidden] { display: none; }
.osg .osg-main { display: flex; gap: 6px; align-items: stretch; min-height: 0; }
.osg .osg-scroll { flex: 1 1 auto; min-width: 0; position: relative; overflow: auto; max-height: min(58vh, 560px); min-height: 150px; border-radius: 8px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); background: rgba(0,0,0,.25); -webkit-overflow-scrolling: touch; }
.osg .osg-content { position: relative; width: var(--tw, 2400px); min-width: 100%; }
.osg .osg-row { display: flex; width: var(--tw, 2400px); min-width: 100%; border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.1)); }
.osg .osg-hd { flex: 0 0 ${HW}px; width: ${HW}px; position: sticky; left: 0; z-index: 6; box-sizing: border-box; padding: 4px 6px; background: var(--omni-theme-bg, rgba(14,15,20,.98)); border-right: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); display: flex; flex-direction: column; justify-content: center; gap: 4px; }
.osg .osg-track { position: relative; flex: 0 0 var(--tpx, 2000px); width: var(--tpx, 2000px); }
.osg .osg-rulerrow { position: sticky; top: 0; z-index: 8; background: var(--omni-theme-bg, rgba(14,15,20,.98)); }
.osg .osg-rulerrow .osg-hd { z-index: 9; }
.osg canvas.osg-cv { display: block; position: sticky; left: ${HW}px; touch-action: none; cursor: crosshair; }
.osg .osg-lane .osg-track { height: ${LANE_H}px; background-image: linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: var(--bar, 56px) 100%, var(--beat, 14px) 100%; touch-action: pan-x pan-y; }
.osg .osg-lane.is-sel .osg-hd { box-shadow: inset 3px 0 0 var(--lc, #7ad7f0); }
.osg .osg-lane.is-drop .osg-track { outline: 2px dashed rgba(122,215,240,.9); outline-offset: -2px; }
.osg .osg-lane { height: ${LANE_H}px; } .osg .osg-lane .osg-hd { height: ${LANE_H}px; }
.osg .osg-auto { height: ${D.AUTO_H}px; } .osg .osg-auto .osg-hd { height: ${D.AUTO_H}px; }
.osg .osg-tempo { height: ${D.TEMPO_H}px; } .osg .osg-tempo .osg-hd { height: ${D.TEMPO_H}px; }
.osg .osg-h1, .osg .osg-h2 { display: flex; gap: 4px; align-items: center; min-width: 0; }
.osg .osg-sw { width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: none; flex: 0 0 20px; cursor: pointer; }
.osg .osg-name { flex: 1 1 40px; min-width: 0; min-height: 22px; padding: 1px 4px; border-radius: 4px; background: rgba(255,255,255,.06); border: 1px solid transparent; }
.osg .osg-name:focus { border-color: var(--omni-theme-accent, #7ad7f0); outline: none; }
.osg .osg-ms { width: 22px; min-height: 22px; padding: 0; text-align: center; border-radius: 4px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); cursor: pointer; flex: 0 0 22px; }
.osg .osg-ms.is-mute.is-on { background: rgba(255,200,80,.45); border-color: #ffc850; } .osg .osg-ms.is-solo.is-on { background: rgba(120,200,255,.45); border-color: #78c8ff; } .osg .osg-ms.is-auto.is-on { background: rgba(180,240,138,.4); border-color: #b4f08a; }
.osg .osg-fader { flex: 1 1 50px; min-width: 40px; min-height: 18px; accent-color: var(--lc, #7ad7f0); }
.osg .osg-knob { position: relative; flex: 0 0 24px; width: 24px; height: 24px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.28), rgba(255,255,255,.06)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.35)); touch-action: none; cursor: ns-resize; outline: none; }
.osg .osg-knob:focus-visible { box-shadow: 0 0 0 2px var(--omni-theme-accent, #7ad7f0); }
.osg .osg-knob::after { content: ''; position: absolute; left: 50%; top: 2px; width: 2px; height: 9px; margin-left: -1px; border-radius: 1px; background: var(--lc, #7ad7f0); transform-origin: 50% 10px; transform: rotate(var(--ang, 0deg)); }
.osg .osg-kl { font-size: 8.5px; opacity: .7; position: absolute; left: 0; right: 0; bottom: -10px; text-align: center; pointer-events: none; }
.osg .osg-kw { position: relative; flex: 0 0 26px; margin-bottom: 8px; }
.osg .osg-meter { flex: 0 0 34px; height: 8px; border-radius: 3px; background: rgba(255,255,255,.1); overflow: hidden; }
.osg .osg-meter > i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #5be37a, #f3e45a 70%, #ff6b6b); transform-origin: 0 50%; transform: scaleX(0); will-change: transform; }
.osg .osg-clip { position: absolute; top: 4px; height: ${LANE_H - 8}px; box-sizing: border-box; border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--cc, #7ad7f0) 38%, rgba(10,12,18,.9)); border: 1px solid var(--cc, #7ad7f0); cursor: grab; touch-action: none; user-select: none; }
.osg .osg-clip.is-sel { box-shadow: 0 0 0 2px #fff, 0 0 10px var(--cc, #7ad7f0); z-index: 3; }
.osg .osg-clip.is-missing { background: repeating-linear-gradient(45deg, rgba(255,90,90,.25), rgba(255,90,90,.25) 6px, rgba(0,0,0,.4) 6px, rgba(0,0,0,.4) 12px); border-color: #ff7b7b; }
.osg .osg-clip .osg-ccv { position: absolute; left: 0; right: 0; bottom: 0; top: 16px; width: 100%; height: calc(100% - 16px); pointer-events: none; }
.osg .osg-cname { position: absolute; left: 4px; top: 1px; right: 4px; font-size: 10px; line-height: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; text-shadow: 0 1px 2px #000; }
.osg .osg-grip { position: absolute; top: 0; bottom: 0; width: 8px; cursor: ew-resize; } .osg .osg-grip.is-l { left: 0; } .osg .osg-grip.is-r { right: 0; }
.osg .osg-playhead { position: absolute; top: 0; bottom: 0; left: ${HW}px; width: 2px; background: #ffb86b; box-shadow: 0 0 6px #ffb86b; pointer-events: none; z-index: 7; will-change: transform; }
.osg .osg-loopreg { position: absolute; top: ${D.RULER.h}px; bottom: 0; left: ${HW}px; background: rgba(255,184,107,.07); border-left: 1px solid rgba(255,184,107,.5); border-right: 1px solid rgba(255,184,107,.5); pointer-events: none; z-index: 2; display: none; }
.osg .osg-addrow { min-height: 40px; } .osg .osg-addrow .osg-hd { flex-direction: row; flex-wrap: wrap; align-items: center; }
.osg .osg-hint { padding: 10px; opacity: .6; font-size: 10px; line-height: 1.5; }
.osg .osg-lib { flex: 0 0 188px; width: 188px; max-height: min(58vh, 560px); overflow-y: auto; border-radius: 8px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); background: rgba(0,0,0,.2); padding: 4px 6px; box-sizing: border-box; }
.osg .osg-lib[hidden] { display: none; }
.osg .osg-h { margin: 8px 0 3px; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; opacity: .7; display: flex; gap: 4px; align-items: center; }
.osg .osg-h .osg-btn { margin-left: auto; min-height: 22px; padding: 0 6px; font-size: 10px; text-transform: none; letter-spacing: 0; }
.osg .osg-item { display: flex; gap: 4px; align-items: center; padding: 3px; margin: 2px 0; border-radius: 6px; background: rgba(255,255,255,.05); border: 1px solid transparent; cursor: grab; }
.osg .osg-item:hover { border-color: var(--omni-theme-border, rgba(255,255,255,.3)); }
.osg .osg-item .osg-iname { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.osg .osg-item small { opacity: .6; font-size: 9px; }
.osg .osg-item .osg-btn { min-height: 22px; padding: 0 5px; font-size: 10px; }
.osg .osg-item canvas { width: 40px; height: 14px; flex: 0 0 40px; border-radius: 3px; background: rgba(0,0,0,.35); }
.osg .osg-master { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 6px 0; padding: 5px 6px; border-radius: 8px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); background: rgba(255,255,255,.04); }
.osg .osg-master[hidden] { display: none; } .osg .osg-master .osg-lab input[type=range] { width: 64px; }
.osg .osg-master .osg-meter { flex-basis: 70px; height: 10px; }
.osg .osg-msg { min-height: 14px; margin-top: 4px; } .osg .osg-msg.is-err { color: #ff8a8a; } .osg .osg-msg.is-ok { color: #8fe3a2; }
.osg .osg-menu, .osg .osg-pop { position: absolute; z-index: 30; min-width: 150px; max-width: 260px; padding: 4px; border-radius: 8px; background: var(--omni-theme-bg, rgba(14,15,20,.98)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.3)); box-shadow: 0 6px 20px rgba(0,0,0,.55); display: flex; flex-direction: column; gap: 3px; }
.osg .osg-menu button { text-align: left; min-height: 28px; padding: 2px 8px; border-radius: 5px; background: none; border: 0; cursor: pointer; } .osg .osg-menu button:hover { background: rgba(255,255,255,.14); }
.osg .osg-swatches { display: flex; gap: 4px; flex-wrap: wrap; } .osg .osg-swatches button { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(255,255,255,.5); cursor: pointer; padding: 0; }
.osg.is-drop-files .osg-scroll { outline: 2px dashed #7ad7f0; outline-offset: -3px; }
.osg.is-simple .osg-main { flex-direction: column; } .osg.is-simple .osg-lib { flex: 0 0 auto; width: auto; max-height: 220px; }
.osg .osg-card { margin: 5px 0; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.16)); border-radius: 10px; background: rgba(255,255,255,.04); overflow: hidden; }
.osg .osg-card.is-sel { border-color: var(--lc, #7ad7f0); }
.osg .osg-card-h { display: flex; gap: 6px; align-items: center; padding: 4px 6px; cursor: pointer; }
.osg .osg-card-h .osg-cn { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.osg .osg-card-h .osg-sw { flex: 0 0 12px; width: 12px; height: 12px; border-radius: 50%; pointer-events: none; }
.osg .osg-strip { position: relative; height: 34px; margin: 2px 6px 6px; border-radius: 6px; background: rgba(0,0,0,.35); touch-action: pan-y; overflow: hidden; }
.osg .osg-sclip { position: absolute; top: 3px; bottom: 3px; min-width: 4px; border-radius: 4px; background: var(--cc, #7ad7f0); opacity: .75; border: 1px solid transparent; }
.osg .osg-sclip.is-sel { opacity: 1; border-color: #fff; }
.osg .osg-sclip.is-missing { background: repeating-linear-gradient(45deg, #ff7b7b, #ff7b7b 4px, #552 4px, #552 8px); }
.osg .osg-shead { position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: #ffb86b; pointer-events: none; will-change: transform; }
.osg .osg-card-b { padding: 4px 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.osg .osg-card-b .osg-lab { display: flex; } .osg .osg-card-b .osg-lab > span { width: 52px; } .osg .osg-card-b input[type=range] { flex: 1 1 auto; min-height: 28px; } .osg input[type=range] { accent-color: var(--osg-acc, #5fd0e8); }
.osg .osg-secs { display: flex; gap: 3px; flex-wrap: wrap; margin: 4px 0; } .osg .osg-secs .osg-btn { min-height: 22px; padding: 0 6px; font-size: 10px; color: #0b0d12; border-color: transparent; }
@media (max-width: 700px) { .osg .osg-btn, .osg .osg-in, .osg .osg-sel { min-height: 40px; } .osg .osg-ms { width: 40px; min-height: 36px; flex-basis: 40px; } .osg .osg-pos { min-width: 80px; } }
`
let styled = false
export function injectSongStyles () {
  if (typeof document === 'undefined') return
  if (styled && document.getElementById('osg-styles')) return
  styled = true
  const s = document.createElement('style'); s.id = 'osg-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

// ── audio assets (defensive) ───────────────────────────────────────────────────

let AA
async function loadAssets (inject) {
  if (inject) return inject
  if (AA !== undefined) return AA
  try {
    const m = await import('../utils/OmniAudioAssets.js')
    AA = [m.AudioAssets, m.default, m].find(x => x && typeof x.list === 'function') ?? null
  } catch (_) { AA = null }
  return AA
}

function loadPrefs () {
  const d = { barPx: 56, snap: 0.25, lib: true, master: false, follow: true }
  try {
    const o = JSON.parse(localStorage.getItem(PREF_KEY) || 'null')
    if (o && typeof o === 'object') return { barPx: clamp(num(o.barPx, d.barPx), BAR_MIN, BAR_MAX), snap: [0.25, 0.5, 1].includes(o.snap) ? o.snap : d.snap, lib: o.lib !== false, master: !!o.master, follow: o.follow !== false }
  } catch (_) { /* no storage */ }
  return d
}
function savePrefs (p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch (_) { /* no storage */ } }

const svcOf = (v) => v.opts.svc ?? SERVICES.song
const musicSvc = (v) => v.opts.music ?? SERVICES.music
const diffNew = (before, after) => { const ids = new Set((before ?? []).map(x => x.id)); return (after ?? []).filter(x => !ids.has(x.id)) }
/** the song with lengthBars grown so that every clip fits (max 256) */
function fitLength (s) {
  let end = 1
  for (const c of s.clips) end = Math.max(end, c.startBar + c.lengthBars)
  const need = Math.ceil(end - 1)
  return need > s.lengthBars ? { ...s, lengthBars: Math.min(256, need) } : s
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export default class OmniSongView {
  /** @param host an element to fill. @param opts { svc?, music?, assets?, player?, compact?, nodeId?, active?():bool } (svc / music default to Extra.SERVICES). */
  constructor (host, opts = {}) {
    this.host = host
    this.opts = opts
    this.compact = !!opts.compact
    this.nodeId = opts.nodeId ?? null
    const p = loadPrefs(); this.prefs = p
    this.barPx = p.barPx; this.snap = p.snap
    this.simple = false
    this.r = null
    this._sig = null
    this._selClip = null; this._selLane = null
    this._autoOpen = new Map()      // lane id | 'master' -> param
    this._expanded = new Set()      // simple mode: lane cards open
    this._clipEls = new Map()       // clip id -> { el, sig, dsig, lane }
    this._tracks = new Map()        // lane id -> track element
    this._laneRows = []
    this._peaks = new Map()         // asset id -> Float32Array | null | 'pending'
    this._assetList = []
    this._assetsLoaded = false
    this._musicVer = new WeakMap(); this._verN = 0
    this._cursor = 1
    this._drag = null; this._pop = null; this._menu = null
    this._touches = new Map(); this._pinch = null
    this._bound = []; this._timer = 0; this._lastMeter = 0
    this._rq = 0; this._pending = new Map()
    this._dead = false; this._built = false
    this._lastPos = ''; this._lastHead = -1
    this._tempoSel = -1; this._autoSel = null; this._tempoDraft = null; this._autoDraft = null
    this._th = null; this._thT = 0
    this._msg = { text: '', err: false }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  mount () {
    injectSongStyles()
    if (this._built) return this
    this._built = true
    this.host.classList.add('osg'); this.host.tabIndex = 0
    this.host.innerHTML = '<div data-ref="top"></div><div data-ref="main"></div><div data-ref="msg" class="osg-msg" role="status" aria-live="polite"></div>'
    const h = this.host
    this._listen(h, 'click', (e) => this._click(e))
    this._listen(h, 'input', (e) => this._input(e))
    this._listen(h, 'change', (e) => this._change(e))
    this._listen(h, 'pointerdown', (e) => this._down(e))
    this._listen(h, 'keydown', (e) => this._key(e))
    this._listen(h, 'contextmenu', (e) => this._ctx(e))
    this._listen(h, 'dblclick', (e) => this._dbl(e))
    this._listen(h, 'dragstart', (e) => this._dragStart(e))
    this._listen(h, 'dragover', (e) => this._dragOver(e))
    this._listen(h, 'dragleave', (e) => this._dragLeave(e))
    this._listen(h, 'drop', (e) => this._drop(e))
    const on = (name, fn) => { const f = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, f); this._bound.push([window, name, f]) }
    const wl = (t, name, fn, o) => { t.addEventListener(name, fn, o); this._bound.push([t, name, fn, o]) }
    on('omni:song-changed', (d) => { if (d.nodeId === this.nodeId) this._later('sync', () => this._sync()) })
    on('omni:song-transport', () => this._later('transport', () => this._onTransport()))
    on('omni:node-selected', (d) => { const id = d.node?.id; if (id && d.node?.nodeKind === KIND_SONG && id !== this.nodeId) { this._setNode(id); this._later('refresh', () => this.refresh()) } })
    on('omni:node-deleted', (d) => { if (d.id === this.nodeId) { this._setNode(null); this._later('refresh', () => this.refresh()) } else this._later('who', () => { this._syncWho(); this._syncLib(); this._syncClips(this._song()) }) })
    on('omni:node-created', () => this._later('who', () => { this._syncWho(); this._syncLib() }))
    on('omni:music-data-changed', () => this._later('libdata', () => { this._syncLib(); this._syncClips(this._song(), true) }))
    on('omni:audio-assets-changed', () => this._later('assets', () => this._loadAssetList()))
    wl(window, 'pointermove', (e) => this._move(e)); wl(window, 'pointerup', (e) => this._up(e)); wl(window, 'pointercancel', (e) => this._up(e))
    wl(window, 'resize', () => this._later('resize', () => this.onResize()))
    try { if (typeof ResizeObserver === 'function') { this._ro = new ResizeObserver(() => this._later('resize', () => this.onResize())); this._ro.observe(this.host) } } catch (_) { /* no observer */ }
    wl(document, 'visibilitychange', () => this._syncTimer())
    this._loadAssetList()
    this.refresh()
    return this
  }

  destroy () {
    this._dead = true
    this._bound.forEach(([t, n, f, o]) => { try { t.removeEventListener(n, f, o) } catch (_) { /* gone */ } }); this._bound = []
    this._stopTimer()
    try { this._ro?.disconnect() } catch (_) { /* gone */ } this._ro = null
    clearTimeout(this._drag?.timer); this._drag = null
    if (this._rq && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._rq)
    this._rq = 0; this._pending.clear()
    this._clipEls.clear(); this._tracks.clear(); this._touches.clear()
    this.r = null
    if (this.host) { this.host.innerHTML = ''; this.host.classList.remove('osg', 'is-simple', 'is-drop-files'); this.host.removeAttribute('tabindex') }
  }

  _listen (t, name, fn) { t.addEventListener(name, fn); this._bound.push([t, name, fn]) }
  _active () { try { return !this._dead && (this.opts.active ? !!this.opts.active() : this.host.isConnected) && !(typeof document !== 'undefined' && document.hidden) } catch (_) { return false } }

  /** Run `fn` on the next animation frame; calls with the same key in one frame run once (the last one). */
  _later (key, fn) {
    if (this._dead || (this.opts.active && !this.opts.active())) return   // a closed window does no work; it refreshes when it opens
    this._pending.set(key, fn)
    if (this._rq) return
    const run = () => {
      this._rq = 0
      const todo = [...this._pending.values()]; this._pending.clear()
      if (!this._dead) for (const f of todo) { try { f() } catch (err) { console.warn('OmniSongView', err) } }
    }
    if (typeof requestAnimationFrame === 'function') this._rq = requestAnimationFrame(run); else run()
  }

  /** Called when the host is shown / resized. */
  onResize () {
    if (this._dead || !this._built) return
    const simple = this.compact || (typeof window !== 'undefined' && window.innerWidth <= 700)
    if (simple !== this.simple && this._song()) { this.refresh(); return }
    this._applyZoom(); this._drawAll()
  }
  /** Called when the window opens. */
  onOpened () { this.refresh(); this._syncTimer() }
  setNode (id) { this._setNode(id ?? null); if (this._built) this.refresh() }
  say (text, err = false) { this._msg = { text, err }; const m = this.host?.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'osg-msg ' + (err ? 'is-err' : 'is-ok') } }

  _setNode (id) {
    if (id === this.nodeId) return
    this.nodeId = id; this._selClip = null; this._selLane = null; this._autoOpen.clear(); this._expanded.clear(); this._sig = null; this._cursor = 1; this._tempoSel = -1; this._autoSel = null
    this._closePop(); this._closeMenu()
  }

  // ── Data access ─────────────────────────────────────────────────────────────

  get svc () { return svcOf(this) }
  get player () { return this.opts.player ?? this.svc?.player ?? null }
  _song () { try { return this.nodeId ? this.svc?.getSong(this.nodeId) ?? null : null } catch (_) { return null } }
  _clip (s = this._song()) { return s && this._selClip ? s.clips.find(c => c.id === this._selClip) ?? null : null }
  _lane (id, s = this._song()) { return s?.lanes.find(l => l.id === id) ?? null }
  _label (id) { try { return this.svc?.getNodeData(id)?.label ?? id } catch (_) { return id } }
  /** run one edit; shows the error when it fails. fn(song) -> song. */
  _e (reason, fn, coalesce = null) {
    const svc = this.svc; if (!svc || !this.nodeId) { this.say('The song system is not running.', true); return { ok: false } }
    const r = svc.edit(this.nodeId, reason, fn, coalesce)
    if (!r.ok) this.say(r.error || 'That did not work.', true)
    return r
  }
  _music (id) {
    try { const m = musicSvc(this)?.getMusic(id); if (m) return m } catch (_) { /* no music runtime */ }
    try { const d = this.svc?.getNodeData(id); if (d?.nodeKind === 'musicNode' && d.music) return MM.sanitizeMusic(d.music) } catch (_) { /* ignore */ }
    return null
  }
  _musicIds () { try { return this.svc?.listMusicNodes() ?? [] } catch (_) { return [] } }
  _patBars (m) { try { const v = typeof MM.patternLengthBars === 'function' ? MM.patternLengthBars(m) : null; if (Number.isFinite(v) && v > 0) return v } catch (_) { /* fall back */ } return Math.max(0.25, MM.barCount ? MM.barCount(m) : (m?.bars ?? 1)) }
  _ver (obj) { if (!obj || typeof obj !== 'object') return 0; let v = this._musicVer.get(obj); if (!v) { v = ++this._verN; this._musicVer.set(obj, v) } return v }
  _asset (id) { return this._assetList.find(a => a.id === id) ?? null }
  _theme () {
    const t = nowMs()
    if (this._th && t - this._thT < 1500) return this._th
    let cs = null; try { cs = getComputedStyle(this.host) } catch (_) { /* ignore */ }
    const g = (n, d) => (cs && cs.getPropertyValue(n).trim()) || d
    const text = g('--omni-theme-text', '#e8eaf0')
    this._th = { text, dim: 'rgba(200,205,220,0.6)', line: 'rgba(255,255,255,0.28)', line2: 'rgba(255,255,255,0.08)', accent: g('--omni-theme-accent', '#7ad7f0'), bg: 'rgba(12,14,20,0.96)', bg2: 'rgba(0,0,0,0.25)' }
    this._thT = t
    return this._th
  }

  // ── Render: skeleton ────────────────────────────────────────────────────────

  refresh () {
    if (this._dead || !this._built) return
    const top = this.host.querySelector('[data-ref="top"]'); const main = this.host.querySelector('[data-ref="main"]')
    if (!top || !main) return
    this._closePop(); this._closeMenu()
    this._stopTimer()
    this.simple = this.compact || (typeof window !== 'undefined' && window.innerWidth <= 700)
    this.host.classList.toggle('is-simple', this.simple)
    const svc = this.svc
    if (!svc) { top.innerHTML = '<div class="osg-notice" data-testid="osg-nosvc">The song system is not running.</div>'; main.innerHTML = ''; this.r = null; return }
    if (this.nodeId && !svc.isSongNode(this.nodeId)) this._setNode(null)
    if (!this.nodeId && svc.selectedId && svc.isSongNode(svc.selectedId)) this._setNode(svc.selectedId)   // the window follows the selected song node (also when it was selected before the window was built)
    const s = this._song()
    if (!s) { this._renderEmpty(top, main); return }
    top.innerHTML = `<div class="osg-who" data-testid="osg-who">⟐ <select class="osg-sel" data-f="node" aria-label="Song node" ${T('Song node', 'Which song node you are editing. Selecting a song node in the scene switches to it.')}></select>
      <input class="osg-in is-wide" data-f="title" maxlength="80" aria-label="Song title" ${T('Song title', 'The title of the song (saved with the node).')}>
      <button type="button" class="osg-btn" data-act="create" ${T('New song node', 'Creates another song node in front of the camera.')}>＋</button>
      <span class="osg-st" data-ref="state"></span></div>`
    main.innerHTML = this.simple ? this._skeletonSimple() : this._skeletonDesk()
    this._mapRefs()
    this._sig = null; this._clipEls.clear(); this._tracks.clear()
    this._lastPos = ''; this._lastHead = -1
    this._applyZoom()
    this._buildToolbar(s)
    this._syncWho(); this._syncLib(true)
    this._sync()
    this._syncTimer()
  }

  _renderEmpty (top, main) {
    this.r = null
    const ids = this.svc.listSongNodes()
    const list = ids.length ? `<div class="osg-row2" data-testid="osg-existing">${ids.map(id => `<button type="button" class="osg-btn" data-act="pick" data-id="${esc(id)}" ${T('Edit this song', 'Edit the song of this node.')}>⟐ ${esc(this._label(id))}</button>`).join('')}</div>` : ''
    top.innerHTML = `<div class="osg-notice" data-testid="osg-nonode">No song node is selected. Select a song node to arrange its music on a timeline, or create one.</div>
      <div class="osg-row2"><button type="button" class="osg-btn is-on" data-act="create" ${T('Create a song node', 'Creates a SongNode in front of the camera: a timeline of lanes with clips, a mixer, sections, tempo changes and automation. It is selected and opens here.')}>＋ Create a song node</button>
      <button type="button" class="osg-btn" data-act="createDemo" ${T('Create a demo song', 'Creates a SongNode with a small example arrangement that uses the music nodes of the scene.')}>＋ Demo song</button></div>${list}`
    main.innerHTML = ''
    this.host.querySelector('[data-ref="msg"]').textContent = this._msg.text || ''
  }

  _toolbarHTML () {
    const sn = SNAPS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')
    const keys = KEYS.map(k => `<option value="${k}">${k}</option>`).join('')
    const b = (act, label, name, desc, extra = '') => `<button type="button" class="osg-btn" data-act="${act}" ${extra} ${T(name, desc)}>${label}</button>`
    return `
      ${b('rewind', '⏮', 'Rewind', 'Moves the playhead to the start of the song.')}
      ${b('play', '▶', 'Play / Pause', 'Plays the song from the playhead, or pauses it. Space does the same while this window has focus.', 'data-ref="playbtn"')}
      ${b('stop', '■', 'Stop', 'Stops the song and returns to the start.')}
      ${b('loop', '⟳ Loop', 'Loop', 'On: the loop region repeats. Shift-drag on the ruler sets the region.', 'data-ref="loopbtn" aria-pressed="false"')}
      <span class="osg-lab"><span>from</span><input class="osg-in" type="number" step="1" min="1" data-f="loopStart" aria-label="Loop start bar" ${T('Loop start', 'The bar where the loop region starts.')}><span>to</span><input class="osg-in" type="number" step="1" min="2" data-f="loopEnd" aria-label="Loop end bar" ${T('Loop end', 'The bar where the loop region ends.')}></span>
      <span class="osg-sep"></span>
      <span class="osg-pos" data-ref="pos" role="timer" aria-label="Position" ${T('Position', 'The playhead: bar.beat and minutes:seconds.')}>1.1  00:00.0</span>
      <span class="osg-sep"></span>
      <span class="osg-lab"><span>bpm</span><input class="osg-in" type="number" min="60" max="240" step="1" data-f="bpm" aria-label="Tempo" ${T('Tempo', 'The base speed in beats per minute (60 to 240). Tempo changes along the song are points on the tempo track.')}></span>
      <span class="osg-lab"><span>sig</span><input class="osg-in" type="number" min="1" max="16" step="1" data-f="sigN" aria-label="Beats per bar" ${T('Beats per bar', 'The top number of the time signature.')}><span>/</span><select class="osg-sel" data-f="sigD" aria-label="Beat unit" ${T('Beat unit', 'The bottom number of the time signature.')}><option>2</option><option>4</option><option>8</option><option>16</option></select></span>
      <span class="osg-lab"><span>key</span><select class="osg-sel" data-f="key" aria-label="Key" ${T('Key', 'The key of the song (a label for you; it is saved with the song).')}>${keys}</select></span>
      <span class="osg-sep"></span>
      ${b('zoomOut', '−', 'Zoom out', 'Shows more bars. Ctrl + mouse wheel or a two-finger pinch also zoom.')}${b('zoomIn', '＋', 'Zoom in', 'Shows fewer bars, wider.')}${b('fit', 'Fit', 'Fit', 'Zooms so the whole song fits the window.')}
      <span class="osg-lab"><span>snap</span><select class="osg-sel" data-f="snap" aria-label="Snap grid" ${T('Snap grid', 'Clips, sections and points snap to this grid when you drag them.')}>${sn}</select></span>
      <span class="osg-sep"></span>
      ${b('undo', '↶', 'Undo', 'Takes back the last change (Ctrl/Cmd+Z). Up to 100 steps.')}${b('redo', '↷', 'Redo', 'Brings back an undone change (Ctrl/Cmd+Shift+Z).')}
      ${b('split', '✂', 'Split', 'Cuts the selected clip at the playhead (S).')}${b('dup', '⎘', 'Duplicate', 'Copies the selected clip right after itself (Ctrl/Cmd+D).')}
      ${b('marker', '⚑', 'Add marker', 'Puts a marker flag on the ruler at the playhead.')}
      <span class="osg-sep"></span>
      ${b('togLib', '☰ Library', 'Clip library', 'Shows or hides the list of patterns and audio you can put on the lanes.', 'aria-pressed="true" data-ref="libbtn"')}${b('togMaster', '🎚 Master', 'Master strip', 'Shows or hides the master controls: gain, limiter, reverb, delay.', 'aria-pressed="false" data-ref="masterbtn"')}`
  }
  _skeletonDesk () {
    return `<div class="osg-tb" data-ref="tb"></div><div class="osg-clipbar" data-ref="clipbar" hidden></div>
      <div class="osg-main"><div class="osg-scroll" data-ref="scroll"><div class="osg-content" data-ref="content">
        <div class="osg-row osg-rulerrow"><div class="osg-hd"><span class="osg-dim" style="opacity:.7">Bars</span></div><div class="osg-track" data-ref="rtrack"><canvas class="osg-cv" data-ref="ruler" data-cv="ruler" height="${D.RULER.h}" aria-label="Ruler" ${T('Ruler', 'Click to move the playhead. Click the top band to add or edit a section, the flag row to edit a marker. Shift-drag sets the loop region.')}></canvas></div></div>
        <div class="osg-row osg-tempo"><div class="osg-hd"><b>Tempo</b><span style="opacity:.65;font-size:9.5px">click = add a point</span></div><div class="osg-track"><canvas class="osg-cv" data-ref="tempo" data-cv="tempo" height="${D.TEMPO_H}" aria-label="Tempo track" ${T('Tempo track', 'Click to add a tempo point, drag a point to change it, double click it to remove it. The first point is the base bpm.')}></canvas></div></div>
        <div data-ref="lanes"></div>
        <div class="osg-row osg-addrow"><div class="osg-hd"><button type="button" class="osg-btn" data-act="addLane" data-kind="pattern" ${T('Add pattern lane', 'Adds a lane for patterns (music nodes).')}>＋ Pattern lane</button><button type="button" class="osg-btn" data-act="addLane" data-kind="audio" ${T('Add audio lane', 'Adds a lane for audio clips.')}>＋ Audio lane</button></div><div class="osg-track osg-hint" data-ref="hint"></div></div>
        <div class="osg-loopreg" data-ref="loopreg"></div><div class="osg-playhead" data-ref="head"></div>
      </div></div><aside class="osg-lib" data-ref="lib" aria-label="Clip library"></aside></div>
      <div class="osg-master" data-ref="master" hidden></div>`
  }
  _skeletonSimple () {
    return `<div class="osg-tb" data-ref="tb"></div><div class="osg-clipbar" data-ref="clipbar" hidden></div>
      <div class="osg-main"><div data-ref="lanes" class="osg-simple"></div><aside class="osg-lib" data-ref="lib" aria-label="Clip library" hidden></aside></div>
      <div class="osg-master" data-ref="master" hidden></div>`
  }
  _mapRefs () {
    const q = (n) => this.host.querySelector(`[data-ref="${n}"]`)
    this.r = { tb: q('tb'), clipbar: q('clipbar'), scroll: q('scroll'), content: q('content'), lanes: q('lanes'), ruler: q('ruler'), tempo: q('tempo'), head: q('head'), loopreg: q('loopreg'), lib: q('lib'), master: q('master'), hint: q('hint'), state: q('state'), msg: q('msg') }
    if (this.r.scroll) {
      this.r.scroll.addEventListener('scroll', () => this._later('scroll', () => { this._syncClips(this._song()); this._drawAll() }))
      this.r.scroll.addEventListener('wheel', (e) => this._wheel(e), { passive: false })
    }
  }
  _buildToolbar (s) {
    const tb = this.r.tb; if (!tb) return
    if (this.simple) {
      tb.innerHTML = `<button type="button" class="osg-btn" data-act="rewind" ${T('Rewind', 'Moves the playhead to the start of the song.')}>⏮</button>
        <button type="button" class="osg-btn" data-act="play" data-ref="playbtn" ${T('Play / Pause', 'Plays the song from the playhead, or pauses it.')}>▶</button>
        <button type="button" class="osg-btn" data-act="stop" ${T('Stop', 'Stops the song and returns to the start.')}>■</button>
        <button type="button" class="osg-btn" data-act="loop" data-ref="loopbtn" aria-pressed="false" ${T('Loop', 'On: the loop region repeats.')}>⟳</button>
        <span class="osg-pos" data-ref="pos" ${T('Position', 'The playhead: bar.beat and minutes:seconds.')}>1.1  00:00.0</span>
        <span class="osg-lab"><span>bpm</span><input class="osg-in" type="number" min="60" max="240" step="1" data-f="bpm" aria-label="Tempo" ${T('Tempo', 'The base speed in beats per minute (60 to 240).')}></span>
        <button type="button" class="osg-btn" data-act="undo" ${T('Undo', 'Takes back the last change.')}>↶</button><button type="button" class="osg-btn" data-act="redo" ${T('Redo', 'Brings back an undone change.')}>↷</button>
        <button type="button" class="osg-btn" data-act="addLane" data-kind="pattern" ${T('Add pattern lane', 'Adds a lane for patterns.')}>＋ Lane</button>
        <button type="button" class="osg-btn" data-act="addLane" data-kind="audio" ${T('Add audio lane', 'Adds a lane for audio clips.')}>＋ Audio</button>
        <button type="button" class="osg-btn" data-act="togLib" data-ref="libbtn" aria-pressed="false" ${T('Clip library', 'Shows the patterns and audio you can add.')}>☰</button>
        <button type="button" class="osg-btn" data-act="togMaster" data-ref="masterbtn" aria-pressed="false" ${T('Master strip', 'Shows the master controls.')}>🎚</button>`
    } else tb.innerHTML = this._toolbarHTML()
    this.r.playbtn = tb.querySelector('[data-ref="playbtn"]'); this.r.loopbtn = tb.querySelector('[data-ref="loopbtn"]'); this.r.pos = tb.querySelector('[data-ref="pos"]')
    this.r.libbtn = tb.querySelector('[data-ref="libbtn"]'); this.r.masterbtn = tb.querySelector('[data-ref="masterbtn"]')
    this._showLib(this.simple ? false : this.prefs.lib); this._showMaster(this.prefs.master)
  }

  _showLib (on) { this.prefs.lib = this.simple ? this.prefs.lib : !!on; if (this.r?.lib) this.r.lib.hidden = !on; this.r?.libbtn?.setAttribute('aria-pressed', String(!!on)); this.r?.libbtn?.classList.toggle('is-on', !!on); if (on) this._syncLib(true) }
  _showMaster (on) { this.prefs.master = !!on; if (this.r?.master) this.r.master.hidden = !on; this.r?.masterbtn?.setAttribute('aria-pressed', String(!!on)); this.r?.masterbtn?.classList.toggle('is-on', !!on); if (on) this._buildMaster(this._song()) }

  // ── Render: sync (cheap, runs after every change) ───────────────────────────

  _layoutSig (s) {
    const open = [...this._autoOpen].filter(([k]) => k === 'master' || s.lanes.some(l => l.id === k)).map(([k]) => k).join(',')
    const exp = this.simple ? [...this._expanded].filter(k => s.lanes.some(l => l.id === k)).join(',') : ''
    return s.lanes.map(l => l.id + ':' + l.kind).join(',') + '|' + open + '|' + exp + '|' + (this.simple ? 's' : 'd')
  }

  _sync () {
    if (this._dead || !this.r) return
    const s = this._song(); if (!s) { this.refresh(); return }
    const sig = this._layoutSig(s)
    if (sig !== this._sig) { this._sig = sig; this._buildLanes(s) }
    this._applyZoom()
    this._syncHeaders(s); this._syncClips(s); this._syncToolbar(s); this._syncClipbar(s); this._syncMaster(s); this._syncLib()
    this._drawAll(); this._syncProgress(); this._syncWho()
  }

  _applyZoom () {
    const r = this.r; const s = this._song(); if (!r?.content || !s) return
    const tpx = Math.round(s.lengthBars * this.barPx) + 80
    const st = r.content.style
    st.setProperty('--tw', (HW + tpx) + 'px'); st.setProperty('--tpx', tpx + 'px'); st.setProperty('--bar', this.barPx + 'px'); st.setProperty('--beat', (this.barPx / Math.max(1, s.meta.timeSig[0])) + 'px')
  }

  _syncWho () {
    const sel = this.host.querySelector('[data-f="node"]'); const s = this._song(); const svc = this.svc
    if (!sel || !svc || !s) return
    const ids = svc.listSongNodes()
    const sig = ids.join(',') + '|' + ids.map(i => this._label(i)).join(',') + '|' + this.nodeId
    if (sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = ids.map(i => `<option value="${esc(i)}"${i === this.nodeId ? ' selected' : ''}>${esc(this._label(i))}</option>`).join('') }
    sel.value = this.nodeId ?? ''
    const t = this.host.querySelector('[data-f="title"]'); if (t && s && document.activeElement !== t) t.value = s.meta.title
    if (this.r?.state) {
      const pl = svc.isPlaying(this.nodeId)
      this.r.state.textContent = pl ? 'Playing' : `${s.lanes.length} lane${s.lanes.length === 1 ? '' : 's'} · ${s.clips.length} clip${s.clips.length === 1 ? '' : 's'}`
      this.r.state.classList.toggle('is-live', pl)
    }
  }

  _syncToolbar (s) {
    const tb = this.r.tb; if (!tb) return
    const set = (f, v) => { const el = tb.querySelector(`[data-f="${f}"]`); if (el && document.activeElement !== el) el.value = String(v) }
    set('bpm', Math.round(s.bpm)); set('sigN', s.meta.timeSig[0]); set('sigD', s.meta.timeSig[1]); set('key', s.meta.key); set('snap', String(this.snap)); set('loopStart', s.loop.startBar); set('loopEnd', s.loop.endBar)
    const key = tb.querySelector('[data-f="key"]'); if (key && ![...key.options].some(o => o.value === s.meta.key)) { const o = document.createElement('option'); o.value = o.textContent = s.meta.key; key.appendChild(o); key.value = s.meta.key }
    this.r.loopbtn?.classList.toggle('is-on', !!s.loop.on); this.r.loopbtn?.setAttribute('aria-pressed', String(!!s.loop.on))
    const svc = this.svc; const q = (a) => tb.querySelector(`[data-act="${a}"]`)
    if (q('undo')) q('undo').disabled = !svc.canUndo(this.nodeId)
    if (q('redo')) q('redo').disabled = !svc.canRedo(this.nodeId)
    const c = this._clip(s)
    for (const a of ['split', 'dup']) if (q(a)) q(a).disabled = !c
    this._syncPlayBtn()
    const lr = this.r.loopreg
    if (lr) { lr.style.display = s.loop.on ? 'block' : 'none'; lr.style.left = (HW + (s.loop.startBar - 1) * this.barPx) + 'px'; lr.style.width = Math.max(1, (s.loop.endBar - s.loop.startBar) * this.barPx) + 'px' }
    const hint = this.r.hint; if (hint) hint.textContent = s.lanes.length ? '' : 'An empty song. Add a pattern lane, then add a pattern from the library (right) to it: click Add, or drag the pattern onto the lane.'
  }
  _syncPlayBtn () {
    const b = this.r?.playbtn; if (!b) return
    const pl = !!this.svc?.isPlaying(this.nodeId)
    b.textContent = pl ? '⏸' : '▶'; b.classList.toggle('is-on', pl)
  }

  // lanes ------------------------------------------------------------------------------------------------------------

  _el (html) { const t = document.createElement('div'); t.innerHTML = html.trim(); return t.firstElementChild }

  _knobHTML (laneId, key, label, name, desc, min, max, def) {
    return `<span class="osg-kw"><span class="osg-knob" role="slider" tabindex="0" data-kn="${key}" data-lane="${esc(laneId)}" data-min="${min}" data-max="${max}" data-def="${def}" aria-label="${esc(name)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${def}" ${T(name, desc)}></span><span class="osg-kl">${label}</span></span>`
  }

  _laneHTML (l) {
    const id = esc(l.id)
    const ms = `<button type="button" class="osg-ms is-mute" data-act="mute" data-lane="${id}" aria-pressed="false" ${T('Mute', 'Silences this lane.')}>M</button><button type="button" class="osg-ms is-solo" data-act="solo" data-lane="${id}" aria-pressed="false" ${T('Solo', 'Plays only the soloed lanes.')}>S</button>`
    if (this.simple) {
      const open = this._expanded.has(l.id)
      const sends = open ? `<div class="osg-card-b" data-lane="${id}">
        <label class="osg-lab"><span>Name</span><input class="osg-in is-wide" data-lf="name" data-lane="${id}" maxlength="40" aria-label="Lane name" ${T('Lane name', 'The name of this lane.')}></label>
        <label class="osg-lab"><span>Volume</span><input type="range" min="0" max="1.5" step="0.01" data-lf="volume" data-lane="${id}" aria-label="Volume" ${T('Volume', 'The level of this lane (1 = unity).')}></label>
        <label class="osg-lab"><span>Pan</span><input type="range" min="-1" max="1" step="0.01" data-lf="pan" data-lane="${id}" aria-label="Pan" ${T('Pan', 'Left to right position of this lane.')}></label>
        <label class="osg-lab"><span>Reverb</span><input type="range" min="0" max="1" step="0.01" data-lf="reverb" data-lane="${id}" aria-label="Reverb send" ${T('Reverb send', 'How much of this lane goes to the reverb.')}></label>
        <label class="osg-lab"><span>Delay</span><input type="range" min="0" max="1" step="0.01" data-lf="delay" data-lane="${id}" aria-label="Delay send" ${T('Delay send', 'How much of this lane goes to the delay.')}></label>
        <div class="osg-row2"><select class="osg-sel" data-sl="src" data-lane="${id}" aria-label="Clip to add" ${T('Clip to add', 'Pick a pattern or an audio file to add to this lane at the playhead.')}></select>
          <button type="button" class="osg-btn" data-act="addSel" data-lane="${id}" ${T('Add clip', 'Adds the chosen clip to this lane at the playhead.')}>＋ Clip</button>
          <button type="button" class="osg-btn is-danger" data-act="delLane" data-lane="${id}" ${T('Delete lane', 'Deletes this lane and its clips. Undo brings it back.')}>Delete lane</button></div></div>` : ''
      return `<div class="osg-card" data-lane="${id}"><div class="osg-card-h" data-act="expand" data-lane="${id}"><span class="osg-sw"></span><span class="osg-cn" data-ref="cn"></span>${ms}<div class="osg-meter" data-meter="${id}"><i></i></div><span aria-hidden="true">${open ? '▾' : '▸'}</span></div>
        <div class="osg-strip" data-strip="${id}"><i class="osg-shead"></i></div>${sends}</div>`
    }
    return `<div class="osg-row osg-lane" data-lane="${id}" data-kind="${esc(l.kind)}">
      <div class="osg-hd">
        <div class="osg-h1"><input type="color" class="osg-sw" data-lf="color" data-lane="${id}" aria-label="Lane colour" ${T('Lane colour', 'The colour of this lane and its clips.')}>
          <input class="osg-name" data-lf="name" data-lane="${id}" maxlength="40" aria-label="Lane name" ${T('Lane name', 'The name of this lane. Click to rename.')}>
          ${ms}<button type="button" class="osg-ms is-auto" data-act="auto" data-lane="${id}" aria-pressed="false" ${T('Automation', 'Shows the automation curve of this lane: volume, pan, filter or the sends over the song.')}>∿</button><button type="button" class="osg-ms" data-act="delLane" data-lane="${id}" ${T('Delete lane', 'Deletes this lane and its clips. Undo brings it back.')}>×</button></div>
        <div class="osg-h2"><input type="range" class="osg-fader" min="0" max="1.5" step="0.01" data-lf="volume" data-lane="${id}" aria-label="Volume" ${T('Volume', 'The level of this lane (1 = unity).')}>
          ${this._knobHTML(l.id, 'pan', 'pan', 'Pan', 'Left to right position of this lane. Drag up / down, double click to centre.', -1, 1, 0)}${this._knobHTML(l.id, 'reverb', 'rev', 'Reverb send', 'How much of this lane goes to the reverb. Drag up / down.', 0, 1, 0)}${this._knobHTML(l.id, 'delay', 'dly', 'Delay send', 'How much of this lane goes to the delay. Drag up / down.', 0, 1, 0)}
          <div class="osg-meter" data-meter="${id}" ${T('Level', 'The level of this lane while the song plays.')}><i></i></div></div>
      </div>
      <div class="osg-track" data-track="${id}"></div></div>`
  }

  _autoRowHTML (target) {
    const params = target === 'master' ? ['volume', 'filter'] : D.AUTO_PARAMS
    const cur = this._autoOpen.get(target)
    const opts = params.map(p => `<option value="${p}"${p === cur ? ' selected' : ''}>${D.AUTO_LABELS[p]}</option>`).join('')
    return `<div class="osg-row osg-auto" data-auto="${esc(target)}"><div class="osg-hd"><div class="osg-h1"><b>∿ ${target === 'master' ? 'Master' : ''}</b><select class="osg-sel" data-af="param" data-target="${esc(target)}" aria-label="Automation parameter" ${T('Automation parameter', 'Which setting the curve controls.')}>${opts}</select></div>
      <div class="osg-h1"><button type="button" class="osg-btn" data-act="autoClear" data-target="${esc(target)}" ${T('Clear curve', 'Removes every point of this curve.')}>Clear</button><button type="button" class="osg-btn" data-act="autoHide" data-target="${esc(target)}" ${T('Hide automation', 'Closes this automation row (the curve stays).')}>Hide</button></div></div>
      <div class="osg-track"><canvas class="osg-cv" data-cv="auto" data-target="${esc(target)}" height="${D.AUTO_H}" aria-label="Automation curve" ${T('Automation curve', 'Click to add a point, drag a point to move it, double click or right click it (or press Delete) to remove it. Alt+click a point switches the segment after it between linear and step.')}></canvas></div></div>`
  }

  _buildLanes (s) {
    const host = this.r.lanes; if (!host) return
    host.innerHTML = ''
    this._tracks.clear(); this._clipEls.clear(); this._laneEls = new Map(); this._laneRows = []
    for (const l of s.lanes) {
      const row = this._el(this._laneHTML(l)); host.appendChild(row)
      this._laneEls.set(l.id, row); this._laneRows.push(l.id)
      if (!this.simple) { this._tracks.set(l.id, row.querySelector('.osg-track')) }
      if (!this.simple && this._autoOpen.has(l.id)) host.appendChild(this._el(this._autoRowHTML(l.id)))
    }
    if (!this.simple && this._autoOpen.has('master')) host.appendChild(this._el(this._autoRowHTML('master')))
    if (this.simple && !s.lanes.length) host.appendChild(this._el('<div class="osg-notice">An empty song. Add a pattern lane with the buttons above, then add a clip to it.</div>'))
    if (this.simple) this._fillSimpleSelects(s)
  }

  _fillSimpleSelects (s) {
    for (const l of s.lanes) {
      const sel = this._laneEls.get(l.id)?.querySelector('[data-sl="src"]'); if (!sel) continue
      sel.innerHTML = this._libOptions(l.kind)
    }
  }
  _libOptions (kind) {
    if (kind === 'audio') return this._assetList.map(a => `<option value="audio:${esc(a.id)}">${esc(a.name)}</option>`).join('') || '<option value="">(no audio imported)</option>'
    return this._musicIds().map(i => `<option value="music:${esc(i)}">${esc(this._label(i))}</option>`).join('') || '<option value="">(no patterns yet)</option>'
  }

  _syncHeaders (s) {
    const els = this._laneEls; if (!els) return
    const solo = s.lanes.some(l => l.solo)
    for (const l of s.lanes) {
      const root = els.get(l.id); if (!root) continue
      const col = D.safeColor(l.color)
      root.style.setProperty('--lc', col)
      root.classList.toggle('is-sel', this._selLane === l.id)
      const stCard = root.classList.contains('osg-card')
      if (stCard) { const sw = root.querySelector('.osg-sw'); if (sw) sw.style.background = col; const cn = root.querySelector('[data-ref="cn"]'); if (cn) cn.textContent = l.name + (l.kind === 'audio' ? ' ♪' : '') }
      root.querySelectorAll('[data-lf]').forEach(el => {
        if (el === document.activeElement || (this._drag?.kind === 'fader' && this._drag.el === el)) return
        const k = el.dataset.lf
        const v = k === 'name' ? l.name : k === 'color' ? D.hexColor(l.color) : k === 'reverb' ? l.sends.reverb : k === 'delay' ? l.sends.delay : l[k]
        if (String(el.value) !== String(v)) el.value = String(v)
      })
      root.querySelectorAll('[data-kn]').forEach(k => this._knobVisual(k, k.dataset.kn === 'pan' ? l.pan : k.dataset.kn === 'reverb' ? l.sends.reverb : l.sends.delay))
      const flag = (a, on) => { const b = root.querySelector(`[data-act="${a}"]`); if (b) { b.classList.toggle('is-on', !!on); b.setAttribute('aria-pressed', String(!!on)) } }
      flag('mute', l.mute); flag('solo', l.solo); flag('auto', this._autoOpen.has(l.id))
      root.classList.toggle('is-silent', (solo && !l.solo) || l.mute)
      root.style.opacity = (solo && !l.solo) || l.mute ? '0.62' : ''
    }
    // the open automation rows follow the curve choice
    this.host.querySelectorAll('[data-af="param"]').forEach(sel => { const p = this._autoOpen.get(sel.dataset.target); if (p && sel.value !== p && document.activeElement !== sel) sel.value = p })
  }

  _knobVisual (k, v) {
    const min = num(k.dataset.min); const max = num(k.dataset.max, 1)
    const n = clamp((v - min) / (max - min || 1), 0, 1)
    k.style.setProperty('--ang', (n * 270 - 135).toFixed(1) + 'deg')
    k.setAttribute('aria-valuenow', String(Math.round(v * 100) / 100))
  }

  // clips -------------------------------------------------------------------------------------------------------------

  _makeClip () {
    const el = document.createElement('div')
    el.className = 'osg-clip'
    el.innerHTML = '<canvas class="osg-ccv"></canvas><span class="osg-cname"></span><i class="osg-grip is-l"></i><i class="osg-grip is-r"></i>'
    return el
  }

  _peaksFor (id) {
    if (this._peaks.has(id)) return this._peaks.get(id)
    this._peaks.set(id, 'pending')
    loadAssets(this.opts.assets).then(a => a?.getPeaks?.(id, 512)).then(p => { this._peaks.set(id, p && p.length ? p : null); this._later('peaks', () => this._syncClips(this._song())) }).catch(() => { this._peaks.set(id, null) })
    return 'pending'
  }

  _clipInfo (c, s) {
    const l = this._lane(c.lane, s); const color = D.safeColor(l?.color)
    if (c.ref.type === 'audio') {
      const a = this._asset(c.ref.id)
      return { color, missing: this._assetsLoaded && !a, label: c.name || a?.name || 'Audio', audio: a, ver: this._peaksState(c.ref.id) }
    }
    const m = this._music(c.ref.id)
    return { color, missing: !m, label: c.name || (m ? this._label(c.ref.id) : 'Pattern'), music: m, ver: this._ver(m) }
  }
  _peaksState (id) { const p = this._peaksFor(id); return p === 'pending' ? 0 : p ? 1 : -1 }

  _syncClips (s) {
    if (!s || !this.r) return
    if (this.simple) { this._syncStrips(s); return }
    const sc = this.r.scroll; if (!sc) return
    const vw = sc.clientWidth || 900
    const lo = sc.scrollLeft - HW - 320; const hi = sc.scrollLeft + vw + 320
    const bp = this.barPx; const seen = new Set()
    const dragId = this._drag && this._drag.moved && (this._drag.kind === 'move' || this._drag.kind === 'rl' || this._drag.kind === 'rr') ? this._drag.id : null
    for (const c of s.clips) {
      const track = this._tracks.get(c.lane); if (!track) continue
      const x = (c.startBar - 1) * bp; const w = Math.max(3, c.lengthBars * bp)
      if (c.id !== dragId && (x + w < lo || x > hi)) continue
      seen.add(c.id)
      let e = this._clipEls.get(c.id)
      if (!e) { e = { el: this._makeClip(), sig: '', dsig: '' }; e.el.dataset.clip = c.id; this._clipEls.set(c.id, e) }
      if (c.id === dragId) continue
      if (e.el.parentNode !== track) track.appendChild(e.el)
      const info = this._clipInfo(c, s)
      const sel = this._selClip === c.id
      const sig = [x, w, info.color, info.label, info.missing, sel, info.ver, c.repeat, c.transpose].join('|')
      if (sig !== e.sig) {
        e.sig = sig
        const st = e.el.style
        st.left = x + 'px'; st.width = w + 'px'; st.setProperty('--cc', info.color)
        e.el.classList.toggle('is-sel', sel); e.el.classList.toggle('is-missing', !!info.missing)
        e.el.setAttribute('aria-label', `${info.label}, bar ${c.startBar}, ${c.lengthBars} bars`)
        e.el.title = info.missing ? (c.ref.type === 'audio' ? 'The audio file of this clip is missing.' : 'The pattern of this clip was deleted.') : ''
        const nm = e.el.querySelector('.osg-cname')
        nm.textContent = info.missing ? `⚠ missing ${c.ref.type === 'audio' ? 'audio' : 'pattern'}` : info.label + (c.repeat > 1 ? ` ×${c.repeat}` : '') + (c.transpose ? ` ${c.transpose > 0 ? '+' : ''}${c.transpose}` : '')
      }
      const dsig = [Math.round(w), c.repeat, c.lengthBars, info.ver, info.color, c.offset].join('|')
      if (dsig !== e.dsig) { e.dsig = dsig; this._drawClip(e.el, c, info, s, w) }
    }
    for (const [id, e] of this._clipEls) if (!seen.has(id)) { e.el.remove(); this._clipEls.delete(id) }
  }

  _drawClip (el, c, info, s, wpx) {
    const cv = el.querySelector('.osg-ccv'); if (!cv || info.missing) { if (cv) { const g = cv.getContext?.('2d'); g?.clearRect?.(0, 0, cv.width, cv.height) } return }
    const cw = clamp(Math.round(wpx), 4, 2048); const ch = LANE_H - 8 - 16
    if (cv.width !== cw) cv.width = cw
    if (cv.height !== ch) cv.height = ch
    const g = cv.getContext?.('2d'); if (!g) return
    if (c.ref.type === 'audio') {
      const peaks = this._peaks.get(c.ref.id); const a = info.audio
      if (!(peaks && peaks.length) || peaks === 'pending') { g.clearRect(0, 0, cw, ch); return }
      const secBar = SM.barToSeconds(s, 2) - SM.barToSeconds(s, 1) || 2
      const dur = a?.duration > 0 ? a.duration : c.lengthBars * secBar
      const offS = (c.offset || 0) * secBar; const lenS = c.lengthBars * secBar
      const used = clamp((dur - offS) / lenS, 0.02, 1)
      D.drawWave(g, Math.max(2, Math.round(cw * used)), ch, peaks, '#fff', clamp(offS / dur, 0, 1), clamp((offS + lenS) / dur, 0, 1))
    } else {
      D.drawPattern(g, cw, ch, info.music, this._patBars(info.music), c.lengthBars, c.repeat, '#fff')
    }
  }

  _syncStrips (s) {
    for (const l of s.lanes) {
      const card = this._laneEls?.get(l.id); const strip = card?.querySelector('.osg-strip'); if (!strip) continue
      const clips = s.clips.filter(c => c.lane === l.id)
      const sig = s.lengthBars + '|' + clips.map(c => [c.id, c.startBar, c.lengthBars, this._selClip === c.id, this._clipInfo(c, s).missing].join(':')).join(',')
      if (strip.dataset.sig === sig) continue
      strip.dataset.sig = sig
      strip.querySelectorAll('.osg-sclip').forEach(n => n.remove())
      const head = strip.querySelector('.osg-shead')
      for (const c of clips) {
        const info = this._clipInfo(c, s)
        const b = document.createElement('div')
        b.className = 'osg-sclip' + (this._selClip === c.id ? ' is-sel' : '') + (info.missing ? ' is-missing' : '')
        b.dataset.clip = c.id; b.style.left = ((c.startBar - 1) / s.lengthBars * 100) + '%'; b.style.width = (c.lengthBars / s.lengthBars * 100) + '%'; b.style.setProperty('--cc', info.color)
        b.title = info.label
        strip.insertBefore(b, head)
      }
    }
    this._sectionChips(s)
  }

  _sectionChips (s) {
    let el = this.host.querySelector('[data-ref="secs"]')
    if (!el) { el = document.createElement('div'); el.className = 'osg-secs'; el.dataset.ref = 'secs'; this.r.lanes?.parentNode?.insertBefore(el, this.r.lanes) }
    const sig = s.sections.map(x => x.id + x.name + x.startBar + x.color).join(',')
    if (el.dataset.sig === sig) return
    el.dataset.sig = sig
    el.innerHTML = s.sections.map(x => `<button type="button" class="osg-btn" style="background:${D.safeColor(x.color, '#8899ff')}" data-act="gotoSec" data-id="${esc(x.id)}" ${T('Section ' + x.name, 'Moves the playhead to the start of this section (bar ' + x.startBar + ').')}>${esc(x.name)}</button>`).join('') + `<button type="button" class="osg-btn" data-act="addSec" ${T('Add section', 'Adds a section label at the playhead.')}>＋ Section</button>`
  }

  // canvases ---------------------------------------------------------------------------------------------------------

  _fitCv (cv, h) {
    const sc = this.r.scroll
    const vw = Math.max(160, (sc?.clientWidth || 900) - HW)
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    const W = Math.round(vw * dpr); const H = Math.round(h * dpr)
    if (cv.width !== W) cv.width = W
    if (cv.height !== H) cv.height = H
    cv.style.width = vw + 'px'; cv.style.height = h + 'px'
    const g = cv.getContext?.('2d'); g?.setTransform?.(dpr, 0, 0, dpr, 0, 0)
    return { g, w: vw }
  }

  _drawAll () {
    const r = this.r; const s = this._song(); if (!r || !s || this.simple) return
    const sl = r.scroll?.scrollLeft || 0; const th = this._theme()
    if (r.ruler) {
      const { g, w } = this._fitCv(r.ruler, D.RULER.h)
      if (g) D.drawRuler(g, w, D.RULER.h, { scrollLeft: sl, barPx: this.barPx, lengthBars: s.lengthBars, num: s.meta.timeSig[0], sections: s.sections, markers: s.markers, loop: s.loop, th })
    }
    if (r.tempo) {
      const { g, w } = this._fitCv(r.tempo, D.TEMPO_H)
      if (g) D.drawTempo(g, w, D.TEMPO_H, { scrollLeft: sl, barPx: this.barPx, lengthBars: s.lengthBars, points: this._tempoDraft ?? D.tempoPoints(s), th, selected: this._tempoSel })
    }
    this.host.querySelectorAll('canvas[data-cv="auto"]').forEach(cv => {
      const target = cv.dataset.target; const param = this._autoOpen.get(target); if (!param) return
      const { g, w } = this._fitCv(cv, D.AUTO_H); if (!g) return
      const a = D.findAuto(s, target, param)
      const lane = this._lane(target, s)
      const draft = this._autoDraft && this._autoDraft.target === target && this._autoDraft.param === param ? this._autoDraft.points : null
      D.drawAuto(g, w, D.AUTO_H, { scrollLeft: sl, barPx: this.barPx, lengthBars: s.lengthBars, param, points: draft ?? a?.points ?? [], staticValue: D.staticValue(s, target, param), color: lane ? lane.color : th.accent, th, selected: this._autoSel && this._autoSel.target === target ? this._autoSel.index : -1 })
    })
  }

  // library ----------------------------------------------------------------------------------------------------------

  async _loadAssetList () {
    const a = await loadAssets(this.opts.assets)
    if (this._dead) return
    try { this._assetList = a ? (await a.list()) ?? [] : [] } catch (_) { this._assetList = [] }
    this._assetsLoaded = !!a
    this._assetAvail = !!a
    if (this._dead) return
    for (const k of [...this._peaks.keys()]) if (!this._asset(k)) this._peaks.delete(k)
    this._later('assetsync', () => { if (this.r) { this._syncLib(true); this._fillSimpleSelectsSafe(); this._syncClips(this._song()) } })
  }
  _fillSimpleSelectsSafe () { const s = this._song(); if (s && this.simple && this._laneEls) this._fillSimpleSelects(s) }

  _syncLib (force) {
    const lib = this.r?.lib; if (!lib || lib.hidden) return
    const ids = this._musicIds()
    const rows = ids.map(id => { const m = this._music(id); return { id, name: this._label(id), bars: m ? this._patBars(m) : 0, ver: this._ver(m) } })
    const sig = rows.map(r => [r.id, r.name, r.bars, r.ver].join(':')).join(',') + '|' + this._assetList.map(a => a.id + a.name + a.duration).join(',') + '|' + this._assetAvail
    if (!force && lib.dataset.sig === sig) return
    lib.dataset.sig = sig
    const fmtB = (b) => (b ? `${Math.round(b * 4) / 4} bar${b === 1 ? '' : 's'}` : '')
    const pats = rows.map(r => `<div class="osg-item" draggable="true" data-lib="music" data-id="${esc(r.id)}"><canvas width="40" height="14" data-prev="${esc(r.id)}"></canvas><span class="osg-iname" title="${esc(r.name)}">${esc(r.name)}</span><small>${fmtB(r.bars)}</small><button type="button" class="osg-btn" data-act="addItem" data-type="music" data-id="${esc(r.id)}" ${T('Add pattern', 'Adds this pattern as a clip at the playhead (on the selected lane, or the first pattern lane).')}>Add</button><button type="button" class="osg-btn" data-act="openPattern" data-id="${esc(r.id)}" ${T('Open in sequencer', 'Selects this music node and opens ⟐OmniSequencer to edit the pattern.')}>✎</button></div>`).join('')
    const aud = this._assetList.map(a => `<div class="osg-item" draggable="true" data-lib="audio" data-id="${esc(a.id)}"><span class="osg-iname" title="${esc(a.name)}">♪ ${esc(a.name)}</span><small>${D.fmtTime(a.duration).replace(/^00:/, '')}s</small><button type="button" class="osg-btn" data-act="addItem" data-type="audio" data-id="${esc(a.id)}" ${T('Add audio', 'Adds this audio file as a clip at the playhead (on the selected audio lane, or the first one).')}>Add</button></div>`).join('')
    lib.innerHTML = `<div class="osg-h">Patterns<button type="button" class="osg-btn" data-act="newPattern" ${T('New pattern', 'Creates a new music node (a pattern) in front of the camera and lists it here.')}>＋ New</button></div>
      ${pats || '<div class="osg-hint" style="padding:4px">No patterns yet. Create a music node, then add it here.</div>'}
      <div class="osg-h">Audio<button type="button" class="osg-btn" data-act="import" ${T('Import audio', 'Opens a file picker. WAV, MP3, OGG, M4A and any other file your browser can decode work. The file stays on this device.')}>Import…</button></div>
      ${this._assetAvail === false ? '<div class="osg-hint" style="padding:4px">Audio import is not available in this build.</div>' : aud || '<div class="osg-hint" style="padding:4px">No audio yet. Import a file, or drop one on this window.</div>'}
      <div class="osg-hint" style="padding:4px">Drag an item onto a lane, or press Add.</div>`
    lib.querySelectorAll('canvas[data-prev]').forEach(cv => {
      const m = this._music(cv.dataset.prev); const g = cv.getContext?.('2d'); if (!m || !g) return
      D.drawPattern(g, 40, 14, m, 1, 1, 1, '#7ad7f0')
    })
  }

  // clip bar ---------------------------------------------------------------------------------------------------------

  _syncClipbar (s) {
    const cb = this.r.clipbar; if (!cb) return
    const c = this._clip(s)
    if (!c) { cb.hidden = true; cb.innerHTML = ''; this._cbFor = null; return }
    cb.hidden = false
    const key = c.id + ':' + c.ref.type
    if (this._cbFor !== key) {
      this._cbFor = key
      const pat = c.ref.type === 'music'
      const f = (name, k, extra, desc) => `<label class="osg-lab"><span>${name}</span><input class="osg-in" type="number" data-cf="${k}" ${extra} aria-label="${name}" ${T(name, desc)}></label>`
      cb.innerHTML = `<b data-ref="cbtitle"></b>
        <input class="osg-in is-name" data-cf="name" maxlength="40" aria-label="Clip name" placeholder="Name" ${T('Clip name', 'A label for this clip (empty = the name of the pattern or file).')}>
        ${f('start', 'startBar', 'step="0.25" min="1"', 'The bar where the clip starts (1 = the first bar).')}${f('length', 'lengthBars', 'step="0.25" min="0.25"', 'How many bars the clip lasts.')}${f('repeat', 'repeat', 'step="1" min="1" max="64"', 'How many times the source plays one after the other inside the clip.')}
        <label class="osg-lab"><span>gain</span><input type="range" data-cf="gain" min="0" max="2" step="0.01" style="width:70px" aria-label="Clip gain" ${T('Clip gain', 'The level of this clip (1 = unchanged).')}></label>
        ${pat ? f('transpose', 'transpose', 'step="1" min="-24" max="24"', 'Shifts the notes of this clip up or down in semitones (-24 to 24).') : f('fade in', 'fadeIn', 'step="0.05" min="0"', 'Fade in at the start, in seconds.') + f('fade out', 'fadeOut', 'step="0.05" min="0"', 'Fade out at the end, in seconds.')}
        <button type="button" class="osg-btn" data-act="split" ${T('Split', 'Cuts this clip in two at the playhead (S).')}>✂ Split</button><button type="button" class="osg-btn" data-act="dup" ${T('Duplicate', 'Copies this clip right after itself (Ctrl/Cmd+D).')}>⎘ Duplicate</button><button type="button" class="osg-btn is-danger" data-act="delClip" ${T('Delete clip', 'Removes this clip (Delete). The pattern or audio itself is not deleted.')}>Delete</button>
        ${pat ? `<button type="button" class="osg-btn" data-act="unique" ${T('Make unique', 'Copies the pattern into a new music node and points this clip at the copy, so editing it no longer changes the other clips that use the original.')}>Make unique</button><button type="button" class="osg-btn" data-act="openClip" ${T('Open in sequencer', 'Selects the pattern of this clip and opens ⟐OmniSequencer.')}>✎ Sequencer</button>` : ''}
        <button type="button" class="osg-btn" data-act="deselect" aria-label="Close clip bar" ${T('Close', 'Deselects the clip.')}>✕</button>`
    }
    const info = this._clipInfo(c, s)
    const t = cb.querySelector('[data-ref="cbtitle"]'); if (t) t.textContent = (c.ref.type === 'audio' ? '♪ ' : '▦ ') + (info.label)
    cb.querySelectorAll('[data-cf]').forEach(el => {
      if (el === document.activeElement) return
      const v = el.dataset.cf === 'name' ? (c.name ?? '') : c[el.dataset.cf]
      if (String(el.value) !== String(v)) el.value = String(v ?? '')
    })
  }

  // master -----------------------------------------------------------------------------------------------------------

  _buildMaster (s) {
    const m = this.r?.master; if (!m || !s) return
    const rg = (label, key, min, max, step, name, desc) => `<label class="osg-lab"><span>${label}</span><input type="range" data-mf="${key}" min="${min}" max="${max}" step="${step}" aria-label="${name}" ${T(name, desc)}></label>`
    m.innerHTML = `<b>Master</b>
      ${rg('gain', 'gain', 0, 1.5, 0.01, 'Master gain', 'The level of the whole song (1 = unity).')}
      <button type="button" class="osg-btn" data-act="limiter" aria-pressed="false" ${T('Limiter', 'On: a limiter keeps the loudest peaks under the threshold, so the sum of many lanes does not clip.')}>Limiter</button>
      ${rg('thr dB', 'limiterThresholdDb', -24, 0, 0.5, 'Limiter threshold', 'The level (in dB) above which the limiter holds the peaks back.')}
      ${rg('rev size', 'reverb.size', 0, 1, 0.01, 'Reverb size', 'How big the shared reverb room is.')}${rg('rev mix', 'reverb.mix', 0, 1, 0.01, 'Reverb mix', 'How much reverb is added to the whole mix.')}
      ${rg('dly time', 'delay.time', 0.01, 1, 0.01, 'Delay time', 'The time between the echoes of the shared delay.')}${rg('dly fb', 'delay.feedback', 0, 0.95, 0.01, 'Delay feedback', 'How many echoes the delay repeats.')}${rg('dly mix', 'delay.mix', 0, 1, 0.01, 'Delay mix', 'How much delay is added to the whole mix.')}
      <button type="button" class="osg-ms is-auto" data-act="autoMaster" aria-pressed="false" ${this.simple ? 'hidden' : ''} ${T('Master automation', 'Shows the automation curve of the master volume or filter.')}>∿</button>
      <div class="osg-meter" data-meter="master" ${T('Master level', 'The level of the whole song while it plays.')}><i></i></div>`
    this._syncMaster(s)
  }
  _syncMaster (s) {
    const m = this.r?.master; if (!m || m.hidden || !s) return
    if (!m.firstElementChild) { this._buildMaster(s); return }
    m.querySelectorAll('[data-mf]').forEach(el => {
      if (el === document.activeElement || (this._drag?.kind === 'fader' && this._drag.el === el)) return
      const v = el.dataset.mf.split('.').reduce((o, k) => o?.[k], s.master)
      if (String(el.value) !== String(v)) el.value = String(v)
    })
    const lb = m.querySelector('[data-act="limiter"]'); if (lb) { lb.classList.toggle('is-on', !!s.master.limiter); lb.setAttribute('aria-pressed', String(!!s.master.limiter)) }
    const ab = m.querySelector('[data-act="autoMaster"]'); if (ab) { ab.classList.toggle('is-on', this._autoOpen.has('master')); ab.setAttribute('aria-pressed', String(this._autoOpen.has('master'))) }
  }

  // ── Transport, playhead, meters ─────────────────────────────────────────────

  _wantTimer () { try { return !!(this.r && this.nodeId && this._active() && this.svc?.isPlaying(this.nodeId)) } catch (_) { return false } }
  _syncTimer () {
    if (this._wantTimer()) { if (!this._timer) this._timer = setInterval(() => this._tick(), 33) } else { const was = this._timer; this._stopTimer(); if (was || this.r) { this._syncProgress(); this._meters(true) } }
  }
  _stopTimer () { if (this._timer) clearInterval(this._timer); this._timer = 0 }
  _tick () {
    if (!this._wantTimer()) { this._syncTimer(); return }
    this._syncProgress()
    const t = nowMs()
    if (t - this._lastMeter >= 50) { this._lastMeter = t; this._meters(false) }
  }
  _onTransport () {
    if (!this.r) return
    if (!this._song()) return
    try { const p = this.player?.getPosition(this.nodeId); if (p && !p.playing) this._cursor = num(p.bar, 1) } catch (_) { /* no player */ }
    this._syncPlayBtn(); this._syncWho(); this._syncTimer()
  }

  _syncProgress () {
    const s = this._song(); const r = this.r; if (!s || !r) return
    let pos = null; try { pos = this.player?.getPosition(this.nodeId) } catch (_) { pos = null }
    const playing = !!(pos && pos.playing)
    if (playing) this._cursor = num(pos.bar, 1)
    const bar = this._cursor
    const x = (bar - 1) * this.barPx
    if (this.simple) {
      const f = ((bar - 1) / Math.max(1, s.lengthBars)) * 100
      if (f !== this._lastHead) { this._lastHead = f; this.host.querySelectorAll('.osg-shead').forEach(h => { h.style.left = f + '%' }) }
    } else if (x !== this._lastHead) {
      this._lastHead = x
      if (r.head) r.head.style.transform = `translateX(${x}px)`
      const sc = r.scroll
      if (playing && this.prefs.follow && sc && !this._drag) {
        const sx = HW + x - sc.scrollLeft; const vw = sc.clientWidth || 900
        if (sx > vw - 24 || sx < HW) sc.scrollLeft = Math.max(0, x - 24)
      }
    }
    const sec = playing ? num(pos.seconds, 0) : SM.barToSeconds(s, bar)
    const txt = D.fmtBarBeat(bar, s.meta.timeSig[0]) + '  ' + D.fmtTime(sec)
    if (txt !== this._lastPos) { this._lastPos = txt; if (r.pos) r.pos.textContent = txt }
  }

  _meters (final) {
    let lv = null
    if (!final) { try { lv = this.player?.getLevels(this.nodeId) } catch (_) { lv = null } }
    this.host.querySelectorAll('[data-meter]').forEach(el => {
      const id = el.dataset.meter
      const v = final || !lv ? 0 : clamp(num(id === 'master' ? lv.master : lv.lanes?.[id], 0), 0, 1)
      const q = Math.round(v * 50) / 50
      if (el._q !== q) { el._q = q; const i = el.firstElementChild; if (i) i.style.transform = `scaleX(${q})` }
    })
  }

  _seek (bar) {
    const s = this._song(); if (!s) return
    const b = clamp(Math.round(bar * 100) / 100, 1, s.lengthBars + 1)
    this._cursor = b
    this.svc.transport('seek', this.nodeId, b)
    this._lastHead = -1; this._syncProgress()
  }
  _togglePlay () {
    const svc = this.svc; if (!svc || !this.nodeId) return
    if (svc.isPlaying(this.nodeId)) svc.transport('toggle', this.nodeId)
    else svc.transport('play', this.nodeId, this._cursor)
  }

  // ── Geometry helpers ────────────────────────────────────────────────────────

  _barAt (clientX) {
    const sc = this.r.scroll
    if (sc) { const r = sc.getBoundingClientRect(); return 1 + (clientX - r.left - (sc.clientLeft || 0) - HW + sc.scrollLeft) / this.barPx }
    return 1
  }
  _snapBar (b, grid = this.snap) { return Math.max(1, D.roundBar(D.snapTo(b, grid))) }
  _laneAtY (clientY) {
    const s = this._song(); const host = this.r.lanes; if (!s || !s.lanes.length || !host) return null
    let y = clientY - host.getBoundingClientRect().top
    let acc = 0
    for (const l of s.lanes) {
      const h = LANE_H + (this._autoOpen.has(l.id) ? D.AUTO_H : 0)
      if (y < acc + h) return l
      acc += h
    }
    return s.lanes[s.lanes.length - 1]
  }
  _setZoom (px, anchorClientX = null) {
    const bp0 = this.barPx; const px1 = clamp(Math.round(px), BAR_MIN, BAR_MAX); if (px1 === bp0) return
    const sc = this.r?.scroll; let anchor = null; let screenX = 0
    if (sc) {
      const rect = sc.getBoundingClientRect()
      screenX = anchorClientX != null ? anchorClientX - rect.left - HW : ((sc.clientWidth || 900) - HW) / 2
      anchor = 1 + (sc.scrollLeft + screenX) / bp0
    }
    this.barPx = px1; this.prefs.barPx = px1; savePrefs(this.prefs)
    this._applyZoom()
    if (sc && anchor != null) sc.scrollLeft = Math.max(0, (anchor - 1) * px1 - screenX)
    const s = this._song(); this._lastHead = -1
    if (s) { this._syncClips(s); this._syncToolbar(s) }
    this._drawAll(); this._syncProgress()
  }
  _fit () { const s = this._song(); const sc = this.r?.scroll; if (!s || !sc) return; this._setZoom(((sc.clientWidth || 900) - HW - 16) / Math.max(4, s.lengthBars)); if (sc) sc.scrollLeft = 0 }
  _wheel (e) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    this._setZoom(this.barPx * Math.exp(-e.deltaY * 0.0018), e.clientX)
  }
  _startPinch () {
    const pts = [...this._touches.values()]; if (pts.length < 2) return
    clearTimeout(this._drag?.timer); this._drag = null
    this._pinch = { d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, bp0: this.barPx, cx: (pts[0].x + pts[1].x) / 2 }
  }
  _doPinch () {
    const pts = [...this._touches.values()]; if (pts.length < 2 || !this._pinch) return
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
    this._setZoom(this._pinch.bp0 * d / this._pinch.d0, (pts[0].x + pts[1].x) / 2)
  }

  // ── Clicks, inputs, keys ────────────────────────────────────────────────────

  _click (e) {
    const pa = e.target.closest?.('[data-pact]'); if (pa) { this._popAct(pa, e); return }
    const b = e.target.closest?.('[data-act]'); if (!b || b.disabled) return
    this._act(b.dataset.act, b, e)
  }

  _act (act, b) {
    const svc = this.svc; const id = this.nodeId; const lane = b.dataset.lane
    const s = this._song()
    switch (act) {
      case 'create': case 'createDemo': {
        const d = { select: true, ...(act === 'createDemo' ? { demo: true } : {}) }
        window.dispatchEvent(new CustomEvent('omni:song-node-create', { detail: d }))
        if (d.out?.ok) { this._setNode(d.out.nodeId); this.say(act === 'create' ? 'A song node was created in front of you.' : 'A demo song node was created.'); this.refresh() } else this.say(d.out?.error || 'The song system is not running.', true)
        return
      }
      case 'pick': this._setNode(b.dataset.id); this.refresh(); return
    }
    if (!svc || !id || !s) return
    switch (act) {
      case 'rewind': this._seek(1); return
      case 'play': this._togglePlay(); return
      case 'stop': svc.transport('stop', id); this._cursor = 1; this._lastHead = -1; this._syncProgress(); return
      case 'loop': this._e('loop', (x) => ({ ...x, loop: { ...x.loop, on: !x.loop.on } })); return
      case 'zoomIn': this._setZoom(this.barPx * 1.4); return
      case 'zoomOut': this._setZoom(this.barPx / 1.4); return
      case 'fit': this._fit(); return
      case 'undo': { const r = svc.undo(id); if (!r.ok) this.say(r.error, true); return }
      case 'redo': { const r = svc.redo(id); if (!r.ok) this.say(r.error, true); return }
      case 'split': this._splitSel(); return
      case 'dup': this._dupSel(); return
      case 'delClip': this._delSel(); return
      case 'deselect': this._selClip = null; this._sync(); return
      case 'unique': this._makeUnique(); return
      case 'openClip': { const c = this._clip(s); if (c) this._openPattern(c.ref.id); return }
      case 'marker': this._addMarker(this._cursor); return
      case 'limiter': this._e('master', (x) => ({ ...x, master: { ...x.master, limiter: !x.master.limiter } })); return
      case 'togLib': this._showLib(!!this.r.lib.hidden); savePrefs(this.prefs); return
      case 'togMaster': this._showMaster(!!this.r.master.hidden); savePrefs(this.prefs); return
      case 'mute': case 'solo': { const l = this._lane(lane, s); if (l) this._e('lane', (x) => SM.updateLane(x, lane, { [act]: !l[act] })); return }
      case 'auto': if (this._autoOpen.has(lane)) this._autoOpen.delete(lane); else this._autoOpen.set(lane, 'volume'); this._sync(); return
      case 'autoMaster': if (this._autoOpen.has('master')) this._autoOpen.delete('master'); else this._autoOpen.set('master', 'volume'); this._sync(); return
      case 'autoHide': this._autoOpen.delete(b.dataset.target); this._sync(); return
      case 'autoClear': { const t = b.dataset.target; const p = this._autoOpen.get(t); if (p) this._autoCommit(t, p, []); return }
      case 'delLane': { if (!this._lane(lane, s)) return; this._e('lane', (x) => SM.removeLane(x, lane)); if (this._selLane === lane) this._selLane = null; this._autoOpen.delete(lane); if (this._clip(this._song()) == null) this._selClip = null; this.say('Lane deleted. Undo (Ctrl/Cmd+Z) brings it back.'); return }
      case 'addLane': this._addLane(b.dataset.kind === 'audio' ? 'audio' : 'pattern'); return
      case 'expand': { if (this._expanded.has(lane)) this._expanded.delete(lane); else this._expanded.add(lane); this._selLane = lane; this._sync(); return }
      case 'addItem': this._addFromLibrary({ type: b.dataset.type, id: b.dataset.id }); return
      case 'addSel': { const sel = this._laneEls?.get(lane)?.querySelector('[data-sl="src"]'); const [type, ...rest] = String(sel?.value ?? '').split(':'); if (type && rest.length) this._addFromLibrary({ type, id: rest.join(':') }, lane); else this.say('Nothing to add yet: create a pattern or import audio first.', true); return }
      case 'newPattern': { const d = { select: false }; window.dispatchEvent(new CustomEvent('omni:music-node-create', { detail: d })); this.say(d.out?.ok ? 'A new pattern (music node) was created in front of you. Add it to a lane.' : (d.out?.error || 'The music system is not running.'), !d.out?.ok); this._syncLib(true); return }
      case 'openPattern': this._openPattern(b.dataset.id); return
      case 'import': this._pickFile(); return
      case 'gotoSec': { const x = s.sections.find(q => q.id === b.dataset.id); if (x) this._seek(x.startBar); return }
      case 'addSec': this._addSection(this._snapBar(this._cursor, 1)); return
      default:
    }
  }

  _input (e) {
    const el = e.target; if (!el || el.type !== 'range') return
    const v = Number(el.value); if (!Number.isFinite(v)) return
    if (el.dataset.lf) this._setLane(el.dataset.lane, el.dataset.lf, v, `lane:${el.dataset.lane}:${el.dataset.lf}`)
    else if (el.dataset.mf) this._setMaster(el.dataset.mf, v, 'master:' + el.dataset.mf)
    else if (el.dataset.cf) this._setClip(el.dataset.cf, v, 'clip:' + el.dataset.cf)
  }

  _change (e) {
    const el = e.target; if (!el) return
    if (el.type === 'file') { this._importFiles([...(el.files ?? [])]); try { el.value = '' } catch (_) { /* ignore */ } return }
    const f = el.dataset?.f; const v = el.value
    if (f) {
      switch (f) {
        case 'node': this._setNode(v); this.refresh(); return
        case 'title': this._e('meta', (x) => ({ ...x, meta: { ...x.meta, title: String(v).slice(0, 80) } })); return
        case 'bpm': if (Number.isFinite(+v) && v !== '') this._e('tempo', (x) => ({ ...x, bpm: clamp(+v, 60, 240) })); return
        case 'sigN': if (Number.isFinite(+v) && v !== '') this._e('meta', (x) => ({ ...x, meta: { ...x.meta, timeSig: [clamp(Math.round(+v), 1, 16), x.meta.timeSig[1]] } })); return
        case 'sigD': this._e('meta', (x) => ({ ...x, meta: { ...x.meta, timeSig: [x.meta.timeSig[0], Math.round(+v)] } })); return
        case 'key': this._e('meta', (x) => ({ ...x, meta: { ...x.meta, key: String(v).slice(0, 8) } })); return
        case 'snap': this.snap = [0.25, 0.5, 1].includes(+v) ? +v : 0.25; this.prefs.snap = this.snap; savePrefs(this.prefs); return
        case 'loopStart': case 'loopEnd': {
          if (!Number.isFinite(+v) || v === '') return
          this._e('loop', (x) => { const lp = { ...x.loop }; if (f === 'loopStart') lp.startBar = Math.max(1, +v); else lp.endBar = Math.max(2, +v); if (lp.endBar <= lp.startBar) { if (f === 'loopStart') lp.endBar = lp.startBar + 1; else lp.startBar = Math.max(1, lp.endBar - 1) } return { ...x, loop: lp } })
          return
        }
        default: return
      }
    }
    if (el.dataset?.lf === 'name') { this._e('lane', (x) => SM.updateLane(x, el.dataset.lane, { name: String(v).slice(0, 40) || 'Lane' })); return }
    if (el.dataset?.lf === 'color') { this._e('lane', (x) => SM.updateLane(x, el.dataset.lane, { color: v })); return }
    if (el.dataset?.cf && el.type !== 'range') { this._setClip(el.dataset.cf, el.type === 'number' ? +v : v); return }
    if (el.dataset?.af === 'param') { this._autoOpen.set(el.dataset.target, v); this._autoSel = null; this._drawAll(); return }
    if (el.dataset?.pf) { this._popEdit(el); return }
  }

  _key (e) {
    if (e.defaultPrevented) return
    const t = e.target; const tag = t?.tagName
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    if (e.key === 'Escape') { if (this._pop || this._menu) { this._closePop(); this._closeMenu(); e.preventDefault(); e.stopPropagation() } else if (this._selClip && !typing) { this._selClip = null; this._sync(); e.stopPropagation() } return }
    if (t?.classList?.contains('osg-knob')) { if (this._knobKey(e, t)) { e.preventDefault(); e.stopPropagation() } return }
    if (typing || !this.nodeId || !this._song()) return
    const mod = e.ctrlKey || e.metaKey; const k = (e.key || '').toLowerCase()
    let done = true
    if (mod && k === 'z') { const r = e.shiftKey ? this.svc.redo(this.nodeId) : this.svc.undo(this.nodeId); if (!r.ok) this.say(r.error, true) } else if (mod && k === 'y') { this.svc.redo(this.nodeId) } else if (mod && k === 'd') this._dupSel()
    else if (mod) done = false
    else if (e.key === ' ' || e.code === 'Space') { if (tag === 'BUTTON') return; this._togglePlay() } else if (k === 's') this._splitSel()
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this._autoSel) this._removeAutoPoint(this._autoSel.target, this._autoOpen.get(this._autoSel.target), this._autoSel.index)
      else if (this._tempoSel > 0) this._removeTempoPoint(this._tempoSel)
      else if (this._selClip) this._delSel()
      else done = false
    } else done = false
    if (done) { e.preventDefault(); e.stopPropagation() }
  }

  // ── Editing operations ──────────────────────────────────────────────────────

  _setLane (laneId, key, v, coalesce = null) {
    if (!['volume', 'pan', 'reverb', 'delay'].includes(key)) return { ok: false }
    const patch = key === 'reverb' || key === 'delay' ? { sends: { [key]: v } } : { [key]: v }
    return this._e('lane', (x) => SM.updateLane(x, laneId, patch), coalesce)
  }
  _setMaster (path, v, coalesce = null) {
    const [a, b] = path.split('.')
    return this._e('master', (x) => ({ ...x, master: b ? { ...x.master, [a]: { ...x.master[a], [b]: v } } : { ...x.master, [a]: v } }), coalesce)
  }
  _setClip (key, v, coalesce = null) {
    const c = this._clip(); if (!c) return
    if (key === 'startBar') { if (!Number.isFinite(v)) return; return this._e('clip', (x) => fitLength(SM.moveClip(x, c.id, { startBar: Math.max(1, v) }))) }
    if (key === 'lengthBars') { if (!Number.isFinite(v) || v <= 0) return; return this._e('clip', (x) => fitLength(SM.resizeClip(x, c.id, v))) }
    if (key === 'name') return this._e('clip', (x) => SM.updateClip(x, c.id, { name: String(v).slice(0, 40) }))
    if (!Number.isFinite(v)) return
    return this._e('clip', (x) => SM.updateClip(x, c.id, { [key]: v }), coalesce)
  }
  _addLane (kind) {
    const s = this._song(); if (!s) return
    const n = s.lanes.filter(l => l.kind === kind).length + 1
    const r = this._e('lane', (x) => SM.addLane(x, { name: (kind === 'audio' ? 'Audio ' : 'Pattern ') + n, kind }))
    if (!r.ok) return
    const nl = diffNew(s.lanes, r.song.lanes)[0]
    if (!nl) { this.say('A song has at most 32 lanes.', true); return }
    this._selLane = nl.id; if (this.simple) this._expanded.add(nl.id)
    this._sync()
  }
  _addFromLibrary (item, laneId = null, atBar = null) {
    const s = this._song(); if (!s || !item) return
    const type = item.type === 'audio' ? 'audio' : 'music'; const kind = type === 'audio' ? 'audio' : 'pattern'
    let lane = laneId ? this._lane(laneId, s) : null
    if (lane && lane.kind !== kind) { this.say(`That lane takes ${lane.kind} clips. ${kind === 'audio' ? 'Audio goes on an audio lane.' : 'Patterns go on a pattern lane.'}`, true); return }
    if (!lane) { const sel = this._lane(this._selLane, s); lane = sel && sel.kind === kind ? sel : s.lanes.find(l => l.kind === kind) ?? null }
    let len = 1
    if (type === 'music') { const m = this._music(item.id); if (!m) { this.say('That pattern no longer exists.', true); return } len = this._patBars(m) } else {
      const a = this._asset(item.id); if (!a) { this.say('That audio file is not in the library any more.', true); return }
      const secBar = SM.barToSeconds(s, 2) - SM.barToSeconds(s, 1) || 2
      len = Math.max(0.25, Math.ceil((a.duration / secBar) * 4) / 4)
    }
    len = clamp(len, 0.25, 64)
    const start = atBar != null ? this._snapBar(atBar) : this._snapBar(this._cursor)
    const r = this._e('clip', (x) => {
      let y = x; let lid = lane?.id
      if (!lid) { y = SM.addLane(y, { name: kind === 'audio' ? 'Audio 1' : 'Pattern 1', kind }); lid = diffNew(x.lanes, y.lanes)[0]?.id }
      if (!lid) return { error: 'A song has at most 32 lanes.' }
      return fitLength(SM.addClip(y, { lane: lid, startBar: start, lengthBars: len, ref: { type, id: item.id } }))
    })
    if (!r.ok) return
    const nc = diffNew(s.clips, r.song.clips)[0]
    if (!nc) { this.say('A song has at most 512 clips.', true); return }
    this._selClip = nc.id; this._selLane = nc.lane
    this.say(`Added to bar ${start}. Drag it to move it, drag an edge to resize it.`)
    this._sync()
  }
  _splitSel () {
    const c = this._clip(); if (!c) { this.say('Select a clip first.', true); return }
    const at = Math.round(this._cursor * 4) / 4
    if (at <= c.startBar || at >= c.startBar + c.lengthBars) { this.say('Move the playhead inside the clip to split it.', true); return }
    this._e('clip', (x) => SM.splitClip(x, c.id, at))
  }
  _dupSel () {
    const s = this._song(); const c = this._clip(s); if (!c) { this.say('Select a clip first.', true); return }
    const r = this._e('clip', (x) => fitLength(SM.duplicateClip(x, c.id)))
    if (!r.ok) return
    const nc = diffNew(s.clips, r.song.clips)[0]; if (nc) { this._selClip = nc.id; this._sync() }
  }
  _delSel () {
    const c = this._clip(); if (!c) return
    const r = this._e('clip', (x) => SM.removeClip(x, c.id))
    if (r.ok) { this._selClip = null; this.say('Clip deleted. Undo brings it back.') }
  }
  _makeUnique () {
    const c = this._clip(); if (!c || c.ref.type !== 'music') return
    const d = { nodeId: c.ref.id, select: false }
    window.dispatchEvent(new CustomEvent('omni:music-node-duplicate', { detail: d }))
    if (!d.out?.ok) { this.say(d.out?.error || 'Copying a pattern is not available in this build.', true); return }
    const r = this._e('clip', (x) => SM.updateClip(x, c.id, { ref: { type: 'music', id: d.out.nodeId } }))
    if (r.ok) this.say('This clip now has its own copy of the pattern. Editing it no longer changes the other clips.')
    this._syncLib(true)
  }
  _openPattern (id) {
    window.dispatchEvent(new CustomEvent('omni:node-select-by-id', { detail: { id } }))
    window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: SEQ_NAV } }))
  }
  _addMarker (bar) {
    const s = this._song(); if (!s) return
    const b = Math.max(1, D.roundBar(bar)); const n = s.markers.length + 1
    this._e('marker', (x) => ({ ...x, markers: [...x.markers, { id: SM.newId('mk'), bar: b, name: 'Marker ' + n }] }))
    this.say(`Marker added at bar ${b}.`)
  }
  _addSection (startBar) {
    const s = this._song(); if (!s) return
    const next = s.sections.filter(x => x.startBar > startBar).sort((a, b) => a.startBar - b.startBar)[0]
    const len = Math.max(1, Math.min(4, next ? next.startBar - startBar : 4))
    const sec = { id: SM.newId('sec'), name: 'Section ' + (s.sections.length + 1), startBar, lengthBars: len, color: D.SECTION_COLORS[s.sections.length % D.SECTION_COLORS.length] }
    const r = this._e('section', (x) => ({ ...x, sections: [...x.sections, sec].sort((a, b) => a.startBar - b.startBar) }))
    if (r.ok) { const ns = diffNew(s.sections, r.song.sections)[0]; if (ns) this._openSecPop(ns.id, null) }
  }
  _autoCommit (target, param, points) {
    const pts = []; for (const p of [...points].sort((a, b) => a.bar - b.bar)) { if (pts.length && pts[pts.length - 1].bar === p.bar) pts[pts.length - 1] = p; else pts.push(p) }
    return this._e('automation', (x) => {
      const old = x.automation.find(a => a.lane === target && a.param === param)
      const rest = x.automation.filter(a => !(a.lane === target && a.param === param))
      return { ...x, automation: pts.length ? [...rest, { id: old?.id ?? SM.newId('auto'), lane: target, param, points: pts }] : rest }
    })
  }
  _removeAutoPoint (target, param, index) {
    const a = D.findAuto(this._song(), target, param); if (!a || !a.points[index]) return
    this._autoSel = null
    this._autoCommit(target, param, a.points.filter((_, i) => i !== index))
  }
  _tempoCommit (pts) {
    const sorted = [...pts].sort((a, b) => a.bar - b.bar)
    const first = sorted.find(p => p.bar === 1) ?? sorted[0]
    const rest = sorted.filter(p => p !== first && p.bar > 1)
    return this._e('tempo', (x) => ({ ...x, bpm: clamp(first.bpm, 60, 240), tempoMap: rest.map(p => ({ bar: p.bar, bpm: clamp(p.bpm, 60, 240) })) }))
  }
  _removeTempoPoint (i) {
    const pts = D.tempoPoints(this._song()); if (i < 1 || !pts[i]) return
    this._tempoSel = -1
    this._tempoCommit(pts.filter((_, k) => k !== i))
  }

  // ── Pointer: dispatch ───────────────────────────────────────────────────────

  /** pointer position in the coordinates of a sticky canvas: x from the scroller (the canvas is pinned at HW), y from the canvas */
  _local (e, cv) { const r = cv.getBoundingClientRect(); const sc = this.r.scroll.getBoundingClientRect(); return { x: e.clientX - sc.left - (this.r.scroll.clientLeft || 0) - HW, y: e.clientY - r.top } }
  _longPress (e, fn) {
    if (e.pointerType === 'mouse') return 0
    const x = e.clientX; const y = e.clientY
    return setTimeout(() => { if (this._drag) this._drag.fired = true; fn(x, y) }, LONG_MS)
  }

  _down (e) {
    if (this._dead || !this.r) return
    const t = e.target
    if (e.pointerType === 'touch') { this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this._touches.size === 2) { this._startPinch(); return } }
    if (this._menu && !t.closest?.('.osg-menu')) this._closeMenu()
    if (this._pop && !t.closest?.('.osg-pop') && !t.closest?.('[data-cv="ruler"]')) this._closePop()
    if (e.button > 0) return
    if (t.closest?.('.osg-menu, .osg-pop')) return
    const kn = t.closest?.('.osg-knob'); if (kn) { this._knobDown(e, kn); return }
    const s = this._song(); if (!s) return
    const cv = t.closest?.('canvas[data-cv]')
    if (cv) {
      try { this.host.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
      if (cv.dataset.cv === 'ruler') this._rulerDown(e, cv, s)
      else if (cv.dataset.cv === 'tempo') this._tempoDown(e, cv, s)
      else this._autoDown(e, cv, s)
      return
    }
    const sclip = t.closest?.('.osg-sclip')
    if (sclip) { const c = s.clips.find(q => q.id === sclip.dataset.clip); if (c) { this._selClip = c.id; this._selLane = c.lane; this._sync() } return }
    const strip = t.closest?.('.osg-strip')
    if (strip) { const r = strip.getBoundingClientRect(); const f = r.width ? (e.clientX - r.left) / r.width : 0; this._selLane = strip.dataset.strip; this._seek(1 + clamp(f, 0, 1) * s.lengthBars); this._sync(); return }
    const clipEl = t.closest?.('.osg-clip')
    if (clipEl) { this._clipDown(e, clipEl, s); return }
    const track = t.closest?.('.osg-track[data-track]')
    if (track) {
      try { this.host.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
      this._selLane = track.dataset.track; this._selClip = null
      this._drag = { kind: 'idle', x0: e.clientX, y0: e.clientY, timer: this._longPress(e, (x, y) => this._laneMenu(track.dataset.track, x, y, this._barAt(x))) }
      this._sync(); return
    }
    const row = t.closest?.('.osg-lane'); if (row) { this._selLane = row.dataset.lane; this._sync() }
  }

  _clipDown (e, el, s) {
    const c = s.clips.find(q => q.id === el.dataset.clip); if (!c) return
    this._selClip = c.id; this._selLane = c.lane
    try { this.host.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
    const bar = this._barAt(e.clientX); const w = c.lengthBars * this.barPx; const px = (bar - c.startBar) * this.barPx
    const edge = Math.min(9, w / 3)
    const kind = px <= edge ? 'rl' : w - px <= edge ? 'rr' : 'move'
    this._drag = { kind, id: c.id, c0: { ...c }, grab: bar - c.startBar, x0: e.clientX, y0: e.clientY, moved: false, start: c.startBar, len: c.lengthBars, lane: c.lane, el, timer: this._longPress(e, (x, y) => this._clipMenu(c.id, x, y)) }
    this._sync()
  }

  _rulerDown (e, cv, s) {
    const { y } = this._local(e, cv); const bar = this._barAt(e.clientX)
    if (y < D.RULER.secH) {
      const sec = s.sections.find(q => bar >= q.startBar && bar < q.startBar + q.lengthBars)
      if (sec) this._openSecPop(sec.id, e); else this._addSection(this._snapBar(bar, 1))
      return
    }
    if (y < D.RULER.mkY1) {
      const mk = s.markers.find(m => Math.abs(m.bar - bar) * this.barPx <= 8)
      if (mk) { this._openMarkerPop(mk.id, e); return }
    }
    if (e.shiftKey) { this._drag = { kind: 'loop', a: this._snapBar(bar), b: this._snapBar(bar), x0: e.clientX }; return }
    this._drag = { kind: 'scrub', x0: e.clientX, y0: e.clientY, t: 0, timer: this._longPress(e, (x, yy) => this._rulerMenu(x, yy, this._barAt(x))) }
    this._seek(Math.round(bar * 4) / 4)
  }

  _tempoDown (e, cv, s) {
    const { x, y } = this._local(e, cv); const sl = this.r.scroll.scrollLeft
    const pts = D.tempoPoints(s).map(p => ({ ...p }))
    let hit = pts.findIndex(p => Math.abs(D.barToX(p.bar, this.barPx) - sl - x) <= 8 && Math.abs(D.bpmToY(p.bpm, D.TEMPO_H) - y) <= 10)
    let added = false
    if (hit < 0) {
      const bar = this._snapBar(this._barAt(e.clientX))
      if (bar <= 1) hit = 0
      else { const ex = pts.findIndex(p => p.bar === bar); if (ex >= 0) hit = ex; else { pts.push({ bar, bpm: D.yToBpm(y, D.TEMPO_H) }); pts.sort((a, b) => a.bar - b.bar); hit = pts.findIndex(p => p.bar === bar); added = true } }
    }
    this._tempoSel = hit; this._autoSel = null
    this._drag = { kind: 'tempo', cv, pts, ref: pts[hit], added, moved: false, x0: e.clientX, y0: e.clientY }
    this._tempoDraft = pts; this._drawAll()
  }

  _autoDown (e, cv, s) {
    const target = cv.dataset.target; const param = this._autoOpen.get(target); if (!param) return
    const { x, y } = this._local(e, cv); const sl = this.r.scroll.scrollLeft
    const a = D.findAuto(s, target, param)
    const pts = (a?.points ?? []).map(p => ({ ...p }))
    let hit = pts.findIndex(p => Math.abs(D.barToX(p.bar, this.barPx) - sl - x) <= 8 && Math.abs(D.valToY(param, p.value, D.AUTO_H) - y) <= 10)
    if (hit >= 0 && e.altKey) { pts[hit].curve = pts[hit].curve === 'step' ? 'linear' : 'step'; this._autoCommit(target, param, pts); return }
    let added = false
    if (hit < 0) {
      const bar = this._snapBar(this._barAt(e.clientX))
      pts.push({ bar, value: D.yToVal(param, y, D.AUTO_H), curve: 'linear' }); pts.sort((p, q) => p.bar - q.bar)
      hit = pts.findIndex(p => p.bar === bar); added = true
    }
    this._autoSel = { target, index: hit }; this._tempoSel = -1
    this._drag = { kind: 'auto', cv, target, param, pts, ref: pts[hit], added, moved: false, x0: e.clientX, y0: e.clientY }
    this._autoDraft = { target, param, points: pts }; this._drawAll()
  }

  _knobDown (e, kn) {
    e.preventDefault()
    const s = this._song(); const l = this._lane(kn.dataset.lane, s); if (!l) return
    const key = kn.dataset.kn
    const v0 = key === 'pan' ? l.pan : l.sends[key]
    try { kn.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
    this._drag = { kind: 'knob', el: kn, lane: l.id, key, v0, y0: e.clientY, min: num(kn.dataset.min), max: num(kn.dataset.max, 1), began: false }
  }
  _knobKey (e, kn) {
    const s = this._song(); const l = this._lane(kn.dataset.lane, s); if (!l) return false
    const key = kn.dataset.kn; const min = num(kn.dataset.min); const max = num(kn.dataset.max, 1)
    const cur = key === 'pan' ? l.pan : l.sends[key]; const step = (max - min) * (e.shiftKey ? 0.01 : 0.05)
    let v
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v = cur + step; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v = cur - step
    else if (e.key === 'Home') v = num(kn.dataset.def); else if (e.key === 'End') v = max; else return false
    this._setLane(l.id, key, clamp(Math.round(v * 100) / 100, min, max), `lane:${l.id}:${key}`)
    return true
  }

  _move (e) {
    if (e.pointerType === 'touch' && this._touches.has(e.pointerId)) { this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this._pinch) { this._doPinch(); return } }
    const d = this._drag; if (!d || this._dead) return
    const far = Math.hypot(e.clientX - (d.x0 ?? e.clientX), e.clientY - (d.y0 ?? e.clientY))
    if (d.timer && far > 6) { clearTimeout(d.timer); d.timer = 0 }
    if (d.fired) return
    const s = this._song(); if (!s) return
    switch (d.kind) {
      case 'move': case 'rl': case 'rr': {
        if (!d.moved && far < 4) return
        if (!d.moved) { d.moved = true; d.el.style.zIndex = 5 }
        const bar = this._barAt(e.clientX); const bp = this.barPx
        if (d.kind === 'move') {
          d.start = this._snapBar(bar - d.grab)
          const l = this._laneAtY(e.clientY); const cur = this._lane(d.c0.lane, s)
          if (l && cur && l.kind === cur.kind) d.lane = l.id
          const track = this._tracks.get(d.lane); if (track && d.el.parentNode !== track) track.appendChild(d.el)
          d.el.style.left = ((d.start - 1) * bp) + 'px'
        } else if (d.kind === 'rr') {
          const end = Math.max(d.c0.startBar + 0.25, this._snapBar(bar)); d.len = D.roundBar(end - d.c0.startBar)
          d.el.style.width = Math.max(3, d.len * bp) + 'px'
        } else {
          const end = d.c0.startBar + d.c0.lengthBars; const st = clamp(this._snapBar(bar), 1, end - 0.25); d.start = st; d.len = D.roundBar(end - st)
          d.el.style.left = ((st - 1) * bp) + 'px'; d.el.style.width = Math.max(3, d.len * bp) + 'px'
        }
        return
      }
      case 'scrub': { if (d.timer) { clearTimeout(d.timer); d.timer = 0 } const t = nowMs(); if (t - d.t >= 60) { d.t = t; this._seek(Math.round(this._barAt(e.clientX) * 4) / 4) } return }
      case 'loop': { d.b = this._snapBar(this._barAt(e.clientX)); return }
      case 'tempo': {
        const { y } = this._local(e, d.cv); d.moved = true
        d.ref.bpm = D.yToBpm(y, D.TEMPO_H)
        if (d.ref.bar > 1) d.ref.bar = Math.max(2, this._snapBar(this._barAt(e.clientX)))
        d.pts.sort((a, b) => a.bar - b.bar); this._tempoSel = d.pts.indexOf(d.ref)
        this._drawAll(); return
      }
      case 'auto': {
        const { y } = this._local(e, d.cv); d.moved = true
        d.ref.value = D.yToVal(d.param, y, D.AUTO_H); d.ref.bar = this._snapBar(this._barAt(e.clientX))
        d.pts.sort((a, b) => a.bar - b.bar); this._autoSel = { target: d.target, index: d.pts.indexOf(d.ref) }
        this._drawAll(); return
      }
      case 'knob': {
        const dy = d.y0 - e.clientY; if (!d.began && Math.abs(dy) < 2) return
        if (!d.began) { d.began = true; this.svc.beginStroke(this.nodeId) }
        const v = clamp(Math.round((d.v0 + dy / 140 * (d.max - d.min) * (e.shiftKey ? 0.2 : 1)) * 100) / 100, d.min, d.max)
        this._setLane(d.lane, d.key, v)
        return
      }
      default:
    }
  }

  _up (e) {
    if (this._dead) return
    if (e.pointerType === 'touch') { this._touches.delete(e.pointerId); if (this._touches.size < 2) this._pinch = null }
    const d = this._drag; if (!d) return
    this._drag = null
    clearTimeout(d.timer)
    if (d.fired) { this._sync(); return }
    const s = this._song()
    switch (d.kind) {
      case 'move': case 'rl': case 'rr': {
        if (d.moved && s) {
          const c = d.c0
          if (d.kind === 'move' && (d.start !== c.startBar || d.lane !== c.lane)) this._e('clip', (x) => fitLength(SM.moveClip(x, c.id, { startBar: d.start, lane: d.lane })))
          else if (d.kind === 'rr' && d.len !== c.lengthBars) this._e('clip', (x) => fitLength(SM.resizeClip(x, c.id, d.len)))
          else if (d.kind === 'rl' && (d.len !== c.lengthBars)) this._e('clip', (x) => SM.resizeClip(x, c.id, d.len, { fromStart: true }))
          d.el.style.zIndex = ''
        }
        this._clipEls.get(d.id) && (this._clipEls.get(d.id).sig = '')   // force the element to take its real place
        this._sync(); return
      }
      case 'loop': {
        const a = Math.min(d.a, d.b); const b = Math.max(d.a, d.b)
        this._e('loop', (x) => ({ ...x, loop: { on: true, startBar: a, endBar: b > a ? b : a + 1 } })); return
      }
      case 'tempo': {
        this._tempoDraft = null
        if (d.added || d.moved) this._tempoCommit(d.pts)
        this._drawAll(); return
      }
      case 'auto': {
        this._autoDraft = null
        if (d.added || d.moved) this._autoCommit(d.target, d.param, d.pts)
        this._drawAll(); return
      }
      case 'knob': if (d.began) this.svc.endStroke(); return
      default:
    }
  }

  _ctx (e) {
    const t = e.target; const s = this._song(); if (!s || !this.r) return
    const cv = t.closest?.('canvas[data-cv]')
    if (cv?.dataset.cv === 'tempo') {
      e.preventDefault(); const { x, y } = this._local(e, cv); const sl = this.r.scroll.scrollLeft; const pts = D.tempoPoints(s)
      const i = pts.findIndex(p => Math.abs(D.barToX(p.bar, this.barPx) - sl - x) <= 8 && Math.abs(D.bpmToY(p.bpm, D.TEMPO_H) - y) <= 10)
      if (i > 0) this._removeTempoPoint(i); else if (i === 0) this.say('The first tempo point is the base bpm; it cannot be removed.', true)
      return
    }
    if (cv?.dataset.cv === 'auto') {
      e.preventDefault(); const target = cv.dataset.target; const param = this._autoOpen.get(target); const a = D.findAuto(s, target, param); if (!a) return
      const { x, y } = this._local(e, cv); const sl = this.r.scroll.scrollLeft
      const i = a.points.findIndex(p => Math.abs(D.barToX(p.bar, this.barPx) - sl - x) <= 8 && Math.abs(D.valToY(param, p.value, D.AUTO_H) - y) <= 10)
      if (i >= 0) this._removeAutoPoint(target, param, i)
      return
    }
    if (cv?.dataset.cv === 'ruler') { e.preventDefault(); this._rulerMenu(e.clientX, e.clientY, this._barAt(e.clientX)); return }
    const clipEl = t.closest?.('.osg-clip'); if (clipEl) { e.preventDefault(); this._selClip = clipEl.dataset.clip; this._sync(); this._clipMenu(clipEl.dataset.clip, e.clientX, e.clientY); return }
    const track = t.closest?.('.osg-track[data-track]'); if (track) { e.preventDefault(); this._laneMenu(track.dataset.track, e.clientX, e.clientY, this._barAt(e.clientX)) }
  }

  _dbl (e) {
    const t = e.target; const s = this._song(); if (!s) return
    const kn = t.closest?.('.osg-knob'); if (kn) { this._setLane(kn.dataset.lane, kn.dataset.kn, num(kn.dataset.def)); return }
    const cv = t.closest?.('canvas[data-cv]')
    if (cv?.dataset.cv === 'tempo') { const { x, y } = this._local(e, cv); const sl = this.r.scroll.scrollLeft; const i = D.tempoPoints(s).findIndex(p => Math.abs(D.barToX(p.bar, this.barPx) - sl - x) <= 8 && Math.abs(D.bpmToY(p.bpm, D.TEMPO_H) - y) <= 10); if (i > 0) this._removeTempoPoint(i); return }
    if (cv?.dataset.cv === 'auto') { const target = cv.dataset.target; const param = this._autoOpen.get(target); const a = D.findAuto(s, target, param); if (!a) return; const { x, y } = this._local(e, cv); const sl = this.r.scroll.scrollLeft; const i = a.points.findIndex(p => Math.abs(D.barToX(p.bar, this.barPx) - sl - x) <= 8 && Math.abs(D.valToY(param, p.value, D.AUTO_H) - y) <= 10); if (i >= 0) this._removeAutoPoint(target, param, i); return }
    const clipEl = t.closest?.('.osg-clip'); if (clipEl) { const c = s.clips.find(q => q.id === clipEl.dataset.clip); if (c?.ref.type === 'music') this._openPattern(c.ref.id) }
  }

  // ── Menus and popovers ──────────────────────────────────────────────────────

  _closeMenu () { this._menu?.remove(); this._menu = null }
  _openMenu (x, y, items) {
    this._closeMenu(); this._closePop()
    const m = document.createElement('div'); m.className = 'osg-menu'; m.setAttribute('role', 'menu')
    for (const it of items) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = it.label; b.setAttribute('role', 'menuitem'); if (it.disabled) b.disabled = true
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this._closeMenu(); it.fn() })
      m.appendChild(b)
    }
    this._place(m, x, y)
    this._menu = m
    return m
  }
  _place (el, x, y) {
    const hr = this.host.getBoundingClientRect()
    this.host.appendChild(el)
    const w = 240
    el.style.left = clamp(x - hr.left, 0, Math.max(0, (hr.width || 600) - w)) + 'px'
    el.style.top = Math.max(0, y - hr.top + 8) + 'px'
  }
  _rulerMenu (x, y, bar) {
    const b1 = this._snapBar(bar, 1); const s = this._song()
    this._openMenu(x, y, [
      { label: `Add section at bar ${b1}`, fn: () => this._addSection(b1) },
      { label: `Add marker at bar ${b1}`, fn: () => this._addMarker(b1) },
      { label: `Loop 4 bars from bar ${b1}`, fn: () => this._e('loop', (q) => ({ ...q, loop: { on: true, startBar: b1, endBar: b1 + 4 } })) },
      { label: 'Loop start here', fn: () => this._e('loop', (q) => ({ ...q, loop: { ...q.loop, startBar: b1, endBar: Math.max(q.loop.endBar, b1 + 1) } })) },
      { label: 'Loop end here', fn: () => this._e('loop', (q) => ({ ...q, loop: { ...q.loop, endBar: Math.max(2, b1), startBar: Math.min(q.loop.startBar, Math.max(1, b1 - 1)) } })) },
      { label: 'Move playhead here', fn: () => this._seek(bar) },
      ...(s?.loop.on ? [{ label: 'Loop off', fn: () => this._e('loop', (q) => ({ ...q, loop: { ...q.loop, on: false } })) }] : []),
    ])
  }
  _clipMenu (clipId, x, y) {
    const s = this._song(); const c = s?.clips.find(q => q.id === clipId); if (!c) return
    this._selClip = clipId; this._sync()
    const pat = c.ref.type === 'music'
    this._openMenu(x, y, [
      { label: 'Split at playhead', fn: () => this._splitSel() },
      { label: 'Duplicate', fn: () => this._dupSel() },
      { label: 'Delete', fn: () => this._delSel() },
      ...(pat ? [{ label: 'Make unique', fn: () => this._makeUnique() }, { label: 'Open in sequencer', fn: () => this._openPattern(c.ref.id) }] : []),
    ])
  }
  _laneMenu (laneId, x, y, bar) {
    const s = this._song(); const l = this._lane(laneId, s); if (!l) return
    const items = l.kind === 'audio' ? this._assetList.slice(0, 6).map(a => ({ label: `Add "${a.name}" here`, fn: () => this._addFromLibrary({ type: 'audio', id: a.id }, laneId, bar) })) : this._musicIds().slice(0, 6).map(id => ({ label: `Add "${this._label(id)}" here`, fn: () => this._addFromLibrary({ type: 'music', id }, laneId, bar) }))
    this._openMenu(x, y, [...items, { label: this._autoOpen.has(laneId) ? 'Hide automation' : 'Show automation', fn: () => { if (this._autoOpen.has(laneId)) this._autoOpen.delete(laneId); else this._autoOpen.set(laneId, 'volume'); this._sync() } }, { label: 'Delete lane', fn: () => this._act('delLane', { dataset: { lane: laneId } }) }])
  }

  _closePop () { this._pop?.el.remove(); this._pop = null }
  _openSecPop (id, e) {
    const s = this._song(); const sec = s?.sections.find(q => q.id === id); if (!sec) return
    this._closePop(); this._closeMenu()
    const sw = D.SECTION_COLORS.map(c => `<button type="button" data-pact="color" data-color="${c}" style="background:${c}" aria-label="Colour ${c}" ${T('Section colour', 'Sets the colour of this section.')}></button>`).join('')
    const el = this._el(`<div class="osg-pop" data-pop="section" data-id="${esc(id)}">
      <input class="osg-in is-wide" data-pf="name" maxlength="40" aria-label="Section name" ${T('Section name', 'The name shown on the ruler.')}>
      <div class="osg-row2"><label class="osg-lab"><span>start</span><input class="osg-in" type="number" step="1" min="1" data-pf="startBar" aria-label="Section start bar" ${T('Section start', 'The bar where the section starts.')}></label><label class="osg-lab"><span>bars</span><input class="osg-in" type="number" step="1" min="1" data-pf="lengthBars" aria-label="Section length" ${T('Section length', 'How many bars the section lasts.')}></label></div>
      <div class="osg-swatches">${sw}</div>
      <div class="osg-row2"><button type="button" class="osg-btn is-danger" data-pact="delete" ${T('Delete section', 'Removes this section label (the clips stay).')}>Delete</button><button type="button" class="osg-btn" data-pact="close" ${T('Done', 'Closes this box.')}>Done</button></div></div>`)
    const q = (k) => el.querySelector(`[data-pf="${k}"]`)
    q('name').value = sec.name; q('startBar').value = sec.startBar; q('lengthBars').value = sec.lengthBars
    this._pop = { el, kind: 'section', id }
    this._place(el, e ? e.clientX : this.host.getBoundingClientRect().left + HW + 20, e ? e.clientY : this.host.getBoundingClientRect().top + 90)
    const focusName = () => { try { if (this._pop?.el === el) { q('name').focus({ preventScroll: true }); q('name').select?.() } } catch (_) { /* ignore */ } }
    focusName(); setTimeout(focusName, 60)  // the pointer's own focus change lands after pointerdown
  }
  _openMarkerPop (id, e) {
    const s = this._song(); const mk = s?.markers.find(q => q.id === id); if (!mk) return
    this._closePop(); this._closeMenu()
    const el = this._el(`<div class="osg-pop" data-pop="marker" data-id="${esc(id)}">
      <input class="osg-in is-wide" data-pf="name" maxlength="40" aria-label="Marker name" ${T('Marker name', 'The name shown next to the flag.')}>
      <label class="osg-lab"><span>bar</span><input class="osg-in" type="number" step="0.25" min="1" data-pf="bar" aria-label="Marker bar" ${T('Marker bar', 'The bar of the marker.')}></label>
      <div class="osg-row2"><button type="button" class="osg-btn" data-pact="seek" ${T('Go to marker', 'Moves the playhead here.')}>Go to</button><button type="button" class="osg-btn is-danger" data-pact="delete" ${T('Delete marker', 'Removes this marker.')}>Delete</button><button type="button" class="osg-btn" data-pact="close" ${T('Done', 'Closes this box.')}>Done</button></div></div>`)
    el.querySelector('[data-pf="name"]').value = mk.name; el.querySelector('[data-pf="bar"]').value = mk.bar
    this._pop = { el, kind: 'marker', id }
    this._place(el, e ? e.clientX : 40, e ? e.clientY : 40)
  }
  _popEdit (el) {
    const p = this._pop; if (!p) return
    const k = el.dataset.pf; const v = el.type === 'number' ? +el.value : el.value
    if (el.type === 'number' && !Number.isFinite(v)) return
    const list = p.kind === 'section' ? 'sections' : 'markers'
    this._e(p.kind, (x) => ({ ...x, [list]: x[list].map(q => (q.id === p.id ? { ...q, [k]: k === 'name' ? String(v).slice(0, 40) : v } : q)) }))
  }
  _popAct (b, e) {
    e.stopPropagation()
    const p = this._pop; if (!p) return
    const act = b.dataset.pact; const list = p.kind === 'section' ? 'sections' : 'markers'
    if (act === 'close') { this._closePop(); return }
    if (act === 'delete') { this._e(p.kind, (x) => ({ ...x, [list]: x[list].filter(q => q.id !== p.id) })); this._closePop(); return }
    if (act === 'color') { this._e('section', (x) => ({ ...x, sections: x.sections.map(q => (q.id === p.id ? { ...q, color: b.dataset.color } : q)) })); return }
    if (act === 'seek') { const mk = this._song()?.markers.find(q => q.id === p.id); if (mk) this._seek(mk.bar); this._closePop() }
  }

  // ── Drag and drop, import ───────────────────────────────────────────────────

  _dragStart (e) {
    const it = e.target.closest?.('[data-lib]'); if (!it || !e.dataTransfer) return
    try { e.dataTransfer.setData('application/x-omni-song-item', JSON.stringify({ type: it.dataset.lib, id: it.dataset.id })); e.dataTransfer.setData('text/plain', it.textContent.trim().slice(0, 60)); e.dataTransfer.effectAllowed = 'copy' } catch (_) { /* ignore */ }
  }
  _dragOver (e) {
    const types = [...(e.dataTransfer?.types ?? [])]
    const item = types.includes('application/x-omni-song-item'); const files = types.includes('Files')
    if (!item && !files) return
    e.preventDefault()
    try { e.dataTransfer.dropEffect = 'copy' } catch (_) { /* ignore */ }
    if (files) this.host.classList.add('is-drop-files')
    if (item) { const row = e.target.closest?.('.osg-lane, .osg-card'); this.host.querySelectorAll('.is-drop').forEach(n => { if (n !== row) n.classList.remove('is-drop') }); row?.classList.add('is-drop') }
  }
  _dragLeave (e) {
    if (e.relatedTarget && this.host.contains(e.relatedTarget)) return
    this.host.classList.remove('is-drop-files'); this.host.querySelectorAll('.is-drop').forEach(n => n.classList.remove('is-drop'))
  }
  _drop (e) {
    this.host.classList.remove('is-drop-files'); this.host.querySelectorAll('.is-drop').forEach(n => n.classList.remove('is-drop'))
    const dt = e.dataTransfer; if (!dt) return
    let raw = ''
    try { raw = dt.getData('application/x-omni-song-item') } catch (_) { raw = '' }
    if (raw) {
      e.preventDefault()
      let item = null; try { item = JSON.parse(raw) } catch (_) { item = null }
      if (!item || typeof item.id !== 'string') return
      const s = this._song(); if (!s) return
      const row = e.target.closest?.('.osg-lane, .osg-card')
      const lane = row ? row.dataset.lane : this._laneAtY(e.clientY)?.id
      const bar = this.simple ? this._cursor : this._barAt(e.clientX)
      this._addFromLibrary({ type: item.type, id: item.id }, lane ?? null, bar)
      return
    }
    const files = [...(dt.files ?? [])]
    if (files.length) { e.preventDefault(); this._importFiles(files) }
  }
  _pickFile () {
    if (!this._file) {
      const f = document.createElement('input'); f.type = 'file'; f.accept = 'audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac,.opus,.webm'; f.multiple = true; f.hidden = true
      f.setAttribute('data-omni-tip', 'Import audio'); f.setAttribute('data-omni-tip-key', '—'); f.setAttribute('data-omni-tip-desc', 'Choose audio files to import into the audio library.')
      f.dataset.ref = 'file'; this.host.appendChild(f); this._file = f
    }
    this._file.click()
  }
  async _importFiles (files) {
    const a = await loadAssets(this.opts.assets)
    if (!a || typeof a.importFile !== 'function') { this.say('Audio import is not available in this build.', true); return }
    let ok = 0; let last = ''
    for (const f of files) {
      try {
        const r = await a.importFile(f)
        if (r?.ok) { ok++; last = r.meta?.name || f.name } else { this.say(`${f.name || 'The file'}: ${ERRORS[r?.error] || r?.message || 'it could not be imported.'}`, true); }
      } catch (err) { this.say(`${f.name || 'The file'}: ${ERRORS.decode}`, true) }
    }
    if (this._dead) return
    await this._loadAssetList()
    if (ok) this.say(ok === 1 ? `Imported "${last}". Drag it onto an audio lane, or press Add.` : `Imported ${ok} audio files.`)
  }
}
