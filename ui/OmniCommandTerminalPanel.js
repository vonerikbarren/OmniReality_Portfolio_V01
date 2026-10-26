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
import * as WindowManager from './WindowManager.js'
import * as Session from '../utils/TerminalSession.js'
import * as Shells from '../utils/TerminalShells.js'
import { getSettings, applyToRoot, startThemeLive, stopThemeLive } from '../utils/TerminalSettings.js'

// V192: every colour comes from the --terminal-* variables utils/TerminalSettings.js writes on :root (the active OmniOS theme, or the custom
// colours), so this panel follows the theme live; the fallbacks are the old green-on-black look. The output and the typed line are the shared
// session (utils/TerminalSession.js), so the in-scene TerminalShellTunnel panels show and accept the same lines (setting "Where you type").
const STYLES = `

.omni-command-terminal-panel {
  pointer-events   : auto;
  position         : fixed;
  top              : calc(var(--omni-top-offset, 48px) + 12px);
  left             : max(8px, calc(100vw - 356px));
  width            : min(340px, calc(100vw - 16px));
  height           : min(320px, 55vh);
  background       : var(--terminal-bg, rgba(6, 8, 10, 0.94));
  backdrop-filter  : blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border           : 1px solid var(--terminal-border, rgba(0, 255, 140, 0.18));
  border-radius    : 10px;
  font-family      : var(--terminal-font, 'Courier New', Courier, monospace);
  color            : var(--terminal-text, #eafff0);
  z-index          : 60;
  opacity          : 0;
  visibility       : hidden;
  display          : flex;
  flex-direction   : column;
}
.omni-command-terminal-panel.open { opacity: 1; visibility: visible; }
.omni-command-terminal-panel ::selection { background: var(--terminal-selection, rgba(0, 255, 140, 0.3)); }

.oct-header {
  display: flex; align-items: center; justify-content: center;
  height: 32px; border-bottom: 1px solid var(--terminal-rule, rgba(0,255,140,0.15));
  background: var(--terminal-header-bg, transparent);
  font-size: 11px; color: var(--terminal-accent, rgba(0,255,140,0.8)); position: relative;
}
.oct-close {
  position: absolute; right: 8px; background: none; border: none;
  color: var(--terminal-muted, rgba(0,255,140,0.4)); font-size: 13px; cursor: pointer;
}
.oct-output {
  flex: 1; overflow-y: auto; padding: 8px; font-size: 11px; line-height: 1.5;
}
.oct-line { color: var(--terminal-text, rgba(0, 255, 140, 0.85)); white-space: pre-wrap; overflow-wrap: anywhere; }
.oct-line--error { color: var(--terminal-error, rgba(255, 100, 100, 0.9)); }
.oct-line--echo { color: var(--terminal-muted, rgba(255, 255, 255, 0.5)); }
.oct-input-row { display: flex; border-top: 1px solid var(--terminal-rule, rgba(0,255,140,0.15)); }
.oct-prompt { padding: 6px 4px 6px 8px; color: var(--terminal-prompt, rgba(0,255,140,0.6)); font-size: 12px; }
.oct-input {
  flex: 1; min-width: 0; background: transparent; border: none; color: var(--terminal-text, #eafff0);
  font-family: inherit; font-size: 12px; padding: 6px 8px 6px 0; outline: none;
}
.oct-input::placeholder { color: var(--terminal-muted, rgba(255,255,255,0.4)); }
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
    this._autoOpened = false
    this._onNavSelect = null
    this._bound = []
    this._runner = null
    this._currentContextNodeId = null   // real, persistent "cd" target — assumption 2 above
  }

  init () {
    if (this._el) return   // BaseScene.addModule() calls init(); a second call must not build a second panel
    injectStyles()
    applyToRoot()           // the --terminal-* variables exist before the first paint
    startThemeLive()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    WindowManager.enhanceWindow(this._el, { id: 'omnicommandterminal' })   // V187: resize handles + maximize button
    this._bindEvents()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniCommandTerminal') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // V192: this panel runs the commands for every surface (it owns the command context), and follows the terminals' master on/off
    // when the user types on the DOM panel ('dom' or 'both').
    this._runner = (raw) => this._runLine(raw)
    Session.setRunner(this._runner)
    const on = (name, fn) => { window.addEventListener(name, fn); this._bound.push([name, fn]) }
    on('omni:terminal-session-changed', (e) => this._onSession(e.detail ?? {}))
    on(Shells.STATE_EVENT, (e) => this._onShellsState(!!e.detail?.on))
    on('omni:terminal-settings-changed', () => this._onSettings())
    this._renderLines()
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._bound.forEach(([n, f]) => window.removeEventListener(n, f))
    this._bound = []
    if (this._runner) Session.removeRunner(this._runner)
    this._runner = null
    if (this._el) stopThemeLive()
    this._el?.parentNode?.removeChild(this._el)
    this._el = null
  }

  open () { this._isOpen = true; this._el.classList.add('open'); WindowManager.bringToFront('omnicommandterminal', false) }
  close () { this._isOpen = false; this._autoOpened = false; this._el.classList.remove('open') }

  /** Whether the panel is showing (tests, other panels). */
  isOpen () { return this._isOpen }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-command-terminal-panel'
    el.innerHTML = `
      <div class="oct-header">⟐ OmniCommandTerminal<button class="oct-close" data-omni-tip="Close terminal panel" data-omni-tip-key="—" data-omni-tip-desc="Closes this panel only. The in-scene terminal tunnels keep their on / off state; press the Terminal button to switch them.">✕</button></div>
      <div class="oct-output" id="oct-output"></div>
      <div class="oct-input-row">
        <span class="oct-prompt">⟐</span>
        <input class="oct-input" id="oct-input" placeholder="commandName arg1 arg2" autocomplete="off" autocapitalize="off" spellcheck="false" data-omni-tip="Terminal input" data-omni-tip-key="Enter" data-omni-tip-desc="Type a command and press Enter. With 'Both' in the TerminalSettings the line also shows on the in-scene terminal. Arrow up / down walk the history; Escape closes the terminals." />
      </div>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('.oct-close').addEventListener('click', () => this.close())
    const input = this._el.querySelector('#oct-input')
    input.addEventListener('input', () => Session.setDraft(input.value, 'dom'))
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.blur(); window.dispatchEvent(new CustomEvent('omni:terminal-dismiss')); return }
      if (e.key === 'F1') { e.preventDefault(); window.dispatchEvent(new CustomEvent('omni:terminal-invoke', { detail: { toggle: true } })); return }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); input.value = Session.stepHistory(e.key === 'ArrowUp' ? -1 : 1, 'dom'); return }
      if (e.key !== 'Enter') return
      const raw = input.value.trim()
      if (!raw) return
      input.value = ''
      Session.submit(raw, 'dom')
    })
  }

  // ── The shared session ──────────────────────────────────────────────────────

  _onSession (d) {
    if (!this._el) return
    if (d.kind === 'line' || d.kind === 'clear') this._renderLines()
    if (d.kind === 'draft' || d.kind === 'clear') {
      const input = this._el.querySelector('#oct-input')
      if (input && d.source !== 'dom' && input.value !== Session.getDraft()) input.value = Session.getDraft()
    }
  }

  _renderLines () {
    const output = this._el?.querySelector('#oct-output')
    if (!output) return
    output.textContent = ''
    for (const l of Session.getLines()) {
      const line = document.createElement('div')
      line.className = l.cls
      line.textContent = l.text
      output.appendChild(line)
    }
    output.scrollTop = output.scrollHeight
  }

  /** The terminals went on or off: when typing is on the DOM ('dom' / 'both') this panel opens and closes with them. */
  _onShellsState (on) {
    if (!this._el || getSettings().inputSurface === 'scene') return
    if (on) {
      if (!this._isOpen) { this.open(); this._autoOpened = true }
      if (getSettings().inputSurface === 'dom') this._el.querySelector('#oct-input')?.focus?.()   // in 'both' the scene terminal has the keyboard; a click on this input moves it here
    } else {
      this._el.querySelector('#oct-input')?.blur?.()
      if (this._isOpen) this.close()
    }
  }

  _onSettings () {
    if (!this._el) return
    const surface = getSettings().inputSurface
    if (surface === 'scene') { if (this._autoOpened && this._isOpen) this.close() }
    else if (Shells.isOn() && !this._isOpen) { this.open(); this._autoOpened = true }
  }

  _echo (text, cls = 'oct-line') {
    Session.addLine(text, cls, 'dom')
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
