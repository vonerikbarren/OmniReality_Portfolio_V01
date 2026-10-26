/**
 * ui/OmniCellPanel.js — ⟐OmniCellPanel
 *
 * The real, dedicated D3 panel for OmniDraw(OmniCell) — confirmed
 * directly: its own panel, separate from OmniInspector. The
 * Inspector stays about the node generically; this is specifically
 * what a D3 node looks like and does.
 *
 * The scene shows only a real, simple marker (a distinct geometry
 * and color, set in OmniJsonifier.js's own _spawnMesh) — the full,
 * detailed chart lives entirely here, in a real, readable DOM panel,
 * not a tiny camera-facing overlay. Confirmed reasoning: a chart is
 * something to sit and read, not glance at across a room.
 *
 * One shared panel, retargeted by selection — same real model
 * OmniCommunicationPanel and OmniInspector both already use.
 *
 * Toggling a series here is the real, same mechanism OmniJsonifier's
 * own branch toggles use, applied to a genuinely different meaning:
 * turning a data series on/off in the chart, not revealing 3D nodes.
 */

import * as d3 from 'd3'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getChart } from '../utils/ChartDataRegistry.js'

const SERIES_COLORS = ['#7fd8ff', '#ffb347', '#8cff8c', '#ff8c8c', '#c9a0ff', '#ffe066']

const STYLES = `

.omni-cell-panel {
  pointer-events   : auto;
  --ocl-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ocl-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ocl-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ocl-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --ocl-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --ocl-accent     : var(--omni-theme-accent, #ffb347);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 140px;
  left             : 600px;
  width            : 420px;
  min-width        : 320px;
  max-width        : 92vw;
  height           : 400px;
  min-height       : 300px;

  display          : flex;
  flex-direction   : column;

  background       : var(--ocl-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--ocl-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.ocl-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ocl-header-bg);
  border-bottom    : 1px solid var(--ocl-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.ocl-title { font-size: 11px; letter-spacing: 0.05em; color: var(--ocl-text-dim); }
.ocl-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.ocl-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ocl-border); background: rgba(255,255,255,0.04);
  color: var(--ocl-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.ocl-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--ocl-text); }

.ocl-body { flex: 1 1 auto; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.ocl-empty { color: var(--ocl-text-dim); font-size: 11px; text-align: center; padding: 30px 10px; line-height: 1.6; }

.ocl-toprow { display: flex; gap: 8px; align-items: center; }
.ocl-type-select {
  background: rgba(255,255,255,0.05); border: 1px solid var(--ocl-border);
  border-radius: 5px; color: var(--ocl-text); font-family: inherit; font-size: 11px; padding: 5px;
}

.ocl-series-toggles { display: flex; flex-wrap: wrap; gap: 6px; }
.ocl-series-chip {
  display: flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 12px;
  border: 1px solid var(--ocl-border); font-size: 10px; cursor: pointer; color: var(--ocl-text-dim);
}
.ocl-series-chip.is-active { color: var(--ocl-text); }
.ocl-series-swatch { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.ocl-chart-wrap { flex: 1 1 auto; min-height: 180px; }
.ocl-chart-wrap svg { width: 100%; height: 100%; }
.ocl-axis text { fill: var(--ocl-text-dim); font-size: 9px; font-family: var(--mono); }
.ocl-value-label { fill: var(--ocl-text); font-size: 9px; font-family: var(--mono); pointer-events: none; }
.ocl-axis path, .ocl-axis line { stroke: var(--ocl-border); }

`

function injectStyles () {
  if (document.getElementById('ocl-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ocl-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniCellPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._currentNodeId = null
    this._currentChart = null
    this._onNodeSelected = null
  }

  init () {
    injectStyles()
    this._onNodeSelected = (e) => this._retarget(e.detail?.mesh)
    window.addEventListener('omni:node-selected', this._onNodeSelected)
  }

  update () {}
  onResize () {
    if (this._isOpen && this._currentChart) this._drawChart()
  }

  destroy () {
    window.removeEventListener('omni:node-selected', this._onNodeSelected)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnicellpanel')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: { id: 'omnicellpanel', label: '⟐OmniCellPanel', iconLabel: '⟐📊',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  /** Real retargeting, matching OmniCommunicationPanel's own model:
   *  only auto-opens for a node that genuinely has real chart data
   *  registered — never forces itself open for an unrelated
   *  selection, and reflects an honest empty state if it's already
   *  open when selection moves elsewhere. */
  _retarget (mesh) {
    const nodeId = mesh?.userData?.nodeId ?? null
    this._currentNodeId = nodeId
    this._currentChart = nodeId ? getChart(nodeId) : null
    if (this._currentChart) {
      if (!this._el) this._el = this._buildDOM()
      this.open()
    } else if (!this._isOpen) {
      return
    }
    this._render()
  }

  _render () {
    const body = this._el?.querySelector('.ocl-body')
    if (!body) return
    if (!this._currentChart) {
      body.innerHTML = `<div class="ocl-empty">Select a node with real chart data to visualize it here.</div>`
      return
    }

    const c = this._currentChart
    const seriesNames = Object.keys(c.seriesData)
    const chipsHTML = seriesNames.map((name, i) => `
      <div class="ocl-series-chip ${c.seriesVisibility[name] ? 'is-active' : ''}" data-series="${name}">
        <span class="ocl-series-swatch" style="background:${SERIES_COLORS[i % SERIES_COLORS.length]}"></span>${name}
      </div>
    `).join('')

    body.innerHTML = `
      <div class="ocl-toprow">
        <select class="ocl-type-select" id="ocl-chart-type">
          <option value="bar" ${c.chartType === 'bar' ? 'selected' : ''}>Bar</option>
          <option value="line" ${c.chartType === 'line' ? 'selected' : ''}>Line</option>
          <option value="area" ${c.chartType === 'area' ? 'selected' : ''}>Area</option>
          <option value="pie" ${c.chartType === 'pie' ? 'selected' : ''}>Pie</option>
          <option value="radar" ${c.chartType === 'radar' ? 'selected' : ''}>Radar</option>
          <option value="radial-area" ${c.chartType === 'radial-area' ? 'selected' : ''}>Radial Area</option>
        </select>
      </div>
      <div class="ocl-series-toggles" id="ocl-series-toggles">${chipsHTML}</div>
      <div class="ocl-chart-wrap" id="ocl-chart-wrap"></div>
    `

    body.querySelector('#ocl-chart-type').addEventListener('change', (e) => {
      c.chartType = e.target.value
      this._drawChart()
    })
    body.querySelectorAll('.ocl-series-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.series
        c.seriesVisibility[name] = !c.seriesVisibility[name]
        chip.classList.toggle('is-active', c.seriesVisibility[name])
        this._drawChart()
      })
    })

    this._drawChart()
  }

  /** The real D3 rendering — a genuine grouped bar chart or a real
   *  multi-line chart, redrawn only on an actual real change (a
   *  toggle, a type switch, a resize), not on any kind of frame
   *  loop. */
  _drawChart () {
    const wrap = this._el?.querySelector('#ocl-chart-wrap')
    if (!wrap || !this._currentChart) return
    wrap.innerHTML = ''

    const c = this._currentChart
    const visibleNames = Object.keys(c.seriesData).filter(name => c.seriesVisibility[name])
    if (visibleNames.length === 0) {
      wrap.innerHTML = `<div class="ocl-empty">All series are hidden — toggle one on above.</div>`
      return
    }

    const width = wrap.clientWidth || 360
    const height = wrap.clientHeight || 200
    const margin = { top: 10, right: 10, bottom: 24, left: 36 }
    const innerW = Math.max(10, width - margin.left - margin.right)
    const innerH = Math.max(10, height - margin.top - margin.bottom)

    const labels = Object.keys(c.seriesData[visibleNames[0]])
    const allValues = visibleNames.flatMap(name => Object.values(c.seriesData[name]))
    const colorOf = (name) => SERIES_COLORS[Object.keys(c.seriesData).indexOf(name) % SERIES_COLORS.length]
    const colorOfLabel = (label) => SERIES_COLORS[labels.indexOf(label) % SERIES_COLORS.length]

    const svg = d3.select(wrap).append('svg').attr('viewBox', `0 0 ${width} ${height}`)
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Pie and radar are genuinely non-Cartesian — no shared x/y axes
    // with bar/line/area, so they get their own dedicated setup
    // rather than being forced through the same scales.
    if (c.chartType === 'pie') {
      this._drawPie(g, innerW, innerH, visibleNames[0], c, labels, colorOfLabel)
      return
    }
    if (c.chartType === 'radar') {
      this._drawRadar(g, innerW, innerH, visibleNames, c, labels, colorOf, allValues)
      return
    }
    if (c.chartType === 'radial-area') {
      this._drawRadialArea(g, innerW, innerH, visibleNames, c, labels, colorOf, allValues)
      return
    }

    const x0 = d3.scaleBand().domain(labels).range([0, innerW]).padding(0.2)
    const y = d3.scaleLinear().domain([0, d3.max(allValues) * 1.1 || 1]).range([innerH, 0])

    g.append('g').attr('class', 'ocl-axis').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x0).tickSizeOuter(0))
    g.append('g').attr('class', 'ocl-axis').call(d3.axisLeft(y).ticks(4))

    if (c.chartType === 'bar') {
      const x1 = d3.scaleBand().domain(visibleNames).range([0, x0.bandwidth()]).padding(0.1)
      const groups = g.selectAll('.bar-group').data(labels).join('g')
        .attr('transform', label => `translate(${x0(label)},0)`)
      visibleNames.forEach(name => {
        groups.append('rect')
          .attr('x', x1(name)).attr('width', x1.bandwidth())
          .attr('y', label => y(c.seriesData[name][label] ?? 0))
          .attr('height', label => innerH - y(c.seriesData[name][label] ?? 0))
          .attr('fill', colorOf(name))
        groups.append('text')
          .attr('class', 'ocl-value-label')
          .attr('x', x1(name) + x1.bandwidth() / 2)
          .attr('y', label => y(c.seriesData[name][label] ?? 0) - 4)
          .attr('text-anchor', 'middle')
          .text(label => c.seriesData[name][label] ?? 0)
      })
    } else if (c.chartType === 'area') {
      const xPoint = d3.scalePoint().domain(labels).range([0, innerW])
      const area = d3.area().x(([label]) => xPoint(label)).y0(innerH).y1(([, v]) => y(v))
      const line = d3.line().x(([label]) => xPoint(label)).y(([, v]) => y(v))
      visibleNames.forEach(name => {
        const points = labels.map(label => [label, c.seriesData[name][label] ?? 0])
        g.append('path').datum(points).attr('fill', colorOf(name)).attr('fill-opacity', 0.25)
          .attr('stroke', 'none').attr('d', area)
        g.append('path').datum(points).attr('fill', 'none').attr('stroke', colorOf(name))
          .attr('stroke-width', 2).attr('d', line)
        g.selectAll(null).data(points).join('text')
          .attr('class', 'ocl-value-label')
          .attr('x', ([label]) => xPoint(label))
          .attr('y', ([, v]) => y(v) - 6)
          .attr('text-anchor', 'middle')
          .text(([, v]) => v)
      })
    } else {
      const xPoint = d3.scalePoint().domain(labels).range([0, innerW])
      const line = d3.line().x(([label]) => xPoint(label)).y(([, v]) => y(v))
      visibleNames.forEach(name => {
        const points = labels.map(label => [label, c.seriesData[name][label] ?? 0])
        g.append('path').datum(points).attr('fill', 'none').attr('stroke', colorOf(name))
          .attr('stroke-width', 2).attr('d', line)
        g.selectAll(null).data(points).join('text')
          .attr('class', 'ocl-value-label')
          .attr('x', ([label]) => xPoint(label))
          .attr('y', ([, v]) => y(v) - 6)
          .attr('text-anchor', 'middle')
          .text(([, v]) => v)
      })
    }
  }

  /** Pie shows exactly one series' own breakdown by label — a
   *  fundamentally different question from bar/line/area's "compare
   *  across series," so it deliberately uses only the first visible
   *  series rather than trying to force several series into one
   *  pie. Colored per-label, not per-series, since the story here is
   *  "how does this one series break down," not "how do series
   *  compare." */
  _drawPie (g, innerW, innerH, seriesName, c, labels, colorOfLabel) {
    const radius = Math.min(innerW, innerH) / 2
    const pieG = g.append('g').attr('transform', `translate(${innerW / 2},${innerH / 2})`)
    const data = labels.map(label => ({ label, value: c.seriesData[seriesName][label] ?? 0 }))
    const arcs = d3.pie().value(d => d.value)(data)
    const arcGen = d3.arc().innerRadius(0).outerRadius(radius)
    pieG.selectAll('path').data(arcs).join('path')
      .attr('d', arcGen).attr('fill', d => colorOfLabel(d.data.label))
      .attr('stroke', 'rgba(8,8,12,0.6)').attr('stroke-width', 1)
    pieG.selectAll('text').data(arcs).join('text')
      .attr('class', 'ocl-value-label')
      .attr('transform', d => `translate(${arcGen.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .text(d => d.data.value)
  }

  /** Each visible series becomes its own closed polygon — vertices
   *  evenly spaced by angle (one per label, same order all series
   *  share), radial distance scaled by value. Colored per-series,
   *  matching bar/line/area, since the real question here is
   *  comparing several series against the same set of labels at
   *  once, not one series' own breakdown. */
  _drawRadar (g, innerW, innerH, visibleNames, c, labels, colorOf, allValues) {
    const radius = Math.min(innerW, innerH) / 2
    const radarG = g.append('g').attr('transform', `translate(${innerW / 2},${innerH / 2})`)
    const angleFor = (i) => (i / labels.length) * Math.PI * 2 - Math.PI / 2
    const rScale = d3.scaleLinear().domain([0, d3.max(allValues) * 1.1 || 1]).range([0, radius])

    labels.forEach((label, i) => {
      const angle = angleFor(i)
      radarG.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', Math.cos(angle) * radius).attr('y2', Math.sin(angle) * radius)
        .attr('stroke', 'rgba(255,255,255,0.15)')
    })

    const pointsFor = (name) => labels.map((label, i) => {
      const angle = angleFor(i)
      const r = rScale(c.seriesData[name][label] ?? 0)
      return [Math.cos(angle) * r, Math.sin(angle) * r]
    })
    const lineGen = d3.line()
    visibleNames.forEach(name => {
      radarG.append('path').datum(pointsFor(name)).attr('d', d => lineGen(d) + 'Z')
        .attr('fill', colorOf(name)).attr('fill-opacity', 0.15)
        .attr('stroke', colorOf(name)).attr('stroke-width', 2)
      radarG.selectAll(null).data(labels).join('text')
        .attr('class', 'ocl-value-label')
        .attr('x', (label, i) => { const r = rScale(c.seriesData[name][label] ?? 0); return Math.cos(angleFor(i)) * (r + 10) })
        .attr('y', (label, i) => { const r = rScale(c.seriesData[name][label] ?? 0); return Math.sin(angleFor(i)) * (r + 10) })
        .attr('text-anchor', 'middle')
        .attr('fill', colorOf(name))
        .text(label => c.seriesData[name][label] ?? 0)
    })
  }
  /** A real radial area chart — d3's own areaRadial/lineRadial
   *  generators, the actual technique the referenced Observable
   *  example uses, not a manual polygon like Radar's own approach.
   *  Genuinely different visually: a smooth, closed curve filled
   *  from the center outward at each label's angle, rather than
   *  straight-edged polygon segments. */
  _drawRadialArea (g, innerW, innerH, visibleNames, c, labels, colorOf, allValues) {
    const radius = Math.min(innerW, innerH) / 2
    const raG = g.append('g').attr('transform', `translate(${innerW / 2},${innerH / 2})`)
    const angleFor = (i) => (i / labels.length) * Math.PI * 2
    const rScale = d3.scaleLinear().domain([0, d3.max(allValues) * 1.1 || 1]).range([0, radius])

    labels.forEach((label, i) => {
      const angle = angleFor(i) - Math.PI / 2
      raG.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', Math.cos(angle) * radius).attr('y2', Math.sin(angle) * radius)
        .attr('stroke', 'rgba(255,255,255,0.15)')
    })

    const areaGen = d3.areaRadial()
      .curve(d3.curveLinearClosed)
      .angle(d => angleFor(d.i))
      .innerRadius(0)
      .outerRadius(d => rScale(d.value))

    visibleNames.forEach(name => {
      const points = labels.map((label, i) => ({ i, value: c.seriesData[name][label] ?? 0 }))
      raG.append('path').datum(points)
        .attr('d', areaGen)
        .attr('fill', colorOf(name)).attr('fill-opacity', 0.25)
        .attr('stroke', colorOf(name)).attr('stroke-width', 1.5)
        .attr('transform', 'rotate(-90)')   // areaRadial's own 0-angle points right; rotate so label[0] sits at the top, matching Radar's own orientation
      raG.selectAll(null).data(points).join('text')
        .attr('class', 'ocl-value-label')
        .attr('x', (d) => { const a = angleFor(d.i) - Math.PI / 2; return Math.cos(a) * (rScale(d.value) + 10) })
        .attr('y', (d) => { const a = angleFor(d.i) - Math.PI / 2; return Math.sin(a) * (rScale(d.value) + 10) })
        .attr('text-anchor', 'middle')
        .attr('fill', colorOf(name))
        .text(d => d.value)
    })
  }


  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-cell-panel'
    el.innerHTML = `
      <div class="ocl-header">
        <span class="ocl-title">⟐OmniCellPanel</span>
        <div class="ocl-controls">
          <button class="ocl-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ocl-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ocl-body"></div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    this._bindHeader(el)
    el.dataset.winId = 'omnicellpanel'
    WindowManager.register('omnicellpanel', el, 'OmniCellPanel')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.ocl-header')
    const drag = { active: false }
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      drag.active = true; drag.startX = cx; drag.startY = cy; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: drag.originX + (cx - drag.startX), top: drag.originY + (cy - drag.startY) })
    }
    const onUp = () => { drag.active = false }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
