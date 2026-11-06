import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The interface rule (V274): no emoji in the interface; use plain Unicode symbols that follow the theme colour.
// Left alone on purpose: things that are CONTENT, not interface (the emoji picker and its data, store goods, currency flags, value-type icons).
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = new Set(['utils/OmniStoreTypes.js', 'utils/OmniCurrencies.js', 'utils/OmniStoreModel.js', 'utils/OmniStoreCatalogSchema.js', 'utils/OmniStoreLayouts.js', 'utils/DevOmniStoreData.js', 'ui/OmniStoreCatalogUI.js', 'ui/DevOmniStoreSettingsPanel.js', 'utils/OmniValueModel.js', 'ui/OmniEmojiPicker.js', 'tools/build-emoji-data.mjs', 'data/OmniEmojiData.js', 'data/OmniDocsData.js'])
const EMOJI = /[\u{1F000}-\u{1FAFF}⌚⌛⏩-⏳⏸-⏺◽◾☔☕♈-♓♿⚡⚪⚫⚽⚾⛄⛅⛎⛔⛪⛲⛳⛵⛺⛽✅✊✋✨❌❎❓-❕❗➕-➗➰➿⬛⬜⭐⭕]/u
function walk (dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.vendor', 'tests', 'docs', '.git'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out); else if (/\.(js|mjs|css|html)$/.test(e.name)) out.push(p)
  }
  return out
}
test('no emoji in the interface code (content files excepted)', () => {
  const bad = []
  for (const f of walk(ROOT)) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/'); if (CONTENT.has(rel)) continue
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => { const m = l.match(EMOJI); if (m) bad.push(`${rel}:${i + 1} ${m[0]}`) })
  }
  assert.deepEqual(bad, [])
})
