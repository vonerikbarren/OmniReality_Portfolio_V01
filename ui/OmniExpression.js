/**
 * ui/OmniExpression.js — ⟐mniReality OmniExpression
 *
 * Merges what was going to be a separate "OmniUser/OmniPresenter"
 * module into OmniExpression instead — systems/OmniPresenter.js
 * already exists and does something different (node-sequence camera
 * touring), so rather than collide with that name, this whole concept
 * — a presenter avatar the Owner of a Reality can author a spatial
 * presentation with — lives here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The core idea
 * ─────────────────────────────────────────────────────────────────────────────
 * A circle-shaped avatar carrying a looped video or image — the
 * Owner's guide-through-the-space presence. It has two positioning
 * modes:
 *
 *   Panel mode  — "stuck to the camera," positioned in screen space.
 *                 Eight named lock points exist (center, tl, tr, l, r,
 *                 bl, b, br) as quick-snap references, but per request
 *                 these are NOT a required order or a fixed set — the
 *                 avatar can sit anywhere on screen; the lock points
 *                 are just convenient presets.
 *   Scene mode  — detached, freely positioned anywhere in world space
 *                 like any other object.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The presentation (the "video software but spatial" part)
 * ─────────────────────────────────────────────────────────────────────────────
 * The Owner records waypoints — each one captures the avatar's mode +
 * position + how long to hold there — building an ordered sequence.
 * Playing it animates the AVATAR through that sequence over time.
 *
 * Deliberately different from systems/OmniPresenter.js's fly-to: that
 * system moves the VIEWER'S CAMERA through a node sequence, forcing
 * the view. Here, only the avatar moves — the viewer's own camera and
 * orbit controls are left completely alone throughout playback. That's
 * the "free will to look at the one presenting, or look at the scene"
 * the brief asked for: the presentation runs regardless of where the
 * viewer chooses to look.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What's deliberately NOT built this pass — see
 * OMNI_EXPRESSION_PRESENTER_DESIGN.md
 * ─────────────────────────────────────────────────────────────────────────────
 * The full three-circle system (circle of life / time / choice, each
 * user's personal three, exp-based unlocks), the OmniUser/OmniPlayer
 * role framework, and the deeper philosophy behind it are documented
 * there in depth rather than built now — this pass builds ONE
 * representative circle avatar and the panel/scene/timeline mechanics
 * everything else would eventually sit on top of.
 *
 * Its own Inspector lives in ui/OmniExpressionInspector.js.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const LOCK_POINTS = {
  center: { x: 0.5, y: 0.5 },
  tl:     { x: 0.14, y: 0.14 },
  tr:     { x: 0.86, y: 0.14 },
  l:      { x: 0.14, y: 0.5 },
  r:      { x: 0.86, y: 0.5 },
  bl:     { x: 0.14, y: 0.86 },
  b:      { x: 0.5, y: 0.86 },
  br:     { x: 0.86, y: 0.86 },
}
const PANEL_DISTANCE = 3.2   // how far in front of the camera the avatar sits, in panel mode

const STORE_KEY = 'omni:expression:presenter'

function loadState () {
  const defaults = {
    mode: 'panel',
    panelX: 0.86, panelY: 0.86,   // default bottom-right, out of the way
    scenePos: { x: 0, y: 2, z: -3 },
    radius: 0.5,
    color: { r: 255, g: 255, b: 255, a: 1 },
    cameraLocked: false,
    mediaUrl: './assets/video/RealityExplanation02.mp4',
    mediaType: 'video',
    waypoints: [],   // { id, mode, panelX, panelY, scenePos, holdMs }
    // Simple circles layered behind the main avatar — transparent
    // looping media, not separate interactive objects. The three
    // defaults every OmniUser/OmniPlayer has, plus room to add more
    // personal ones later (see OMNI_EXPRESSION_PRESENTER_DESIGN.md).
    backingCircles: [
      { id: 'life',   label: 'Circle of Life',   mediaUrl: '', mediaType: 'image', radiusScale: 1.12 },
      { id: 'time',   label: 'Circle of Time',   mediaUrl: '', mediaType: 'image', radiusScale: 1.22 },
      { id: 'choice', label: 'Circle of Choice', mediaUrl: '', mediaType: 'image', radiusScale: 1.32 },
    ],
    // Circle 0 spins clockwise, circle 1 counter-clockwise, circle 2
    // clockwise again, alternating with depth — direction is computed
    // from index (see update()), not stored per-circle, so it stays
    // correct automatically as circles are added or removed.
    circleRotation: { enabled: true, speed: 0.3 },
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) {
    return defaults
  }
}

function saveState (state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch (err) {
    console.warn('⟐Expression — save failed:', err)
  }
}

const STYLES = /* css */`

.omni-expression {
  --oe-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oe-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oe-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oe-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --oe-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --oe-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --oe-accent      : var(--omni-theme-accent, #c9a3ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 100px;
  left             : 120px;
  width            : 420px;
  min-width        : 340px;
  max-width        : 90vw;
  height           : 460px;
  min-height       : 340px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--oe-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--oe-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--oe-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.92);
}

.oe-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oe-header-bg);
  border-bottom    : 1px solid var(--oe-border);
  cursor           : grab;
  user-select      : none;
}
.oe-header.is-dragging { cursor: grabbing; }
.oe-title { position: absolute; left: 14px; font-size: 12px; letter-spacing: 0.06em; color: var(--oe-text-dim); }
.oe-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.oe-ctrl {
  width: 24px; height: 24px; border-radius: 6px;
  border: 1px solid var(--oe-border);
  background: rgba(255,255,255,0.04);
  color: var(--oe-text-dim);
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.oe-ctrl:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.24); color: var(--oe-text); }
.oe-ctrl--inspector { color: rgba(201, 163, 255, 0.85); border-color: rgba(201, 163, 255, 0.22); }
.oe-ctrl--inspector:hover { background: rgba(201, 163, 255, 0.14); }

.oe-body {
  flex             : 1 1 auto;
  overflow-y       : auto;
  padding          : 14px;
  display          : flex;
  flex-direction   : column;
  gap              : 10px;
}

.oe-ctrl--save { color: rgba(140, 255, 180, 0.9); border-color: rgba(140, 255, 180, 0.25); }
.oe-ctrl--save:hover { background: rgba(140, 255, 180, 0.14); }

.oe-unsaved-banner {
  flex-shrink      : 0;
  display          : none;
  align-items      : center;
  justify-content  : center;
  gap              : 6px;
  padding          : 6px;
  font-size        : 9.5px;
  letter-spacing   : 0.03em;
  color            : rgba(255, 200, 140, 0.95);
  background       : rgba(255, 180, 100, 0.12);
  border-bottom    : 1px solid rgba(255, 180, 100, 0.2);
}
.oe-unsaved-banner.is-visible { display: flex; }

.oe-size-row { display: flex; align-items: center; gap: 8px; }
.oe-size-slider { flex: 1; accent-color: var(--oe-accent); }
.oe-size-num {
  width: 56px;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px;
  color: var(--oe-text);
  font-family: var(--mono);
  font-size: 10px;
  padding: 4px 6px;
}

.oe-rgba-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.oe-rgba-label { width: 14px; flex-shrink: 0; font-size: 9.5px; color: var(--oe-text-muted); }
.oe-rgba-val { width: 32px; text-align: right; font-size: 9px; color: var(--oe-text-dim); }

.oe-row-flex { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; gap: 8px; }
.oe-toggle-sm {
  width: 34px; height: 18px;
  border-radius: 10px;
  border: 1px solid var(--oe-border);
  background: rgba(255,255,255,0.08);
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}
.oe-toggle-sm::after {
  content: '';
  position: absolute; top: 1px; left: 1px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--oe-text-dim);
  transition: transform 0.15s ease, background 0.15s ease;
}
.oe-toggle-sm.is-on { background: rgba(201, 163, 255, 0.3); border-color: rgba(201, 163, 255, 0.5); }
.oe-toggle-sm.is-on::after { transform: translateX(16px); background: var(--oe-accent); }

.oe-mode-row {
  display          : flex;
  gap              : 6px;
}
.oe-mode-btn {
  flex             : 1;
  background       : rgba(255,255,255,0.05);
  border           : 1px solid var(--oe-border);
  color            : var(--oe-text-muted);
  border-radius    : 7px;
  padding          : 8px;
  font-family      : var(--mono);
  font-size        : 10px;
  letter-spacing   : 0.04em;
  cursor           : pointer;
}
.oe-mode-btn:hover { color: var(--oe-text); }
.oe-mode-btn.is-active { background: rgba(201, 163, 255, 0.18); border-color: rgba(201, 163, 255, 0.4); color: var(--oe-accent); }

.oe-lock-grid {
  display              : grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-areas   :
    "tl top tr"
    "l  c   r"
    "bl bot br";
  gap                  : 4px;
  aspect-ratio         : 16 / 10;
}
.oe-lock-btn {
  background       : rgba(255,255,255,0.05);
  border           : 1px solid var(--oe-border);
  border-radius    : 5px;
  color            : var(--oe-text-muted);
  font-size        : 8px;
  cursor           : pointer;
}
.oe-lock-btn:hover { background: rgba(255,255,255,0.11); color: var(--oe-text); }
.oe-lock-btn.is-active { background: rgba(201, 163, 255, 0.22); border-color: rgba(201, 163, 255, 0.5); color: var(--oe-accent); }
.oe-lock-btn--tl { grid-area: tl; } .oe-lock-btn--top { grid-area: top; } .oe-lock-btn--tr { grid-area: tr; }
.oe-lock-btn--l  { grid-area: l; }  .oe-lock-btn--c   { grid-area: c; }   .oe-lock-btn--r  { grid-area: r; }
.oe-lock-btn--bl { grid-area: bl; } .oe-lock-btn--bot { grid-area: bot; } .oe-lock-btn--br { grid-area: br; }

.oe-group-title {
  font-size        : 9px;
  letter-spacing   : 0.08em;
  text-transform   : uppercase;
  color            : var(--oe-accent);
  margin-top       : 4px;
}

.oe-media-row { display: flex; gap: 6px; }
.oe-media-input {
  flex: 1;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px;
  color: var(--oe-text);
  font-family: var(--mono);
  font-size: 10px;
  padding: 5px 7px;
}
.oe-media-type-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--oe-border);
  color: var(--oe-text-muted);
  border-radius: 5px;
  padding: 5px 9px;
  font-size: 9px;
  cursor: pointer;
}
.oe-media-type-btn.is-active { background: rgba(201, 163, 255, 0.18); color: var(--oe-accent); }

.oe-waypoint-controls { display: flex; gap: 6px; align-items: center; }
.oe-btn-small {
  background: rgba(201, 163, 255, 0.1);
  border: 1px solid rgba(201, 163, 255, 0.3);
  color: var(--oe-accent);
  border-radius: 6px;
  padding: 6px 10px;
  font-family: var(--mono);
  font-size: 9.5px;
  cursor: pointer;
}
.oe-btn-small:hover { background: rgba(201, 163, 255, 0.18); }
.oe-btn-small--play { background: rgba(140, 255, 180, 0.1); border-color: rgba(140, 255, 180, 0.3); color: rgba(160, 255, 195, 0.95); }
.oe-btn-small--play:hover { background: rgba(140, 255, 180, 0.18); }
.oe-btn-small--play.is-playing { background: rgba(255, 140, 140, 0.15); border-color: rgba(255, 140, 140, 0.35); color: rgba(255, 170, 170, 0.95); }

.oe-timeline-wrap {
  margin-top       : auto;
  flex-shrink      : 0;
  padding-top      : 10px;
  border-top       : 1px solid rgba(255,255,255,0.08);
}
.oe-timeline-track {
  position         : relative;
  height           : 34px;
  background       : rgba(255,255,255,0.04);
  border           : 1px solid var(--oe-border);
  border-radius    : 8px;
  margin-top       : 8px;
}
.oe-timeline-marker {
  position         : absolute;
  top              : 4px;
  width            : 10px;
  height           : 26px;
  border-radius    : 3px;
  background       : rgba(201, 163, 255, 0.35);
  border           : 1px solid rgba(201, 163, 255, 0.6);
  cursor           : pointer;
  transform        : translateX(-50%);
}
.oe-timeline-marker:hover { background: rgba(201, 163, 255, 0.55); }
.oe-timeline-marker.is-current { background: rgba(140, 255, 180, 0.55); border-color: rgba(140, 255, 180, 0.8); }
.oe-timeline-playhead {
  position         : absolute;
  top              : 0; bottom: 0;
  width            : 2px;
  background       : #fff;
  box-shadow       : 0 0 6px rgba(255,255,255,0.8);
  pointer-events   : none;
  left             : 0%;
}
.oe-timeline-empty {
  font-size        : 9px;
  color            : var(--oe-text-muted);
  text-align       : center;
  padding          : 8px;
}

.oe-resize-handle {
  position         : absolute; right: 0; bottom: 0;
  width            : 16px; height: 16px;
  cursor           : nwse-resize;
  z-index          : 2;
}
.oe-resize-handle::before {
  content          : '';
  position         : absolute; right: 3px; bottom: 3px;
  width            : 8px; height: 8px;
  border-right     : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom    : 2px solid rgba(255, 255, 255, 0.25);
  border-radius    : 0 0 2px 0;
}
.oe-resize-handle:hover::before { border-color: rgba(255, 255, 255, 0.6); }

`

function injectStyles () {
  if (document.getElementById('omni-expression-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-expression-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniExpression {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    this._state = loadState()
    // Staged copy of the "appearance" fields only — mode, position,
    // media, radius, color, camera-lock. Waypoints/backing-circles
    // stay immediate CRUD, unaffected by this — matches the Admin/
    // Chronos save pattern: edits here don't touch the real avatar in
    // the scene until Save is pressed.
    this._staged = this._extractStaged(this._state)
    this._avatarGroup = null
    this._avatarMesh = null
    this._mediaVideoEl = null
    this._backingMeshes = []   // parallel to this._state.backingCircles: { mesh, videoEl }
    this._isPlaying = false
    this._playTimeline = null
    this._currentWaypointIndex = -1

    this._onNavSelect = null
    this._onInspectorUpdate = null
  }

  init () {
    injectStyles()
    this._buildAvatar()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniExpressionPresenter') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // OmniExpressionInspector edits flow back here — it doesn't own
    // the avatar mesh or storage itself.
    this._onInspectorUpdate = (e) => {
      const patch = e.detail ?? {}
      Object.assign(this._state, patch)
      saveState(this._state)
      this._applyStateToAvatar()
      // _applyStateToAvatar only handles radius/color/position — media
      // (video/image) loading is a separate concern it doesn't cover,
      // so a patch containing mediaUrl needs to explicitly trigger it.
      if ('mediaUrl' in patch) this._loadMedia(this._state.mediaUrl, this._state.mediaType)
      this._staged = this._extractStaged(this._state)   // Inspector edits apply immediately — keep the main panel's form in sync, no stale "unsaved" banner for a change that's already live
      this._syncPanelUI()
    }
    window.addEventListener('omni:expression-state-set', this._onInspectorUpdate)

    // From ui/OmniExpressionVideoPlayer.js — direct playback control,
    // not a state patch (transient actions, not persisted state).
    this._onVideoControl = (e) => {
      const { action, time } = e.detail ?? {}
      const video = this._mediaVideoEl
      if (!video) return
      if (action === 'play') video.play().catch(() => {})
      else if (action === 'pause') video.pause()
      else if (action === 'seek' && typeof time === 'number') video.currentTime = time
    }
    window.addEventListener('omni:expression-video-control', this._onVideoControl)

    this._onBackingCircleRequest = (e) => {
      const { action, id, patch } = e.detail ?? {}
      if (action === 'add') this._addBackingCircle()
      else if (action === 'remove') this._removeBackingCircle(id)
      else if (action === 'update') this._updateBackingCircle(id, patch)

      // Re-share state so the Inspector (if open) reflects the change
      // immediately — matters most for 'add', since the new circle's
      // id is generated here, not known to the Inspector beforehand.
      window.dispatchEvent(new CustomEvent('omni:expression-inspect-request', {
        detail: { state: structuredClone(this._state) }
      }))
    }
    window.addEventListener('omni:expression-backing-circle-request', this._onBackingCircleRequest)
  }

  update (delta) {
    if (!this._avatarGroup) return
    if (this._state.mode === 'panel') this._updatePanelPosition()
    // Always billboard toward the camera — a flat circle not facing
    // the viewer would just look like an edge-on line. Rotating the
    // GROUP (not just the avatar mesh) keeps every backing circle
    // facing the camera together with it.
    this._avatarGroup.quaternion.copy(this.ctx.camera.quaternion)

    if (this._state.circleRotation.enabled) {
      const speed = this._state.circleRotation.speed
      this._backingMeshes.forEach(({ mesh }, i) => {
        if (!mesh) return
        const direction = i % 2 === 0 ? 1 : -1   // 0=CW, 1=CCW, 2=CW, alternating
        mesh.rotation.z += direction * speed * delta
      })
    }
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:expression-state-set', this._onInspectorUpdate)
    window.removeEventListener('omni:expression-video-control', this._onVideoControl)
    window.removeEventListener('omni:expression-backing-circle-request', this._onBackingCircleRequest)
    this._disposeMediaTexture()
    this._backingMeshes.forEach((_, i) => this._disposeBackingMedia(i))
    if (this._avatarGroup) {
      this.ctx.scene.remove(this._avatarGroup)
      this._avatarGroup.traverse(obj => {
        obj.geometry?.dispose()
        obj.material?.dispose()
      })
    }
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniexpression')
  }

  // ── Avatar (the circle + looped media guide) + backing circles ──────────

  _buildAvatar () {
    this._avatarGroup = new THREE.Group()
    this.ctx.scene.add(this._avatarGroup)

    const geo = new THREE.CircleGeometry(this._state.radius, 48)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true })
    this._avatarMesh = new THREE.Mesh(geo, mat)
    this._avatarMesh.renderOrder = 998
    this._avatarMesh.position.z = 0   // front-most, within the group
    this._avatarGroup.add(this._avatarMesh)

    this._buildBackingCircles()
    this._applyStateToAvatar()
    if (this._state.mediaUrl) this._loadMedia(this._state.mediaUrl, this._state.mediaType)
  }

  /** The life/time/choice circles (+ any personal ones added later) —
   *  simple transparent-looping-media circles, layered behind the main
   *  avatar within the same group so they move/rotate together with
   *  it. NOT separate interactive objects — no modes, no waypoints of
   *  their own, just a visual stack. */
  _buildBackingCircles () {
    this._state.backingCircles.forEach((circle, i) => {
      const radius = this._state.radius * (circle.radiusScale ?? 1.5)
      const geo = new THREE.CircleGeometry(radius, 40)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.z = -(i + 1) * 0.15   // increasing distance behind the avatar
      mesh.renderOrder = 997 - i
      this._avatarGroup.add(mesh)
      this._backingMeshes[i] = { mesh, videoEl: null }
      if (circle.mediaUrl) this._loadBackingMedia(i, circle.mediaUrl, circle.mediaType)
    })
  }

  _addBackingCircle () {
    const id = 'circle_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const i = this._state.backingCircles.length
    this._state.backingCircles.push({ id, label: `Circle ${i + 1}`, mediaUrl: '', mediaType: 'image', radiusScale: 1.12 + i * 0.1 })
    saveState(this._state)

    const radius = this._state.radius * (1.3 + i * 0.3)
    const geo = new THREE.CircleGeometry(radius, 40)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.z = -(i + 1) * 0.15
    mesh.renderOrder = 997 - i
    this._avatarGroup.add(mesh)
    this._backingMeshes[i] = { mesh, videoEl: null }
  }

  _removeBackingCircle (id) {
    const i = this._state.backingCircles.findIndex(c => c.id === id)
    if (i === -1) return
    this._disposeBackingMedia(i)
    const entry = this._backingMeshes[i]
    if (entry?.mesh) {
      this._avatarGroup.remove(entry.mesh)
      entry.mesh.geometry?.dispose()
      entry.mesh.material?.dispose()
    }
    this._state.backingCircles.splice(i, 1)
    this._backingMeshes.splice(i, 1)
    saveState(this._state)
  }

  _updateBackingCircle (id, patch) {
    const circle = this._state.backingCircles.find(c => c.id === id)
    const i = this._state.backingCircles.findIndex(c => c.id === id)
    if (!circle || i === -1) return
    Object.assign(circle, patch)
    saveState(this._state)

    const entry = this._backingMeshes[i]
    if (!entry?.mesh) return
    if (patch.radiusScale != null) {
      const radius = this._state.radius * patch.radiusScale
      entry.mesh.geometry.dispose()
      entry.mesh.geometry = new THREE.CircleGeometry(radius, 40)
    }
    if (patch.mediaUrl != null || patch.mediaType != null) {
      this._loadBackingMedia(i, circle.mediaUrl, circle.mediaType)
    }
  }

  /** Backing circles are image-only, always — even though the
   *  underlying mechanism (mirroring the main avatar's own
   *  _loadMedia) technically supports video, circles exist only to
   *  give the avatar resonance and meaning, never a second video
   *  layer. Enforced here at the data level, not just by removing the
   *  Inspector's old toggle — so this holds regardless of what patch
   *  a future caller sends. */
  _loadBackingMedia (index, url, type) {
    const entry = this._backingMeshes[index]
    if (!url || !entry?.mesh) return
    this._disposeBackingMedia(index)

    const loader = new THREE.TextureLoader()
    loader.load(url, (texture) => {
      if (entry.mesh) {
        texture.colorSpace = THREE.SRGBColorSpace
        entry.mesh.material.map = texture
        entry.mesh.material.needsUpdate = true
      }
    })
  }

  _disposeBackingMedia (index) {
    const entry = this._backingMeshes[index]
    if (!entry) return
    if (entry.videoEl) {
      entry.videoEl.pause()
      entry.videoEl.src = ''
      entry.videoEl = null
    }
    if (entry.mesh?.material.map) {
      entry.mesh.material.map.dispose()
      entry.mesh.material.map = null
    }
  }

  /** Pulls just the appearance-related fields out of full state, for
   *  the staged working copy the form fields bind to. */
  _extractStaged (state) {
    return {
      mode: state.mode,
      panelX: state.panelX, panelY: state.panelY,
      scenePos: { ...state.scenePos },
      radius: state.radius,
      color: { ...state.color },
      cameraLocked: state.cameraLocked,
      mediaUrl: state.mediaUrl,
      mediaType: state.mediaType,
    }
  }

  _applyStateToAvatar () {
    if (!this._avatarMesh) return
    if (this._avatarMesh.geometry.parameters.radius !== this._state.radius) {
      this._avatarMesh.geometry.dispose()
      this._avatarMesh.geometry = new THREE.CircleGeometry(this._state.radius, 48)
    }
    this._resizeBackingCircles()
    const { r, g, b, a } = this._state.color
    this._avatarMesh.material.color.setRGB(r / 255, g / 255, b / 255)
    this._avatarMesh.material.opacity = a
    if (this._state.mode === 'scene') {
      this._avatarGroup.position.set(this._state.scenePos.x, this._state.scenePos.y, this._state.scenePos.z)
    }
    // panel mode position is computed live every frame in update()
  }

  /** Keeps every backing circle proportional to the main avatar's
   *  radius (each one is radius * its own radiusScale) — these were
   *  only ever sized once, at creation, with nothing re-syncing them
   *  when the main radius changed later. Called whenever radius
   *  changes, live or via Save. */
  _resizeBackingCircles () {
    this._state.backingCircles.forEach((circle, i) => {
      const entry = this._backingMeshes[i]
      if (!entry?.mesh) return
      const radius = this._state.radius * (circle.radiusScale ?? 1.5)
      if (entry.mesh.geometry.parameters.radius === radius) return
      entry.mesh.geometry.dispose()
      entry.mesh.geometry = new THREE.CircleGeometry(radius, 40)
    })
  }

  _loadMedia (url, type) {
    if (!url || !this._avatarMesh) return
    this._disposeMediaTexture()

    if (type === 'video') {
      const video = document.createElement('video')
      video.src = url
      video.loop = true
      video.muted = true       // required by browsers for autoplay
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      video.play().catch(() => {})   // ignore autoplay-blocked errors — still loads, just paused
      video.addEventListener('timeupdate', () => {
        window.dispatchEvent(new CustomEvent('omni:expression-video-timeupdate', {
          detail: { currentTime: video.currentTime, duration: video.duration || 0, paused: video.paused }
        }))
      })
      this._mediaVideoEl = video
      const texture = new THREE.VideoTexture(video)
      // Real fix — without this, three.js treats the texture as
      // linear instead of sRGB, washing it out under this project's
      // own ACES tone mapping. Matches the same, already-correct
      // pattern WallpaperSphere.js uses for its own textures.
      texture.colorSpace = THREE.SRGBColorSpace
      this._avatarMesh.material.map = texture
      this._avatarMesh.material.needsUpdate = true
    } else {
      const loader = new THREE.TextureLoader()
      loader.load(url, (texture) => {
        if (this._avatarMesh) {
          texture.colorSpace = THREE.SRGBColorSpace
          this._avatarMesh.material.map = texture
          this._avatarMesh.material.needsUpdate = true
        }
      })
    }
  }

  _disposeMediaTexture () {
    if (this._mediaVideoEl) {
      this._mediaVideoEl.pause()
      this._mediaVideoEl.src = ''
      this._mediaVideoEl = null
    }
    if (this._avatarMesh?.material.map) {
      this._avatarMesh.material.map.dispose()
      this._avatarMesh.material.map = null
    }
  }

  /** Panel mode — "stuck to the camera." Unprojects a screen-space
   *  point (0..1 in each axis) into world space at a fixed distance in
   *  front of the camera, every frame, so it tracks as the camera
   *  moves/rotates. This runs regardless of which of the 8 lock points
   *  (if any) was used to set panelX/panelY — those are just presets
   *  for this same free x/y positioning, not a separate mechanism.
   *  Positions the GROUP, so the avatar and every backing circle move
   *  together. */
  _updatePanelPosition () {
    const ndcX = this._state.panelX * 2 - 1
    const ndcY = -(this._state.panelY * 2 - 1)
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5)
    vector.unproject(this.ctx.camera)
    const dir = vector.sub(this.ctx.camera.position).normalize()
    const pos = this.ctx.camera.position.clone().add(dir.multiplyScalar(PANEL_DISTANCE))
    this._avatarGroup.position.copy(pos)
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-expression'
    const s = this._staged
    el.innerHTML = /* html */`
      <div class="oe-header">
        <span class="oe-title">⟐OmniExpression</span>
        <div class="oe-controls">
          <button class="oe-ctrl oe-ctrl--save" data-action="save" title="Save">💾</button>
          <button class="oe-ctrl oe-ctrl--inspector" data-action="inspector" title="Open Inspector">⟐i</button>
          <button class="oe-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="oe-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oe-unsaved-banner" id="oe-unsaved-banner">⚠ Unsaved changes — click 💾 to apply</div>
      <div class="oe-body" id="oe-body">

        <div class="oe-mode-row">
          <button class="oe-mode-btn ${s.mode === 'panel' ? 'is-active' : ''}" data-mode="panel">Panel Mode</button>
          <button class="oe-mode-btn ${s.mode === 'scene' ? 'is-active' : ''}" data-mode="scene">Scene Mode</button>
        </div>

        <div id="oe-lock-section" style="${s.mode === 'panel' ? '' : 'display:none'}">
          <div class="oe-group-title">Lock Points (presets, not an order — drag anywhere)</div>
          <div class="oe-lock-grid" id="oe-lock-grid">
            <button class="oe-lock-btn oe-lock-btn--tl"  data-lock="tl">↖</button>
            <button class="oe-lock-btn oe-lock-btn--top" data-lock="center-top">Top</button>
            <button class="oe-lock-btn oe-lock-btn--tr"  data-lock="tr">↗</button>
            <button class="oe-lock-btn oe-lock-btn--l"   data-lock="l">←</button>
            <button class="oe-lock-btn oe-lock-btn--c"   data-lock="center">●</button>
            <button class="oe-lock-btn oe-lock-btn--r"   data-lock="r">→</button>
            <button class="oe-lock-btn oe-lock-btn--bl"  data-lock="bl">↙</button>
            <button class="oe-lock-btn oe-lock-btn--bot" data-lock="b">Bot</button>
            <button class="oe-lock-btn oe-lock-btn--br"  data-lock="br">↘</button>
          </div>
        </div>

        <div class="oe-group-title">Size</div>
        <div class="oe-size-row">
          <input type="range" class="oe-size-slider" id="oe-radius-slider" min="0.1" max="3" step="0.05" value="${s.radius}">
          <input type="number" class="oe-size-num" id="oe-radius-num" min="0.1" max="3" step="0.05" value="${s.radius}">
        </div>

        <div class="oe-group-title">Color (RGBA)</div>
        <div class="oe-rgba-row"><span class="oe-rgba-label">R</span><input type="range" class="oe-size-slider" data-rgba="r" min="0" max="255" value="${s.color.r}"><span class="oe-rgba-val" data-rgba-val="r">${s.color.r}</span></div>
        <div class="oe-rgba-row"><span class="oe-rgba-label">G</span><input type="range" class="oe-size-slider" data-rgba="g" min="0" max="255" value="${s.color.g}"><span class="oe-rgba-val" data-rgba-val="g">${s.color.g}</span></div>
        <div class="oe-rgba-row"><span class="oe-rgba-label">B</span><input type="range" class="oe-size-slider" data-rgba="b" min="0" max="255" value="${s.color.b}"><span class="oe-rgba-val" data-rgba-val="b">${s.color.b}</span></div>
        <div class="oe-rgba-row"><span class="oe-rgba-label">A</span><input type="range" class="oe-size-slider" data-rgba="a" min="0" max="1" step="0.01" value="${s.color.a}"><span class="oe-rgba-val" data-rgba-val="a">${Number(s.color.a).toFixed(2)}</span></div>

        <div class="oe-group-title">Guide Media (looped)</div>
        <div class="oe-media-row">
          <input type="text" class="oe-media-input" id="oe-media-url" placeholder="Image or video URL…" value="${s.mediaUrl}">
          <button class="oe-media-type-btn ${s.mediaType === 'image' ? 'is-active' : ''}" data-media-type="image">Img</button>
          <button class="oe-media-type-btn ${s.mediaType === 'video' ? 'is-active' : ''}" data-media-type="video">Vid</button>
        </div>

        <div class="oe-row-flex">
          <span class="oe-group-title" style="margin:0">Lock Viewer Camera During Playback</span>
          <button class="oe-toggle-sm ${s.cameraLocked ? 'is-on' : ''}" id="oe-camera-locked" role="switch" aria-checked="${s.cameraLocked}"></button>
        </div>

        <div class="oe-group-title">Presentation</div>
        <div class="oe-waypoint-controls">
          <button class="oe-btn-small" id="oe-record-waypoint">+ Record Waypoint</button>
          <button class="oe-btn-small oe-btn-small--play" id="oe-play-toggle">▶ Play</button>
        </div>

        <div class="oe-timeline-wrap">
          <div class="oe-group-title">Timeline</div>
          <div class="oe-timeline-track" id="oe-timeline-track"></div>
        </div>
      </div>
      <div class="oe-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)
    this._renderTimeline()

    el.querySelector('[data-action="save"]').addEventListener('click', () => this._save())
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="inspector"]').addEventListener('click', () => this._openInspector())

    el.dataset.winId = 'omniexpression'
    WindowManager.register('omniexpression', el, 'OmniExpression')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindControls (el) {
    el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._staged.mode = btn.dataset.mode
        this._markUnsaved()
        el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('is-active', b === btn))
        el.querySelector('#oe-lock-section').style.display = this._staged.mode === 'panel' ? '' : 'none'
      })
    })

    el.querySelectorAll('[data-lock]').forEach(btn => {
      btn.addEventListener('click', () => {
        // 'center-top' isn't in LOCK_POINTS (named tl/tr/l/r/bl/b/br/center
        // cover the corners+sides+center already) — "Top" reuses tl/tr's y at center x.
        const resolved = btn.dataset.lock === 'center-top' ? { x: 0.5, y: 0.14 } : LOCK_POINTS[btn.dataset.lock]
        if (!resolved) return
        this._staged.panelX = resolved.x
        this._staged.panelY = resolved.y
        this._markUnsaved()
        el.querySelectorAll('[data-lock]').forEach(b => b.classList.toggle('is-active', b === btn))
      })
    })

    const radiusSlider = el.querySelector('#oe-radius-slider')
    const radiusNum = el.querySelector('#oe-radius-num')
    let radiusSaveTimer = null
    const onRadiusChange = (val) => {
      const radius = Number(val)
      this._staged.radius = radius
      this._state.radius = radius   // live — size applies immediately, not gated behind Save
      radiusSlider.value = val
      radiusNum.value = val
      this._applyStateToAvatar()
      // Also persists on its own (debounced) — "instead of only saving"
      // means this field shouldn't revert on reload just because the
      // Save button (which still gates the other fields) wasn't
      // separately clicked.
      clearTimeout(radiusSaveTimer)
      radiusSaveTimer = setTimeout(() => saveState(this._state), 400)
    }
    radiusSlider.addEventListener('input', (e) => onRadiusChange(e.target.value))
    radiusNum.addEventListener('input', (e) => onRadiusChange(e.target.value))

    el.querySelectorAll('[data-rgba]').forEach(input => {
      input.addEventListener('input', (e) => {
        const ch = input.dataset.rgba
        this._staged.color[ch] = Number(e.target.value)
        el.querySelector(`[data-rgba-val="${ch}"]`).textContent = ch === 'a' ? Number(e.target.value).toFixed(2) : e.target.value
        this._markUnsaved()
      })
    })

    el.querySelector('#oe-media-url').addEventListener('change', (e) => {
      this._staged.mediaUrl = e.target.value
      this._markUnsaved()
    })

    el.querySelectorAll('[data-media-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._staged.mediaType = btn.dataset.mediaType
        this._markUnsaved()
        el.querySelectorAll('[data-media-type]').forEach(b => b.classList.toggle('is-active', b === btn))
      })
    })

    el.querySelector('#oe-camera-locked').addEventListener('click', (e) => {
      this._staged.cameraLocked = !this._staged.cameraLocked
      e.currentTarget.classList.toggle('is-on', this._staged.cameraLocked)
      e.currentTarget.setAttribute('aria-checked', String(this._staged.cameraLocked))
      this._markUnsaved()
    })

    el.querySelector('#oe-record-waypoint').addEventListener('click', () => this._recordWaypoint())
    el.querySelector('#oe-play-toggle').addEventListener('click', () => this._togglePlay())
  }

  _markUnsaved () {
    this._el?.querySelector('#oe-unsaved-banner')?.classList.add('is-visible')
  }

  /** Save button — the ONLY place staged appearance changes actually
   *  take effect: merged into the real (applied) state, persisted, and
   *  pushed onto the avatar in the scene. Everything else on this
   *  panel (waypoints, backing circles) is unaffected — those commit
   *  immediately, as before; this staged pattern covers appearance
   *  fields specifically, per explicit request to match Admin/Chronos. */
  _save () {
    const mediaChanged = this._staged.mediaUrl !== this._state.mediaUrl || this._staged.mediaType !== this._state.mediaType

    Object.assign(this._state, {
      mode: this._staged.mode,
      panelX: this._staged.panelX, panelY: this._staged.panelY,
      scenePos: { ...this._staged.scenePos },
      radius: this._staged.radius,
      color: { ...this._staged.color },
      cameraLocked: this._staged.cameraLocked,
      mediaUrl: this._staged.mediaUrl,
      mediaType: this._staged.mediaType,
    })
    saveState(this._state)
    this._applyStateToAvatar()
    if (mediaChanged) this._loadMedia(this._state.mediaUrl, this._state.mediaType)

    this._el?.querySelector('#oe-unsaved-banner')?.classList.remove('is-visible')
  }

  _openInspector () {
    window.dispatchEvent(new CustomEvent('omni:expression-inspect-request', {
      detail: { state: structuredClone(this._state) }
    }))
  }

  _syncPanelUI () {
    if (!this._el) return
    const s = this._staged
    this._el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('is-active', b.dataset.mode === s.mode))
    this._el.querySelector('#oe-lock-section').style.display = s.mode === 'panel' ? '' : 'none'
    const urlInput = this._el.querySelector('#oe-media-url')
    if (urlInput) urlInput.value = s.mediaUrl
    this._el.querySelectorAll('[data-media-type]').forEach(b => b.classList.toggle('is-active', b.dataset.mediaType === s.mediaType))
    const radiusSlider = this._el.querySelector('#oe-radius-slider')
    const radiusNum = this._el.querySelector('#oe-radius-num')
    if (radiusSlider) radiusSlider.value = s.radius
    if (radiusNum) radiusNum.value = s.radius
    ;['r', 'g', 'b', 'a'].forEach(ch => {
      const input = this._el.querySelector(`[data-rgba="${ch}"]`)
      const val = this._el.querySelector(`[data-rgba-val="${ch}"]`)
      if (input) input.value = s.color[ch]
      if (val) val.textContent = ch === 'a' ? Number(s.color[ch]).toFixed(2) : s.color[ch]
    })
    const cameraToggle = this._el.querySelector('#oe-camera-locked')
    if (cameraToggle) {
      cameraToggle.classList.toggle('is-on', s.cameraLocked)
      cameraToggle.setAttribute('aria-checked', String(s.cameraLocked))
    }
    this._el.querySelector('#oe-unsaved-banner')?.classList.remove('is-visible')
  }

  // ── Waypoints / Timeline — the "spatial video editor" authoring layer ────

  _recordWaypoint () {
    const wp = {
      id: 'wp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      mode: this._state.mode,
      panelX: this._state.panelX,
      panelY: this._state.panelY,
      scenePos: { ...this._state.scenePos },
      holdMs: 1500,
    }
    this._state.waypoints.push(wp)
    saveState(this._state)
    this._renderTimeline()
  }

  _renderTimeline () {
    const track = this._el?.querySelector('#oe-timeline-track')
    if (!track) return
    const wps = this._state.waypoints

    if (wps.length === 0) {
      track.innerHTML = '<div class="oe-timeline-empty">No waypoints yet — set a position, then "Record Waypoint."</div>'
      return
    }

    track.innerHTML = wps.map((wp, i) => {
      const pct = wps.length === 1 ? 50 : (i / (wps.length - 1)) * 96 + 2
      return `<div class="oe-timeline-marker ${i === this._currentWaypointIndex ? 'is-current' : ''}" data-wp-index="${i}" style="left:${pct}%" title="${wp.mode} · hold ${wp.holdMs}ms"></div>`
    }).join('') + '<div class="oe-timeline-playhead" id="oe-playhead"></div>'

    track.querySelectorAll('[data-wp-index]').forEach(marker => {
      marker.addEventListener('click', () => this._previewWaypoint(Number(marker.dataset.wpIndex)))
    })
  }

  /** Clicking a marker jumps the avatar there instantly, without
   *  playing the whole sequence — a quick way to check a waypoint. */
  _previewWaypoint (index) {
    const wp = this._state.waypoints[index]
    if (!wp) return
    this._state.mode = wp.mode
    this._state.panelX = wp.panelX
    this._state.panelY = wp.panelY
    this._state.scenePos = { ...wp.scenePos }
    this._applyStateToAvatar()
    this._syncPanelUI()
    this._currentWaypointIndex = index
    this._renderTimeline()
  }

  _togglePlay () {
    if (this._isPlaying) this._stopPlay()
    else this._startPlay()
  }

  /** Animates the AVATAR through the recorded waypoints — deliberately
   *  never touches this.ctx.camera or orbit controls. The viewer's own
   *  view stays exactly where they left it, free to watch the avatar
   *  or look anywhere else, the whole time this runs. */
  _startPlay () {
    if (this._state.waypoints.length === 0 || this._isPlaying) return
    this._isPlaying = true
    this._el?.querySelector('#oe-play-toggle')?.classList.add('is-playing')
    if (this._el) this._el.querySelector('#oe-play-toggle').textContent = '■ Stop'

    // Optional — off by default. When on, freezes the viewer's own
    // camera for the duration of playback, same orbit-disable event
    // systems/OmniPresenter.js already uses for its own fly-to. This
    // does NOT contradict the "free will" default (avatar-only
    // movement, camera untouched) — that stays the default; this is
    // an explicit opt-in the Owner can turn on for a more guided feel.
    if (this._state.cameraLocked) {
      window.dispatchEvent(new CustomEvent('omni:orbit-disable'))
    }

    const tl = gsap.timeline({
      onComplete: () => this._stopPlay(),
    })
    this._playTimeline = tl

    this._state.waypoints.forEach((wp, i) => {
      tl.call(() => {
        this._currentWaypointIndex = i
        this._renderTimeline()
      })

      const prevMode = i === 0 ? this._state.mode : this._state.waypoints[i - 1].mode
      const sameModeAsPrev = i === 0 || prevMode === wp.mode

      if (wp.mode === 'panel' && sameModeAsPrev) {
        const proxy = { x: this._state.panelX, y: this._state.panelY }
        tl.to(proxy, {
          x: wp.panelX, y: wp.panelY, duration: 1, ease: 'power2.inOut',
          onUpdate: () => { this._state.panelX = proxy.x; this._state.panelY = proxy.y },
        })
      } else if (wp.mode === 'scene' && sameModeAsPrev) {
        const proxy = { ...this._state.scenePos }
        tl.to(proxy, {
          x: wp.scenePos.x, y: wp.scenePos.y, z: wp.scenePos.z, duration: 1, ease: 'power2.inOut',
          onUpdate: () => {
            this._state.scenePos.x = proxy.x; this._state.scenePos.y = proxy.y; this._state.scenePos.z = proxy.z
            this._avatarGroup.position.set(proxy.x, proxy.y, proxy.z)
          },
        })
      } else {
        // Mode changed since the last waypoint — an instant cut rather
        // than trying to blend panel-space and world-space positions,
        // which don't share a coordinate system to interpolate between.
        tl.call(() => {
          this._state.mode = wp.mode
          this._state.panelX = wp.panelX
          this._state.panelY = wp.panelY
          this._state.scenePos = { ...wp.scenePos }
          this._applyStateToAvatar()
        })
      }

      tl.call(() => this._applyStateToAvatar())
      tl.to({}, { duration: wp.holdMs / 1000 })
    })
  }

  _stopPlay () {
    this._playTimeline?.kill()
    this._playTimeline = null
    this._isPlaying = false
    this._currentWaypointIndex = -1
    this._renderTimeline()
    const btn = this._el?.querySelector('#oe-play-toggle')
    if (btn) { btn.classList.remove('is-playing'); btn.textContent = '▶ Play' }
    if (this._state.cameraLocked) {
      window.dispatchEvent(new CustomEvent('omni:orbit-enable'))
    }
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.92, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'omniexpression', label: '⟐OmniExpression', iconLabel: '⟐E',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.oe-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top: this._drag.originY + (cy - this._drag.startY) })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }

    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.oe-resize-handle')
    if (!handle) return
    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy
      resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
