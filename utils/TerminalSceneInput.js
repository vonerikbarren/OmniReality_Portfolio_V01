/**
 * utils/TerminalSceneInput.js — V192: typing into the in-scene terminal (TerminalShellTunnel panels).
 *
 * A canvas panel has no <input>, so while a scene terminal HAS FOCUS this module reads the keyboard and edits the shared session
 * (utils/TerminalSession.js): printable characters, Backspace, Enter (runs the line), Arrow up / down (history). It listens in the capture phase
 * on window and stops the event it used, so typing "w" or "b" in the terminal does not walk the camera or open the browser.
 *
 * Focus (utils/TerminalShells.js getFocus) is explicit, never stolen from the rest of the app:
 *   - it is given when the terminals are switched ON and typing is allowed in the scene (setting inputSurface 'scene' or 'both'),
 *   - clicking a terminal panel gives it to that panel (modules/TerminalShellTunnel.js), clicking anywhere else takes it away,
 *   - it is dropped when the terminals go OFF, and when the setting changes to 'dom'.
 * Keys are NOT taken while a DOM input / textarea has focus (that control types for itself), with Ctrl / Cmd / Alt held, for F-keys, Tab or Escape
 * (Escape still dismisses the terminals through main.js).
 */

import * as Shells from './TerminalShells.js'
import * as Session from './TerminalSession.js'
import { getSettings } from './TerminalSettings.js'
import { isExpressionOn } from './OmniExpressionFlag.js'

let refs = 0
let bound = null

const isTypingTarget = () => {
  const a = typeof document !== 'undefined' ? document.activeElement : null
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)
}

/** True when the scene terminal should receive this keyboard event. */
export function sceneTypingActive () {
  return Shells.isOn() && Shells.getFocus() != null && getSettings().inputSurface !== 'dom'
}

/** Handle one keydown. Returns true when it was used (the caller stops the event). Exported for the tests. */
export function handleKey (e) {
  if (isExpressionOn()) return false              // V195: Expression typing owns every key while it is on
  if (!sceneTypingActive() || isTypingTarget()) return false
  if (e.ctrlKey || e.metaKey || e.altKey) return false
  const k = e.key
  if (k === 'Enter') { Session.submit(Session.getDraft(), 'scene'); return true }
  if (k === 'Backspace') { Session.setDraft(Session.getDraft().slice(0, -1), 'scene'); return true }
  if (k === 'ArrowUp') { Session.stepHistory(-1, 'scene'); return true }
  if (k === 'ArrowDown') { Session.stepHistory(1, 'scene'); return true }
  if (typeof k === 'string' && [...k].length === 1) { Session.setDraft(Session.getDraft() + k, 'scene'); return true }
  return false
}

/** The first shell that should get the keyboard when the terminals come on: the built-in one, else the first live one. */
function defaultFocusKey () {
  const list = Shells.liveTunnels()
  const home = list.find(t => t.focusKey === 'home')
  return (home ?? list[0])?.focusKey ?? null
}

export function retainInput () {
  refs++
  if (bound) return
  const onKey = (e) => { if (handleKey(e)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.() } }
  const onState = (e) => {
    if (e.detail?.on) { if (getSettings().inputSurface !== 'dom' && Shells.getFocus() == null) Shells.setFocus(defaultFocusKey()) } else Shells.setFocus(null)
  }
  const onSettings = () => {
    if (getSettings().inputSurface === 'dom') Shells.setFocus(null)
    else if (Shells.isOn() && Shells.getFocus() == null) Shells.setFocus(defaultFocusKey())
  }
  window.addEventListener('keydown', onKey, true)
  window.addEventListener(Shells.STATE_EVENT, onState)
  window.addEventListener('omni:terminal-settings-changed', onSettings)
  bound = { onKey, onState, onSettings }
}

export function releaseInput () {
  if (refs > 0) refs--
  if (refs > 0 || !bound) return
  window.removeEventListener('keydown', bound.onKey, true)
  window.removeEventListener(Shells.STATE_EVENT, bound.onState)
  window.removeEventListener('omni:terminal-settings-changed', bound.onSettings)
  bound = null
}
