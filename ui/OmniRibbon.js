/**
 * ui/OmniRibbon.js — ⟐OmniRibbon (V169): an Excel-"Home"-style toolbar right under the GlobalBar.
 *
 * The GlobalBar's top-level menu categories are the "File" of the Realities world: they cascade
 * DOWN into one item at a time. The ribbon takes the same idea one level up: the tools you reach for
 * most, laid out flat as large icon + label buttons in captioned groups, in tabs so more can be
 * added later.
 *
 *   Tabs        OmniStar (V190: Docs, OmniStarLight) · Home (▦ dashboard) · Inspector · Realities · Hands      (data table TABS below)
 *   Body        groups of buttons, a caption under each group, thin separators, horizontal scroll
 *   Collapse    chevron at the right (and double-click a tab) -> tabs only; tab + collapsed persist
 *   Phones      <= 700px: tabs row only; tapping a tab drops its body over the scene as an overlay,
 *               tap the tab again / outside / Escape closes it; 44px+ tap targets
 *
 * HONESTY RULES — every button reuses something that already exists:
 *   - panels open through the same `omni:nav-select {item}` the drawers dispatch;
 *   - toggles dispatch the same events the keyboard handlers / Hand cells do (omni:system-toggle,
 *     omni:pad-toggle, omni:osh-toggle, ...); the hand-menu buttons .click() the real Hand cells,
 *     exactly like main.js's 1-4 / Shift key bindings;
 *   - "key" in a tooltip is only ever a binding that really exists (main.js keydown handlers,
 *     ui/OmniKeyboardShortcutsPanel.js). Otherwise it is "—".
 *   - Ctrl/Cmd+F1 was NOT bound: main.js already routes every F1 to the terminal tunnel.
 *
 * Every button carries data-omni-tip / -key / -desc, which ⟐OmniNotify (utils/OmniNotifyHub.js)
 * shows on hover / focus / long-press.
 *
 * Layout: the ribbon owns utils/OmniLayout's --omni-ribbon-h (tabs + body when docked, tabs only
 * when collapsed / on phones) so everything anchored under the bar can follow. Its left edge is
 * --omni-ribbon-left (the docked OmniNotify box sits to its left).
 *
 * Module contract: constructor / init / update / destroy / onResize.
 */

import * as WindowManager from './WindowManager.js'
import * as HandBanner from '../utils/OmniHandBanner.js'
import {
  BAR_H, initLayout, setRibbonHeight, computeRibbonHeight,
  PHONE_MAX, RIBBON_TABS_H_DESKTOP as TABS_H_DESKTOP, RIBBON_TABS_H_PHONE as TABS_H_PHONE, RIBBON_BODY_H as BODY_H,
  RIBBON_STORAGE_KEY as STORAGE_KEY,
} from '../utils/OmniLayout.js'
import { INSPECTOR_SECTIONS } from '../utils/OmniInspectorSections.js'
import * as PrimaryTime from '../utils/PrimaryTime.js'
import * as TerminalShells from '../utils/TerminalShells.js'   // V192: the terminals' master on / off (pressed state of the Terminal button)
import * as TL from '../utils/OmniTimeline.js'
import { EYE_GLYPH } from '../utils/OmniGlyphs.js'

export { STORAGE_KEY, PHONE_MAX, TABS_H_DESKTOP, TABS_H_PHONE, BODY_H }
export { INSPECTOR_SECTIONS }   // V170: the list lives in utils/OmniInspectorSections.js (shared with the Inspector's own icon strip)

// ── Tiny action helpers (each is one real, existing event / handler) ──────────

const ev = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))
const nav = (item) => () => ev('omni:nav-select', { drawer: 'ribbon', item, parent: null, path: `ribbon/${item}` })
const sys = (system) => () => ev('omni:system-toggle', { system })
const note = (name, desc) => ev('omni:notify-info', { name, desc, holdMs: 3500 })
/** Same trick as main.js's HAND_KEY_BINDINGS: click the real Hand cell so every existing behaviour runs. */
const cell = (selector, what) => () => {
  const b = document.querySelector(selector)
  if (b && !b.disabled) b.click()
  else note(what, 'That hand cell is not available right now.')
}
/** V193: Reset HUD. Forget the saved window sizes, re-dock the OmniNotify box, put the userCompass back; nothing else is touched. */
function resetHud () {
  let n = 0
  try { n = WindowManager.resetWindowSizes() } catch (_) { /* chrome not ready */ }
  try { window.dispatchEvent(new CustomEvent('omni:hud-reset', { detail: {} })) } catch (_) { /* no window */ }
  try { window.dispatchEvent(new CustomEvent('omni:user-compass-set', { detail: { resetPos: true } })) } catch (_) { /* no window */ }
  try { window.dispatchEvent(new CustomEvent('omni:layout-changed')) } catch (_) { /* no window */ }
  try { window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: '↺ Reset HUD', desc: `Window sizes reset (${n} open), OmniNotify re-docked, userCompass back in place.` } })) } catch (_) { /* no window */ }
  return n
}
const fakeKey = (key, code) => () => window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }))

// ── The tab table ─────────────────────────────────────────────────────────────
// b(id, icon, label, key, desc, run, extras)  extras: { pressed(s), dim(s), name }

const b = (id, icon, label, key, desc, run, extra = {}) => ({ id, icon, label, key, desc, run, name: label, ...extra })
/** V190: which hand a Hands-tab button belongs to (lh / rh / oh / ch). A divider is drawn wherever the hand changes between two neighbours. */
const HAND_TAG = { lh: 'lh', rh: 'rh', omnihand: 'oh', conscious: 'ch' }
export const handDividerBetween = (prev, cur) => !!prev && (prev.hand ?? null) !== (cur.hand ?? null) && !!((prev.hand ?? null) || (cur.hand ?? null))

function buildTabs () {
  const padBtn = (hand, label, name) => b(`pad-${hand}`, '⚇', label, '—',
    `Show or hide ${name}'s movement pad (the same as its ⚇ cell). Pad on/off is reported back by the pad itself.`,
    (s) => ev('omni:pad-toggle', { hand, visible: !s.pads[hand] }), { name: `${name} pad`, pressed: (s) => !!s.pads[hand], hand: HAND_TAG[hand] })
  // V187: one hand on its own (the pair buttons above switch two at once). Hiding a hand never closes its pad.
  const handShow = (hand, label, name, icon) => b(`show-${hand}`, icon, label, '—',
    `Shows or hides ${name} on its own (the pair buttons switch two hands at once). Hiding a hand never closes its pad or tunnel; keys 1-4 / Shift and the menus on this tab keep working.`,
    (s) => ev('omni:hand-visible-set', { hand, visible: !s.handShown[hand] }), { name: `${name} shown`, pressed: (s) => !!s.handShown[hand], hand: HAND_TAG[hand] })
  const handSettings = (item, label, hand, extraDesc) => b(`set-${hand}`, '⚙', label, '—',
    `Opens ⟐OmniHands on the ${label} view: speed, pad-on-start, pad dock${extraDesc}.`, nav(item), { name: `${label} settings`, hand: HAND_TAG[hand] })

  return [
    {
      id: 'omnistar', label: 'OmniStar', icon: '✧',
      tip: 'OmniStar tab — the user guide and the search',
      groups: [
        { caption: 'OmniStar', btns: [
          b('docs', '≡', 'Docs', '—', 'Opens the Docs panel: the user guide inside the app, a table of contents on the left, the page on the right, a search field that finds and highlights words across all pages. PageDown / PageUp turn pages while it is focused.', nav('⟐OmniDocs'), { name: 'Docs' }),
          b('starlight', '✧', 'OmniStarLight', 'Q', 'Opens OmniStarLight, the Spotlight-style search: it lists the main sites of the app (Available or Unavailable) and finds user-guide pages. Arrow keys move, Enter opens, Escape closes.', () => ev('omni:starlight-toggle'), { name: 'OmniStarLight' }),
        ] },
      ],
    },
    {
      id: 'home', label: 'Home', icon: '▦',
      tip: 'Home tab — dashboard, navigation, creating and the everyday tools',
      groups: [
        { caption: 'Dashboard', btns: [
          b('dashboard', '▦', 'Dashboard', '—', 'Opens the OmniPlayer dashboard — Status and Visors are live; Boundaries and Languages are still placeholders. (This is the only dashboard panel in the app.)', nav('⟐OmniPlayer')),
          b('start-hud', '◰', 'Start HUD', 'Enter', 'Toggles the Start HUD overlay (four empty placeholder quadrants for now).', () => ev('omni:osh-toggle')),
        ] },
        { caption: 'Navigation', btns: [
          b('navmap', '⌖', 'NavMap', '—', 'Opens the ⟐NavMap panel: pick a portal and travel there.', nav('⟐NavMap')),
          b('minimap', '◎', 'MiniMap', 'm', 'Shows or hides the corner mini map.', () => ev('omni:minimap-toggle-request'), { pressed: (s) => s.minimap }),
          b('landing', '⌂', 'Landing', 'c', 'Flies the camera back to the landing point (0, 2, 0).', () => ev('omni:return-to-landing')),
        ] },
        { caption: 'Create', btns: [
          b('draw', '✎', 'OmniDraw', 'n', 'Opens the OmniDraw mode picker (Static, Dynamic, Behavior, Cell, Chat, Log).', nav('⟐OmniDraw')),
          b('draw-static', '▢', 'Static', '—', 'Opens OmniDraw (Static): place a node from a form.', nav('⟐OmniDrawStatic'), { name: 'OmniDraw Static' }),
          b('draw-dynamic', '◇', 'Dynamic', '—', 'Opens OmniDraw (Dynamic): spawn a node in front of the camera.', nav('⟐OmniDrawDynamic'), { name: 'OmniDraw Dynamic' }),
          b('draw-behavior', '↯', 'Behavior', '—', 'Opens OmniDraw (BehaviorNode): the behaviour-node creation flow.', nav('⟐OmniDrawBehavior'), { name: 'OmniDraw Behavior' }),
          b('path-node', '⤳', 'Path node', '—', 'Creates an OmniPathNode in front of the camera: an ordered path of nodes, attached one to the next (LINK) or built from the hierarchy (GENEALOGY). Opens the node order panel.', () => { ev('omni:path-create-request', { select: true }); nav('⟐OmniNodeOrder')() }, { name: 'New path node' }),
          b('terminal-shell', '›_', 'Terminal node', '—', 'Creates a TerminalShellTunnel node in front of the camera: an in-scene terminal that moves with the node. The Terminal button switches every terminal tunnel on and off together; its settings are in the Inspector and in ⟐TerminalSettings.', () => ev('omni:terminal-shell-create-request', { select: true }), { name: 'New TerminalShellTunnel' }),
          b('sound-node', '♪', 'Sound node', '—', 'Creates a SoundNode in front of the camera: a speaker you can place. It makes a sound (a note, a pad, a beat), its bell and rings pulse with the sound, and it can send out particles. Its settings are in ⟐SoundNodeSettings and in the Inspector.', () => ev('omni:sound-node-create', { select: true }), { name: 'New sound node' }),
          b('music-node', '♫', 'Music node', '—', 'Creates a MusicNode in front of the camera: a step sequencer you can place. Its plate lights the playing step. Edit the pattern, record from the keys or MIDI, and play it in ⟐OmniSequencer and in the Inspector.', () => ev('omni:music-node-create', { select: true }), { name: 'New music node' }),
          b('node-order', '⇅', 'Node order', '—', 'Opens ⟐OmniNodeOrder: the nodes of a path in order, drag to reorder, jump to a node, add, remove.', nav('⟐OmniNodeOrder'), { name: 'Node order panel' }),
          b('floor-panels', '▦', 'Floor panels', '—', 'Opens ⟐FloorNodeMakerSettings (Admin): Tetris-piece floor panels, a blueprint grid, pictures / GIFs / videos on the faces, Place in scene.', nav('⟐FloorNodeMakerSettings'), { name: 'Floor panel maker' }),
        ] },
        { caption: 'Tools', btns: [
          b('mixer', '♫', 'Music player', 'k', 'Toggles OmniMusicPlayer (it was called OmniMixer before V195).', nav('⟐OmniMusicPlayer'), { name: 'OmniMusicPlayer' }),
          b('translator', '⇄', 'Translator', 't', 'Toggles OmniTranslator.', () => ev('omni:translator-toggle')),
          b('presenter', '▤', 'Presenter', 'p', 'Toggles the ⟐p OmniPresenter.', sys('omnipresenter')),
          b('gallery', '▥', 'Gallery', 'g', 'Toggles the ⟐g OmniGallery.', sys('omnigallery')),
          b('sound-settings', '♬', 'Sound settings', '—', 'Opens ⟐SoundNodeSettings: every setting of the selected node\'s sound and sound particles, presets, Play / Stop / Audition, copy and paste. Global sound options are in Admin > UI Settings.', nav('⟐SoundNodeSettings'), { name: 'Sound node settings' }),
          b('expression-settings', '⌨', 'Expression settings', '—', 'Opens ⟐OmniExpressionTypingSettings: the key map, octaves, pitch bend and modulation, the instrument and MIDI keyboards. Ctrl/Cmd+K itself turns Expression typing on and off (Esc leaves).', nav('⟐OmniExpressionTypingSettings'), { name: 'Expression settings' }),
          b('expression', '⌗', 'Expression', '—', 'Opens OmniExpression: an on-screen keyboard for both hands (touch or mouse, the keys light up when you play on the computer keys or a MIDI keyboard). Maximize the window for the four quadrants; Split puts each hand in its own window.', () => ev('omni:expression-open'), { name: 'OmniExpression' }),
          b('beatpad', '⊞', 'BeatPad', '—', 'Opens OmniBeatPad: 16 pads in a 4x4 grid. Tap to play; Edit (or a long press) binds a pad to a sound node or a note, with one-shot / hold / toggle modes and choke groups.', nav('OmniBeatPad'), { name: 'OmniBeatPad' }),
          b('browser', '◫', 'Browser', 'b', 'Opens the OmniBrowser (window 1). The b key toggles it; this button only opens it.', nav('⟐OmniBrowserWindow')),
          b('omnidj', '◉', 'OmniDJ', '—', 'Opens ⟐OmniDJ: six jog-wheel circles and six decks with volume, 3-band EQ, cue, mute, loop, pitch, crossfader and master. Tracks come from the OmniMusicPlayer library. The same DJ can sit in an OmniExpression quadrant.', nav('⟐OmniDJ'), { name: 'OmniDJ' }),
        ] },
        { caption: 'Windows', btns: [
          b('panelcontrol', '❐', 'PanelControl', '—', 'Opens ⟐PanelControl: the list of panels and their state.', nav('⟐PanelControl')),
          b('tray', '▲', 'Panel Tray', '—', 'Opens or closes the OmniPanelTray, where minimized panels wait.', () => ev('omni:paneltray-toggle', {}), { pressed: (s) => s.tray }),
        ] },
        { caption: 'Sound', btns: [
          b('sound-viewer', '♪', 'Sound viewer', '—', 'Opens ⟐SoundViewer: the frequency picture of a sound node or of the whole mix — spectrum bars and line, scope, scrolling spectrogram, the 7 band meters, peak note, envelope phase, freeze and zoom.', nav('⟐SoundViewer'), { name: 'Sound viewer' }),
          b('particle-viewer', '✦', 'Particle viewer', '—', 'Opens ⟐SoundParticleViewer: the particle formation of a sound node (top, front, side or orbit) with its live count, plus the formation, count and size controls.', nav('⟐SoundParticleViewer'), { name: 'Particle viewer' }),
          b('sequencer', '▦', 'Sequencer', '—', 'Opens ⟐OmniSequencer: the step grid and piano roll of the selected music node, with Play, Record (count-in, quantize), tracks, instruments and pattern presets.', nav('⟐OmniSequencer'), { name: 'Sequencer' }),
        ] },
        { caption: 'Assistance', btns: [
          b('shortcuts', '⌨', 'Shortcuts', '—', 'Opens the list of every real keyboard shortcut.', () => {
            const item = (WindowManager.getContextMenu(null).Assistance ?? []).find(i => /shortcut/i.test(i.label))
            if (item) item.action(); else note('Shortcuts', 'The keyboard shortcuts panel is not registered yet.')
          }, { name: 'Keyboard shortcuts' }),
          b('terminal', '›_', 'Terminal', '` / F1', 'Switches ALL the terminal tunnels on or off together (the built-in one and every TerminalShellTunnel node), like the hand tunnels. F1 switches them on; Escape switches them off.', () => ev('omni:terminal-invoke', { toggle: true }), { name: 'Terminal tunnels', pressed: (s) => !!s.terminal }),
          b('fullscreen', '⛶', 'Fullscreen', 'F4', 'Toggles fullscreen (same handler as F4).', fakeKey('F4', 'F4')),
          b('refresh', '⟳', 'Refresh', '—', 'Reloads the page. Nodes, settings and panel sizes are saved in this browser and come back.', () => { try { window.location.reload() } catch (_) { /* no window */ } }),
          b('resethud', '↺', 'Reset HUD', '—', 'Puts the HUD back in its default places without reloading: window sizes, the OmniNotify box (under your profile) and the userCompass. Your data and settings stay.', resetHud, { name: 'Reset HUD' }),
        ] },
      ],
    },
    {
      id: 'inspector', label: 'Inspector', icon: '◧',
      tip: 'Inspector tab — one button per Inspector section',
      groups: [
        { caption: 'Panel', btns: [
          b('inspector', '◧', 'Inspector', '—', 'Opens or closes the OmniInspector panel. It also opens by itself when you select a node.', sys('omniinspector'), { name: 'OmniInspector', pressed: (s) => s.inspector.open }),
        ] },
        { caption: 'Node', btns: INSPECTOR_SECTIONS.slice(0, 4).map(secBtn) },
        { caption: 'Look & logic', btns: INSPECTOR_SECTIONS.slice(4, 8).map(secBtn) },
        { caption: 'Content', btns: INSPECTOR_SECTIONS.slice(8).map(secBtn) },
      ],
    },
    {
      id: 'realities', label: 'Realities', icon: '⟐',
      tip: 'Realities tab — managing realities, axes and scopes (the File-menu logic, one level up)',
      groups: [
        { caption: 'Realities', btns: [
          b('realities', '⟐', 'Realities', '—', 'Opens the ⟐Realities indexed panel.', nav('⟐Realities')),
          b('experiences', '◈', 'Experiences', '—', 'Opens the ⟐Experiences indexed panel.', nav('⟐Experiences')),
          b('perspectives', EYE_GLYPH, 'Perspectives', '—', 'PLANNED. Will list the dimensions (perspectives) of the product the ⟐OmniHand selects, on the ⟐ConsciousHand. Not built yet: the button only tells you so.', () => note('Perspectives', 'ConsciousHand lists the dimensions of the product OmniHand selects (planned)'), { name: 'Perspectives (planned)' }),
          b('spaces', '▫', 'Spaces', '—', 'Opens ⟐Spaces: click an empty slot to save the camera position, a saved slot (📍) to fly back to it.', nav('⟐Spaces')),
          b('times', '◷', 'Times', '—', 'Opens the ⟐Times indexed panel.', nav('⟐Times')),
          b('products', '▣', 'Products', '—', 'Opens the ⟐Products indexed panel.', nav('⟐Products')),
        ] },
        { caption: 'Axes', btns: [
          b('axes', '◬', 'Dim. Axes', '—', 'Opens the Dimensional Axes settings.', nav('⟐DimensionalAxesSettings'), { name: 'Dimensional Axes' }),
          b('axinator', '⇋', 'Axinator', '—', 'Opens the OmniAxinator panel: the tunnels and their nodes.', nav('⟐OmniAxinator'), { name: 'OmniAxinator' }),
          b('tunnels', '◌', 'Tunnels', '—', 'Tunnels follow the pads: when on, a tunnel shows while its pad is open. Shared by all four hands.', (s) => ev('omni:dimension-axes-visible-set', { visible: !s.follow }), { name: 'Tunnels follow pads', pressed: (s) => s.follow }),
          b('domain-grid', '⊞', 'Domain grid', '0 / 9', "Toggles the domain grid sphere's visibility.", () => ev('omni:domaingrid-toggle-visible')),
        ] },
        { caption: 'Scopes', btns: [
          b('visor', '◉', 'Visor', '—', 'Opens OmniVisor: inspect what you are looking at.', nav('⟐OmniVisor'), { name: 'OmniVisor' }),
          b('select', '▭', 'Select', '—', 'Opens OmniSelect: multi-select nodes.', nav('⟐OmniSelect'), { name: 'OmniSelect' }),
          b('floors', '▤', 'Floors', '—', 'Opens the Floor manager.', nav('⟐FloorManager'), { name: 'Floor manager' }),
          b('userspace', '○', 'User space', 'o', 'Toggles the User Space sphere (Shift+O toggles its spin).', () => ev('omni:userspace-toggle-visible')),
        ] },
        { caption: 'Chronos', btns: [
          b('chronos', '◔', 'Chronos', '—', 'Opens OmniChronos: the Program Monitor (player) and the Premiere-style timeline. Primary Time is the playhead.', nav('⟐OmniChronos'), { name: 'OmniChronos' }),
          b('chronos-play', '▶', 'Play', '—', 'Plays or pauses Primary Time — the timeline playhead, the floor clock and the travelling reality node. Works with the Chronos window closed. (Space does the same while the pointer is over the Chronos window.)', () => ev('omni:timeline-play-set', { toggle: true }), { name: 'Chronos play / pause', pressed: (s) => s.timeline.playing }),
          b('chronos-back', '◂', 'Step ◀', '—', 'Steps the playhead back one frame (1/30 s) and pauses. (← while the pointer is over the Chronos window.)', () => ev('omni:timeline-step', { frames: -1 }), { name: 'Chronos step back' }),
          b('chronos-fwd', '▸', 'Step ▶', '—', 'Steps the playhead forward one frame (1/30 s) and pauses. (→ while the pointer is over the Chronos window.)', () => ev('omni:timeline-step', { frames: 1 }), { name: 'Chronos step forward' }),
          b('chronos-start', '⇤', 'To start', '—', 'Moves the playhead to the work-area in point, or to 0. (Home while the pointer is over the Chronos window.)', () => ev('omni:timeline-seek', { t: TL.getState().workArea.in ?? 0 }), { name: 'Chronos to start' }),
          b('chronos-add', '＋', 'Add node', '—', 'Adds the node selected in the scene to the timeline as a 5-second clip at the playhead (first unlocked track).', () => ev('omni:timeline-add-selected'), { name: 'Add selected node to timeline' }),
          b('chronos-marker', '⚑', 'Marker', '—', 'Adds a marker at the playhead. (M while the pointer is over the Chronos window; M elsewhere still toggles the minimap.)', () => ev('omni:timeline-marker-add', { t: TL.getT() }), { name: 'Chronos add marker' }),
          b('time-ruler', '⇕', 'Time ruler', '—', 'Opens the TimeData ruler: a vertical 00:00 to 24:00 ruler with the time already used, and week, month, year and decade lines. Its baseline and lines are set in ⟐TimeDataRulerSettings (Admin).', nav('⟐TimeDataRuler'), { name: 'TimeData ruler' }),
        ] },
        { caption: 'Value', btns: [
          b('store', '⟐', 'Store', '—', 'SANDBOX. Opens the ⟐OmniStore shelf (fruit and veg test store) in the scene: sections, media lenses, click a product for its exchange.', nav('⟐OmniStore'), { name: 'OmniStore (sandbox)' }),
          b('exchange', '◎', 'Exchange', '—', 'SANDBOX. Opens the radial exchange panel: the product in the middle, every accepted exchange form around it; buy, sell, and the window / wish / cart list.', nav('⟐OmniExchange'), { name: 'OmniExchange (sandbox)' }),
          b('wallet', '▤', 'Wallet', '—', 'SANDBOX. Opens the wallet: balances per value type, the stated remainder ledger, transactions, grant / reset sandbox value.', nav('⟐Wallet'), { name: 'Wallet (sandbox)' }),
          b('talent', '◉', 'Talent', '—', 'SANDBOX. Opens ⟐OmniTalent: your value across value types and tiers as a sunburst, treemap or sankey, with the rate-loop check. Works outside the store.', nav('⟐OmniTalent'), { name: 'OmniTalent (sandbox)' }),
          b('store-settings', '✎', 'Store Settings', '—', "Opens ⟐OmniStoreSettings (Admin): your store's colours, backdrop, presets and name. Changes show live in the open store.", nav('⟐OmniStoreSettings'), { name: 'Store Settings' }),
          b('dev-store', '⌘', 'Dev Store', '—', 'DEV ONLY. Opens ⟐DevOmniStoreSettings: store type records, catalog JSON import / export, items per page, test data, notes for Claude, dump state. Not part of the user settings.', nav('⟐DevOmniStoreSettings'), { name: 'Dev Store [DEV]' }),
        ] },
        { caption: 'Save', btns: [
          b('save', '⤓', 'Save nodes', '—', 'Writes all nodes and edges to this browser now (they also auto-save). There is no Open / import button because no such handler exists yet.', () => ev('omni:force-save')),
        ] },
      ],
    },
    {
      id: 'hands', label: 'Hands', icon: '⚇',
      tip: 'Hands tab — pads, the hands banner, hand menus and settings',
      groups: [
        { caption: 'Pads', btns: [
          padBtn('lh', 'LH', '⟐LogicalHand'), padBtn('rh', 'RH', '⟐CreativeHand'),
          padBtn('omnihand', 'OmniHand', '⟐OmniHand'), padBtn('conscious', 'Conscious', '⟐ConsciousHand'),
          b('pads-all', '⚇', 'LH + RH', '—', 'Shows or hides the two lower pads together (omni:pads-global moves LH and RH only).', (s) => ev('omni:pads-global', { visible: !(s.pads.lh && s.pads.rh), source: 'ribbon' }), { name: 'Lower pads together', pressed: (s) => !!(s.pads.lh && s.pads.rh) }),
        ] },
        { caption: 'Summon', btns: [
          b('banner', '⚇', '⟐Hands', '—', 'Shows or hides the top hands banner (⟐OmniHand + ⟐ConsciousHand). Pressed = both shown, half = one shown (click shows both). Hiding it never closes a pad or tunnel.', () => ev('omni:hands-banner-set', { visible: !HandBanner.isVisible() }), { name: '⟐Hands banner', pressed: (s) => s.banner, mixed: (s) => s.bannerMixed }),
          b('banner-bottom', '⚉', '⟐Hands LH/RH', '—', 'Shows or hides the bottom hands (⟐LogicalHand + ⟐CreativeHand). Pressed = both shown, half = one shown (click shows both). Hiding them never closes a pad.', () => ev('omni:hands-bottom-set', { visible: !HandBanner.isBottomVisible() }), { name: '⟐Hands (LH / RH)', pressed: (s) => s.bannerBottom, mixed: (s) => s.bannerBottomMixed }),
          handShow('lh', 'LH', '⟐LogicalHand', '⚉'), handShow('rh', 'RH', '⟐CreativeHand', '⚉'),
          handShow('omnihand', 'OH', '⟐OmniHand', '⚇'), handShow('conscious', 'CH', '⟐ConsciousHand', '⚇'),
        ] },
        { caption: 'Menus', btns: [
          b('menu-omnimenu', '☰', '⟐mniMenu', '1', "Opens the ⟐mniMenu drawer (the ⟐OmniHand's ☰). Works while the banner is hidden.", cell('.omni-hand--tl .hand-cell--hamburger', '⟐mniMenu'), { hand: 'oh' }),
          b('menu-navmenu', '☰', '⟐NavMenu', '2', "Opens the ⟐NavMenu drawer (the ⟐ConsciousHand's ☰). Works while the banner is hidden.", cell('.omni-hand--tr .hand-cell--hamburger', '⟐NavMenu'), { hand: 'ch' }),
        ] },
        { caption: 'Tools', btns: [
          b('tools-lh', '⬢', 'LH tools', 'Left Shift', "Opens the ⟐LogicalHand's radial tool menu.", cell('.omni-hand--bl .hand-cell--radial', 'LH tools'), { hand: 'lh' }),
          b('tools-rh', '⬢', 'RH tools', 'Right Shift', "Opens the ⟐CreativeHand's radial tool menu.", cell('.omni-hand--br .hand-cell--radial', 'RH tools'), { hand: 'rh' }),
          b('tools-omnihand', '⬢', 'OmniHand', '3', "Opens the ⟐OmniHand's radial tool menu.", cell('.omni-hand--tl .hand-cell--radial', 'OmniHand tools'), { name: 'OmniHand tools', hand: 'oh' }),
          b('tools-conscious', '⬢', 'Conscious', '4', "Opens the ⟐ConsciousHand's radial tool menu.", cell('.omni-hand--tr .hand-cell--radial', 'ConsciousHand tools'), { name: 'ConsciousHand tools', hand: 'ch' }),
        ] },
        { caption: 'Settings', btns: [
          handSettings('⟐LogicalHand', 'LH', 'lh', ', ammo, fire'),
          handSettings('⟐CreativeHand', 'RH', 'rh', ', ammo, fire'),
          handSettings('⟐OmniHand', 'OmniHand', 'omnihand', ', travel timing, marker'),
          handSettings('⟐ConsciousHand', 'Conscious', 'conscious', ', travel timing, marker'),
        ] },
        { caption: 'Fire & tunnels', btns: [
          b('fire-lh', '✦', 'LH fire', '—', "Opens ⟐OmniHands on the ⟐LogicalHand: element kind, chain, Fire distance, max alive for the pad's centre Fire button.", nav('⟐LogicalHand'), { name: 'LH Fire distance', hand: 'lh' }),
          b('fire-rh', '✦', 'RH fire', '—', "Opens ⟐OmniHands on the ⟐CreativeHand: payloads, Fire distance, max alive for the pad's centre Fire button.", nav('⟐CreativeHand'), { name: 'RH Fire distance', hand: 'rh' }),
          b('hand-tunnels', '◌', 'Tunnels', '—', 'Tunnels follow the pads (shared by all four hands).', (s) => ev('omni:dimension-axes-visible-set', { visible: !s.follow }), { name: 'Tunnels follow pads', pressed: (s) => s.follow }),
          b('hand-axinator', '⇋', 'Axinator', '—', 'Opens the OmniAxinator panel: pin tunnels, list their nodes.', nav('⟐OmniAxinator'), { name: 'OmniAxinator' }),
        ] },
      ],
    },
  ]

  function secBtn ({ id, label, glyph, desc }) {
    const where = id === 'location' ? ' (only for a location node — OmniPointing)' : ''
    return b(`sec-${id}`, glyph, label, '—',
      `${desc} Opens the Inspector if it is closed and toggles its ${label} section${where} (phones keep one section open at a time). Dim until a node is selected.`,
      (s) => {
        if (!s.inspector.loaded || (id === 'location' && !s.inspector.sections.includes('location'))) {
          note(`Inspector · ${label}`, id === 'location' && s.inspector.loaded ? 'The selected node is not a location node.' : 'Select a node first — the Inspector sections appear once a node is loaded.')
          if (!s.inspector.open) ev('omni:system-toggle', { system: 'omniinspector' })
          return
        }
        ev('omni:inspector-section-open', { section: id, toggle: true })   // same call the Inspector's own strip icons make
      },
      { name: `Inspector · ${label}`, pressed: (s) => !!s.inspector.openSections[id], dim: (s) => !s.inspector.loaded || (id === 'location' && !s.inspector.sections.includes('location')) })
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = /* css */`
#omni-ribbon {
  --orb-bg     : var(--omni-theme-bg, rgba(10, 10, 14, 0.80));
  --orb-border : var(--omni-theme-border, rgba(255, 255, 255, 0.10));
  --orb-text   : var(--omni-theme-text, rgba(255, 255, 255, 0.95));
  --orb-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.66));
  --orb-accent : var(--omni-theme-accent, rgba(255, 255, 255, 0.95));
  --orb-head   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.04));
  --orb-tabs-h : ${TABS_H_DESKTOP}px;
  --orb-body-h : ${BODY_H}px;
  --mono       : 'Courier New', Courier, monospace;

  position: fixed; top: var(--omni-bar-h, ${BAR_H}px); left: var(--omni-ribbon-left, 0px); right: 0;
  z-index: 49; box-sizing: border-box;
  background: var(--orb-bg);
  backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
  border-bottom: 1px solid var(--orb-border);
  font-family: var(--mono); color: var(--orb-text);
  pointer-events: auto; user-select: none; -webkit-font-smoothing: antialiased;
}
.orb-tabs { box-sizing: border-box; display: flex; align-items: stretch; height: var(--orb-tabs-h); background: var(--orb-head); border-bottom: 1px solid var(--orb-border); }
.orb-tab {
  display: flex; align-items: center; gap: 6px; padding: 0 14px; background: none; border: none;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  color: var(--orb-dim); font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em; cursor: pointer; white-space: nowrap;
}
.orb-tab:hover { color: var(--orb-text); background: rgba(255,255,255,0.05); }
.orb-tab.is-active { color: var(--orb-text); border-bottom-color: var(--orb-accent); background: rgba(255,255,255,0.06); }
.orb-tab-ico { font-size: 13px; line-height: 1; }
.orb-spacer { flex: 1; }
.orb-collapse {
  width: 30px; background: none; border: none; color: var(--orb-dim); cursor: pointer;
  font-family: var(--mono); font-size: 12px; transition: transform 0.15s ease;
}
.orb-collapse:hover { color: var(--orb-text); background: rgba(255,255,255,0.06); }
#omni-ribbon[data-collapsed="true"] .orb-collapse { transform: rotate(180deg); }

.orb-body { height: var(--orb-body-h); box-sizing: border-box; }
.orb-panel { display: none; height: 100%; }
.orb-panel.is-active { display: block; }
.orb-scroll { display: flex; align-items: stretch; height: 100%; padding: 0 6px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; }
.orb-group { display: flex; flex-direction: column; flex: 0 0 auto; padding: 3px 4px 2px; }
.orb-btns { display: flex; gap: 2px; flex: 1; min-height: 0; }
.orb-cap { text-align: center; font-size: 9px; color: var(--orb-dim); letter-spacing: 0.05em; white-space: nowrap; height: 13px; line-height: 13px; }
.orb-sep { flex: 0 0 1px; margin: 6px 3px; background: var(--orb-border); }
/* V190 Hands tab: a visible divider wherever two neighbouring buttons belong to different hands (LH | RH | OH | CH), plus a thin coloured cap per hand */
.orb-hsep { flex: 0 0 1px; align-self: stretch; margin: 2px 4px; background: rgba(255,255,255,0.34); border-radius: 1px; }
.orb-btn[data-hand] { box-shadow: inset 0 2px 0 var(--orb-hand, transparent); }
.orb-btn[data-hand="lh"] { --orb-hand: rgba(110,170,255,0.85); }
.orb-btn[data-hand="rh"] { --orb-hand: rgba(255,170,90,0.85); }
.orb-btn[data-hand="oh"] { --orb-hand: rgba(190,140,255,0.85); }
.orb-btn[data-hand="ch"] { --orb-hand: rgba(120,230,160,0.85); }

.orb-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  min-width: 52px; padding: 2px 5px; background: none; border: 1px solid transparent; border-radius: 5px;
  color: var(--orb-text); font-family: var(--mono); cursor: pointer;
  transition: background 0.1s ease, border-color 0.1s ease;
}
.orb-btn:hover { background: rgba(255,255,255,0.09); border-color: var(--orb-border); }
.orb-btn:active { background: rgba(255,255,255,0.16); }
.orb-btn:focus-visible { outline: 1px solid var(--orb-accent); outline-offset: 1px; }
.orb-btn.is-pressed { background: rgba(255,255,255,0.16); border-color: var(--orb-accent); }
.orb-btn.is-dim { opacity: 0.4; }
.orb-btn.is-mixed { background: linear-gradient(90deg, rgba(255,255,255,0.16) 50%, transparent 50%); border-color: var(--orb-accent); }   /* V187: one hand of a pair shown */
.orb-ico { font-size: 20px; line-height: 22px; height: 22px; pointer-events: none; }
.orb-lbl { font-size: 9.5px; line-height: 1.1; white-space: nowrap; pointer-events: none; }

/* collapsed (desktop) or phone: the body is an overlay under the tabs row */
#omni-ribbon[data-mode="overlay"] .orb-body {
  display: none; position: absolute; left: 0; right: 0; top: 100%;
  background: var(--orb-bg); border-bottom: 1px solid var(--orb-border);
  backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
  box-shadow: 0 10px 24px rgba(0,0,0,0.45);
}
#omni-ribbon[data-mode="overlay"].is-open .orb-body { display: block; }
#omni-ribbon[data-mode="overlay"].is-open { z-index: 52; }  /* the dropped body must sit above the notify box (z 51) on a phone */

@media (max-width: ${PHONE_MAX}px) {
  #omni-ribbon { --orb-tabs-h: ${TABS_H_PHONE}px; --orb-body-h: 76px; left: 0; }
  .orb-tab { flex: 1 1 0; min-width: 0; justify-content: center; gap: 3px; padding: 0 2px; font-size: 10.5px; letter-spacing: 0; }   /* V190: 5 tabs share 390px */
  .orb-collapse { display: none; }
  .orb-btn { min-width: 60px; min-height: 52px; }
  .orb-ico { font-size: 22px; }
  .orb-lbl { font-size: 10px; }
}
`

function injectStyles () {
  if (document.getElementById('omni-ribbon-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-ribbon-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ── The ribbon ────────────────────────────────────────────────────────────────

export default class OmniRibbon {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._tabs = buildTabs()
    this._btns = new Map()     // `${tab}/${id}` -> { def, el }
    this._s = { tab: 'home', collapsed: false }
    this._open = false         // overlay open (phone / collapsed)
    this.state = {
      minimap: false, tray: false, banner: HandBanner.isVisible(), bannerBottom: HandBanner.isBottomVisible(), bannerMixed: HandBanner.getPairState('top').mixed, bannerBottomMixed: HandBanner.getPairState('bottom').mixed, handShown: HandBanner.getHandStates(), follow: true,
      pads: { lh: false, rh: false, omnihand: false, conscious: false },
      terminal: TerminalShells.isOn(),
      timeline: { playing: PrimaryTime.isPlaying() },
      inspector: { open: false, loaded: false, sections: [], openSections: {} },
    }
    this._listeners = []
  }

  // ── Module contract ─────────────────────────────────────────────────────

  init () {
    initLayout()
    if (document.getElementById('omni-ribbon')) { this._dup = true; return }   // already mounted (defence only — UI.init now runs once, V170)
    injectStyles()
    this._load()
    this._build()
    this._bind()
    this._apply()
    ev('omni:inspector-state-request')
  }

  update () {}
  onResize () { if (!this._dup) this._apply() }

  destroy () {
    if (this._dup) return
    this._listeners.forEach(([t, n, f, o]) => t.removeEventListener(n, f, o))
    this._listeners = []
    setRibbonHeight(0)
    this._el?.remove()
    document.getElementById('omni-ribbon-styles')?.remove()
  }

  // ── Public ──────────────────────────────────────────────────────────────

  isPhone () { return (window.innerWidth || 1024) <= PHONE_MAX }
  getTab () { return this._s.tab }
  isCollapsed () { return this._s.collapsed }
  isOverlay () { return this.isPhone() || this._s.collapsed }
  getHeight () { return this._height() }

  setTab (id) {
    if (!this._tabs.some(t => t.id === id)) return
    this._s.tab = id
    this._save()
    this._apply()
  }

  setCollapsed (v) {
    this._s.collapsed = !!v
    this._open = false
    this._save()
    this._apply()
  }

  toggleCollapsed () { this.setCollapsed(!this._s.collapsed) }

  // ── Persistence ─────────────────────────────────────────────────────────

  _load () {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (raw && this._tabs.some(t => t.id === raw.tab)) this._s.tab = raw.tab
      if (raw && typeof raw.collapsed === 'boolean') this._s.collapsed = raw.collapsed
    } catch (_) {}
  }

  _save () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, tab: this._s.tab, collapsed: this._s.collapsed })) } catch (_) {}
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  _build () {
    const el = document.createElement('div')
    el.id = 'omni-ribbon'
    el.setAttribute('role', 'region')
    el.setAttribute('aria-label', 'Ribbon')

    const tabsHtml = this._tabs.map(t => `
      <button type="button" class="orb-tab" role="tab" data-tab="${t.id}" aria-selected="false"
              data-omni-tip="${esc(t.label)} tab" data-omni-tip-key="—" data-omni-tip-desc="${esc(t.tip)}. Click the active tab again (or the chevron) to collapse the ribbon.">
        <span class="orb-tab-ico" aria-hidden="true">${t.icon}</span><span class="orb-tab-lbl">${esc(t.label)}</span>
      </button>`).join('')

    const panelsHtml = this._tabs.map(t => `
      <div class="orb-panel" role="tabpanel" data-panel="${t.id}"><div class="orb-scroll">
        ${t.groups.map((g, gi) => `${gi ? '<span class="orb-sep" aria-hidden="true"></span>' : ''}
          <div class="orb-group" data-group="${esc(g.caption)}">
            <div class="orb-btns">${g.btns.map((btn, bi) => `${handDividerBetween(g.btns[bi - 1], btn) ? '<span class="orb-hsep" aria-hidden="true"></span>' : ''}
              <button type="button" class="orb-btn"${btn.hand ? ` data-hand="${btn.hand}"` : ''} data-tab="${t.id}" data-btn="${btn.id}"
                      data-omni-tip="${esc(btn.name)}" data-omni-tip-key="${esc(btn.key)}" data-omni-tip-desc="${esc(btn.desc)}"
                      data-omni-tip-source="Ribbon · ${esc(t.label)} · ${esc(g.caption)}">
                <span class="orb-ico" aria-hidden="true">${esc(btn.icon)}</span><span class="orb-lbl">${esc(btn.label)}</span>
              </button>`).join('')}
            </div>
            <div class="orb-cap">${esc(g.caption)}</div>
          </div>`).join('')}
      </div></div>`).join('')

    el.innerHTML = `
      <div class="orb-tabs" role="tablist">${tabsHtml}<span class="orb-spacer"></span>
        <button type="button" class="orb-collapse" aria-label="Collapse the ribbon"
                data-omni-tip="Collapse ribbon" data-omni-tip-key="—" data-omni-tip-desc="Folds the ribbon down to its tab row (the tab and fold state are remembered). Ctrl+F1 is not used: F1 already opens the terminal.">⌃</button>
      </div>
      <div class="orb-body">${panelsHtml}</div>`
    this._el = el
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(el)

    this._tabs.forEach(t => t.groups.forEach(g => g.btns.forEach(def => {
      this._btns.set(`${t.id}/${def.id}`, { def, el: el.querySelector(`.orb-btn[data-tab="${t.id}"][data-btn="${def.id}"]`) })
    })))
  }

  _on (target, name, fn, opts) {
    target.addEventListener(name, fn, opts)
    this._listeners.push([target, name, fn, opts])
  }

  _bind () {
    const el = this._el
    this._on(el, 'click', (e) => {
      const tab = e.target.closest('.orb-tab')
      if (tab) return this._onTabClick(tab.dataset.tab)
      if (e.target.closest('.orb-collapse')) return this.toggleCollapsed()
      const btn = e.target.closest('.orb-btn')
      if (btn) this._onButton(btn)
    })
    this._on(el, 'dblclick', (e) => { if (e.target.closest('.orb-tab') && !this.isPhone()) this.toggleCollapsed() })
    // Wheel scrolls the body sideways (Excel-style) when it overflows.
    this._on(el.querySelector('.orb-body'), 'wheel', (e) => {
      const sc = e.target.closest?.('.orb-scroll')
      if (!sc || Math.abs(e.deltaX) > Math.abs(e.deltaY) || sc.scrollWidth <= sc.clientWidth) return
      sc.scrollLeft += e.deltaY
      e.preventDefault()
    }, { passive: false })
    this._on(document, 'pointerdown', (e) => {
      if (this._open && !el.contains(e.target)) this._closeOverlay()
    }, true)
    this._on(window, 'keydown', (e) => { if (e.key === 'Escape' && this._open) this._closeOverlay() })

    const st = this.state
    const on = (name, fn) => this._on(window, name, (e) => { fn(e.detail ?? {}); this._refresh() })
    on('omni:minimap-toggle', d => { st.minimap = !!d.visible })
    on('omni:paneltray-state', d => { st.tray = !!d.open })
    on('omni:hands-banner-state', d => { st.banner = !!d.visible; st.bannerMixed = !!d.mixed })
    on('omni:hands-bottom-state', d => { st.bannerBottom = !!d.visible; st.bannerBottomMixed = !!d.mixed })
    on('omni:hand-visible-state', d => { if (d.hand) st.handShown = { ...st.handShown, [d.hand]: !!d.visible } })
    on('omni:dimension-axes-visible', d => { st.follow = !!d.visible })
    on('omni:pad-state', d => { if (d.hand in st.pads) st.pads[d.hand] = !!d.visible })
    on(TerminalShells.STATE_EVENT, d => { st.terminal = !!d.on })   // V192
    on('omni:primarytime-state', d => { st.timeline = { playing: !!d.playing } })
    on('omni:inspector-state', d => {
      st.inspector = { open: !!d.open, loaded: !!d.loaded, sections: Array.isArray(d.sections) ? d.sections : [], openSections: d.openSections ?? {} }
    })
    this._on(window, 'omni:layout-changed', () => {})   // consumers read the CSS vars; nothing to do here
  }

  // ── Behaviour ───────────────────────────────────────────────────────────

  _onTabClick (id) {
    if (this.isOverlay()) {
      if (this._s.tab === id && this._open) { this._closeOverlay(); return }
      this._s.tab = id
      this._open = true
      this._save()
      this._apply()
      return
    }
    if (this._s.tab === id) { this.toggleCollapsed(); return }   // click the active tab again: fold (also double-click)
    this.setTab(id)
  }

  _closeOverlay () {
    this._open = false
    this._apply()
  }

  _onButton (btnEl) {
    const entry = this._btns.get(`${btnEl.dataset.tab}/${btnEl.dataset.btn}`)
    if (!entry) return
    try { entry.def.run(this.state) } catch (err) { console.warn('⟐Ribbon — action failed:', entry.def.id, err) }
    if (this.isOverlay() && this._open) this._closeOverlay()
  }

  /** Click a ribbon button by tab + id (tests / tooling). */
  press (tab, id) { this._btns.get(`${tab}/${id}`)?.el.click() }

  _height () {
    return computeRibbonHeight({ phone: this.isPhone(), collapsed: this._s.collapsed })   // tabs (+ body) + the 1px border
  }

  _apply () {
    if (!this._el) return
    const overlay = this.isOverlay()
    this._el.dataset.mode = overlay ? 'overlay' : 'docked'
    this._el.dataset.collapsed = String(this._s.collapsed)
    this._el.dataset.tab = this._s.tab
    this._el.classList.toggle('is-open', overlay && this._open)
    this._el.querySelectorAll('.orb-tab').forEach(t => {
      const on = t.dataset.tab === this._s.tab
      t.classList.toggle('is-active', on)
      t.setAttribute('aria-selected', String(on))
    })
    this._el.querySelectorAll('.orb-panel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === this._s.tab))
    const c = this._el.querySelector('.orb-collapse')
    if (c) {
      c.dataset.omniTip = this._s.collapsed ? 'Expand ribbon' : 'Collapse ribbon'
      c.setAttribute('aria-label', c.dataset.omniTip)
    }
    this._refresh()
    setRibbonHeight(this._height())
  }

  /** Pressed / dim states from the tracked app state. Cheap: ~55 buttons, runs on events only. */
  _refresh () {
    this._btns.forEach(({ def, el }) => {
      if (!el) return
      const pressed = def.pressed ? !!def.pressed(this.state) : false
      const dim = def.dim ? !!def.dim(this.state) : false
      const mixed = def.mixed ? !!def.mixed(this.state) && !pressed : false
      el.classList.toggle('is-pressed', pressed)
      el.classList.toggle('is-mixed', mixed)
      el.classList.toggle('is-dim', dim)
      if (def.pressed) el.setAttribute('aria-pressed', mixed ? 'mixed' : String(pressed))
      if (def.dim) el.setAttribute('aria-disabled', String(dim))
    })
  }
}
