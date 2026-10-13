/**
 * ui/OmniStateStrictAlignAdminBlock.js — the OmniState_StrictAlign block of Admin > UI Settings (V191)
 *
 * Only the markup + wiring for the five options (utils/OmniStateStrictAlignSettings.js): step, Shift step, show axis line, close after Enter,
 * snap the mouse drag to the step, and a reset. ui/AdminPanel.js calls adminRowsHtml() / bindAdminRows(body) (two lines). Every control sends
 * `omni:strictalign-set` and applies at once; ui/OmniStateStrictAlign.js validates + saves 'omni:strictalign-v1' and answers with
 * `omni:strictalign-changed`, which the controls follow. User-facing: imports no Dev* module.
 */

import * as S from '../utils/OmniStateStrictAlignSettings.js'

const tip = (name, desc) => `data-omni-tip="${name}" data-omni-tip-key="—" data-omni-tip-desc="${desc}"`
// not the Admin panel's own .ap-num class: that one is bound to the staged-Save fields (data-key); these apply at once
const NUM_STYLE = 'width:60px;text-align:right;background:var(--ap-input-bg);border:1px solid var(--ap-input-border);border-radius:4px;color:var(--ap-text);font:10.5px var(--mono);padding:3px 6px'
const send = (detail) => window.dispatchEvent(new CustomEvent(S.SET_EVENT, { detail }))
const toggle = (key, on, label, name, desc) => `<button class="ap-toggle ${on ? 'is-on' : ''}" data-sa="${key}" role="switch" aria-checked="${on}" aria-label="${label}" ${tip(name, desc)}></button>`

export function adminRowsHtml () {
  const s = S.resolveSettings(S.loadOverrides())
  const row = (label, inner) => `<div class="ap-row"><span class="ap-row-label">${label}</span>${inner}</div>`
  return `
        <div class="ap-subhead" data-sa-section="1" id="ap-sa-section">Strict axis mode (OmniState)</div>
        <div class="ap-data-note" style="font-size:9px;color:var(--ap-text-muted,rgba(255,255,255,0.6));line-height:1.4">Press the \` key with a node selected to move it along ONE axis (X, Y or Z) with exact coordinates. Esc or \` again leaves the mode. Changes apply at once.</div>
        ${row('Step', `<input class="ap-sa-num" style="${NUM_STYLE}" type="number" step="0.01" min="${S.STEP_MIN}" max="${S.STEP_MAX}" value="${s.step}" data-sa="step" aria-label="StrictAlign step" ${tip('StrictAlign step', 'How far one nudge (arrow key or mouse wheel) moves the node, and what a mouse drag snaps to. Default 0.1.')}>`)}
        ${row('Shift step', `<input class="ap-sa-num" style="${NUM_STYLE}" type="number" step="0.1" min="${S.SHIFT_STEP_MIN}" max="${S.SHIFT_STEP_MAX}" value="${s.shiftStep}" data-sa="shiftStep" aria-label="StrictAlign shift step" ${tip('StrictAlign Shift step', 'The step while Shift is held. Default 1.')}>`)}
        ${row('Show axis line', toggle('showAxisLine', s.showAxisLine, 'Show axis line', 'Show axis line', 'Draws the coloured line and arrows through the node along the chosen axis.'))}
        ${row('Close after Enter', toggle('closeAfterEnter', s.closeAfterEnter, 'Close after Enter', 'Close after Enter', 'Leaves the mode after you type an exact value and press Enter.'))}
        ${row('Snap drag to step', toggle('snapDrag', s.snapDrag, 'Snap drag to step', 'Snap drag to step', 'A mouse drag along the axis lands on multiples of the step. Off = free movement (typed values are always exact).'))}
        <div class="ap-row"><span class="ap-row-label">Strict axis mode</span><button class="ap-file-btn" id="ap-sa-reset" type="button" ${tip('Reset StrictAlign', 'Back to the defaults: step 0.1, Shift step 1, axis line shown, stays open after Enter, drag snaps.')}>Reset strict axis</button></div>`
}

/** Wires the block; returns an unbind function. */
export function bindAdminRows (body) {
  const cleanups = []
  body.querySelectorAll('button[data-sa]').forEach(b => b.addEventListener('click', () => send({ patch: { [b.dataset.sa]: !b.classList.contains('is-on') } })))
  body.querySelectorAll('input[data-sa]').forEach(i => i.addEventListener('change', () => send({ patch: { [i.dataset.sa]: Number(i.value) } })))
  body.querySelector('#ap-sa-reset')?.addEventListener('click', () => send({ reset: true }))
  const follow = (e) => {
    const s = e.detail?.settings; if (!s || e.detail?.kind !== 'settings') return
    body.querySelectorAll('button[data-sa]').forEach(b => { const on = !!s[b.dataset.sa]; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)) })
    body.querySelectorAll('input[data-sa]').forEach(i => { if (document.activeElement !== i && Number(i.value) !== s[i.dataset.sa]) i.value = String(s[i.dataset.sa]) })
  }
  window.addEventListener(S.CHANGED_EVENT, follow)
  cleanups.push(() => window.removeEventListener(S.CHANGED_EVENT, follow))
  return () => cleanups.forEach(f => f())
}
