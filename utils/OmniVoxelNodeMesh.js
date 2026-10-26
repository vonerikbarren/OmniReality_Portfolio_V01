/**
 * utils/OmniVoxelNodeMesh.js (V211) — the GEOMETRY of the OmniVoxelNode: a small glowing diamond (octahedron) that sits at the centre of one voxel room.
 * It is the room's handle: select it to get the room's information (OmniScan reads it later) and to open ⟐OmniVoxel on that room.
 */
import * as THREE from 'three'

export const VOXEL_NODE_SIZE = 0.5
export function buildVoxelNodeMesh (color, point = false) {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color ?? 0xffd36b), roughness: 0.35, metalness: 0.2, emissive: new THREE.Color(color ?? 0xffd36b), emissiveIntensity: 0.35, flatShading: true })
  const mesh = new THREE.Mesh(point ? new THREE.IcosahedronGeometry(VOXEL_NODE_SIZE * 0.6, 1) : new THREE.OctahedronGeometry(VOXEL_NODE_SIZE, 0), mat)
  mesh.userData.voxelNode = true; mesh.userData.pointNode = !!point
  return mesh
}
export function releaseVoxelMesh (mesh) { try { mesh?.geometry?.dispose?.(); mesh?.material?.dispose?.() } catch (_) { /* already gone */ } }
