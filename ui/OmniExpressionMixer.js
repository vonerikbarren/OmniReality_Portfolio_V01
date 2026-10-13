/**
 * ui/OmniExpressionMixer.js (V195) — the 'mixer' quadrant content of the OmniExpression panel: 6 vertical faders with mute / solo per channel.
 *
 * HONEST STATE: ui/OmniMixerPanel.js (now shown as OmniMusicPlayer) has NO exported mixer API: it owns two <audio> channels and keeps its
 * volumes in its own settings; the only hook is the read-only `window.__omniMixerAudio` (V194, for the analyser). So this quadrant is labelled
 * "Mixer (placeholder)": the faders, mute and solo work visually and are STORED (omni:expression-panel-v1 .mixer), the effective gains are
 * published on the window event `omni:expression-mixer` { gains:[6], level, mute, solo } for whoever binds them later (the OmniDJ agent, or a
 * real OmniMusicPlayer channel API). Nothing here touches the audio elements.
 */
import * as M from '../utils/OmniExpressionPanelModel.js'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`

export const MIX_STYLES = `
.xm { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 6px; padding: 6px; color: var(--omni-theme-text, rgba(255,255,255,.93)); font-family: 'Courier New', Courier, monospace; font-size: 10px; user-select: none; }
.xm-note { flex: 0 0 auto; opacity: .62; font-size: 9px; letter-spacing: .04em; }
.xm-chs { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.xm-ch { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; min-height: 0; }
.xm-ch.is-silent .xm-fader { opacity: .35; }
.xm-fwrap { position: relative; flex: 1 1 auto; min-height: 60px; width: 100%; display: flex; justify-content: center; }
.xm-fader { -webkit-appearance: slider-vertical; appearance: slider-vertical; writing-mode: vertical-lr; direction: rtl; width: 28px; height: 100%; margin: 0; accent-color: var(--omni-theme-accent, #7fd8ff); touch-action: none; }
.xm-val { font-variant-numeric: tabular-nums; opacity: .8; }
.xm-btns { display: flex; gap: 3px; }
.xm-btn { min-width: 26px; height: 24px; padding: 0 3px; border-radius: 5px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); background: rgba(255,255,255,.07); color: inherit; font: inherit; cursor: pointer; touch-action: manipulation; }
.xm-btn.is-on[data-a="mute"] { background: #ff4d6d; border-color: transparent; color: #fff; }
.xm-btn.is-on[data-a="solo"] { background: #ffd24d; border-color: transparent; color: #1b1200; }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('xm-styles')) return
  const s = document.createElement('style'); s.id = 'xm-styles'; s.textContent = MIX_STYLES; document.head.appendChild(s)
}

/** mountMixer(host, ctx, { state, save }) -> { el, destroy, onResize, getMixer() }. `state` is the shared panel state object (mixer part is read / written). */
export function mountMixer (host, ctx = {}, io = {}) {
  injectStyles()
  const st = io.state || M.loadState()
  const save = typeof io.save === 'function' ? io.save : () => M.saveState(st)
  const root = document.createElement('div'); root.className = 'xm'; root.dataset.xm = '1'
  const chans = Array.from({ length: M.MIXER_CHANNELS }, (_, i) => i)
  root.innerHTML = `<div class="xm-note">Mixer (placeholder): faders, mute and solo work and are saved; they are not connected to the OmniMusicPlayer audio yet.</div>
    <div class="xm-chs">${chans.map(i => `<div class="xm-ch" data-ch="${i}">
      <div class="xm-fwrap"><input class="xm-fader" type="range" min="0" max="100" step="1" data-r="f${i}" aria-label="Channel ${i + 1} level" ${tip('Channel ' + (i + 1) + ' fader', 'The level of channel ' + (i + 1) + ' (placeholder: saved, not yet connected to the audio).')}></div>
      <span class="xm-val" data-r="v${i}" title="Channel ${i + 1}"></span>
      <div class="xm-btns"><button type="button" class="xm-btn" data-a="mute" data-ch="${i}" aria-pressed="false" aria-label="Mute channel ${i + 1}" ${tip('Mute ' + (i + 1), 'Silences channel ' + (i + 1) + '.', '—')}>M</button><button type="button" class="xm-btn" data-a="solo" data-ch="${i}" aria-pressed="false" aria-label="Solo channel ${i + 1}" ${tip('Solo ' + (i + 1), 'Only soloed channels sound.', '—')}>S</button></div></div>`).join('')}</div>`
  host.appendChild(root)
  const q = (r) => root.querySelector(`[data-r="${r}"]`)
  function render () {
    const g = M.mixerGains(st.mixer)
    chans.forEach(i => {
      const f = q('f' + i); f.value = String(Math.round(st.mixer.level[i] * 100)); q('v' + i).textContent = (i + 1) + ': ' + Math.round(st.mixer.level[i] * 100)
      const mb = root.querySelector(`[data-a="mute"][data-ch="${i}"]`), sb = root.querySelector(`[data-a="solo"][data-ch="${i}"]`)
      mb.classList.toggle('is-on', st.mixer.mute[i]); mb.setAttribute('aria-pressed', String(st.mixer.mute[i]))
      sb.classList.toggle('is-on', st.mixer.solo[i]); sb.setAttribute('aria-pressed', String(st.mixer.solo[i]))
      root.querySelector(`.xm-ch[data-ch="${i}"]`).classList.toggle('is-silent', g[i] === 0)
    })
  }
  function publish () {
    try { window.dispatchEvent(new CustomEvent('omni:expression-mixer', { detail: { gains: M.mixerGains(st.mixer), level: [...st.mixer.level], mute: [...st.mixer.mute], solo: [...st.mixer.solo] } })) } catch (_) { /* no window */ }
  }
  root.addEventListener('input', (e) => {
    const f = e.target.closest?.('.xm-fader'); if (!f) return
    const i = Number(f.dataset.r.slice(1)); st.mixer.level[i] = Math.min(1, Math.max(0, Number(f.value) / 100))
    render(); save(); publish()
  })
  root.addEventListener('click', (e) => {
    const b = e.target.closest?.('.xm-btn'); if (!b) return
    const i = Number(b.dataset.ch); const k = b.dataset.a
    st.mixer[k][i] = !st.mixer[k][i]; render(); save(); publish()
  })
  render()
  return {
    el: root,
    getMixer: () => st.mixer,
    onResize () {},
    destroy () { root.remove() }
  }
}
export default mountMixer
