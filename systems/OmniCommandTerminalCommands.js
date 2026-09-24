/**
 * systems/OmniCommandTerminalCommands.js — the real, seven-command
 * starting set, per docs/omniproducts/
 * OMNICOMMANDTERMINAL_COMMAND_LANGUAGE_DESIGN.md's own table.
 *
 * Each command is a real translation of typed text into the exact
 * same window.dispatchEvent(...) call a button click or drag
 * gesture already triggers elsewhere — never a second, parallel
 * mechanism. Called once from main.js to register everything; help
 * itself is registered inside OmniCommandTerminalPanel.js, since
 * unlike these six, it has no other real system of its own to live
 * next to.
 */

import { registerCommand } from '../utils/CommandRegistry.js'
import { goToObject } from '../utils/CameraTravel.js'

function requireNode (omniNode, id, commandName) {
  const mesh = omniNode.getMeshById(id)
  if (!mesh) throw new Error(`⟐${commandName}: no real node found with id "${id}"`)
  return mesh
}

export function registerOmniCommandTerminalCommands (omniGrab) {
  registerCommand('ls', (args, termCtx) => {
    const nodes = termCtx.omniNode.getAllNodes()
    if (nodes.length === 0) return 'No real nodes exist yet.'
    return nodes.map(n => `${n.id}  ${n.label ?? ''}`).join('\n')
  }, 'Lists every real node')

  registerCommand('cd', (args, termCtx) => {
    const id = args[0]
    if (!id) throw new Error('⟐cd: real node id required — ⟐cd <id>')
    const mesh = requireNode(termCtx.omniNode, id, 'cd')
    goToObject(termCtx.ctx, mesh)
    termCtx.setCurrentContextNodeId(id)   // real, persistent context — assumption 2
    return `Entered ${id}.`
  }, 'Travels to a real node, sets it as the current context')

  registerCommand('create', (args, termCtx) => {
    const geometry = args[0] || 'BoxGeometry'
    const label = args[1] || 'Object'
    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: { label, geometry, primitive: 'objective', position: [0, 0, 0] },
    }))
    return `Created a real ${geometry} node.`
  }, 'Spawns a real node — ⟐create <geometry> <label>')

  registerCommand('inspect', (args, termCtx) => {
    const id = args[0] ?? termCtx.getCurrentContextNodeId()
    if (!id) throw new Error('⟐inspect: real node id required (or ⟐cd into one first)')
    const mesh = requireNode(termCtx.omniNode, id, 'inspect')
    const data = termCtx.omniNode.getNodeData(id)
    window.dispatchEvent(new CustomEvent('omni:node-selected', { detail: { node: data, mesh } }))
    return `Inspecting ${id}.`
  }, 'Opens the Inspector for a real node')

  registerCommand('present', (args, termCtx) => {
    const id = args[0] ?? termCtx.getCurrentContextNodeId()
    if (!id) throw new Error('⟐present: real node id required (or ⟐cd into one first)')
    const mesh = requireNode(termCtx.omniNode, id, 'present')
    window.dispatchEvent(new CustomEvent('omni:structure-focus', { detail: { mesh } }))
    return `Presenting ${id}.`
  }, 'Focuses a real node in OmniStructurePanel')

  registerCommand('pocket', (args, termCtx) => {
    const id = args[0] ?? termCtx.getCurrentContextNodeId()
    const handId = args[1] || 'omnihand'
    if (!id) throw new Error('⟐pocket: real node id required (or ⟐cd into one first)')
    const mesh = requireNode(termCtx.omniNode, id, 'pocket')
    omniGrab.sendToHand(mesh, handId)
    return `Placed ${id} in ${handId}.`
  }, 'Places a real node in a real hand — ⟐pocket <id> <handId>')
}
