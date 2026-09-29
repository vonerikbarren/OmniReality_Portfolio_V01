/**
 * systems/OmniProgramCommands.js — shared "Program" step commands
 *
 * Real, minimal instruction set for the new per-object Program
 * feature: a short, ordered sequence of steps any OmniDraw object
 * can be given, run on demand via ⟐OmniBegin(Program). Not limited
 * to OmniNavi/OmniBotProgram bots — this applies to any node, per
 * direct request.
 *
 * Five real commands:
 *   move        — gsap.to(mesh.position, {...})   — a genuine tween
 *   rotate      — gsap.to(mesh.rotation, {...})   — a genuine tween
 *   scale       — gsap.to(mesh.scale, {...})      — a genuine tween
 *   communicate — pushes through the real, already-wired ⟐OmniNotify
 *                 pipeline (omni:notify-push), prefixed as speech
 *                 from the node's own label
 *   notify      — same real pipeline, plain item text
 * communicate/notify reuse OmniNotify rather than inventing a second,
 * fake in-scene chat-bubble system that doesn't exist yet — a real
 * distinction (label-prefixed "says" vs a plain item) rather than two
 * commands that do the literal same thing under different names.
 *
 * Running a program is a live animation by default — it does not
 * write the tweened position/rotation/scale back to the node's own
 * saved data, so a reload reverts to whatever was last actually
 * saved via the normal Inspector fields. Per direct follow-up
 * request, this is now a real, per-program choice rather than a
 * fixed rule: an "Auto-Persist" toggle (ext.program.autoPersist)
 * dispatches the same real omni:node-pos-set / -rotation-set /
 * -scale-set events the Inspector's own XYZ fields use, so a run
 * that opts in genuinely updates the saved transform — once, at the
 * end of a single run, or at the end of every lap if the program's
 * repeat mode is 'infinite' (see persistTransform / runProgram).
 *
 * Shared between systems/OmniInspector.js's inline "Program" section
 * (the quick editor, on the Inspector itself) and
 * ui/OmniProgramEditorPanel.js (the dedicated, growing IDE panel) so
 * both render identical step rows and run identically.
 */

import gsap from 'gsap'

export const PROGRAM_COMMANDS = {
  move: {
    label: 'Move',
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.1, default: 0 },
      { key: 'y', label: 'Y', type: 'number', step: 0.1, default: 0 },
      { key: 'z', label: 'Z', type: 'number', step: 0.1, default: 0 },
      { key: 'duration', label: 'Duration (s)', type: 'number', step: 0.1, default: 1 },
    ],
  },
  rotate: {
    label: 'Rotate',
    fields: [
      { key: 'x', label: 'X (rad)', type: 'number', step: 0.1, default: 0 },
      { key: 'y', label: 'Y (rad)', type: 'number', step: 0.1, default: 0 },
      { key: 'z', label: 'Z (rad)', type: 'number', step: 0.1, default: 0 },
      { key: 'duration', label: 'Duration (s)', type: 'number', step: 0.1, default: 1 },
    ],
  },
  scale: {
    label: 'Scale',
    fields: [
      { key: 'x', label: 'X', type: 'number', step: 0.1, default: 1 },
      { key: 'y', label: 'Y', type: 'number', step: 0.1, default: 1 },
      { key: 'z', label: 'Z', type: 'number', step: 0.1, default: 1 },
      { key: 'duration', label: 'Duration (s)', type: 'number', step: 0.1, default: 1 },
    ],
  },
  communicate: {
    label: 'Communicate',
    fields: [
      { key: 'message', label: 'Message', type: 'text', default: '' },
      { key: 'duration', label: 'Hold (s)', type: 'number', step: 0.1, default: 1.5 },
    ],
  },
  notify: {
    label: 'Notify',
    fields: [
      { key: 'item', label: 'Item', type: 'text', default: '' },
      { key: 'duration', label: 'Hold (s)', type: 'number', step: 0.1, default: 1.5 },
    ],
  },
}

export function defaultStep (cmd = 'move') {
  const def = PROGRAM_COMMANDS[cmd] ?? PROGRAM_COMMANDS.move
  const step = { cmd: PROGRAM_COMMANDS[cmd] ? cmd : 'move' }
  def.fields.forEach(f => { step[f.key] = f.default })
  return step
}

export function stepSummary (step) {
  switch (step.cmd) {
    case 'move':        return `Move → (${step.x}, ${step.y}, ${step.z})`
    case 'rotate':       return `Rotate → (${step.x}, ${step.y}, ${step.z}) rad`
    case 'scale':        return `Scale → (${step.x}, ${step.y}, ${step.z})`
    case 'communicate':  return `Communicate: "${step.message ?? ''}"`
    case 'notify':       return `Notify: ${step.item ?? ''}`
    default:             return step.cmd
  }
}

/** One step's editable row — a command dropdown plus whichever fields
 *  that command defines. Identical markup/classes used by both
 *  consumers so a single set of CSS rules and wiring code covers
 *  both. */
export function stepRowHTML (step, idx) {
  const def = PROGRAM_COMMANDS[step.cmd] ?? PROGRAM_COMMANDS.move
  const options = Object.entries(PROGRAM_COMMANDS).map(([key, c]) => /* html */`
    <option value="${key}" ${step.cmd === key ? 'selected' : ''}>${c.label}</option>
  `).join('')
  const fields = def.fields.map(f => /* html */`
    <label class="op-field">
      <span class="op-field-label">${f.label}</span>
      <input class="op-field-input" type="${f.type}" ${f.type === 'number' ? `step="${f.step ?? 1}"` : ''}
             data-idx="${idx}" data-field="${f.key}" value="${step[f.key] ?? f.default ?? ''}">
    </label>
  `).join('')

  return /* html */`
    <div class="op-step" data-idx="${idx}">
      <div class="op-step-head">
        <span class="op-step-num">${idx + 1}.</span>
        <select class="op-step-cmd" data-idx="${idx}">${options}</select>
        <button class="op-step-del" data-idx="${idx}" title="Remove step">✕</button>
      </div>
      <div class="op-step-fields">${fields}</div>
    </div>
  `
}

/** Dispatches the same real, existing persistence events
 *  systems/OmniInspector.js's own Position/Rotation/Scale fields use
 *  (omni:node-pos-set / -rotation-set / -scale-set), so a program
 *  that opts into Auto-Persist genuinely updates the node's saved
 *  transform rather than just looking like it did. Requires the real
 *  node id, not just the mesh — the Inspector's own handlers key
 *  their saves off `id`, not the mesh reference. */
export function persistTransform (nodeId, mesh) {
  if (!nodeId || !mesh) return
  window.dispatchEvent(new CustomEvent('omni:node-pos-set', {
    detail: { id: nodeId, position: [mesh.position.x, mesh.position.y, mesh.position.z] }
  }))
  window.dispatchEvent(new CustomEvent('omni:node-rotation-set', {
    detail: { id: nodeId, rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z] }
  }))
  window.dispatchEvent(new CustomEvent('omni:node-scale-set', {
    detail: { id: nodeId, scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z] }
  }))
}

/** Runs a step sequence against a real mesh as one gsap timeline, in
 *  order, and returns the timeline. move/rotate/scale genuinely tween
 *  the mesh's own transform properties; communicate/notify push a
 *  real notification partway through, then hold for `duration`
 *  seconds so the sequence doesn't race past a message instantly.
 *
 *  options:
 *    repeat      — 'once' (default) or 'infinite' (gsap repeat: -1)
 *    autoPersist — when true, writes the mesh's transform back to
 *                  the node's saved data via persistTransform(): once
 *                  at the end of a 'once' run, or at the end of every
 *                  lap for 'infinite' (its onComplete never fires).
 *    nodeId      — required for autoPersist; ignored otherwise. */
export function runProgram (mesh, steps, label = 'Program', options = {}) {
  const { repeat = 'once', autoPersist = false, nodeId = null } = options
  const tl = gsap.timeline({ repeat: repeat === 'infinite' ? -1 : 0 })
  if (!mesh || !Array.isArray(steps) || steps.length === 0) return tl

  steps.forEach(step => {
    const dur = Number(step.duration) > 0 ? Number(step.duration) : 1
    switch (step.cmd) {
      case 'move':
        tl.to(mesh.position, {
          x: Number(step.x) || 0, y: Number(step.y) || 0, z: Number(step.z) || 0,
          duration: dur, ease: 'power2.inOut',
        })
        break
      case 'rotate':
        tl.to(mesh.rotation, {
          x: Number(step.x) || 0, y: Number(step.y) || 0, z: Number(step.z) || 0,
          duration: dur, ease: 'power2.inOut',
        })
        break
      case 'scale':
        tl.to(mesh.scale, {
          x: Number(step.x) || 1, y: Number(step.y) || 1, z: Number(step.z) || 1,
          duration: dur, ease: 'power2.inOut',
        })
        break
      case 'communicate':
        tl.call(() => window.dispatchEvent(new CustomEvent('omni:notify-push', {
          detail: { text: `${label} says: "${step.message ?? ''}"` }
        })))
        tl.to({}, { duration: dur })
        break
      case 'notify':
        tl.call(() => window.dispatchEvent(new CustomEvent('omni:notify-push', {
          detail: { text: `${label}: ${step.item ?? ''}` }
        })))
        tl.to({}, { duration: dur })
        break
      default:
        break
    }
  })

  if (autoPersist && nodeId) {
    if (repeat === 'infinite') {
      // repeat:-1 never runs off the end of the timeline, so a queued
      // .call() at the tail never gets reached more than once — this
      // needs the timeline's own onRepeat event instead. Left as the
      // only eventCallback this function sets for 'infinite', so a
      // caller is still free to use onComplete (which never fires for
      // an infinite timeline anyway) without colliding with this.
      tl.eventCallback('onRepeat', () => persistTransform(nodeId, mesh))
    } else {
      // A queued .call() at the very end of the sequence, not
      // eventCallback('onComplete', ...) — callers (e.g. the
      // Inspector's Begin/Stop button) may want to set their own
      // onComplete to notice the run finished, and eventCallback
      // replaces rather than chains, so this avoids stepping on that.
      tl.call(() => persistTransform(nodeId, mesh))
    }
  }

  return tl
}
