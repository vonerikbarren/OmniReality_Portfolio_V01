/**
 * ui/OmniExpressionVideoPlayer.js — ⟐mniReality OmniExpressionVideoPlayer
 *
 * "Literally what it is" — a dedicated video player panel for
 * OmniExpression's main avatar video, reached via the new Admin-style
 * submenu wrapper on ⟐OmniExpression (slot 2, "UserPresenterVideoSettings").
 *
 * Built as its own panel rather than an Inspector-style layout with a
 * geometry-preview above it — a video doesn't have the "does this
 * look right before I place it" question a geometry preview exists to
 * answer, it's just playback.
 *
 * Video section comes first (confirmed ordering) — play/pause and a
 * real timeline scrubber, driven by the actual video's own timeupdate
 * event via omni:expression-video-timeupdate, not a fake/simulated
 * progress bar. Playback control (play/pause/seek) is dispatched as
 * omni:expression-video-control — transient actions, not persisted
 * state, which is why they're a separate event from
 * omni:expression-state-set.
 *
 * Backing circles are image-only here, on purpose — even though the
 * underlying mechanism in OmniExpression.js technically supports
 * video on a circle too, this panel never exposes that option. Circles
 * exist to give the avatar resonance and meaning, not to carry footage.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'

const videoStore = createWallpaperStore('omniexpression-video', 1)
const circleStore = createWallpaperStore('omniexpression-circles', 3)

const CIRCLES = [
  { id: 'life', label: 'Circle of Life' },
  { id: 'time', label: 'Circle of Time' },
  { id: 'choice', label: 'Circle of Choice' },
]

const STORE_KEY = 'omni:expression:videoplayer:settings'
function loadSettings () {
  const defaults = { circleRotationEnabled: true, circleRotationSpeed: 0.3 }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

function formatTime (t) {
  if (!isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

const STYLES = `

.omni-expr-video-player {
  --evp-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --evp-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --evp-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --evp-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --evp-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --evp-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --evp-accent      : var(--omni-theme-accent, #c9a3ff);
  --mono            : 'Courier New', Courier, monospace;

  position         : fixed;
  top               : 90px;
  left              : 300px;
  width             : 360px;
  min-width         : 300px;
  max-width         : 90vw;
  height            : 560px;
  min-height        : 360px;
  max-height        : 92vh;

  display           : flex;
  flex-direction    : column;

  background        : var(--evp-bg);
  backdrop-filter   : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border            : 1px solid var(--evp-border);
  border-radius     : 14px;
  box-shadow        : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family       : var(--mono);
  color             : var(--evp-text);
  z-index           : 60;
  overflow          : hidden;
  pointer-events    : auto;
  resize            : both;

  opacity           : 0;
  transform         : scale(0.94);
}

.evp-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--evp-header-bg);
  border-bottom    : 1px solid var(--evp-border);
  cursor           : grab;
  user-select      : none;
}
.evp-header.is-dragging { cursor: grabbing; }
.evp-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--evp-text-dim); }
.evp-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.evp-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--evp-border);
  background: rgba(255,255,255,0.04);
  color: var(--evp-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.evp-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--evp-text); }

.evp-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; }

.evp-section-title {
  font-size        : 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color            : var(--evp-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top       : 1px solid rgba(255,255,255,0.06);
}
.evp-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.evp-transport { display: flex; gap: 6px; margin-bottom: 8px; align-items: center; }
.evp-play-btn {
  width: 40px; height: 34px; background: rgba(201,163,255,0.14); border: 1px solid rgba(201,163,255,0.4);
  color: var(--evp-accent); border-radius: 6px; font-family: var(--mono); font-size: 14px; cursor: pointer;
}
.evp-time { font-size: 9px; color: var(--evp-text-muted); width: 76px; text-align: center; }
.evp-scrub {
  flex: 1; accent-color: var(--evp-accent);
}
.evp-upload-btn {
  background: rgba(255,255,255,0.06); border: 1px solid var(--evp-border);
  color: var(--evp-text-dim); border-radius: 6px; padding: 8px; font-family: var(--mono);
  font-size: 9.5px; cursor: pointer; width: 100%; margin-top: 6px;
}
.evp-upload-btn:hover { background: rgba(255,255,255,0.12); color: var(--evp-text); }
.evp-file-input { display: none; }
.evp-no-video-note { font-size: 9px; color: var(--evp-text-muted); line-height: 1.5; }

.evp-circle-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.evp-circle-label { flex: 1; font-size: 10px; color: var(--evp-text-dim); }
.evp-circle-btn {
  background: rgba(255,255,255,0.06); border: 1px solid var(--evp-border);
  color: var(--evp-text-dim); border-radius: 6px; padding: 6px 10px; font-family: var(--mono);
  font-size: 9px; cursor: pointer;
}
.evp-circle-btn.is-filled { border-color: rgba(201,163,255,0.4); color: var(--evp-accent); }
.evp-circle-note { font-size: 9px; color: var(--evp-text-muted); line-height: 1.5; margin-top: 4px; }

.evp-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.evp-row-label { font-size: 10px; color: var(--evp-text-dim); }
.evp-toggle {
  width: 34px; height: 18px; border-radius: 10px;
  border: 1px solid var(--evp-border);
  background: rgba(255,255,255,0.08);
  position: relative; cursor: pointer; flex-shrink: 0;
}
.evp-toggle::after {
  content: ''; position: absolute; top: 1px; left: 1px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--evp-text-dim);
  transition: transform 0.15s ease, background 0.15s ease;
}
.evp-toggle.is-on { background: rgba(201,163,255,0.3); border-color: rgba(201,163,255,0.5); }
.evp-toggle.is-on::after { transform: translateX(16px); background: var(--evp-accent); }
.evp-slider-row { display: flex; align-items: center; gap: 8px; }
.evp-slider { flex: 1; accent-color: var(--evp-accent); }
.evp-slider-val { width: 32px; text-align: right; font-size: 8.5px; color: var(--evp-text-muted); }

.evp-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.evp-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-expr-video-player-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-expr-video-player-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniExpressionVideoPlayer {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._state = loadSettings()
    this._hasVideo = false
    this._playing = false
    this._duration = 0
    this._scrubbing = false
    this._onNavSelect = null
    this._onTimeUpdate = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐UserPresenterVideoSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onTimeUpdate = (e) => {
      this._hasVideo = true
      this._duration = e.detail.duration
      this._playing = !e.detail.paused
      this._updateTransportUI(e.detail.currentTime, e.detail.duration)
    }
    window.addEventListener('omni:expression-video-timeupdate', this._onTimeUpdate)

    // Apply saved rotation settings on boot, same as any other
    // settings panel would.
    window.dispatchEvent(new CustomEvent('omni:expression-state-set', {
      detail: { circleRotation: { enabled: this._state.circleRotationEnabled, speed: this._state.circleRotationSpeed } }
    }))
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:expression-video-timeupdate', this._onTimeUpdate)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniexpressionvideoplayer')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
    this._refreshCircleSlots()
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
        id: 'omniexpressionvideoplayer', label: '⟐UserPresenterVideoSettings', iconLabel: '⟐V',
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

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-expr-video-player'
    const s = this._state

    const circleRows = CIRCLES.map(c => `
      <div class="evp-circle-row">
        <span class="evp-circle-label">${c.label}</span>
        <button class="evp-circle-btn" data-circle="${c.id}">Browse Image</button>
      </div>
    `).join('')

    el.innerHTML = `
      <div class="evp-header">
        <span class="evp-title">OmniExpressionVideoPlayer</span>
        <div class="evp-controls">
          <button class="evp-ctrl" data-action="minimize" title="Minimize">-</button>
          <button class="evp-ctrl" data-action="close" title="Close">x</button>
        </div>
      </div>
      <div class="evp-body">
        <div class="evp-section-title">Video</div>
        <div class="evp-transport">
          <button class="evp-play-btn" id="evp-play">&#9654;</button>
          <span class="evp-time" id="evp-time">0:00 / 0:00</span>
        </div>
        <input type="range" class="evp-scrub" id="evp-scrub" min="0" max="100" step="0.1" value="0">
        <button class="evp-upload-btn" id="evp-upload-video">Browse / Upload Video</button>
        <input type="file" accept="video/*" class="evp-file-input" id="evp-video-file-input">
        <div class="evp-no-video-note" id="evp-no-video-note">No video loaded yet — browse to add one. It loops automatically once loaded.</div>

        <div class="evp-section-title">Backing Circles (image only)</div>
        ${circleRows}
        <input type="file" accept="image/*" class="evp-file-input" id="evp-circle-file-input">
        <div class="evp-circle-note">Circles only ever take an image, even though the underlying system can technically hold video — they're meant to give the avatar resonance, not carry footage.</div>

        <div class="evp-section-title">Rotation</div>
        <div class="evp-row">
          <span class="evp-row-label">Enabled (alternating CW / CCW by depth)</span>
          <button class="evp-toggle ${s.circleRotationEnabled ? 'is-on' : ''}" id="evp-rotation-toggle"></button>
        </div>
        <div class="evp-slider-row">
          <span class="evp-row-label" style="width:40px">Speed</span>
          <input type="range" class="evp-slider" id="evp-rotation-speed" min="0" max="1.5" step="0.05" value="${s.circleRotationSpeed}">
          <span class="evp-slider-val" id="evp-rotation-speed-val">${s.circleRotationSpeed.toFixed(2)}</span>
        </div>
      </div>
      <div class="evp-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'omniexpressionvideoplayer'
    WindowManager.register('omniexpressionvideoplayer', el, 'OmniExpressionVideoPlayer')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindControls (el) {
    const playBtn = el.querySelector('#evp-play')
    playBtn.addEventListener('click', () => {
      if (!this._hasVideo) return
      const action = this._playing ? 'pause' : 'play'
      window.dispatchEvent(new CustomEvent('omni:expression-video-control', { detail: { action } }))
    })

    const scrub = el.querySelector('#evp-scrub')
    scrub.addEventListener('input', () => {
      this._scrubbing = true
      const time = (Number(scrub.value) / 100) * this._duration
      el.querySelector('#evp-time').textContent = `${formatTime(time)} / ${formatTime(this._duration)}`
    })
    scrub.addEventListener('change', () => {
      const time = (Number(scrub.value) / 100) * this._duration
      window.dispatchEvent(new CustomEvent('omni:expression-video-control', { detail: { action: 'seek', time } }))
      this._scrubbing = false
    })

    const videoFileInput = el.querySelector('#evp-video-file-input')
    el.querySelector('#evp-upload-video').addEventListener('click', () => videoFileInput.click())
    videoFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        await videoStore.saveWallpaper(1, file, file.name)
        const url = URL.createObjectURL(file)
        window.dispatchEvent(new CustomEvent('omni:expression-state-set', { detail: { mediaUrl: url, mediaType: 'video' } }))
        el.querySelector('#evp-no-video-note').style.display = 'none'
      } catch (err) {
        window.alert(`Could not load video: ${err?.message ?? err}`)
      }
    })

    const circleFileInput = el.querySelector('#evp-circle-file-input')
    let pendingCircleId = null
    el.querySelectorAll('[data-circle]').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingCircleId = btn.dataset.circle
        circleFileInput.click()
      })
    })
    circleFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file || !pendingCircleId) return
      try {
        const slot = CIRCLES.findIndex(c => c.id === pendingCircleId) + 1
        await circleStore.saveWallpaper(slot, file, file.name)
        const url = URL.createObjectURL(file)
        window.dispatchEvent(new CustomEvent('omni:expression-backing-circle-request', {
          detail: { action: 'update', id: pendingCircleId, patch: { mediaUrl: url, mediaType: 'image' } }
        }))
        const btn = el.querySelector(`[data-circle="${pendingCircleId}"]`)
        btn.classList.add('is-filled')
        btn.textContent = file.name.length > 14 ? file.name.slice(0, 12) + '…' : file.name
      } catch (err) {
        window.alert(`Could not load image: ${err?.message ?? err}`)
      }
    })

    el.querySelector('#evp-rotation-toggle').addEventListener('click', (e) => {
      this._state.circleRotationEnabled = !this._state.circleRotationEnabled
      e.target.classList.toggle('is-on', this._state.circleRotationEnabled)
      saveSettings(this._state)
      window.dispatchEvent(new CustomEvent('omni:expression-state-set', {
        detail: { circleRotation: { enabled: this._state.circleRotationEnabled, speed: this._state.circleRotationSpeed } }
      }))
    })

    el.querySelector('#evp-rotation-speed').addEventListener('input', (e) => {
      this._state.circleRotationSpeed = Number(e.target.value)
      el.querySelector('#evp-rotation-speed-val').textContent = this._state.circleRotationSpeed.toFixed(2)
      saveSettings(this._state)
      window.dispatchEvent(new CustomEvent('omni:expression-state-set', {
        detail: { circleRotation: { enabled: this._state.circleRotationEnabled, speed: this._state.circleRotationSpeed } }
      }))
    })
  }

  _updateTransportUI (currentTime, duration) {
    if (!this._el) return
    this._el.querySelector('#evp-play').innerHTML = this._playing ? '&#10074;&#10074;' : '&#9654;'
    if (!this._scrubbing) {
      this._el.querySelector('#evp-scrub').value = duration > 0 ? (currentTime / duration) * 100 : 0
    }
    this._el.querySelector('#evp-time').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`
    this._el.querySelector('#evp-no-video-note').style.display = 'none'
  }

  async _refreshCircleSlots () {
    if (!this._el) return
    let list = []
    try { list = await circleStore.listWallpapers() } catch (_) {}
    list.forEach(({ slot, name }) => {
      const circle = CIRCLES[slot - 1]
      if (!circle) return
      const btn = this._el.querySelector(`[data-circle="${circle.id}"]`)
      if (btn) {
        btn.classList.add('is-filled')
        btn.textContent = name && name.length > 14 ? name.slice(0, 12) + '…' : (name || 'Set')
      }
    })
  }

  _bindHeader (el) {
    const header = el.querySelector('.evp-header')
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
    const handle = el.querySelector('.evp-resize-handle')
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
