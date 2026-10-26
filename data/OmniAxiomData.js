/**
 * data/OmniAxiomData.js (V217) — the AXIOMS the OmniHand chooses and the PERSPECTIVES the ConsciousHand then offers for each one.
 *
 *   OmniHand        picks the axiom (the higher-order setting)              Identity, Information, Space, Time, Power, Expression
 *   ConsciousHand   picks a perspective OF that axiom (the lower setting)   change the axiom and the perspective list changes with it
 *
 * A perspective may carry a multiplier (`mult`): { value, min, max, kind:'speedup'|'slowdown' }. Only TIME perspectives have a working effect so far
 * (utils/OmniTimeScale.js); the other axioms' perspectives are labels the Dimensional Nodes already react to. The lists are a first draft: edit them here.
 */
export const AXIOMS = [
  { id: 'identity', name: 'Identity', symbol: '◉', color: '#ff9bd0', view: 'Who or what something is.',
    perspectives: [
      { id: 'self',   name: 'Self',   view: 'As itself.' },
      { id: 'other',  name: 'Other',  view: 'As seen by something else.' },
      { id: 'group',  name: 'Group',  view: 'As one of many.' },
      { id: 'role',   name: 'Role',   view: 'By the part it plays.' },
      { id: 'mask',   name: 'Mask',   view: 'By what it presents.' },
      { id: 'origin', name: 'Origin', view: 'By where it came from.' },
    ] },
  { id: 'information', name: 'Information', symbol: 'ⓘ', color: '#7ec8ff', view: 'What is known, and how.',
    perspectives: [
      { id: 'raw',     name: 'Raw',     view: 'Exactly as recorded.' },
      { id: 'signal',  name: 'Signal',  view: 'Only what matters.' },
      { id: 'noise',   name: 'Noise',   view: 'Everything that does not.' },
      { id: 'pattern', name: 'Pattern', view: 'The shape it repeats.' },
      { id: 'summary', name: 'Summary', view: 'Boiled down.' },
      { id: 'source',  name: 'Source',  view: 'Where it was learned.' },
    ] },
  { id: 'space', name: 'Space', symbol: '▦', color: '#8dffb0', view: 'Where, and how big.',
    perspectives: [
      { id: 'point',  name: 'Point',  view: 'A single place.' },
      { id: 'local',  name: 'Local',  view: 'What is near.' },
      { id: 'room',   name: 'Room',   view: 'Inside its bounds.' },
      { id: 'aerial', name: 'Aerial', view: 'From above.' },
      { id: 'map',    name: 'Map',    view: 'Flattened to a layout.' },
      { id: 'inside', name: 'Inside', view: 'From within.' },
    ] },
  { id: 'time', name: 'Time', symbol: '⧖', color: '#ffd36b', view: 'When, and how fast. These perspectives really change how fast motion runs.',
    perspectives: [
      { id: 'moment',     name: 'Moment',      view: 'One instant: motion holds still.', timeScale: 0 },
      { id: 'realtime',   name: 'Real time',   view: 'Time as it runs.', timeScale: 1 },
      { id: 'hyperlapse', name: 'Hyperlapse',  view: 'Time sped up by the multiplier.', mult: { value: 8, min: 1.5, max: 100, kind: 'speedup' } },
      { id: 'slowmo',     name: 'Slow-mo',     view: 'Time slowed by the multiplier.', mult: { value: 4, min: 1.5, max: 50, kind: 'slowdown' } },
      { id: 'bullet',     name: 'Bullet time', view: 'Nearly stopped: slowed by a large multiplier.', mult: { value: 20, min: 5, max: 200, kind: 'slowdown' } },
      { id: 'looped',     name: 'Looped event', view: 'A stretch of time that repeats. Multiplier = seconds in the loop.', loop: true, mult: { value: 3, min: 0.5, max: 60, kind: 'loop' } },
    ] },
  { id: 'power', name: 'Power', symbol: '⚡', color: '#ff7a5c', view: 'What can act, and how strongly.',
    perspectives: [
      { id: 'force',     name: 'Force',     view: 'Raw push.' },
      { id: 'authority', name: 'Authority', view: 'Right to decide.' },
      { id: 'influence', name: 'Influence', view: 'Effect without force.' },
      { id: 'energy',    name: 'Energy',    view: 'What it costs and gives.' },
      { id: 'potential', name: 'Potential', view: 'What it could do.' },
      { id: 'control',   name: 'Control',   view: 'Who holds the lever.' },
    ] },
  { id: 'expression', name: 'Expression', symbol: '❖', color: '#c79bff', view: 'How it is shown.',
    perspectives: [
      { id: 'voice',   name: 'Voice',   view: 'Said aloud.' },
      { id: 'form',    name: 'Form',    view: 'Shaped.' },
      { id: 'colour',  name: 'Colour',  view: 'Tinted by feeling.' },
      { id: 'gesture', name: 'Gesture', view: 'Moved.' },
      { id: 'rhetoric', name: 'Rhetoric', view: 'Argued.' },
      { id: 'silence', name: 'Silence', view: 'Left unsaid.' },
    ] },
]
export const AXIOM_IDS = AXIOMS.map(a => a.id)
export const getAxiom = (id) => AXIOMS.find(a => a.id === id) ?? null
export const getPerspective = (axiomId, pid) => getAxiom(axiomId)?.perspectives.find(p => p.id === pid) ?? null
