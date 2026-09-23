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

/* ── Top — Notification Realities ────────────────────────────────────────── */
.ot-vault--top {
  top: 14px; left: 50%; transform: translateX(-50%);
  width: 420px; height: 64px;
  border-radius: 10px;
}

/* ── Right — Problems / Risks ────────────────────────────────────────────── */
.ot-vault--right {
  top: 90px; right: 14px; bottom: 220px;
  width: 92px;
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
  top: 90px; left: 14px; bottom: 220px;
  width: 92px;
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
        <div class="ot-vault-empty">${v.empty}</div>
      `
      shell.appendChild(el)
      this._els[v.side] = el
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
}
