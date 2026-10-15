/**
 * utils/OmniStarLightSites.js — the registry of "main sites" OmniStarLight lists (V190). Pure data + pure rules, no DOM.
 *
 * A SITE is a main OmniProduct / area of the app. Each one was taken from something that really exists today: a ribbon button, a
 * Dock / drawer item (ui/Drawer.js LEFT_ITEMS / RIGHT_ITEMS, main.js indexedPanelConfigs + the Developer / Admin slots) or a panel.
 * `open` is the SAME action the ribbon / drawer uses for it:
 *     { type: 'nav',   item, parent? }   -> window event omni:nav-select { drawer:'starlight', item, parent, path }   (what the drawers and the ribbon dispatch)
 *     { type: 'sys',   system }          -> omni:system-toggle { system }                                           (Inspector, Presenter, Gallery)
 *     { type: 'event', name, detail? }   -> that window event as is (translator toggle, terminal invoke ...)
 *     { type: 'shortcuts' }              -> the Assistance > Keyboard Shortcuts menu action (ui/WindowManager.js)
 *
 * AVAILABILITY RULE (the one rule, applied by resolveSites):
 *   Available   = status 'built' (something real opens: a working panel / system, found by a handler in the code)
 *                 AND (not a developer tool OR developer mode is on).
 *   Unavailable = status 'planned'  -> reason = the entry's note (what it is today: a placeholder, designed-not-built, ...), or
 *                 'Not built yet.'
 *               | developer tool while developer mode is off -> reason 'Developer tool: add ?dev=1 to the address (or set
 *                 localStorage omni:dev-mode to 1) to use it.'
 *   "Hidden for this role": there is NO role / access system in the app (ui/Drawer.js, main.js: every Developer slot is open to
 *   anyone), so no site is hidden for a role. Developer mode is the only gate, and it only applies to OmniStarLight's listing:
 *   it does not lock the drawers (the Developer drawer still opens its panels).
 *   Developer mode (isDevMode): the address has ?dev=1 (or ?dev), or localStorage omni:dev-mode is '1', or the page runs from
 *   localhost / 127.0.0.1 / ::1 / a file:// page (a developer's own machine).
 *   Status is honest, checked by a test against the source: every 'built' nav site has a handler for its item string.
 *
 * User-facing module: names Developer panels only by their nav strings; it never imports a Dev* module.
 */

export const DEV_MODE_KEY = 'omni:dev-mode'
export const DEV_REASON = 'Developer tool: add ?dev=1 to the address (or set localStorage omni:dev-mode to 1) to use it.'
export const PLANNED_REASON = 'Not built yet.'

const nav = (item, parent) => ({ type: 'nav', item, ...(parent ? { parent } : {}) })
const S = (id, name, group, desc, open, kw = [], extra = {}) => ({ id, name, group, desc, open, keywords: kw, status: 'built', dev: false, note: '', ...extra })
const P = (id, name, group, desc, note, kw = []) => ({ id, name, group, desc, open: null, keywords: kw, status: 'planned', dev: false, note })
const D = (id, name, desc, open, kw = [], extra = {}) => S(id, name, 'Developer', desc, open, kw, { dev: true, ...extra })

/** The raw registry (data). Use resolveSites() for the listing with available / reason filled in. */
export const SITES = [
  // ── Value (SANDBOX: every value is fake) ────────────────────────────────────────────────────────────────────────────────
  S('omnistore', 'OmniStore', 'Value', 'SANDBOX. The ⟐OmniStore shelf in the scene (fruit and veg test store): sections, media lenses, click a product for its exchange.', nav('⟐OmniStore'), ['shop', 'store', 'sandbox', 'products']),
  S('omnivalue', 'OmniValue', 'Value', 'SANDBOX. The wallet: balances per value type, the stated remainder ledger, transactions, grant / reset sandbox value.', nav('⟐OmniValue'), ['wallet', 'balance', 'money', 'sandbox']),
  S('omniexchange', 'OmniExchange', 'Value', 'SANDBOX. The radial exchange panel: the product in the middle, every accepted exchange form around it; buy, sell, wish list, cart.', nav('⟐OmniExchange'), ['buy', 'sell', 'trade', 'sandbox']),
  S('omnitalent', 'OmniTalent', 'Value', 'SANDBOX. Your value across value types and tiers as a sunburst, treemap or sankey, with the rate-loop check.', nav('⟐OmniTalent'), ['chart', 'sunburst', 'sankey', 'treemap', 'sandbox']),
  S('storesettings', 'Store Settings', 'Value', "Your store's colours, backdrop, presets and name (Admin). Changes show live in the open store.", nav('⟐OmniStoreSettings'), ['look', 'theme', 'admin']),
  // ── Time and player ─────────────────────────────────────────────────────────────────────────────────────────────────────
  S('omnichronos', 'OmniChronos', 'Time', 'The Program Monitor (player) and the Premiere-style timeline. Primary Time is the playhead.', nav('⟐OmniChronos'), ['timeline', 'player', 'clock', 'clips', 'keyframes']),
  S('omniplayer', 'OmniPlayer', 'Time', 'The OmniPlayer dashboard: Status and Visors are live; Boundaries and Languages are placeholders.', nav('⟐OmniPlayer'), ['dashboard', 'status', 'visors', 'profile']),
  // ── Hands ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  S('omnihands', 'OmniHands', 'Hands', 'The four hands (LH, RH, OH, CH): speed, pad on start, pad dock, ammo, fire. Opens on the ⟐LogicalHand view.', nav('⟐LogicalHand'), ['hands', 'pads', 'fire', 'ammo', 'logicalhand', 'creativehand']),
  // ── Scene and nodes ─────────────────────────────────────────────────────────────────────────────────────────────────────
  S('inspector', 'Inspector', 'Scene', 'Opens or closes the OmniInspector: thirteen sections for the selected node. It also opens by itself when you select a node.', { type: 'sys', system: 'omniinspector' }, ['node', 'properties', 'edit']),
  S('omnidraw', 'OmniDraw', 'Scene', 'The OmniDraw mode picker: Static, Dynamic, Behavior, Cell, Chat, Log. Make a node.', nav('⟐OmniDraw'), ['create', 'node', 'make', 'new']),
  S('navmap', 'NavMap', 'Scene', 'The ⟐NavMap panel: pick a portal and travel there.', nav('⟐NavMap'), ['map', 'portal', 'travel']),
  S('omnivisor', 'OmniVisor', 'Scene', 'Inspect what you are looking at.', nav('⟐OmniVisor'), ['inspect', 'look']),
  S('omniselect', 'OmniSelect', 'Scene', 'Multi-select nodes.', nav('⟐OmniSelect'), ['selection', 'multi']),
  S('floormanager', 'Floor Manager', 'Scene', 'The Floor manager: the floors of the reality.', nav('⟐FloorManager'), ['floor', 'floors']),
  S('omniaxinator', 'OmniAxinator', 'Scene', 'The tunnels and their nodes: pin tunnels, list their nodes.', nav('⟐OmniAxinator'), ['tunnel', 'tunnels', 'axes']),
  S('dimaxes', 'Dimensional Axes', 'Scene', 'The Dimensional Axes settings.', nav('⟐DimensionalAxesSettings'), ['axes', 'dimensions']),
  S('spaces', 'Spaces', 'Scene', 'Click an empty slot to save the camera position, a saved slot to fly back to it.', nav('⟐Spaces'), ['bookmark', 'camera', 'save']),
  // ── Tools ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  S('soundnode', 'Sound node', 'Tools', 'Creates a SoundNode in front of the camera: a speaker you can place, with notes, dynamics, loops, presets, spatial sound and particles.', { type: 'event', name: 'omni:sound-node-create', detail: { select: true } }, ['sound', 'audio', 'speaker', 'note', 'music', 'create']),
  S('soundsettings', 'Sound settings', 'Tools', 'The ⟐SoundNodeSettings panel: every setting of the selected node\'s sound and particles, presets, Play / Stop / Audition.', nav('⟐SoundNodeSettings'), ['sound', 'audio', 'note', 'dynamics', 'preset', 'volume']),
  S('omnimixer', 'OmniMusicPlayer', 'Tools', 'The OmniMusicPlayer (it was called OmniMixer before V195): two audio channels, video slots and the audio library.', nav('⟐OmniMusicPlayer'), ['sound', 'audio', 'volume', 'mixer', 'omnimixer', 'music', 'player']),
  S('musicnode', 'Music node', 'Tools', 'Creates a MusicNode in front of the camera: a step sequencer you can place, with tracks, instruments, recording and pattern presets.', { type: 'event', name: 'omni:music-node-create', detail: { select: true } }, ['music', 'sequencer', 'steps', 'beat', 'drum', 'create']),
  S('omnisequencer', 'OmniSequencer', 'Tools', 'The step sequencer window of the selected music node: step grid, piano roll, transport, record with count-in, tracks and instruments.', nav('⟐OmniSequencer'), ['music', 'sequencer', 'steps', 'beat', 'record', 'piano roll', 'metronome']),
  S('songnode', 'Song node', 'Tools', 'Creates a SongNode in front of the camera: a timeline of lanes with pattern and audio clips, a mixer, sections, tempo changes and automation.', { type: 'event', name: 'omni:song-node-create', detail: { select: true } }, ['song', 'arrange', 'arrangement', 'timeline', 'mix', 'track', 'music', 'create']),
  S('omnisong', 'Song editor', 'Tools', 'The song timeline window of the selected song node: lanes as a mixer, clips, sections, tempo track, automation, clip library and master strip.', nav('⟐OmniSong'), ['song', 'arrange', 'arrangement', 'timeline', 'mixer', 'lanes', 'clips', 'automation', 'sections', 'music']),
  S('mixnode', 'Mix node', 'Tools', 'Creates an OmniMusicMixNode in front of the camera: a mixing desk with DJ behaviour for songs, sounds and audio clips, with a crossfader, EQ, filter, sends and recordable moves.', { type: 'event', name: 'omni:mix-node-create', detail: { select: true } }, ['mix', 'mixer', 'dj', 'crossfade', 'crossfader', 'music', 'set', 'create']),
  S('docnode', 'Doc node', 'Tools', 'Creates a DocNode in front of the camera: a flat sheet that shows a PDF, markdown, text file, image or guide page inside the space, drawn only as sharp as its distance needs.', { type: 'event', name: 'omni:doc-node-create', detail: { select: true } }, ['doc', 'document', 'pdf', 'page', 'sheet', 'read', 'markdown', 'file', 'create']),
  S('polynode', 'Poly node', 'Tools', 'Creates a PolyNode in front of the camera: a solid, plane, strip or ring whose every face holds its own colour, picture, text, document or sound. Tap a face for its menu.', { type: 'event', name: 'omni:poly-node-create', detail: { select: true } }, ['poly', 'polyhedron', 'cube', 'face', 'faces', 'dodecahedron', 'icosahedron', 'solid', 'shape', 'create']),
  S('omnimix', 'Mixer (OmniMix)', 'Tools', 'The mixing desk window of the selected mix node: channel strips, crossfader, DJ moves, automation lanes and a record button for fader moves.', nav('⟐OmniMix'), ['mix', 'mixer', 'dj', 'crossfader', 'strips', 'automation', 'set', 'music']),
  S('omnidoc', 'Documents (OmniDoc)', 'Tools', 'The document window of the selected doc node: choose a guide page or import a PDF, markdown, text or image, turn pages, size the sheet, copy its text.', nav('⟐OmniDoc'), ['doc', 'document', 'pdf', 'page', 'import', 'read']),
  S('omnipoly', 'Poly faces (OmniPoly)', 'Tools', 'The window of the selected poly node: shape, and face by face colour, tags, event and content.', nav('⟐OmniPoly'), ['poly', 'face', 'faces', 'shape', 'tag', 'tooltip']),
  S('soundmixer', 'OmniMixer', 'Tools', 'The sound mixer.', nav('⟐OmniMixer'), ['sound', 'audio', 'volume']),
  S('soundviewer', 'Sound viewer', 'Tools', 'The frequency viewer of a sound node or the whole mix: spectrum bars and line, scope, spectrogram, 7 band meters, peak note, envelope phase.', nav('⟐SoundViewer'), ['sound', 'audio', 'spectrum', 'frequency', 'fft', 'spectrogram', 'scope', 'waveform', 'meters']),
  S('soundparticleviewer', 'Particle viewer', 'Tools', 'The particle formation of a sound node (top, front, side, orbit) with its live count; pick the formation, count and size.', nav('⟐SoundParticleViewer'), ['sound', 'particles', 'formation', 'count', 'cloud', 'sphere', 'galaxy']),
  S('omniexpressionpanel', 'OmniExpression keyboard', 'Tools', 'The OmniExpression panel: an on-screen keyboard for both hands (touch or mouse); maximize it for four quadrants (keyboards, BeatPad, mixer, more); Split gives each hand its own window.', { type: 'event', name: 'omni:expression-open' }, ['keyboard', 'piano', 'keys', 'music', 'play', 'touch', 'expression', 'midi', 'quadrant']),
  S('omnibeatpad', 'OmniBeatPad', 'Tools', 'Sixteen pads in a 4x4 grid: tap to play a sound node or a note, edit each pad, kits, choke groups.', nav('OmniBeatPad'), ['pads', 'drum', 'drums', 'beat', 'sampler', 'music', 'mpc']),
  S('omnidj', 'OmniDJ', 'Tools', 'Six jog-wheel circles and six decks: volume, 3-band EQ, cue, mute, loop, pitch, crossfader and master on a grid you can rearrange. Tracks come from the OmniMusicPlayer library.', nav('⟐OmniDJ'), ['dj', 'deck', 'turntable', 'crossfader', 'eq', 'jog', 'music', 'audio']),
  S('audiolibrary', 'Audio library', 'Tools', 'Import sound files (WAV, MP3, OGG, M4A ... whatever your browser can play) by button or drag and drop, see the waveform, preview, rename and delete. Songs use these files as audio clips.', nav('⟐OmniAudioLibrary'), ['audio', 'sound', 'sample', 'samples', 'import', 'wav', 'mp3', 'ogg', 'file', 'clip', 'library']),
  S('omnitranslator', 'OmniTranslator', 'Tools', 'Toggles the OmniTranslator.', { type: 'event', name: 'omni:translator-toggle' }, ['translate', 'language']),
  S('omnipresenter', 'OmniPresenter', 'Tools', 'Toggles the ⟐p OmniPresenter (slides / media).', { type: 'sys', system: 'omnipresenter' }, ['slides', 'present']),
  S('omnigallery', 'OmniGallery', 'Tools', 'Toggles the ⟐g OmniGallery.', { type: 'sys', system: 'omnigallery' }, ['images', 'pictures']),
  S('omnibrowser', 'OmniBrowser', 'Tools', 'Opens the OmniBrowser (window 1).', nav('⟐OmniBrowserWindow'), ['web', 'browse']),
  S('omnipocket', 'OmniPocket', 'Tools', 'The pocket: inventory.', nav('⟐OmniPocket'), ['inventory', 'items']),
  S('omnikeys', 'OmniKeys', 'Tools', 'The OmniKeys panel.', nav('⟐OmniKeys'), ['keys', 'keyboard']),
  S('omninavi', 'OmniNavi', 'Tools', 'The OmniProgram / OmniNavi panel (the bot program).', nav('⟐OmniNavi'), ['program', 'bot']),
  S('omnitargeting', 'OmniTargeting', 'Tools', 'The OmniTargeting settings.', nav('⟐OmniTargetingSettings'), ['target', 'aim']),
  S('omniexpressionator', 'OmniExpressionator', 'Tools', 'The OmniExpressionator panel.', nav('⟐OmniExpressionator'), ['expression', 'emotion']),
  S('omnisystemcreator', 'OmniSystemCreator', 'Tools', 'The OmniSystemCreator panel.', nav('⟐OmniSystemCreator'), ['system', 'create']),
  // ── App ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  S('docs', 'Docs', 'App', 'The user guide inside the app: table of contents, page text, search with highlights. PageUp / PageDown turn pages.', nav('⟐OmniDocs'), ['help', 'guide', 'manual', 'user guide', 'documentation']),
  S('admin', 'Admin', 'App', 'The Admin settings: theme, wallpaper, floor, UI settings, data management.', nav('⟐mniAdminSettings'), ['settings', 'options', 'preferences', 'theme']),
  S('panelcontrol', 'PanelControl', 'App', 'The list of panels and their state.', nav('⟐PanelControl'), ['windows', 'panels']),
  S('shortcuts', 'Keyboard Shortcuts', 'App', 'The list of keyboard shortcuts.', { type: 'shortcuts' }, ['keys', 'hotkeys', 'keyboard']),
  S('terminal', 'Terminal', 'App', 'Switches all the terminal tunnels on or off together (Escape switches them off).', { type: 'event', name: 'omni:terminal-invoke', detail: { toggle: true } }, ['console', 'command']),
  S('account', 'Account', 'App', 'Your account profile.', nav('Profile', '⟐Account'), ['profile', 'login', 'user']),
  S('aboutme', 'About Me', 'App', 'The About-Me section carousel.', nav('About-Me', '⟐About'), ['about', 'bio']),
  // ── Not built yet ──────────────────────────────────────────────────────────────────────────────────────────────────────
  P('omnivision', 'OmniVision', 'Planned', 'A left-drawer entry for the vision system.', 'A drawer entry only; no panel behind it yet.', ['vision', 'sight']),
  P('omnisense', 'OmniSense', 'Planned', 'The voxel / Excel-scale authoring tool.', 'Designed separately; today only a category panel with a zoom-out slot.', ['voxel', 'sense']),
  P('omnirealities', 'OmniRealities', 'Planned', 'A left-drawer entry for the realities system.', 'A drawer entry only; no panel behind it yet.', ['realities']),
  P('omnisystemanimator', 'OmniSystem Animator', 'Planned', 'Whole-system animation.', 'Designed, not built yet (a "coming soon" panel).', ['animate', 'animation']),
  P('omnisystemdimensionalizer', 'OmniSystem Dimensionalizer', 'Planned', 'Dimensionalize a system.', 'A "coming soon" panel, not built yet.', ['dimensionalizer']),
  P('omnisystemsettings', 'OmniSystem Settings', 'Planned', 'Settings for OmniSystem.', 'A "coming soon" panel, not built yet.', []),
  P('experiences', 'Experiences', 'Planned', 'The Experiences index.', 'An index panel with empty slots; nothing to open yet.', ['experience']),
  P('perspectives', 'Perspectives', 'Planned', 'The perspectives (dimensions) of the product the OmniHand selects, listed on the ConsciousHand.', 'Planned: the ribbon button only shows a notice; the ConsciousHand list is not built yet.', ['perspective', 'eye', 'dimensions', 'visualstates']),
  P('realities', 'Realities', 'Planned', 'The Realities index.', 'An index panel with empty slots; nothing to open yet.', ['reality']),
  P('times', 'Times', 'Planned', 'The Times index.', 'An index panel with empty slots; nothing to open yet.', ['time']),
  P('governance', 'Governance', 'Planned', 'The Governance index.', 'An index panel with empty slots; nothing to open yet.', []),
  P('intelligence', 'Intelligence', 'Planned', 'The Intelligence index.', 'An index panel with empty slots; nothing to open yet.', ['ai']),
  P('infrastructures', 'Infrastructures', 'Planned', 'The Infrastructures index.', 'An index panel with empty slots; nothing to open yet.', []),
  P('objects', 'Objects', 'Planned', 'The Objects index.', 'An index panel with empty slots; nothing to open yet.', []),
  P('navhome', 'Home', 'Planned', 'The NavMenu Home page.', 'A placeholder panel (empty slots); the page is not built yet.', ['navmenu']),
  P('navwork', 'Work', 'Planned', 'The NavMenu Work page.', 'A placeholder panel (empty slots); the page is not built yet.', ['navmenu', 'portfolio']),
  P('navservices', 'Services', 'Planned', 'The NavMenu Services page.', 'A placeholder panel (empty slots); the page is not built yet.', ['navmenu']),
  P('navresources', 'Resources', 'Planned', 'The NavMenu Resources page.', 'A placeholder panel (empty slots); the page is not built yet.', ['navmenu']),
  P('navcontact', 'Contact', 'Planned', 'The NavMenu Contact page.', 'A placeholder panel (empty slots); the page is not built yet.', ['navmenu']),
  // ── Developer tools (available only in developer mode) ──────────────────────────────────────────────────────────────────
  D('claudecheck', 'Claude Check', 'DEV ONLY. What Claude wants checked in this version, a message box and a copyable report.', nav('⟐DevClaudeCheck'), ['checklist', 'report', 'testing', 'dev']),
  D('devstore', 'Dev Store', 'DEV ONLY. Store type records, catalog JSON import / export, items per page, test data, notes for Claude, dump state.', nav('⟐DevOmniStoreSettings'), ['store', 'catalog', 'dev']),
  D('inputmonitor', 'Input Monitor', 'DEV ONLY. Watches the raw input events.', nav('⟐OmniInputMonitor'), ['input', 'events', 'dev']),
  D('callstack', 'Test Call Stack', 'DEV ONLY. The test call stack list.', nav('⟐TestCallStack'), ['test', 'dev']),
  D('commandterminal', 'Command Terminal', 'DEV ONLY. The OmniCommandTerminal command language panel.', nav('⟐OmniCommandTerminal'), ['commands', 'dev']),
  D('programpanel', 'OmniProgram', 'DEV ONLY. The OmniProgram panel.', nav('⟐OmniProgram'), ['program', 'dev']),
]

/** Developer mode: ?dev in the address, localStorage omni:dev-mode === '1', or a developer's own machine. Never throws. */
export function isDevMode (win = (typeof window !== 'undefined' ? window : null)) {
  try {
    const loc = win?.location
    if (!loc) return false
    if (/^file:$/.test(loc.protocol) || /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(loc.hostname || '')) return true
    const sp = new URLSearchParams(loc.search || '')
    if (sp.has('dev') && !['0', 'false', 'off'].includes(String(sp.get('dev')).toLowerCase())) return true
    return win.localStorage?.getItem(DEV_MODE_KEY) === '1'
  } catch (_) { return false }
}

/** Raw entry + developer mode -> { available, reason }. The single availability rule (see the header). */
export function siteStatus (site, devMode = false) {
  if (!site || site.status !== 'built' || !site.open) return { available: false, reason: String(site?.note || PLANNED_REASON) }
  if (site.dev && !devMode) return { available: false, reason: DEV_REASON }
  return { available: true, reason: '' }
}

/** The listing OmniStarLight shows: every raw entry with `available` and `reason` filled in (a new array of new objects). */
export function resolveSites (devMode = isDevMode(), raw = SITES) {
  return raw.map(s => ({ ...s, ...siteStatus(s, devMode) }))
}
