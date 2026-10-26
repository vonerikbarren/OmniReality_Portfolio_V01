/**
 * data/OmniCryptxTypes.js — the one, real, shared ring-type vocabulary
 * for OmniCryptx.
 *
 * Split out specifically because two separate surfaces both need the
 * exact same types, not their own copies: the 3D astrolabe rings
 * (`modules/OmniCryptx.js`) and OmniKryptx's own 2D vertical-slider
 * sections (`ui/OmniKeys.js`) are two different REPRESENTATIONS of
 * one real cryptex, not two unrelated systems that happen to look
 * similar. See `docs/architecture/OMNICRYPTEXLAB_DESIGN.md`.
 *
 * The symbol tier (MasterKeySymbol/KeySymbol/Symbol) sits above the
 * basic value types — a real hierarchy, not a flat list, per that doc.
 */

export const SYMBOL_TIER_TYPES = ['MasterKeySymbol', 'KeySymbol', 'Symbol']
export const VALUE_TYPES = ['Time', 'Letter', 'Number', 'State', 'px', 'py', 'pz', 'typed password', 'Music Notation']
export const ALL_RING_TYPES = [...SYMBOL_TIER_TYPES, ...VALUE_TYPES]

// One color per type, purely for visual distinction between rings/
// sliders — matches nothing security-relevant, just legibility.
export const TYPE_COLORS = {
  MasterKeySymbol:   '#ffd700',
  KeySymbol:         '#ffa64d',
  Symbol:            '#7fd8ff',
  Time:              '#b388ff',
  Letter:            '#8cff8c',
  Number:            '#ff8c8c',
  State:             '#ffe066',
  px:                '#ff6699',
  py:                '#66ff99',
  pz:                '#6699ff',
  'typed password':  '#cccccc',
  'Music Notation':  '#ff99cc',
}
export const DEFAULT_TYPE_COLOR = '#8cc4ff'

// What kind of widget actually fits each type — a slider is the
// right shape for a bounded, continuous value, but genuinely wrong
// for a typed password or a chosen symbol. Per-type widget kind,
// not "everything is secretly a 0-100 slider wearing a label."
export const TYPE_WIDGET = {
  MasterKeySymbol:  'symbol-picker',
  KeySymbol:        'symbol-picker',
  Symbol:           'symbol-picker',
  Time:             'time',
  Letter:           'letter-wheel',
  Number:           'slider',
  State:            'toggle',
  px:               'slider',
  py:               'slider',
  pz:               'slider',
  'typed password': 'text',
  'Music Notation':  'note-picker',
}

export function colorFor (type) {
  return TYPE_COLORS[type] ?? DEFAULT_TYPE_COLOR
}
export function widgetFor (type) {
  return TYPE_WIDGET[type] ?? 'slider'
}
