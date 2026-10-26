/**
 * utils/OmniShortcutTable.js (V201) — the ONE table of keyboard shortcuts.
 *
 * Read by: the Keyboard Shortcuts panel (display), OmniKeys Command mode (a shortcut palette that fires them), and the
 * command terminal (`key <name>` / `shortcut <name>`). Each entry: { key (display text), desc, fire: [KeyboardEvent specs] }.
 * `fire` is what a physical press would send; Command mode and the terminal dispatch REAL KeyboardEvents (no second shortcut map).
 * Pure data + pure helpers (no DOM needed except eventInitFor/dispatch, which take the target as an argument).
 */

/** One key press spec. mods: { ctrl, meta, shift, alt } */
export function F (key, mods = {}) {
  return { key, code: codeFor(key), ctrlKey: !!mods.ctrl, metaKey: !!mods.meta, shiftKey: !!mods.shift, altKey: !!mods.alt }
}

const NAMED = {
  Escape: 'Escape', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ' ': 'Space',
  '`': 'Backquote', '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '(': 'Digit9', ')': 'Digit0',
}
const NUMPAD = { 'Numpad/': 'NumpadDivide', 'Numpad*': 'NumpadMultiply', 'Numpad-': 'NumpadSubtract', 'Numpad+': 'NumpadAdd' }

/** KeyboardEvent.code for a key value (letters, digits, F1..F15, named keys, numpad). */
export function codeFor (key) {
  if (typeof key !== 'string' || !key) return ''
  if (NUMPAD[key]) return NUMPAD[key]
  if (/^Numpad[0-9]$/.test(key)) return key
  if (NAMED[key]) return NAMED[key]
  if (/^F([1-9]|1[0-5])$/.test(key)) return key
  if (/^[a-zA-Z]$/.test(key)) return 'Key' + key.toUpperCase()
  if (/^[0-9]$/.test(key)) return 'Digit' + key
  return ''
}

/** Keys the on-screen layout has no button for (the palette offers them). */
export const NAV_KEYS = Object.freeze(['Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].map(k => ({ key: k, desc: k, fire: [F(k)] })))

export const SHORTCUTS = [
  { key: 'F1',       desc: 'Switch the terminal tunnels on (the Terminal button switches them on and off together)' , fire: [F('F1')] },
  { key: '`',        desc: 'Toggle OmniState_StrictAlign: move the selected node along ONE axis (X, Y or Z) with exact coordinates (V191; the terminal keeps F1)' , fire: [F('`')] },
  { key: '1 2 3 / x y z', desc: 'While OmniState_StrictAlign is on: choose the axis. Arrow keys / PageUp / PageDown / mouse wheel on the node = one step (Shift = big step); Enter = type an exact value; Ctrl+Z = undo; Esc = leave' , fire: [F('1'),F('2'),F('3'),F('x'),F('y'),F('z')] },
  { key: 'Escape',   desc: 'Switch the terminal tunnels off' , fire: [F('Escape')] },
  { key: 'c',        desc: 'Return to landing point coordinates' , fire: [F('c')] },
  { key: 'o',        desc: 'User Space sphere quick toggles' , fire: [F('o')] },
  { key: '0 / 9',    desc: "Toggle the domain grid sphere's visibility" , fire: [F('0'),F('9')] },
  { key: 'b',        desc: 'Toggle OmniBrowser (window 1)' , fire: [F('b')] },
  { key: 'n',        desc: 'Open the OmniDraw mode picker (now also opens OmniNode)' , fire: [F('n')] },
  { key: 'm',        desc: 'Toggle the mini map' , fire: [F('m')] },
  { key: 'k',        desc: 'Toggle OmniMusicPlayer' , fire: [F('k')] },
  { key: 't',        desc: 'Toggle OmniTranslator' , fire: [F('t')] },
  { key: 'p',        desc: 'Toggle ⟐p OmniPresenter' , fire: [F('p')] },
  { key: 'g',        desc: 'Toggle ⟐g OmniGallery' , fire: [F('g')] },
  { key: 'F2',        desc: 'Refresh the page' , fire: [F('F2')] },
  { key: 'F4',        desc: 'Toggle fullscreen' , fire: [F('F4')] },
  { key: 'Escape',   desc: 'Exit fullscreen' , fire: [F('Escape')] },
  { key: '( / )',    desc: 'Wallpaper sphere spin direction' , fire: [F('('),F(')')] },
  { key: 'Enter',    desc: 'Toggle OmniStartHUD' , fire: [F('Enter')] },
  { key: 'q',        desc: 'OmniStarLight search (sites and docs); Escape closes (V195: was Ctrl/Cmd+K; not while typing in a text field)' , fire: [F('q')] },
  { key: 'Ctrl/Cmd+K', desc: 'Expression typing on / off: the keys play notes (A S D F G / J K L ; white keys, Space sustain, B / N octave); Escape leaves (V195)' , fire: [F('k',{ctrl:true})] },
  { key: 'r',        desc: 'Move up (vertical, Y-axis)' , fire: [F('r')] },
  { key: 'f',        desc: 'Move down (vertical, Y-axis)' , fire: [F('f')] },
  { key: 'j',        desc: 'Toggle OmniStemming mode (while OmniMeter(External) is active)' , fire: [F('j')] },
  // V191: corner buttons of the LH / RH pads (ui/MovementPad.js). Ignored with Ctrl / Cmd / Alt held.
  // V195: E and Q no longer move the LH pad (Q opens OmniStarLight); use the ASC / DSC buttons on the pad.
  { key: 'y and h',  desc: 'RH pad: orbit up / down around the current target (hold); keeps going all the way around, over the top and under the bottom (V192; the vertical twin of the Arrow Left / Right orbit)' , fire: [F('y'),F('h')] },
  { key: 'u and v',  desc: 'LH pad: orbit up / down around the current target (hold), the same continuous orbit as y and h (V192)' , fire: [F('u'),F('v')] },
  // OmniHand / Conscious Hand axis pads (V158). These move NO camera — they
  // step the dimensional-axis markers (systems/OmniDimensionalAxes.js). Press
  // = one step, hold = repeat. Compiled from ui/MovementPad.js's _mapKey.
  { key: 'Numpad / and Numpad *', desc: '⟐ OmniHand: Υ tier up / down (no camera movement)' , fire: [F('Numpad/'),F('Numpad*')] },
  { key: 'Numpad - and Numpad +', desc: '⟐ OmniHand: back / forth along the OmniProduct axis, 10 to 4 o\'clock (no camera movement)' , fire: [F('Numpad-'),F('Numpad+')] },
  { key: 'Numpad 7 and Numpad 9', desc: '◬ Conscious Hand: Υ scale degree up / down (no camera movement)' , fire: [F('Numpad7'),F('Numpad9')] },
  { key: 'Numpad 5 and Numpad 6', desc: '◬ Conscious Hand: back / forth along the perspective axis, 8 to 2 o\'clock (no camera movement)' , fire: [F('Numpad5'),F('Numpad6')] },

]

/** Plain KeyboardEventInit for a spec. Numpad keys carry key = the symbol/digit like a real keyboard. */
export function eventInitFor (spec) {
  const key = String(spec.key).replace(/^Numpad/, '') || spec.key
  return { key, code: spec.code, ctrlKey: !!spec.ctrlKey, metaKey: !!spec.metaKey, shiftKey: !!spec.shiftKey, altKey: !!spec.altKey, bubbles: true }
}

/** Fire every spec of an entry as keydown then keyup on `target` (default window). Returns how many events were sent. */
export function fireEntry (entry, target = (typeof window !== 'undefined' ? window : null), only = null) {
  if (!entry || !target) return 0
  let sent = 0
  const list = Array.isArray(entry.fire) ? entry.fire : []
  for (const spec of only == null ? list : [list[only]].filter(Boolean)) {
    const init = eventInitFor(spec)
    target.dispatchEvent(new KeyboardEvent('keydown', init)); sent++
    target.dispatchEvent(new KeyboardEvent('keyup', init)); sent++
  }
  return sent
}

/** Parse "ctrl+k", "shift+arrowup", "q", "f1", "numpad7", "pagedown" into a spec, or null. */
export function parseCombo (text) {
  if (typeof text !== 'string') return null
  const parts = text.trim().split('+').map(s => s.trim()).filter(Boolean)
  if (!parts.length) return null
  const mods = {}
  let key = null
  for (const p of parts) {
    const l = p.toLowerCase()
    if (l === 'ctrl' || l === 'control') mods.ctrl = true
    else if (l === 'cmd' || l === 'meta') mods.meta = true
    else if (l === 'shift') mods.shift = true
    else if (l === 'alt' || l === 'opt') mods.alt = true
    else if (key == null) key = p
    else return null
  }
  if (key == null) return null
  const canon = ['Escape', 'Enter', 'Tab', 'Backspace', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    .find(n => n.toLowerCase() === key.toLowerCase() || (key.toLowerCase() === 'esc' && n === 'Escape') || (key.toLowerCase() === 'space' && false))
  if (canon) key = canon
  else if (key.toLowerCase() === 'space') key = ' '
  else if (/^f\d+$/i.test(key)) key = key.toUpperCase()
  else if (/^numpad/i.test(key)) key = 'Numpad' + key.slice(6)
  else if (key.length === 1) key = key.length === 1 && mods.shift ? key : key.toLowerCase()
  else return null
  const spec = F(key, mods)
  return spec.code ? spec : null
}

/** Find the first entry whose display key or description contains `text` (case-insensitive). */
export function findShortcut (text, list = SHORTCUTS) {
  const t = String(text ?? '').trim().toLowerCase()
  if (!t) return null
  return list.find(s => String(s.key).toLowerCase() === t) ?? list.find(s => String(s.desc).toLowerCase().includes(t)) ?? null
}

export default { SHORTCUTS, NAV_KEYS, F, codeFor, eventInitFor, fireEntry, parseCombo, findShortcut }
