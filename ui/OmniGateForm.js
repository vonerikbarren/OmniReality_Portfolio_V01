/**
 * ui/OmniGateForm.js — the OmniPassKeyRing form (V276): a glass panel on the right of the opening screen.
 *
 * SHOWCASE: it checks the entry with utils/OmniGate.js, which accepts any complete entry except the demo code (digits all zeros), so the denial and the wait
 * protocol can be seen. It is not security (see claude/OMNIPASSKEYRING_DESIGN.md).
 * Top to bottom: the Reality's title; username (who is visiting; "Guest" is fine); glyph (picked from the palette of 50); string (bound to the glyph);
 * digit key (6 or 10 digits, a setting). A wrong entry gets ONE generic message, shakes the panel and the field behind it, and after the free tries a pause that grows.
 * It lives inside #omni-boot, so it takes the boot screen's colours. Text goes in with textContent / .value only.
 */
import { allGlyphs, glyphSvg, glyphName, GLYPH_COUNT } from '../utils/OmniKeyGlyphs.js'
import { evaluateEntry, missingFields, createGateState, demoDeniedDigits, sanitizeGateEntry, DENIED_TEXT, MAX_TEXT, MAX_USERNAME } from '../utils/OmniGate.js'
import { loadGateSettings, saveGateSettings } from '../utils/OmniGateSettings.js'

export const FORM_ID = 'omni-gate-form'
const STYLE_ID = 'omni-gate-form-style'
const CSS = `
#omni-gate-form { position: absolute; right: clamp(12px, 4vw, 56px); top: 50%; z-index: 7; width: min(372px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto;
  transform: translate(36px, -50%); opacity: 0; transition: transform .6s cubic-bezier(.2,.8,.2,1), opacity .5s ease;
  padding: 18px 18px 16px; border-radius: 14px; font: 13px/1.45 'Courier New', Courier, monospace; color: var(--boot-ink, #000);
  background: rgba(var(--boot-halo-rgb, 255,255,255), 0.55); border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.28);
  -webkit-backdrop-filter: blur(16px) saturate(1.2); backdrop-filter: blur(16px) saturate(1.2); box-shadow: 0 10px 40px rgba(var(--boot-ink-rgb, 0,0,0), 0.16); }
#omni-gate-form.is-in { transform: translate(0, -50%); opacity: 1; }
#omni-gate-form.is-out { transform: translate(36px, -50%); opacity: 0; }
#omni-gate-form.is-shake { animation: ogfShake .42s ease; }
@keyframes ogfShake { 0%,100% { margin-right: 0; } 20% { margin-right: 12px; } 40% { margin-right: -10px; } 60% { margin-right: 7px; } 80% { margin-right: -4px; } }
@media (max-width: 640px) { #omni-gate-form { top: auto; bottom: 12px; right: 12px; transform: translate(0, 40px); max-height: 80vh; } #omni-gate-form.is-in { transform: translate(0, 0); } #omni-gate-form.is-out { transform: translate(0, 40px); } }
#omni-gate-form .ogf-title { font-size: 16px; letter-spacing: .08em; margin: 0; }
#omni-gate-form .ogf-sub { font-size: 11px; letter-spacing: .3em; text-transform: uppercase; opacity: .6; margin: 2px 0 12px; }
#omni-gate-form label.ogf-l { display: block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; opacity: .7; margin: 10px 0 4px; }
#omni-gate-form input[type=text], #omni-gate-form input[type=password], #omni-gate-form input[type=tel] { width: 100%; font: inherit; font-size: 14px; color: inherit; padding: 8px 10px; border-radius: 8px;
  background: rgba(var(--boot-halo-rgb, 255,255,255), 0.5); border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.35); box-sizing: border-box; }
#omni-gate-form input:focus-visible, #omni-gate-form button:focus-visible { outline: 2px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.7); outline-offset: 1px; }
#omni-gate-form .ogf-glyphbtn { display: flex; align-items: center; gap: 10px; width: 100%; font: inherit; color: inherit; text-align: left; cursor: pointer; padding: 6px 10px; border-radius: 8px;
  background: rgba(var(--boot-halo-rgb, 255,255,255), 0.5); border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.35); min-height: 38px; }
#omni-gate-form .ogf-glyphbtn svg { width: 24px; height: 24px; flex: none; }
#omni-gate-form .ogf-palette { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; margin-top: 6px; padding: 6px; border-radius: 8px; background: rgba(var(--boot-halo-rgb, 255,255,255), 0.6); border: 1px solid rgba(var(--boot-ink-rgb, 0,0,0), 0.2); }
#omni-gate-form .ogf-palette[hidden] { display: none; }
#omni-gate-form .ogf-palette button { padding: 3px; aspect-ratio: 1; cursor: pointer; border-radius: 6px; background: transparent; color: inherit; border: 1px solid transparent; display: flex; align-items: center; justify-content: center; }
#omni-gate-form .ogf-palette button svg { width: 100%; height: 100%; }
#omni-gate-form .ogf-palette button:hover { background: rgba(var(--boot-ink-rgb, 0,0,0), 0.1); }
#omni-gate-form .ogf-palette button[aria-pressed="true"] { border-color: rgba(var(--boot-ink-rgb, 0,0,0), 0.9); background: rgba(var(--boot-ink-rgb, 0,0,0), 0.12); }
#omni-gate-form .ogf-show { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; opacity: .8; cursor: pointer; }
#omni-gate-form .ogf-hint { margin-top: 10px; font-size: 11px; opacity: .6; }
#omni-gate-form .ogf-submit { width: 100%; margin-top: 12px; padding: 10px; font: inherit; font-size: 13px; letter-spacing: .2em; text-transform: uppercase; cursor: pointer; border-radius: 999px;
  color: var(--boot-bg, #fff); background: var(--boot-ink, #000); border: 1px solid var(--boot-ink, #000); }
#omni-gate-form .ogf-submit:disabled { opacity: .45; cursor: not-allowed; }
#omni-gate-form .ogf-status { min-height: 2.8em; margin-top: 8px; font-size: 12px; }
#omni-gate-form .ogf-status.is-bad { font-weight: bold; }
@media (prefers-reduced-motion: reduce) { #omni-gate-form { transition: opacity .2s ease; transform: translate(0, -50%); } #omni-gate-form.is-shake { animation: none; } }
`

function el (tag, attrs, ...kids) {
  const e = document.createElement(tag)
  if (attrs) for (const [k, v] of Object.entries(attrs)) { if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v) }
  for (const k of kids) if (k) e.appendChild(k)
  return e
}
const calmNow = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('#omni-boot.boot-calm') } catch (_) { return false } }

/**
 * Opens the form. Returns { promise, close, element }. The promise resolves with the accepted entry { username, glyph, text, digits }.
 * @param opts { title = 'Omni⟐StarOS', host = #omni-boot or body, now = () => Date.now() }
 */
export function openGateForm (opts = {}) {
  const host = opts.host || document.getElementById('omni-boot') || document.body
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now()
  const cfg = loadGateSettings()
  const LEN = cfg.digits === 10 ? 10 : 6
  const state = createGateState()
  if (!document.getElementById(STYLE_ID)) { const st = el('style', { id: STYLE_ID }); st.textContent = CSS; document.head.appendChild(st) }
  const old = document.getElementById(FORM_ID); if (old) old.remove()

  const form = el('form', { id: FORM_ID, role: 'dialog', 'aria-label': 'Key ring', autocomplete: 'off', novalidate: '' })
  form.appendChild(el('h2', { class: 'ogf-title', text: String(opts.title || 'Omni⟐StarOS') }))
  form.appendChild(el('div', { class: 'ogf-sub', text: 'Key ring' }))

  form.appendChild(el('label', { class: 'ogf-l', for: 'ogf-user', text: 'Visitor' }))
  const user = el('input', { id: 'ogf-user', type: 'text', placeholder: 'Guest', maxlength: String(MAX_USERNAME), autocomplete: 'off', spellcheck: 'false' }); user.value = cfg.username
  form.appendChild(user)

  form.appendChild(el('label', { class: 'ogf-l', for: 'ogf-glyph', text: 'Glyph' }))
  const glyphBtn = el('button', { id: 'ogf-glyph', type: 'button', class: 'ogf-glyphbtn', 'aria-expanded': 'false', 'aria-controls': 'ogf-palette' })
  const glyphShow = el('span', { class: 'ogf-gshow' }); const glyphTxt = el('span', { text: 'Choose a glyph' })
  glyphBtn.appendChild(glyphShow); glyphBtn.appendChild(glyphTxt)
  form.appendChild(glyphBtn)
  const palette = el('div', { id: 'ogf-palette', class: 'ogf-palette', role: 'group', 'aria-label': 'Glyph palette' }); palette.hidden = true
  let glyph = null
  const cells = []
  for (const g of allGlyphs(24)) {
    const b = el('button', { type: 'button', 'data-glyph': String(g.id), 'aria-label': g.name, 'aria-pressed': 'false', title: g.name }); b.innerHTML = g.svg   // fixed text from utils/OmniKeyGlyphs.js: numbers and constants only
    b.addEventListener('click', () => { glyph = g.id; refreshGlyph(); setPalette(false); string.focus() })
    cells.push(b); palette.appendChild(b)
  }
  form.appendChild(palette)
  function refreshGlyph () {
    glyphShow.innerHTML = glyph === null ? '' : glyphSvg(glyph, 24)
    glyphTxt.textContent = glyph === null ? 'Choose a glyph' : glyphName(glyph)
    for (const c of cells) c.setAttribute('aria-pressed', String(Number(c.getAttribute('data-glyph')) === glyph))
  }
  function setPalette (open) { palette.hidden = !open; glyphBtn.setAttribute('aria-expanded', String(open)) }
  glyphBtn.addEventListener('click', () => setPalette(palette.hidden))

  form.appendChild(el('label', { class: 'ogf-l', for: 'ogf-string', text: 'String bound to the glyph' }))
  const string = el('input', { id: 'ogf-string', type: 'password', maxlength: String(MAX_TEXT), autocomplete: 'off', spellcheck: 'false' })
  form.appendChild(string)

  form.appendChild(el('label', { class: 'ogf-l', for: 'ogf-digits', text: `Digit key (${LEN} digits)` }))
  const digits = el('input', { id: 'ogf-digits', type: 'password', inputmode: 'numeric', maxlength: String(LEN), autocomplete: 'off', pattern: '[0-9]*' })
  digits.addEventListener('input', () => { digits.value = digits.value.replace(/\D/g, '').slice(0, LEN) })
  form.appendChild(digits)

  const showBox = el('input', { id: 'ogf-show', type: 'checkbox' })
  showBox.addEventListener('change', () => { const t = showBox.checked ? 'text' : 'password'; string.type = t; digits.type = t })
  form.appendChild(el('label', { class: 'ogf-show', for: 'ogf-show' }, showBox, el('span', { text: 'Show what I type' })))
  form.appendChild(el('div', { class: 'ogf-hint', text: `Showcase: any complete entry opens the gate. Digits ${demoDeniedDigits(LEN)} are denied, to show the error.` }))

  const submit = el('button', { id: 'ogf-submit', type: 'submit', class: 'ogf-submit', text: 'Enter' })
  form.appendChild(submit)
  const status = el('div', { id: 'ogf-status', class: 'ogf-status', role: 'status', 'aria-live': 'polite' })
  form.appendChild(status)

  let closed = false, timer = 0, resolveFn
  // While the form is open, keys outside it must not reach the app underneath (p, g, n ... open panels behind the veil). Keys typed in the form pass untouched.
  const keyBlock = (e) => { if (!form.contains(e.target)) e.stopPropagation() }
  window.addEventListener('keydown', keyBlock, true); window.addEventListener('keyup', keyBlock, true)
  const promise = new Promise((res) => { resolveFn = res })
  const G = () => (window.__omniGate = window.__omniGate || {})
  const say = (t, bad) => { status.textContent = t; status.classList.toggle('is-bad', !!bad) }

  function tickLock () {
    if (closed) return
    if (state.isLocked(now())) {
      const s = Math.ceil(state.remainingMs(now()) / 1000)
      submit.disabled = true; say(`Paused. Try again in ${s} second${s === 1 ? '' : 's'}.`, true)
      timer = setTimeout(tickLock, 250)
    } else { submit.disabled = false; if (status.classList.contains('is-bad')) say('You can try again.', false) }
  }
  function shake () {
    G().shudder = 1
    if (calmNow()) return
    form.classList.remove('is-shake'); void form.offsetWidth; form.classList.add('is-shake')
  }
  function close (delay = 0) {
    if (closed) return
    closed = true; clearTimeout(timer)
    window.removeEventListener('keydown', keyBlock, true); window.removeEventListener('keyup', keyBlock, true)
    setTimeout(() => { form.classList.remove('is-in'); form.classList.add('is-out'); setTimeout(() => form.remove(), 700) }, delay)
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    if (closed) return
    if (state.isLocked(now())) { tickLock(); return }
    const entry = sanitizeGateEntry({ username: user.value.trim() || 'Guest', glyph, text: string.value, digits: digits.value })
    const miss = missingFields(entry, LEN)
    if (miss.length) { say(`Still empty: ${miss.join(', ')}.`, false); (miss[0] === 'glyph' ? glyphBtn : miss[0] === 'string' ? string : digits).focus(); return }
    const res = evaluateEntry(entry, LEN)
    if (res.ok) {
      state.success()
      saveGateSettings({ username: user.value.trim() })
      say(`Welcome, ${entry.username}.`, false)
      submit.disabled = true
      close(650)
      resolveFn(entry)
      return
    }
    const f = state.fail(now())
    shake(); digits.value = ''
    const tail = f.lockMs > 0 ? ` Paused for ${Math.round(f.lockMs / 1000)} seconds.` : ` ${f.triesLeft} ${f.triesLeft === 1 ? 'try' : 'tries'} left before a pause.`
    say(DENIED_TEXT + tail, true)
    if (f.lockMs > 0) tickLock(); else digits.focus()
  })

  host.appendChild(form)
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!closed) form.classList.add('is-in') }))
  setTimeout(() => { try { user.focus({ preventScroll: true }) } catch (_) {} }, 350)
  return { promise, close, element: form, state }
}

export { GLYPH_COUNT }
