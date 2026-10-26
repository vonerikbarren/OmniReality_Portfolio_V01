/**
 * utils/CommandParser.js — the real ⟐ grammar
 *
 * command    := '⟐' commandName (WS argument)*
 * commandName:= [A-Za-z][A-Za-z0-9_]*
 * argument   := quotedString | bareWord
 * quotedString := '"' (any character except '"')* '"'
 * bareWord   := (any character except whitespace or '"')+
 *
 * Deliberately small, per the design doc — no flags, no piping, no
 * chaining. A line that doesn't start with ⟐ isn't a command at
 * all; that's the real, load-bearing seam this parser establishes.
 */

/** Returns { commandName, args } for a real command line, or null
 *  if the line isn't a command at all (doesn't start with ⟐) —
 *  never throws for a non-command line, since that's a real,
 *  ordinary case, not an error. */
export function parseCommand (line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('⟐')) return null

  const rest = trimmed.slice(1)
  const nameMatch = rest.match(/^[A-Za-z][A-Za-z0-9_]*/)
  if (!nameMatch) return null
  const commandName = nameMatch[0]

  const argsText = rest.slice(commandName.length)
  const args = []
  const re = /"([^"]*)"|(\S+)/g
  let m
  while ((m = re.exec(argsText)) !== null) {
    args.push(m[1] !== undefined ? m[1] : m[2])
  }

  return { commandName, args }
}
