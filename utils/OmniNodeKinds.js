/**
 * utils/OmniNodeKinds.js — the two OmniNode KINDS of V183 (BuildOrder OmniStore item 7), SANDBOX.
 *
 *   storeItem   an OmniNode that REPRESENTS one store product:  data = { nodeKind:'storeItem', storeId, productId }
 *   omniValue   an OmniNode that REPRESENTS one value type:     data = { nodeKind:'omniValue', valueTypeId }
 *
 * REGISTRY DECISION: these are ordinary OmniNode nodes (systems/OmniNode.js `_nodes`) that carry a kind marker in `data`, exactly like
 * isGroupNode / isSequenceNode / isEssenceNode do. Everything cross-cutting (Inspector, Timeline, Behaviors, FlowFire, grouping, duplicate,
 * delete, save / load, edges) already finds nodes through mesh.userData.nodeId, so they work with no change. The store scene's pooled shelf
 * meshes are NOT nodes (see docs/omniproducts/OMNISTORE_NODES_DESIGN.md).
 *
 * A node is a REFERENCE. Only the reference (and the usual position / scale / rotation / colour ...) is saved; name, price, stock, emoji, balance,
 * remainder and conversion rates are read LIVE from OmniStoreModel / OmniValueModel and never copied into the node. A missing reference gives a
 * 'missing' description (grey ❓ + a plain label), never a throw. CONVERSION STAYS AN EDGE: the rate for a pair of value nodes is read from the
 * model (`pairInfo`); there is no rate field anywhere on a node or an edge.
 *
 * Contents
 *   - pure descriptions   describeStoreItem(data), describeValueNode(data), pairInfo(typeA, typeB), valuePairOf(dataA, dataB), kindCreateFields(spec)
 *   - texture cache       ONE canvas texture per distinct emoji glyph and per distinct label text (refcounted, disposed at 0, capped), shared by
 *                         every node, so 200 nodes of 20 products hold about 40 textures, not 400
 *   - mesh                buildKindMesh(data, color) / refreshKindMesh(mesh) / releaseKindMesh(mesh); shared geometries (2); live registry
 *   - label sprites       attachLabel(sprite, lines) / detachLabel(sprite) for the conversion-rate label on an edge (systems/OmniStoreNodes.js)
 *
 * USER-facing module: it must never import a Dev* module.
 */

import * as THREE from 'three'
import * as Store from './OmniStoreModel.js'
import * as Value from './OmniValueModel.js'
import { TIER_COLOR } from './OmniValueViews.js'

export const KIND_STORE_ITEM = 'storeItem'
export const KIND_VALUE = 'omniValue'
export const KINDS = [KIND_STORE_ITEM, KIND_VALUE]
export const GEO_STORE_ITEM = 'StoreItemNode'
export const GEO_VALUE = 'OmniValueNode'
/** Hard bounds. Over the cap a glyph falls back to one shared '…' texture and a label is simply not drawn. */
export const LIMITS = { glyphTextures: 256, labelTextures: 256, labelChars: 28, labelLines: 3, glyphPx: 128, id: 64 }
export const SANDBOX_NOTE = 'Sandbox: all value is fake. No real payments.'

const fmt = Value.fmtQty
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif'
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)
const clip = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n - 1) + '…' : t }

export const isKindData = (d) => !!d && (d.nodeKind === KIND_STORE_ITEM || d.nodeKind === KIND_VALUE)
export const kindOf = (d) => (isKindData(d) ? d.nodeKind : null)

// ── Creation data ───────────────────────────────────────────────────────────────

/**
 * The node-data fields for a new kind node, from a spec ({nodeKind:'storeItem', storeId, productId} or {nodeKind:'omniValue', valueTypeId}).
 * Returns null for an invalid spec. The label is the NODE's own editable name (the live product / type name shows on the node face).
 */
export function kindCreateFields (spec) {
  if (!spec) return null
  if (spec.nodeKind === KIND_STORE_ITEM && idOk(spec.storeId) && idOk(spec.productId)) {
    const st = Store.peekStore(spec.storeId)
    const p = st?.products.find(x => x.id === spec.productId)
    return { nodeKind: KIND_STORE_ITEM, storeId: spec.storeId, productId: spec.productId, geometry: GEO_STORE_ITEM, label: clip(p?.name || 'Store item', 40) }
  }
  if (spec.nodeKind === KIND_VALUE && idOk(spec.valueTypeId)) {
    const t = Value.getType(spec.valueTypeId)
    return { nodeKind: KIND_VALUE, valueTypeId: spec.valueTypeId, geometry: GEO_VALUE, label: clip(t?.name || 'Value', 40) }
  }
  return null
}

// ── Descriptions (pure reads of the models) ─────────────────────────────────────

const GLYPH_BG = { veg: ['#eaf6dc', '#cfe8b8'], other: ['#fff1dc', '#ffd9b8'], missing: ['#e4e4e4', '#bdbdbd'] }

/**
 * What a storeItem node shows RIGHT NOW. state: 'ok' | 'missing-store' | 'missing-product'.
 * Never throws. Price forms are plain text and only the forms the store takes are listed (a store that takes everything lists all).
 */
export function describeStoreItem (d) {
  const out = {
    kind: KIND_STORE_ITEM, state: 'ok', storeId: d?.storeId ?? '', productId: d?.productId ?? '', storeName: '', storeEmoji: '', name: '', emoji: '❓', shape: 'cube', category: '',
    stock: 0, price: [], priceText: '', hiddenForms: 0, accepts: [], acceptsText: '', lines: [], glyph: null, missing: false,
  }
  try {
    const st = idOk(d?.storeId) ? Store.peekStore(d.storeId) : null
    if (!st) {
      Object.assign(out, { state: 'missing-store', missing: true, lines: ['Missing store', 'not in your stores'] })
    } else {
      out.storeName = st.name; out.storeEmoji = st.emoji
      const p = st.products.find(x => x.id === d.productId)
      if (!p) Object.assign(out, { state: 'missing-product', missing: true, lines: ['Missing product', clip(st.name, LIMITS.labelChars)] })
      else {
        out.name = p.name; out.emoji = p.media?.emoji || p.emoji || '❓'; out.shape = p.shape === 'disc' ? 'disc' : 'cube'; out.category = p.category; out.stock = p.stock
        const acc = Store.storeAccepts(st.id)
        out.accepts = acc.map(id => Value.getType(id)?.name ?? id)
        out.acceptsText = acc.length ? out.accepts.join(', ') : 'any value type'
        const forms = acc.length ? p.price.filter(f => acc.includes(f.type)) : p.price
        out.hiddenForms = p.price.length - forms.length
        out.price = forms.map(f => Value.describeForm(f))
        out.priceText = out.price.length ? out.price.join(' or ') : (p.price.length ? 'no form this store takes' : 'no price')
        out.lines = [clip(p.name, LIMITS.labelChars), clip(`${out.price[0] ?? 'no price'} · ${p.stock} left`, LIMITS.labelChars)]
      }
    }
    const veg = out.category === 'vegetable'
    out.glyph = out.missing ? { key: 'g|❓|missing', emoji: '❓', bg: GLYPH_BG.missing } : { key: `g|${out.emoji}|${veg ? 'v' : 'o'}`, emoji: out.emoji, bg: veg ? GLYPH_BG.veg : GLYPH_BG.other }
  } catch (_) {
    Object.assign(out, { state: 'missing-product', missing: true, lines: ['Missing product'], glyph: { key: 'g|❓|missing', emoji: '❓', bg: GLYPH_BG.missing } })
  }
  return out
}

/** What an omniValue node shows right now. state: 'ok' | 'missing-type'. Balance and remainder are the CURRENT account's. */
export function describeValueNode (d) {
  const out = {
    kind: KIND_VALUE, state: 'ok', valueTypeId: d?.valueTypeId ?? '', name: '', emoji: '❓', tier: '', unit: '', balance: 0, remainder: 0, step: 1,
    balanceText: '', remainderText: '', color: '#8892a6', payable: true, lines: [], glyph: null, missing: false,
  }
  try {
    const t = idOk(d?.valueTypeId) ? Value.getType(d.valueTypeId) : null
    if (!t) {
      Object.assign(out, { state: 'missing-type', missing: true, lines: ['Missing value type', 'not in the registry'] })
    } else {
      out.name = t.name; out.emoji = t.emoji || '◇'; out.tier = t.tier; out.unit = t.unit; out.step = t.step; out.payable = t.payable !== false
      out.color = TIER_COLOR[t.tier] ?? out.color
      out.balance = Value.getBalance(t.id); out.remainder = Value.getRemainderTotal(t.id)
      out.balanceText = `${fmt(out.balance)} ${t.unit}`
      out.remainderText = out.remainder > 0 ? `${fmt(out.remainder)} ${t.unit} left over (stated)` : 'no leftover'
      out.lines = [clip(t.name, LIMITS.labelChars), clip(`${t.tier} · ${out.balanceText}`, LIMITS.labelChars)]
      if (out.remainder > 0) out.lines.push(clip(`left over ${fmt(out.remainder)}`, LIMITS.labelChars))
    }
    const c = out.missing ? GLYPH_BG.missing : [out.color, out.color]
    out.glyph = out.missing ? { key: 'g|❓|missing', emoji: '❓', bg: GLYPH_BG.missing } : { key: `g|${out.emoji}|t${out.tier}`, emoji: out.emoji, bg: c, tint: true }
  } catch (_) {
    Object.assign(out, { state: 'missing-type', missing: true, lines: ['Missing value type'], glyph: { key: 'g|❓|missing', emoji: '❓', bg: GLYPH_BG.missing } })
  }
  return out
}

export const describe = (d) => (d?.nodeKind === KIND_STORE_ITEM ? describeStoreItem(d) : d?.nodeKind === KIND_VALUE ? describeValueNode(d) : null)
/** A short signature: when it is unchanged nothing about the node's face needs redrawing. */
export const descriptorSig = (ds) => `${ds.state}|${ds.glyph?.key}|${ds.shape ?? 'disc'}|${ds.lines.join('\n')}`

const edgeText = (e) => {
  const nm = (id) => Value.getType(id)?.name ?? id
  return `${fmt(e.rateDen)} ${nm(e.fromType)} → ${fmt(e.rateNum)} ${nm(e.toType)}${e.minQty ? ` (from ${fmt(e.minQty)})` : ''}${e.qualityRule ? ' (needs a good grade)' : ''}${e.owner ? ' (private rate)' : ''}`
}

/**
 * The conversion between TWO value types, read from the model (never stored): the direct edges each way, plain lines, and the arbitrage loops
 * that use one of those edges. `hasDirect` is false when the model has no conversion edge between the pair (nothing is invented: 'no direct rate').
 * Indirect routes (through a third type) are NOT shown here; the exchange finds those.
 */
export function pairInfo (typeA, typeB) {
  const out = { a: typeA, b: typeB, aName: typeA, bName: typeB, valid: false, same: typeA === typeB, forward: [], back: [], forwardLines: [], backLines: [], hasDirect: false, warnings: [], lines: [], shortLines: [] }
  try {
    const A = idOk(typeA) ? Value.getType(typeA) : null, B = idOk(typeB) ? Value.getType(typeB) : null
    out.aName = A?.name ?? String(typeA); out.bName = B?.name ?? String(typeB)
    if (!A || !B) { out.lines = ['One of the two value types is missing: no rate to show.']; out.shortLines = ['no direct rate']; return out }
    out.valid = true
    if (out.same) { out.lines = ['Same value type on both ends: nothing to convert.']; out.shortLines = ['same value type']; return out }
    const me = Value.currentAccountId()
    const usable = (e) => !e.owner || e.owner === me
    const edges = Value.getEdges().filter(usable)
    out.forward = edges.filter(e => e.fromType === typeA && e.toType === typeB)
    out.back = edges.filter(e => e.fromType === typeB && e.toType === typeA)
    out.forwardLines = out.forward.map(edgeText); out.backLines = out.back.map(edgeText)
    out.hasDirect = out.forward.length + out.back.length > 0
    const ids = new Set([...out.forward, ...out.back].map(e => e.id))
    if (ids.size) out.warnings = Value.findArbitrageLoops().filter(l => l.edges.some(id => ids.has(id))).map(l => l.line)
    if (!out.hasDirect) { out.lines = ['no direct rate']; out.shortLines = ['no direct rate'] } else {
      out.lines = [
        ...(out.forwardLines.length ? out.forwardLines.map(l => l) : [`${out.aName} → ${out.bName}: no direct rate`]),
        ...(out.backLines.length ? out.backLines : [`${out.bName} → ${out.aName}: no direct rate`]),
      ]
      out.shortLines = [out.forwardLines[0] ?? `${out.aName} → ${out.bName}: none`, out.backLines[0] ?? `${out.bName} → ${out.aName}: none`]
    }
  } catch (_) { out.lines = ['no direct rate']; out.shortLines = ['no direct rate'] }
  return out
}

/** The two value type ids when BOTH node datas are omniValue nodes, else null. */
export function valuePairOf (dataA, dataB) {
  return dataA?.nodeKind === KIND_VALUE && dataB?.nodeKind === KIND_VALUE && dataA.valueTypeId && dataB.valueTypeId ? [dataA.valueTypeId, dataB.valueTypeId] : null
}

// ── Texture cache (one canvas texture per distinct glyph / label, refcounted, capped) ───────

const cache = new Map()   // key -> { kind:'glyph'|'label', tex, refs, aspect }
const counts = { glyph: 0, label: 0, created: 0, disposed: 0 }

function canvasFor (w, h) {
  if (typeof document === 'undefined') return null
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  return cv
}

function makeGlyph (spec) {
  const size = LIMITS.glyphPx
  const cv = canvasFor(size, size)
  if (cv) {
    const g = cv.getContext('2d')
    if (g) {
      const grad = g.createLinearGradient ? g.createLinearGradient(0, 0, size, size) : null
      if (grad) { grad.addColorStop(0, spec.bg[0]); grad.addColorStop(1, spec.bg[1]); g.fillStyle = grad } else g.fillStyle = spec.bg[0]
      g.fillRect(0, 0, size, size)
      g.font = `${Math.round(size * 0.58)}px ${EMOJI_FONT}`
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'
      g.fillText(spec.emoji, size / 2, size / 2 + size * 0.04)
    }
  }
  const tex = cv ? new THREE.CanvasTexture(cv) : new THREE.Texture()
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: 1 }
}

const LABEL_W = 440, LABEL_LINE = 40
function makeLabel (lines) {
  const n = Math.max(1, Math.min(LIMITS.labelLines, lines.length))
  const H = n * LABEL_LINE + 16
  const cv = canvasFor(LABEL_W, H)
  if (cv) {
    const g = cv.getContext('2d')
    if (g) {
      g.fillStyle = 'rgba(8,8,12,0.78)'
      if (g.roundRect) { g.beginPath(); g.roundRect(0, 0, LABEL_W, H, 18); g.fill() } else g.fillRect(0, 0, LABEL_W, H)
      g.textAlign = 'center'; g.textBaseline = 'middle'
      lines.slice(0, n).forEach((ln, i) => {
        g.font = `${i === 0 ? 'bold ' : ''}24px 'Courier New', monospace`
        g.fillStyle = i === 0 ? '#ffffff' : 'rgba(255,255,255,0.8)'
        g.fillText(ln, LABEL_W / 2, 8 + LABEL_LINE * (i + 0.5))
      })
    }
  }
  const tex = cv ? new THREE.CanvasTexture(cv) : new THREE.Texture()
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: H / LABEL_W }
}

function acquire (kind, key, make, force = false) {
  let e = cache.get(key)
  if (!e) {
    if (!force && counts[kind] >= (kind === 'glyph' ? LIMITS.glyphTextures : LIMITS.labelTextures)) return null
    e = { kind, key, refs: 0, ...make() }
    cache.set(key, e); counts[kind]++; counts.created++
  }
  e.refs++
  return e
}

function release (key) {
  const e = key ? cache.get(key) : null
  if (!e) return
  e.refs--
  if (e.refs <= 0) { try { e.tex.dispose() } catch (_) { /* ignore */ } cache.delete(key); counts[e.kind]--; counts.disposed++ }
}

/** Glyph for a description; over the cap the shared '…' glyph stands in (one texture for all overflow). */
function acquireGlyph (g) {
  return acquire('glyph', g.key, () => makeGlyph(g)) ?? acquire('glyph', 'g|…|over', () => makeGlyph({ emoji: '…', bg: GLYPH_BG.missing }), true) ?? null
}

const labelKeyOf = (lines) => 'l|' + lines.join('\n')

/** Put `lines` on a THREE.Sprite as a (shared, refcounted) label texture; returns true when the sprite's label changed. No lines or over the cap -> hidden. */
export function attachLabel (sprite, lines) {
  const want = lines && lines.length ? labelKeyOf(lines.slice(0, LIMITS.labelLines)) : null
  if (sprite.userData.labelKey === want) return false
  const prev = sprite.userData.labelKey
  const e = want ? acquire('label', want, () => makeLabel(lines.slice(0, LIMITS.labelLines))) : null
  sprite.userData.labelKey = e ? want : null
  sprite.material.map = e ? e.tex : null
  sprite.material.needsUpdate = true
  sprite.visible = !!e
  if (e) { const w = sprite.userData.labelWidth ?? 2.6; sprite.scale.set(w, w * e.aspect, 1) }
  if (prev) release(prev)
  return true
}

/** Give back the sprite's label texture (idempotent). */
export function detachLabel (sprite) {
  const k = sprite?.userData?.labelKey
  if (!k) return
  sprite.userData.labelKey = null
  if (sprite.material) { sprite.material.map = null }
  release(k)
}

export function textureStats () {
  let refs = 0
  cache.forEach(e => { refs += e.refs })
  return { glyph: counts.glyph, label: counts.label, total: cache.size, refs, created: counts.created, disposed: counts.disposed }
}

// ── Shared geometries ───────────────────────────────────────────────────────────

const SHARED = { cube: null, disc: null }

/** OmniNode disposes `mesh.geometry` when a node goes; a shared geometry must survive that, so its dispose() is a no-op until disposeShared(). */
function pin (geo) { geo.userData.pinnedDispose = geo.dispose; geo.dispose = () => {}; return geo }

function sharedGeometry (shape) {
  if (shape === 'disc') {
    if (!SHARED.disc) {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 0.16, 28)
      g.rotateX(Math.PI / 2)   // the caps face +z / -z
      const grp = g.groups[2]   // the back cap: flip u so the glyph is not mirrored from behind
      if (grp) {
        const idx = g.index, uv = g.getAttribute('uv'), seen = new Set()
        for (let i = grp.start; i < grp.start + grp.count; i++) { const v = idx ? idx.getX(i) : i; if (!seen.has(v)) { seen.add(v); uv.setX(v, 1 - uv.getX(v)) } }
        uv.needsUpdate = true
      }
      SHARED.disc = pin(g)
    }
    return SHARED.disc
  }
  if (!SHARED.cube) SHARED.cube = pin(new THREE.BoxGeometry(0.9, 0.9, 0.9))
  return SHARED.cube
}

export function sharedGeometryCount () { return (SHARED.cube ? 1 : 0) + (SHARED.disc ? 1 : 0) }
/** Really free the two shared geometries (module destroy / tests). */
export function disposeShared () {
  for (const k of Object.keys(SHARED)) { const g = SHARED[k]; if (g) { g.dispose = g.userData.pinnedDispose; g.dispose(); SHARED[k] = null } }
}

// ── The mesh ────────────────────────────────────────────────────────────────────

const LIVE = new Set()   // every live kind mesh (so the models' change events can refresh them without reading either node registry)
export const liveKindMeshes = () => [...LIVE]
export function kindStats () {
  let storeItems = 0, values = 0, missing = 0
  LIVE.forEach(m => { const kd = m.userData.omniKind; if (!kd) return; if (kd.kind === KIND_STORE_ITEM) storeItems++; else values++; if (kd.missing) missing++ })
  return { nodes: LIVE.size, storeItems, valueNodes: values, missing, textures: textureStats(), sharedGeometries: sharedGeometryCount() }
}

const MISSING_COLOR = 0x888888

function applyDescription (mesh, ds) {
  const kd = mesh.userData.omniKind
  if (!kd) return false
  const sig = descriptorSig(ds)
  if (kd.sig === sig) return false
  kd.sig = sig
  const mat = mesh.material
  // face texture
  if (kd.glyphKey !== ds.glyph.key) {
    const e = acquireGlyph(ds.glyph)
    const prev = kd.glyphKey
    kd.glyphKey = e ? e.key : null
    mat.map = e ? e.tex : null
    mat.needsUpdate = true
    if (prev) release(prev)
  }
  // shape
  const shape = ds.shape ?? 'disc'
  if (kd.shape !== shape) { kd.shape = shape; mesh.geometry = sharedGeometry(shape) }
  // missing look: grey, remembered colour comes back when the reference does
  if (ds.missing && !kd.missing) { kd.prevColor = mat.color.getHex(); mat.color.setHex(MISSING_COLOR) } else if (!ds.missing && kd.missing && kd.prevColor !== undefined) { mat.color.setHex(kd.prevColor); kd.prevColor = undefined }
  kd.missing = ds.missing
  kd.state = ds.state
  // label
  attachLabel(kd.label, ds.lines)
  return true
}

/** Build the mesh for a kind node: ONE Mesh (shared geometry, one material with the shared glyph texture) + one label Sprite child. */
export function buildKindMesh (data, color) {
  const ds = describe(data)
  const mat = new THREE.MeshStandardMaterial({ color: color ?? 0xffffff, roughness: 0.5, metalness: 0.05 })
  const mesh = new THREE.Mesh(sharedGeometry(ds.shape ?? 'disc'), mat)
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
  label.position.set(0, 0.95, 0)
  label.userData.isKindLabel = true
  label.userData.labelWidth = 2.6
  label.visible = false
  mesh.add(label)
  mesh.userData.omniKind = { kind: data.nodeKind, data, label, sig: '', glyphKey: null, shape: ds.shape ?? 'disc', missing: false, state: ds.state }
  LIVE.add(mesh)
  applyDescription(mesh, ds)
  return mesh
}

/** Re-read the models for one mesh and redraw only what changed. Returns true when the face changed. */
export function refreshKindMesh (mesh, cacheMap = null) {
  const kd = mesh?.userData?.omniKind
  if (!kd) return false
  const d = kd.data
  const k = d.nodeKind === KIND_STORE_ITEM ? `s|${d.storeId}|${d.productId}` : `v|${d.valueTypeId}`
  let ds = cacheMap?.get(k)
  if (!ds) { ds = describe(d); cacheMap?.set(k, ds) }
  return applyDescription(mesh, ds)
}

/** Refresh every live kind mesh (one description per distinct reference). Returns how many faces changed. */
export function refreshAll () {
  const memo = new Map()
  let n = 0
  LIVE.forEach(m => { if (refreshKindMesh(m, memo)) n++ })
  return n
}

/** Give back this mesh's textures and registry slot. Idempotent; call before the mesh's material is disposed. The shared geometry is not disposed. */
export function releaseKindMesh (mesh) {
  const kd = mesh?.userData?.omniKind
  if (!kd) return
  delete mesh.userData.omniKind
  LIVE.delete(mesh)
  detachLabel(kd.label)
  kd.label.material?.dispose()
  mesh.remove(kd.label)
  if (kd.glyphKey) release(kd.glyphKey)
  if (mesh.material) mesh.material.map = null
  kd.data = null
}
