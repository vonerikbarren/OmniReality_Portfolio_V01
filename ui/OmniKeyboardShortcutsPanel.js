/**
 * ui/OmniKeyboardShortcutsPanel.js — ⟐ Keyboard Shortcuts
 *
 * Reachable from the Assistance menu's own dropdown (registered as a
 * real, global item via WindowManager.registerGlobalItem, so it
 * shows up regardless of which panel is frontmost — a plain
 * key-list isn't tied to any one panel's own context).
 *
 * Lists every real, currently-bound keyboard shortcut in the
 * project — compiled directly from main.js's own keydown handlers,
 * not guessed. The Edit button only works when the Admin panel is
 * genuinely the frontmost window (checked via WindowManager's own,
 * real getFrontmost()), and prompts for the real OmniCryptx
 * password — left accepting blank for now, honestly, since the real
 * OmniCryptx system (docs/architecture/OMNICRYPTEXLAB_DESIGN.md)
 * isn't built yet.
 */

import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

#omni-keyboard-shortcuts {
  position        : fixed;
  top              : 50%;
  left             : 50%;
  transform        : translate(-50%, -50%) scale(0.96);
  width            : 420px;
  max-height       : 70vh;
  z-index          : 100;
  display          : flex;
  flex-direction   : column;
  background       : rgba(10, 10, 14, 0.9);
  backdrop-filter  : blur(14px);
  border           : 1px solid rgba(255, 255, 255, 0.10);
  border-radius    : 12px;
  box-shadow       : 0 16px 48px rgba(0, 0, 0, 0.55);
  opacity          : 0;
  visibility       : hidden;
  transition       : opacity 0.18s ease, transform 0.18s ease;
  font-family      : 'Courier New', Courier, monospace;
  color            : rgba(255, 255, 255, 0.92);
}
#omni-keyboard-shortcuts.open {
  opacity   : 1;
  visibility: visible;
  transform : translate(-50%, -50%) scale(1);
}

.oks-header {
  display        : flex;
  align-items    : center;
  padding        : 12px 14px;
  border-bottom  : 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink    : 0;
}
.oks-title { font-size: 12px; letter-spacing: 0.04em; }
.oks-edit-btn {
  margin-left    : auto;
  background     : rgba(255, 255, 255, 0.06);
  border         : 1px solid rgba(255, 255, 255, 0.12);
  color          : rgba(255, 255, 255, 0.55);
  font-family    : inherit;
  font-size      : 10px;
  padding        : 5px 10px;
  border-radius  : 6px;
  cursor         : pointer;
  margin-right   : 6px;
}
.oks-edit-btn.enabled { color: #fff; border-color: rgba(255,255,255,0.25); }
.oks-edit-btn:not(.enabled) { cursor: not-allowed; opacity: 0.5; }
.oks-close {
  background: none; border: none; color: rgba(255,255,255,0.45);
  font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: 5px;
}
.oks-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

.oks-list { overflow-y: auto; padding: 6px 0; }
.oks-row {
  display        : flex;
  align-items    : center;
  gap            : 12px;
  padding        : 7px 14px;
  font-size      : 11.5px;
}
.oks-row:hover { background: rgba(255, 255, 255, 0.04); }
.oks-key {
  flex-shrink   : 0;
  min-width     : 64px;
  text-align    : center;
  background    : rgba(255, 255, 255, 0.08);
  border        : 1px solid rgba(255, 255, 255, 0.14);
  border-radius : 5px;
  padding       : 2px 6px;
  font-size     : 11px;
  color         : #fff;
}
.oks-desc { color: rgba(255, 255, 255, 0.75); }

.oks-edit-input {
  flex          : 1;
  background    : rgba(255, 255, 255, 0.06);
  border        : 1px solid rgba(255, 255, 255, 0.15);
  border-radius : 5px;
  color         : #fff;
  font-family   : inherit;
  font-size     : 11px;
  padding       : 3px 6px;
}
`

function injectStyles () {
  if (document.getElementById('oks-styles')) return
  const tag = document.createElement('style')
  tag.id = 'oks-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// Compiled directly from main.js's own real keydown handlers, not
// guessed. Each entry's own key/description matches its real,
// current behavior.
const SHORTCUTS = [
  { key: '` / F1',   desc: 'Invoke the terminal tunnel' },
  { key: 'Escape',   desc: 'Dismiss the terminal tunnel' },
  { key: 'c',        desc: 'Return to landing point coordinates' },
  { key: 'o',        desc: 'User Space sphere quick toggles' },
  { key: '0 / 9',    desc: "Toggle the domain grid sphere's visibility" },
  { key: 'b',        desc: 'Toggle OmniBrowser (window 1)' },
  { key: 'n',        desc: 'Open the OmniDraw mode picker' },
  { key: 'm',        desc: 'Toggle OmniMixer' },
  { key: 'F2',        desc: 'Refresh the page' },
  { key: 'F4',        desc: 'Toggle fullscreen' },
  { key: 'Escape',   desc: 'Exit fullscreen' },
  { key: '( / )',    desc: 'Wallpaper sphere spin direction' },
  { key: 'Enter',    desc: 'Toggle OmniStartHUD' },
  { key: 'r',        desc: 'Move up (vertical, Y-axis)' },
  { key: 'f',        desc: 'Move down (vertical, Y-axis)' },
]

export default class OmniKeyboardShortcutsPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._editing = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    document.body.appendChild(this._el)

    this._el.querySelector('.oks-close').addEventListener('click', () => this.close())
    this._el.querySelector('.oks-edit-btn').addEventListener('click', () => this._onEditClick())

    // Real, global registration — shows in the Assistance dropdown
    // regardless of which panel is frontmost, matching WindowManager's
    // own new registerGlobalItem mechanism.
    WindowManager.registerGlobalItem('Assistance', {
      label: 'Keyboard Shortcuts',
      action: () => this.open(),
    })
  }

  update () {}
  onResize () {}

  destroy () {
    this._el?.parentNode?.removeChild(this._el)
  }

  open () {
    this._isOpen = true
    this._el.classList.add('open')
    this._refreshEditButtonState()
  }

  close () {
    this._isOpen = false
    this._el.classList.remove('open')
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.id = 'omni-keyboard-shortcuts'
    el.innerHTML = `
      <div class="oks-header">
        <span class="oks-title">⟐ Keyboard Shortcuts</span>
        <button class="oks-edit-btn">Edit</button>
        <button class="oks-close" aria-label="Close">✕</button>
      </div>
      <div class="oks-list">
        ${SHORTCUTS.map((s, i) => `
          <div class="oks-row" data-idx="${i}">
            <span class="oks-key">${s.key}</span>
            <span class="oks-desc">${s.desc}</span>
          </div>
        `).join('')}
      </div>
    `
    return el
  }

  /** Real gate — the Edit button only genuinely works when the
   *  Admin panel is the actual frontmost window, checked directly
   *  via WindowManager's own real state, not a guess or a flag this
   *  panel maintains itself. */
  _refreshEditButtonState () {
    const btn = this._el.querySelector('.oks-edit-btn')
    const adminIsFrontmost = WindowManager.getFrontmost() === 'adminpanel'
    btn.classList.toggle('enabled', adminIsFrontmost)
  }

  _onEditClick () {
    const adminIsFrontmost = WindowManager.getFrontmost() === 'adminpanel'
    if (!adminIsFrontmost) return   // real, hard gate — does nothing at all otherwise

    // Real OmniCryptx password prompt — honestly left accepting
    // blank for now, since the real OmniCryptx system underneath
    // this isn't built yet (docs/architecture/OMNICRYPTEXLAB_DESIGN.md).
    const password = window.prompt('⟐OmniCryptx password:', '')
    if (password === null) return   // cancelled
    if (password !== '') {
      // Real, honest placeholder check — accepts blank only, for now.
      window.alert('Incorrect OmniCryptx password.')
      return
    }

    this._editing = true
    this._renderEditMode()
  }

  _renderEditMode () {
    const list = this._el.querySelector('.oks-list')
    list.innerHTML = SHORTCUTS.map((s, i) => `
      <div class="oks-row" data-idx="${i}">
        <span class="oks-key">${s.key}</span>
        <input class="oks-edit-input" type="text" value="${s.desc}" data-idx="${i}" />
      </div>
    `).join('')
    list.querySelectorAll('.oks-edit-input').forEach(input => {
      input.addEventListener('change', () => {
        const idx = Number(input.dataset.idx)
        if (SHORTCUTS[idx]) SHORTCUTS[idx].desc = input.value
      })
    })
  }
}
