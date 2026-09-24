/**
 * utils/CommandRegistry.js — the ⟐ command registry
 *
 * Real, shared registry pattern already proven this session
 * (WordTickerRegistry, JsonifierRegistry, ChartDataRegistry): any
 * real OmniProduct registers its own commands here, so command
 * logic lives next to the system it controls, not in one giant
 * terminal file that has to know about everything else directly.
 *
 * Per the design doc's own core principle: a command's real job is
 * almost always to translate typed text into the exact same
 * window.dispatchEvent(...) call a button click would already
 * trigger elsewhere — never a second, parallel way of doing things.
 */

const commands = new Map()

/** handler receives (args, ctx) and returns a real, honest result
 *  string, or throws a real Error with a plain, direct message on
 *  failure — matches this project's own established writing
 *  principle: an error names what went wrong, it doesn't apologize
 *  or stay vague. */
export function registerCommand (name, handler, description = '') {
  commands.set(name, { handler, description })
}

export function getCommand (name) {
  return commands.get(name) ?? null
}

export function getAllCommands () {
  return [...commands.entries()].map(([name, { description }]) => ({ name, description }))
}
