/**
 * ui/OmniMixerPanel.js — ⟐mniReality OmniMixer
 *
 * Built from scratch, not on top of the uploaded reference player —
 * see the design conversation for why (a single-track vanilla player's
 * structure doesn't stretch to 2 simultaneous looping layers + 2
 * embeds + video slots + a mixer without rewriting nearly everything
 * anyway). The rotating-disc/hover-reveal aesthetic was worth keeping
 * as a reference; the code wasn't.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Channels 1 & 2 — real audio, real mixer control
 * ─────────────────────────────────────────────────────────────────────────────
 * Two independent <audio> elements, both looping, each pulling from
 * ONE SHARED 15-slot library (not 15 each) — "a song on loop and an
 * aesthetic on loop" playing simultaneously. Each channel gets its own
 * volume, playback speed, and Next (cycles the shared library
 * independently per channel — advancing channel 1 doesn't affect what
 * channel 2 is playing).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Channels 3 & 4 — embeds, NOT mixer-controllable, and here's why
 * ─────────────────────────────────────────────────────────────────────────────
 * Verified directly before building this: Spotify's embedded player
 * has no volume control via any public API — this is a long-standing,
 * explicitly acknowledged gap on Spotify's own developer forum, not a
 * missing feature here. Their "iFrame API" for playback control is
 * also reported unreliable for regular tracks/playlists specifically
 * (built around podcasts). So these two channels are iframe embeds
 * with a URL field — real, but honestly not part of the mixer the way
 * channels 1/2 are. The UI says this directly rather than showing a
 * volume slider that silently does nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Video slots — built now, OmniExpression wiring is a separate step
 * ─────────────────────────────────────────────────────────────────────────────
 * Two video slots with a manual "which is active" toggle exist here
 * now. Actually connecting that toggle to OmniExpression's own
 * presenter screen (switching its displayed content when the
 * presenter starts) is a real, separate change to ui/OmniExpression.js
 * itself — not attempted in this pass. This panel dispatches
 * `omni:mixer-active-video-changed` on every switch specifically so
 * that future connection has something to listen for already.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Storage reuse — createWallpaperStore is genuinely generic Blob storage
 * ─────────────────────────────────────────────────────────────────────────────
 * Despite the name, utils/WallpaperStorage.js's factory just stores
 * namespaced Blobs by slot number — nothing image-specific about the
 * implementation. Reused here for the audio library, the video slots,
 * and the skin image, each in their own namespace, rather than
 * building a third near-identical IndexedDB wrapper from scratch.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import OmniDisc from './OmniDisc.js'
import * as WindowManager from './WindowManager.js'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'

const AUDIO_SLOTS = 15
const VIDEO_SLOTS = 2

const audioStore = createWallpaperStore('omnimixer-audio', AUDIO_SLOTS)
const videoStore = createWallpaperStore('omnimixer-video', VIDEO_SLOTS)
const skinStore  = createWallpaperStore('omnimixer-skin', 1)

const STORE_KEY = 'omni:mixer:settings'

function loadSettings () {
  const defaults = {
    channel1: { slot: null, volume: 0.8, speed: 1.0 },
    channel2: { slot: null, volume: 0.6, speed: 1.0 },
    embed3Url: '',
    embed4Url: '',
    activeVideo: 1,
    skin: { color: '#12121c', alpha: 0.88 },
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

const STYLES = /* css */`

.omni-mixer-panel {
  --mx-bg          : var(--omni-theme-bg, rgba(10, 10, 16, 0.92));
  --mx-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --mx-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --mx-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --mx-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --mx-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --mx-accent      : var(--omni-theme-accent, #5ce8c4);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 80px;
  left             : 140px;
  width            : 420px;
  min-width        : 360px;
  max-width        : 94vw;
  height           : 680px;
  min-height       : 420px;
  max-height       : 94vh;

  display          : flex;
  flex-direction   : column;

  background-color : var(--mx-bg);
  background-size  : cover;
  background-position: center;
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--mx-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--mx-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.mx-skin-tint { position: absolute; inset: 0; pointer-events: none; z-index: 0; }

.mx-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--mx-header-bg);
  border-bottom    : 1px solid var(--mx-border);
  cursor           : grab;
  user-select      : none;
  z-index          : 2;
}
.mx-header.is-dragging { cursor: grabbing; }
.mx-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--mx-text-dim); }
.mx-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.mx-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--mx-border);
  background: rgba(255,255,255,0.04);
  color: var(--mx-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.mx-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--mx-text); }

.mx-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; position: relative; z-index: 1; }

.mx-section-title {
  font-size        : 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color            : var(--mx-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top       : 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: space-between;
}
.mx-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.mx-channel {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--mx-border);
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 10px;
}
.mx-channel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mx-channel-name { font-size: 10px; color: var(--mx-text-dim); }
.mx-track-name { font-size: 9px; color: var(--mx-text-muted); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mx-transport { display: flex; gap: 6px; margin-bottom: 8px; }
.mx-tbtn {
  flex: 1; background: rgba(255,255,255,0.06); border: 1px solid var(--mx-border);
  color: var(--mx-text-dim); border-radius: 6px; padding: 7px 4px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer;
}
.mx-tbtn:hover { background: rgba(255,255,255,0.12); color: var(--mx-text); }
.mx-tbtn.is-active { background: rgba(92, 232, 196, 0.18); border-color: rgba(92, 232, 196, 0.45); color: var(--mx-accent); }

.mx-slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.mx-slider-label { width: 42px; font-size: 9px; color: var(--mx-text-muted); }
.mx-slider { flex: 1; accent-color: var(--mx-accent); }
.mx-slider-val { width: 32px; text-align: right; font-size: 8.5px; color: var(--mx-text-muted); }

.mx-lib-toggle { font-size: 9px; color: var(--mx-accent); cursor: pointer; text-decoration: underline; }
.mx-lib-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 6px; }
.mx-lib-slot {
  aspect-ratio: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--mx-border);
  border-radius: 5px; color: var(--mx-text-muted); font-size: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; position: relative;
}
.mx-lib-slot:hover { background: rgba(255,255,255,0.1); }
.mx-lib-slot.is-filled { border-color: rgba(92, 232, 196, 0.35); color: var(--mx-text-dim); }
.mx-lib-slot.is-loaded-ch1 { box-shadow: inset 0 0 0 1.5px #5ce8c4; }
.mx-lib-slot.is-loaded-ch2 { box-shadow: inset 0 0 0 1.5px #ff9de2; }
.mx-lib-remove {
  position: absolute; top: 1px; right: 1px; width: 12px; height: 12px; border-radius: 3px;
  background: rgba(255,100,100,0.25); border: none; color: rgba(255,190,190,0.9);
  font-size: 7px; line-height: 1; cursor: pointer; display: none;
}
.mx-lib-slot.is-filled .mx-lib-remove { display: block; }

.mx-embed-frame { width: 100%; height: 152px; border: none; border-radius: 8px; margin-top: 6px; background: #000; }
.mx-url-row { display: flex; gap: 6px; }
.mx-url-input {
  flex: 1; background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px; color: var(--mx-text); font-family: var(--mono); font-size: 9.5px; padding: 6px 8px;
}
.mx-go-btn {
  background: rgba(92, 232, 196, 0.14); border: 1px solid rgba(92, 232, 196, 0.4);
  color: var(--mx-accent); border-radius: 5px; padding: 0 12px; font-family: var(--mono); font-size: 10px; cursor: pointer;
}

.mx-video-slot { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.mx-video-preview { width: 64px; height: 40px; background: #000; border-radius: 5px; border: 1px solid var(--mx-border); object-fit: cover; }
.mx-video-file-input { display: none; }

.mx-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.mx-row-label { font-size: 10px; color: var(--mx-text-dim); }
.mx-color-input { width: 44px; height: 24px; border: 1px solid var(--mx-border); border-radius: 4px; background: none; cursor: pointer; }
.mx-num-input {
  width: 70px; background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 4px; color: var(--mx-text); font-family: var(--mono); font-size: 9.5px; padding: 4px 6px;
}
.mx-skin-btn {
  background: rgba(92, 232, 196, 0.14); border: 1px solid rgba(92, 232, 196, 0.4);
  color: var(--mx-accent); border-radius: 5px; padding: 6px 12px; font-family: var(--mono); font-size: 9.5px; cursor: pointer;
}
.mx-skin-file-input { display: none; }

.mx-note { font-size: 9px; color: var(--mx-text-muted); line-height: 1.5; margin-top: 6px; }

.mx-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; z-index: 2; }
.mx-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-mixer-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-mixer-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniMixerPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._state = loadSettings()
    this._filledAudioSlots = new Set()
    this._filledVideoSlots = new Set()
    this._pendingAudioSlot = null
    this._pendingVideoSlot = null
    this._audioEls = { 1: null, 2: null }
    this._videoEls = { 1: null, 2: null }
    this._onNavSelect = null
    this._libraryOpen = { 1: false, 2: false }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniMixer') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    Object.values(this._audioEls).forEach(el => el?.pause())
    Object.values(this._videoEls).forEach(el => el?.pause())
    this._disc?.destroy()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnimixer')
  }

  open () {
    const firstOpen = !this._el
    if (firstOpen) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
    if (firstOpen) {
      this._refreshLibrary(1)
      this._refreshLibrary(2)
      this._refreshVideoSlots()
      this._applySkin()
    }
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'omnimixer', label: '⟐OmniMixer', iconLabel: '⟐M',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-mixer-panel'
    const s = this._state

    const audioChannel = (num) => `
      <div class="mx-channel" data-channel="${num}">
        <div class="mx-channel-head">
          <span class="mx-channel-name">Channel ${num}</span>
          <span class="mx-track-name" id="mx-track-name-${num}">No track loaded</span>
        </div>
        <div class="mx-transport">
          <button class="mx-tbtn" data-action="play" data-ch="${num}">Go</button>
          <button class="mx-tbtn" data-action="stop" data-ch="${num}">Stop</button>
          <button class="mx-tbtn" data-action="next" data-ch="${num}">Next</button>
        </div>
        <div class="mx-slider-row">
          <span class="mx-slider-label">Volume</span>
          <input type="range" class="mx-slider" data-slider="volume" data-ch="${num}" min="0" max="1" step="0.01" value="${s['channel' + num].volume}">
          <span class="mx-slider-val" data-val="volume-${num}">${s['channel' + num].volume.toFixed(2)}</span>
        </div>
        <div class="mx-slider-row">
          <span class="mx-slider-label">Speed</span>
          <input type="range" class="mx-slider" data-slider="speed" data-ch="${num}" min="0.25" max="2" step="0.05" value="${s['channel' + num].speed}">
          <span class="mx-slider-val" data-val="speed-${num}">${s['channel' + num].speed.toFixed(2)}</span>
        </div>
        <span class="mx-lib-toggle" data-lib-toggle="${num}">Browse library (${AUDIO_SLOTS} slots)</span>
        <div class="mx-lib-grid" id="mx-lib-grid-${num}" style="display:none"></div>
      </div>
    `

    el.innerHTML = `
      <div class="mx-skin-tint" id="mx-skin-tint"></div>
      <div class="mx-header">
        <span class="mx-title">OmniMixer</span>
        <div class="mx-controls">
          <button class="mx-ctrl" data-action="minimize" title="Minimize">-</button>
          <button class="mx-ctrl" data-action="close" title="Close">x</button>
        </div>
      </div>
      <div class="mx-body">
        <div class="mx-section-title">Channel 1 &amp; 2 - Audio (looping)</div>
        ${audioChannel(1)}
        ${audioChannel(2)}

        <div class="mx-section-title">Channel 3 &amp; 4 - Embeds</div>
        <div class="mx-note">
          These play through an external site's own embed (Spotify,
          etc.) - verified directly that Spotify's embed has no public
          volume API at all, so these aren't part of the mixer above,
          just linked panels with their own built-in controls.
        </div>
        <div class="mx-channel">
          <div class="mx-channel-head"><span class="mx-channel-name">Channel 3</span></div>
          <div class="mx-url-row">
            <input type="text" class="mx-url-input" id="mx-embed3-url" placeholder="Spotify playlist/track embed URL..." value="${s.embed3Url}">
            <button class="mx-go-btn" data-embed-go="3">Go</button>
          </div>
          <iframe class="mx-embed-frame" id="mx-embed3-frame" ${s.embed3Url ? `src="${s.embed3Url}"` : ''}></iframe>
        </div>
        <div class="mx-channel">
          <div class="mx-channel-head"><span class="mx-channel-name">Channel 4</span></div>
          <div class="mx-url-row">
            <input type="text" class="mx-url-input" id="mx-embed4-url" placeholder="Any embeddable URL..." value="${s.embed4Url}">
            <button class="mx-go-btn" data-embed-go="4">Go</button>
          </div>
          <iframe class="mx-embed-frame" id="mx-embed4-frame" ${s.embed4Url ? `src="${s.embed4Url}"` : ''}></iframe>
        </div>

        <div class="mx-section-title">Video Slots</div>
        <div class="mx-note">
          Reserved for OmniExpression's presenter screen - switching
          the presenter's actual displayed video when it starts is a
          separate connection, not built yet. This just loads/previews
          the two sources and picks which is "active" for now.
        </div>
        <div class="mx-video-slot">
          <video class="mx-video-preview" id="mx-video-preview-1" muted></video>
          <button class="mx-tbtn" data-video-browse="1">Browse / Upload</button>
          <button class="mx-tbtn ${s.activeVideo === 1 ? 'is-active' : ''}" data-video-active="1">Active</button>
        </div>
        <div class="mx-video-slot">
          <video class="mx-video-preview" id="mx-video-preview-2" muted></video>
          <button class="mx-tbtn" data-video-browse="2">Browse / Upload</button>
          <button class="mx-tbtn ${s.activeVideo === 2 ? 'is-active' : ''}" data-video-active="2">Active</button>
        </div>
        <input type="file" accept="video/*" class="mx-video-file-input" id="mx-video-file-input">

        <div class="mx-section-title">Skin</div>
        <button class="mx-skin-btn" id="mx-skin-browse">Browse for Skin Image</button>
        <input type="file" accept="image/*" class="mx-skin-file-input" id="mx-skin-file-input">
        <div class="mx-row" style="margin-top:8px">
          <span class="mx-row-label">Tint Color</span>
          <input type="color" class="mx-color-input" id="mx-skin-color" value="${s.skin.color}">
        </div>
        <div class="mx-row">
          <span class="mx-row-label">Tint Alpha</span>
          <input type="number" class="mx-num-input" id="mx-skin-alpha" min="0" max="1" step="0.05" value="${s.skin.alpha}">
        </div>
        <div class="mx-note">Tint applies over the skin image (or alone, if no skin is set) - instant, no save button.</div>
      </div>
      <div class="mx-resize-handle" aria-hidden="true"></div>
    `

    this._audioEls[1] = new Audio(); this._audioEls[1].loop = true
    this._audioEls[2] = new Audio(); this._audioEls[2].loop = true
    this._videoEls[1] = el.querySelector('#mx-video-preview-1')
    this._videoEls[2] = el.querySelector('#mx-video-preview-2')

    this._bindHeader(el)
    this._bindResize(el)
    this._bindAudioControls(el)
    this._bindEmbedControls(el)
    this._bindVideoControls(el)
    this._bindSkinControls(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'omnimixer'
    WindowManager.register('omnimixer', el, 'OmniMixer')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    // "We have never had an item like this before" — a genuinely new,
    // reusable primitive (see ui/OmniDisc.js), not something specific
    // to this panel. Tied here to channel 1's playback: spins while
    // it plays, still while stopped.
    this._disc = new OmniDisc(el, { initialT: 0.08 }).attach()

    return el
  }

  // ── Channels 1 & 2 - real audio ──────────────────────────────────────────

  _bindAudioControls (el) {
    el.querySelectorAll('[data-action]').forEach(btn => {
      const ch = Number(btn.dataset.ch)
      if (!ch) return
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'play') this._playChannel(ch)
        if (btn.dataset.action === 'stop') this._stopChannel(ch)
        if (btn.dataset.action === 'next') this._nextTrack(ch)
      })
    })

    el.querySelectorAll('[data-slider]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const ch = Number(slider.dataset.ch)
        const kind = slider.dataset.slider
        const value = Number(e.target.value)
        this._state[`channel${ch}`][kind] = value
        el.querySelector(`[data-val="${kind}-${ch}"]`).textContent = value.toFixed(2)
        if (kind === 'volume') this._audioEls[ch].volume = value
        if (kind === 'speed') this._audioEls[ch].playbackRate = value
        saveSettings(this._state)
      })
    })

    el.querySelectorAll('[data-lib-toggle]').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const ch = Number(toggle.dataset.libToggle)
        this._libraryOpen[ch] = !this._libraryOpen[ch]
        const grid = el.querySelector(`#mx-lib-grid-${ch}`)
        grid.style.display = this._libraryOpen[ch] ? 'grid' : 'none'
      })
    })
  }

  async _refreshLibrary (ch) {
    if (!this._el) return
    let list = []
    try { list = await audioStore.listWallpapers() } catch (_) {}
    this._filledAudioSlots = new Set(list.map(w => w.slot))

    const grid = this._el.querySelector(`#mx-lib-grid-${ch}`)
    grid.innerHTML = ''
    for (let i = 1; i <= AUDIO_SLOTS; i++) {
      const filled = this._filledAudioSlots.has(i)
      const btn = document.createElement('button')
      btn.className = 'mx-lib-slot' + (filled ? ' is-filled' : '')
      if (this._state[`channel${ch}`].slot === i) btn.classList.add(`is-loaded-ch${ch}`)
      btn.innerHTML = `<button class="mx-lib-remove" data-remove-audio-slot="${i}">x</button><span>${i}</span>`
      btn.dataset.audioSlot = i
      grid.appendChild(btn)
    }

    grid.querySelectorAll('[data-remove-audio-slot]').forEach(rm => {
      rm.addEventListener('click', (e) => {
        e.stopPropagation()
        const slot = Number(rm.dataset.removeAudioSlot)
        audioStore.deleteWallpaper(slot).then(() => { this._refreshLibrary(1); this._refreshLibrary(2) })
      })
    })
    grid.querySelectorAll('[data-audio-slot]').forEach(slotBtn => {
      slotBtn.addEventListener('click', async () => {
        const slot = Number(slotBtn.dataset.audioSlot)
        if (this._filledAudioSlots.has(slot)) {
          await this._loadTrackIntoChannel(ch, slot)
        } else {
          this._pendingAudioSlot = { ch, slot }
          this._openAudioFilePicker()
        }
      })
    })
  }

  _openAudioFilePicker () {
    if (!this._audioFileInput) {
      this._audioFileInput = document.createElement('input')
      this._audioFileInput.type = 'file'
      this._audioFileInput.accept = 'audio/*'
      this._audioFileInput.style.display = 'none'
      document.body.appendChild(this._audioFileInput)
      this._audioFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]
        const pending = this._pendingAudioSlot
        e.target.value = ''
        if (!file || !pending) return
        try {
          await audioStore.saveWallpaper(pending.slot, file, file.name)
          await this._refreshLibrary(1); await this._refreshLibrary(2)
          await this._loadTrackIntoChannel(pending.ch, pending.slot)
        } catch (err) {
          window.alert(`Could not save track: ${err?.message ?? err}`)
        }
      })
    }
    this._audioFileInput.click()
  }

  async _loadTrackIntoChannel (ch, slot) {
    const record = await audioStore.loadWallpaper(slot)
    if (!record) return
    const url = URL.createObjectURL(record.blob)
    this._audioEls[ch].src = url
    this._audioEls[ch].volume = this._state[`channel${ch}`].volume
    this._audioEls[ch].playbackRate = this._state[`channel${ch}`].speed
    this._state[`channel${ch}`].slot = slot
    saveSettings(this._state)
    this._el.querySelector(`#mx-track-name-${ch}`).textContent = record.name || `Slot ${slot}`
    this._refreshLibrary(1); this._refreshLibrary(2)
    // Loading a track (by upload or by picking a library slot) is
    // itself a direct user gesture, so it's the right moment to play
    // automatically — "I uploaded a song and heard nothing" shouldn't
    // require a second, separate click on Go to actually hear it.
    this._playChannel(ch)
  }

  _playChannel (ch) {
    const audio = this._audioEls[ch]
    if (!audio?.src) return
    audio.play().then(() => {
      if (ch === 1) this._disc?.setSpinning(true)
    }).catch((err) => {
      // This used to be .catch(() => {}) — a real playback failure
      // (autoplay policy, unsupported format, a bad blob URL) was
      // silently swallowed with zero indication anything went wrong,
      // which is exactly what "uploaded a song and nothing happened"
      // looks like from the outside. Now it's visible.
      const label = this._el?.querySelector(`#mx-track-name-${ch}`)
      if (label) label.textContent = `⚠ Playback failed: ${err?.message ?? err}`
      console.warn(`⟐OmniMixer — channel ${ch} playback failed:`, err)
    })
  }

  _stopChannel (ch) {
    const a = this._audioEls[ch]
    if (a) { a.pause(); a.currentTime = 0 }
    if (ch === 1) this._disc?.setSpinning(false)
  }

  async _nextTrack (ch) {
    const filled = [...this._filledAudioSlots].sort((a, b) => a - b)
    if (filled.length === 0) return
    const current = this._state[`channel${ch}`].slot
    const currentIdx = filled.indexOf(current)
    const nextSlot = filled[(currentIdx + 1) % filled.length]
    await this._loadTrackIntoChannel(ch, nextSlot)   // already plays — see above
  }

  // ── Channels 3 & 4 - embeds ───────────────────────────────────────────────

  _bindEmbedControls (el) {
    el.querySelectorAll('[data-embed-go]').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = btn.dataset.embedGo
        const url = el.querySelector(`#mx-embed${n}-url`).value.trim()
        this._state[`embed${n}Url`] = url
        el.querySelector(`#mx-embed${n}-frame`).src = url
        saveSettings(this._state)
      })
    })
  }

  // ── Video slots ───────────────────────────────────────────────────────────

  _bindVideoControls (el) {
    const fileInput = el.querySelector('#mx-video-file-input')
    el.querySelectorAll('[data-video-browse]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._pendingVideoSlot = Number(btn.dataset.videoBrowse)
        fileInput.click()
      })
    })
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      const slot = this._pendingVideoSlot
      e.target.value = ''
      if (!file || !slot) return
      try {
        await videoStore.saveWallpaper(slot, file, file.name)
        await this._loadVideoIntoSlot(slot)
      } catch (err) {
        window.alert(`Could not save video: ${err?.message ?? err}`)
      }
    })

    el.querySelectorAll('[data-video-active]').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.dataset.videoActive)
        this._state.activeVideo = slot
        saveSettings(this._state)
        el.querySelectorAll('[data-video-active]').forEach(b => b.classList.toggle('is-active', Number(b.dataset.videoActive) === slot))
        window.dispatchEvent(new CustomEvent('omni:mixer-active-video-changed', { detail: { activeVideo: slot } }))
      })
    })
  }

  async _loadVideoIntoSlot (slot) {
    const record = await videoStore.loadWallpaper(slot)
    if (!record) return
    const url = URL.createObjectURL(record.blob)
    this._videoEls[slot].src = url
    this._videoEls[slot].play().catch((err) => {
      console.warn(`⟐OmniMixer — video slot ${slot} playback failed:`, err)
    })
  }

  async _refreshVideoSlots () {
    let list = []
    try { list = await videoStore.listWallpapers() } catch (_) {}
    this._filledVideoSlots = new Set(list.map(w => w.slot))
    for (const slot of this._filledVideoSlots) await this._loadVideoIntoSlot(slot)
  }

  // ── Skin + RGBA ──────────────────────────────────────────────────────────

  _bindSkinControls (el) {
    const fileInput = el.querySelector('#mx-skin-file-input')
    el.querySelector('#mx-skin-browse').addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        await skinStore.saveWallpaper(1, file, file.name)
        this._applySkin()
      } catch (err) {
        window.alert(`Could not save skin: ${err?.message ?? err}`)
      }
    })

    el.querySelector('#mx-skin-color').addEventListener('input', (e) => {
      this._state.skin.color = e.target.value
      saveSettings(this._state)
      this._applyTint()
    })
    el.querySelector('#mx-skin-alpha').addEventListener('input', (e) => {
      this._state.skin.alpha = Number(e.target.value)
      saveSettings(this._state)
      this._applyTint()
    })
  }

  async _applySkin () {
    if (!this._el) return
    try {
      const record = await skinStore.loadWallpaper(1)
      if (record) {
        const url = URL.createObjectURL(record.blob)
        this._el.style.backgroundImage = `url(${url})`
      }
    } catch (_) {}
    this._applyTint()
  }

  _applyTint () {
    if (!this._el) return
    const tint = this._el.querySelector('#mx-skin-tint')
    const { color, alpha } = this._state.skin
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    tint.style.background = `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // ── Header drag / resize - same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.mx-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top: this._drag.originY + (cy - this._drag.startY) })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }

    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.mx-resize-handle')
    if (!handle) return
    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy
      resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
