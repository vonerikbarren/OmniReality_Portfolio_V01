/**
 * utils/OmniOrbPotentials.js (V234) — the OmniPotentials of each hand's orb: the full array of what COULD be done, as words, plus the
 * rotation that shows a few at a time and swaps them at random. Pure data and maths (no DOM, no THREE).
 *
 * The orb shows potentials (what is possible); the tools streaming into its core are what is actually available. Every pool is
 * about 30 English synonyms around the hand's idea, plus the same anchor idea in the other top-20 languages (a language-support test).
 *   lh  possibility (greyscale)      rh  making: ideas, colors, materials ...      conscious  perspective: insights, previews ...
 *   omnihand  the OmniProducts (the OmniStar product list, added at run time by the orb) and the word "products" in 19 languages
 */
export const LANGS = {
  zh: 'Chinese', hi: 'Hindi', es: 'Spanish', fr: 'French', ar: 'Arabic', bn: 'Bengali', pt: 'Portuguese', ru: 'Russian', ur: 'Urdu', id: 'Indonesian',
  de: 'German', ja: 'Japanese', sw: 'Swahili', mr: 'Marathi', te: 'Telugu', tr: 'Turkish', ta: 'Tamil', vi: 'Vietnamese', ko: 'Korean'
}
const T = (obj) => Object.entries(obj).map(([lang, word]) => ({ word, lang }))

export const HANDS = {
  lh: {
    title: 'LeftHand · possibility', anchor: 'possibility',
    palette: { core: '#ffffff', ring: '#c8c8c8', text: '#f0f0f0', disc: '#0e0e12', grey: true },
    en: ['Opportunities', 'Unknowns', 'Undefined', 'Possibilities', '?', 'Maybe', 'Perhaps', 'Potential', 'Unwritten', 'Open', 'Unmapped', 'What if', 'Latent', 'Prospect', 'Chance', 'Option', 'Probability', 'Promise', 'Capacity', 'Scope', 'Horizon', 'Opening', 'Nascent', 'Uncharted', 'Conceivable', 'Feasible', 'Budding', 'Unrealized', 'Contingency', 'Perchance'],
    tr: T({ zh: '可能性', hi: 'संभावना', es: 'posibilidad', fr: 'possibilité', ar: 'إمكانية', bn: 'সম্ভাবনা', pt: 'possibilidade', ru: 'возможность', ur: 'امکان', id: 'kemungkinan', de: 'Möglichkeit', ja: '可能性', sw: 'uwezekano', mr: 'शक्यता', te: 'అవకాశం', tr: 'olasılık', ta: 'சாத்தியம்', vi: 'khả năng', ko: '가능성' })
  },
  rh: {
    title: 'RightHand · making', anchor: 'idea',
    palette: { core: '#fff3d6', ring: '#ffb04a', text: '#ffffff', disc: '#140c14', grey: false },
    en: ['Ideas', 'Colors', 'Materials', 'Textures', 'Vectors', 'Points', 'Shapes', 'Forms', 'Patterns', 'Gradients', 'Lines', 'Surfaces', 'Tones', 'Hues', 'Fibers', 'Grains', 'Lights', 'Shadows', 'Rhythms', 'Angles', 'Planes', 'Curves', 'Volumes', 'Sketches', 'Concepts', 'Notions', 'Inspiration', 'Designs', 'Palettes', 'Pigments'],
    tr: T({ zh: '想法', hi: 'विचार', es: 'idea', fr: 'idée', ar: 'فكرة', bn: 'ধারণা', pt: 'ideia', ru: 'идея', ur: 'خیال', id: 'gagasan', de: 'Idee', ja: 'アイデア', sw: 'wazo', mr: 'कल्पना', te: 'ఆలోచన', tr: 'fikir', ta: 'யோசனை', vi: 'ý tưởng', ko: '아이디어' })
  },
  conscious: {
    title: 'ConsciousHand · perspective', anchor: 'perspective',
    palette: { core: '#d9f6ff', ring: '#6fd0ff', text: '#eaffff', disc: '#08121a', grey: false },
    en: ['Perspectives', 'Previews', 'Insights', 'Philosophies', 'Eyesights', 'Viewpoints', 'Outlooks', 'Vantage', 'Glimpse', 'Foresight', 'Worldview', 'Vision', 'Lens', 'Angle', 'Standpoint', 'Stance', 'Overview', 'Panorama', 'Awareness', 'Understanding', 'Discernment', 'Intuition', 'Clarity', 'Revelation', 'Reflection', 'Contemplation', 'Gaze', 'Focus', 'Frame', 'Sightline'],
    tr: T({ zh: '视角', hi: 'दृष्टिकोण', es: 'perspectiva', fr: 'perspective', ar: 'منظور', bn: 'দৃষ্টিভঙ্গি', pt: 'perspectiva', ru: 'перспектива', ur: 'نقطۂ نظر', id: 'perspektif', de: 'Perspektive', ja: '視点', sw: 'mtazamo', mr: 'दृष्टिकोन', te: 'దృక్పథం', tr: 'bakış açısı', ta: 'கண்ணோட்டம்', vi: 'quan điểm', ko: '관점' })
  },
  omnihand: {
    title: 'OmniHand · the OmniProducts', anchor: 'products',
    palette: { core: '#fff0b8', ring: '#ffd24a', text: '#fffbe6', disc: '#14110a', grey: false },
    en: ['Products', 'Realities', 'Offerings', 'Creations', 'Worlds', 'Tools', 'Spaces', 'Systems', 'Services', 'Works'],
    tr: T({ zh: '产品', hi: 'उत्पाद', es: 'productos', fr: 'produits', ar: 'منتجات', bn: 'পণ্য', pt: 'produtos', ru: 'продукты', ur: 'مصنوعات', id: 'produk', de: 'Produkte', ja: '製品', sw: 'bidhaa', mr: 'उत्पादने', te: 'ఉత్పత్తులు', tr: 'ürünler', ta: 'தயாரிப்புகள்', vi: 'sản phẩm', ko: '제품' })
  }
}
export const HAND_IDS = Object.keys(HANDS)
export const MAX_POOL = 64

/** The default pool for a hand: English synonyms then the translations (what the setting `orbWords` starts as). */
export const defaultPool = (hand) => { const h = HANDS[hand]; return h ? [...h.en, ...h.tr.map(t => t.word)].slice(0, MAX_POOL) : [] }

/** What a word is: { lang, langName, gloss } for a translation, or null for an English / user word. */
export function wordInfo (hand, word) {
  const h = HANDS[hand]; if (!h) return null
  const t = h.tr.find(x => x.word === word); return t ? { lang: t.lang, langName: LANGS[t.lang], gloss: h.anchor } : null
}

/** Deterministic-able random loop: show `n` words of `pool`, swap one random slot every `swapMs`. */
export function createLoop (pool, n = 12, rng = Math.random) {
  const list = [...new Set(pool)], k = Math.max(1, Math.min(n, list.length))
  const shuffled = list.map(w => [rng(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1])
  return { pool: list, shown: shuffled.slice(0, k), born: new Array(k).fill(-1e9), next: 0, n: k }
}
/** Advance the loop to time `now` (ms). Returns the slot index replaced, or -1. Never shows a word twice. */
export function stepLoop (loop, now, swapMs = 1400, rng = Math.random, locked = null) {
  if (loop.next === 0) { loop.next = now + swapMs; return -1 }
  if (now < loop.next) return -1
  loop.next = now + swapMs
  const spare = loop.pool.filter(w => !loop.shown.includes(w)); if (!spare.length) return -1
  const free = loop.shown.map((w, i) => i).filter(i => !locked?.has(loop.shown[i])); if (!free.length) return -1   // selected words stay
  const slot = free[Math.floor(rng() * free.length)], word = spare[Math.floor(rng() * spare.length)]
  loop.shown[slot] = word; loop.born[slot] = now; return slot
}
/** Re-point a loop at a changed pool, keeping the words that are still in it. */
export function syncLoop (loop, pool, n, rng = Math.random) {
  const list = [...new Set(pool)]
  if (list.length === loop.pool.length && list.every((w, i) => w === loop.pool[i]) && n === loop.n) return loop
  const keep = loop.shown.filter(w => list.includes(w)), fresh = createLoop(list, n, rng)
  const shown = [...keep, ...fresh.shown.filter(w => !keep.includes(w))].slice(0, fresh.n)
  return { ...fresh, shown, born: shown.map(() => -1e9) }
}
/** 0..1 fade-in of a slot that was swapped at `born` (ms), over `ms`. */
export const fadeIn = (born, now, ms = 700) => Math.max(0, Math.min(1, (now - born) / ms))
