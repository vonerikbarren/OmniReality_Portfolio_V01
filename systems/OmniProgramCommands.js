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
 *
 * Sixth command — Group (added per direct request: a "middle zone"
 * for building more complex programs before the far-future full IDE
 * — see docs/omniproducts/OMNISENSE_ALPHABET_AXIOMS_DESIGN.md's
 * Plan_FullOmniSense_IDE_, which this is explicitly NOT):
 *   group — not a tween/notify action itself. Its body is an ordered
 *           sub-sequence of further steps (which may themselves be
 *           groups — real recursion). stepRowHTML() renders a group's
 *           nested steps by calling itself again on each child, so
 *           there is exactly one row-rendering implementation for
 *           both leaf and group rows, flat or nested, in both
 *           consumers. runProgram() flattens a group's children
 *           straight into the SAME gsap timeline as the rest of the
 *           program, in order, before continuing to whatever follows
 *           the group — so a group doesn't change the program's
 *           existing one-after-another timing semantics, it only
 *           changes how the steps are organized/edited.
 *
 * Steps are addressed by dotted-index path ("0", "0.2", "0.2.1", ...)
 * rather than a flat numeric index once nesting exists — a group's
 * children live in their own `step.steps` array, so a single flat
 * index can't name a nested row. resolveStepPath() is the shared
 * helper both consumers use to resolve a path back to the real array
 * + index to mutate, so neither panel re-implements path resolution
 * on its own.
 *
 * Nesting depth is capped at MAX_GROUP_DEPTH (5). This is a defensive
 * cap, not a deliberate design limit — recursive rendering
 * (stepRowHTML) and recursive timeline-building (runProgram) both
 * recurse once per nesting level, so an unbounded depth (e.g. from a
 * hand-edited or corrupted localStorage blob) could blow the call
 * stack or build a pathologically large timeline. 5 levels is far
 * past anything a person would actually build by hand in this UI, so
 * the cap is invisible in normal use: stepRowHTML simply omits the
 * "Group" option from the command dropdown once a row is already at
 * depth 5, and runProgram independently refuses to recurse past depth
 * 5 even if a step somehow arrived deeper than that (defense in
 * depth, not just in the editor).
 */

import gsap from 'gsap'

/** Nesting depth cap for Group steps — see header comment above. */
export const MAX_GROUP_DEPTH = 5

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
  group: {
    label: 'Group',
    // No tween/notify fields of its own — "Label" is just a name for
    // the container; the real content is its nested `steps` array,
    // handled specially by defaultStep()/stepRowHTML()/runProgram()
    // below rather than through the generic field list.
    fields: [
      { key: 'label', label: 'Label', type: 'text', default: 'Group' },
    ],
  },
}

export function defaultStep (cmd = 'move') {
  const def = PROGRAM_COMMANDS[cmd] ?? PROGRAM_COMMANDS.move
  const step = { cmd: PROGRAM_COMMANDS[cmd] ? cmd : 'move' }
  def.fields.forEach(f => { step[f.key] = f.default })
  if (step.cmd === 'group') step.steps = []
  return step
}

export function stepSummary (step) {
  switch (step.cmd) {
    case 'move':        return `Move → (${step.x}, ${step.y}, ${step.z})`
    case 'rotate':       return `Rotate → (${step.x}, ${step.y}, ${step.z}) rad`
    case 'scale':        return `Scale → (${step.x}, ${step.y}, ${step.z})`
    case 'communicate':  return `Communicate: "${step.message ?? ''}"`
    case 'notify':       return `Notify: ${step.item ?? ''}`
    case 'group': {
      const n = (step.steps ?? []).length
      return `Group "${step.label ?? 'Group'}" (${n} step${n === 1 ? '' : 's'})`
    }
    default:             return step.cmd
  }
}

/** Resolves a dotted-index path ("0.2.1") against a top-level steps
 *  array, returning { arr, index } — `arr` is the real array the
 *  addressed step lives in (the top-level `steps` itself, or some
 *  ancestor group's own `.steps`) and `index` is its position in
 *  that array, so a caller can read/replace/splice it in place
 *  (`arr[index]`, `arr.splice(index, 1)`, ...) without needing to
 *  know how deep it's nested. Returns null if the path doesn't
 *  resolve (e.g. a stale row after a sibling was removed). */
export function resolveStepPath (steps, path) {
  const idxs = String(path).split('.').map(Number)
  let arr = steps
  for (let i = 0; i < idxs.length - 1; i++) {
    const step = arr?.[idxs[i]]
    if (!step || !Array.isArray(step.steps)) return null
    arr = step.steps
  }
  const index = idxs[idxs.length - 1]
  if (!Array.isArray(arr) || !(index in arr)) return null
  return { arr, index }
}

/** One step's editable row — a command dropdown plus whichever fields
 *  that command defines. Identical markup/classes used by both
 *  consumers so a single set of CSS rules and wiring code covers
 *  both.
 *
 *  `path` is this row's dotted-index address ("0", "0.2", ...),
 *  defaulting to `idx` for a top-level call so every existing
 *  top-level call site (`stepRowHTML(s, i)`) keeps working unchanged.
 *  `depth` is this row's nesting depth (0 = top-level), used only to
 *  decide whether the "Group" option should still be offered (see
 *  MAX_GROUP_DEPTH in the header comment) — a group step's own
 *  children are rendered by this same function calling itself again
 *  at depth + 1, one real implementation for flat and nested rows
 *  alike. */
export function stepRowHTML (step, idx, path = String(idx), depth = 0) {
  const def = PROGRAM_COMMANDS[step.cmd] ?? PROGRAM_COMMANDS.move
  const canOfferGroup = depth < MAX_GROUP_DEPTH
  const options = Object.entries(PROGRAM_COMMANDS)
    .filter(([key]) => key !== 'group' || canOfferGroup)
    .map(([key, c]) => /* html */`
      <option value="${key}" ${step.cmd === key ? 'selected' : ''}>${c.label}</option>
    `).join('')
  const fields = def.fields.map(f => /* html */`
    <label class="op-field">
      <span class="op-field-label">${f.label}</span>
      <input class="op-field-input" type="${f.type}" ${f.type === 'number' ? `step="${f.step ?? 1}"` : ''}
             data-path="${path}" data-field="${f.key}" value="${step[f.key] ?? f.default ?? ''}">
    </label>
  `).join('')

  const isGroup = step.cmd === 'group'
  const nestedHTML = isGroup ? groupBodyHTML(step, path, depth) : ''

  return /* html */`
    <div class="op-step ${isGroup ? 'op-step--group' : ''}" data-path="${path}" data-depth="${depth}">
      <div class="op-step-head">
        <span class="op-step-num">${idx + 1}.</span>
        ${isGroup ? `<button class="op-step-collapse" data-path="${path}" title="${step.collapsed ? 'Expand' : 'Collapse'}">${step.collapsed ? '▸' : '▾'}</button>` : ''}
        <select class="op-step-cmd" data-path="${path}">${options}</select>
        <button class="op-step-del" data-path="${path}" title="Remove step">✕</button>
      </div>
      <div class="op-step-fields">${fields}</div>
      ${nestedHTML}
    </div>
  `
}

/** A Group step's nested body — its own ordered list of child rows
 *  (rendered via stepRowHTML() recursively, one real implementation)
 *  plus an "+ Add Step" scoped to this group. Collapsed groups keep
 *  their body in the DOM (just hidden) so collapsing never loses
 *  wiring state or forces a rerender. */
function groupBodyHTML (step, path, depth) {
  const children = step.steps ?? []
  const rows = children.length
    ? children.map((s, i) => stepRowHTML(s, i, `${path}.${i}`, depth + 1)).join('')
    : '<div class="oi-program-empty">No steps in this group yet — add one below.</div>'
  return /* html */`
    <div class="op-group-body" data-group-path="${path}" style="${step.collapsed ? 'display:none' : ''}">
      <div class="op-group-steps">${rows}</div>
      <button class="op-step-add-nested" data-group-path="${path}">+ Add Step</button>
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

/** Appends one step onto the shared gsap timeline, in place — the
 *  guts of the old inline forEach in runProgram(), pulled out so a
 *  'group' step can call it again on its own children at depth + 1.
 *  A group's children land on the exact same timeline as everything
 *  else (not a nested sub-timeline), so they inherit whatever
 *  sequencing already governs top-level steps for free — a group
 *  doesn't change program timing semantics, only how steps are
 *  organized/edited. See MAX_GROUP_DEPTH in the header comment for
 *  why this recursion is capped. */
function appendStepToTimeline (tl, step, mesh, label, depth) {
  if (step.cmd === 'group') {
    if (depth >= MAX_GROUP_DEPTH) return // defensive — see header comment
    appendStepsToTimeline(tl, step.steps, mesh, label, depth + 1)
    return
  }

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
}

function appendStepsToTimeline (tl, steps, mesh, label, depth) {
  if (!Array.isArray(steps)) return
  steps.forEach(step => appendStepToTimeline(tl, step, mesh, label, depth))
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

  appendStepsToTimeline(tl, steps, mesh, label, 0)

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
