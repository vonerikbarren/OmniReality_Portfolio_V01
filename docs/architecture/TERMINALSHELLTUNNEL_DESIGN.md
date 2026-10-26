# TerminalShellTunnel — the in-scene terminal as a node (V192)

Status: built in V192 (jsdom tests + software-GL Chromium; real GPU and phone not verified).
Files: `utils/TerminalTheme.js`, `utils/TerminalOrientation.js`, `utils/TerminalSettings.js`, `utils/TerminalSession.js`, `utils/TerminalShells.js`,
`utils/TerminalSceneInput.js`, `utils/OmniExtraKinds.js` (the kind), `modules/TerminalShellTunnel.js`, `modules/TerminalTunnel.js`,
`systems/TerminalShellNodes.js`, `ui/TerminalSettingsForm.js`, `ui/TerminalSettingsPanel.js`, `ui/OmniCommandTerminalPanel.js`,
`ui/OmniExtraKindInspector.js`, `ui/OmniTerminalModules.js`, `ui/ThemeManager.js` (one event), `ui/OmniChat.js` (colours + one fix).

## 1. What existed in V191 (the map)

| Piece | What it was |
|---|---|
| `modules/TerminalTunnel.js` | ONE in-scene terminal: a black cylinder at the centre of the Root and a `CanvasTexture` plane. It only DREW a fixed "Terminal ready" text: no input, no output. Colours: `accent` + `backgroundOpacity` from `utils/TerminalSettings.js`, everything else hard-coded (black, white at 40 %, green text). It faced the camera every frame (`lookAt`); no orientation setting existed. It listened to `omni:terminal-invoke` (show, `if (this._visible) return`) and `omni:terminal-dismiss` (hide). |
| `ui/OmniCommandTerminalPanel.js` | the DOM command terminal (`⟐OmniCommandTerminal`, Developer slot 1, nav item `⟐OmniCommandTerminal`). Real input and output (`CommandParser` / `CommandRegistry`), but hard-coded green-on-black CSS, `left: 1060px` (off screen on a phone) and no link to the scene tunnel. |
| `ui/OmniChat.js` Terminal tab | a third DOM terminal (an echo box). Switching to the tab sent `omni:terminal-invoke`; switching to ANY other tab sent `omni:terminal-dismiss`. |
| `ui/TerminalSettingsPanel.js` | `⟐TerminalSettings` (Admin 11): accent, background opacity, panel position. |
| Buttons | ribbon Home > Assistance > Terminal and the OmniStarLight "Terminal" site, both `omni:terminal-invoke`; F1 / `\`` in `main.js`; Escape = `omni:terminal-dismiss`. |
| Themes | `ui/ThemeManager.js` writes the `--omni-theme-*` CSS variables on `:root` from `data/themes.json` (`dark`, `light`, plus the saved custom set) and saves the name. It announced nothing. |
| Hand tunnels | `systems/OmniAxinator.js`: every tunnel follows ONE source of truth (the pad state), each tunnel's on/off is persisted, a change is announced with `omni:axinator-tunnel-visible`, and the buttons only change that state. |

### Root causes of "the Terminal button does not switch the tunnels on and off together"

1. The button sent `omni:terminal-invoke`, which is one-way: it only showed, and the tunnel ignored it when already shown. Nothing ever toggled; only Escape (or leaving OmniChat's Terminal tab) hid it.
2. The visible flag lived inside each tunnel (`this._visible`). With more than one tunnel there was no shared state, so each tunnel could be in a different state and one missed event left it behind.
3. `OmniChat._switchTab` sent `omni:terminal-dismiss` on EVERY switch to a non-Terminal tab, so changing OmniChat to Chat (or opening it) hid tunnels that a Terminal button had just shown.
4. Nothing was persisted, and nothing told the Terminal button whether the terminals were on.

## 2. The master on / off (the same mechanism as the hand tunnels)

`utils/TerminalShells.js` holds ONE flag, persisted in `localStorage` `omni:terminal-shells:on`, and announces it:

| Event in | Effect |
|---|---|
| `omni:terminal-invoke` `{ toggle: true }` | flip (ribbon Terminal button, OmniStarLight Terminal site, F1 inside the DOM input, the Inspector "Switch all" button) |
| `omni:terminal-invoke` (no detail) | on (F1 and `\`` in `main.js`, OmniChat entering its Terminal tab) |
| `omni:terminal-dismiss` | off (Escape, OmniChat leaving its Terminal tab, Escape inside the DOM input) |
| `omni:terminal-shells-set` `{ on }` | set |
| `omni:terminal-shells-state-request` | re-announce |

Out: `omni:terminal-shells-state` `{ on, count, changed, source }`. EVERY tunnel (the built-in one and each node shell) listens to this one event and makes itself match (`invoke()` / `dismiss()` are idempotent), and a tunnel built later reads `isOn()` in its `init()`. The announcement is made even when the flag did not change, so a tunnel that was out of step is realigned by the next press. The ribbon Terminal button shows pressed from the same event.

F1 and `\`` stay "switch on": they never turn the terminals off. The Terminal BUTTON toggles. (Open question for the owner: should F1 toggle as well?)

## 3. The node

`data.nodeKind = 'terminalShell'`, `geometry` label `TerminalShellTunnel`, `data = { nodeKind, shellId }` only (persisted by reference, like `omniPath`).
The settings of a shell live in `utils/TerminalShells.js` (`omni:terminal-shells:v1`): `{ id, name, nodeId, orientation | null }`. `orientation: null` means "use the default from ⟐TerminalSettings".
`utils/OmniExtraKinds.js` builds the marker mesh (a small open tube), `extraCreateFields` validates the create request; `systems/OmniNode.js` and `systems/OmniInspector.js` needed no change (they already call the extra-kind hooks).
`systems/TerminalShellNodes.js` keeps one `TerminalShellTunnel` instance per node (`modules/TerminalShellTunnel.js`), follows the node's mesh, removes instance and record when the node is deleted or the scene is cleared. At most 12 (`MAX_SHELLS`). Create: ribbon Home > Create > "Terminal node", the "+ TerminalShellTunnel node" button of ⟐TerminalSettings, or `omni:terminal-shell-create-request` `{ name?, position?, orientation?, select? }` (answer in `detail.out`).
The built-in tunnel (`modules/TerminalTunnel.js`, now a subclass) is a shell without a node and without a record; it always exists, so F1 works with zero nodes.
Inspector (Appearance, the same `#oi-custom-extra` block as the other extra kinds): "Terminal settings": name, switch-all button, where you type, colours, orientation of this shell (or "same as the default"). The form is `ui/TerminalSettingsForm.js`, shared with ⟐TerminalSettings.

## 4. One session, two surfaces

`utils/TerminalSession.js`: the output lines, the line being typed (draft), the history and the command runner. The DOM panel owns the command context (the `cd` target, scene access) and registers itself as the runner. Both surfaces only draw the session:
- DOM panel: `#oct-output` is rebuilt from the session, `#oct-input` mirrors the draft.
- Scene panel: the last rows of the session plus the draft row with a caret (`layoutRows`, pure and tested).
All tunnels show the same session (several views of one terminal). Open question: separate sessions per shell?

Setting `inputSurface` (⟐TerminalSettings > Where you type), default `scene`:

| Value | Terminal button turns ON | Keyboard |
|---|---|---|
| `scene` | tunnels appear; the scene terminal gets the keyboard; the DOM panel is NOT opened | scene |
| `dom` | tunnels appear (output mirror, header says "typing: DOM panel") AND the DOM panel opens and focuses its input | DOM input |
| `both` | both; the scene terminal has the keyboard, a click on the DOM input moves it there | either; the draft and every line show in both |

Turning OFF closes a DOM panel that the terminal button opened (not one the user opened by hand). The panel's ✕ closes only the panel and leaves the tunnels on (no desync).
Scene typing (`utils/TerminalSceneInput.js`): the panel is a canvas, so while a scene terminal HAS FOCUS a capture-phase `keydown` edits the session (characters, Backspace, Enter, Arrow up / down) and stops the event, so typing `w` does not walk the camera. Focus is explicit: given when the terminals switch ON (not in `dom` mode), moved by clicking a panel, removed by clicking elsewhere, by Escape/OFF and by `dom` mode. Never taken while a DOM input has focus, with Ctrl / Cmd / Alt, or for F-keys, Tab, Escape.

## 5. Theme

`utils/TerminalTheme.js` (pure): `terminalPalette(tokens, settings)` maps the OmniOS theme tokens (`bg`, `border`, `headerBg`, `text`, `textDim`, `textMuted`, `accent`, `inputBg`, optional `font`) to the terminal palette (`bg` at the opacity setting, `text`, `dim`, `muted`, `prompt` = accent, `accent`, `selection` = accent at 32 %, `border` with an alpha floor, `rule`, `headerBg`, `error` (adapts to a light or dark background), `font` = the theme font or the monospace default). Any missing or unreadable token falls back to the dark theme's value; hostile font strings are refused.
`utils/TerminalSettings.js`: `getPalette()` reads the `--omni-theme-*` variables from `:root`; `applyToRoot()` writes `--terminal-bg/-text/-dim/-muted/-prompt/-accent/-selection/-border/-rule/-header-bg/-input-bg/-error/-font` (plus the old `--terminal-accent` and `--terminal-bg-opacity`), which the DOM panel and OmniChat's Terminal tab use in their CSS.
Live: `ThemeManager.applyTheme` now dispatches `omni:theme-changed`; `startThemeLive()` (reference counted) listens to it AND watches the `style` attribute of `:root` with a `MutationObserver`, rewrites the variables when the palette signature changed and announces `omni:terminal-settings-changed`, which every tunnel redraws on. No feedback loop (the signature is compared before announcing).
`followTheme` (default ON) off: the custom colours (`accent` + `custom { bg, text, prompt, selection, border }`, `#rrggbb` only) are used instead. The opacity setting applies to both.

## 6. Orientation

`utils/TerminalOrientation.js` (pure): `{ preset, yaw, pitch, roll, billboard }`, degrees, clamped to +-180, Euler order YXZ.
- `billboard` ON (the default, the V191 behaviour): faces the camera every frame; `roll` turns it around the line of sight; yaw / pitch are ignored.
- OFF: fixed in the world. Presets: Front (normal +Z), Left (-X), Right (+X), Top (faces down, a ceiling panel), Flat on floor (faces up, lies at y 0.06). Choosing a preset sets billboard OFF; editing an angle by hand makes the preset `custom` (or names the preset it equals).
The default lives in `⟐TerminalSettings` (applies to the built-in tunnel and to every shell without its own); a node shell may have its own (Inspector). Applied live each frame, no rebuild.

## 7. Not done / assumptions

- All tunnels share one session and one keyboard focus.
- OmniChat's Terminal tab is still its own echo box (themed, but not part of the session). With "DOM panel" and that tab open there are two DOM terminals.
- Node shells use a smaller tunnel (radius 6) than the built-in (radius 10, 260 high); the panel of a node shell does not follow the camera height.
- Not verified: real GPU, touch typing on a phone (a canvas panel cannot raise the phone keyboard: on a phone use "DOM panel"), screen readers (the scene panel is a texture, so the DOM panel is the accessible one).
