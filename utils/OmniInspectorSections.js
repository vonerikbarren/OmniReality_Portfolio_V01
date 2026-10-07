/**
 * utils/OmniInspectorSections.js — the ONE list of Inspector sections (V170).
 *
 * Used by systems/OmniInspector.js (the section icon strip under the panel header) and by
 * ui/OmniRibbon.js (the Inspector tab), so the two cannot drift: same ids, same order, same glyphs,
 * same names, same descriptions. `id` is the data-section / #oisec-<id> id used in OmniInspector's DOM.
 *
 * `onlyFor` marks a section that exists only for some nodes (Location: only an OmniPointing location node).
 */

export const INSPECTOR_SECTIONS = Object.freeze([
  { id: 'identity',   label: 'Identity',   glyph: '◉', desc: 'ID, label, surface text and the primitive type of the node.' },
  { id: 'location',   label: 'Location',   glyph: '⌖', desc: 'Coordinate, title, color and space image of a location node.', onlyFor: 'location node (OmniPointing)' },
  { id: 'hierarchy',  label: 'Hierarchy',  glyph: '⌥', desc: 'Parent, root and depth; tunnel, time and merge options; where this node sits in the tree.' },
  { id: 'domain',     label: 'Domain',     glyph: '◍', desc: 'Makes the node a domain (a space you can enter): space image, auto-rotate and look-at.' },
  { id: 'appearance', label: 'Appearance', glyph: '◐', desc: 'Color, material, geometry, wireframe, sides, position, rotation and scale.' },
  { id: 'automation', label: 'Automation', glyph: '⟳', desc: 'Auto-rotate, look-at and the behavior / program the node runs on its own.' },
  { id: 'behavior',   label: 'Behavior',   glyph: '⚙', desc: 'The behavior attached to the node and whether it is enabled.' },
  { id: 'program',    label: 'Program',    glyph: '▶', desc: 'The OmniProgram bound to the node: run mode and auto-persist.' },
  { id: 'media',      label: 'Media',      glyph: '▣', desc: 'Images, sound and other media attached to the node.' },
  { id: 'data',       label: 'Data',       glyph: '≣', desc: 'Internal and external data, GoTo / TravelTo, and the info plane shown in the scene.' },
  { id: 'create',     label: 'Create New', glyph: '＋', desc: 'Create a new node with its own primitive, transform and parent.' },
])

export const INSPECTOR_SECTION_IDS = INSPECTOR_SECTIONS.map(s => s.id)
export const getInspectorSection = (id) => INSPECTOR_SECTIONS.find(s => s.id === id) ?? null
