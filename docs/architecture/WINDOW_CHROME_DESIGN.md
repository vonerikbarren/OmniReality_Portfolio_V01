# Window chrome: resize + maximize for every panel window (V187)

Applies to: V187 · Status: verified in software-GL Chromium and jsdom on 2026-10-11 · Real devices, real GPU, touch: not verified.

Files: `utils/OmniWindowChrome.js` (new, the whole mechanism), `ui/WindowManager.js` (hooks it into `register` / `unregister` / `makeMaximizable` / `bringToFront`), `ui/AdminPanel.js` (Reset window sizes), explicit `enhanceWindow` calls in the eleven panels that never registered with the WindowManager (table below).

## Goal and decisions (interpretations)

- "All panel windows" means every floating panel that has a title bar and can sit over the scene (class A below). The ribbon, dock, hands, pads, toasts, tooltips, reticles, HUD strips, dropdowns, modal pickers and context menus are not windows (class B, C) and get no handles.
- "Resizable" = eight handles, any edge or corner. "Maximizable" = a button in the title bar plus a double-click on the title bar. Maximized fills the free area, not the whole viewport, so the ribbon, the top hands and the dock stay usable.
- Sizes are remembered, positions are not (positions were never saved; making them persist is a separate decision). The maximized state is never saved.
- No key is bound to maximize: Esc closes things in several panels and Alt+Enter is browser fullscreen on some systems, so a conflict is possible. Skipped on purpose.

## Mechanism

`enhanceWindow(el, opts)` (also `WindowManager.enhanceWindow`) is idempotent and returns a disposer. A second call on the same element returns the same disposer and only merges options (a later `register()` may bring the id or callbacks). `WindowManager.register()` calls it for every registered window, so a panel needs no code of its own. Panels that never register call it directly.

| Part | Behaviour |
|---|---|
| Handles | One container `.omni-win-rzs` appended as the last child with eight `.omni-win-rz` (`data-dir` n s e w ne nw se sw). Edges 6 px, corners 14 px (larger on coarse pointers). Pointer events with `setPointerCapture`, applied once per animation frame. `touch-action: none`. |
| Limits | Minimum 220 x 120 (or the panel's own CSS `min-width` / `min-height` when larger, never above the area). Maximum is the free area: below the global bar and the ribbon, above the dock, inside the viewport. The header can never leave the screen. |
| Writing the rect | Inline `left / top / width / height` plus `right / bottom: auto`, `max-width / max-height: none` and `margin: 0`, all with priority `important` so the phone bottom-sheet CSS (`!important`) cannot win. A centring `translate(-50%,-50%)` is folded into left/top; an identity transform (gsap resting state) is left alone so slide-in animations keep working. The panel's own header drag writes plain inline left/top and replaces the important value, so the old drag still works. |
| Maximize button | `button.omni-win-max-btn` with `data-omni-win-max`, glyph ⛶ / ❐, `aria-label`, `aria-pressed`, OmniNotify attributes `data-omni-tip`, `data-omni-tip-key`, `data-omni-tip-desc`. Inserted before the minimize / close control and given that control's class so it looks like its neighbours. A maximize button a panel already had (OmniDraw, Admin, OmniChronos, Inspector) is adopted instead of adding a second. `WindowManager.makeMaximizable(el, btn, cbs)` now delegates to the same code. |
| Header detection | `[data-win-header]`, else a child or grandchild whose class looks like a header / title bar (`-header`, `-hd`, `-head`, `-titlebar`), else a child with a `grab` / `move` cursor. If none is found the panel still gets handles and the coverage table lists it as "no header" (none today). |
| Maximized | Rect = `getMaximizeArea()`: full width, top = `--omni-top-stack` (global bar + ribbon + the top hands banner when shown), bottom = top of `#omni-dock`. Written with `!important`. Classes `omni-win-max` and the legacy `win-maximized`; `data-omni-maximized`. The window stays in `#omni-ui`, so its z-order and the stacking context are unchanged. Refit on window resize and on `omni:layout-changed` (banner hidden / shown, ribbon folded). A capture-phase listener stops the legacy header drag while maximized. |
| Restore | Exact: every touched inline property is snapshotted as value + priority before maximizing (and before a resize starts) and put back verbatim. |
| One affordance | Old per-panel SE grips (`[class*="resize-handle"]`, about 40 files) are tagged `omni-win-legacy-rz` and hidden by CSS; native `resize: both` is neutralised. |
| Re-render | Shallow MutationObservers on the root and the header re-inject handles / button if a panel rebuilds its children. |
| Canvas / chart hook | `opts.onWindowResize(rect)` and a ResizeObserver per window (one callback per frame, not per pointermove) plus the events below. Existing observers in OmniChronos and the timeline view keep working; the D3 charts redraw from their own ResizeObserver. No heavy rebuild happens during the drag. |
| Events | `omni:window-resized {id, rect}`, `omni:window-maximized-changed {id, maximized}`, `omni:window-sizes-reset`. |
| Phone (<= 700 px) | A full-width bottom sheet gets only the top handle (height only, left/top untouched). Maximize fills the free area. The maximize button is at least 36 px tall. |

### Persistence

`localStorage['omni:window-rects-v1'] = { v: 1, rects: { <id>: { w, h, t } } }`. Size only. On a phone the key is `<id>@p` and only the height is stored. Loading validates everything: wrong version, non-objects, arrays, keys longer than 80 characters or named `__proto__` / `constructor` / `prototype`, non-finite, negative, absurd (> 10000) or too small (< 80 x 60) numbers are dropped; the result has a null prototype; at most 100 entries (oldest by `t` dropped). Every read and write is in try/catch, so blocked storage (private mode) only means nothing is remembered. A saved size is clamped to the free area when applied. **Reset window sizes** (Admin > UI Settings > Window sizes, or `WindowManager.resetWindowSizes()`) restores each open window's original inline size, clears the key and fires `omni:window-sizes-reset`.

### Other fixes made on the way

- `WindowManager.watchPanelOpacity` leaked one `omni:admin-settings-saved` listener per panel forever. It now returns an unwatch function, replaces an earlier watch on the same element, removes itself when the element leaves the document, and `unregister` calls it.
- `MAX_WINDOWS` raised from 50 to 200: the enumeration found 67 distinct registered ids, so the old cap silently left windows unregistered (no tray entry, no z-order).
- Eleven panels never registered with the WindowManager and got an explicit `enhanceWindow` call:

| File | id |
|---|---|
| `ui/Dev_FPS_Exp_ListOfEmotions.js` | `devfpsexp` |
| `ui/OmniCommandTerminalPanel.js` | `omnicommandterminal` |
| `ui/OmniChat.js` | `omnichat` |
| `ui/OmniLogEditorPanel.js` | `omnilogeditor` |
| `ui/OmniProgramPanel.js` | `omniprogrampanel` |
| `ui/OmniRealityGridSelectorPanel.js` | `omnigridselector` |
| `ui/OmniRealityGridPointSelectorPanel.js` | `omnigridpointselector` |
| `ui/TestCallStackPanel.js` | `testcallstack` |
| `ui/OmniKeyboardShortcutsPanel.js` | `omnishortcuts` |
| `systems/OmniGallery.js` | `omnigallery` |
| `ui/Panel.js` (LH / RH cell panels) | `panel-<id>` |

## Classes

- **A, window panels:** must resize and maximize. Everything the enumeration found (below) that has a title bar.
- **B, not a window (excluded):** `#omni-ribbon` (docked bar), `#omni-dock` (bar), `#omni-panel-tray` (tray strip), `#omni-global-bar`, the four hands `.omni-hand` and their pads / tunnels (corner controls), `#omni-notify-box` and `.omni-notify-panel` (toast / dropdown), OmniNotify tooltips, `.omni-inspection` / `.omni-inspection-hud` (reticle and HUD), `#omni-start-hud`, `#omni-store-hud` (fixed HUD strip), `.oiv-hud` (OmniVisor HUD), `.ot-vault` (OmniTranslator strips), the minimap, the quick launcher (`.omni-ql`), the boot layer.
- **C, edge cases, decided:**
  - `.omni-draw-mode-picker`, `OmniKeyCryptxReveal`, `OmniEmojiPicker`: modal pickers. Not windows, excluded.
  - Context menus: excluded.
  - Detached movement pads: excluded (small controls that already remember a position).
  - `HandSpeedPanel`: a transient popover that is deliberately not registered. Excluded.

Counts: **class A 79 panels**, **class B 18 groups** (not windows), **class C 6 decisions**.

## Inventory of class A (how each panel is built, header, before V187)

Found by driving the real app: every ribbon / drawer label (107), the system toggles, the open-request events (internal, program, user, payload, chat, structure, edit, translator, terminal) and the Assistance > Keyboard Shortcuts item; then every fixed / absolute element with a title bar in `#omni-ui` or `body`; then the WindowManager registry (`getRegisteredWindows()`, 69 ids) to find windows that were not visible; two registered windows (`omninode`, `omnipocket`) only exist as a state of a node / the pocket and were forced visible through the registry. "Before" = resize grip / maximize button that the panel's own file had in V186 (static scan of the V186 source). "Header" is the first header-like class in the file (static scan; the runtime detector found a header for all 79).

| Panel id | File | How it was opened | Header | Resizable / maximizable before V187 | Built by |
|---|---|---|---|---|---|
| admin | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Admin | .ip-header | SE grip / no | WindowManager.register |
| axinatorpanel | ui/OmniAxinatorPanel.js | ⟐OmniAxinator | .oaxp-header | no / no | WindowManager.register |
| browserspacepanel | ui/OmniBrowserSpacePanel.js | ⟐OmniBrowserSpaceSettings | .bs-header | SE grip / no | WindowManager.register |
| cameratravelsettings | ui/CameraTravelSettingsPanel.js | ⟐CameraTravelSettings | .cts-header | no / no | WindowManager.register |
| cammovement | ui/CameraMovementOptionsPanel.js | ⟐CameraMovementOptions | .cm-header | SE grip / no | WindowManager.register |
| devclaudecheck | ui/OmniSettingsPanelBase.js subclass | ⟐DevClaudeCheck | .oss-header | SE grip / no | WindowManager.register |
| developer | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Developer | .ip-header | SE grip / no | WindowManager.register |
| devfpsexp | ui/Dev_FPS_Exp_ListOfEmotions.js | ⟐Dev_FPS_Exp_ListOfEmotions | .dfe-header | no / no | explicit enhanceWindow |
| devomnistoresettings | ui/OmniSettingsPanelBase.js subclass | ⟐DevOmniStoreSettings | .oss-header | SE grip / no | WindowManager.register |
| dimaxessettings | ui/DimensionalAxesSettingsPanel.js | ⟐DimensionalAxesSettings | .das-header | no / no | WindowManager.register |
| experiences | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Experiences | .ip-header | SE grip / no | WindowManager.register |
| expressionator | ui/OmniExpressionatorPanel.js | ⟐OmniExpressionator | .ex-header | SE grip / no | WindowManager.register |
| floormanager | ui/FloorManagerPanel.js | ⟐FloorManager | .fmp-header | no / no | WindowManager.register |
| floorsettings | ui/FloorSettingsPanel.js | ⟐FloorSettings | .fs-header | SE grip / no | WindowManager.register |
| governance | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Governance | .ip-header | SE grip / no | WindowManager.register |
| infrastructures | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Infrastructures | .ip-header | SE grip / no | WindowManager.register |
| inputmonitor | ui/InputMonitorPanel.js | ⟐OmniInputMonitor | .im-header | SE grip / no | WindowManager.register |
| intelligence | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Intelligence | .ip-header | SE grip / no | WindowManager.register |
| minimapsettings | ui/MiniMapSettingsPanel.js | ⟐MiniMapSettings | .mms-header | no / no | WindowManager.register |
| nav-contact | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Contact | .ip-header | SE grip / no | WindowManager.register |
| nav-home | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Home | .ip-header | SE grip / no | WindowManager.register |
| nav-products | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Products | .ip-header | SE grip / no | WindowManager.register |
| nav-resources | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Resources | .ip-header | SE grip / no | WindowManager.register |
| nav-services | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Services | .ip-header | SE grip / no | WindowManager.register |
| nav-work | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Work | .ip-header | SE grip / no | WindowManager.register |
| navmap-⟐NavMap | ui/IndexedPanel.js | ⟐NavMap | .ip-header | SE grip / no | WindowManager.register |
| objects | ui/IndexedPanel.js | ⟐Objects | .ip-header | SE grip / no | WindowManager.register |
| omnibrowser-1 | ui/OmniBrowser.js | ⟐Developer | .ob-header | SE grip / no | WindowManager.register |
| omnibrowser-wrapper | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐OmniBrowser | .ip-header | SE grip / no | WindowManager.register |
| omnibrowserprops | ui/OmniBrowserProperties.js | ⟐Developer | .bp-header | SE grip / no | WindowManager.register |
| omnichat | ui/OmniChat.js | ⟐OmniDrawChat | .oc-header | no / no | explicit enhanceWindow |
| omnichronos | ui/OmniChronos.js | ⟐OmniChronos | .chr-header | SE grip / yes | WindowManager.register |
| omnicommandterminal | ui/OmniCommandTerminalPanel.js | ⟐OmniCommandTerminal | .oct-header | no / no | explicit enhanceWindow |
| omnidraw | ui/OmniDraw.js | ⟐OmniDrawStatic | .od-header | SE grip / yes | WindowManager.register |
| omnidrawbehavior | ui/OmniDrawBehavior.js | ⟐OmniDrawBehavior | .odb-header | SE grip / no | WindowManager.register |
| omnidrawcell | ui/OmniDrawCell.js | ⟐OmniDrawCell | .odc-header | SE grip / no | WindowManager.register |
| omnidrawdynamic | ui/OmniDrawDynamic.js | ⟐OmniDrawDynamic | .odd-header | SE grip / no | WindowManager.register |
| omniexchange | ui/OmniExchangeRadial.js | ⟐OmniExchange | .xr-header | no / no | WindowManager.register |
| omniexpression | ui/OmniExpression.js | ⟐OmniExpressionPresenter | .oe-header | SE grip / no | WindowManager.register |
| omniexpression-wrapper | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐OmniExpression | .ip-header | SE grip / no | WindowManager.register |
| omniexpressionvideoplayer | ui/OmniExpressionVideoPlayer.js | ⟐UserPresenterVideoSettings | .evp-header | SE grip / no | WindowManager.register |
| omnigallery | systems/OmniGallery.js | sys:omnigallery | .og-header | no / no | WindowManager.register |
| omnigridpointselector | ui/OmniRealityGridPointSelectorPanel.js | ⟐OmniRealityGridPointSelector | .ogps-header | no / no | explicit enhanceWindow |
| omnigridselector | ui/OmniRealityGridSelectorPanel.js | ⟐OmniRealityGridSelector | .ogs-header | no / no | explicit enhanceWindow |
| omnihands | ui/OmniHandsPanel.js | ⟐ConsciousHand | .omh-header | no / no | WindowManager.register |
| omniinspector | systems/OmniInspector.js | present at start / system toggle | .oi-header | SE grip / yes | WindowManager.register |
| omnijsonifier | ui/OmniJsonifier.js | ⟐OmniDrawJsonifier | .oj-header | SE grip / no | WindowManager.register |
| omnikeys | ui/OmniKeys.js | ⟐OmniKeys | .ok-header | SE grip / no | WindowManager.register |
| omnilogeditor | ui/OmniLogEditorPanel.js | ⟐OmniDrawLog | detected at runtime | no / no | explicit enhanceWindow |
| omnimixer | ui/OmniMixerPanel.js | ⟐OmniMixer | .mx-channel-head | SE grip / no | WindowManager.register |
| omninode | systems/OmniNode.js | forced (registry) | .on-header | no / no | WindowManager.register |
| omnipayload | ui/OmniPayloadPanel.js | omni:payload-open | .opl-header | SE grip / no | WindowManager.register |
| omniplayerdashboard | ui/OmniPlayerDashboard.js | ⟐OmniPlayer | .pd-header | SE grip / no | WindowManager.register |
| omnipocket | systems/OmniPocket.js | forced (registry) | .opk-header | no / no | WindowManager.register |
| omnipresenter | systems/OmniPresenter.js | sys:omnipresenter | .op-header | no / no | WindowManager.register |
| omniprogrampanel | ui/OmniProgramPanel.js | ⟐OmniNavi | .opp-header | no / no | explicit enhanceWindow |
| omniselector | ui/OmniSelector.js | ⟐OmniSelect | .os-header | SE grip / no | WindowManager.register |
| omnisense-wrapper | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐OmniSense | .ip-header | SE grip / no | WindowManager.register |
| omnishortcuts | ui/OmniKeyboardShortcutsPanel.js | shortcuts | .oks-header | no / no | explicit enhanceWindow |
| omnistoresettings | ui/OmniSettingsPanelBase.js subclass | ⟐OmniStoreSettings | .oss-header | SE grip / no | WindowManager.register |
| omnitalent | ui/OmniSettingsPanelBase.js subclass | ⟐OmniTalent | .oss-header | SE grip / no | WindowManager.register |
| omnitargeting-wrapper | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐OmniTargeting | .ip-header | SE grip / no | WindowManager.register |
| omniuserpanel | ui/OmniUserPanel.js | omni:omniuser-toggle | .up-header | SE grip / no | WindowManager.register |
| omniwallet | ui/OmniWalletPanel.js | ⟐OmniValue | .wl-header | no / no | WindowManager.register |
| panelcontrol | ui/OmniRibbon.js | ⟐PanelControl | detected at runtime | no / no | WindowManager.register |
| particlesettings | ui/ParticleSettingsPanel.js | ⟐OmniParticleSettings | .ps-header | SE grip / no | WindowManager.register |
| realities | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Realities | .ip-header | SE grip / no | WindowManager.register |
| spaces | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Spaces | .ip-header | SE grip / no | WindowManager.register |
| sysanimator | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐OmniSystemAnimator | .ip-header | SE grip / no | WindowManager.register |
| syscreator | ui/OmniSystemCreatorPanel.js | ⟐OmniSystemCreator | .sc-node-head | SE grip / no | WindowManager.register |
| sysdimensionalizer | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐OmniSystemDimensionalizer | .ip-header | SE grip / no | WindowManager.register |
| syssettings | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐OmniSystemSettings | .ip-header | SE grip / no | WindowManager.register |
| targetingsettings | ui/OmniTargetingSettingsPanel.js | ⟐OmniTargetingSettings | .ts-header | SE grip / no | WindowManager.register |
| terminalsettings | ui/TerminalSettingsPanel.js | ⟐TerminalSettings | .tms-header | no / no | WindowManager.register |
| testcallstack | ui/TestCallStackPanel.js | ⟐TestCallStack | .tcs-header | no / no | explicit enhanceWindow |
| times | ui/IndexedPanel.js (drawer panel, registered in main.js) | ⟐Times | .ip-header | SE grip / no | WindowManager.register |
| tooltipsettings | ui/ToolTipSettingsPanel.js | ⟐ToolTipSettings | .tts-header | no / no | WindowManager.register |
| usertime | ui/UserTimePanel.js | ⟐UserTime | .ut-header | SE grip / no | WindowManager.register |
| wallpapersettings | ui/WallpaperSettingsPanel.js | ⟐OmniWallpaperSettings | .ws-header | SE grip / no | WindowManager.register |

## Coverage test (real Chromium, 1280x720 and 390x844)

Script: a Playwright run against the V187 build (kept outside the repo; method below). For every class-A panel it: opens it through the app, checks that the root has the chrome class, 8 handles, one maximize button and no visible old grip; drags the SE corner by +80,+60 with real mouse events (a phone bottom sheet is dragged by its top edge by 60 px; a panel taller than the free area is tested with the east edge); clicks the maximize button and compares the rect with the expected maximize area within 2 px; clicks it again and compares with the exact rect from before (a window that overflowed the free area is pulled back inside, which the test expects and marks); double-clicks the title bar to maximize and again to restore; saves; and after a page reload checks that the saved size is back (clamped to the free area) and that no window comes back maximized. Test-environment notes: the 3D draw calls were no-ops and `backdrop-filter` was off during the run (software GL made the run far too slow otherwise), and only the window under test was visible (the others were hidden so they could not cover its handles).

Result: **desktop 79 / 79** (77 opened through the app + 2 forced), **phone 77 / 77** (the two forced panels were not run on the phone). Size persisted after reload: desktop 76 of 77 in the automated pass (the 77th, Keyboard Shortcuts, was not reopened by the script after the reload; a direct test with a seeded size shows 500x400 restored and not maximized), phone 75 of 77 in the automated pass (OmniExchange was fixed after that run and re-checked directly: 617 px sheet height restored; Keyboard Shortcuts re-checked directly: height restored). Cells marked (*) were checked that way.

Legend: each cell is desktop / phone. Handles = number of resize handles. Maximize / Resize / Restore = real-mouse result. "Persisted" = size back after reload.

| Panel id | Opened ok | Handles (desk / phone) | Maximize | Resize (+80,+60) | Restore exact | Size persisted after reload | Notes |
|---|---|---|---|---|---|---|---|
| admin | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| axinatorpanel | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| browserspacepanel | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| cameratravelsettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| cammovement | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| devclaudecheck | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| developer | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| devfpsexp | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| devomnistoresettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| dimaxessettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| experiences | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| expressionator | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| floormanager | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| floorsettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| governance | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| infrastructures | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| inputmonitor | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| intelligence | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| minimapsettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| nav-contact | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| nav-home | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| nav-products | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| nav-resources | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| nav-services | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| nav-work | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| navmap-⟐NavMap | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| objects | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnibrowser-1 | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnibrowser-wrapper | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnibrowserprops | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnichat | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnichronos | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnicommandterminal | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnidraw | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnidrawbehavior | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes | desk: restore pulls an overflowing window back inside; desk: taller than the free area, tested with the E edge |
| omnidrawcell | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnidrawdynamic | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniexchange | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes (*) |  |
| omniexpression | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniexpression-wrapper | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniexpressionvideoplayer | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnigallery | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnigridpointselector | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnigridselector | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnihands | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes | desk: restore pulls an overflowing window back inside; desk: taller than the free area, tested with the E edge |
| omniinspector | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnijsonifier | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnikeys | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes | desk: restore pulls an overflowing window back inside; desk: taller than the free area, tested with the E edge |
| omnilogeditor | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes | desk: restore pulls an overflowing window back inside; desk: taller than the free area, tested with the E edge |
| omnimixer | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes | desk: restore pulls an overflowing window back inside; desk: taller than the free area, tested with the E edge |
| omninode | yes | 8 / not run | yes / not run | yes / not run | yes / not run | not checked / n/a | closed panel (opens only from a node / pocket state): forced visible through the registry, desktop only |
| omnipayload | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniplayerdashboard | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnipocket | yes | 8 / not run | yes / not run | yes / not run | yes / not run | not checked / n/a | closed panel (opens only from a node / pocket state): forced visible through the registry, desktop only |
| omnipresenter | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniprogrampanel | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniselector | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnisense-wrapper | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnishortcuts | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes (*) / yes (*) |  |
| omnistoresettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnitalent | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omnitargeting-wrapper | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniuserpanel | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| omniwallet | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| panelcontrol | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| particlesettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| realities | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| spaces | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| sysanimator | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| syscreator | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes | desk: restore pulls an overflowing window back inside; desk: taller than the free area, tested with the E edge |
| sysdimensionalizer | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| syssettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| targetingsettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| terminalsettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| testcallstack | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| times | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| tooltipsettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| usertime | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |
| wallpapersettings | yes | 8 / 8 | yes / yes | yes / yes | yes / yes | yes / yes |  |

## Exceptions and edge notes (nothing is silently skipped)

- **No class-A panel failed** the final desktop or phone run. Failures found on the way and fixed: a maximize button copied from an absolutely positioned close button sat on top of it (6 explicitly enhanced panels; now shifted left of the sibling), the OmniLog editor had no title bar (now its title is the header), the remembered size was clamped to a temporarily small free area and never grew back (now it regrows when the ribbon folds), OmniChronos and OmniExchange reset their own size when they open (they now put the remembered size back), a CSS `min-width` wider than the phone beat the width we set (now lifted), a centred modal wider than a phone (OmniKeys Kryptx mode 560 px, OmniLog editor, Keyboard Shortcuts) had its buttons off-screen (now pulled into view on the first touch / focus), a phone sheet that is anchored by its top (OmniChronos) could grow past the dock (now limited), and the first drag of a centred (translate -50%) panel made it jump / animate (now measured before, and the open-pop transition is switched off for the fold).
- **Panels that only open in a state** (`omninode`, `omnipocket`; also OmniEdgeInspector, ExpressionInspector, KeysInspector, SelectorInspector, InternalPanel, ProgramEditor, UserPanel and the Account panels, which share the same chrome through the registry): checked through the forced-visible registry test; nobody opened them through a real node click.
- **OmniChronos on a phone** keeps its own fit logic (it is placed by `gsap.set` on every layout change); the remembered height is put back after that, but it can differ by a few pixels from the dragged value.
- **A maximized window covers the bottom hands** (z-order: hands 43 / 60 under panels 200+). The dock icons ⚇ / ⚉ stay reachable. The top hands stay visible by design (maximize starts below the hands banner).
- **OmniExchange maximized at 1280x720**: the wheel is taller than the free area, so it sits partly under the sticky buy bar until the body is scrolled (the body scrolls, the title bar stays). Not changed.
- Panels with a flex-column body scroll their body; a panel whose root is not a flex column would clip instead of scroll. None was found in the screenshots; no scroll fallback was added.
- Screenshots read (maximized): Admin, OmniChronos, OmniExchange, DevClaudeCheck at 1280x720; OmniChronos, OmniExchange, OmniStoreSettings, DevClaudeCheck at 390x844. The Admin and FloorManager shots on the phone and the Inspector shots did not maximize in the screenshot script (the script clicked a covered button); those panels pass the coverage test, so this is a script limitation, not a result.

## Not built

- Positions are not saved (only sizes), and no panel remembers "maximized".
- No keyboard shortcut for maximize / restore (Esc and Alt+Enter conflicts were not audited).
- No snapping, tiling or multi-monitor behaviour; the free area is the viewport minus ribbon and dock.
- No resizing for class B / C items (ribbon, dock, hands, HUDs, tooltips, modal pickers, context menus).
- Not verified: a real GPU, a real phone, touch (only synthetic pointer events and Chromium at 390 px), and the feel of dragging at real frame rates.
