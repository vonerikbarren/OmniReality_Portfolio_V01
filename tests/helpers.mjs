// Shared helpers for the node tests. Zero dependencies: node:test + node:assert only.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SKIP_DIRS = new Set(['node_modules', '.git', 'tests', 'docs', 'assets', '.vendor'])

export function walk (dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out) } else if (/\.(m?js)$/.test(e.name)) out.push(path.join(dir, e.name))
  }
  return out.sort()
}
export const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')
export const imp = (relPath) => import(pathToFileURL(path.join(ROOT, relPath)).href)

/** Browser globals the pure modules touch at import time or in a few functions. */
export function shimBrowser () {
  if (!globalThis.localStorage) { const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length () { return m.size } } }
  if (!globalThis.window) { globalThis.window = globalThis; globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {}; globalThis.dispatchEvent ??= () => true; globalThis.CustomEvent ??= class CustomEvent { constructor (t, o) { this.type = t; this.detail = o?.detail } } }
}

/** Hostile inputs every sanitizer must survive without throwing. */
export function hostile () {
  const proto = JSON.parse('{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":2}}}')
  const deep = {}; let c = deep; for (let i = 0; i < 200; i++) { c.a = {}; c = c.a }
  const cyc = {}; cyc.self = cyc
  return [undefined, null, 0, -1, NaN, Infinity, '', 'x', 'x'.repeat(100000), '<script>alert(1)</script>', [], [[]], [1, 2, 3], {}, { a: 1 }, proto, deep, cyc, true, false, () => 1, Symbol('s'), 10n,
    { version: 'x', faces: 'no', channels: 7, order: { length: 1e9 }, pages: '1e9', center: 'a', layout: {}, points: [[NaN, Infinity]] },
    { channels: Array.from({ length: 1000 }, () => ({ prop: 'pos.y', wave: 'curve', curve: Array.from({ length: 1000 }, (_, i) => [i, i]) })) }]
}
export const noPollution = () => ({}).polluted === undefined && Object.prototype.polluted === undefined
