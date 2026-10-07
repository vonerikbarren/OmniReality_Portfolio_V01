/**
 * ui/OmniRibbon.js — ⟐OmniRibbon (V169): an Excel-"Home"-style toolbar right under the GlobalBar.
 *
 * The GlobalBar's top-level menu categories are the "File" of the Realities world: they cascade
 * DOWN into one item at a time. The ribbon takes the same idea one level up: the tools you reach for
 * most, laid out flat as large icon + label buttons in captioned groups, in tabs so more can be
 * added later.
 *
 *   Tabs        Home (▦ dashboard) · Inspector · Realities · Hands      (data table TABS below)
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
import * as TL from '../utils/OmniTimeline.js'

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
const fakeKey = (key, code) => () => window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }))

// ── The tab table ─────────────────────────────────────────────────────────────
// b(id, icon, label, key, desc, run, extras)  extras: { pressed(s), dim(s), name }

const b = (id, icon, label, key, desc, run, extra = {}) => ({ id, icon, label, key, desc, run, name: label, ...extra })

function buildTabs () {
  const padBtn = (hand, label, name) => b(`pad-${hand}`, '⚇', label, '—',
    `Show or hide ${name}'s movement pad (the same as its ⚇ cell). Pad on/off is reported back by the pad itself.`,
    (s) => ev('omni:pad-toggle', { hand, visible: !s.pads[hand] }), { name: `${name} pad`, pressed: (s) => !!s.pads[hand] })
  const handSettings = (item, label, hand, extraDesc) => b(`set-${hand}`, '⚙', label, '—',
    `Opens ⟐OmniHands on the ${label} view: speed, pad-on-start, pad dock${extraDesc}.`, nav(item), { name: `${label} settings` })

  return [
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
        ] },
        { caption: 'Tools', btns: [
          b('mixer', '♫', 'Mixer', 'k', 'Toggles OmniMixer.', nav('⟐OmniMixer')),
          b('translator', '⇄', 'Translator', 't', 'Toggles OmniTranslator.', () => ev('omni:translator-toggle')),
          b('presenter', '▤', 'Presenter', 'p', 'Toggles the ⟐p OmniPresenter.', sys('omnipresenter')),
          b('gallery', '▥', 'Gallery', 'g', 'Toggles the ⟐g OmniGallery.', sys('omnigallery')),
          b('browser', '◫', 'Browser', 'b', 'Opens the OmniBrowser (window 1). The b key toggles it; this button only opens it.', nav('⟐OmniBrowserWindow')),
        ] },
        { caption: 'Windows', btns: [
          b('panelcontrol', '❐', 'PanelControl', '—', 'Opens ⟐PanelControl: the list of panels and their state.', nav('⟐PanelControl')),
          b('tray', '▲', 'Panel Tray', '—', 'Opens or closes the OmniPanelTray, where minimized panels wait.', () => ev('omni:paneltray-toggle', {}), { pressed: (s) => s.tray }),
        ] },
        { caption: 'Assistance', btns: [
          b('shortcuts', '⌨', 'Shortcuts', '—', 'Opens the list of every real keyboard shortcut.', () => {
            const item = (WindowManager.getContextMenu(null).Assistance ?? []).find(i => /shortcut/i.test(i.label))
            if (item) item.action(); else note('Shortcuts', 'The keyboard shortcuts panel is not registered yet.')
          }, { name: 'Keyboard shortcuts' }),
          b('terminal', '›_', 'Terminal', '` / F1', 'Invokes the terminal tunnel (Escape dismisses it).', () => ev('omni:terminal-invoke')),
          b('fullscreen', '⛶', 'Fullscreen', 'F4', 'Toggles fullscreen (same handler as F4).', fakeKey('F4', 'F4')),
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
          b('spaces', '▫', 'Spaces', '—', 'Opens ⟐Spaces: click an empty slot to save the camera position, a saved slot (📍) to fly back to it.', nav('⟐Spaces')),
          b('times', '◷', 'Times', '—', 'Opens the ⟐Times indexed panel.', nav('⟐Times')),
          b('products', '▣', 'Products', '—', 'Opens the ⟐Products indexed panel.', nav('⟐Products')),
        ] },
        { caption: 'Axes', btns: [
          b('axes', 'Δ', 'Dim. Axes', '—', 'Opens the Dimensional Axes settings.', nav('⟐DimensionalAxesSettings'), { name: 'Dimensional Axes' }),
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
        { caption: 'Banner', btns: [
          b('banner', '⚇', '⟐Hands', '—', 'Shows or hides the top hands banner (⟐OmniHand + ⟐ConsciousHand). Hiding it never closes a pad or tunnel.', () => ev('omni:hands-banner-set', { visible: !HandBanner.isVisible() }), { name: '⟐Hands banner', pressed: (s) => s.banner }),
        ] },
        { caption: 'Menus', btns: [
          b('menu-omnimenu', '☰', '⟐mniMenu', '1', "Opens the ⟐mniMenu drawer (the ⟐OmniHand's ☰). Works while the banner is hidden.", cell('.omni-hand--tl .hand-cell--hamburger', '⟐mniMenu')),
          b('menu-navmenu', '☰', '⟐NavMenu', '2', "Opens the ⟐NavMenu drawer (the ⟐ConsciousHand's ☰). Works while the banner is hidden.", cell('.omni-hand--tr .hand-cell--hamburger', '⟐NavMenu')),
        ] },
        { caption: 'Tools', btns: [
          b('tools-lh', '⬢', 'LH tools', 'Left Shift', "Opens the ⟐LogicalHand's radial tool menu.", cell('.omni-hand--bl .hand-cell--radial', 'LH tools')),
          b('tools-rh', '⬢', 'RH tools', 'Right Shift', "Opens the ⟐CreativeHand's radial tool menu.", cell('.omni-hand--br .hand-cell--radial', 'RH tools')),
          b('tools-omnihand', '⬢', 'OmniHand', '3', "Opens the ⟐OmniHand's radial tool menu.", cell('.omni-hand--tl .hand-cell--radial', 'OmniHand tools'), { name: 'OmniHand tools' }),
          b('tools-conscious', '⬢', 'Conscious', '4', "Opens the ⟐ConsciousHand's radial tool menu.", cell('.omni-hand--tr .hand-cell--radial', 'ConsciousHand tools'), { name: 'ConsciousHand tools' }),
        ] },
        { caption: 'Settings', btns: [
          handSettings('⟐LogicalHand', 'LH', 'lh', ', ammo, fire'),
          handSettings('⟐CreativeHand', 'RH', 'rh', ', ammo, fire'),
          handSettings('⟐OmniHand', 'OmniHand', 'omnihand', ', travel timing, marker'),
          handSettings('⟐ConsciousHand', 'Conscious', 'conscious', ', travel timing, marker'),
        ] },
        { caption: 'Fire & tunnels', btns: [
          b('fire-lh', '✦', 'LH fire', '—', "Opens ⟐OmniHands on the ⟐LogicalHand: element kind, chain, Fire distance, max alive for the pad's centre Fire button.", nav('⟐LogicalHand'), { name: 'LH Fire distance' }),
          b('fire-rh', '✦', 'RH fire', '—', "Opens ⟐OmniHands on the ⟐CreativeHand: payloads, Fire distance, max alive for the pad's centre Fire button.", nav('⟐CreativeHand'), { name: 'RH Fire distance' }),
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
  .orb-tab { flex: 1; justify-content: center; padding: 0 4px; font-size: 11px; }
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
      minimap: false, tray: false, banner: HandBanner.isVisible(), follow: true,
      pads: { lh: false, rh: false, omnihand: false, conscious: false },
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
            <div class="orb-btns">${g.btns.map(btn => `
              <button type="button" class="orb-btn" data-tab="${t.id}" data-btn="${btn.id}"
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
    on('omni:hands-banner-state', d => { st.banner = !!d.visible })
    on('omni:dimension-axes-visible', d => { st.follow = !!d.visible })
    on('omni:pad-state', d => { if (d.hand in st.pads) st.pads[d.hand] = !!d.visible })
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
      el.classList.toggle('is-pressed', pressed)
      el.classList.toggle('is-dim', dim)
      if (def.pressed) el.setAttribute('aria-pressed', String(pressed))
      if (def.dim) el.setAttribute('aria-disabled', String(dim))
    })
  }
}
