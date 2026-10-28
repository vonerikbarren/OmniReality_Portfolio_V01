/**
 * ui/OmniIDEPanel.js — ⟐OmniIDE (V222): a small place to work with code inside the space. No dependencies, works offline.
 *
 *   file tree     the OmniTerminal's file system (Extra.SERVICES.fs): click a file to open it, a folder to fold it
 *   tabbed editor a plain <textarea> over a colour layer (utils/OmniFormat.js highlightOmniLine), line numbers, error marks;
 *                 .omni files are coloured and formatted, every other file is plain text
 *   terminal      type Omni commands under the editor (same language as the OmniTerminal; Tab completes, Up / Down is history)
 *   keys          Ctrl/Cmd+S save · Shift+Alt+F format · Ctrl/Cmd+Enter run · Tab completes a command, else inserts two spaces · Esc leaves the editor
 * Format = utils/OmniFormat.js formatOmniScript (one space between words, Keyword Action(arg) prop(value), comments kept). "Format on save" is on by default.
 * Run runs the BUFFER (saved or not) through the Omni language; Check does the same without changing anything.
 * V233: look and behaviour come from /home/settings_IDE.json (utils/OmniIDESettings.js: themes, fonts, opacity, text shadow, file-tree shade, extensions reserved);
 *       bracket finishers (utils/OmniBrackets.js): auto-close, type-over, delete the pair, wrap a selection, Enter between { }, coloured pairs, match highlight.
 * Opened by omni:nav-select '⟐OmniIDE', `Omni IDE open file(/home/x.omni)`, or omni:ide-open { path }.
 */
import OmniSettingsPanelBase, { PHONE_MAX, esc } from './OmniSettingsPanelBase.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { formatOmniScript, highlightOmniLine } from '../utils/OmniFormat.js'
import { runOmniLine, runOmniScript, completeOmni } from '../utils/OmniLangRegistry.js'
import * as IDES from '../utils/OmniIDESettings.js'
import * as Br from '../utils/OmniBrackets.js'

export const NAV_ITEM = '⟐OmniIDE'
export const PANEL_ID = 'omniide'
export const STORE_KEY = 'omni:ide:v1'
const MAX_TABS = 12
const MAX_OUT = 300
const STYLES = `
.oss-panel.oide-panel, .oss-panel.oide-panel.is-wide { width: 760px; max-width: calc(100vw - 16px); max-height: calc(100vh - 80px); }
.oide-panel .oss-body { padding: 0; display: flex; flex-direction: column; overflow: hidden; height: min(560px, calc(100vh - 140px)); }
.oide-panel .oss-body { background: var(--oide-bar, transparent); color: var(--oide-fg, inherit); }
.oide-bar { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; padding: 5px 8px; border-bottom: 1px solid var(--oide-border, rgba(255,255,255,.12)); background: var(--oide-bar, transparent); }
.oide-bar select { min-height: 24px; font-size: 10px; max-width: 110px; }
.oide-bar .oss-btn { min-height: 24px; padding: 1px 7px; }
.oide-bar label { font-size: 10px; opacity: .8; display: flex; gap: 3px; align-items: center; }
.oide-main { display: flex; flex: 1 1 auto; min-height: 0; }
.oide-tree { flex: 0 0 150px; overflow: auto; border-right: 1px solid var(--oide-border, rgba(255,255,255,.12)); padding: 4px 0; font-size: 11px; background: var(--oide-side, transparent); color: var(--oide-fg, inherit); }
.oide-tree.is-hidden { display: none; }
.oide-row { padding: 2px 6px 2px calc(6px + var(--d, 0) * 12px); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oide-row:hover { background: rgba(255,255,255,.1); } .oide-row.is-active { background: rgba(255,255,255,.2); }
.oide-edit { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oide-tabs { display: flex; overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,.12); flex: 0 0 auto; }
.oide-tab { display: flex; gap: 6px; align-items: center; padding: 3px 8px; cursor: pointer; white-space: nowrap; border-right: 1px solid rgba(255,255,255,.08); font-size: 11px; opacity: .7; }
.oide-tab.is-active { opacity: 1; background: rgba(255,255,255,.1); } .oide-tab .x { opacity: .6; } .oide-tab .x:hover { opacity: 1; }
.oide-pathbar { display: flex; gap: 4px; padding: 3px 6px; align-items: center; flex: 0 0 auto; }
.oide-pathbar input { flex: 1; min-width: 0; min-height: 22px; font-size: 10px; }
.oide-ed { position: relative; flex: 1 1 auto; min-height: 90px; display: flex; overflow: hidden; background: var(--oide-bg, rgba(0,0,0,.25)); }
.oide-gut, .oide-hl, .oide-ta { font: var(--oide-fs, 12px)/var(--oide-lh, 18px) var(--oide-font, 'Courier New', Courier, monospace); tab-size: var(--oide-tab, 2); margin: 0; }
.oide-gut { flex: 0 0 40px; text-align: right; padding: 6px 6px 6px 0; color: var(--oide-gutter, rgba(255,255,255,.35)); overflow: hidden; white-space: pre; user-select: none; border-right: 1px solid var(--oide-border, rgba(255,255,255,.1)); background: var(--oide-side, transparent); }
.oide-gut .e { color: #ff6b6b; font-weight: 700; }
.oide-wrap { position: relative; flex: 1 1 auto; min-width: 0; }
.oide-hl, .oide-ta { position: absolute; inset: 0; padding: 6px 8px; white-space: pre; overflow: auto; box-sizing: border-box; border: 0; }
.oide-hl { pointer-events: none; overflow: hidden; color: var(--oide-fg, rgba(255,255,255,.9)); text-shadow: var(--oide-shadow, none); }
.oide-ta { background: transparent; color: transparent; caret-color: var(--oide-caret, #fff); resize: none; outline: none; }
.oide-ta::selection { background: var(--oide-sel, rgba(120,160,255,.45)); color: transparent; }
.oide-hl .c { color: var(--oide-c, #7d8590); font-style: italic; } .oide-hl .k0 { color: var(--oide-k0, #8aa0b8); } .oide-hl .kw { color: var(--oide-kw, #7fd1ff); font-weight: 700; } .oide-hl .ac { color: var(--oide-ac, #ffd479); }
.oide-hl .pn { color: var(--oide-pn, #c4a7ff); } .oide-hl .wd { color: var(--oide-wd, #ff9ec4); } .oide-hl .num { color: var(--oide-num, #8fe3a2); } .oide-hl .str { color: var(--oide-str, #ffb38a); } .oide-hl .bool { color: var(--oide-bool, #ff9ec4); } .oide-hl .pu { color: var(--oide-pu, #9aa4b2); }
.oide-hl .b0 { color: var(--oide-b0, #ffd479); } .oide-hl .b1 { color: var(--oide-b1, #c4a7ff); } .oide-hl .b2 { color: var(--oide-b2, #7fd1ff); } .oide-hl .b3 { color: var(--oide-b3, #8fe3a2); } .oide-hl .b4 { color: var(--oide-b4, #ff9ec4); } .oide-hl .b5 { color: var(--oide-b5, #ffb38a); }
.oide-hl .bx { color: #ff6b6b; text-decoration: underline wavy #ff6b6b; } .oide-hl .bm { background: rgba(255,255,255,.22); outline: 1px solid rgba(255,255,255,.35); border-radius: 2px; }
.oide-hl .errline { background: rgba(255,80,80,.22); }
.oide-status { display: flex; gap: 10px; padding: 2px 8px; font-size: 10px; opacity: .75; flex: 0 0 auto; border-top: 1px solid var(--oide-border, rgba(255,255,255,.1)); background: var(--oide-bar, transparent); }
.oide-term { flex: 0 0 150px; display: flex; flex-direction: column; border-top: 1px solid var(--oide-border, rgba(255,255,255,.18)); min-height: 0; background: var(--oide-side, transparent); color: var(--oide-fg, inherit); }
.oide-out { flex: 1 1 auto; overflow: auto; padding: 4px 8px; font-size: 10px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
.oide-out .e { color: #ff8a8a; } .oide-out .o { color: #8fe3a2; } .oide-out .m { opacity: .6; }
.oide-in { display: flex; gap: 4px; align-items: center; padding: 3px 6px; border-top: 1px solid rgba(255,255,255,.1); } .oide-in input { flex: 1; min-width: 0; min-height: 24px; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.oide-panel, .oss-panel.oide-panel.is-wide { width: 100%; max-height: 72vh; } .oide-panel .oss-body { height: 66vh; } .oide-tree { flex-basis: 110px; } .oide-term { flex-basis: 110px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oide-styles')) return
  const s = document.createElement('style'); s.id = 'oide-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const isOmni = (p) => /\.omni$/i.test(p || '')

export default class OmniIDEPanel extends OmniSettingsPanelBase {
  constructor (context = null, omniNode = null) {
    super({ id: PANEL_ID, label: '⟐OmniIDE', iconLabel: '⟐{ }', navItems: [NAV_ITEM], className: 'oide-panel', wide: true })
    this.context = context; this.omniNode = omniNode
    this.tabs = []; this.active = -1; this.expanded = new Set(['/', '/home', '/home/scripts'])
    this.cfg = IDES.mergeSettings({}).settings; this._lastSettingsText = null; this._matchKey = ''; this.formatOnSave = true; this.history = []; this.hIdx = -1; this._evs = []; this._els = {}; this._delArm = null
    this._confirm = (m) => { try { return window.confirm(m) } catch (_) { return false } }
  }
  get fs () { return SERVICES.fs }
  get tab () { return this.tabs[this.active] ?? null }

  // ── lifecycle ──
  onInit () {
    injectStyles()
    const on = (t, fn) => { window.addEventListener(t, fn); this._evs.push([t, fn]) }
    on('omni:ide-theme-request', (e) => { const d = e.detail ?? {}; try { if (d.name === undefined) d.out = this.cfg.theme; else d.out = this.setTheme(String(d.name)) } catch (err) { d.error = err.message } })
    on('omni:ide-settings-request', (e) => { const d = e.detail ?? {}; try { this.open(); this.openSettings(); d.out = IDES.FILE_PATH } catch (err) { d.error = err.message } })
    on('omni:ide-open', (e) => { this.open(); if (e.detail?.path) this.openFile(e.detail.path) })
    on('omni:fs-changed', (e) => { const p = e.detail?.path; if (p === IDES.FILE_PATH || p === '/') this.loadSettings(); if (this.isOpen) this._renderTree() })
    this._restore()
  }
  onDestroy () { for (const [t, f] of this._evs) window.removeEventListener(t, f); this._evs = []; this._persist() }
  onOpened () { this.loadSettings({ report: false }); this._renderAll(); setTimeout(() => this._els.ta?.focus?.(), 0) }
  refresh () { if (this._els.ta) this._renderAll() }

  _restore () {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
      if (s && typeof s === 'object') {
        this.formatOnSave = s.formatOnSave !== false
        this._pending = (Array.isArray(s.tabs) ? s.tabs : []).filter(p => typeof p === 'string').slice(0, MAX_TABS)
        this._pendingActive = Number.isInteger(s.active) ? s.active : 0
      }
    } catch (_) {}
  }
  _persist () { try { localStorage.setItem(STORE_KEY, JSON.stringify({ formatOnSave: this.formatOnSave, tabs: this.tabs.map(t => t.path), active: this.active })) } catch (_) {} }
  async _reopenPending () {
    if (!this._pending?.length) return
    const list = this._pending, act = this._pendingActive; this._pending = null
    await this.fs?.ready?.catch?.(() => {})
    for (const p of list) { try { this.openFile(p, { quiet: true }) } catch (_) {} }
    if (this.tabs.length) this.active = Math.min(act, this.tabs.length - 1)
    this._renderAll()
  }

  // ── dom ──
  buildBody (body) {
    body.innerHTML = `
      <div class="oide-bar">
        <button type="button" class="oss-btn" data-a="new" title="New .omni file">New</button>
        <button type="button" class="oss-btn" data-a="folder" title="New folder">Folder</button>
        <button type="button" class="oss-btn" data-a="save" title="Save (Ctrl+S)">Save</button>
        <button type="button" class="oss-btn" data-a="format" title="Format (Shift+Alt+F)">Format</button>
        <button type="button" class="oss-btn" data-a="run" title="Run this file (Ctrl+Enter)">▶ Run</button>
        <button type="button" class="oss-btn" data-a="check" title="Check this file without running it">Check</button>
        <button type="button" class="oss-btn" data-a="del" title="Delete this file">Delete</button>
        <label><input type="checkbox" data-r="fos"> format on save</label>
        <select class="oss-input" data-r="theme" aria-label="Theme" title="Theme (saved in settings_IDE.json)">${IDES.THEME_NAMES.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
        <button type="button" class="oss-btn" data-a="settings" title="Open settings_IDE.json (themes, fonts, opacity, brackets)">⚙</button>
        <button type="button" class="oss-btn" data-a="tree" title="Show or hide the file tree">☰</button>
      </div>
      <div class="oide-main">
        <div class="oide-tree" data-r="tree" role="tree"></div>
        <div class="oide-edit">
          <div class="oide-tabs" data-r="tabs" role="tablist"></div>
          <div class="oide-pathbar"><input class="oss-input" data-r="path" aria-label="File path (Enter renames)" placeholder="no file open"></div>
          <div class="oide-ed"><pre class="oide-gut" data-r="gut"></pre><div class="oide-wrap"><pre class="oide-hl" data-r="hl" aria-hidden="true"></pre><textarea class="oide-ta" data-r="ta" spellcheck="false" wrap="off" autocomplete="off" autocapitalize="off" aria-label="Editor"></textarea></div></div>
          <div class="oide-status"><span data-r="pos">Ln 1, Col 1</span><span data-r="lang"></span><span data-r="dirty"></span><span data-r="msg"></span></div>
        </div>
      </div>
      <div class="oide-term"><div class="oide-out" data-r="out" aria-live="polite"></div>
        <div class="oide-in"><span>⟐</span><input class="oss-input" data-r="cmd" placeholder="Omni Help" aria-label="Omni command" autocomplete="off" spellcheck="false"></div></div>`
    const q = (r) => body.querySelector(`[data-r="${r}"]`)
    this._els = { body, tree: q('tree'), tabs: q('tabs'), path: q('path'), gut: q('gut'), hl: q('hl'), ta: q('ta'), pos: q('pos'), lang: q('lang'), dirty: q('dirty'), msg: q('msg'), out: q('out'), cmd: q('cmd'), fos: q('fos'), theme: q('theme') }
    const E = this._els
    E.fos.checked = this.formatOnSave
    E.fos.addEventListener('change', () => { this.formatOnSave = E.fos.checked; this._persist() })
    E.theme.value = this.cfg.theme
    E.theme.addEventListener('change', () => { try { this.setTheme(E.theme.value) } catch (e) { this._flash(e.message, true) } })
    this._applyVars()
    body.addEventListener('keydown', (e) => e.stopPropagation()); body.addEventListener('keyup', (e) => e.stopPropagation())   // typing here never drives the camera
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (b) return this._act(b.dataset.a)
      const row = e.target.closest('.oide-row'); if (row) return this._rowClick(row)
      const tb = e.target.closest('.oide-tab'); if (tb) { if (e.target.closest('.x')) this.closeTab(+tb.dataset.i); else this.setActive(+tb.dataset.i) }
    })
    E.ta.addEventListener('input', () => this._edited())
    E.ta.addEventListener('scroll', () => { E.hl.scrollTop = E.ta.scrollTop; E.hl.scrollLeft = E.ta.scrollLeft; E.gut.scrollTop = E.ta.scrollTop })
    E.ta.addEventListener('keydown', (e) => this._editorKey(e))
    for (const ev of ['keyup', 'click', 'select']) E.ta.addEventListener(ev, () => this._cursor())
    E.path.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.rename(E.path.value.trim()) })
    E.cmd.addEventListener('keydown', (e) => this._cmdKey(e))
    this._reopenPending()
  }

  // ── settings (V233) ──
  /** Apply this.cfg to the panel as CSS custom properties. */
  _applyVars () {
    const el = this.el; if (!el) return
    for (const [k, v] of Object.entries(IDES.toCssVars(this.cfg))) el.style.setProperty(k, v)
    if (this._els.theme) this._els.theme.value = this.cfg.theme
  }
  /** Make sure /home/settings_IDE.json exists (written from the defaults the first time), read it, and apply it. Broken JSON keeps the last good settings. */
  loadSettings ({ report = true } = {}) {
    const fs = this.fs; if (!fs) return null
    let text
    try { if (!fs.exists(IDES.FILE_PATH)) { fs.mkdir('/home', { quiet: true }); fs.write(IDES.FILE_PATH, IDES.defaultText(), { quiet: true }) } text = fs.read(IDES.FILE_PATH) } catch (_) { return null }
    if (text === this._lastSettingsText) return this.cfg
    this._lastSettingsText = text
    const r = IDES.parseSettingsText(text)
    if (!r.ok) { if (report) { this._flash(`settings_IDE.json: ${r.error}${r.line ? ' (line ' + r.line + ')' : ''}. Keeping the last good settings.`, true); this._print(`settings_IDE.json ${r.error}${r.line ? ' near line ' + r.line : ''}. Keeping the last good settings.`, 'e') } return null }
    this.cfg = r.settings; this._applyVars(); if (this._els.ta) this._paint()
    if (report && r.problems.length) { this._flash(`settings_IDE.json: ${r.problems.length} problem${r.problems.length === 1 ? '' : 's'}, see below`, true); for (const m of r.problems) this._print('settings_IDE.json: ' + m, 'e') }
    else if (report) this._flash('Settings applied.')
    return this.cfg
  }
  setTheme (name) {
    if (!IDES.THEME_NAMES.includes(name)) throw new Error(`theme is one of: ${IDES.THEME_NAMES.join(', ')}`)
    const fs = this._need(); this.loadSettings({ report: false })
    const text = IDES.setKeyInText(fs.exists(IDES.FILE_PATH) ? fs.read(IDES.FILE_PATH) : IDES.defaultText(), 'theme', name)
    fs.write(IDES.FILE_PATH, text); const open = this.tabs.find(t => t.path === IDES.FILE_PATH); if (open) { open.text = open.saved = text; if (this.tab === open) this._renderEditor() }
    this.loadSettings({ report: false }); this._flash(`Theme: ${name}`); return this.cfg.theme
  }
  openSettings () { this.loadSettings({ report: false }); return this.openFile(IDES.FILE_PATH) }
  _isSettings (t = this.tab) { return !!t && t.path === IDES.FILE_PATH }

  // ── files ──
  _need () { if (!this.fs) throw new Error('the file system is not running'); return this.fs }
  openFile (path, { quiet = false } = {}) {
    const fs = this._need(), abs = fs.resolve(path)
    const i = this.tabs.findIndex(t => t.path === abs)
    if (i >= 0) { this.setActive(i); return this.tabs[i] }
    const text = fs.read(abs)
    if (this.tabs.length >= MAX_TABS) throw new Error(`at most ${MAX_TABS} tabs, close one first`)
    this.tabs.push({ path: abs, text, saved: text, errors: [] }); this.active = this.tabs.length - 1
    if (!quiet) { this._persist(); this._renderAll() }
    return this.tabs[this.active]
  }
  newFile (name) {
    const fs = this._need(); fs.mkdir('/home/scripts', { quiet: true })
    let p = name ? fs.resolve(name) : null
    if (!p) { for (let n = 1; n < 1000; n++) { const c = `/home/scripts/untitled-${n}.omni`; if (!fs.exists(c)) { p = c; break } } }
    if (!p) throw new Error('too many untitled files')
    if (!fs.exists(p)) fs.write(p, isOmni(p) ? '# new script: one Omni command per line\n' : '')
    const t = this.openFile(p); this._flash(`Created ${p}`); return t
  }
  newFolder () {
    const fs = this._need(); for (let n = 1; n < 1000; n++) { const c = `/home/scripts/folder-${n}`; if (!fs.exists(c)) { fs.mkdir(c); this.expanded.add('/home/scripts'); this._flash(`Created ${c}`); this._renderTree(); return c } }
  }
  save (opts = {}) {
    const t = this.tab; if (!t) return false
    if (this.formatOnSave && isOmni(t.path) && !opts.raw) { const r = formatOmniScript(t.text); t.errors = r.errors.map(e => e.line); if (r.changed) this._setText(r.text); else this._paint() }
    this._need().write(t.path, t.text); t.saved = t.text; this._flash(`Saved ${t.path}`); this._renderTabs(); this._status(); if (t.path === IDES.FILE_PATH) this.loadSettings(); return true
  }
  format () {
    const t = this.tab; if (!t) return null
    if (!isOmni(t.path)) { this._flash('Only .omni files are formatted'); return null }
    const r = formatOmniScript(t.text); t.errors = r.errors.map(e => e.line)
    if (r.changed) this._setText(r.text)
    this._flash(r.errors.length ? `Formatted. ${r.errors.length} line${r.errors.length === 1 ? '' : 's'} could not be read (red).` : (r.changed ? 'Formatted.' : 'Already tidy.'))
    this._paint(); return r
  }
  rename (to) {
    const t = this.tab; if (!t || !to || to === t.path) return
    try { const fs = this._need(); const dest = fs.mv(t.path, to); t.path = dest; this._persist(); this._renderAll(); this._flash(`Renamed to ${dest}`) } catch (e) { this._flash(e.message, true); this._els.path.value = t.path }
  }
  deleteFile () {
    const t = this.tab; if (!t) return
    if (this._delArm !== t.path) { this._delArm = t.path; this._flash(`Press Delete again to remove ${t.path}`, true); clearTimeout(this._delT); this._delT = setTimeout(() => { this._delArm = null }, 3000); return }
    this._delArm = null
    try { this._need().rm(t.path); this.tabs.splice(this.active, 1); this.active = Math.min(this.active, this.tabs.length - 1); this._persist(); this._renderAll(); this._flash('Deleted.') } catch (e) { this._flash(e.message, true) }
  }
  setActive (i) { if (i < 0 || i >= this.tabs.length) return; this.active = i; this._persist(); this._renderAll() }
  closeTab (i, { force = false } = {}) {
    const t = this.tabs[i]; if (!t) return false
    if (t.text !== t.saved && !force && !this._confirm(`${t.path} has unsaved changes. Close it anyway?`)) return false
    this.tabs.splice(i, 1); if (this.active >= this.tabs.length) this.active = this.tabs.length - 1; else if (i < this.active) this.active--
    this._persist(); this._renderAll(); return true
  }

  // ── editing ──
  _setText (text) {
    const t = this.tab; if (!t) return
    const E = this._els, ta = E.ta, st = ta.scrollTop
    t.text = text; ta.value = text; ta.scrollTop = st; this._paint(); this._status()
  }
  _edited () { const t = this.tab; if (!t) return; t.text = this._els.ta.value; t.errors = []; this._paint(); this._status() }
  _editorKey (e) {
    const ta = this._els.ta, mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); try { this.save() } catch (x) { this._flash(x.message, true) } return }
    if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); this.format(); return }
    if (mod && e.key === 'Enter') { e.preventDefault(); this.run(); return }
    if (e.key === 'Escape') { ta.blur(); return }
    if (!mod && !e.altKey && this._bracketKey(e)) return
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      if (this._complete()) return
      const a = ta.selectionStart, b = ta.selectionEnd; ta.setRangeText(' '.repeat(this.cfg.tabSize), a, b, 'end'); this._edited()
    }
  }
  /** Bracket finishers. Returns true when the key was handled here. */
  _bracketKey (e) {
    const ta = this._els.ta, t = this.tab; if (!t || e.isComposing) return false
    const o = this.cfg.brackets, a = ta.selectionStart, b = ta.selectionEnd, tab = ' '.repeat(this.cfg.tabSize)
    let res = null
    if (e.key === 'Backspace' && o.autoClose) res = Br.deletePair(ta.value, a, b)
    else if (e.key === 'Enter' && !e.shiftKey) res = Br.enterBetween(ta.value, a, b, tab)
    else if (e.key.length === 1) res = Br.closeOnType(ta.value, a, b, e.key, o)
    if (!res) return false
    e.preventDefault(); this._applyEdit(res); return true
  }
  /** Put an edit result into the textarea. execCommand keeps the browser's own undo; the plain assignment is the fallback (and what tests use). */
  _applyEdit (res) {
    const ta = this._els.ta, old = ta.value
    let i = 0; while (i < old.length && i < res.text.length && old[i] === res.text[i]) i++
    let j = 0; while (j < old.length - i && j < res.text.length - i && old[old.length - 1 - j] === res.text[res.text.length - 1 - j]) j++
    const ins = res.text.slice(i, res.text.length - j); let done = false
    try { ta.setSelectionRange(i, old.length - j); done = typeof document.execCommand === 'function' && document.execCommand('insertText', false, ins) && ta.value === res.text } catch (_) { done = false }
    if (!done) ta.value = res.text
    ta.setSelectionRange(res.a, res.b); this._edited(); this._cursor()
  }
  /** complete the Omni word before the cursor; false when there is nothing to complete */
  _complete () {
    const t = this.tab, ta = this._els.ta; if (!t || !isOmni(t.path)) return false
    const pos = ta.selectionStart, ls = ta.value.lastIndexOf('\n', pos - 1) + 1, line = ta.value.slice(ls, pos)
    if (!line.trim() || /^\s*(#|\/\/)/.test(line)) return false
    const r = completeOmni(line); if (!r.items.length) return false
    const common = r.items.map(i => i.text).reduce((a, b) => { let k = 0; while (k < a.length && k < b.length && a[k].toLowerCase() === b[k].toLowerCase()) k++; return a.slice(0, k) })
    const add = r.items.length === 1 ? r.items[0].text + (r.items[0].text.endsWith('(') ? '' : ' ') : common
    ta.setRangeText(add, ls + r.from, pos, 'end'); this._edited()
    if (r.items.length > 1) this._print(r.items.map(i => i.text + (i.hint ? '  — ' + i.hint : '')).join('\n'), 'm')
    return true
  }
  _cursor () {
    const ta = this._els.ta; if (!ta || !this._els.pos) return
    const before = ta.value.slice(0, ta.selectionStart), ln = before.split('\n').length, col = before.length - before.lastIndexOf('\n')
    this._els.pos.textContent = `Ln ${ln}, Col ${col}`
    if (this.cfg.brackets.highlightMatch && this.tab) { const m = Br.matchNear(this._info ?? Br.scan(''), ta.selectionStart), key = m ? m.at + ':' + m.other : ''; if (key !== this._matchKey) this._paint() }
  }

  // ── run / terminal ──
  _ctx () { return { omniNode: this.omniNode, camera: this.context?.camera, fs: this.fs, depth: 0 } }
  async run ({ dry = false } = {}) {
    const t = this.tab; if (!t) return null
    if (!isOmni(t.path)) { this._flash('Only .omni files can run', true); return null }
    this._print(`${dry ? 'Checking' : 'Running'} ${t.path} ...`, 'm')
    const res = await runOmniScript(t.text, this._ctx(), { dry })
    t.errors = res.results.filter(r => !r.ok).map(r => r.line)
    for (const r of res.results) this._print(`${String(r.line).padStart(3)}  ${r.ok ? '✓ ' + r.output : '✗ ' + r.error}`, r.ok ? 'o' : 'e')
    this._print(res.ok ? `${res.results.length} command${res.results.length === 1 ? '' : 's'} ${dry ? 'look fine' : 'ran'}.` : `Stopped at line ${res.results.at(-1).line}.`, res.ok ? 'm' : 'e')
    this._paint(); return res
  }
  async runCommand (line) {
    const s = String(line ?? '').trim(); if (!s) return null
    this._print('⟐ ' + s, 'm')
    const r = await runOmniLine(/^⟐?\s*omni(\s|$)/i.test(s) ? s : 'Omni ' + s, this._ctx())
    this._print(r.ok ? r.output : r.error, r.ok ? 'o' : 'e'); return r
  }
  _cmdKey (e) {
    const c = this._els.cmd
    if (e.key === 'Enter') { const v = c.value; if (v.trim()) { this.history.push(v); this.history = this.history.slice(-100) } this.hIdx = -1; c.value = ''; this.runCommand(v); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (this.history.length) { this.hIdx = this.hIdx < 0 ? this.history.length - 1 : Math.max(0, this.hIdx - 1); c.value = this.history[this.hIdx] } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (this.hIdx >= 0) { this.hIdx++; c.value = this.hIdx >= this.history.length ? '' : this.history[this.hIdx]; if (this.hIdx >= this.history.length) this.hIdx = -1 } return }
    if (e.key === 'Tab') {
      const r = completeOmni(c.value); if (!r.items.length) return
      e.preventDefault()
      const common = r.items.map(i => i.text).reduce((a, b) => { let k = 0; while (k < a.length && k < b.length && a[k].toLowerCase() === b[k].toLowerCase()) k++; return a.slice(0, k) })
      c.value = c.value.slice(0, r.from) + (r.items.length === 1 ? r.items[0].text + (r.items[0].text.endsWith('(') ? '' : ' ') : common)
      if (r.items.length > 1) this._print(r.items.map(i => i.text + (i.hint ? '  — ' + i.hint : '')).join('\n'), 'm')
    }
  }
  _print (text, cls = '') {
    const out = this._els.out; if (!out) return
    const d = document.createElement('div'); if (cls) d.className = cls; d.textContent = String(text ?? ''); out.appendChild(d)
    while (out.children.length > MAX_OUT) out.removeChild(out.firstChild)
    out.scrollTop = out.scrollHeight
  }

  // ── actions from the bar ──
  _act (a) {
    try {
      if (a === 'new') this.newFile(); else if (a === 'folder') this.newFolder(); else if (a === 'save') this.save()
      else if (a === 'format') this.format(); else if (a === 'run') this.run(); else if (a === 'check') this.run({ dry: true })
      else if (a === 'del') this.deleteFile(); else if (a === 'settings') this.openSettings(); else if (a === 'tree') this._els.tree.classList.toggle('is-hidden')
    } catch (e) { this._flash(e.message, true) }
  }
  _rowClick (row) {
    const p = row.dataset.path
    if (row.dataset.type === 'dir') { if (this.expanded.has(p)) this.expanded.delete(p); else this.expanded.add(p); this._renderTree() } else { try { this.openFile(p) } catch (e) { this._flash(e.message, true) } }
  }
  _flash (msg, err = false) { const m = this._els.msg; if (!m) return; m.textContent = msg; m.style.color = err ? '#ff8a8a' : ''; clearTimeout(this._mt); this._mt = setTimeout(() => { m.textContent = '' }, 4000) }

  // ── render ──
  _renderAll () { this._renderTree(); this._renderTabs(); this._renderEditor() }
  _renderTree () {
    const el = this._els.tree; if (!el) return
    el.textContent = ''
    const fs = this.fs; if (!fs) { el.textContent = 'File system not running'; return }
    const add = (path, name, type, depth) => {
      const r = document.createElement('div'); r.className = 'oide-row' + (this.tab?.path === path ? ' is-active' : ''); r.style.setProperty('--d', depth)
      r.dataset.path = path; r.dataset.type = type; r.setAttribute('role', 'treeitem')
      r.textContent = (type === 'dir' ? (this.expanded.has(path) ? '▾ ' : '▸ ') : '· ') + name; el.appendChild(r)
    }
    const walk = (dir, depth) => {
      let list = []; try { list = fs.ls(dir) } catch (_) { return }
      for (const e of list) {
        const p = (dir === '/' ? '' : dir) + '/' + e.name
        add(p, e.name, e.type, depth)
        if (e.type === 'dir' && this.expanded.has(p)) walk(p, depth + 1)
      }
    }
    walk('/', 0)
  }
  _renderTabs () {
    const el = this._els.tabs; if (!el) return
    el.textContent = ''
    this.tabs.forEach((t, i) => {
      const d = document.createElement('div'); d.className = 'oide-tab' + (i === this.active ? ' is-active' : ''); d.dataset.i = i; d.setAttribute('role', 'tab')
      const n = document.createElement('span'); n.textContent = t.path.split('/').pop() + (t.text !== t.saved ? ' ●' : '')
      const x = document.createElement('span'); x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Close tab'); d.append(n, x); el.appendChild(d)
    })
  }
  _renderEditor () {
    const E = this._els, t = this.tab; if (!E.ta) return
    E.ta.disabled = !t; E.ta.value = t ? t.text : ''; E.path.value = t ? t.path : ''
    E.ta.placeholder = t ? '' : 'Open a file from the tree, or press New.'
    this._paint(); this._status(); this._cursor()
  }
  _paint () {
    const E = this._els, t = this.tab; if (!E.hl) return
    const text = t ? t.text : '', lines = text.split('\n'), omni = t && isOmni(t.path), errs = new Set(t?.errors ?? [])
    E.hl.textContent = ''
    const br = this.cfg.brackets, withBr = !!t && (br.colorPairs || br.highlightMatch)
    this._info = Br.scan(text, { comments: !!omni })
    const match = withBr && br.highlightMatch ? Br.matchNear(this._info, E.ta.selectionStart ?? 0) : null
    this._matchKey = match ? match.at + ':' + match.other : ''
    let lineStart = 0
    lines.forEach((ln, i) => {
      const row = document.createElement('span'); if (errs.has(i + 1)) row.className = 'errline'
      let segs = omni ? highlightOmniLine(ln) : [{ text: ln, cls: '' }]
      if (withBr) segs = Br.decorate(segs, lineStart, this._info, { colorPairs: br.colorPairs, highlightMatch: br.highlightMatch, match })
      lineStart += ln.length + 1
      if (omni || withBr) for (const s of segs) { if (!s.cls) row.appendChild(document.createTextNode(s.text)); else { const sp = document.createElement('span'); sp.className = s.cls; sp.textContent = s.text; row.appendChild(sp) } }
      else row.appendChild(document.createTextNode(ln))
      E.hl.appendChild(row); E.hl.appendChild(document.createTextNode('\n'))
    })
    E.gut.textContent = ''
    lines.forEach((_, i) => { if (errs.has(i + 1)) { const s = document.createElement('span'); s.className = 'e'; s.textContent = (i + 1) + '\n'; E.gut.appendChild(s) } else E.gut.appendChild(document.createTextNode((i + 1) + '\n')) })
  }
  _status () {
    const E = this._els, t = this.tab; if (!E.lang) return
    E.lang.textContent = t ? (isOmni(t.path) ? 'Omni script' : this._isSettings(t) ? 'IDE settings (JSON)' : 'Plain text') : ''
    E.dirty.textContent = t && t.text !== t.saved ? 'unsaved' : ''
    this._renderTabsDirty()
  }
  _renderTabsDirty () { const t = this._els.tabs; if (!t) return; [...t.children].forEach((d, i) => { const tab = this.tabs[i]; if (tab) d.firstChild.textContent = tab.path.split('/').pop() + (tab.text !== tab.saved ? ' ●' : '') }) }
}
