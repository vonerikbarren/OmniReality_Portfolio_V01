/**
 * utils/OmniEmojiCatalog.js — the "All emojis" demo store as a CATALOG (V181, SANDBOX)
 *
 * Pure: turns data/OmniEmojiData.js into an ordinary `omni-store-catalog/1` object (the same shape the AI template produces), so it goes
 * through the SAME validator (Schema.validateCatalog) and the SAME import (Store.importProducts + rememberUndo) as any pasted catalog.
 *
 *   one product per emoji · category = the Unicode group (e.g. "Smileys & Emotion") · sectionIds = [that group's section]
 *   sections   9 extra sections (EMOJI_SECTIONS), one per Unicode group, handed to Store.importProducts({ extraSections })
 *   shape      disc (an emoji reads best on a flat disc) · media {emoji, active 'emoji'}
 *   price      1-2 forms in the PAYABLE sandbox value types, spread deterministically by index (no randomness: the same catalog every time)
 *   stock      deterministic, 1..40
 * Everything is fake sandbox value.
 */

import { getEmojis, GROUP_NAMES, EMOJI_COUNT } from '../data/OmniEmojiData.js'
import { SCHEMA_ID } from './OmniStoreCatalogSchema.js'

export const DEMO_STORE_NAME = 'All emojis (demo)'
export const SECTION_PREFIX = 'emoji-'
const SLUGS = ['smileys', 'people', 'animals', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags']
const DESCS = [
  'Faces, hearts and feelings.', 'Hands, people, body parts and families.', 'Animals, plants and weather.', 'Food, drink and dishes.',
  'Places, buildings, vehicles and the sky.', 'Sports, games, arts and events.', 'Tools, tech, clothes and household things.', 'Signs, shapes, arrows and symbols.', 'Flags of countries, regions and more.',
]

/** The nine sections the demo brings: [{ id, name, desc }] in Unicode group order. */
export const EMOJI_SECTIONS = GROUP_NAMES.map((name, i) => ({ id: SECTION_PREFIX + SLUGS[i], name, desc: DESCS[i] }))
export const sectionIdOfGroup = (g) => EMOJI_SECTIONS[g]?.id ?? null

const hexOf = (e) => [...e].map(c => c.codePointAt(0).toString(16)).join('-')
/** A stable id for an emoji: 'e-1f600', 'e-1f468-200d-1f469-200d-1f467' (<= 64 characters for every emoji in the set). */
export const emojiProductId = (e) => 'e-' + hexOf(e)

/** The payable types in a stable order (the model already lists them in tier order). */
const payableTypes = (types) => (types ?? []).filter(t => t && t.payable !== false)

/**
 * @param {{types?: Array<{id:string, payable?:boolean, tier?:string}>, limit?: number}} opts  `types` = Value.getTypes(); `limit` caps the product count (tests)
 * @returns {{schema:string, store:{name:string,type:string}, products:object[]}}  (the sections are EMOJI_SECTIONS, passed to Store.importProducts separately)
 */
export function buildEmojiCatalog ({ types = [], limit = Infinity } = {}) {
  const pay = payableTypes(types)
  const n = pay.length
  const list = getEmojis()
  const products = []
  for (let i = 0; i < list.length && products.length < limit; i++) {
    const x = list[i]
    const forms = []
    if (n) {
      const a = pay[(i * 7 + x.g) % n]
      forms.push({ type: a.id, qty: 1 + ((i * 5 + x.g * 3) % 12) })
      const b = pay[(i * 3 + 1 + x.g) % n]
      if (b.id !== a.id && i % 3 !== 0) forms.push({ type: b.id, qty: 1 + ((i * 11 + 4) % 18) })
    }
    products.push({
      id: emojiProductId(x.e), name: x.n, emoji: x.e, category: GROUP_NAMES[x.g], sectionIds: [sectionIdOfGroup(x.g)], shape: 'disc',
      media: { emoji: x.e, image: null, video: null, active: 'emoji' },
      price: forms, stock: 1 + ((i * 13 + 5) % 40),
    })
  }
  return { schema: SCHEMA_ID, store: { name: DEMO_STORE_NAME, type: 'emoji' }, products }
}

export const DEMO_EMOJI_COUNT = EMOJI_COUNT
