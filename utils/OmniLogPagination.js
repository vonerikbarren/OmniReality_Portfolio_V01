/**
 * utils/OmniLogPagination.js — real, automatic pagination for
 * OmniLog entries
 *
 * Confirmed directly: automatic splitting, not manual page breaks
 * ("manual will just create bugs"). Parses the editor's own
 * constrained rich-text (bold/italic/headers/lists — the real,
 * confirmed formatting set, not arbitrary HTML) into real blocks,
 * measures how many real lines each block needs at the real page
 * dimensions, and splits into pages once a page's real line budget
 * is exceeded.
 */

export const PAGE_WIDTH = 512
export const PAGE_HEIGHT = 640
const MARGIN = 32
const LINE_HEIGHT = {
  p: 22, h1: 34, h2: 28, li: 22,
}
const FONT_SIZE = {
  p: 16, h1: 26, h2: 21, li: 16,
}
const USABLE_HEIGHT = PAGE_HEIGHT - MARGIN * 2
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2

/** Parses the editor's own real, constrained HTML into a flat list
 *  of real blocks — { type, text } — walking only the tags the
 *  editor's own toolbar can actually produce. */
export function parseBlocks (html) {
  const container = document.createElement('div')
  container.innerHTML = html
  const blocks = []

  container.childNodes.forEach(node => {
    if (node.nodeType !== 1) {
      const text = node.textContent.trim()
      if (text) blocks.push({ type: 'p', text })
      return
    }
    const tag = node.tagName.toLowerCase()
    if (tag === 'ul' || tag === 'ol') {
      node.querySelectorAll('li').forEach(li => blocks.push({ type: 'li', text: li.textContent.trim() }))
    } else if (tag === 'h1' || tag === 'h2') {
      blocks.push({ type: tag, text: node.textContent.trim() })
    } else {
      const text = node.textContent.trim()
      if (text) blocks.push({ type: 'p', text })
    }
  })
  return blocks
}

/** Real, measured line-wrapping — uses an actual 2D canvas context
 *  to measure real text width at the real font for each block type,
 *  matching the same real technique already used for OmniChat's own
 *  canvas-rendered pieces, rather than guessing at character counts. */
function wrapBlockToLines (ctx, block) {
  ctx.font = `${block.type === 'h1' || block.type === 'h2' ? 'bold ' : ''}${FONT_SIZE[block.type]}px 'Courier New', monospace`
  const words = block.text.split(/\s+/)
  const lines = []
  let line = ''
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > USABLE_WIDTH && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  })
  if (line) lines.push(line)
  return lines
}

/** Real, automatic pagination — splits real blocks across pages once
 *  a page's real, measured line-height budget is exceeded. Returns
 *  real pages, each an array of { type, lines }. */
export function paginate (html) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const blocks = parseBlocks(html)

  const pages = []
  let currentPage = []
  let usedHeight = 0

  blocks.forEach(block => {
    const lines = wrapBlockToLines(ctx, block)
    const blockHeight = lines.length * LINE_HEIGHT[block.type]

    if (usedHeight + blockHeight > USABLE_HEIGHT && currentPage.length > 0) {
      pages.push(currentPage)
      currentPage = []
      usedHeight = 0
    }
    currentPage.push({ type: block.type, lines })
    usedHeight += blockHeight
  })

  if (currentPage.length > 0) pages.push(currentPage)
  return pages.length > 0 ? pages : [[]]
}
