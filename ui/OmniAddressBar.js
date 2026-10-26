/**
 * ui/OmniAddressBar.js — ⟐OmniAddressBar
 *
 * A reusable breadcrumb trail — "addresses the user on what and
 * where the current panel they're working on goes to." Deliberately
 * generic: any panel can create one and attach it to itself, not
 * something built once for notifications specifically.
 *
 * Ten slots, ⟐ as the placeholder symbol for every slot until real
 * per-step glyphs exist. Two sizes ('main' | 'small') and a
 * slide-in edge ('top' | 'left' | 'right') cover both the main
 * notification panel and the smaller per-hand versions from one
 * shared implementation, not two separate components.
 */

const SLOT_COUNT = 10
const PLACEHOLDER_SYMBOL = '⟐'

const STYLES = `

.omni-address-bar {
  display          : flex;
  align-items      : center;
  gap              : 4px;
  pointer-events   : auto;
  font-family      : 'Courier New', Courier, monospace;
}

.omni-address-bar.oab-main   { gap: 6px; }
.omni-address-bar.oab-small  { gap: 3px; }

.oab-slot {
  display          : flex;
  align-items      : center;
  justify-content  : center;
  color            : var(--omni-theme-text-dim, rgba(255,255,255,0.55));
  opacity          : 0.55;
  transition       : opacity 0.15s, color 0.15s;
}
.omni-address-bar.oab-main  .oab-slot { width: 22px; height: 22px; font-size: 13px; }
.omni-address-bar.oab-small .oab-slot { width: 14px; height: 14px; font-size: 9px; }

.oab-slot.oab-active {
  color            : var(--omni-theme-accent, rgba(255,255,255,0.95));
  opacity          : 1;
}

.oab-sep {
  color            : var(--omni-theme-text-dim, rgba(255,255,255,0.25));
  font-size        : 9px;
  opacity           : 0.5;
}
.omni-address-bar.oab-small .oab-sep { font-size: 7px; }

`

function injectStyles () {
  if (document.getElementById('omni-address-bar-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-address-bar-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniAddressBar {
  /**
   * @param {object} [opts]
   * @param {'main'|'small'} [opts.size='main']
   * @param {string[]} [opts.path] — up to 10 symbols; shorter paths
   *   leave the remaining slots as inactive placeholders, not hidden —
   *   the full 10-slot shape is always visible, per the request.
   */
  constructor (opts = {}) {
    this.size = opts.size ?? 'main'
    this.path = opts.path ?? []
    this._el = null
  }

  /** Builds the DOM and returns it — the caller (any panel) attaches
   *  this element wherever it needs to, rather than this component
   *  assuming it owns its own position in the page. */
  mount () {
    injectStyles()
    this._el = document.createElement('div')
    this._el.className = `omni-address-bar ${this.size === 'small' ? 'oab-small' : 'oab-main'}`
    this._render()
    return this._el
  }

  /** Replaces the trail — real steps first, remaining slots stay as
   *  inactive ⟐ placeholders up to the full 10, never collapsing the
   *  bar's own shape down to just however many real steps exist. */
  setPath (path) {
    this.path = path.slice(0, SLOT_COUNT)
    if (this._el) this._render()
  }

  destroy () {
    this._el?.parentNode?.removeChild(this._el)
  }

  _render () {
    let html = ''
    for (let i = 0; i < SLOT_COUNT; i++) {
      const isActive = i < this.path.length
      const symbol = isActive ? this.path[i] : PLACEHOLDER_SYMBOL
      html += `<span class="oab-slot ${isActive ? 'oab-active' : ''}">${symbol}</span>`
      if (i < SLOT_COUNT - 1) html += `<span class="oab-sep">›</span>`
    }
    this._el.innerHTML = html
  }
}

export { SLOT_COUNT, PLACEHOLDER_SYMBOL }
