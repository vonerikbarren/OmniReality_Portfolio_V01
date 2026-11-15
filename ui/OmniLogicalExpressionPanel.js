/**
 * ui/OmniLogicalExpressionPanel.js (V287) — the settings of the user's LogicalExpression: tempo, intensity, teleport share, hops, reach, vibration, colour, sound;
 * Preview (opening / success), Derive from my work, Reset. Edits SERVICES.logicalexpression only. Events: omni:logical-expression-panel (toggle).
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
const FIELDS = [['tempo', 'Tempo', 0.5, 2, 0.05], ['intensity', 'Intensity', 0, 1, 0.05], ['teleport', 'Teleport steps', 0, 1, 0.05], ['hops', 'Hops', 2, 8, 1], ['reach', 'Reach', 5, 200, 5], ['vibration', 'Vibration', 0, 1, 0.05], ['hue', 'Colour', 0, 360, 5]]
const STYLES = `.olep { position: fixed; z-index: 60; right: 14px; top: 64px; width: 280px; display: none; background: rgba(255,255,255,.97); color: #111; border: 1px solid rgba(0,0,0,.25); border-radius: 10px; box-shadow: 0 6px 30px rgba(0,0,0,.3); font: 12px system-ui, sans-serif; padding: 8px 12px 12px; } .olep.is-open { display: block; }
.olep h4 { margin: 0 0 6px; font-size: 12px; letter-spacing: .06em; display: flex; justify-content: space-between; } .olep label { display: flex; align-items: center; gap: 6px; margin: 4px 0; } .olep label span { width: 96px; } .olep input[type=range] { flex: 1; } .olep button { margin: 3px 3px 0 0; font: inherit; font-size: 11px; border: 1px solid rgba(0,0,0,.3); border-radius: 6px; background: #f2f2f2; padding: 3px 8px; cursor: pointer; }`
export default class OmniLogicalExpressionPanel {
  constructor (context) { this.ctx = context; this._el = null; this._bound = []; this._inited = false }
  init () { if (this._inited) return; this._inited = true; const h = () => this.toggle(); window.addEventListener('omni:logical-expression-panel', h); this._bound.push(['omni:logical-expression-panel', h]) }
  update () {} onResize () {}
  destroy () { for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; this._el?.remove(); this._el = null }
  isOpen () { return !!this._el?.classList.contains('is-open') }
  toggle () { if (this.isOpen()) return this.close(); return this.open() }
  close () { this._el?.classList.remove('is-open') }
  open () { this._build(); this._fill(); this._el.classList.add('is-open') }
  _build () {
    if (this._el) return
    if (!document.getElementById('olep-styles')) { const s = document.createElement('style'); s.id = 'olep-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const el = document.createElement('div'); el.className = 'olep'; el.id = 'omni-logical-expression-panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'LogicalExpression')
    el.innerHTML = `<h4><b>LOGICAL EXPRESSION</b><button data-a="close" title="Close" style="margin:0">✕</button></h4>` + FIELDS.map(([k, n, lo, hi, st]) => `<label><span>${n}</span><input type="range" data-k="${k}" min="${lo}" max="${hi}" step="${st}"><output data-o="${k}"></output></label>`).join('') +
      `<label><span>Sound</span><select data-k="sound"><option>laser</option><option>soft</option><option>none</option></select></label><label><span>Calm (no flashing)</span><input type="checkbox" data-p="calm"></label><label><span>Play after the fall</span><input type="checkbox" data-p="onLanding"></label>` +
      `<div><button data-a="opening">Preview opening</button><button data-a="success">Preview success</button><button data-a="derive" title="Draw the signature from what you have built">Derive from my work</button><button data-a="reset">Reset</button></div>`
    document.body.appendChild(el); this._el = el
    el.addEventListener('input', (e) => { const t = e.target, S = SERVICES.logicalexpression; if (!S) return; if (t.dataset.k) { S.setSignature({ [t.dataset.k]: t.type === 'range' ? Number(t.value) : t.value }); this._fill() } else if (t.dataset.p) S.setPref({ [t.dataset.p]: t.checked }) })
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'), S = SERVICES.logicalexpression; if (!b || !S) return; const a = b.dataset.a
      if (a === 'close') return this.close(); if (a === 'reset') { S.reset(); return this._fill() }; if (a === 'derive') { S.derive(); return this._fill() }
      if (a === 'opening' || a === 'success') S.play({ kind: a, title: a === 'success' ? 'Preview' : undefined, card: a === 'success' })
    })
  }
  _fill () {
    const S = SERVICES.logicalexpression; if (!S || !this._el) return; const g = S.get()
    for (const [k] of FIELDS) { const i = this._el.querySelector(`[data-k="${k}"]`); if (i && document.activeElement !== i) i.value = g.signature[k]; const o = this._el.querySelector(`[data-o="${k}"]`); if (o) o.textContent = g.signature[k] }
    this._el.querySelector('[data-k="sound"]').value = g.signature.sound; for (const p of ['calm', 'onLanding']) this._el.querySelector(`[data-p="${p}"]`).checked = !!g[p]
  }
}
