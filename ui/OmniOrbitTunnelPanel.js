/**
 * ui/OmniOrbitTunnelPanel.js (V283) — the OrbitTunnel panel: settings for the horizontal and vertical OrbitTunnels, plus Enter / Exit.
 * Runtime: systems/OmniOrbitTunnels.js (SERVICES.orbitTunnels). Opens from the ribbon (omni:orbit-tunnel-panel-toggle) or omni:nav-select "OrbitTunnel".
 * Every control writes through SERVICES.orbitTunnels.set / setPrefs, which saves the user's preferences in this browser.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { colorHex, TUNNEL_REACH } from '../utils/OmniOrbitTunnelModel.js'

const STYLES = `
.oot { position: fixed; top: 70px; right: 24px; width: 340px; max-height: 84vh; display: none; flex-direction: column; z-index: 60; font: 11px 'Courier New', monospace; color: var(--omni-theme-text, rgba(255,255,255,.92)); background: var(--omni-theme-bg, rgba(8,8,12,.94)); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; backdrop-filter: blur(18px); box-shadow: 0 10px 30px rgba(0,0,0,.5); pointer-events: auto; }
.oot.is-open { display: flex; }
.oot-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.1); cursor: grab; user-select: none; }
.oot-head b { flex: 1; letter-spacing: .1em; text-transform: uppercase; font-size: 11px; }
.oot-body { overflow: auto; padding: 8px 12px 12px; }
.oot button, .oot select, .oot input[type=text], .oot input[type=number] { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.16); color: inherit; border-radius: 6px; padding: 3px 8px; font: inherit; }
.oot button { cursor: pointer; } .oot button:hover { background: rgba(255,255,255,.16); } .oot button.on { background: rgba(127,216,255,.25); border-color: #7fd8ff; }
.oot-tabs { display: flex; gap: 6px; margin: 4px 0 8px; } .oot-tabs button { flex: 1; }
.oot h4 { margin: 10px 0 4px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; opacity: .7; }
.oot-row { display: flex; align-items: center; gap: 6px; margin: 3px 0; } .oot-row label { flex: 0 0 104px; opacity: .8; } .oot-row input[type=range] { flex: 1; min-width: 0; } .oot-row input[type=number], .oot-row input[type=text], .oot-row select { flex: 1; min-width: 0; width: 0; }
.oot-row input[type=number] { max-width: 78px; flex: 0 0 78px; }
.oot-note { opacity: .6; line-height: 1.5; margin: 4px 0; font-size: 10px; }
.oot-status { margin: 6px 0; padding: 5px 8px; border-radius: 6px; background: rgba(255,255,255,.06); }
.oot-btns { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0; }
`
const FIELDS = [
  ['h', 'Look'],
  ['check', 'Visible', 'visible'], ['sel', 'Style', 'mode', [['wire', 'Wireframe'], ['solid', 'Solid (shows image / video)']]], ['color', 'Colour', 'color'], ['range', 'Opacity', 'opacity', 0.02, 1, 0.01],
  ['h', 'Scale'],
  ['num', 'Ring radius', 'radius', 200, 60000, 100], ['num', 'Tube width', 'tube', 20, 20000, 10], ['num', 'Turn (vertical)', 'yaw', -180, 180, 5, 'vertical'], ['btn', 'Reach of the regular tunnels', 'resetSize'],
  ['h', 'Image or video on the inner wall'],
  ['sel', 'Media', 'media.kind', [['none', 'None'], ['image', 'Image'], ['video', 'Video']]], ['text', 'Link (https)', 'media.url'], ['file', 'Or pick a file'], ['num', 'Repeat along', 'media.repeatU', 0.25, 400, 1], ['num', 'Repeat round', 'media.repeatV', 0.25, 400, 1],
  ['h', 'Particles'],
  ['check', 'Particles flow', 'particles.on'], ['num', 'Particle speed ×', 'particles.speed', 0, 50, 0.1], ['num', 'Particle count', 'particles.count', 0, 1200, 20],
  ['h', 'orbitTraversal (your ride)'],
  ['num', 'Your speed', 'traversal.speed', 0, 40000, 100], ['num', 'Roll round wall °/s', 'traversal.roll', -720, 720, 5], ['num', 'Wall distance', 'traversal.inset', 0.1, 0.95, 0.05],
]
const GLOBALS = [['num', 'Loops (laps each)', 'loops', 1, 99, 1], ['sel', 'Direction', 'direction', [[1, 'Forward'], [-1, 'Backward']]], ['check', 'Auto enter when I reach a tube', 'autoEnter'], ['check', 'Fly back when finished', 'returnWhenDone']]
const dig = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o)
const nest = (path, v) => path.split('.').reduceRight((acc, k) => ({ [k]: acc }), v)

export default class OmniOrbitTunnelPanel {
  constructor (context) { this.ctx = context; this._el = null; this._open = false; this._bound = []; this._sel = 'horizontal'; this._st = {} }
  get svc () { return SERVICES.orbitTunnels }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, f) => { window.addEventListener(n, f); this._bound.push([n, f]) }
    on('omni:orbit-tunnel-panel-toggle', () => this.toggle())
    on('omni:nav-select', (e) => { if (e.detail?.item === 'OrbitTunnel') this.open() })
    on('omni:orbit-tunnel-changed', (e) => { this._st = e.detail?.ride ?? {}; if (this._open) this._sync(e.detail?.prefs) })
    SERVICES.orbitPanel = this
  }
  update () {} onResize () {}
  destroy () { for (const [n, f] of this._bound) window.removeEventListener(n, f); this._bound = []; this._el?.remove(); this._el = null; if (SERVICES.orbitPanel === this) delete SERVICES.orbitPanel }
  open () { this._build(); this._open = true; this._el.classList.add('is-open'); this._sel = this.svc?.prefs().selected ?? 'horizontal'; this._render() }
  close () { this._open = false; this._el?.classList.remove('is-open') }
  toggle () { this._open ? this.close() : this.open() }

  _build () {
    if (this._el) return
    if (!document.getElementById('oot-styles')) { const s = document.createElement('style'); s.id = 'oot-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const el = document.createElement('div'); el.className = 'oot'; el.setAttribute('data-omni-panel', 'orbit-tunnel')
    el.innerHTML = '<div class="oot-head"><b>◯ OrbitTunnel</b><button data-x="close" title="Close">✕</button></div><div class="oot-body"></div>'
    document.body.appendChild(el); this._el = el
    el.querySelector('[data-x=close]').addEventListener('click', () => this.close())
    const head = el.querySelector('.oot-head'); let drag = null
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; const r = el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; head.setPointerCapture?.(e.pointerId) })
    head.addEventListener('pointermove', (e) => { if (!drag) return; el.style.left = Math.max(0, e.clientX - drag.dx) + 'px'; el.style.top = Math.max(0, e.clientY - drag.dy) + 'px'; el.style.right = 'auto' })
    head.addEventListener('pointerup', () => { drag = null })
  }

  _control (f, v, set, id) {
    const [kind, label, key, a, b, c] = f; const row = document.createElement('div'); row.className = 'oot-row'
    const lab = document.createElement('label'); lab.textContent = label; if (kind !== 'btn' && kind !== 'file') row.appendChild(lab)
    let inp
    if (kind === 'check') { inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!v; inp.onchange = () => set(key, inp.checked) }
    else if (kind === 'sel') { inp = document.createElement('select'); for (const [val, txt] of a) { const o = document.createElement('option'); o.value = String(val); o.textContent = txt; inp.appendChild(o) } inp.value = String(v); inp.onchange = () => set(key, typeof a[0][0] === 'number' ? Number(inp.value) : inp.value) }
    else if (kind === 'color') { inp = document.createElement('input'); inp.type = 'color'; inp.value = colorHex(v); inp.oninput = () => set(key, inp.value) }
    else if (kind === 'text') { inp = document.createElement('input'); inp.type = 'text'; inp.value = v ?? ''; inp.placeholder = 'https://…'; inp.onchange = () => set(key, inp.value.trim()) }
    else if (kind === 'btn') { inp = document.createElement('button'); inp.textContent = label; inp.onclick = () => this.svc?.[key]?.(id); row.appendChild(inp); return row }
    else if (kind === 'file') {
      inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,video/*'; inp.style.display = 'none'
      const bt = document.createElement('button'); bt.textContent = label + '…'; bt.onclick = () => inp.click(); const cl = document.createElement('button'); cl.textContent = 'Clear file'; cl.onclick = () => this.svc?.clearLocalMedia(id)
      inp.onchange = () => { if (inp.files?.[0]) this.svc?.setLocalMedia(id, inp.files[0]); this._render() }; row.append(bt, cl, inp); return row
    } else {
      inp = document.createElement('input'); inp.type = 'number'; inp.min = a; inp.max = b; inp.step = c; inp.value = v; inp.onchange = () => { const n = Number(inp.value); if (Number.isFinite(n)) set(key, n) }
      if (kind === 'range') { inp.type = 'range'; inp.oninput = () => set(key, Number(inp.value)); inp.style.maxWidth = 'none'; inp.style.flex = '1' }
    }
    inp.dataset.key = key; row.appendChild(inp); return row
  }

  _render () {
    const svc = this.svc; const body = this._el?.querySelector('.oot-body'); if (!body) return
    if (!svc) { body.innerHTML = '<div class="oot-note">The OrbitTunnel system is not running.</div>'; return }
    const prefs = svc.prefs(); const id = this._sel; const spec = prefs.tunnels[id]; body.innerHTML = ''
    const add = (n) => body.appendChild(n)
    const tabs = document.createElement('div'); tabs.className = 'oot-tabs'
    for (const t of ['horizontal', 'vertical']) { const b = document.createElement('button'); b.textContent = (t === 'horizontal' ? '⬭ Horizontal' : '⬯ Vertical'); if (t === id) b.className = 'on'; b.onclick = () => { this._sel = t; svc.setPrefs({ selected: t }); this._render() }; tabs.appendChild(b) }
    add(tabs)
    const st = document.createElement('div'); st.className = 'oot-status'; st.dataset.role = 'status'; st.textContent = svc.state().text; add(st)
    const btns = document.createElement('div'); btns.className = 'oot-btns'
    const mk = (txt, fn, cls = '') => { const b = document.createElement('button'); b.textContent = txt; b.className = cls; b.onclick = fn; btns.appendChild(b); return b }
    mk('Enter ' + id, () => svc.enter(id)); mk('Exit', () => svc.exit()); mk('Pause / go', () => { svc.pause() })
    add(btns)
    const en = this._control(['check', 'Takes part in the ride', 'enabled'], prefs.enabled[id], (_k, v) => svc.setPrefs({ enabled: { [id]: v } }), id); add(en)
    add(Object.assign(document.createElement('div'), { className: 'oot-note', textContent: 'The tunnel you enter first is ridden first, for the number of loops below. Then the other one, if it has its tick. Then you fly back. Esc leaves at any time.' }))
    for (const f of GLOBALS) add(this._control(f, prefs[f[2]], (k, v) => svc.setPrefs({ [k]: v }), id))
    for (const f of FIELDS) {
      if (f[0] === 'h') { const h = document.createElement('h4'); h.textContent = f[1]; add(h); continue }
      if (f[6] && f[6] !== id) continue
      add(this._control(f, dig(spec, f[2] || ''), (k, v) => svc.set(id, nest(k, v)), id))
    }
    add(Object.assign(document.createElement('div'), { className: 'oot-note', textContent: `Default size: ring radius ${TUNNEL_REACH}, the far end of the longest regular tunnel. A file you pick is kept for this session only; a link is saved. Image and video show in Solid style. Settings are saved in this browser.` }))
    const rs = document.createElement('button'); rs.textContent = 'Reset this tunnel to defaults'; rs.onclick = () => { svc.reset(id); this._render() }; add(rs)
  }
  _sync (prefs) {
    const st = this._el?.querySelector('[data-role=status]'); if (st) st.textContent = this._st?.text ?? 'Not riding'
    void prefs
  }
}
