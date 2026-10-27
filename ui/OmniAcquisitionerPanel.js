/**
 * ui/OmniAcquisitionerPanel.js — ⟐OmniNodeAcquisitioner (V223): a vertical panel split in half.
 *   LEFT   the Tetris stack of what has arrived in one tunnel: pieces settle onto a 4-wide board from the bottom (node = 2 wide, text by length).
 *          Each piece shows its symbol (◆ node, ¶ text) and is zipped: you see only its symbol, label and sender.
 *   RIGHT  the mini inspector / interpreter: pick a piece to read its summary; Decipher unzips it (its contents), Re-zip folds it up again.
 *          Acquire puts it in the space, Forward routes it to another tunnel, Pin keeps it from being dropped, Drop removes it.
 *   TOP    choose the tunnel; Receive opens or closes it (OFF by default: a tunnel is a field the owner opens), Mute, the allow list, the cap.
 *   BOTTOM send the selected scene node, or a line of text, to a tunnel.
 * Reads / writes Extra.SERVICES.communication only. Opened by omni:nav-select '⟐OmniNodeAcquisitioner' (ribbon, OmniStarLight) or omni:acquisitioner-open { tunnel }.
 * Not the OmniDraw ticker inspector (ui/OmniCommunicationPanel.js), which is a different thing.
 */
import gsap from 'gsap'
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as M from '../utils/OmniCommModel.js'

export const NAV_ITEM = '⟐OmniNodeAcquisitioner'
export const PANEL_ID = 'omnifielder'
const ROW_H = 30
const STYLES = `
.oss-panel.oacq-panel, .oss-panel.oacq-panel.is-wide { width: 440px; max-width: calc(100vw - 16px); max-height: calc(100vh - 100px); }
.oacq-top { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
.oacq-top .oss-select { min-width: 0; } .oacq-top label { display: flex; gap: 3px; align-items: center; }
.oacq-split { display: flex; gap: 8px; }
.oacq-half { flex: 1 1 50%; min-width: 0; }
.oacq-board { position: relative; height: ${ROW_H * M.DEFAULT_CAP / 2 + 6}px; border: 1px solid rgba(255,255,255,.18); border-radius: 8px; background: repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 ${ROW_H - 1}px, transparent ${ROW_H - 1}px ${ROW_H}px); overflow: hidden; }
.oacq-piece { position: absolute; box-sizing: border-box; padding: 2px 5px; border-radius: 5px; border: 1px solid rgba(255,255,255,.55); cursor: pointer; font-size: 10px; line-height: 1.2; overflow: hidden; color: #fff; display: flex; gap: 4px; align-items: center; touch-action: manipulation; }
.oacq-piece .sym { font-size: 13px; flex: 0 0 auto; } .oacq-piece .lb { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oacq-piece.is-sel { outline: 2px solid #fff; z-index: 2; } .oacq-piece.is-pin { border-style: double; border-width: 3px; }
.oacq-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 8px; opacity: .6; font-size: 10px; }
.oacq-info { min-height: ${ROW_H * M.DEFAULT_CAP / 2 + 6}px; border: 1px solid rgba(255,255,255,.18); border-radius: 8px; padding: 6px; font-size: 10px; line-height: 1.45; overflow: auto; max-height: ${ROW_H * M.DEFAULT_CAP / 2 + 6}px; }
.oacq-info h4 { margin: 0 0 4px; font-size: 11px; } .oacq-info pre { margin: 4px 0; white-space: pre-wrap; word-break: break-word; font: inherit; background: rgba(255,255,255,.07); padding: 4px; border-radius: 4px; }
.oacq-info .zip { opacity: .65; font-style: italic; }
.oacq-acts { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; } .oacq-acts .oss-btn { min-height: 24px; padding: 1px 6px; }
.oacq-send { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; } .oacq-send .oss-input { flex: 1 1 120px; width: auto; min-width: 0; }
.oacq-cnt { margin-left: auto; opacity: .8; }
@media (max-width: ${PHONE_MAX}px) { .oss-panel.oacq-panel, .oss-panel.oacq-panel.is-wide { width: 100%; } .oacq-split { flex-direction: column; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oacq-styles')) return
  const s = document.createElement('style'); s.id = 'oacq-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e }

export default class OmniAcquisitionerPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐▤', navItems: [NAV_ITEM], className: 'oacq-panel', wide: true })
    this.tunnel = 'lh'; this.selId = null; this._els = {}; this._evs = []; this._known = new Set(); this._selNode = null
  }
  get comm () { return SERVICES.communication }
  onInit () {
    injectStyles()
    const on = (t, fn) => { window.addEventListener(t, fn); this._evs.push([t, fn]) }
    on('omni:comm-changed', () => { if (this.isOpen) this.refresh() })
    on('omni:acquisitioner-open', (e) => { if (M.isTunnel(e.detail?.tunnel)) this.tunnel = e.detail.tunnel; this.open() })
    on('omni:node-selected', (e) => { this._selNode = e.detail?.node?.id ?? e.detail?.mesh?.userData?.nodeId ?? null })
    on('omni:node-deselected', () => { this._selNode = null })
  }
  onDestroy () { for (const [t, f] of this._evs) window.removeEventListener(t, f); this._evs = [] }
  onOpened () { this._known = new Set(this.comm?.inbox(this.tunnel).map(p => p.id) ?? []); this.refresh() }

  buildBody (body) {
    body.innerHTML = `
      <div class="oacq-top">
        <select class="oss-select" data-r="tunnel" aria-label="Tunnel"></select>
        <label><input type="checkbox" data-r="open"> Receive</label>
        <label><input type="checkbox" data-r="mute"> Mute</label>
        <span class="oacq-cnt" data-r="count"></span>
      </div>
      <div class="oacq-top"><label>Allow <input class="oss-input" data-r="allow" style="width:150px" placeholder="* or user, lh, rh ..." aria-label="Allow list"></label>
        <label>Cap <input class="oss-input" type="number" min="1" max="${M.MAX_CAP}" data-r="cap" style="width:52px"></label>
        <button type="button" class="oss-btn" data-a="clear">Clear</button></div>
      <div class="oacq-split">
        <div class="oacq-half"><div class="oacq-board" data-r="board" role="list" aria-label="Arrived pieces"></div></div>
        <div class="oacq-half"><div class="oacq-info" data-r="info" aria-live="polite"></div></div>
      </div>
      <div class="oacq-send">
        <select class="oss-select" data-r="sendto" aria-label="Send to"></select>
        <button type="button" class="oss-btn" data-a="sendnode" title="Send the node you have selected">Send selected node</button>
        <input class="oss-input" data-r="text" placeholder="a short message" maxlength="${M.MAX_TEXT}" aria-label="Message">
        <button type="button" class="oss-btn" data-a="sendtext">Send</button></div>
      <div class="oss-msg oss-dim" data-r="msg"></div>`
    const q = (r) => body.querySelector(`[data-r="${r}"]`)
    this._els = { tunnel: q('tunnel'), open: q('open'), mute: q('mute'), count: q('count'), allow: q('allow'), cap: q('cap'), board: q('board'), info: q('info'), sendto: q('sendto'), text: q('text'), msg: q('msg') }
    for (const sel of [this._els.tunnel, this._els.sendto]) M.TUNNELS.forEach(t => { const o = el('option', null, M.TUNNEL_NAMES[t]); o.value = t; sel.appendChild(o) })
    this._els.tunnel.addEventListener('change', () => { this.tunnel = this._els.tunnel.value; this.selId = null; this._known = new Set(this.comm?.inbox(this.tunnel).map(p => p.id) ?? []); this.refresh() })
    this._els.open.addEventListener('change', () => this._try(() => this.comm.setReceive(this.tunnel, this._els.open.checked)))
    this._els.mute.addEventListener('change', () => this._try(() => this.comm.setMuted(this.tunnel, this._els.mute.checked)))
    this._els.allow.addEventListener('change', () => this._try(() => this.comm.setAllow(this.tunnel, this._els.allow.value.split(/[,\s]+/).filter(Boolean))))
    this._els.cap.addEventListener('change', () => this._try(() => this.comm.setCap(this.tunnel, this._els.cap.value)))
    body.addEventListener('click', (e) => {
      const piece = e.target.closest('.oacq-piece'); if (piece) { this.selId = piece.dataset.id; this.refresh(); return }
      const b = e.target.closest('[data-a]'); if (b) this._act(b.dataset.a, b)
    })
    body.addEventListener('keydown', (e) => e.stopPropagation()); body.addEventListener('keyup', (e) => e.stopPropagation())
  }

  _say (msg, err = false) { const m = this._els.msg; if (!m) return; m.textContent = msg; m.className = 'oss-msg ' + (err ? 'is-err' : 'is-ok') }
  _try (fn) { try { return fn() } catch (e) { this._say(e.message, true) } }
  _sel () { return this.selId ? this.comm?.get(this.tunnel, this.selId) : null }

  _act (a, btn) {
    const c = this.comm; if (!c) return this._say('Communication is not running', true)
    const sel = this._sel()
    if (a === 'clear') { const n = c.clear(this.tunnel); this._say(`Cleared ${n} piece${n === 1 ? '' : 's'} (pinned ones stay)`); return }
    if (a === 'sendnode') { if (!this._selNode) return this._say('Select a node in the space first', true); const r = c.send({ to: this._els.sendto.value, node: this._selNode }); this._say(r.ok ? 'Sent.' : r.error, !r.ok); return }
    if (a === 'sendtext') { const t = this._els.text.value.trim(); if (!t) return this._say('Type a message first', true); const r = c.send({ to: this._els.sendto.value, text: t }); if (r.ok) this._els.text.value = ''; this._say(r.ok ? 'Sent.' : r.error, !r.ok); return }
    if (!sel) return this._say('Pick a piece first', true)
    if (a === 'decipher') c.decipher(this.tunnel, sel.id, sel.state !== 'deciphered')
    else if (a === 'pin') c.pin(this.tunnel, sel.id, !sel.pinned)
    else if (a === 'drop') { c.drop(this.tunnel, sel.id); this.selId = null }
    else if (a === 'acquire') { const r = c.acquire(this.tunnel, sel.id); this._say(r.ok ? 'Placed in the space in front of you.' : r.error, !r.ok); if (r.ok) this.selId = null }
    else if (a === 'forward') { const to = this._els.info.querySelector('[data-r="fwd"]')?.value; const r = c.route({ id: sel.id, from: this.tunnel, to }); this._say(r.ok ? `Forwarded to ${M.TUNNEL_NAMES[to]}.` : r.error, !r.ok); if (r.ok) this.selId = null }
  }

  refresh () {
    const c = this.comm, E = this._els; if (!E.board) return
    if (!c) { E.board.textContent = ''; E.board.appendChild(el('div', 'oacq-empty', 'Communication is not running.')); return }
    E.tunnel.value = this.tunnel; const cfg = c.config(this.tunnel), list = c.inbox(this.tunnel)
    E.open.checked = cfg.open; E.mute.checked = cfg.muted; E.cap.value = cfg.cap
    if (document.activeElement !== E.allow) E.allow.value = cfg.allow.join(', ')
    E.count.textContent = `${list.length} / ${cfg.cap}`
    if (this.selId && !list.some(p => p.id === this.selId)) this.selId = null
    this._renderBoard(list, cfg); this._renderInfo(list)
  }
  _renderBoard (list, cfg) {
    const board = this._els.board; board.textContent = ''
    const W = board.clientWidth || 190, H = board.clientHeight || ROW_H * 6, cw = W / M.COLS
    if (!list.length) { board.appendChild(el('div', 'oacq-empty', cfg.open ? 'Nothing here yet. Pieces that arrive settle at the bottom.' : 'This tunnel is closed. Tick Receive to let things in.')); return }
    const pos = M.packPieces(list), byId = new Map(list.map(p => [p.id, p]))
    for (const s of pos) {
      const p = byId.get(s.id), d = el('div', 'oacq-piece' + (p.id === this.selId ? ' is-sel' : '') + (p.pinned ? ' is-pin' : ''))
      d.dataset.id = p.id; d.setAttribute('role', 'listitem'); d.title = `${p.label} · from ${p.from}${p.via.length ? ' via ' + p.via.join(', ') : ''}`
      d.style.cssText = `left:${s.col * cw + 1}px;width:${s.w * cw - 2}px;height:${ROW_H - 2}px;bottom:${s.row * ROW_H + 1}px;background:hsla(${M.pieceHue(p)},55%,38%,.9)`
      d.append(el('span', 'sym', M.pieceSymbol(p)), el('span', 'lb', p.label)); board.appendChild(d)
      if (!this._known.has(p.id)) { this._known.add(p.id); if (!cfg.muted && typeof gsap?.from === 'function') gsap.from(d, { y: -(H + 20), duration: 0.45, ease: 'bounce.out' }) }
    }
  }
  _renderInfo (list) {
    const info = this._els.info; info.textContent = ''
    const p = this._sel()
    if (!p) { info.appendChild(el('div', 'zip', list.length ? 'Pick a piece on the left. It is zipped: you see only what it is and who sent it.' : 'This is the interpreter. Arrivals appear on the left; pick one to inspect it.')); return }
    info.appendChild(el('h4', null, `${M.pieceSymbol(p)} ${p.label}`))
    const rows = [['Kind', p.kind === 'node' ? 'node' : 'message'], ['From', p.from], ['Last sender', p.sender], ['Route', [p.from, ...p.via, p.to].join(' → ')], ['Arrived', new Date(p.at).toLocaleTimeString()], ['State', p.state]]
    rows.forEach(([k, v]) => info.appendChild(el('div', null, `${k}: ${v}`)))
    if (p.state === 'deciphered') {
      const body = p.kind === 'node' ? `shape: ${p.node.geometry.replace('Geometry', '')}\ncolour: ${p.node.color}\nscale: ${p.node.scale.join(', ')}\nrotation: ${p.node.rotation.join(', ')}` : p.text
      const pre = el('pre'); pre.textContent = body; info.appendChild(pre)
    } else info.appendChild(el('div', 'zip', 'Zipped. Decipher to read it.'))
    const acts = el('div', 'oacq-acts')
    const mk = (a, t) => { const b = el('button', 'oss-btn', t); b.type = 'button'; b.dataset.a = a; acts.appendChild(b) }
    mk('decipher', p.state === 'deciphered' ? 'Re-zip' : 'Decipher'); mk('acquire', 'Acquire'); mk('pin', p.pinned ? 'Unpin' : 'Pin'); mk('drop', 'Drop')
    const fwd = el('select', 'oss-select'); fwd.dataset.r = 'fwd'; M.TUNNELS.filter(t => t !== this.tunnel).forEach(t => { const o = el('option', null, M.TUNNEL_NAMES[t]); o.value = t; fwd.appendChild(o) })
    acts.appendChild(fwd); mk('forward', 'Forward'); info.appendChild(acts)
  }
}
