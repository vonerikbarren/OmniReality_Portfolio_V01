/**
 * utils/OmniSceneDecor.js (V239) — the old decoration shapes of the starting scene, now OFF by default.
 *   landingRoom    the cross of 7 translucent shapes (4 cardinal arms + centre + up + down)      modules/OmniLandingRoom.js
 *   portalSpheres  the ring of 5 portal spheres with their orbit rings                           modules/PortalSpheres.js
 *   trackingNodes  the two moving spheres with motion trails (click to lock on)                  systems/OmniTrackingNodes.js
 * Kept in the code so they can come back: Omni Decor show name(landingRoom), then reload the page. Saved in localStorage 'omni:scene-decor:v1'.
 * The OmniBrowser layered gridSphere, the Platform rings, the targeting reticle and every node you made are not decoration and are not touched.
 */
export const NAMES = ['landingRoom', 'portalSpheres', 'trackingNodes']
export const STORE_KEY = 'omni:scene-decor:v1'
export function load () {
  const out = { landingRoom: false, portalSpheres: false, trackingNodes: false }
  try { const v = JSON.parse(localStorage.getItem(STORE_KEY)); if (v && typeof v === 'object') for (const n of NAMES) if (typeof v[n] === 'boolean') out[n] = v[n] } catch (_) { /* default */ }
  return out
}
export const decorOn = (name) => !!load()[name]
export function setDecor (name, on) {
  if (!NAMES.includes(name)) throw new Error(`"${name}" is not decoration (${NAMES.join(', ')})`)
  const v = load(); v[name] = !!on
  try { localStorage.setItem(STORE_KEY, JSON.stringify(v)) } catch (_) { /* private mode */ }
  return v
}
