/**
 * ui/OmniNotifyPanel.js — ⟐OmniNotify main panel
 *
 * The real drop-down: slides down from the very top of the screen,
 * triggered by clicking the notification column in GlobalBar (which
 * carries its own OmniAddressBar, mounted there specifically to
 * avoid colliding with ConsciousHand's own top-right space).
 *
 * Real notification content now exists — the first actual use case
 * is travel notices from OmniLandingRoom/NavMapPanel, so the person
 * genuinely knows where they're going. Push a real notification via
 * `omni:notify-push` ({ text }), or call pushNotification(text)
 * directly. Still honest where it's still empty: no history
 * persistence, no notification types/severities yet — one flat list.
 */

import gsap from 'gsap'

const BAR_H = 48   // matches GlobalBar's own collapsed height (ui/Hand.js's own BAR_H)
const MAX_HISTORY = 20
const AUTO_CLOSE_MS = 3200   // long enough to actually read a short travel notice

const STYLES = `

.omni-notify-panel {
  position         : fixed;
  top              : 0;
  left             : 0;
  right            : 0;
  height           : 320px;
  max-height       : 60vh;

  background       : var(--omni-theme-bg, rgba(8, 8, 12, 0.94));
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border-bottom    : 1px solid var(--omni-theme-border, rgba(255,255,255,0.09));
  box-shadow       : 0 10px 30px rgba(0,0,0,0.5);

  font-family      : 'Courier New', Courier, monospace;
  z-index          : 55;   /* below GlobalBar's own stacking, above ordinary panels */
  transform        : translateY(-100%);
  pointer-events   : auto;
  padding          : ${BAR_H + 16}px 24px 20px;
  box-sizing       : border-box;
  overflow-y       : auto;
}

.onp-title {
  font-size        : 11px;
  letter-spacing   : 0.06em;
  color            : var(--omni-theme-text-dim, rgba(255,255,255,0.7));
  margin-bottom    : 14px;
}

.onp-empty {
  font-size        : 12px;
  color            : var(--omni-theme-text-dim, rgba(255,255,255,0.5));
  opacity          : 0.75;
  line-height      : 1.6;
}

.onp-item {
  font-size        : 12px;
  color            : var(--omni-theme-text, rgba(255,255,255,0.92));
  padding          : 8px 0;
  border-bottom    : 1px solid var(--omni-theme-border, rgba(255,255,255,0.06));
  display          : flex;
  justify-content  : space-between;
  gap              : 12px;
}
.onp-item:first-child { padding-top: 0; }
.onp-item-time {
  color            : var(--omni-theme-text-dim, rgba(255,255,255,0.4));
  font-size        : 10px;
  white-space      : nowrap;
}

`

function injectStyles () {
  if (document.getElementById('omni-notify-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-notify-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniNotifyPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._history = []
    this._onToggle = null
    this._onDocClick = null
    this._onPush = null
    this._autoCloseTimer = null
  }

  init () {
    injectStyles()
    this._el = document.createElement('div')
    this._el.className = 'omni-notify-panel'
    this._el.innerHTML = `<div class="onp-title">⟐ Notifications</div><div id="onp-list"></div>`
    this._renderList()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)

    this._onToggle = () => this._isOpen ? this.close() : this.open()
    window.addEventListener('omni:notify-panel-toggle', this._onToggle)

    this._onPush = (e) => this.pushNotification(e.detail?.text ?? '')
    window.addEventListener('omni:notify-push', this._onPush)

    // Click-outside-to-close — matches the established pattern used
    // elsewhere in this project for dropdown-style panels.
    this._onDocClick = (e) => {
      if (!this._isOpen) return
      if (this._el.contains(e.target)) return
      if (e.target.closest('#ob-col-notify')) return   // the toggle itself handles its own click
      this.close()
    }
    document.addEventListener('click', this._onDocClick)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:notify-panel-toggle', this._onToggle)
    window.removeEventListener('omni:notify-push', this._onPush)
    document.removeEventListener('click', this._onDocClick)
    clearTimeout(this._autoCloseTimer)
    this._el?.parentNode?.removeChild(this._el)
  }

  /** Real notification content — pushes to the top of the list,
   *  auto-opens briefly so the person actually sees it without
   *  needing to click the bell first, then auto-closes. */
  pushNotification (text) {
    if (!text) return
    this._history.unshift({ text, time: new Date() })
    if (this._history.length > MAX_HISTORY) this._history.length = MAX_HISTORY
    this._renderList()

    this.open()
    clearTimeout(this._autoCloseTimer)
    this._autoCloseTimer = setTimeout(() => this.close(), AUTO_CLOSE_MS)
  }

  _renderList () {
    const list = this._el?.querySelector('#onp-list')
    if (!list) return
    if (this._history.length === 0) {
      list.innerHTML = `<div class="onp-empty">Nothing yet — no real notifications have been pushed here.</div>`
      return
    }
    list.innerHTML = this._history.map(item => `
      <div class="onp-item">
        <span>${item.text}</span>
        <span class="onp-item-time">${item.time.toLocaleTimeString()}</span>
      </div>
    `).join('')
  }

  open () {
    this._isOpen = true
    gsap.to(this._el, { y: 0, duration: 0.32, ease: 'power3.out' })
  }

  close () {
    this._isOpen = false
    gsap.to(this._el, { y: '-100%', duration: 0.26, ease: 'power2.in' })
  }
}
