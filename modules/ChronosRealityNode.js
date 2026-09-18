/**
 * modules/ChronosRealityNode.js — the large, traveling reality-node
 *
 * "When Primary Time plays, a real, large node — representing the
 * whole of space/reality that exists at that moment — travels
 * through the Master Tunnel." Confirmed: any texture, including
 * video, with the video's own playback genuinely correlated with
 * Primary Time's own value, not played back independently.
 *
 * A structural part of the Master Tunnel system itself — like
 * RootSpace's own tunnel meshes, this is not a user-content node
 * and is deliberately NOT registered through OmniNode's normal
 * node-create-request path.
 *
 * Y-position loops once per real day (86400 seconds) across the
 * tunnel's own real floor-to-ceiling span — ties naturally into the
 * floor clock already showing a 24-hour military/AM-PM read, rather
 * than an arbitrary, disconnected loop length.
 */

import * as THREE from 'three'
import { getCurrentSeconds } from '../utils/PrimaryTime.js'

const FLOOR_Y = -102
const CEILING_Y = 158
const TUNNEL_HEIGHT = CEILING_Y - FLOOR_Y
const DAY_SECONDS = 86400   // one real day — the loop period, matching the floor clock's own 24-hour read
const NODE_RADIUS = 18      // stays safely inside RootSpace's own INNER_RADIUS (22)

export default class ChronosRealityNode {
  constructor (context) {
    this.ctx = context
    this.mesh = null
    this._videoEl = null
    this._isVideoTexture = false
  }

  init () {
    const geo = new THREE.CircleGeometry(NODE_RADIUS, 48)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.rotation.x = Math.PI / 2   // lies flat, matching the tunnel's own horizontal cross-sections
    this._updatePosition()
    this.ctx.scene.add(this.mesh)
  }

  update () {
    this._updatePosition()
    this._syncVideoToTime()
  }

  onResize () {}

  destroy () {
    this._videoEl?.pause()
    this.ctx.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.map?.dispose()
    this.mesh.material.dispose()
  }

  /** Real, any-texture support, including video — confirmed
   *  directly. An image texture just loads and applies; a video
   *  texture creates a real, muted, loop-free <video> element whose
   *  own playback position is driven entirely by Primary Time,
   *  never by its own native autoplay clock. */
  setTexture (url, isVideo = false) {
    this.mesh.material.map?.dispose()
    this._videoEl?.pause()
    this._isVideoTexture = isVideo

    if (isVideo) {
      const video = document.createElement('video')
      video.src = url
      video.muted = true
      video.loop = false   // Primary Time itself drives the loop, not the video's own native one
      video.play().catch(() => {})   // needed on some browsers before currentTime can be set meaningfully
      this._videoEl = video
      this.mesh.material.map = new THREE.VideoTexture(video)
    } else {
      this._videoEl = null
      new THREE.TextureLoader().load(url, (texture) => {
        this.mesh.material.map = texture
        this.mesh.material.needsUpdate = true
      })
    }
    this.mesh.material.needsUpdate = true
  }

  _updatePosition () {
    const cyclePosition = (getCurrentSeconds() % DAY_SECONDS) / DAY_SECONDS
    this.mesh.position.y = FLOOR_Y + cyclePosition * TUNNEL_HEIGHT
  }

  /** The real correlation — video playback position as a genuine
   *  function of Primary Time's own current value, confirmed
   *  directly as a requirement, not left to the video's own native
   *  playback clock. */
  _syncVideoToTime () {
    if (!this._isVideoTexture || !this._videoEl || !this._videoEl.duration) return
    const cyclePosition = (getCurrentSeconds() % DAY_SECONDS) / DAY_SECONDS
    this._videoEl.currentTime = cyclePosition * this._videoEl.duration
  }
}
