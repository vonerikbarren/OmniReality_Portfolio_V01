import test from 'node:test'
import assert from 'node:assert/strict'
import * as S from '../utils/OmniSourceModel.js'
import { sanitizeEpistemics, sanitizeCite } from '../utils/OmniEpistemicsModel.js'
import { MEANING_IDS, applyMeaning, meaningOf } from '../utils/OmniLineModel.js'
import { NODES, SOURCES, sourceNodes, positionOf } from '../data/OmniMbtaCourse.js'

test('sanitizeSource: defaults, limits, https only, real dates', () => {
  const d = S.sanitizeSource(null); assert.deepEqual(d, S.defaultSource())
  const s = S.sanitizeSource({ title: 'x'.repeat(500), kind: 'nope', url: 'http://a.com', archiveUrl: 'javascript:alert(1)', published: '2022-02-31', accessed: '2022-02-28', trust: 7, proximity: 'primary', status: 'dead', evil: 1 })
  assert.equal(s.title.length, S.LIMITS.title); assert.equal(s.kind, 'other'); assert.equal(s.url, ''); assert.equal(s.archiveUrl, ''); assert.equal(s.published, ''); assert.equal(s.accessed, '2022-02-28')
  assert.equal(s.trust, 1); assert.equal(s.proximity, 'primary'); assert.equal(s.status, 'dead'); assert.ok(!('evil' in s))
  assert.deepEqual(S.sanitizeSource(s), s)
  assert.equal(S.safeUrl('https://user:pw@a.com/x'), ''); assert.equal(S.safeUrl('https://a.com/x y'), ''); assert.match(S.safeUrl('https://a.com/x'), /^https:\/\/a\.com\/x$/)
})
test('sameSource: by address first, then title + publisher', () => {
  assert.ok(S.sameSource({ url: 'https://www.A.com/x/?utm_source=z#top' }, { url: 'https://a.com/x' }))
  assert.ok(!S.sameSource({ url: 'https://a.com/x' }, { url: 'https://a.com/y' }))
  assert.ok(S.sameSource({ title: 'The  Report', publisher: 'NTSB' }, { title: 'the report', publisher: 'ntsb' }))
  assert.ok(!S.sameSource({}, {}))
})
test('effectiveTrust: dead and retracted count for little, tertiary for less, primary a little more', () => {
  const t = (o) => S.effectiveTrust({ trust: 0.8, ...o })
  assert.equal(t({}), 0.8); assert.ok(t({ status: 'dead' }) <= 0.3); assert.ok(t({ status: 'retracted' }) <= 0.05)
  assert.ok(t({ proximity: 'tertiary' }) < 0.8); assert.ok(t({ proximity: 'primary' }) > 0.8); assert.ok(t({ proximity: 'primary', trust: 1 }) <= 1)
})
test('staleness counts days; claimSupport is weakest or best', () => {
  assert.equal(S.staleness({ accessed: '2026-01-01' }, '2026-01-31'), 30); assert.equal(S.staleness({}, '2026-01-31'), null); assert.equal(S.staleness({ accessed: '2026-01-01' }, 'x'), null)
  const a = { trust: 0.9 }, b = { trust: 0.3 }
  assert.equal(S.claimSupport([a, b]).support, 0.3); assert.equal(S.claimSupport([a, b], { mode: 'best' }).support, 0.9)
  assert.deepEqual(S.claimSupport([]), { support: 0, count: 0, weakest: 0, best: 0, lowOnly: false }); assert.ok(S.claimSupport([b]).lowOnly)
})
test('fromEpistemics lifts the label and the address', () => {
  const x = S.fromEpistemics({ epistemics: { source: 'NTSB RRD22LR008', note: 'see https://www.ntsb.gov/investigations/Pages/RRD22LR008.aspx for more' } })
  assert.equal(x.title, 'NTSB RRD22LR008'); assert.equal(x.publisher, 'ntsb.gov'); assert.equal(x.kind, 'report'); assert.match(x.url, /^https:\/\/www\.ntsb\.gov/)
  assert.equal(S.fromEpistemics({ epistemics: { source: 'x', note: 'javascript:alert(1)' } }).url, '')
})
test('epistemics keeps sourceId and a short cite; the Cites line meaning exists', () => {
  const e = sanitizeEpistemics({ layer: 'event', text: 't', sourceId: 'src_1', cite: { page: 'p. 4', quote: 'q'.repeat(999) } })
  assert.equal(e.sourceId, 'src_1'); assert.equal(e.cite.page, 'p. 4'); assert.equal(e.cite.quote.length, 300); assert.deepEqual(sanitizeEpistemics(e), e)
  assert.equal(sanitizeEpistemics({ sourceId: '../x y' }).sourceId, ''); assert.deepEqual(sanitizeCite(null), { page: '', quote: '' })
  assert.ok(MEANING_IDS.includes('cites')); assert.equal(meaningOf(applyMeaning(null, 'cites')), 'cites')
})
test('MBTA sources: every cited address has one source, every claim with an address is cited once, no emoji, nothing overlaps', () => {
  const urls = NODES.map(n => (n.note.match(/https:\/\/\S+/) || [])[0]).filter(Boolean)
  assert.equal(new Set(SOURCES.map(s => s.key)).size, SOURCES.length)
  for (const u of new Set(urls)) assert.ok(SOURCES.some(s => s.key === u), 'no source for ' + u)
  const sn = sourceNodes(); assert.equal(sn.reduce((a, x) => a + x.citedBy.length, 0), urls.length)
  const at = new Set(NODES.map(n => positionOf(n).join(',')))
  for (const x of sn) {
    const s = S.sanitizeSource(x.spec); assert.equal(s.url, x.spec.url); assert.equal(s.title, x.spec.title); assert.equal(s.published, x.spec.published, x.id); assert.equal(s.trust, x.spec.trust)
    assert.ok(s.trustWhy.length > 0 && x.spec.trustWhy === s.trustWhy, x.id + ' why'); assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(JSON.stringify(x.spec)))
    const k = positionOf(x).join(','); assert.ok(!at.has(k), 'overlap ' + x.id); at.add(k)
  }
})
