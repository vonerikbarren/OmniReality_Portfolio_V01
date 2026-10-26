# OmniCommandTerminal — Command Language & the Tunnel-Shooting Mechanic

Renamed from OmniTerminal, per direction — more accurate to its real
legacy (`modules/TerminalTunnel.js`'s own placeholder already called
itself "TERMINAL TUNNEL") and to what it literally is and does: a
terminal for real, structured commands, not general text.

Documentation only, per explicit direction — nothing in this file is
built. Written as a real, thought-through overview while OmniChat
gets tested, not a placeholder. Two real, separate pieces: a visual
mechanic (sending a message down the tunnel as a real, physical
object), and a command language (typed commands, with real rules
behind them) — related, but genuinely separable, and the second is
the much bigger of the two.

---

## Part 1 — Shooting a message down the tunnel

### The real problem worth naming precisely

`modules/TerminalTunnel.js` already exists: a real cylinder
(`THREE.CylinderGeometry`), sitting inside `this.group`, at a fixed
local Y position. In Three.js, a cylinder's own length runs along its
own **local Y-axis** by default — this matters directly, because it's
the actual reason "regardless of the tunnel's orientation" is a real,
solvable requirement rather than a vague wish.

If a "shoot down the tunnel" animation just moved a node along
**world-space** -Y, it would only look right for as long as the
tunnel happens to be sitting upright in world space. The moment
`this.group` itself is ever rotated or repositioned — tilted, laid on
its side, moved elsewhere in the scene, any real reason a future
build might reorient it — a world-space-only animation would send the
node drifting in the wrong direction entirely, visibly disconnected
from the tunnel it's supposed to be traveling through.

### The real fix: animate in the tunnel's own local space

The correct approach, and the reason this is genuinely "regardless of
orientation" rather than just "regardless of orientation for now":
animate the node's **local position** along the cylinder's own local
Y-axis (from one end to the other), as a child of `this.group` (or a
dedicated sub-group inside it) — then let Three.js's own, real matrix
math do the actual work. A child object's local-space movement is
automatically transformed by its parent's real, current world matrix
every frame; if `this.group` is rotated, everything inside it rotates
with it, correctly, for free. This is the standard, real reason
parent-child hierarchies exist in a 3D scene graph — not extra work,
the actual, direct solution.

Concretely: the node is created as a child of the tunnel's own group
(not the scene root), positioned at one real end of the cylinder
(local Y matching where the panel sits), and its local Y is animated
toward the opposite end over a real, short duration. No world-space
math is needed anywhere in this — the parenting alone is what makes
it orientation-proof.

### What the node itself should be

Given this was called out directly as "completely unnecessary" beyond
being a GUI delight — the honest, right-sized choice is a small,
dedicated, lightweight mesh (a short cylinder or capsule reads well
as "a piece of text traveling through a tube"), not a full node
spawned through the real `omni:node-create-request` system. A full
node carries Inspector integration, tooltip headers, drag-grab
support, persistence — real weight this purely visual moment doesn't
need. A lightweight, disposable mesh, created and destroyed per
message sent, is the proportionate real choice — matching the same
reasoning already applied to OmniChat's own dummy preview (a small,
honest placeholder, not the full-weight system).

### Room to grow, as named directly

Confirmed as a seed for more complex transformations later — nothing
about the local-space-parenting approach above blocks that. A more
elaborate version later (the node's own shape reacting to the
message's real length, color reacting to something about its
content, a trail effect as it travels) all still rides on the same,
real foundation: local-space animation inside the tunnel's own group.

---

## Part 2 — The ⟐ command language

The bigger, real question: "is it possible to start creating commands
for the field, and the rules behind it?" Yes — and there's a real,
already-existing hint at what this was meant to look like, worth
honoring rather than inventing something unrelated to it.

### The existing hint, already sitting in the code

`TerminalTunnel.js`'s own placeholder panel text, written before this
conversation, already lists real command names:

```
available: help, ls, cd, create,
           inspect, present, pocket
```

These weren't arbitrary — each one maps cleanly onto a real,
already-existing mechanism in this project, which is the strongest
possible argument for keeping them as the real starting set rather
than replacing them:

| Command   | Real, existing mechanism it would drive |
|-----------|-------------------------------------------|
| `help`    | Lists available commands — a real, local operation, no event needed |
| `ls`      | Lists nodes in the current context — reads from `OmniNode`'s own registry |
| `cd`      | "Enters" a node/reality — reuses the real, existing camera-travel system (`goToObject`) |
| `create`  | Spawns a node — maps directly onto the real, existing `omni:node-create-request` event |
| `inspect` | Opens Inspector for a node — maps onto the real, existing `omni:node-selected` event |
| `present` | Presents/focuses a node — maps onto the real, existing `omni:structure-focus` event |
| `pocket`  | Places a node in a hand — maps onto the real, existing `OmniGrab` system |

This table is the real, load-bearing design principle underneath
everything else in this document: **the terminal should not become a
second, parallel way of doing things** — it should be a genuine,
alternate, typed control surface for capabilities that already exist
as real events in this project. A command's real job is almost always
just to translate typed text into the exact same
`window.dispatchEvent(new CustomEvent(...))` call a button click or a
drag gesture would already trigger elsewhere. This is also why this
is honestly a large ramp, not a small one — it's not "build a
terminal," it's "give every real capability in this project a second,
typed way to be reached," which only makes sense to grow gradually as
real needs come up, not all at once.

### Syntax — a first, real proposal

```
⟐commandName arg1 arg2 "argument with spaces"
```

- **The `⟐` prefix is not optional decoration** — it's already this
  project's own, established symbol for "this is a real, addressable
  thing" (every nav label, every special-slot entry already uses it).
  Requiring it on every command keeps the terminal visually
  consistent with everything else in the OS, and gives a real,
  simple first parsing rule: a line that doesn't start with `⟐` isn't
  a command at all — it's a real, ordinary chat message instead. This
  is also the natural, load-bearing seam between OmniChat's two tabs:
  the Chat tab never needs to guess at command syntax, and the
  Terminal tab could, in principle, someday accept plain messages
  too, using the exact same `⟐`-prefix rule to tell them apart.
- **Space-separated arguments**, with double-quotes for an argument
  that itself contains spaces — a small, standard, well-understood
  rule (the same one a real shell uses), not a new convention to
  learn.
- **No sub-command dot-namespacing proposed for now** (e.g. not
  `⟐OmniDraw.create`) — the existing hint list is flat, and staying
  flat matches it. If two different OmniProducts ever want to
  register a command with the same name, that's the real, concrete
  moment namespacing becomes worth adding — not before, per the same
  "don't build the taxonomy before something real needs it" reasoning
  already applied to OmniTranslator's own type system.

### A real, minimal grammar

```
command    := '⟐' commandName (WS argument)*
commandName:= [A-Za-z][A-Za-z0-9_]*
argument   := quotedString | bareWord
quotedString := '"' (any character except '"')* '"'
bareWord   := (any character except whitespace or '"')+
```

Deliberately small. This covers every command in the existing hint
list without needing anything more elaborate yet — flags (`--force`),
piping one command's output into another, or command chaining are all
real, plausible future needs, but none of them are needed to make
`⟐create box` or `⟐inspect my-node` work today, and adding them now
would be designing against imagined needs rather than real ones.

### Registration — a real, extensible pattern already proven in this project

Rather than one large file switching on every possible command name,
the right shape is the same real registry pattern already used
successfully this session (`WordTickerRegistry`, `JsonifierRegistry`,
`ChartDataRegistry`): a small, shared `CommandRegistry` that any real
OmniProduct can register its own commands into —

```
registerCommand('create', (args) => {
  window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: { ... } }))
})
```

This keeps the actual command *logic* living next to the system it
controls (OmniDraw's own file registers `create`, OmniGrab's own file
could register `pocket`), rather than one giant terminal file that
has to know about every other system in the project directly. The
terminal itself only needs to know how to parse a line into a command
name and arguments, and look that name up in the registry — genuinely
small, genuinely separable from everything else.

### Feedback — echoing back to the user

Every real command, once run, should echo something back into the
terminal's own output (`OmniChat.js`'s existing `.oc-terminal-output`
already does exactly this for plain typed lines) — success, a real
result, or a real, honest error if the command name isn't
recognized or an argument is missing. Matches this project's own,
already-established writing principle elsewhere: an error names what
went wrong plainly, it doesn't apologize or stay vague about it.

### Real open questions, not decided here

1. Should `help` (with no arguments) list every registered command,
   or does it need real categories once the list grows past the
   current seven?
2. Does `cd` change what `ls` and other commands mean afterward (a
   real, stateful "current context," the way a real shell's working
   directory works), or does every command always take an explicit
   target argument, with no persistent state between commands?
3. Should failed/unrecognized commands in the Terminal tab also
   trigger the real tunnel-shooting visual from Part 1 (perhaps in a
   different color, as a real, honest "this didn't work" signal), or
   does that visual stay reserved for successful sends only?

---

## Part 3 — ⟐ as a global stabilizer, and OmniScript

A major real expansion of this design: ⟐ isn't proposed as a
terminal-only convention — it's proposed as a **global stabilizer**,
also feeding into OmniCryptx security. Checked directly rather than
assumed, and this connects to something real and already documented,
not a new idea bolted onto an unrelated system.

**The real, existing connection.** `OMNICRYPTEXLAB_DESIGN.md` already
gives OmniSense its own, concrete definition: it **controls symbols,
and what those symbols grant access to** — their meaning, and which
realities/experiences they resolve to. That's the same real shape as
what's being proposed here. ⟐ (and whatever other symbols end up
meaningful in this system) aren't a separate, parallel vocabulary
invented for the terminal — they're real candidates to *be* part of
OmniSense's own, already-defined symbol vocabulary. One real symbol
system, serving both "this addresses a command" and "this grants
access," rather than two unrelated ones that happen to look similar.

**The real, practical question — automating the prefix.** Given
directly: `⟐ls`, `⟐cd`, `⟐pwd` "separate the terminal from the
terminal" — read as: the ⟐ prefix is what tells command-mode text
apart from plain text, the same real distinction already proposed in
Part 2. The question was whether typing ⟐ by hand every time can be
automated away. Real, honest answer: yes, straightforwardly — within
OmniCommandTerminal's own Terminal tab specifically, the *context*
already means every line is a command; there's no real ambiguity to
resolve there the way there might be if commands and plain chat ever
shared one input. So the terminal's own input could auto-prepend ⟐
to whatever's typed, letting a user type just `ls` and have it
treated exactly as `⟐ls` underneath — the visible ⟐ stays real and
meaningful (it's still what gets logged, echoed, and dispatched as
the real event), it just stops being something the user has to
personally type every single time.

**OmniKeys / symbol shorthand — a real, existing home for this, not
a new build.** Proposed: a new top-level tab, UserKeyboardOverride —
when true, lets a user either map their own physical keyboard, or
(leaning this direction) use an on-screen keyboard to type symbols
directly instead of words — `⟐ls` becoming something like `⟐☰`.

Checked directly: `ui/OmniKeys.js` already exists, real and built,
with a QWERTY view that already has "blank letter/symbol pages" —
described in its own design doc as deliberately left blank, the same
honest not-yet-filled-in pattern used elsewhere, waiting for real
content. This isn't a new system to build — it's a real, already-
intended destination for exactly this idea, sitting unfilled.

## Real opinion, given where it was asked for

**On the learning curve** — the self-critique is correct, and worth
stating plainly rather than softened: a purely symbol-based command
language is a real, genuine barrier for anyone starting out. That's
not a reason to drop it, though.

**On doing both** — this is the right call, not just a safe
compromise. It's a well-proven, real pattern elsewhere: a command
line that accepts both a full, readable word and a short, dense
alias, where beginners reach for the word and power users graduate to
the symbol once they've actually learned it (the same real shape as
Vim's own command abbreviations). Supporting both from day one costs
little extra — both forms can resolve to the exact same entry in the
same real command registry from Part 2 — while genuinely serving both
a new user and a fluent one.

**On rewarding OmniScript use** — this is a real, natural fit for
something already on the books: Developer Queue item 13,
OmniPlayer's own planned game-like identification/access badges.
Using OmniScript's real symbol shorthand becoming something that
genuinely earns real recognition inside a system already designed
for exactly that kind of recognition, rather than needing a new,
separate reward mechanism invented just for this.

## Status

Part 2 (the command language) built (V122): the ⟐ grammar
(`utils/CommandParser.js`), the shared registry
(`utils/CommandRegistry.js`), the real terminal panel
(`ui/OmniCommandTerminalPanel.js`, wired to Dev01), and the real,
seven-command starting set from the table above
(`systems/OmniCommandTerminalCommands.js`), each translating typed
text into the exact same real event a button click already
triggers. The three open questions were each given a real, stated
default rather than left blocking: help stays flat (no categories —
only seven commands exist); cd does maintain a real, persistent
"current context," the same shell-cwd shape the design already drew
the analogy to; failed commands get a real, visible error echo in
the output rather than silence. 18 checks, all passing.

Part 1 (the tunnel-shooting visual) and Part 3 (⟐ as an OmniSense/
OmniKeys-level global stabilizer, OmniScript's own symbol shorthand)
remain real, deliberately separate, not-yet-started work.
