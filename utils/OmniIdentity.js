/**
 * utils/OmniIdentity.js — the real, local list of OmniIdentities and
 * which one is currently active
 *
 * Confirmed directly: "different save states of the scene" — me as
 * a musician vs. me as a developer. Honest about what this actually
 * is right now: a real, local, named-profile switcher, not
 * server-backed authentication — there's no backend yet (a real,
 * separate, later decision, discussed elsewhere). Panels layer only,
 * per direction — this module gives them somewhere real to read
 * from and write to, without yet wiring per-identity data namespacing
 * across the rest of the project, which is real, separate, future
 * work of its own.
 */

const STORE_KEY = 'omni:identity:list'
const ACTIVE_KEY = 'omni:identity:active'

function loadList () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

function saveList (list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)) } catch (_) { /* real save simply skipped if storage unavailable */ }
}

export function getIdentities () {
  return loadList()
}

export function getActiveIdentity () {
  const list = loadList()
  const activeId = localStorage.getItem(ACTIVE_KEY)
  return list.find(i => i.id === activeId) ?? null
}

export function createIdentity (name) {
  const list = loadList()
  const identity = { id: `identity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, createdAt: Date.now() }
  list.push(identity)
  saveList(list)
  setActiveIdentity(identity.id)
  return identity
}

export function setActiveIdentity (id) {
  try { localStorage.setItem(ACTIVE_KEY, id) } catch (_) { /* real save simply skipped if storage unavailable */ }
  window.dispatchEvent(new CustomEvent('omni:identity-changed', { detail: { id } }))
}

export function deleteIdentity (id) {
  const list = loadList().filter(i => i.id !== id)
  saveList(list)
  if (localStorage.getItem(ACTIVE_KEY) === id) {
    try { localStorage.removeItem(ACTIVE_KEY) } catch (_) {}
    window.dispatchEvent(new CustomEvent('omni:identity-changed', { detail: { id: null } }))
  }
}
