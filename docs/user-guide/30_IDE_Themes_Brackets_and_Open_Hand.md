# OmniIDE: themes, settings, brackets, and Omni Open Hand (V233)

## settings_IDE.json
The IDE reads `/home/settings_IDE.json` (created the first time the IDE opens). Press ⚙ in the IDE bar, or `Omni IDE settings`, to open it. **Save (Ctrl/Cmd+S) to apply.**

| Key | Values |
|---|---|
| `theme` | `omni-dark`, `midnight`, `paper` (light), `terminal` (green glow), `dusk`. Also the dropdown in the bar, or `Omni IDE theme(midnight)` |
| `fontFamily`, `fontSize` (8-28), `lineHeight` (1.1-2.4), `tabSize` (1-8) | the editor text |
| `opacity` | 0.2-1. How solid the IDE areas are; lower lets the space show through |
| `sidebar` | `{ "shade": "darker" / "lighter" / "same", "amount": 0-0.6 }`: the file-tree area compared with the editor |
| `text` | `{ "color": "#rrggbb" or null, "shadow": { "enabled", "x", "y", "blur", "color" } }` |
| `brackets` | `autoClose`, `autoSkip`, `wrapSelection`, `colorPairs`, `highlightMatch` (all true by default) |
| `extensions` | `[]`: a list of names, **reserved, does nothing yet** |

A bad key or value is listed in the IDE terminal and ignored; everything else still applies. Broken JSON keeps the last good settings and tells you the line.

## Bracket finishers
- Type `(` `[` `{` `"` `'` and the closer appears after the cursor. Type the closer and you step over it.
- Select text and type an opener to wrap it.
- Backspace between an empty pair removes both.
- Enter between `{ }`, `( )` or `[ ]` opens an indented line and keeps the closer below. Enter elsewhere keeps the line's indent.
- Pairs are coloured by depth, the pair next to the caret is highlighted, and a bracket with no partner is underlined red. Brackets inside strings and comments are ignored.

## Omni Open Hand
`Omni Open Hand(rh) [context(menu|pad|tools|orbiter)] [state(open|close|toggle)]`
Opens the same thing the hand's button opens. Hands: `lh`, `rh`, `conscious`, `omni`. `context` defaults to `menu` (☰), `tools` is the radial (⬢), `pad` is ⚇. `state` defaults to `open`; the hand has to be on screen.
