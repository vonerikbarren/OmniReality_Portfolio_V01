/**
 * systems/OmniFileSystem.js (V219) — the module that owns the OmniTerminal's file system (utils/OmniVFS.js) and registers the Omni language's built-ins.
 * Registers Extra.SERVICES.fs once its saved tree has loaded (fs.ready is the promise). Events out: omni:fs-changed { path }.
 * Module contract: constructor(context) / init / update / destroy / onResize.
 */
import OmniVFS, { createDefaultAdapter } from '../utils/OmniVFS.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { registerOmniBuiltins } from './OmniLangCommands.js'

export default class OmniFileSystem {
  constructor (context, { adapter = null } = {}) { this.ctx = context; this._adapter = adapter; this.vfs = null; this.ready = null; this._inited = false }
  init () {
    if (this._inited) return; this._inited = true
    registerOmniBuiltins()
    this.vfs = new OmniVFS({ adapter: this._adapter ?? createDefaultAdapter(), onChange: (path) => { try { window.dispatchEvent(new CustomEvent('omni:fs-changed', { detail: { path } })) } catch (_) {} } })
    SERVICES.fs = this.vfs     // usable at once; the saved tree arrives a moment later (commands wait on ready)
    this.ready = this.vfs.init().then(() => { try { window.dispatchEvent(new CustomEvent('omni:fs-changed', { detail: { path: '/' } })) } catch (_) {} return this.vfs })
  }
  update () {}
  onResize () {}
  destroy () { this.vfs?.flush?.(); if (SERVICES.fs === this.vfs) SERVICES.fs = null; this._inited = false }
}
