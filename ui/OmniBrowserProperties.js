/**
 * ui/OmniBrowserProperties.js — ⟐mniReality OmniBrowser Properties
 *
 * OmniBrowser's own dedicated "Inspector" — URL bar, navigation,
 * sandbox permission toggles, and an Index of saved URLs. Dispatches
 * `omni:browser-set` patches that ui/OmniBrowser.js applies to the
 * real iframe; owns no iframe itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Back/Forward — an externally-tracked history list, not iframe history
 * ─────────────────────────────────────────────────────────────────────────────
 * For a cross-origin iframe, the browser blocks script access to its
 * internal history/location entirely — calling
 * iframe.contentWindow.history.back() would throw or silently no-op
 * depending on the browser, and can't be relied on. This panel keeps
 * its own list of visited URLs and Back/Forward just re-sets the
 * iframe's `src` to the previous/next entry — works regardless of the
 * embedded site's origin, since it never reaches into the iframe at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The Index — genuinely the same mechanism as Spaces, not a look-alike
 * ─────────────────────────────────────────────────────────────────────────────
 * Per the "bridge, not a separate simplified tool" framing this panel
 * is meant to embody: an empty slot saves the current URL there; a
 * saved slot navigates to it — the exact same save-a-slot pattern
 * `main.js`'s Spaces panel already uses for coordinates, just applied
 * to a different kind of "location." 12 slots (a browser bookmark
 * index doesn't need Spaces' scale).
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const INDEX_SLOTS = 12
const STORE_KEY = 'omni:browser:settings'

const SANDBOX_FLAGS = [
  { key: 'allow-scripts',     label: 'Scripts' },
  { key: 'allow-same-origin', label: 'Same-Origin' },
  { key: 'allow-forms',       label: 'Forms' },
  { key: 'allow-popups',      label: 'Popups' },
]

const STYLES = /* css */`

.omni-browser-props {
  --bp-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --bp-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --bp-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --bp-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --bp-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --bp-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --bp-accent      : var(--omni-theme-accent, #8cc4ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 920px;
  width            : 320px;
  min-width        : 280px;
  max-width        : 90vw;
  height           : 520px;
  min-height       : 340px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--bp-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--bp-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--bp-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.bp-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--bp-header-bg);
  border-bottom    : 1px solid var(--bp-border);
  cursor           : grab;
  user-select      : none;
}
.bp-header.is-dragging { cursor: grabbing; }
.bp-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--bp-text-dim); }
.bp-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.bp-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--bp-border);
  background: rgba(255,255,255,0.04);
  color: var(--bp-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.bp-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--bp-text); }

.bp-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; }

.bp-section-title {
  font-size        : 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color            : var(--bp-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top       : 1px solid rgba(255,255,255,0.06);
}
.bp-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.bp-url-row { display: flex; gap: 6px; }
.bp-url-input {
  flex: 1;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px; color: var(--bp-text); font-family: var(--mono);
  font-size: 10px; padding: 6px 8px;
}
.bp-go-btn {
  background: rgba(140, 196, 255, 0.14); border: 1px solid rgba(140, 196, 255, 0.4);
  color: var(--bp-accent); border-radius: 5px; padding: 0 12px; font-family: var(--mono);
  font-size: 10px; cursor: pointer;
}
.bp-go-btn:hover { background: rgba(140, 196, 255, 0.22); }

.bp-nav-row { display: flex; gap: 6px; }
.bp-nav-btn {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--bp-border);
  color: var(--bp-text-dim); border-radius: 6px; padding: 8px 4px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer;
}
.bp-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.11); color: var(--bp-text); }
.bp-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.bp-nav-btn.is-active { background: rgba(140, 196, 255, 0.18); border-color: rgba(140, 196, 255, 0.45); color: var(--bp-accent); }

.bp-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.bp-row-label { font-size: 10px; color: var(--bp-text-dim); }
.bp-toggle {
  width: 34px; height: 18px; border-radius: 10px;
  border: 1px solid var(--bp-border);
  background: rgba(255,255,255,0.08);
  position: relative; cursor: pointer; flex-shrink: 0;
}
.bp-toggle::after {
  content: ''; position: absolute; top: 1px; left: 1px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--bp-text-dim);
  transition: transform 0.15s ease, background 0.15s ease;
}
.bp-toggle.is-on { background: rgba(140, 196, 255, 0.3); border-color: rgba(140, 196, 255, 0.5); }
.bp-toggle.is-on::after { transform: translateX(16px); background: var(--bp-accent); }

.bp-index-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.bp-index-btn {
  background: rgba(255,255,255,0.05); border: 1px solid var(--bp-border);
  border-radius: 6px; color: var(--bp-text-muted); font-family: var(--mono);
  font-size: 8px; padding: 8px 4px; cursor: pointer; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.bp-index-btn:hover { background: rgba(255,255,255,0.1); }
.bp-index-btn.is-filled { border-color: rgba(140, 196, 255, 0.35); color: var(--bp-text-dim); }

.bp-note { font-size: 9px; color: var(--bp-text-muted); line-height: 1.5; margin-top: 6px; }

.bp-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.bp-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-browser-props-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-browser-props-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// The default landing page — this site is the first public-facing
// deliverable, so it's what a first-time visitor should actually see.
// Kept separate from selfUrl() below: the "⟐mni" bookmark still
// correctly points at the app itself, only the default homeUrl changes.
const DEFAULT_LANDING_URL = 'https://vonerikbarren.github.io/Portfolio--V3/'

// "The first thing to show is the site itself" — window.location.href
// is the correct, portable way to do this: it always points back at
// wherever THIS instance is actually running (local dev server,
// GitHub Pages, anywhere else), rather than a hardcoded URL that
// would only be correct in one specific deployment.
//
// This is genuinely recursive — the loaded page shares this exact
// browser's localStorage/IndexedDB (same-origin iframes share
// storage), so the "inner" OmniReality sees the same saved nodes and
// settings as the "outer" one, live. The actual infinite-recursion
// hazard this creates (an embedded instance auto-opening its own
// OmniBrowser, defaulting to loading itself, forever) is guarded in
// main.js via window.self !== window.top — an embedded instance skips
// its own auto-open entirely, so nesting stops at one level instead
// of compounding.
function selfUrl () {
  try { return window.location.href } catch (_) { return 'https://example.com' }
}

// Pre-populated for new users — 6 ready-to-use bookmarks instead of an
// empty index. Slot 7's title (alt-codes.net) wasn't specified when
// this was requested — "Symbols" is a reasonable guess matching the
// page's actual content (a diamond-symbols reference), not a given.
const DEFAULT_BOOKMARKS = {
  1: { url: '', title: '⟐mni' },   // resolved to selfUrl() at load time — see loadSettings()
  2: { url: 'https://wikipedia.org', title: 'Wikipedia' },
  3: { url: 'https://calculator.net', title: 'Calculator' },
  4: { url: 'https://html-css-js.com', title: 'Code' },
  5: { url: 'https://www.alt-codes.net/diamond-symbols', title: 'Symbols' },
  6: { url: 'https://lunapic.com', title: 'Lunapic' },
  7: { url: 'https://patorjk.com/software/taag/#p=display&f=Slant&t=ToDoList&x=none&v=4&h=4&w=80&we=false', title: 'ASCII' },
}

/** Normalizes an index entry to {url, title} regardless of whether it
 *  was saved before this change (a plain URL string) or after (an
 *  object) — existing bookmarks a user already saved keep working
 *  rather than breaking on this data-shape change. */
function normalizeIndexEntry (entry) {
  if (!entry) return null
  if (typeof entry === 'string') return { url: entry, title: null }
  return { url: entry.url, title: entry.title ?? null }
}

function loadSettings () {
  const defaults = {
    homeUrl: DEFAULT_LANDING_URL,
    sandboxFlags: { 'allow-scripts': true, 'allow-same-origin': true, 'allow-forms': true, 'allow-popups': true },
    index: {
      ...DEFAULT_BOOKMARKS,
      1: { url: selfUrl(), title: '⟐mni' },
    },
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

export default class OmniBrowserProperties {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._state = loadSettings()
    // Per-window history — up to 3 simultaneous windows, each with its
    // own back/forward stack. The Index (bookmarks) stays shared
    // across all three; only navigation history is per-window.
    this._windows = {
      1: { history: [], historyIndex: -1, opened: true },
      2: { history: [], historyIndex: -1, opened: false },
      3: { history: [], historyIndex: -1, opened: false },
    }
    this._activeWindow = 1
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniBrowserProperties') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._broadcastSandbox()

    // "The first thing to show is the site itself" — actually navigate
    // window 1 there on boot, not just pre-fill the URL input's value.
    // Recorded into window 1's own history too, so Back/Forward and the
    // URL bar stay consistent with what's actually already displayed,
    // rather than the iframe showing content the panel doesn't know about.
    const home = this._state.homeUrl
    if (home) {
      this._windows[1].history = [home]
      this._windows[1].historyIndex = 0
      window.dispatchEvent(new CustomEvent('omni:browser-set', { detail: { url: home, windowId: 1 } }))
    }
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnibrowserprops')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
  }

  /** Boot-time entrance only — slides in from the right edge (opposite
   *  side from OmniBrowser's own left-edge slide), so both land
   *  together at the moment the user arrives, not just OmniBrowser
   *  alone with this panel appearing separately. */
  openFromSide () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    this._isOpen = true
    this._playSound('open')

    const targetLeft = parseFloat(this._el.style.left) || 920
    gsap.fromTo(this._el,
      { opacity: 0, scale: 1, left: targetLeft + 260 },
      { opacity: WindowManager.getPanelOpacity(), left: targetLeft, duration: 0.65, ease: 'power3.out' }
    )
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
        id: 'omnibrowserprops', label: '⟐OmniBrowserProperties', iconLabel: '⟐P',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
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
    el.className = 'omni-browser-props'
    const s = this._state

    let indexButtons = ''
    for (let i = 1; i <= INDEX_SLOTS; i++) {
      const entry = normalizeIndexEntry(s.index[i])
      const label = entry ? (entry.title ?? this._shortLabel(entry.url)) : i
      indexButtons += `<button class="bp-index-btn ${entry ? 'is-filled' : ''}" data-index-slot="${i}" title="${entry?.url ?? 'Empty'}">${label}</button>`
    }

    el.innerHTML = /* html */`
      <div class="bp-header">
        <span class="bp-title">⟐Browser Properties</span>
        <div class="bp-controls">
          <button class="bp-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="bp-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="bp-body">
        <div class="bp-section-title">Window</div>
        <div class="bp-nav-row" id="bp-window-tabs">
          <button class="bp-nav-btn is-active" data-window="1">Window 1</button>
          <button class="bp-nav-btn" data-window="2">+ Window 2</button>
          <button class="bp-nav-btn" data-window="3">+ Window 3</button>
        </div>
        <div class="bp-note">Up to 3 windows — each keeps its own history. The Index below is shared across all of them.</div>

        <div class="bp-section-title">Address</div>
        <div class="bp-url-row">
          <input type="text" class="bp-url-input" id="bp-url-input" placeholder="https://…" value="${s.homeUrl}">
          <button class="bp-go-btn" id="bp-go">Go</button>
        </div>

        <div class="bp-section-title">Navigation</div>
        <div class="bp-nav-row">
          <button class="bp-nav-btn" id="bp-back" disabled>◀ Back</button>
          <button class="bp-nav-btn" id="bp-forward" disabled>Forward ▶</button>
          <button class="bp-nav-btn" id="bp-refresh">⟳ Refresh</button>
          <button class="bp-nav-btn" id="bp-home">⌂ Home</button>
        </div>

        <div class="bp-section-title">Sandbox Permissions</div>
        ${SANDBOX_FLAGS.map(f => `
          <div class="bp-row">
            <span class="bp-row-label">${f.label}</span>
            <button class="bp-toggle ${s.sandboxFlags[f.key] ? 'is-on' : ''}" data-sandbox-flag="${f.key}" role="switch" aria-checked="${!!s.sandboxFlags[f.key]}"></button>
          </div>
        `).join('')}
        <div class="bp-note">
          These restrict what an embedded site can DO once it loads —
          they can't force a site that refuses framing to load at all.
        </div>

        <div class="bp-section-title">Index (${INDEX_SLOTS} slots)</div>
        <div class="bp-index-grid" id="bp-index-grid">${indexButtons}</div>
        <div class="bp-note">
          Click an empty slot to save the current address there. Click
          a filled slot to go there. Same save-a-slot system as Spaces,
          just for addresses instead of coordinates.
        </div>
      </div>
      <div class="bp-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'omnibrowserprops'
    WindowManager.register('omnibrowserprops', el, 'Browser Properties')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _shortLabel (url) {
    try { return new URL(url).hostname.replace('www.', '') } catch (_) { return url.slice(0, 14) }
  }

  _bindControls (el) {
    el.querySelectorAll('[data-window]').forEach(btn => {
      btn.addEventListener('click', () => {
        const windowId = Number(btn.dataset.window)
        this._activeWindow = windowId
        el.querySelectorAll('[data-window]').forEach(b => b.classList.toggle('is-active', Number(b.dataset.window) === windowId))

        if (!this._windows[windowId].opened) {
          this._windows[windowId].opened = true
          btn.textContent = `Window ${windowId}`
          window.dispatchEvent(new CustomEvent('omni:browser-open-window', { detail: { windowId } }))
        }
        this._syncActiveWindowUI()
      })
    })

    const urlInput = el.querySelector('#bp-url-input')
    const go = () => this._go(urlInput.value.trim())
    el.querySelector('#bp-go').addEventListener('click', go)
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') go() })

    el.querySelector('#bp-back').addEventListener('click', () => this._back())
    el.querySelector('#bp-forward').addEventListener('click', () => this._forward())
    el.querySelector('#bp-refresh').addEventListener('click', () => this._refresh())
    el.querySelector('#bp-home').addEventListener('click', () => this._go(this._state.homeUrl))

    el.querySelectorAll('[data-sandbox-flag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sandboxFlag
        this._state.sandboxFlags[key] = !this._state.sandboxFlags[key]
        btn.classList.toggle('is-on', this._state.sandboxFlags[key])
        btn.setAttribute('aria-checked', String(this._state.sandboxFlags[key]))
        saveSettings(this._state)
        this._broadcastSandbox()
      })
    })

    el.querySelector('#bp-index-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-index-slot]')
      if (!btn) return
      const slot = Number(btn.dataset.indexSlot)
      const saved = normalizeIndexEntry(this._state.index[slot])
      if (saved) {
        this._go(saved.url)
      } else {
        const current = this._windows[this._activeWindow].history[this._windows[this._activeWindow].historyIndex]
        if (!current) return
        this._state.index[slot] = { url: current, title: null }
        saveSettings(this._state)
        btn.classList.add('is-filled')
        btn.textContent = this._shortLabel(current)
        btn.title = current
      }
    })
  }

  /** Normalizes bare domains (e.g. "example.com") into a real URL
   *  before navigating — a small usability nicety, not required. */
  _normalizeUrl (raw) {
    if (!raw) return ''
    if (/^(https?|file|blob|data):/i.test(raw)) return raw
    return `https://${raw}`
  }

  _go (rawUrl) {
    const url = this._normalizeUrl(rawUrl)
    if (!url) return
    const win = this._windows[this._activeWindow]
    // Navigating to something new truncates any "forward" history,
    // same convention every real browser uses.
    win.history = win.history.slice(0, win.historyIndex + 1)
    win.history.push(url)
    win.historyIndex = win.history.length - 1
    this._updateNavButtons()
    this._el.querySelector('#bp-url-input').value = url
    window.dispatchEvent(new CustomEvent('omni:browser-set', { detail: { url, windowId: this._activeWindow } }))
  }

  _back () {
    const win = this._windows[this._activeWindow]
    if (win.historyIndex <= 0) return
    win.historyIndex -= 1
    this._applyHistoryEntry()
  }

  _forward () {
    const win = this._windows[this._activeWindow]
    if (win.historyIndex >= win.history.length - 1) return
    win.historyIndex += 1
    this._applyHistoryEntry()
  }

  _refresh () {
    const win = this._windows[this._activeWindow]
    const current = win.history[win.historyIndex]
    if (!current) return
    // Re-dispatching the same URL wouldn't necessarily reload (some
    // consumers might no-op on an unchanged value) — force it by
    // going through a null first.
    window.dispatchEvent(new CustomEvent('omni:browser-set', { detail: { url: '', windowId: this._activeWindow } }))
    window.dispatchEvent(new CustomEvent('omni:browser-set', { detail: { url: current, windowId: this._activeWindow } }))
  }

  _applyHistoryEntry () {
    const win = this._windows[this._activeWindow]
    const url = win.history[win.historyIndex]
    this._updateNavButtons()
    if (this._el) this._el.querySelector('#bp-url-input').value = url
    window.dispatchEvent(new CustomEvent('omni:browser-set', { detail: { url, windowId: this._activeWindow } }))
  }

  _updateNavButtons () {
    if (!this._el) return
    const win = this._windows[this._activeWindow]
    this._el.querySelector('#bp-back').disabled = win.historyIndex <= 0
    this._el.querySelector('#bp-forward').disabled = win.historyIndex >= win.history.length - 1
  }

  /** Refreshes the URL bar and nav-button state to reflect whichever
   *  window just became active — each window's history is independent,
   *  so switching tabs needs to show that window's own current address,
   *  not leave the previous window's address sitting in the bar. */
  _syncActiveWindowUI () {
    if (!this._el) return
    const win = this._windows[this._activeWindow]
    const current = win.history[win.historyIndex] ?? ''
    this._el.querySelector('#bp-url-input').value = current
    this._updateNavButtons()
  }

  _broadcastSandbox () {
    const active = Object.entries(this._state.sandboxFlags).filter(([, v]) => v).map(([k]) => k)
    window.dispatchEvent(new CustomEvent('omni:browser-set', { detail: { sandbox: active.join(' '), windowId: this._activeWindow } }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.bp-header')
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
    const handle = el.querySelector('.bp-resize-handle')
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
