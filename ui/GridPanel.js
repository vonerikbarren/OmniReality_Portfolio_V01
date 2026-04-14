/**
 * ui/GridPanel.js — ⟐mniReality 5×5 Grid Panel
 *
 * A reusable component that mounts a 5×5 interactive grid into a Panel body
 * slot. Instantiated twice — once for ⟐LH (Analytical) and once for ⟐RH
 * (Creative). Data is sourced from omniexp.panels.json (embedded below).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout — fits exactly inside Panel.js body (no scroll)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Panel body available: 316 × 292 px  (340px panel − 12px padding × 2)
 *
 *   GridPanel internal layout:
 *     Grid header   34 px    abbr · title · selection count · clear
 *     Description   18 px    one-line label from JSON
 *     ──────────────────────
 *     5×5 grid     240 px    cells: 60 × 44.8 px, 4 px gaps
 *     ──────────────────────
 *     Total        292 px    ← exactly fills body, no overflow
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Cell interaction
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Click    →  toggle active state (multi-select — any number of cells)
 *   Hover    →  highlight + show full name tooltip
 *   Active   →  glowing border tinted to hand accent colour
 *   Clear    →  header button deselects all cells
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:grid-select   →  { hand, cell, row, col, active, selected: Set }
 *   omni:grid-clear    →  { hand }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   grid.init()          Mount into panel-body-${panelId}. Call after Panel.init().
 *   grid.destroy()       Remove grid, restore placeholder.
 *   grid.clearAll()      Deselect every cell programmatically.
 *   grid.getSelected()   Returns Set of 'row,col' strings for active cells.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ui/index.js integration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import GridPanel from './GridPanel.js'
 *
 *   // in init(), AFTER panels are initialised:
 *   this.gridLH = new GridPanel(this._ctx, 'lh')
 *   this.gridRH = new GridPanel(this._ctx, 'rh')
 *   this.gridLH.init()
 *   this.gridRH.init()
 *
 *   // in destroy():
 *   this.gridLH?.destroy()
 *   this.gridRH?.destroy()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount order requirement
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Panel.init() must run before GridPanel.init() — GridPanel mounts into
 *   the `panel-body-${id}` slot that Panel.js creates.
 */

import gsap from 'gsap'

// ─────────────────────────────────────────────────────────────────────────────
// Grid data — embedded from omniexp.panels.json
// ─────────────────────────────────────────────────────────────────────────────

const GRID_DATA = {
  lh: {
    abbr       : 'LH',
    title      : 'ANALYTICAL',
    description: 'Scientifically grounded, measurable, physical perspectives.',
    accentColor: 'rgba(180, 255, 210, 0.85)',   // cool green — matches LH in RadialMenu
    accentGlow : 'rgba(180, 255, 210, 0.22)',
    grid: [
      ['Physics',       'Biology',        'Chemistry',          'Geometry',            'Mechanics'    ],
      ['Timeflow',      'Causality',      'Systems',            'Data',                'Optimization' ],
      ['Ecology',       'Anatomy',        'Materiality',        'Topology',            'Engineering'  ],
      ['Computation',   'Signal',         'Measurement',        'PatternRecognition',  'Probability'  ],
      ['Kinetics',      'Thermodynamics', 'Balance',            'Infrastructure',      'Mapping'      ],
    ],
  },
  rh: {
    abbr       : 'RH',
    title      : 'CREATIVE',
    description: 'Emotional, symbolic, experiential perspectives.',
    accentColor: 'rgba(255, 185, 230, 0.85)',   // warm rose — matches RH in RadialMenu
    accentGlow : 'rgba(255, 185, 230, 0.22)',
    grid: [
      ['Emotion',       'Intuition',      'Imagination',        'Symbolism',           'Mythos'       ],
      ['Identity',      'Connection',     'Desire',             'Memory',              'Dreaming'     ],
      ['Aesthetics',    'Mood',           'Meaning',            'Belief',              'Ritual'       ],
      ['Creativity',    'Flow',           'PerspectiveShift',   'Archetypes',          'Synesthesia'  ],
      ['Harmony',       'Chaos',          'Play',               'Shadow',              'Transcendence'],
    ],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants — derived from Panel.js measurements
// ─────────────────────────────────────────────────────────────────────────────

const CELL_GAP    = 4     // px — gap between cells
const GRID_COLS   = 5
const GRID_ROWS   = 5

// Body available: 316 × 292. Grid header 34, desc 18 → cells get 240px height.
// Cell W = (316 − 4*4) / 5 = 60px.  Cell H = (240 − 4*4) / 5 = 44.8 ≈ 45px.
const CELL_W      = 60    // px
const CELL_H      = 45    // px

// ─────────────────────────────────────────────────────────────────────────────
// Utility — camelCase splitter and font-size picker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits a cell name into display lines.
 * "PatternRecognition" → ["Pattern", "Recognition"]
 * "Thermodynamics"     → ["Thermodynamics"]
 *
 * @param  {string}   name
 * @returns {string[]}
 */
function splitCellName (name) {
  const words = name
    .replace(/([A-Z][a-z]+)/g, ' $1')
    .trim()
    .split(' ')
    .filter(Boolean)

  return words.length > 1 ? words : [name]
}

/**
 * Choose a font-size class based on the longest display word.
 * Keeps single-word long names readable at 60px cell width.
 *
 * @param  {string[]} parts  — result of splitCellName()
 * @returns {'short'|'medium'|'long'}
 */
function sizeClass (parts) {
  const longest = Math.max(...parts.map(p => p.length))
  if (longest <= 7)  return 'short'
  if (longest <= 11) return 'medium'
  return 'long'
}

// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Grid panel root ────────────────────────────────────────────────────────── */

.grid-panel {
  --gp-bg          : transparent;
  --gp-cell-bg     : rgba(255, 255, 255, 0.03);
  --gp-cell-hover  : rgba(255, 255, 255, 0.08);
  --gp-cell-border : rgba(255, 255, 255, 0.07);
  --gp-cell-hover-b: rgba(255, 255, 255, 0.18);
  --gp-text        : rgba(255, 255, 255, 0.75);
  --gp-text-dim    : rgba(255, 255, 255, 0.28);
  --gp-text-sub    : rgba(255, 255, 255, 0.20);
  --gp-accent      : rgba(255, 255, 255, 0.95);
  --gp-separator   : rgba(255, 255, 255, 0.05);
  --gp-accent-color: rgba(255, 255, 255, 0.85);  /* overridden per hand */
  --gp-accent-glow : rgba(255, 255, 255, 0.20);  /* overridden per hand */
  --mono           : 'Courier New', Courier, monospace;

  display          : flex;
  flex-direction   : column;
  height           : 100%;
  gap              : 0;
  font-family      : var(--mono);
  -webkit-font-smoothing: antialiased;
}

/* ── Grid header ────────────────────────────────────────────────────────────── */

.gp-header {
  display          : flex;
  align-items      : center;
  gap              : 8px;
  height           : 34px;
  flex-shrink      : 0;
  border-bottom    : 1px solid var(--gp-separator);
  padding-bottom   : 6px;
  margin-bottom    : 0;
}

.gp-abbr {
  font-size        : 9px;
  letter-spacing   : 0.14em;
  color            : var(--gp-accent-color);
  text-shadow      : 0 0 8px var(--gp-accent-glow);
  flex-shrink      : 0;
}

.gp-title {
  font-size        : 8px;
  letter-spacing   : 0.12em;
  color            : var(--gp-text-dim);
  flex             : 1;
  text-transform   : uppercase;
}

.gp-count {
  font-size        : 8px;
  letter-spacing   : 0.08em;
  color            : var(--gp-text-dim);
  flex-shrink      : 0;
  transition       : color 0.18s ease;
}

.gp-count.has-selection {
  color            : var(--gp-accent-color);
}

.gp-clear {
  font-size        : 8px;
  color            : var(--gp-text-sub);
  letter-spacing   : 0.06em;
  background       : none;
  border           : 1px solid rgba(255, 255, 255, 0.08);
  border-radius    : 4px;
  padding          : 2px 7px;
  cursor           : pointer;
  font-family      : var(--mono);
  flex-shrink      : 0;
  transition       : color 0.12s, border-color 0.12s, background 0.12s;
  line-height      : 1.4;
}

.gp-clear:hover {
  color            : var(--gp-accent);
  border-color     : rgba(255, 255, 255, 0.22);
  background       : rgba(255, 255, 255, 0.06);
}

.gp-clear:disabled {
  opacity          : 0.30;
  cursor           : default;
  pointer-events   : none;
}

/* ── Description line ──────────────────────────────────────────────────────── */

.gp-desc {
  font-size        : 6.5px;
  color            : var(--gp-text-sub);
  letter-spacing   : 0.05em;
  height           : 18px;
  display          : flex;
  align-items      : center;
  flex-shrink      : 0;
  overflow         : hidden;
  white-space      : nowrap;
  text-overflow    : ellipsis;
  border-bottom    : 1px solid var(--gp-separator);
}

/* ── 5×5 cell grid ──────────────────────────────────────────────────────────── */

.gp-grid {
  display               : grid;
  grid-template-columns : repeat(${GRID_COLS}, 1fr);
  grid-template-rows    : repeat(${GRID_ROWS}, ${CELL_H}px);
  gap                   : ${CELL_GAP}px;
  flex                  : 1 0 auto;
  padding-top           : ${CELL_GAP}px;
}

/* ── Individual cell ────────────────────────────────────────────────────────── */

.gp-cell {
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 2px;

  background       : var(--gp-cell-bg);
  border           : 1px solid var(--gp-cell-border);
  border-radius    : 5px;
  cursor           : pointer;
  overflow         : hidden;
  position         : relative;

  -webkit-tap-highlight-color: transparent;
  touch-action     : manipulation;
  outline          : none;

  transition       : background 0.12s ease,
                     border-color 0.12s ease,
                     box-shadow 0.14s ease;
}

.gp-cell:hover {
  background       : var(--gp-cell-hover);
  border-color     : var(--gp-cell-hover-b);
}

.gp-cell:hover .gp-cell-line1 {
  color            : var(--gp-accent);
}

/* Active (selected) state */
.gp-cell.is-active {
  background       : rgba(255, 255, 255, 0.06);
  border-color     : var(--gp-accent-color);
  box-shadow       : 0 0 8px var(--gp-accent-glow),
                     inset 0 0 12px rgba(255, 255, 255, 0.03);
}

.gp-cell.is-active .gp-cell-line1 {
  color            : var(--gp-accent-color);
  text-shadow      : 0 0 6px var(--gp-accent-glow);
}

.gp-cell.is-active .gp-cell-line2 {
  color            : rgba(255, 255, 255, 0.50);
}

/* Active corner pip — top-left glow dot */
.gp-cell.is-active::before {
  content          : '';
  position         : absolute;
  top              : 4px;
  left             : 4px;
  width            : 4px;
  height           : 4px;
  border-radius    : 50%;
  background       : var(--gp-accent-color);
  box-shadow       : 0 0 4px var(--gp-accent-color);
  opacity          : 0.80;
}

/* Row + column index overlay (hover only, very subtle) */
.gp-cell::after {
  content          : attr(data-rc);
  position         : absolute;
  bottom           : 3px;
  right            : 4px;
  font-size        : 5px;
  color            : rgba(255, 255, 255, 0.10);
  pointer-events   : none;
  letter-spacing   : 0.04em;
  line-height      : 1;
}

/* ── Cell text lines ────────────────────────────────────────────────────────── */

.gp-cell-line1,
.gp-cell-line2 {
  pointer-events   : none;
  text-align       : center;
  line-height      : 1.15;
  letter-spacing   : 0.04em;
  max-width        : ${CELL_W - 6}px;
  overflow         : hidden;
  white-space      : nowrap;
  transition       : color 0.12s ease, text-shadow 0.12s ease;
}

.gp-cell-line1 {
  color            : var(--gp-text);
}

.gp-cell-line2 {
  color            : var(--gp-text-dim);
}

/* Font size tiers — based on longest word length */
.gp-size--short  .gp-cell-line1 { font-size: 7.5px; }
.gp-size--short  .gp-cell-line2 { font-size: 6.5px; }

.gp-size--medium .gp-cell-line1 { font-size: 6.5px; }
.gp-size--medium .gp-cell-line2 { font-size: 5.5px; }

.gp-size--long   .gp-cell-line1 { font-size: 5.5px; }
.gp-size--long   .gp-cell-line2 { font-size: 5px;   }

/* ── Row separators (subtle horizontal lines between rows) ───────────────────── */

.gp-cell:nth-child(5n+1) { border-left-color:  rgba(255, 255, 255, 0.10); }
.gp-cell:nth-child(5n)   { border-right-color: rgba(255, 255, 255, 0.10); }

/* ── Coordinate tooltip ────────────────────────────────────────────────────── */

.gp-tooltip {
  position         : fixed;
  background       : rgba(8, 8, 12, 0.94);
  border           : 1px solid rgba(255, 255, 255, 0.12);
  color            : rgba(255, 255, 255, 0.88);
  font-family      : 'Courier New', Courier, monospace;
  font-size        : 9px;
  padding          : 4px 9px;
  border-radius    : 5px;
  pointer-events   : none;
  z-index          : 80;
  letter-spacing   : 0.06em;
  backdrop-filter  : blur(10px);
  white-space      : nowrap;
  opacity          : 0;
  transition       : opacity 0.12s ease;
}

.gp-tooltip.is-visible {
  opacity          : 1;
}

/* ── Mobile ─────────────────────────────────────────────────────────────────── */

@media (max-width: 560px) {
  .gp-cell-line1 { font-size: 5.5px !important; }
  .gp-cell-line2 { font-size: 5px   !important; }
}

`

function injectStyles () {
  if (document.getElementById('omni-grid-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-grid-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ─────────────────────────────────────────────────────────────────────────────
// GridPanel class
// ─────────────────────────────────────────────────────────────────────────────

export default class GridPanel {

  /**
   * @param {object} context   — { scene, camera, renderer, sizes, ticker, Sound }
   * @param {'lh'|'rh'} panelId
   */
  constructor (context, panelId) {
    if (!GRID_DATA[panelId]) {
      throw new Error(`GridPanel: unknown panelId "${panelId}". Use 'lh' or 'rh'.`)
    }

    this.ctx     = context
    this.panelId = panelId
    this.data    = GRID_DATA[panelId]

    // ── DOM refs ──────────────────────────────────────────────────────────
    this._root     = null   // the .grid-panel root element
    this._cellEls  = []     // flat array [row0col0, row0col1 … row4col4], length 25
    this._countEl  = null   // selection count span
    this._clearBtn = null   // clear all button

    // ── Tooltip ───────────────────────────────────────────────────────────
    this._tooltip  = null

    // ── Selection state ───────────────────────────────────────────────────
    // Keys are 'row,col' strings for O(1) lookup
    this._selected = new Set()
  }

  // ── Module contract ──────────────────────────────────────────────────────

  /**
   * Mount the grid into `panel-body-${panelId}`.
   * Panel.init() must be called first — this method requires the DOM slot.
   */
  init () {
    injectStyles()

    const slot = document.getElementById(`panel-body-${this.panelId}`)
    if (!slot) {
      console.warn(`⟐ GridPanel [${this.panelId}]: slot #panel-body-${this.panelId} not found.`)
      return
    }

    // Clear Panel.js placeholder
    slot.innerHTML = ''

    // Build and mount
    this._buildTooltip()
    this._root = this._buildGrid()
    slot.appendChild(this._root)

    console.log(`⟐ GridPanel [${this.panelId}]: mounted — ${GRID_COLS}×${GRID_ROWS} = ${GRID_COLS * GRID_ROWS} cells.`)
  }

  update (_delta) {}   // no per-frame work

  destroy () {
    // Restore placeholder in slot
    const slot = document.getElementById(`panel-body-${this.panelId}`)
    if (slot && this._root?.parentNode === slot) {
      slot.innerHTML = /* html */`
        <div class="panel-placeholder">
          <span class="panel-placeholder-glyph">${this.data.abbr === 'LH' ? '⟐LH' : '⟐RH'}</span>
          <span class="panel-placeholder-label">panel content — phase 4</span>
        </div>
      `
    }

    this._tooltip?.parentNode?.removeChild(this._tooltip)
    this._root     = null
    this._cellEls  = []
    this._tooltip  = null
    this._selected.clear()
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Deselect every cell. */
  clearAll () {
    this._selected.clear()
    this._cellEls.forEach(el => el.classList.remove('is-active'))
    this._updateCount()

    window.dispatchEvent(new CustomEvent('omni:grid-clear', {
      detail: { hand: this.panelId },
    }))
  }

  /** Returns a copy of the active cell keys ('row,col' strings). */
  getSelected () {
    return new Set(this._selected)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM construction
  // ─────────────────────────────────────────────────────────────────────────

  _buildGrid () {
    const root = document.createElement('div')
    root.className = 'grid-panel'
    root.id        = `grid-panel-${this.panelId}`

    // CSS custom properties for accent colour (per hand)
    root.style.setProperty('--gp-accent-color', this.data.accentColor)
    root.style.setProperty('--gp-accent-glow',  this.data.accentGlow)

    root.appendChild(this._buildHeader())
    root.appendChild(this._buildDesc())
    root.appendChild(this._buildCells())

    return root
  }

  // ── Header ───────────────────────────────────────────────────────────────

  _buildHeader () {
    const header = document.createElement('div')
    header.className = 'gp-header'

    // Abbr — hand identifier with accent glow
    const abbr = document.createElement('span')
    abbr.className   = 'gp-abbr'
    abbr.textContent = this.data.abbr

    // Title — role label
    const title = document.createElement('span')
    title.className   = 'gp-title'
    title.textContent = this.data.title

    // Selection count — updates on every toggle
    const count = document.createElement('span')
    count.className   = 'gp-count'
    count.textContent = `0 / ${GRID_COLS * GRID_ROWS}`
    this._countEl = count

    // Clear button
    const clearBtn = document.createElement('button')
    clearBtn.className   = 'gp-clear'
    clearBtn.textContent = 'CLR'
    clearBtn.disabled    = true
    clearBtn.setAttribute('aria-label', 'Clear all selections')
    clearBtn.title = 'Clear all selected cells'
    clearBtn.addEventListener('click', () => {
      this.clearAll()
      this._playSound('close')
    })
    this._clearBtn = clearBtn

    header.appendChild(abbr)
    header.appendChild(title)
    header.appendChild(count)
    header.appendChild(clearBtn)

    return header
  }

  // ── Description ──────────────────────────────────────────────────────────

  _buildDesc () {
    const desc = document.createElement('div')
    desc.className   = 'gp-desc'
    desc.textContent = this.data.description
    desc.title       = this.data.description   // full text on hover
    return desc
  }

  // ── Cell grid ────────────────────────────────────────────────────────────

  _buildCells () {
    const grid = document.createElement('div')
    grid.className = 'gp-grid'

    this._cellEls = []

    this.data.grid.forEach((row, r) => {
      row.forEach((name, c) => {
        const cell = this._buildCell(name, r, c)
        grid.appendChild(cell)
        this._cellEls.push(cell)
      })
    })

    return grid
  }

  _buildCell (name, row, col) {
    const parts = splitCellName(name)
    const size  = sizeClass(parts)

    const cell = document.createElement('div')
    cell.className = `gp-cell gp-size--${size}`
    cell.dataset.name = name
    cell.dataset.row  = row
    cell.dataset.col  = col
    cell.dataset.rc   = `${row + 1},${col + 1}`
    cell.tabIndex     = 0
    cell.setAttribute('role',       'checkbox')
    cell.setAttribute('aria-label', name)
    cell.setAttribute('aria-checked', 'false')

    // Primary line — first word (or full name if single-word)
    const line1 = document.createElement('span')
    line1.className   = 'gp-cell-line1'
    line1.textContent = parts[0]
    cell.appendChild(line1)

    // Secondary line — second word (if split)
    if (parts[1]) {
      const line2 = document.createElement('span')
      line2.className   = 'gp-cell-line2'
      line2.textContent = parts[1]
      cell.appendChild(line2)
    }

    // ── Events ───────────────────────────────────────────────────────────
    cell.addEventListener('click',     () => this._handleCellClick(name, row, col, cell))
    cell.addEventListener('mouseenter', (e) => this._showTooltip(name, row, col, e))
    cell.addEventListener('mouseleave', ()  => this._hideTooltip())
    cell.addEventListener('mousemove',  (e) => this._moveTooltip(e))
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        cell.click()
      }
    })

    return cell
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cell click
  // ─────────────────────────────────────────────────────────────────────────

  _handleCellClick (name, row, col, el) {
    const key      = `${row},${col}`
    const wasActive = this._selected.has(key)

    if (wasActive) {
      this._selected.delete(key)
      el.classList.remove('is-active')
      el.setAttribute('aria-checked', 'false')
      this._playSound('click')
    } else {
      this._selected.add(key)
      el.classList.add('is-active')
      el.setAttribute('aria-checked', 'true')
      this._playSound('click')

      // Pulse animation — springs out from click point
      gsap.fromTo(el,
        { scale: 0.90 },
        { scale: 1, duration: 0.22, ease: 'back.out(2.5)' }
      )
    }

    this._updateCount()

    window.dispatchEvent(new CustomEvent('omni:grid-select', {
      detail: {
        hand    : this.panelId,
        cell    : name,
        row,
        col,
        active  : !wasActive,
        selected: new Set(this._selected),
      },
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Selection count + clear button state
  // ─────────────────────────────────────────────────────────────────────────

  _updateCount () {
    const n = this._selected.size
    const total = GRID_COLS * GRID_ROWS

    if (this._countEl) {
      this._countEl.textContent = `${n} / ${total}`
      this._countEl.classList.toggle('has-selection', n > 0)
    }

    if (this._clearBtn) {
      this._clearBtn.disabled = (n === 0)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tooltip
  // ─────────────────────────────────────────────────────────────────────────

  _buildTooltip () {
    if (document.getElementById('gp-tooltip')) {
      this._tooltip = document.getElementById('gp-tooltip')
      return
    }
    const tt = document.createElement('div')
    tt.id        = 'gp-tooltip'
    tt.className = 'gp-tooltip'
    document.body.appendChild(tt)
    this._tooltip = tt
  }

  _showTooltip (name, row, col, e) {
    if (!this._tooltip) return
    const key = `${row},${col}`
    const isActive = this._selected.has(key)
    this._tooltip.textContent = `${name}  [${row + 1},${col + 1}]${isActive ? '  ✓' : ''}`
    this._moveTooltip(e)
    this._tooltip.classList.add('is-visible')
  }

  _hideTooltip () {
    this._tooltip?.classList.remove('is-visible')
  }

  _moveTooltip (e) {
    if (!this._tooltip) return
    const OFF = 14
    this._tooltip.style.left = `${e.clientX + OFF}px`
    this._tooltip.style.top  = `${e.clientY - OFF}px`
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sound
  // ─────────────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
