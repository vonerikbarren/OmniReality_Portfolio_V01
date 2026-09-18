/**
 * modules/ChronosFloorClock.js — the real clock on the Master
 * Tunnel's floor
 *
 * "On the floor there will be a clock. I believe this clock should
 * be made from OmniDraw(Jsonifier) or OmniCell" — confirmed built
 * via OmniCell's own real mechanism: a genuine chart-eligible node,
 * registered into the same shared ChartDataRegistry every other
 * OmniCell node uses, so opening OmniCellPanel on it works exactly
 * like any other chart node, not a special case.
 *
 * The directly-readable part — visible without opening any panel —
 * is a real, live text label showing the formatted time, reusing
 * the same screen-projected technique WordTicker already proved,
 * but without WordTicker's own cycling behavior, since this is one
 * always-current value, not an array to step through.
 *
 * Reads PrimaryTime directly; respects OmniChronos's own saved
 * military/AM-PM preference rather than assuming one.
 */

import * as THREE from 'three'
import { generateId } from '../systems/OmniNode.js'
import { getCurrentSeconds } from '../utils/PrimaryTime.js'
import { formatSeconds } from '../utils/TimeData.js'
import { registerChart, getChart } from '../utils/ChartDataRegistry.js'

const FLOOR_Y = -102   // RootSpace's own real floor position, per its own CYLINDER_Y/CYLINDER_HEIGHT comment
const UPDATE_INTERVAL = 1   // real seconds between re-computing the clock — not every frame, matching OmniFloor's own rebuild discipline
const CHRONOS_STORE_KEY = 'omni:chronos:settings'

function readTimeFormatPreference () {
  try {
    const raw = localStorage.getItem(CHRONOS_STORE_KEY)
    return raw ? (JSON.parse(raw).timeFormat ?? 'military') : 'military'
  } catch (_) {
    return 'military'
  }
}

export default class ChronosFloorClock {
  constructor (context) {
    this.ctx = context
    this._nodeId = null
    this._labelEl = null
    this._elapsed = 0
  }

  init () {
    this._nodeId = generateId()
    const seconds = getCurrentSeconds()

    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id: this._nodeId, label: 'MasterClock',
        geometry: 'IcosahedronGeometry', primitive: 'objective', color: '#ffb347',
        position: [0, FLOOR_Y, 0], rotation: [0, 0, 0], scale: [0.4, 0.4, 0.4], parentId: null,
        skipAutoSelect: true,   // a structural node, not user content — shouldn't force-open the Inspector or pin the camera's orbit pivot to itself
      }
    }))

    this._registerChartFor(seconds)

    this._labelEl = document.createElement('div')
    Object.assign(this._labelEl.style, {
      position: 'fixed', pointerEvents: 'none', transform: 'translate(-50%, -140%)',
      background: 'rgba(8,8,12,0.85)', color: '#ffb347', font: '14px "Courier New", monospace',
      padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,179,71,0.4)', zIndex: '38',
    })
    document.body.appendChild(this._labelEl)
    this._updateLabelText(seconds)
  }

  update (delta) {
    this._positionLabel()
    this._elapsed += delta
    if (this._elapsed < UPDATE_INTERVAL) return
    this._elapsed = 0

    const seconds = getCurrentSeconds()
    this._updateLabelText(seconds)
    this._registerChartFor(seconds)   // real, periodic re-registration — not every frame
  }

  onResize () {}

  destroy () {
    this._labelEl?.remove()
    window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: this._nodeId } }))
  }

  _registerChartFor (totalSeconds) {
    const totalMinutes = Math.floor(totalSeconds / 60)
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    const seconds = Math.floor(totalSeconds) % 60

    // Preserve any real visibility/type choice the user already made
    // in OmniCellPanel, rather than resetting it on every real update.
    const existing = getChart(this._nodeId)
    registerChart(this._nodeId, {
      seriesData: { MasterClock: { Hours: hours, Minutes: minutes, Seconds: seconds } },
      seriesVisibility: existing?.seriesVisibility ?? { MasterClock: true },
      chartType: existing?.chartType ?? 'bar',
    })
  }

  _updateLabelText (totalSeconds) {
    if (this._labelEl) this._labelEl.textContent = formatSeconds(totalSeconds, readTimeFormatPreference())
  }

  _positionLabel () {
    const camera = this.ctx.camera
    if (!camera || !this._labelEl) return
    const worldPos = new THREE.Vector3(0, FLOOR_Y, 0)
    const projected = worldPos.project(camera)
    if (projected.z > 1) { this._labelEl.style.display = 'none'; return }
    this._labelEl.style.display = ''
    this._labelEl.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`
    this._labelEl.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`
  }
}
