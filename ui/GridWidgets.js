/**
 * ui/GridWidgets.js — shared dashboard-grid widget system
 *
 * Used when a panel is maximized: turns its existing content sections
 * into draggable, reorderable "widget" cards laid out in a responsive
 * CSS grid, instead of a plain single scrolling column. Existing DOM
 * elements are MOVED into the grid cards (not cloned or rebuilt), so
 * every input/button/listener already wired to them keeps working
 * untouched — this file knows nothing about what's inside a card.
 *
 * Persistence: card order is saved to localStorage per panel id
 * (omni:panel-grid:{panelId}), so a rearranged dashboard survives a
 * reload. "Whatever grid system makes the most sense" — the layout
 * itself isn't free-pixel-positioned (that needs real collision
 * resolution to avoid overlaps); it's an ordered, auto-flowing grid
 * where drag-and-drop changes ORDER, and the browser's own grid engine
 * handles sizing/wrapping based on each card's content. Simpler, robust,
 * and still gives the user real control over the arrangement.
 *
 * Mobile: grid-template-columns uses auto-fill with a sane minimum card
 * width (260px). Below that, the browser naturally collapses to a
 * single column rather than shrinking cards illegibly, and the grid
 * itself scrolls vertically — "windowed and scrollable" rather than
 * "shrunk to fit," since a dashboard card that's shrunk too far stops
 * being usable on a touch screen anyway.
 */

const STORE_PREFIX = 'omni:panel-grid:'
const MIN_CARD_W   = 260

function injectStyles () {
  if (document.getElementById('omni-grid-widgets-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-grid-widgets-styles'
  tag.textContent = /* css */`
    .omni-widget-grid {
      display               : grid;
      grid-template-columns : repeat(auto-fill, minmax(${MIN_CARD_W}px, 1fr));
      gap                    : 14px;
      padding                : 14px;
      overflow-y             : auto;
      align-content          : start;
      flex                   : 1 1 auto;
      min-height             : 0;
      box-sizing             : border-box;
    }
    .omni-widget-card {
      background      : rgba(255,255,255,0.03);
      border          : 1px solid rgba(255,255,255,0.09);
      border-radius   : 10px;
      display         : flex;
      flex-direction  : column;
      overflow        : hidden;
      min-width       : 0;
      max-height      : 420px;
    }
    .omni-widget-card.is-dragging { opacity: 0.35; }
    .omni-widget-card-header {
      display          : flex;
      align-items      : center;
      gap              : 6px;
      padding          : 8px 12px;
      font-family      : 'Courier New', Courier, monospace;
      font-size        : 10px;
      letter-spacing   : 0.08em;
      text-transform   : uppercase;
      color            : rgba(255,255,255,0.6);
      background       : rgba(255,255,255,0.03);
      border-bottom    : 1px solid rgba(255,255,255,0.08);
      cursor           : grab;
      user-select      : none;
      flex-shrink      : 0;
    }
    .omni-widget-card-header:active { cursor: grabbing; }
    .omni-widget-card-header::before { content: '⠿'; opacity: 0.5; }
    .omni-widget-card-body {
      padding    : 10px 12px 14px;
      overflow-y : auto;
      flex       : 1 1 auto;
      min-height : 0;
    }
    @media (max-width: 640px) {
      .omni-widget-grid { grid-template-columns: 1fr; }
      .omni-widget-card { max-height: none; }
    }
  `
  document.head.appendChild(tag)
}

/**
 * @param {HTMLElement} mountPoint  — appended as a child here
 * @param {Array<{id, title, el}>} widgets — el is the EXISTING content
 *        element to move into a card
 * @param {string} panelId
 * @returns {HTMLElement} the grid element (also returned widgets get a
 *          `restoreParent` field set to their original parent, so the
 *          caller can put them back on unmountGrid)
 */
export function mountGrid (mountPoint, widgets, panelId) {
  injectStyles()

  widgets.forEach(w => { w.restoreParent = w.el.parentElement })

  const savedOrder = loadOrder(panelId)
  const byId = new Map(widgets.map(w => [w.id, w]))
  const ordered = savedOrder
    ? [...savedOrder.map(id => byId.get(id)).filter(Boolean), ...widgets.filter(w => !savedOrder.includes(w.id))]
    : widgets

  const grid = document.createElement('div')
  grid.className = 'omni-widget-grid'

  ordered.forEach(w => {
    const card = document.createElement('div')
    card.className = 'omni-widget-card'
    card.dataset.widgetId = w.id

    const header = document.createElement('div')
    header.className = 'omni-widget-card-header'
    header.textContent = w.title
    header.draggable = true

    const body = document.createElement('div')
    body.className = 'omni-widget-card-body'
    body.appendChild(w.el)

    card.appendChild(header)
    card.appendChild(body)
    grid.appendChild(card)

    header.addEventListener('dragstart', (e) => {
      card.classList.add('is-dragging')
      e.dataTransfer.setData('text/plain', w.id)
      e.dataTransfer.effectAllowed = 'move'
    })
    header.addEventListener('dragend', () => {
      card.classList.remove('is-dragging')
      persistOrder(grid, panelId)
    })
  })

  grid.addEventListener('dragover', (e) => {
    e.preventDefault()
    const dragging = grid.querySelector('.is-dragging')
    if (!dragging) return
    const after = getDragAfterElement(grid, e.clientX, e.clientY)
    if (after == null) grid.appendChild(dragging)
    else grid.insertBefore(dragging, after)
  })

  mountPoint.appendChild(grid)
  return grid
}

/**
 * 2D-aware nearest-card detection — finds the card whose center is
 * closest to the cursor (Euclidean distance across both axes, not just
 * vertical position), then decides insert-before/after based on which
 * side of that card's center the cursor is on. This matters once the
 * grid has more than one column: a purely Y-based check makes
 * horizontal reordering within the same row feel wrong (dropping
 * anywhere in a row's vertical band jumps to the same spot regardless
 * of X position).
 */
function getDragAfterElement (grid, x, y) {
  const cards = [...grid.querySelectorAll('.omni-widget-card:not(.is-dragging)')]
  let closest = { distance: Infinity, el: null, after: false }

  for (const card of cards) {
    const box = card.getBoundingClientRect()
    const cx  = box.left + box.width  / 2
    const cy  = box.top  + box.height / 2
    const dx  = x - cx
    const dy  = y - cy
    const distance = Math.hypot(dx, dy)

    if (distance < closest.distance) {
      // Past the card's vertical midpoint → after it in the row below;
      // within the same row band → after it if the cursor is to its right.
      const after = dy > box.height * 0.15 ||
        (Math.abs(dy) <= box.height * 0.15 && dx > 0)
      closest = { distance, el: card, after }
    }
  }

  if (!closest.el) return null
  return closest.after ? closest.el.nextElementSibling : closest.el
}

function persistOrder (grid, panelId) {
  const ids = [...grid.querySelectorAll('.omni-widget-card')].map(c => c.dataset.widgetId)
  try { localStorage.setItem(STORE_PREFIX + panelId, JSON.stringify(ids)) } catch (_) {}
}

function loadOrder (panelId) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + panelId)
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

/** Moves each widget's content element back to where it came from, in
 *  its (possibly reordered) DOM position, and removes the grid. */
export function unmountGrid (grid, widgets) {
  if (!grid) return
  for (const w of widgets) {
    if (w.restoreParent) w.restoreParent.appendChild(w.el)
  }
  grid.remove()
}
