/**
 * ui/OmniFlashUI.js (V269) — the Flashcards node's two panels, built here (DOM only; everything goes through SERVICES.flash):
 *   STUDY BAR   docked at the bottom: Prev · Flip · Again · Got it · Next · Restart/Shuffle · ♪ · ✕.   Keys while it is open: Space flip · 1 again · 2 got it · [ prev · ] next
 *   EDITOR      a side panel: deck title, "read aloud", the card list (add / delete / move), each side's text + picture + sound clip, Export JSON / CSV, Import.
 * Pictures are shrunk to fit (max 480 px, JPEG) and sounds must be short (<= 150 KB) so a deck always fits the browser's storage.
 *   SERVICES.flashui: openStudy(id) closeStudy() openEditor(id) closeEditor() isStudying() isEditing()      Events in: omni:flash-ui-request { action: 'study'|'edit'|'close', id }
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { LIMITS } from '../utils/OmniFlashcardModel.js'

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const STYLES = `
.ofl-bar { position: fixed; z-index: 10035; left: 50%; transform: translateX(-50%); bottom: calc(var(--omni-dock-stack-h, 52px) + 8px); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; max-width: 96vw; padding: 6px 10px; background: var(--omni-theme-bg, rgba(14,18,28,.95)); color: var(--omni-theme-text, #eaf1ff); border: 1px solid var(--omni-theme-border, rgba(127,214,162,.6)); border-radius: 10px; font: 12px var(--omni-theme-font, system-ui, sans-serif); box-shadow: 0 4px 18px rgba(0,0,0,.45); }
.ofl-bar button, .ofl-ed button, .ofl-ed select, .ofl-ed input, .ofl-ed textarea { font: inherit; color: inherit; background: var(--omni-theme-input-bg, rgba(255,255,255,.08)); border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,.22)); border-radius: 6px; padding: 5px 9px; min-height: 30px; cursor: pointer; }
.ofl-bar button:hover, .ofl-ed button:hover { color-mix(in srgb, var(--omni-theme-accent, #7fd6a2) 28%, transparent); }
.ofl-bar .ofl-got { border-color: rgba(120,220,160,.8); } .ofl-bar .ofl-again { border-color: rgba(255,170,100,.8); }
.ofl-bar .ofl-info { opacity: .8; min-width: 110px; text-align: center; }
.ofl-ed { position: fixed; z-index: 10034; right: 8px; top: calc(var(--omni-top-offset, 48px) + 8px); bottom: calc(var(--omni-dock-stack-h, 52px) + 8px); width: min(360px, 96vw); overflow-y: auto; padding: 8px 10px; background: var(--omni-theme-bg, rgba(14,18,28,.95)); color: var(--omni-theme-text, #eaf1ff); border: 1px solid var(--omni-theme-border, rgba(127,214,162,.5)); border-radius: 10px; font: 12px var(--omni-theme-font, system-ui, sans-serif); box-shadow: 0 4px 18px rgba(0,0,0,.45); }
.ofl-ed h4 { margin: 8px 0 4px; color: var(--omni-theme-accent, #7fd6a2); font-size: 12px; } .ofl-ed .ofl-row { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin: 4px 0; }
.ofl-ed textarea, .ofl-ed input[type=text] { width: 100%; cursor: text; box-sizing: border-box; } .ofl-ed textarea { min-height: 54px; resize: vertical; }
.ofl-list { max-height: 150px; overflow-y: auto; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.15)); border-radius: 6px; }
.ofl-list button { display: block; width: 100%; text-align: left; border: 0; border-radius: 0; background: transparent; min-height: 26px; padding: 3px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ofl-list button.on { background: color-mix(in srgb, var(--omni-theme-accent, #7fd6a2) 30%, transparent); }
.ofl-ed img.ofl-thumb { max-width: 96px; max-height: 64px; border-radius: 4px; vertical-align: middle; }
.ofl-msg { font-size: 10.5px; opacity: .85; min-height: 14px; }
@media (pointer: coarse) { .ofl-bar button, .ofl-ed button, .ofl-ed select, .ofl-ed input { min-height: 44px; } }
`
const readAsDataURL = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(new Error('The file could not be read.')); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file) })
async function shrinkImage (file) {
  const url = await readAsDataURL(file); if (!/^data:image\//.test(url)) throw new Error('That is not a picture.')
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('That picture could not be opened.')); i.src = url })
  for (const [max, q] of [[480, 0.8], [360, 0.65], [260, 0.55], [180, 0.5]]) {
    const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s))
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
    const out = c.toDataURL('image/jpeg', q); if (out.length <= LIMITS.img) return out
  }
  throw new Error('That picture is too detailed to shrink small enough.')
}
function download (name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }

export default class OmniFlashUI {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._bar = null; this._ed = null; this._sid = null; this._eid = null; this._card = null; this._bound = []; this._inited = false; this._msg = '' }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:flash-ui-request', (d) => { try { if (d.action === 'study') this.openStudy(d.id); else if (d.action === 'edit') this.openEditor(d.id); else { this.closeStudy(); this.closeEditor() } } catch (_) { /* not a deck */ } })
    on('omni:flash-changed', (d) => { if (d.nodeId === this._sid) this._refreshBar(); if (d.nodeId === this._eid && d.reason !== 'typing') this._renderEditor() })
    on('omni:node-deleted', (d) => { if (d.id === this._sid) this.closeStudy(); if (d.id === this._eid) this.closeEditor() }); on('omni:scene-clear-request', () => { this.closeStudy(); this.closeEditor() })
    this._key = (e) => this._onKey(e); document.addEventListener('keydown', this._key, true); SERVICES.flashui = this
  }
  destroy () { this.closeStudy(); this.closeEditor(); try { document.removeEventListener('keydown', this._key, true) } catch (_) { /* gone */ } for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.flashui === this) SERVICES.flashui = null; this._inited = false }
  update () {} onResize () {}
  isStudying () { return !!this._bar } isEditing () { return !!this._ed }
  _svc () { if (!SERVICES.flash) throw new Error('the flashcards module is not running'); return SERVICES.flash }
  _styles () { if (!document.getElementById('ofl-style')) { const s = document.createElement('style'); s.id = 'ofl-style'; s.textContent = STYLES; document.head.appendChild(s) } }

  // ── study bar ──
  openStudy (id) {
    const f = this._svc(); if (!f.isFlashNode(id)) throw new Error('That is not a flashcards node.')
    this.closeStudy(); this._styles(); this._sid = id
    const bar = document.createElement('div'); bar.className = 'ofl-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Flashcards study')
    bar.innerHTML = `<button data-a="prev" title="Previous card ([)">◀</button><button data-a="flip" title="Flip (Space)">⟲ Flip</button><button data-a="again" class="ofl-again" title="Again (1): it comes round once more">✗ Again</button><button data-a="got" class="ofl-got" title="Got it (2): out of this round">✓ Got it</button><button data-a="next" title="Next card (])">▶</button><span class="ofl-info" role="status" aria-live="polite"></span><button data-a="play" title="Play / speak this side">♪</button><button data-a="restart" title="Start the round again">↺ Restart</button><button data-a="shuffle" title="Start again in a new order">⇌</button><button data-a="close" title="Close">✕</button>`
    bar.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; this._act(b.dataset.a) })
    document.body.appendChild(bar); this._bar = bar; this._refreshBar(); return true
  }
  closeStudy () { this._bar?.remove(); this._bar = null; this._sid = null; try { SERVICES.flash?.stopAudio() } catch (_) { /* none */ } }
  _act (a) {
    const f = this._svc(), id = this._sid; if (!id) return
    try {
      switch (a) {
        case 'flip': f.flip(id); break; case 'next': f.next(id); break; case 'prev': f.prev(id); break; case 'got': f.mark(id, 'got'); break; case 'again': f.mark(id, 'again'); break
        case 'restart': f.restart(id, false); break; case 'shuffle': f.restart(id, true); break; case 'play': f.play(id, true); break; case 'close': this.closeStudy(); break
      }
    } catch (err) { this._msg = String(err?.message ?? err) }
    this._refreshBar()
  }
  _refreshBar () {
    if (!this._bar || !this._sid) return; let p; try { p = this._svc().progress(this._sid) } catch (_) { this.closeStudy(); return }
    this._bar.querySelector('.ofl-info').textContent = !p.total ? 'Empty deck' : p.done ? `Round done · got ${p.got} · again ${p.again}` : `${p.left} left · got ${p.got} · again ${p.again} · ${p.side}`
    for (const a of ['flip', 'again', 'got', 'next', 'prev', 'play']) { const b = this._bar.querySelector(`[data-a=${a}]`); if (b) b.disabled = !p.left }
  }
  _onKey (e) {
    if (!this._bar || e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
    const map = { ' ': 'flip', '1': 'again', '2': 'got', '[': 'prev', ']': 'next' }; const a = map[e.key]; if (!a) return
    e.preventDefault(); e.stopPropagation(); this._act(a)
  }

  // ── editor ──
  openEditor (id) {
    const f = this._svc(); if (!f.isFlashNode(id)) throw new Error('That is not a flashcards node.')
    this._styles(); this._eid = id; if (!this._ed) { const ed = document.createElement('div'); ed.className = 'ofl-ed'; ed.setAttribute('role', 'dialog'); ed.setAttribute('aria-label', 'Flashcards editor'); this._wire(ed); document.body.appendChild(ed); this._ed = ed }
    const k = f.getDeck(id); if (!k.cards.some(c => c.id === this._card)) this._card = k.cards[0]?.id ?? null
    this._renderEditor(); return true
  }
  closeEditor () { this._ed?.remove(); this._ed = null; this._eid = null; this._card = null }
  _say (t) { this._msg = t || ''; const m = this._ed?.querySelector('.ofl-msg'); if (m) m.textContent = this._msg }
  _sideHTML (name, s) {
    return `<h4>${name}</h4><textarea data-f="${name}-text" maxlength="${LIMITS.text}" placeholder="${name} text" aria-label="${name} text">${esc(s.text)}</textarea>
<div class="ofl-row">${s.img ? `<img class="ofl-thumb" src="${esc(s.img)}" alt=""><button data-a="rm-${name}-img">Remove picture</button>` : `<label>Picture <input type="file" accept="image/*" data-f="${name}-img"></label>`}</div>
<div class="ofl-row">${s.snd ? `<span>♪ sound clip</span><button data-a="play-${name}">Play</button><button data-a="rm-${name}-snd">Remove</button>` : `<label>Sound <input type="file" accept="audio/*" data-f="${name}-snd"></label>`}</div>`
  }
  _renderEditor () {
    if (!this._ed || !this._eid) return; const f = SERVICES.flash; const k = f?.getDeck(this._eid); if (!k) { this.closeEditor(); return }
    const keepScroll = this._ed.scrollTop; const c = k.cards.find(x => x.id === this._card) ?? null
    this._ed.innerHTML = `<div class="ofl-row"><b style="color: var(--omni-theme-accent, #7fd6a2);flex:1">Flashcards editor</b><button data-a="study" title="Study this deck">▶ Study</button><button data-a="done">✕</button></div>
<input type="text" data-f="title" maxlength="${LIMITS.title}" value="${esc(k.title)}" aria-label="Deck title">
<div class="ofl-row"><label><input type="checkbox" data-f="speak" ${k.speak ? 'checked' : ''}> Read aloud when a side appears</label></div>
<h4>Cards (${k.cards.length})</h4><div class="ofl-list" role="listbox">${k.cards.map((x, i) => `<button role="option" data-card="${esc(x.id)}" class="${x.id === this._card ? 'on' : ''}">${i + 1}. ${esc(x.front.text || (x.front.img ? '(picture)' : '(empty)'))}</button>`).join('') || '<div style="padding:6px;opacity:.7">No cards yet</div>'}</div>
<div class="ofl-row"><button data-a="add">＋ Add card</button><button data-a="up" ${c ? '' : 'disabled'}>↑</button><button data-a="down" ${c ? '' : 'disabled'}>↓</button><button data-a="delete" ${c ? '' : 'disabled'} style="border-color:rgba(255,120,120,.6)">⌫ Delete</button></div>
${c ? this._sideHTML('front', c.front) + this._sideHTML('back', c.back) : ''}
<h4>Files</h4><div class="ofl-row"><button data-a="export-json">Export JSON</button><button data-a="export-csv">Export CSV</button></div>
<div class="ofl-row"><label>Import <input type="file" accept=".json,.csv,application/json,text/csv" data-f="import"></label><select data-f="import-mode" aria-label="Import mode"><option value="replace">Replace the deck</option><option value="merge">Add to the deck</option></select></div>
<div class="ofl-msg" role="status" aria-live="polite"></div>`
    this._ed.scrollTop = keepScroll; this._say(this._msg)
  }
  _wire (ed) {
    ed.addEventListener('keydown', (e) => e.stopPropagation())
    ed.addEventListener('click', async (e) => {
      const f = SERVICES.flash, id = this._eid; if (!f || !id) return
      const card = e.target.closest('[data-card]'); if (card) { this._card = card.dataset.card; this._renderEditor(); return }
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; const k = f.getDeck(id)
      try {
        if (a === 'done') return this.closeEditor(); if (a === 'study') return void this.openStudy(id)
        if (a === 'add') { this._card = f.addCard(id, '', ''); this._say('Card added.') }
        else if (a === 'delete' && this._card) { const i = k.cards.findIndex(x => x.id === this._card); f.removeCard(id, this._card); this._card = f.getDeck(id).cards[Math.min(i, f.getDeck(id).cards.length - 1)]?.id ?? null; this._say('Card deleted.') }
        else if ((a === 'up' || a === 'down') && this._card) { const i = k.cards.findIndex(x => x.id === this._card); f.moveCard(id, this._card, i + (a === 'up' ? -1 : 1)) }
        else if (a.startsWith('rm-')) { const [, side, kind] = a.split('-'); f.updateCard(id, this._card, { [side]: { [kind]: undefined } }); this._say('Removed.') }
        else if (a.startsWith('play-')) { const side = a.slice(5); const c = k.cards.find(x => x.id === this._card); if (c?.[side]?.snd && typeof Audio !== 'undefined') { f.stopAudio(); f._audio = new Audio(c[side].snd); f._audio.play?.().catch?.(() => {}) } }
        else if (a === 'export-json') { download((k.title || 'deck').replace(/[^\w-]+/g, '_') + '.flashcards.json', f.exportText(id, 'json'), 'application/json'); this._say('Exported JSON (pictures and sounds included).') }
        else if (a === 'export-csv') { download((k.title || 'deck').replace(/[^\w-]+/g, '_') + '.csv', f.exportText(id, 'csv'), 'text/csv'); this._say('Exported CSV (text only: front,back).') }
      } catch (err) { this._say(String(err?.message ?? err)) }
    })
    ed.addEventListener('input', (e) => {
      const f = SERVICES.flash, id = this._eid, t = e.target; if (!f || !id || !t.dataset?.f) return; const key = t.dataset.f
      try {
        if (key === 'title') f.setMeta(id, { title: t.value })
        else if (/^(front|back)-text$/.test(key) && this._card) { const side = key.split('-')[0]; f.updateCard(id, this._card, { [side]: { text: t.value } }); const btn = ed.querySelector(`[data-card="${this._card}"]`); if (btn) btn.textContent = (f.getDeck(id).cards.findIndex(x => x.id === this._card) + 1) + '. ' + (side === 'front' ? (t.value || '(empty)') : btn.textContent.replace(/^\d+\.\s*/, '')) }
      } catch (err) { this._say(String(err?.message ?? err)) }
    })
    ed.addEventListener('change', async (e) => {
      const f = SERVICES.flash, id = this._eid, t = e.target; if (!f || !id || !t.dataset?.f) return; const key = t.dataset.f
      try {
        if (key === 'speak') f.setMeta(id, { speak: t.checked })
        else if (/^(front|back)-img$/.test(key) && t.files?.[0]) { const side = key.split('-')[0]; this._say('Shrinking the picture…'); const url = await shrinkImage(t.files[0]); f.updateCard(id, this._card, { [side]: { img: url } }); this._say(f.getDeck(id).cards.find(x => x.id === this._card)?.[side]?.img ? 'Picture added.' : 'The deck is full: no room for more pictures and sounds.') }
        else if (/^(front|back)-snd$/.test(key) && t.files?.[0]) { const side = key.split('-')[0]; const file = t.files[0]; if (file.size > LIMITS.snd * 0.74) throw new Error('That sound is too long. Keep it under about ' + Math.round(LIMITS.snd * 0.74 / 1000) + ' KB (a few seconds).'); const url = await readAsDataURL(file); f.updateCard(id, this._card, { [side]: { snd: url } }); this._say(f.getDeck(id).cards.find(x => x.id === this._card)?.[side]?.snd ? 'Sound added.' : 'That sound type is not supported (use mp3, ogg, wav or webm), or the deck is full.') }
        else if (key === 'import' && t.files?.[0]) { const file = t.files[0]; const text = await file.text(); const fmt = /\.csv$/i.test(file.name) ? 'csv' : 'json'; const mode = ed.querySelector('[data-f="import-mode"]').value; const r = f.importText(id, text, fmt, mode); this._card = f.getDeck(id).cards[0]?.id ?? null; this._say(`Imported ${r.added} card${r.added === 1 ? '' : 's'} (${r.cards} in the deck).`); this._renderEditor() }
      } catch (err) { this._say(String(err?.message ?? err)) }
    })
  }
}
