/**
 * ui/OmniSoundAdminBlock.js — the Sound block of Admin > UI Settings (V194)
 *
 * Only the markup + wiring for the global sound options (utils/OmniSoundSettings.js): master volume, voice cap, mute on phones, require opt-in, particle cap, the
 * "Enable sound" prompt, the speaker (mute) and a reset. ui/AdminPanel.js calls adminRowsHtml() / bindAdminRows(body). Every control sends `omni:sound-settings-set`
 * and applies at once; systems/OmniSoundNodes.js validates + saves 'omni:sound-settings-v1' and answers with `omni:sound-settings-changed`, which the controls follow.
 * User-facing: imports no Dev* module.
 */

import * as S from '../utils/OmniSoundSettings.js'

const tip = (name, desc) => `data-omni-tip="${name}" data-omni-tip-key="—" data-omni-tip-desc="${desc}"`
const NUM_STYLE = 'width:64px;text-align:right;background:var(--ap-input-bg);border:1px solid var(--ap-input-border);border-radius:4px;color:var(--ap-text);font:10.5px var(--mono);padding:3px 6px'
const send = (detail) => window.dispatchEvent(new CustomEvent(S.SET_EVENT, { detail }))
const toggle = (key, on, label, name, desc) => `<button class="ap-toggle ${on ? 'is-on' : ''}" data-snd="${key}" role="switch" aria-checked="${on}" aria-label="${label}" ${tip(name, desc)}></button>`

export function adminRowsHtml () {
  const s = S.resolveSettings(S.loadOverrides())
  const L = S.LIMITS
  const muted = S.effectiveMuted(s)
  const row = (label, inner) => `<div class="ap-row"><span class="ap-row-label">${label}</span>${inner}</div>`
  return `
        <div class="ap-subhead" data-snd-section="1" id="ap-snd-section">Sound</div>
        <div class="ap-data-note" style="font-size:9px;color:var(--ap-text-muted,rgba(255,255,255,0.6));line-height:1.4">Global options for every sound node and every node that makes sound. A browser only lets a page make sound after you tap or press a key once. Changes apply at once.</div>
        ${row('Master volume', `<input class="ap-range" type="range" min="${L.masterVolume.min}" max="${L.masterVolume.max}" step="${L.masterVolume.step}" value="${s.masterVolume}" data-snd="masterVolume" aria-label="Master volume" ${tip('Master volume', 'How loud everything the sound engine plays is, 0 (silent) to 1 (full). Default 0.8.')}>`)}
        ${row('Speaker', toggle('muted', muted, 'Mute all sound', 'Mute all sound', 'On = all sound is muted (the speaker button in the Inspector does the same). Off = sound is allowed.'))}
        ${row('Sounds at once', `<input style="${NUM_STYLE}" type="number" step="1" min="${L.voiceCap.min}" max="${L.voiceCap.max}" value="${s.voiceCap}" data-snd="voiceCap" aria-label="Voice cap" ${tip('Sounds at once (voice cap)', 'How many sounds may play at the same time, 1 to 32. When more start, the oldest one is stopped. Default 16.')}>`)}
        ${row('Mute on phones', toggle('muteOnPhone', s.muteOnPhone, 'Mute on phones by default', 'Mute on phones by default', 'On a phone-sized screen sound starts muted until you press the speaker. Default on.'))}
        ${row('Ask before sound', toggle('requireOptIn', s.requireOptIn, 'Require opt-in before audio starts', 'Require opt-in before audio starts', 'On = no sound at all until you press Enable sound (once per browser tab). Default off.'))}
        ${row('Show Enable sound', toggle('showUnlockPrompt', s.showUnlockPrompt, 'Show the Enable sound prompt', 'Show the Enable sound prompt', 'Shows a small Enable sound button when the browser is still blocking audio. Default on.'))}
        ${row('Particle limit', `<input style="${NUM_STYLE}" type="number" step="${L.particleCap.step}" min="${L.particleCap.min}" max="${L.particleCap.max}" value="${s.particleCap}" data-snd="particleCap" aria-label="Global particle cap" ${tip('Particle limit (whole scene)', 'The most sound particles drawn in the whole scene, all nodes together. Lower it if the scene is slow. Default 20000.')}>`)}
        <div class="ap-row"><span class="ap-row-label">Sound</span><button class="ap-file-btn" id="ap-snd-reset" type="button" ${tip('Reset sound options', 'Back to the defaults: volume 0.8, 8 sounds at once, muted on phones, no opt-in, 20000 particles.')}>Reset sound options</button></div>`
}

/** Wires the block; returns an unbind function. */
export function bindAdminRows (body) {
  body.querySelectorAll('button[data-snd]').forEach(b => b.addEventListener('click', () => send({ patch: { [b.dataset.snd]: !b.classList.contains('is-on') } })))
  body.querySelector('input[data-snd="masterVolume"]')?.addEventListener('input', (e) => send({ patch: { masterVolume: Number(e.currentTarget.value) } }))
  body.querySelectorAll('input[data-snd]:not([data-snd="masterVolume"])').forEach(i => i.addEventListener('change', () => send({ patch: { [i.dataset.snd]: Number(i.value) } })))
  body.querySelector('#ap-snd-reset')?.addEventListener('click', () => send({ reset: true }))
  const follow = (e) => {
    const s = e.detail?.settings; if (!s) return
    const flags = { muted: S.effectiveMuted(s), muteOnPhone: s.muteOnPhone, requireOptIn: s.requireOptIn, showUnlockPrompt: s.showUnlockPrompt }
    body.querySelectorAll('button[data-snd]').forEach(b => { const on = !!flags[b.dataset.snd]; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)) })
    body.querySelectorAll('input[data-snd]').forEach(i => { if (document.activeElement !== i && Number(i.value) !== s[i.dataset.snd]) i.value = String(s[i.dataset.snd]) })
  }
  window.addEventListener(S.CHANGED_EVENT, follow)
  return () => window.removeEventListener(S.CHANGED_EVENT, follow)
}
