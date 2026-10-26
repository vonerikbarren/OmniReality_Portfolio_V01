/**
 * ui/OmniTranslator.js — ⟐OmniTranslator (shell)
 *
 * Real, first pass — the visual shell only, per the same proven
 * "shell first" approach OmniStartHUD used. Confirmed directly: this
 * is now several genuine subsystems (the four vaults, node typing,
 * drag-to-extract, cross-reality linking), not one panel addition —
 * and two real, load-bearing questions (strict Right/Left pairing
 * vs. independent pools; the node-typing mechanism itself) are still
 * genuinely unresolved. Building the real, styled containers now,
 * honestly empty, rather than guessing at content logic before
 * those are answered.
 *
 * Four real vaults, each its own real function, by reality
 * (reality = node || nodeGroups):
 *   Top    — Notification Realities (urgent/important alerts)
 *   Right  — Problems, Risks, other concerns
 *   Bottom — Tools, skills, abilities, attributes, hints
 *   Left   — Solutions, Algorithms, Processes, Instructions
 *
 * The confirmed "SystemsOfSpacialSystems" visual identity — a real,
 * deliberate double-line border plus glow, distinct from every other
 * panel's own look in this project (that look is specific to
 * OmniTranslator, not OmniChat, per direct confirmation).
 */

import { getVaults, addToVault as saveToVault, removeFromVault as deleteFromVault } from '../utils/OmniTranslatorVaults.js'

const STYLES = /* css */`

.ot-vault {
  position        : fixed;
  z-index          : 55;
  pointer-events   : auto;
  display          : flex;
  flex-direction   : column;
  gap              : 6px;
  background       : rgba(10, 10, 16, 0.72);
  backdrop-filter  : blur(12px);
  font-family      : 'Courier New', Courier, monospace;
  color            : rgba(255, 255, 255, 0.88);
  opacity          : 0;
  visibility       : hidden;
  transition       : opacity 0.22s ease;
  /* The real, confirmed "SystemsOfSpacialSystems" identity — a
     double-line border plus glow, deliberately distinct from every
     other panel's single-border look in this project. */
  border           : 1px solid rgba(255, 255, 255, 0.22);
  outline          : 1px solid rgba(255, 255, 255, 0.10);
  outline-offset   : 3px;
  box-shadow       : 0 0 16px rgba(160, 200, 255, 0.18), 0 0 2px rgba(255, 255, 255, 0.4);
}
.ot-vault.open { opacity: 1; visibility: visible; }

.ot-vault-label {
  font-size      : 9px;
  letter-spacing : 0.08em;
  color          : rgba(255, 255, 255, 0.55);
  padding        : 8px 10px 0;
}
.ot-vault-empty {
  flex           : 1;
  display        : flex;
  align-items    : center;
  justify-content: center;
  font-size      : 9.5px;
  color          : rgba(255, 255, 255, 0.35);
  text-align     : center;
  padding        : 10px 14px;
  line-height    : 1.6;
}
.ot-vault-list {
  flex        : 1;
  overflow-y  : auto;
  padding     : 4px 8px 8px;
  display     : flex;
  flex-direction: column;
  gap         : 4px;
}
.ot-vault-entry {
  font-size     : 10px;
  padding       : 4px 8px;
  border-radius : 5px;
  background    : rgba(255, 255, 255, 0.05);
  border        : 1px solid rgba(255, 255, 255, 0.08);
  cursor        : pointer;
  white-space   : nowrap;
  overflow      : hidden;
  text-overflow : ellipsis;
}
.ot-vault-entry:hover { background: rgba(255, 255, 255, 0.1); }

/* ── Top — Notification Realities ────────────────────────────────────────── */
.ot-vault--top {
  top: 14px; left: 50%; transform: translateX(-50%);
  width: 420px; height: 64px;
  border-radius: 10px;
}

/* ── Right — Problems / Risks ────────────────────────────────────────────── */
.ot-vault--right {
  /* Real fix — same real reason and geometry as the Left vault,
     mirrored: top-right/bottom-right Hands share the exact same
     real BAR_H/DOCK_H/CELL/GAP constants, so the same 150px/154px
     bounds apply here too, flush against the right edge instead. */
  top: 150px; right: 0; bottom: 154px;
  width: 90px;
  border-radius: 10px;
}

/* ── Bottom — Tools / Skills (above dock and minimap) ────────────────────── */
.ot-vault--bottom {
  left: 50%; transform: translateX(-50%);
  bottom: 210px;
  width: 460px; height: 80px;
  border-radius: 10px;
}

/* ── Left — Solutions / Algorithms ───────────────────────────────────────── */
.ot-vault--left {
  /* Real fix — moved out of the StartHUD's own inset:7% region
     (the previous top/bottom values were arbitrary, landing near
     screen center). Recomputed from Hand.js's own real geometry:
     the top-left Hand's bottom edge sits at BAR_H(48) +
     2*CELL+GAP(102) = 150px; the bottom-left Hand's top edge sits
     at DOCK_H(52) + 102 = 154px from the viewport bottom. Sits
     directly in that real gap, flush against the same left edge
     both Hands already use. */
  top: 150px; left: 0; bottom: 154px;
  width: 90px;
  border-radius: 10px;
}
`

function injectStyles () {
  if (document.getElementById('ot-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ot-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const VAULTS = [
  { side: 'top', label: 'Notification Realities', empty: "No urgent notifications for this reality yet." },
  { side: 'right', label: 'Problems / Risks', empty: "No known problems or risks yet." },
  { side: 'bottom', label: 'Tools / Skills / Hints', empty: "No tools or skills attached yet." },
  { side: 'left', label: 'Solutions / Algorithms', empty: "No solutions or processes yet." },
]

export default class OmniTranslator {
  constructor () {
    this._els = {}
    this._isOpen = false
    this._onToggle = null
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    const shell = document.getElementById('omni-ui') ?? document.body

    VAULTS.forEach(v => {
      const el = document.createElement('div')
      el.className = `ot-vault ot-vault--${v.side}`
      el.innerHTML = `
        <div class="ot-vault-label">⟐ ${v.label}</div>
        <div class="ot-vault-content"></div>
      `
      shell.appendChild(el)
      this._els[v.side] = el
      this._renderVaultContent(v.side)
    })

    this._onToggle = () => this.toggle()
    window.addEventListener('omni:translator-toggle', this._onToggle)

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniTranslator') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:translator-toggle', this._onToggle)
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    Object.values(this._els).forEach(el => el.parentNode?.removeChild(el))
  }

  toggle () { this._isOpen ? this.close() : this.open() }

  open () {
    this._isOpen = true
    Object.values(this._els).forEach(el => el.classList.add('open'))
  }

  close () {
    this._isOpen = false
    Object.values(this._els).forEach(el => el.classList.remove('open'))
  }

  /** Real, public entry point — called from the quick menu's vault
   *  picker (ToolTipMenu), reusing the exact same real, low-risk
   *  "menu-driven placement, no dragging" pattern already proven for
   *  OmniGrab's sendToHand, rather than building new drag-detection
   *  logic. A node's own real, current label is its identity here —
   *  independent pools, no forced pairing, per direct confirmation. */
  addToVault (mesh, side) {
    const nodeId = mesh?.userData?.nodeId
    if (!nodeId) return
    const label = mesh.userData?.label ?? nodeId
    saveToVault(side, nodeId, label)
    this._renderVaultContent(side)
  }

  removeFromVault (side, nodeId) {
    deleteFromVault(side, nodeId)
    this._renderVaultContent(side)
  }

  _renderVaultContent (side) {
    const el = this._els[side]
    if (!el) return
    const content = el.querySelector('.ot-vault-content')
    const entries = getVaults()[side]
    const meta = VAULTS.find(v => v.side === side)

    if (!entries || entries.length === 0) {
      content.innerHTML = `<div class="ot-vault-empty">${meta.empty}</div>`
      return
    }

    content.innerHTML = `<div class="ot-vault-list">${entries.map(e =>
      `<div class="ot-vault-entry" data-node-id="${e.nodeId}" title="Click to remove">${e.label}</div>`
    ).join('')}</div>`

    content.querySelectorAll('.ot-vault-entry').forEach(row => {
      row.addEventListener('click', () => this.removeFromVault(side, row.dataset.nodeId))
    })
  }
}
