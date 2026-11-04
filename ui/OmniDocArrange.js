/**
 * ui/OmniDocArrange.js (V263) — the page-shape choices that live in the "pages" dropdown of ⟐OmniDoc and the Doc node Inspector.
 * One list (Row, Grid, Tunnel, Spiral, Sphere inside, Sphere outside — everything utils/OmniDocPageLayouts.js knows) so a new layout added there shows up in both places.
 *   arrangeGroupHTML()                  the <optgroup> to put inside the pages <select>  (option values look like "arrange:helix")
 *   countSelectHTML(attr, value)        the "sheets" select (2, 4, 6, 8, 10, 25)
 *   runArrange(nodeId, value, count)    -> { ok, text }: a node already in a doc window changes shape in place (animated); any other doc node gets a new window of that shape.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { LAYOUTS, COUNTS } from '../utils/OmniDocPageLayouts.js'

export const LABELS = Object.freeze({ row: 'Row (side by side)', grid: 'Grid', tunnel: 'Tunnel (walls round you)', helix: 'Spiral (staircase)', sphereIn: 'Sphere – read from inside', sphereOut: 'Sphere – outside' })
export const DEFAULT_COUNT = 8
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function arrangeGroupHTML () {
  return `<optgroup label="Arrange in space">${LAYOUTS.map(l => `<option value="arrange:${esc(l)}">${esc(LABELS[l] ?? l)}</option>`).join('')}</optgroup>`
}
export function countSelectHTML (attr, value = DEFAULT_COUNT) {
  return `<select ${attr} aria-label="How many sheets for the arrangement" title="How many sheets (used when a new arrangement is made)">${COUNTS.map(c => `<option value="${c}"${Number(value) === c ? ' selected' : ''}>${c} sheets</option>`).join('')}</select>`
}
export function isArrange (value) { return typeof value === 'string' && value.startsWith('arrange:') }

export async function runArrange (nodeId, value, count = DEFAULT_COUNT) {
  try {
    const layout = String(value).slice('arrange:'.length); const dw = SERVICES.docwindow
    if (!LAYOUTS.includes(layout)) return { ok: false, text: 'Unknown shape.' }
    if (!dw) return { ok: false, text: 'The doc window module is not running.' }
    const w = dw.windowOf(nodeId)
    if (w) { if (w.layout === layout) return { ok: true, text: `Already a ${LABELS[layout] ?? layout}.` }; await dw.setLayout(w.id, layout); return { ok: true, text: `Switched to ${LABELS[layout] ?? layout}.` } }
    const made = dw.create({ from: nodeId, layout, count: Number(count) || DEFAULT_COUNT })
    return { ok: true, text: `Made ${made.slots.length} sheets as ${LABELS[layout] ?? layout}. Pick any of them to switch shape; flip with Omni Doc flip name(${made.id}).` }
  } catch (err) { return { ok: false, text: String(err?.message ?? err) } }
}
