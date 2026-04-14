/**
 * utils/SoundManager.js — ⟐mniReality Sound System
 *
 * Thin wrapper around Howler.js that provides the simple global interface
 * every UI component expects:
 *
 *   Sound.play('click')
 *   Sound.play('open')
 *   Sound.play('close')
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why not importmap?
 * ─────────────────────────────────────────────────────────────────────────────
 * Howler.js ships as a UMD bundle — it sets `window.Howl` and `window.Howler`
 * rather than exporting ES module bindings. It cannot be added to the importmap.
 * SoundManager handles this by injecting a <script> tag and waiting for the
 * global to appear before resolving.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import SoundManager from './utils/SoundManager.js'
 *
 *   const Sound = new SoundManager({
 *     sounds: {
 *       click : './sounds/click.wav',
 *       open  : './sounds/open.wav',
 *       close : './sounds/close.wav',
 *     }
 *   })
 *
 *   await Sound.load()   // injects Howler, creates Howl instances
 *   ui.setSound(Sound)   // hands the manager to the UI shell
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   sound.load()              → Promise<SoundManager>  (call once)
 *   sound.play(id)            → void   silently no-ops if not loaded / muted
 *   sound.stop(id?)           → void   stops one sound or all
 *   sound.volume(val)         → void   0.0 – 1.0, global
 *   sound.getVolume()         → number
 *   sound.mute()              → void
 *   sound.unmute()            → void
 *   sound.isMuted             → boolean
 *   sound.isLoaded            → boolean
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Graceful degradation
 * ─────────────────────────────────────────────────────────────────────────────
 * If Howler fails to load (no network, CDN outage) or the browser blocks
 * audio, `play()` is permanently silenced — no exceptions are thrown, no UI
 * is broken. A warning is logged once.
 */

// ── Howler CDN ────────────────────────────────────────────────────────────────

const HOWLER_CDN = 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js'
const LOAD_TIMEOUT_MS = 8000   // give up waiting for Howler after 8 s

// ── Default sound paths (relative to index.html) ─────────────────────────────

const DEFAULT_SOUNDS = {
  click : './sounds/click.wav',
  open  : './sounds/open.wav',
  close : './sounds/close.wav',
}

// ── SoundManager ──────────────────────────────────────────────────────────────

export default class SoundManager {

  /**
   * @param {object} [options]
   * @param {object} [options.sounds]   — { id: filePath } map. Defaults to
   *                                      ./sounds/{id}.wav for the three
   *                                      built-in IDs.
   * @param {number} [options.volume]   — Initial global volume (0–1). Default 0.6
   * @param {boolean}[options.muted]    — Start muted. Default false.
   */
  constructor (options = {}) {
    this._soundPaths = { ...DEFAULT_SOUNDS, ...(options.sounds ?? {}) }
    this._vol        = options.volume ?? 0.6
    this._muted      = options.muted  ?? false

    // Howl instance map — populated after load()
    this._howls  = new Map()   // id → Howl instance
    this._loaded = false
    this._warned = false       // one-time degradation warning
  }

  // ── Public interface ─────────────────────────────────────────────────────

  /** @returns {boolean} */
  get isLoaded () { return this._loaded }

  /** @returns {boolean} */
  get isMuted  () { return this._muted  }

  /**
   * Inject Howler.js and create one Howl instance per sound.
   * Safe to call multiple times — resolves immediately on repeat calls.
   *
   * @returns {Promise<SoundManager>}
   */
  async load () {
    if (this._loaded) return this

    try {
      await this._injectHowler()
      this._createHowls()
      this._loaded = true
      console.log('⟐ SoundManager: ready —', [...this._howls.keys()].join(', '))
    } catch (err) {
      this._warn(`Failed to load Howler.js. Audio disabled. (${err?.message ?? err})`)
    }

    return this
  }

  /**
   * Play a sound by ID.
   * No-op if: not loaded, muted, id unknown, or audio context suspended.
   *
   * @param {string} id — 'click' | 'open' | 'close' | any registered id
   */
  play (id) {
    if (!this._loaded || this._muted) return

    const howl = this._howls.get(id)
    if (!howl) {
      this._warn(`Unknown sound id: "${id}"`)
      return
    }

    try {
      // Howler returns the sound's unique play ID — we don't need to track it
      howl.play()
    } catch (err) {
      this._warn(`play("${id}") failed: ${err?.message ?? err}`)
    }
  }

  /**
   * Stop a specific sound (or all sounds if no id given).
   * @param {string} [id]
   */
  stop (id) {
    if (!this._loaded) return
    if (id) {
      this._howls.get(id)?.stop()
    } else {
      this._howls.forEach(h => h.stop())
    }
  }

  /**
   * Set global volume.
   * @param {number} val — 0.0 to 1.0
   */
  volume (val) {
    this._vol = Math.max(0, Math.min(1, val))
    if (this._loaded && window.Howler) {
      window.Howler.volume(this._vol)
    }
  }

  /** @returns {number} Current global volume */
  getVolume () { return this._vol }

  /** Silence all output without stopping playback position. */
  mute () {
    this._muted = true
    if (this._loaded && window.Howler) {
      window.Howler.mute(true)
    }
  }

  /** Resume audio output. */
  unmute () {
    this._muted = false
    if (this._loaded && window.Howler) {
      window.Howler.mute(false)
    }
  }

  /**
   * Register additional sounds after the initial load.
   * Useful for Phase 4 systems that add their own sound IDs.
   *
   * @param {string} id        — new sound identifier
   * @param {string} filePath  — path to audio file
   * @returns {Promise<void>}
   */
  async register (id, filePath) {
    if (!this._loaded) {
      // Queue it — will be created on next load()
      this._soundPaths[id] = filePath
      return
    }
    if (this._howls.has(id)) return   // already registered

    this._howls.set(id, this._makeHowl(id, filePath))
    console.log(`⟐ SoundManager: registered "${id}"`)
  }

  // ── Howler injection ──────────────────────────────────────────────────────

  /**
   * Dynamically inject the Howler <script> tag and wait for window.Howl.
   * Resolves when the global is confirmed available.
   * Rejects after LOAD_TIMEOUT_MS.
   *
   * @returns {Promise<void>}
   */
  _injectHowler () {
    // Already present (e.g. loaded by another instance or via HTML)
    if (window.Howl) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Howler.js CDN timed out after ${LOAD_TIMEOUT_MS}ms`))
      }, LOAD_TIMEOUT_MS)

      const script   = document.createElement('script')
      script.src     = HOWLER_CDN
      script.async   = true
      script.crossOrigin = 'anonymous'

      script.onload = () => {
        clearTimeout(timer)
        if (window.Howl) {
          resolve()
        } else {
          reject(new Error('Howler.js loaded but window.Howl is undefined'))
        }
      }

      script.onerror = () => {
        clearTimeout(timer)
        reject(new Error(`Failed to fetch Howler.js from ${HOWLER_CDN}`))
      }

      document.head.appendChild(script)
    })
  }

  // ── Howl creation ─────────────────────────────────────────────────────────

  /** Create one Howl instance per registered sound path. */
  _createHowls () {
    for (const [id, path] of Object.entries(this._soundPaths)) {
      this._howls.set(id, this._makeHowl(id, path))
    }

    // Apply initial volume
    if (window.Howler) {
      window.Howler.volume(this._vol)
      if (this._muted) window.Howler.mute(true)
    }
  }

  /**
   * Build a single Howl instance with sane defaults for UI sounds.
   *
   * @param {string} id
   * @param {string} src
   * @returns {Howl}
   */
  _makeHowl (id, src) {
    return new window.Howl({
      src    : [src],
      volume : this._vol,
      preload: true,
      html5  : false,    // Web Audio API — lower latency for UI clicks

      onloaderror: (_id, err) => {
        this._warn(`Could not load "${id}" from ${src}. (${err})`)
      },

      onplayerror: (_id, err) => {
        // Common cause: AudioContext not started yet (browser autoplay policy).
        // Howler will retry automatically once the user interacts.
        if (!this._warned) {
          console.warn(`⟐ SoundManager: play error on "${id}" — AudioContext may need user gesture. (${err})`)
        }
      },
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Log a warning once and flag so noisy loops don't spam the console. */
  _warn (msg) {
    if (this._warned) return
    this._warned = true
    console.warn(`⟐ SoundManager: ${msg}`)
  }
}

// ── Convenience: pre-built singleton for projects that prefer it ──────────────
//
// Import and use immediately — play() is silently queued until load() resolves.
//
//   import { Sound } from './utils/SoundManager.js'
//   await Sound.load()
//   Sound.play('click')

export const Sound = new SoundManager()
