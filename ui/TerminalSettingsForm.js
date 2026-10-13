/**
 * ui/TerminalSettingsForm.js — V192: the terminal settings controls, built ONCE and shown in two places:
 *   - ui/TerminalSettingsPanel.js (⟐TerminalSettings, Admin): scope 'global' — the defaults and the built-in tunnel;
 *   - the Inspector block of a TerminalShellTunnel node (ui/OmniExtraKindInspector.js): scope 'shell' — this shell's name and orientation, plus the
 *     shared "where you type" and colour settings (the same global settings, so one place never disagrees with the other).
 *
 * What it shows:
 *   Where you type      Scene panel | DOM panel | Both (kept in sync)             (setting inputSurface)
 *   Colours             Follow OmniOS theme (default ON), or custom accent / background / text / prompt / selection / border; opacity
 *                       + a live strip of the colours the terminal is using right now
 *   Orientation         Front | Left | Right | Top | Flat on floor, yaw / pitch / roll in degrees, Face the camera (billboard)
 * Every change is validated (utils/TerminalSettings.js, utils/TerminalShells.js), applied live and persisted; a refused value is explained in the
 * message line and the control goes back to the stored value. USER-facing: it never imports a Dev* module.
 */

import { getSettings, setSettings, getPalette, getDefaultSettings } from '../utils/TerminalSettings.js'
import * as Shells from '../utils/TerminalShells.js'
import { ORIENTATION_PRESETS, PRESET_IDS, describeOrientation, ANGLE_MIN, ANGLE_MAX } from '../utils/TerminalOrientation.js'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`

export const SURFACE_LABELS = { scene: 'Scene panel', dom: 'DOM panel', both: 'Both (kept in sync)' }
const CUSTOM_LABELS = { bg: 'Background', text: 'Text', prompt: 'Prompt', selection: 'Selection', border: 'Border' }

const STYLES = `
.tsf { display: flex; flex-direction: column; gap: 12px; font-family: var(--mono, 'Courier New', Courier, monospace); color: var(--tms-text, var(--oi-text, rgba(255,255,255,.92))); }
.tsf-label { font-size: 9px; letter-spacing: .05em; text-transform: uppercase; opacity: .72; margin-bottom: 5px; }
.tsf-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.tsf-val { font-size: 10.5px; line-height: 1.35; overflow-wrap: anywhere; }
.tsf-note { font-size: 9.5px; opacity: .72; line-height: 1.45; }
.tsf-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; }
.tsf-msg.is-err { color: #ff9c9c; }
.tsf-in, .tsf-select { min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.22); border-radius: 5px; }
.tsf-select { width: 100%; }
.tsf-select option { color: #111; background: #fff; }
.tsf-num { width: 64px; }
.tsf input[type="color"] { width: 36px; height: 28px; padding: 0; border-radius: 5px; border: 1px solid rgba(255,255,255,.3); cursor: pointer; background: none; }
.tsf input[type="range"] { flex: 1 1 120px; min-width: 0; }
.tsf-btn { flex: 1 1 auto; min-height: 28px; padding: 2px 8px; font: inherit; font-size: 10.5px; color: inherit; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.22); border-radius: 5px; cursor: pointer; }
.tsf-btn:hover { background: rgba(255,255,255,.16); }
.tsf-btn.is-on { background: rgba(127,214,255,.30); border-color: rgba(127,214,255,.9); }
.tsf-btn:disabled, .tsf-in:disabled { opacity: .45; cursor: default; }
.tsf-check { display: flex; align-items: center; gap: 6px; font-size: 10.5px; cursor: pointer; min-height: 28px; }
.tsf-strip { display: flex; gap: 3px; align-items: center; }
.tsf-sw { width: 22px; height: 16px; border-radius: 3px; border: 1px solid rgba(255,255,255,.3); }
.tsf-custom { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
.tsf-custom[hidden] { display: none; }
.tsf-custom label { display: flex; align-items: center; gap: 6px; font-size: 10px; }
@media (max-width: 700px) { .tsf-btn, .tsf-in, .tsf-select, .tsf-check { min-height: 40px; } .tsf-num { width: 76px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('tsf-styles')) return
  const s = document.createElement('style'); s.id = 'tsf-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

function currentOrientation (scope, shellId) {
  const g = getSettings().orientation
  if (scope !== 'shell') return { o: g, own: true }
  const sh = Shells.getShell(shellId)
  return { o: Shells.effectiveOrientation(shellId, g), own: !!sh?.orientation }
}

/** The HTML of the form. `scope` 'global' | 'shell' (then `shellId`). */
export function terminalFormHTML ({ scope = 'global', shellId = null } = {}) {
  injectStyles()
  const s = getSettings()
  const { o, own } = currentOrientation(scope, shellId)
  const sh = scope === 'shell' ? Shells.getShell(shellId) : null
  const orientDisabled = scope === 'shell' && !own
  const pal = getPalette()
  return `
  <div class="tsf" data-scope="${esc(scope)}" data-shell="${esc(shellId ?? '')}">
    ${scope === 'shell' ? `
    <div><div class="tsf-label">Name</div>
      <div class="tsf-row"><input class="tsf-in" style="flex:1 1 140px" data-ts="name" maxlength="${Shells.MAX_NAME}" value="${esc(sh?.name ?? '')}" ${tip('Shell name', 'Renames this TerminalShellTunnel (and its node). It is also the title on the panel.')}></div></div>` : ''}
    <div><div class="tsf-label">Where you type</div>
      <select class="tsf-select" data-ts="surface" ${tip('Where you type', 'Scene panel: click the terminal panel in the scene and type there. DOM panel: type in the OmniCommandTerminal window. Both: either one works and what you type shows in both.')}>
        ${Object.entries(SURFACE_LABELS).map(([v, l]) => `<option value="${v}" ${s.inputSurface === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>
      <div class="tsf-note" data-ts="surface-note"></div></div>
    <div><div class="tsf-label">Colours</div>
      <label class="tsf-check" ${tip('Follow OmniOS theme', 'On: the terminal (scene and DOM) uses the colours of the OmniOS theme chosen in Admin settings and changes with it. Off: use the custom colours below.')}><input type="checkbox" data-ts="follow" ${s.followTheme ? 'checked' : ''}> Follow OmniOS theme</label>
      <div class="tsf-strip" data-ts="strip" aria-label="Colours in use now">${['bg', 'text', 'prompt', 'accent', 'selection', 'border'].map(k => `<span class="tsf-sw" data-k="${k}" style="background:${esc(pal[k])}" title="${k}"></span>`).join('')}</div>
      <div class="tsf-custom" data-ts="custom" ${s.followTheme ? 'hidden' : ''}>
        <label ${tip('Accent', 'Accent colour of the terminal (title, wire lines) when not following the theme.')}><input type="color" data-ts="c-accent" value="${esc(s.accent)}"> Accent</label>
        ${Object.entries(CUSTOM_LABELS).map(([k, l]) => `<label ${tip(l, `${l} colour when not following the theme.`)}><input type="color" data-ts="c-${k}" value="${esc(s.custom[k])}"> ${l}</label>`).join('')}
      </div>
      <div class="tsf-row" style="margin-top:6px"><span class="tsf-val">Opacity</span><input type="range" data-ts="opacity" min="0" max="1" step="0.02" value="${s.backgroundOpacity}" ${tip('Background opacity', 'How see-through the terminal background is.')}><span class="tsf-val" data-ts="opacity-val">${Math.round(s.backgroundOpacity * 100)}%</span></div></div>
    <div><div class="tsf-label">Orientation${scope === 'shell' ? ' of this shell' : ' (default)'}</div>
      ${scope === 'shell' ? `<label class="tsf-check" ${tip('Same as TerminalSettings', 'On: this shell uses the default orientation of ⟐TerminalSettings. Off: it has its own.')}><input type="checkbox" data-ts="o-inherit" ${own ? '' : 'checked'}> Same as the ⟐TerminalSettings default</label>` : ''}
      <div class="tsf-row" role="group" aria-label="Orientation presets">
        ${PRESET_IDS.map(id => `<button class="tsf-btn ${!o.billboard && o.preset === id ? 'is-on' : ''}" data-ts="preset" data-preset="${id}" aria-pressed="${!o.billboard && o.preset === id}" ${orientDisabled ? 'disabled' : ''} ${tip(ORIENTATION_PRESETS[id].label, `Turns the terminal to ${ORIENTATION_PRESETS[id].label.toLowerCase()} and stops it facing the camera.`)}>${esc(ORIENTATION_PRESETS[id].label)}</button>`).join('')}
      </div>
      <div class="tsf-row" style="margin-top:6px">
        ${['yaw', 'pitch', 'roll'].map(k => `<label class="tsf-val" ${tip(k[0].toUpperCase() + k.slice(1), `${k} in degrees, from ${ANGLE_MIN} to ${ANGLE_MAX}.${k === 'roll' ? ' Also turns a camera-facing panel around its line of sight.' : ' Ignored while the terminal faces the camera.'}`)}>${k} <input class="tsf-in tsf-num" type="number" data-ts="angle" data-k="${k}" min="${ANGLE_MIN}" max="${ANGLE_MAX}" step="1" value="${o[k]}" ${orientDisabled ? 'disabled' : ''}>°</label>`).join('')}
      </div>
      <label class="tsf-check" ${tip('Face the camera', 'Billboard: the panel always turns to face the camera. Off: it stays where the yaw / pitch / roll point.')}><input type="checkbox" data-ts="billboard" ${o.billboard ? 'checked' : ''} ${orientDisabled ? 'disabled' : ''}> Face the camera (billboard)</label>
      <div class="tsf-note" data-ts="o-desc">${esc(describeOrientation(o))}</div></div>
    ${scope === 'global' ? `
    <div><div class="tsf-label">Built-in tunnel panel position</div>
      <select class="tsf-select" data-ts="position" ${tip('Panel position', 'Where the built-in terminal panel sits: the centre of its cylinder, or the outer circumference near the camera.')}>
        <option value="center" ${s.panelPosition === 'center' ? 'selected' : ''}>Center of the cylinder</option>
        <option value="circumference" ${s.panelPosition === 'circumference' ? 'selected' : ''}>Outer circumference</option>
      </select></div>` : ''}
    <div class="tsf-row">
      ${scope === 'global' ? `<button class="tsf-btn" data-ts="add-node" ${tip('Add a TerminalShellTunnel node', 'Creates a TerminalShellTunnel node in front of the camera: another in-scene terminal. The Terminal button switches all of them together.')}>＋ TerminalShellTunnel node</button>
      <button class="tsf-btn" data-ts="reset" ${tip('Reset terminal settings', 'Puts every terminal setting back to its default (follow the theme, type in the scene, face the camera).')}>Reset</button>` : ''}
    </div>
    <div class="tsf-msg" role="status" aria-live="polite" data-ts="msg"></div>
    <div class="tsf-note" data-ts="count-note"></div>
    <div class="tsf-note">One shared default for every terminal surface: the in-scene TerminalShellTunnel panels, the OmniCommandTerminal window and OmniChat's Terminal tab.</div>
  </div>`
}

/** Wire the controls inside `root` (the element that contains the form). Returns a dispose function. Re-syncs itself on setting / theme / shell changes. */
export function wireTerminalForm (root, { scope = 'global', shellId = null } = {}) {
  const q = (k) => root.querySelector(`[data-ts="${k}"]`)
  const qa = (k) => [...root.querySelectorAll(`[data-ts="${k}"]`)]
  const say = (text, err = false) => { const m = q('msg'); if (m) { m.textContent = text; m.classList.toggle('is-err', !!err) } }
  const refused = (r, what) => { if (r?.rejected?.length) { say(`${what}: ${r.rejected.join(', ')} not accepted (kept the old value).`, true); sync(); return true } return false }

  const sync = () => {
    const s = getSettings()
    const { o, own } = currentOrientation(scope, shellId)
    const sel = q('surface'); if (sel) sel.value = s.inputSurface
    const note = q('surface-note')
    if (note) note.textContent = s.inputSurface === 'scene' ? 'Click the terminal panel in the scene, then type. The OmniCommandTerminal window is not opened by the Terminal button.' : s.inputSurface === 'dom' ? 'The Terminal button opens the OmniCommandTerminal window; the scene panel shows the same lines but does not take keys.' : 'Type in either one: lines and the line being typed show in both.'
    const f = q('follow'); if (f) f.checked = s.followTheme
    const cu = q('custom'); if (cu) cu.hidden = s.followTheme
    const ca = q('c-accent'); if (ca) ca.value = s.accent
    Object.keys(CUSTOM_LABELS).forEach(k => { const el = q('c-' + k); if (el) el.value = s.custom[k] })
    const op = q('opacity'); if (op) op.value = String(s.backgroundOpacity)
    const ov = q('opacity-val'); if (ov) ov.textContent = `${Math.round(s.backgroundOpacity * 100)}%`
    const pal = getPalette()
    qa('strip').forEach(st => st.querySelectorAll('.tsf-sw').forEach(sw => { sw.style.background = pal[sw.dataset.k] }))
    const dis = scope === 'shell' && !own
    const inh = q('o-inherit'); if (inh) inh.checked = !own
    qa('preset').forEach(b => { const on = !o.billboard && o.preset === b.dataset.preset; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); b.disabled = dis })
    qa('angle').forEach(a => { a.value = String(o[a.dataset.k]); a.disabled = dis })
    const bb = q('billboard'); if (bb) { bb.checked = o.billboard; bb.disabled = dis }
    const od = q('o-desc'); if (od) od.textContent = describeOrientation(o)
    const pos = q('position'); if (pos) pos.value = s.panelPosition
    const nm = q('name'); if (nm && scope === 'shell' && document.activeElement !== nm) nm.value = Shells.getShell(shellId)?.name ?? nm.value
    const cn = q('count-note'); if (cn) { const n = Shells.shellCount(); cn.textContent = `${n} TerminalShellTunnel node${n === 1 ? '' : 's'} in the scene, plus the built-in tunnel. The terminals are ${Shells.isOn() ? 'ON' : 'OFF'}.` }
  }

  const setOrientation = (patch) => {
    if (scope === 'shell') {
      const r = Shells.setShellOrientation(shellId, patch, getSettings().orientation)
      if (!r.ok) { say(r.error, true); return }
      if (refused({ rejected: r.rejected }, 'Orientation')) return
    } else {
      const r = setSettings({ orientation: patch })
      if (refused(r, 'Orientation')) return
    }
    sync()
  }

  q('surface')?.addEventListener('change', (e) => { const r = setSettings({ inputSurface: e.target.value }); if (!refused(r, 'Where you type')) say(`Typing: ${SURFACE_LABELS[getSettings().inputSurface]}.`) })
  q('follow')?.addEventListener('change', (e) => { setSettings({ followTheme: e.target.checked }); say(e.target.checked ? 'Following the OmniOS theme.' : 'Using the custom colours.') })
  q('c-accent')?.addEventListener('input', (e) => refused(setSettings({ accent: e.target.value }), 'Accent'))
  Object.keys(CUSTOM_LABELS).forEach(k => q('c-' + k)?.addEventListener('input', (e) => refused(setSettings({ custom: { [k]: e.target.value } }), CUSTOM_LABELS[k])))
  q('opacity')?.addEventListener('input', (e) => { const r = setSettings({ backgroundOpacity: Number(e.target.value) }); if (!refused(r, 'Opacity')) { const ov = q('opacity-val'); if (ov) ov.textContent = `${Math.round(getSettings().backgroundOpacity * 100)}%` } })
  q('position')?.addEventListener('change', (e) => refused(setSettings({ panelPosition: e.target.value }), 'Panel position'))
  qa('preset').forEach(b => b.addEventListener('click', () => setOrientation({ preset: b.dataset.preset })))
  qa('angle').forEach(a => a.addEventListener('change', () => {
    const v = a.value.trim()
    if (v === '' || !Number.isFinite(Number(v))) { say(`${a.dataset.k}: a number from ${ANGLE_MIN} to ${ANGLE_MAX} is needed.`, true); sync(); return }
    setOrientation({ [a.dataset.k]: Number(v) })
  }))
  q('billboard')?.addEventListener('change', (e) => setOrientation({ billboard: e.target.checked }))
  q('o-inherit')?.addEventListener('change', (e) => {
    if (e.target.checked) Shells.setShellOrientation(shellId, null)
    else Shells.setShellOrientation(shellId, { ...getSettings().orientation }, getSettings().orientation)
    sync()
  })
  q('name')?.addEventListener('change', (e) => { const r = Shells.renameShell(shellId, e.target.value); say(r.ok ? 'Renamed.' : r.error, !r.ok); sync() })
  q('add-node')?.addEventListener('click', () => {
    const d = { select: true }
    window.dispatchEvent(new CustomEvent('omni:terminal-shell-create-request', { detail: d }))
    const out = d.out
    say(out?.ok ? 'TerminalShellTunnel node created in front of the camera.' : (out?.error ?? 'The terminal node system is not running.'), !out?.ok)
    sync()
  })
  q('reset')?.addEventListener('click', () => { setSettings(getDefaultSettings()); say('Terminal settings reset.'); sync() })

  let wasConnected = false
  const onChange = () => {
    if (root.isConnected) wasConnected = true
    else { if (wasConnected) dispose(); return }   // not attached yet: wait; detached after being shown (the Inspector re-rendered its block): stop listening
    sync()
  }
  const names = ['omni:terminal-settings-changed', Shells.CHANGED_EVENT, Shells.STATE_EVENT]
  names.forEach(n => window.addEventListener(n, onChange))
  const dispose = () => names.forEach(n => window.removeEventListener(n, onChange))
  sync()
  return dispose
}
