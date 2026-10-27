# 26 · Omni commands and the file system (V219)

Open the OmniTerminal and type commands in the **Omni language**. Words are separated by spaces. A word is `name` or `name(value)`; several values are separated by commas.

```
Omni Draw node(static) pos(0, 0, 0 )
Omni Draw node(sphere) label("Hello") color(#44ccff) scale(2)
Omni Help
Omni Help Draw node
```

`Omni` is optional at the start of a line when the first word is a Capitalised keyword (`Draw node(box)`). The older lowercase commands (`ls`, `cd`, `help` ...) work as before.

**Tab** completes keywords, actions and property names. Unknown properties are refused and the known ones are listed.

## Keywords
Help · Draw · Node (list/get/set/select/delete) · Setting (list/get/set) · Axiom · Vibration · Dimension · Space · File

Destructive actions (deleting, removing) need the extra word `confirm`.

## Files
A small private file system lives in your browser (no server). Start: `/home`, `/home/scripts/hello.omni`, `/home/notes`, `/tmp`.
`Omni File ls | cat | write | mkdir | rm | mv | cp | cd | pwd | tree | find | usage | run`

Limits: names 64 characters, depth 16, 5000 entries, 1 MB per file, 20 MB total.

## Scripts
A `.omni` file is one Omni command per line (`#` or `//` starts a comment). Scripts contain Omni commands only, never JavaScript. Run one with `Omni File run /home/scripts/hello.omni`. A failing line stops the script and reports its line number. Scripts that run scripts are depth-limited.

## OmniIDE and the formatter (V222)
Open **⟐OmniIDE** (ribbon, StarLight "code editor", or `Omni IDE open file(/home/scripts/hello.omni)`). It has a file tree, tabs, a code editor with colouring and line numbers, and a terminal under it. It needs no internet and no outside library.

| Key | What it does |
| --- | --- |
| Ctrl/Cmd+S | Save (formats first when "format on save" is ticked) |
| Shift+Alt+F | Format |
| Ctrl/Cmd+Enter | Run the open script (the **Check** button tests it without running) |
| Tab | Complete the Omni word before the cursor; otherwise two spaces |
| Esc | Leave the editor |

**Format** tidies a script without changing what it does: one space between words, `Keyword Action(arg) prop(value)` in the registered capitals, property names in lower case, values like `pos(0, 0, 0)`, comments kept, one blank line at most, one final newline. A line that cannot be read is left alone and marked red. `Omni File format <path>` does the same from the terminal (`prefix(remove)` drops the leading `Omni`).

## Particles everywhere (V222)
Every tunnel carries the particle stream now: the two top hands, LH, RH, the X / Y / Z axes and the Master Tunnel (OmniChronos). Speed follows the hand's Speed (the Master Tunnel drifts slowly) and the Time axiom. Turn a hand's stream off in ⟐OmniHands.

## OmniKeys on landing (V222)
The OmniKeys keyboard opens when you land. Close it as usual. To stop it opening: `localStorage.setItem('omni:keys-on-landing', 'off')`.
