/**
 * ui/OmniVoxelNodeInspector.js (V211) — the Inspector block of an OmniVoxelNode (the centre of one voxel room).
 * Shows which room it is, its subdivision and links, and opens ⟐OmniVoxel on that room. Read and written through Extra.SERVICES.voxel only.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { esc } from './OmniSoundFields.js'

const NAV_ITEM = '⟐OmniVoxel'
const svc = () => SERVICES.voxel

export function voxelNodeInfo (id) {
  const s = svc(); const d = s?.omniNode?.getNodeData?.(id); const room = d?.voxel?.room
  if (!s || !room || !s.grid.hasCell(room)) return null
  const pointId = s.pointOfNode?.(id) ?? null
  if (d.voxel.point && !pointId) return null
  return { room, pointId, isPoint: !!d.voxel.point, label: d.voxel.point ? (s.grid.points.get(d.voxel.point)?.label || '') : '', level: s.grid.levelOf(room), links: s.grid.neighbors(room).filter(n => n.linked).length }
}
/** Run one action; returns { ok, text }. Exported so tests call the same code the buttons do. */
export function runVoxelNodeAction (act, id) {
  const s = svc(); if (!s) return { ok: false, text: 'The voxel system is not running.' }
  const info = voxelNodeInfo(id); if (!info) return { ok: false, text: 'This room no longer exists.' }
  const av = SERVICES.avatar
  if (act === 'place' || act === 'goto') {
    if (!av) return { ok: false, text: 'The avatar is not running.' }
    const r = act === 'place' ? av.placeAt(info.pointId) : av.goTo(info.pointId)
    return r.ok ? { ok: true, text: act === 'place' ? 'Avatar placed here.' : (r.same ? 'Already here.' : 'On the way.') } : { ok: false, text: r.error }
  }
  if (act === 'open') { s.selectRoom(info.room); window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV_ITEM, drawer: 'inspector', parent: null, path: 'inspector/' + NAV_ITEM } })); return { ok: true, text: 'Opening ⟐OmniVoxel…' } }
  return { ok: false, text: 'Unknown action.' }
}
export function voxelKindBlockHTML (data) {
  const info = voxelNodeInfo(data.id)
  const text = info ? (info.isPoint ? `Point ${info.label || ''} in room ${info.room}` : `Room ${info.room} · ${info.level} per side · ${info.links} link${info.links === 1 ? '' : 's'}`) : 'This room or point is not in the grid.'
  return `<div class="oi-custom-section" id="oi-custom-voxel" data-kind="voxelNode" data-node-id="${esc(data.id)}">
    <div class="oi-custom-title">⟐ ${info?.isPoint ? 'Point node' : 'Voxel node'}</div>
    <div style="font-size:10px;opacity:.8;margin:4px 0" data-testid="oivx-state">${esc(text)}</div>
    <div style="margin:4px 0"><button class="oi-btn-small" data-oivxa="goto">➜ Go here</button> <button class="oi-btn-small" data-oivxa="place">⚑ Place avatar here</button> <button class="oi-btn-small" data-oivxa="open">⚙ Open ⟐OmniVoxel</button></div>
    <div style="font-size:9.5px;opacity:.75;line-height:1.4">The avatar travels the lines to this stop. Remove the room or point in ⟐OmniVoxel and this node goes with it.</div>
  </div>`
}
export function wireVoxelKindBlock (root, data) {
  const sec = root.querySelector?.('#oi-custom-voxel'); if (!sec || sec.dataset.wired === '1') return
  sec.dataset.wired = '1'
  sec.addEventListener('click', (e) => { const b = e.target.closest?.('[data-oivxa]'); if (b) runVoxelNodeAction(b.dataset.oivxa, data.id) })
}
