/**
 * systems/OmniSceneFile.js (V236) — the `.omni.json` scene file: export the scene as JSON, check a file, import it back.
 *
 *   SERVICES.scenefile.exportFile({ name })           -> the file object (schema omni-scene/1)
 *   .exportText({ name })                             -> pretty JSON text
 *   .download({ name })                               -> saves <name>-<date>.omni.json from the browser
 *   .saveTo(path, { name })                           -> writes it into the in-browser file system (SERVICES.fs)
 *   .check(text, { mode })                            -> { ok, errors, warnings, counts, text } WITHOUT touching the scene
 *   .importText(text, { mode })                       -> checks, then loads: mode 'replace' (default, clears first) | 'merge' (adds; clashing ids renamed)
 *   .importFromPath(path, { mode }) / .pick({ mode }) -> read from the in-browser file system / open the browser's file picker
 * Event: omni:scene-file-request { action: 'export'|'import', mode }.  Emits omni:scene-file-done { action, text }.
 * Pure rules and caps: utils/OmniSceneJson.js. Nodes load through OmniNode.importScene (the same path as a page load).
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as J from '../utils/OmniSceneJson.js'

const send = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))
const rid = () => 'omni_' + Math.random().toString(36).slice(2, 8)

export default class OmniSceneFile {
  constructor (context, omniNode) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._bound = []; this._input = null }
  init () {
    SERVICES.scenefile = this
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:scene-file-request', (d) => {
      const done = (text) => send('omni:scene-file-done', { action: d.action, text }); const fail = (e) => { send('omni:notify-info', { text: 'Scene file: ' + e.message }); done('Scene file: ' + e.message) }
      try {
        if (d.action === 'export') { this.download({ name: d.name }); done('Saved') } else if (d.action === 'import') { this.pick({ mode: d.mode === 'merge' ? 'merge' : 'replace' }).then(done, fail) }
      } catch (e) { fail(e) }
    })
  }
  update () {} onResize () {}
  destroy () { for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; this._input?.remove(); this._input = null; if (SERVICES.scenefile === this) SERVICES.scenefile = null }

  _on () { if (!this.omniNode?.exportScene) throw new Error('the node system is not available'); return this.omniNode }
  _snapshot () {
    return { lineups: SERVICES.lineup?.state?.() ?? null, docwindows: SERVICES.docwindow?.list?.() ?? null, vibration: SERVICES.vibration?.customPrograms?.() ?? null }
  }
  _taken () {
    return { lineups: Object.keys(SERVICES.lineup?.state?.().lineups ?? {}), windows: (SERVICES.docwindow?.list?.() ?? []).map(w => w.id), programs: (SERVICES.vibration?.customPrograms?.() ?? []).map(p => p.id) }
  }
  exportFile ({ name = '' } = {}) { return J.buildFile(this._on().exportScene(), { name, version: this.context?.version ?? this.context?.appVersion ?? 'V253', extras: this._snapshot() }) }
  exportText (o) { return J.stringify(this.exportFile(o)) }
  download ({ name = '' } = {}) {
    const text = this.exportText({ name }), fn = J.fileName(name)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a')
    a.href = url; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000)
    return fn
  }
  saveTo (path, { name = '' } = {}) {
    const fs = SERVICES.fs; if (!fs) throw new Error('the file system is not running')
    let p = String(path || ''); if (!p) throw new Error('a path is needed'); if (!p.endsWith(J.EXT)) p += J.EXT
    fs.write(p, this.exportText({ name })); return p
  }
  check (text, { mode = 'replace' } = {}) {
    const pr = J.parse(text); if (!pr.ok) return { ok: false, errors: [pr.error], warnings: [], counts: { nodes: 0, edges: 0, kinds: {} }, summary: pr.error }
    const existing = mode === 'merge' ? this._on().exportScene().nodes.map(n => n.id) : []
    const r = J.checkFile(pr.file, { mode, existingIds: existing, genId: rid, taken: mode === 'merge' ? this._taken() : {} })
    return { ...r, summary: r.ok ? J.describe(r.counts, r.extras) : r.errors.join(' ') }
  }
  importText (text, { mode = 'replace' } = {}) {
    const r = this.check(text, { mode }); if (!r.ok) throw new Error(r.summary)
    if (!r.nodes.length) throw new Error('the file has no nodes to load')
    this._on().importScene({ nodes: r.nodes, edges: r.edges }, { mode })
    const ex = r.extras ?? {}
    try { if (ex.lineups) SERVICES.lineup?.loadState?.(ex.lineups, mode) } catch (e) { r.warnings.push('Lineups: ' + e.message) }
    try { if (ex.docwindows) SERVICES.docwindow?.loadWindows?.(ex.docwindows, mode) } catch (e) { r.warnings.push('Doc windows: ' + e.message) }
    try { if (ex.vibration) SERVICES.vibration?.loadPrograms?.(ex.vibration, mode) } catch (e) { r.warnings.push('Vibration: ' + e.message) }
    const msg = 'Loaded ' + J.describe(r.counts, r.extras) + (mode === 'merge' ? ' (added to the scene)' : ' (the scene was replaced)') + (r.warnings.length ? '\n' + r.warnings.slice(0, 8).map(w => '• ' + w).join('\n') : '')
    send('omni:notify-info', { text: 'Scene file: ' + msg.split('\n')[0] })
    return msg
  }
  importFromPath (path, o) { const fs = SERVICES.fs; if (!fs) throw new Error('the file system is not running'); return this.importText(fs.read(path), o) }
  /** Opens the browser's file picker; resolves with the same text importText returns (or rejects with a plain message). */
  pick ({ mode = 'replace' } = {}) {
    return new Promise((resolve, reject) => {
      this._input?.remove()
      const inp = this._input = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.style.display = 'none'
      inp.addEventListener('change', () => {
        const f = inp.files?.[0]; inp.remove(); this._input = null
        if (!f) return resolve('No file chosen')
        if (f.size > J.LIMITS.bytes) return reject(new Error('the file is bigger than ' + Math.round(J.LIMITS.bytes / 1048576) + ' MB'))
        const rd = new FileReader(); rd.onerror = () => reject(new Error('the file could not be read'))
        rd.onload = () => { try { resolve(this.importText(String(rd.result), { mode })) } catch (e) { reject(e) } }
        rd.readAsText(f)
      })
      document.body.appendChild(inp); inp.click()
    })
  }
}
