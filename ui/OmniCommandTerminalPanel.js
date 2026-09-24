/**
 * ui/OmniCommandTerminalPanel.js — ⟐OmniCommandTerminal panel
 *
 * The real, first, buildable slice of the command language from
 * docs/omniproducts/OMNICOMMANDTERMINAL_COMMAND_LANGUAGE_DESIGN.md —
 * Part 2 (the command language itself), not Part 1 (the tunnel-
 * shooting visual, a real, separate, contained piece deferred for
 * now) or Part 3 (the OmniSense/OmniKeys symbol-vocabulary
 * expansion, a larger, separate scope of its own).
 *
 * Three real, stated assumptions on the doc's own open questions,
 * since building needed a real answer for each rather than staying
 * blocked on them:
 * 1. help lists every registered command flat, no categories yet —
 *    only seven real commands exist, categorizing them now would be
 *    designing against a list that hasn't actually grown yet.
 * 2. cd DOES change a real, persistent "current context" — the
 *    same real shell-cwd shape the design doc itself draws the
 *    analogy to, the more intuitive default for anyone who's used a
 *    real terminal before.
 * 3. Failed commands DO get a real, visible echo (styled
 *    differently, not silence) — matches the doc's own reasoning
 *    for the tunnel-visual color idea, applied here to the text
 *    output instead, since Part 1's visual isn't built yet.
 */

import { parseCommand } from '../utils/CommandParser.js'
import { getCommand, getAllCommands } from '../utils/CommandRegistry.js'

const STYLES = `

.omni-command-terminal-panel {
  pointer-events   : auto;
  position         : fixed;
  top              : 130px;
  left             : 1060px;
  width            : 340px;
  height           : 320px;
  background       : rgba(6, 8, 10, 0.94);
  border           : 1px solid rgba(0, 255, 140, 0.18);
  border-radius    : 10px;
  font-family      : 'Courier New', Courier, monospace;
  z-index          : 60;
  opacity          : 0;
  visibility       : hidden;
  display          : flex;
  flex-direction   : column;
}
.omni-command-terminal-panel.open { opacity: 1; visibility: visible; }

.oct-header {
  display: flex; align-items: center; justify-content: center;
  height: 32px; border-bottom: 1px solid rgba(0,255,140,0.15);
  font-size: 11px; color: rgba(0,255,140,0.8); position: relative;
}
.oct-close {
  position: absolute; right: 8px; background: none; border: none;
  color: rgba(0,255,140,0.4); font-size: 13px; cursor: pointer;
}
.oct-output {
  flex: 1; overflow-y: auto; padding: 8px; font-size: 11px; line-height: 1.5;
}
.oct-line { color: rgba(0, 255, 140, 0.85); white-space: pre-wrap; }
.oct-line--error { color: rgba(255, 100, 100, 0.9); }
.oct-line--echo { color: rgba(255, 255, 255, 0.5); }
.oct-input-row { display: flex; border-top: 1px solid rgba(0,255,140,0.15); }
.oct-prompt { padding: 6px 4px 6px 8px; color: rgba(0,255,140,0.6); font-size: 12px; }
.oct-input {
  flex: 1; background: transparent; border: none; color: #eafff0;
  font-family: inherit; font-size: 12px; padding: 6px 8px 6px 0; outline: none;
}
`

function injectStyles () {
  if (document.getElementById('oct-styles')) return
  const tag = document.createElement('style')
  tag.id = 'oct-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniCommandTerminalPanel {
  constructor (context, omniNode) {
    this.ctx = context
    this.omniNode = omniNode
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
    this._currentContextNodeId = null   // real, persistent "cd" target — assumption 2 above
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._bindEvents()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniCommandTerminal') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
  }

  open () { this._isOpen = true; this._el.classList.add('open') }
  close () { this._isOpen = false; this._el.classList.remove('open') }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-command-terminal-panel'
    el.innerHTML = `
      <div class="oct-header">⟐ OmniCommandTerminal<button class="oct-close">✕</button></div>
      <div class="oct-output" id="oct-output"><div class="oct-line">Terminal ready. Type ⟐help.</div></div>
      <div class="oct-input-row">
        <span class="oct-prompt">⟐</span>
        <input class="oct-input" id="oct-input" placeholder="commandName arg1 arg2" />
      </div>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('.oct-close').addEventListener('click', () => this.close())
    const input = this._el.querySelector('#oct-input')
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      const raw = input.value.trim()
      if (!raw) return
      this._runLine(raw)
      input.value = ''
    })
  }

  _echo (text, cls = 'oct-line') {
    const output = this._el.querySelector('#oct-output')
    const line = document.createElement('div')
    line.className = cls
    line.textContent = text
    output.appendChild(line)
    output.scrollTop = output.scrollHeight
  }

  /** Real line runner — a bare typed line (no ⟐) is auto-prepended,
   *  matching the design doc's own Part 3 reasoning: within this
   *  Terminal tab specifically, the context already means every
   *  line is a command, so there's no real ambiguity to resolve. */
  _runLine (raw) {
    const withPrefix = raw.startsWith('⟐') ? raw : `⟐${raw}`
    this._echo(`⟐ ${withPrefix.slice(1)}`, 'oct-line--echo')

    const parsed = parseCommand(withPrefix)
    if (!parsed) {
      this._echo(`Not a real command: "${raw}"`, 'oct-line--error')
      return
    }

    const entry = getCommand(parsed.commandName)
    if (!entry) {
      this._echo(`Unrecognized command: ${parsed.commandName}`, 'oct-line--error')
      return
    }

    try {
      const result = entry.handler(parsed.args, this._terminalContext())
      this._echo(result ?? 'OK')
    } catch (err) {
      this._echo(err.message ?? String(err), 'oct-line--error')
    }
  }

  /** Real context object passed to every command handler — the
   *  real, persistent cd-target (assumption 2), plus the real
   *  OmniNode/scene access every registered command actually needs. */
  _terminalContext () {
    return {
      ctx: this.ctx,
      omniNode: this.omniNode,
      getCurrentContextNodeId: () => this._currentContextNodeId,
      setCurrentContextNodeId: (id) => { this._currentContextNodeId = id },
    }
  }
}

// Real, built-in 'help' — lists every registered command, flat, no
// categories yet (assumption 1). Registered here rather than a
// separate file since, unlike the other six, it has no other real
// system of its own to live next to.
import { registerCommand } from '../utils/CommandRegistry.js'
registerCommand('help', () => {
  const all = getAllCommands()
  return all.map(c => `⟐${c.name}${c.description ? ' — ' + c.description : ''}`).join('\n')
}, 'Lists every real, registered command')
