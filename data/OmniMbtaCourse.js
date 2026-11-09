/**
 * data/OmniMbtaCourse.js (V280) — the first course: Boston's MBTA subway. Old trains, the problems they caused, and why newer trains were bought (problem -> solution).
 * Pure data. Every node is an Epistemics node (layer: event = what happened, documentary = a record or report, meta = a caution about how to read it,
 * absence = what the sources do not say, counterfactual = what if) with its source in `source` (short) and `note` (the address). Facts come from claude/MBTA_COURSE_NOTES.md (research of 2026-11-07).
 * Layout: x = col * 7, y = -row * 4 (row 0 on top), z = lane * 12 (lanes: red, orange, green, mattapan); the overview sits at the left. Lines use the Line meanings: step (next in time), flow (a problem leads to a response), note (attached).
 * utils/OmniStoredRealityModel.js packs these nodes into a StoredRealityNode (systems/OmniStoredReality.js buildExample('mbta')).
 */
export const COURSE = Object.freeze({
  id: 'mbta_course', name: 'MBTA: old trains, new trains',
  summary: 'Boston subway: the problems older trains caused and why newer ones were bought. Expand to walk it: four lanes (Red, Orange, Green, Mattapan). Facts as reported; sources in each node.',
  scale: 12
})
export const LANES = Object.freeze({ overview: -1, red: 0, orange: 1, green: 2, mattapan: 3 })
const U = {
  rl19: 'https://www.bostonglobe.com/metro/2019/09/16/attributes-red-line-derailment-broken-subway-axle/SlnOglTe0kZ6jSqWC8YnII/story.html',
  ntsb: 'https://www.ntsb.gov/investigations/Pages/RRD22LR008.aspx',
  globe22: 'https://www.boston.com/news/the-boston-globe/2022/12/19/robinson-lalin-was-killed-by-a-faulty-red-line-car-it-should-have-been-off-the-tracks-decades-ago/',
  wbur16: 'https://www.wbur.org/news/2016/12/12/mbta-red-line-fleet-replacement',
  mt16: 'https://www.masstransitmag.com/rail/press-release/12287155/massachusetts-bay-transportation-authority-mbta-mbta-purchases-an-additional-120-new-red-line-cars',
  bos26: 'https://www.boston25news.com/news/local/new-red-line-trains-delayed-again-mbta-drops-2027-delivery-deadline/7YGW4SXZWFCUZE3RHPH6FIWOLM/',
  streets: 'https://mass.streetsblog.org/2026/01/28/the-red-lines-old-trains-cant-cope-with-the-cold',
  ol18: 'https://www.bostonglobe.com/metro/2018/11/26/the-old-orange-line-cars-are-gearing-for-their-final-rides/0cRA0ViJ8kz5WSaVP2M5bN/story.html',
  fire: 'https://www.turnto10.com/news/local/investigation-boston-train-fire-caused-by-loose-metal-panel-july-22-2022',
  rail14: 'https://www.railwayage.com/?p=11300',
  mt19: 'https://www.masstransitmag.com/rail/vehicles/press-release/21092874/massachusetts-bay-transportation-authority-mbta-first-new-mbta-orange-line-cars-enter-passenger-service',
  scrap: 'https://www.cbsnews.com/amp/boston/news/mbta-old-orange-line-cars-scrap-heap',
  wel21: 'https://www.bostonglobe.com/2021/05/10/metro/new-subway-cars-will-remain-out-service-officials-discover-another-problem',
  wbur25: 'https://www.wbur.org/news/2025/11/20/orange-line-cars-delayed-forced-labor',
  cbsgl: 'https://www.cbsnews.com/amp/boston/news/100-supercars-replace-trains-green-line-mbta',
  t10: 'https://en.wikipedia.org/wiki/MBTA_CAF_USA_Type_10',
  t9: 'https://en.wikipedia.org/wiki/MBTA_CAF_USA_Type_9',
  wbur19: 'https://www.wbur.org/news/2019/01/28/mbta-ashmont-mattapan-trolley-plan',
  dot26: 'https://www.dotnews.com/2026/01/08/the-worst-or-a-teddy-bear-providing-neighborhood-glue-two-views-on-future-of-mattapan-trolley-line/'
}
const n = (id, lane, col, row, layer, text, source, note) => ({ id: 'mbta_' + id, lane, col, row, layer, text, source, note })
export const NODES = Object.freeze([
  n('ov', 'overview', -2, 0.5, 'meta', 'MBTA subway: older trains, the problems they caused, and why newer trains were bought. Each node says what happened; each line says how it connects. Sources are in each node\'s note. Researched Nov 7, 2026.', 'Course overview', 'Research notes: claude/MBTA_COURSE_NOTES.md. Figures are as reported; where sources disagree the nodes say so.'),
  // ── Red Line ──
  n('r1', 'red', 0, 0, 'event', 'June 11, 2019: a 1969-built Red Line car derails at JFK/UMass. A front axle, installed in 1992, broke.', 'Boston Globe 2019-09-16', U.rl19),
  n('r2', 'red', 1, 0, 'documentary', 'The MBTA said a poor electrical connection let current arc through the axle for about six months, making the steel brittle. Inspections in Oct and Dec 2018 and Mar and May 2019 did not catch it.', 'Boston Globe 2019-09-16', U.rl19),
  n('r3', 'red', 2, 0, 'event', 'April 10, 2022: a passenger is killed at Broadway when a Red Line car (number 1510, built 1969) moves with the person caught in a door.', 'Boston Globe 2022-12-19', U.globe22),
  n('r4', 'red', 3, 0, 'documentary', 'NTSB probable cause: "a short circuit in the passenger door interlock circuit". The short came after a 2017 rebuild of a part: wire strands touched a mounting screw.', 'NTSB RRD22LR008', U.ntsb),
  n('r5', 'red', 4, 0, 'meta', 'Read with care: the NTSB names a wiring fault after a 2017 rebuild. That the cars should have been retired long before is the Boston Globe\'s analysis (retirement dates slipped repeatedly), not the NTSB\'s finding.', 'Caution', U.globe22),
  n('r10', 'red', 5, 0, 'event', 'Jan 27-28, 2026: in single-digit cold the oldest Red Line cars struggle. 9 trains ran on the whole line versus about 20 on a typical day.', 'Streetsblog 2026-01-28', U.streets),
  n('rd', 'red', 0, 1, 'meta', 'Order matters: the plan to replace the Red Line fleet was funded in 2014 and 2016, before the 2019 derailment. The derailment did not cause the purchase.', 'Caution', U.wbur16),
  n('r6', 'red', 1, 1, 'event', 'Dec 12, 2016: the MBTA board approves 120 more new Red Line cars (up to $277 million) to replace the whole old fleet. With the 2014 order, 252 new cars in all.', 'WBUR and Mass Transit 2016-12-12', U.mt16),
  n('r7', 'red', 2, 1, 'documentary', 'Why buy instead of overhaul, as officials said it: new cars cost $310,000 less per car than updating the old ones, and one standard fleet would raise trains per hour from 13 to 20.', 'WBUR 2016-12-12', U.wbur16),
  n('r8', 'red', 3, 1, 'counterfactual', 'What if the old cars had been overhauled instead? The original plan was to overhaul about 84 mid-1990s cars. The cost comparison comes from MBTA officials, not an independent audit.', 'WBUR 2016-12-12', U.wbur16),
  n('r9', 'red', 4, 1, 'event', 'Oct 2026: the MBTA drops its end-2027 deadline. 68 of 252 new Red Line cars are delivered; U.S. Customs held partly built cars for about 10 months.', 'Boston 25 News 2026-10', U.bos26),
  // ── Orange Line ──
  n('o1', 'orange', 0, 0, 'event', '2018: four Orange Line cars (1242, 1243, 1258, 1259) are taken out after repeated propulsion failures from electrical surges. The old fleet is about 38 years old.', 'Boston Globe 2018-11-26', U.ol18),
  n('o2', 'orange', 1, 0, 'event', 'July 21, 2022: an Orange Line train burns on the Mystic River bridge. About 200 people aboard get out; windows are removed to escape; no one is hurt. The car is 43 years old.', 'Turn To 10 2022-07-22', U.fire),
  n('o3', 'orange', 2, 0, 'documentary', 'Preliminary cause: a loose, rusted "sill" panel touched the third rail and sparks lit materials. The car had been inspected less than a month before.', 'Turn To 10 and FTA 2022', U.fire),
  n('o9', 'orange', 3, 0, 'meta', 'Caution: the 30-day Orange Line shutdown in Aug-Sep 2022 was mainly track and signal work, not a train problem. Do not teach it as an old-train effect.', 'Research notes', 'https://www.wbur.org/news/2022/08/03/mbta-orange-line-shutdown'),
  n('o4', 'orange', 0, 1, 'event', 'Oct 2014: MassDOT orders 152 new Orange Line cars from CNR Changchun (now CRRC) for about $566.6 million, built at Springfield, Massachusetts.', 'Railway Age 2014', U.rail14),
  n('o5', 'orange', 1, 1, 'documentary', 'What the MBTA said it would gain: 4.5-minute waits instead of 6, about 30,000 more daily riders, almost 40% more capacity, a 30-year life, and more accessible spaces in each car.', 'MBTA release 2019', U.mt19),
  n('o6', 'orange', 2, 1, 'event', 'Aug 2019: the first new train enters service. Sept 22, 2022: the first old cars, about 40 years old, are trucked to scrap.', 'Mass Transit and CBS Boston', U.scrap),
  n('o7', 'orange', 3, 1, 'event', 'Mar 17, 2021: a new train derails near Wellington and all new CRRC cars are pulled for weeks. In 2022 new cars are pulled again for sheared brake bolts (May) and a battery explosion (June).', 'Boston Globe 2021-05-10 and FTA', U.wel21),
  n('o8', 'orange', 4, 1, 'event', 'Nov 2025: deliveries miss the Sept 2025 deadline because U.S. Customs held shells under the Uyghur Forced Labor Prevention Act. 150 of 152 cars expected. CRRC says it did not violate the act.', 'WBUR 2025-11-20', U.wbur25),
  // ── Green Line ──
  n('g2', 'green', 0, 0, 'absence', 'Not in the sources found: failure figures for the older Green Line cars. A 2016 Globe headline says the Green Line had the most derailments in the nation, but that article could not be read.', 'Research notes', 'https://www.bostonglobe.com/metro/2016/10/12/green-line-suffered-little-noticed-string-derailments-over-past-two-years/xZhLbzp01WLdBs9hhO9NNN/story.html'),
  n('g1', 'green', 1, 0, 'event', 'The older Green Line cars (Type 7, mostly built 1986-88, and Type 8) are to be replaced over the next decade, with stairs and high floors among the gaps the new cars close.', 'CBS Boston 2022', U.cbsgl),
  n('g5', 'green', 2, 0, 'event', 'Type 9 (24 cars, $118 million, first in service Dec 2018) was bought for the Green Line Extension, not to replace old cars. Apr 17, 2023: a floor panel buckled at Boylston and all Type 9 cars were briefly pulled.', 'Wikipedia (medium confidence)', U.t9),
  n('g3', 'green', 1, 1, 'event', 'Aug 2022: the MBTA awards CAF USA about $811 million for 102 new Type 10 "supercars": fully low-floor, wider doors, longer cars, a closed operator cab.', 'CBS Boston 2022', U.cbsgl),
  n('g4', 'green', 2, 1, 'documentary', 'Stated aims of the new cars, in the MBTA\'s words: increased safety, accessibility, capacity and maintainability.', 'CBS Boston 2022', U.cbsgl),
  n('g6', 'green', 3, 1, 'event', 'The schedule slipped: Sept 2022 said first cars in spring 2026. As of April 2026 a prototype was expected late 2026, service early 2027 and all 102 by 2031.', 'Wikipedia citing MBTA (medium)', U.t10),
  // ── Mattapan ──
  n('m1', 'mattapan', 0, 0, 'event', 'The Mattapan trolley still runs PCC cars built in the mid-1940s. Parts no longer exist so staff make them by hand. The cars do poorly in snow and are not fully accessible.', 'WBUR 2019-01-28', U.wbur19),
  n('m2', 'mattapan', 1, 0, 'event', 'Jan 2019 plan: refurbish the PCCs for 8-10 more years (about $7.9 million, around $1 million a car), then upgrade the line and bring in Type 9 cars. Buses were rejected as costlier; bridges too narrow.', 'WBUR 2019-01-28', U.wbur19),
  n('m3', 'mattapan', 2, 0, 'event', 'Jan 2026: four PCCs rehabbed since 2019, a fifth in work. The Type 9 project is "essentially stuck in neutral" at about 15% design; the MBTA says it lacks funds for the line upgrade.', 'DorNews 2026-01-08', U.dot26),
  n('m4', 'mattapan', 3, 0, 'meta', 'Here the old-train to new-train fix has NOT happened; the fix so far is refurbishment. People disagree about whether the old cars should stay.', 'Research notes', U.dot26)
])
const e = (a, b, meaning) => ({ from: 'mbta_' + a, to: 'mbta_' + b, meaning })
export const EDGES = Object.freeze([
  e('ov', 'r1', 'note'), e('ov', 'o1', 'note'), e('ov', 'g2', 'note'), e('ov', 'm1', 'note'),
  e('r1', 'r2', 'step'), e('r3', 'r4', 'step'), e('r4', 'r5', 'note'), e('rd', 'r1', 'note'), e('rd', 'r6', 'note'),
  e('r6', 'r7', 'step'), e('r7', 'r8', 'note'), e('r6', 'r9', 'step'), e('r10', 'r9', 'note'),
  e('o2', 'o3', 'step'), e('o1', 'o5', 'note'), e('o3', 'o6', 'note'), e('o4', 'o5', 'step'), e('o5', 'o6', 'step'), e('o6', 'o7', 'step'), e('o7', 'o8', 'step'), e('o9', 'o7', 'note'),
  e('g2', 'g1', 'note'), e('g1', 'g3', 'flow'), e('g3', 'g4', 'step'), e('g3', 'g6', 'step'), e('g5', 'g3', 'note'),
  e('m1', 'm2', 'flow'), e('m2', 'm3', 'step'), e('m3', 'm4', 'note')
])
/** world position of a course node around an anchor [x, y, z] */
export function positionOf (node, anchor = [0, 0, 0]) { return [anchor[0] + node.col * 7, anchor[1] - node.row * 4, anchor[2] + (LANES[node.lane] ?? 0) * 12 - 18] }

// ── shared sources (V281) ──
// One SourceNode per address; every course node that rests on an address cites it (a "Cites" line). The trust numbers are a first rating by the course's author, written with a reason; change them in the node.
// publish dates come from the dates in the addresses themselves; nothing is guessed (a missing date stays empty).
const S = (key, title, publisher, kind, proximity, trust, trustWhy, published = '') => ({ key, title, publisher, kind, proximity, trust, trustWhy, published })
export const SOURCES = Object.freeze([
  S(U.rl19, 'Attributes of the Red Line derailment: a broken subway axle', 'Boston Globe', 'news', 'secondary', 0.8, 'Established paper; reports the MBTA\'s own findings.', '2019-09-16'),
  S(U.globe22, 'Robinson Lalin was killed by a faulty Red Line car; it should have been off the tracks decades ago', 'Boston Globe (via Boston.com)', 'news', 'secondary', 0.8, 'Established paper; a reprint on its sister site.', '2022-12-19'),
  S(U.ntsb, 'NTSB investigation RRD22LR008: Red Line, Broadway station', 'NTSB', 'report', 'primary', 0.95, 'The federal investigator\'s own record.'),
  S(U.streets, 'The Red Line\'s old trains can\'t cope with the cold', 'Streetsblog Massachusetts', 'news', 'secondary', 0.7, 'Advocacy outlet; check figures against the MBTA.', '2026-01-28'),
  S(U.wbur16, 'MBTA Red Line fleet replacement', 'WBUR', 'news', 'secondary', 0.8, 'Public radio; reports the board vote.', '2016-12-12'),
  S(U.mt16, 'MBTA purchases an additional 120 new Red Line cars', 'Mass Transit (press release)', 'report', 'primary', 0.75, 'The agency\'s own announcement: accurate on what it did, silent on what went wrong.'),
  S(U.bos26, 'New Red Line trains delayed again; MBTA drops 2027 delivery deadline', 'Boston 25 News', 'news', 'secondary', 0.7, 'Local TV; recent, so details may change.'),
  S(U.ol18, 'The old Orange Line cars are gearing up for their final rides', 'Boston Globe', 'news', 'secondary', 0.8, 'Established paper.', '2018-11-26'),
  S(U.fire, 'Investigation: Boston train fire caused by loose metal panel', 'Turn To 10', 'news', 'secondary', 0.75, 'Local TV reporting a federal and MBTA finding.', '2022-07-22'),
  S('https://www.wbur.org/news/2022/08/03/mbta-orange-line-shutdown', 'MBTA Orange Line shutdown', 'WBUR', 'news', 'secondary', 0.8, 'Public radio.', '2022-08-03'),
  S(U.rail14, 'MassDOT orders 152 new Orange Line cars', 'Railway Age', 'news', 'secondary', 0.75, 'Trade press.'),
  S(U.mt19, 'First new MBTA Orange Line cars enter passenger service', 'Mass Transit (press release)', 'report', 'primary', 0.75, 'The agency\'s own announcement.'),
  S(U.scrap, 'MBTA old Orange Line cars to the scrap heap', 'CBS Boston', 'news', 'secondary', 0.7, 'Local TV.'),
  S(U.wel21, 'New subway cars will remain out of service as officials discover another problem', 'Boston Globe', 'news', 'secondary', 0.8, 'Established paper.', '2021-05-10'),
  S(U.wbur25, 'Orange Line cars delayed over forced labor', 'WBUR', 'news', 'secondary', 0.8, 'Public radio.', '2025-11-20'),
  S('https://www.bostonglobe.com/metro/2016/10/12/green-line-suffered-little-noticed-string-derailments-over-past-two-years/xZhLbzp01WLdBs9hhO9NNN/story.html', 'Green Line suffered a little-noticed string of derailments over the past two years', 'Boston Globe', 'news', 'secondary', 0.8, 'Established paper.', '2016-10-12'),
  S(U.cbsgl, '100 supercars to replace trains on the Green Line', 'CBS Boston', 'news', 'secondary', 0.7, 'Local TV.'),
  S(U.t9, 'MBTA CAF USA Type 9', 'Wikipedia', 'other', 'tertiary', 0.5, 'A summary of other sources; use it to find them, not instead of them.'),
  S(U.t10, 'MBTA CAF USA Type 10', 'Wikipedia', 'other', 'tertiary', 0.5, 'A summary of other sources; use it to find them, not instead of them.'),
  S(U.wbur19, 'Plan for the Ashmont to Mattapan trolley line', 'WBUR', 'news', 'secondary', 0.8, 'Public radio.', '2019-01-28'),
  S(U.dot26, 'The worst, or a teddy bear providing neighborhood glue: two views on the future of the Mattapan trolley line', 'Dorchester Reporter', 'news', 'secondary', 0.7, 'Neighbourhood paper; two opinions, not a finding.', '2026-01-08')
])
const urlOf = (n) => (String(n.note).match(/https:\/\/\S+/) || [])[0] || ''
/** the source nodes of the course: { id, spec, col, row, lane, citedBy[] }. Each sits below the lane of the nodes that cite it (one row, spread left to right). */
export function sourceNodes () {
  const maxRow = Math.max(...NODES.map(n => n.row)); const perLane = {}; const out = []
  SOURCES.forEach((s, i) => {
    const cites = NODES.filter(n => urlOf(n) === s.key); if (!cites.length) return
    const lane = cites[0].lane; const k = perLane[lane] = (perLane[lane] ?? 0) + 1
    out.push({ id: 'mbta_src' + (i + 1), spec: { title: s.title, publisher: s.publisher, kind: s.kind, proximity: s.proximity, trust: s.trust, trustWhy: s.trustWhy, published: s.published, url: s.key, accessed: '2026-11-07' }, col: (k - 1) * 1.5, row: maxRow + 2, lane, citedBy: cites.map(n => n.id) })
  })
  return out
}
