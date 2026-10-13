/* OmniStarBoot.js — V190 (V187 wordmark Omni⟐Star + shooting-star entrance; V190: smaller landed star, light shooting stars after landing,
 * dev intro settings read from localStorage 'omni:dev-intro-v1', window.__omniBootPreview()). Classic (non-module) script: runs as soon as
 * the boot markup is parsed, with no dependency on main.js's ES import graph.
 * See docs/architecture/OMNISTAR_BOOT_DESIGN.md for the timeline and rules.
 *
 *  1. The wordmark "Omni⟐Star" fades in. A 4-pointed star arrives as a SHOOTING STAR from the top right
 *     (curved path, ease-out, tapered comet tail) and lands centred BEHIND the ⟐ glyph.
 *  2. It snaps to 5 points, then morphs to the final mark (a 16-spike sea-urchin
 *     orb; CONFIG.FINAL_MARK / ?bootmark=star12 selects the old 12-point star)
 *     while spinning up, then keeps a slow constant spin; the urchin's spikes breathe.
 *  3. A small 2D-canvas star field fades in; stars lean toward the logo when
 *     the pointer moves / hovers the Enter button, and converge + fade on click.
 *
 * Flight (translate + rotate + the comet tail's translate / rotate / scale / opacity), landing pop and spin
 * are Web Animations on transform-type properties, so they run on the compositor and keep playing
 * even while main.js's module graph blocks the main thread. Only the two short
 * morphs (<path d>) and the star field use the main thread (rAF).
 * The rAF loop bails out as soon as #omni-boot is gone from the document.
 */
(function () {
  'use strict'
  var boot = document.getElementById('omni-boot')
  var starEl = document.getElementById('boot-star')
  var pathEl = document.getElementById('boot-star-path')
  var wordEl = document.getElementById('boot-wordmark')
  var markEl = document.getElementById('boot-mark')          // inline-block around the ⟐ (star + comet live inside it)
  var glyphEl = document.getElementById('boot-glyph-char')
  var enterBtn = document.getElementById('boot-enter-btn')
  if (!boot || !starEl || !pathEl || !wordEl || !markEl || !glyphEl) return
  // V190: the untouched markup, kept so the dev panel can replay the intro (window.__omniBootPreview below) without a reload
  var TEMPLATE = boot.outerHTML
  var SELF_SRC = (document.currentScript && document.currentScript.src) || ''

  // ── Shape math ────────────────────────────────────────────
  // ONE star function: 2n vertices, alternating outer / inner radius.
  function starPoints (n, outerR, innerR, rotation) {
    var pts = []
    for (var i = 0; i < n * 2; i++) {
      var a = rotation + i * Math.PI / n - Math.PI / 2
      var r = (i % 2 === 0) ? outerR : innerR
      pts.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    return pts
  }
  // Distance from the origin to the polygon along the ray at angle th.
  function radiusAt (pts, th) {
    var dx = Math.cos(th), dy = Math.sin(th), best = 0
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length]
      var ex = q[0] - p[0], ey = q[1] - p[1]
      var ced = dx * ey - dy * ex            // cross(d, e)
      if (Math.abs(ced) < 1e-9) continue
      var t = (p[0] * ey - p[1] * ex) / ced  // cross(P, e) / cross(d, e)
      var s = (p[0] * dy - p[1] * dx) / ced  // -cross(P, d) / cross(e, d)
      if (t > best && s > -1e-6 && s < 1 + 1e-6) best = t
    }
    return best
  }
  // ── Config: every tunable of the final mark lives here ────
  var CONFIG = {
    FINAL_MARK: 'urchin',    // 'urchin' | 'star12'. Override without a rebuild: ?bootmark=star12
    SPIKES: 16,              // spikes, evenly spaced, spike 0 points straight up
    CORE_R: 0.42,            // core disc radius as a fraction of the star box radius (design size)
    TIP_LONG: 1.0,           // tip radius multiplier (x 2.0 core radius) of even spikes
    TIP_SHORT: 0.82,         // same for odd spikes (-> 1.64 x core radius)
    JITTER: [0, -0.05, 0.04, 0.06, -0.03, -0.07, 0.05, -0.04, 0.08], // tip +-%, spikes 0..8; 9..15 mirror 7..1 (fixed, no random)
    BASE_W: 0.17,            // spike base width at the core edge, x core radius
    MIN_BASE_UNITS: 4,       // base width floor in viewBox units (~1 px at the smallest 30 px star box)
    FIT: 1.1,                // whole mark scaled so the nominal long-tip radius = FIT x the old star's outer radius (50)
    STAR_EM: 1.15,           // V190: star box in em of the wordmark font (V187-V189: 3.1 -> the landed mark was ~4x the glyph height; 1.15 -> ~1.35x). Sets --boot-star.
    BREATH_AMP: 0.06,        // spikes group scale 1 +- this
    BREATH_MS: 3200,         // breathing period
    SAMPLES_URCHIN: 400,     // polar samples: divisible by 80 so 4-, 5-star tips and all 16 spikes land exactly on a sample
    SAMPLES_STAR12: 120,     // V185 sampling for the 12-point fallback
    // V190: light shooting stars drawn on the boot canvas AFTER the star has landed (none under prefers-reduced-motion)
    SHOOT_START: 1700,       // virtual ms: the star lands at FLY_END = 1650
    SHOOT_GAP: [350, 1200],  // ms between spawn events (random) (V195: more of them)
    SHOOT_DOUBLE: 0.5,       // chance that an event spawns 2 streaks instead of 1
    SHOOT_LIFE: [600, 1000], // ms a streak lives
    SHOOT_SPEED: [650, 1000],// px / s
    SHOOT_LEN: [90, 170],    // tail length, px
    SHOOT_ANGLE: 135,        // degrees on screen (y down): 135 = down-left; +- SHOOT_SPREAD
    SHOOT_SPREAD: 40,
    SHOOT_ALPHA: 0.5,        // peak head opacity (the colour comes from the dev intro settings)
    SHOOT_TL_SHARE: 0.7,     // V195: share of streaks that start top-left and travel down to 5 o'clock
    SHOOT_TL_ANGLE: 60,      // degrees on screen (y down): 0 = 3 o'clock, 60 = 5 o'clock; +- SHOOT_TL_SPREAD
    SHOOT_TL_SPREAD: 14,
    SHOOT_MAX_LIVE: 7
  }

  // ── V190: intro settings (written by the DEV panel ui/DevOmniStarIntroSettingsPanel.js; this script runs before any module) ─
  // The value in localStorage is NEVER trusted: parsed in try/catch, every field regex-validated / clamped, defaults on any doubt.
  // `?bootintro=off` in the page URL ignores the saved value (escape hatch if a colour made the intro unreadable).
  var INTRO_KEY = 'omni:dev-intro-v1'
  var INTRO_DEFAULTS = { bg: '#000000', texture: 'none', textureOpacity: 0.35, customUrl: '', starColor: '#ffffff', starOpacity: 0.7, fieldOpacity: 1, shootColor: '#ffffff' }
  var INTRO_TEXTURES = ['none', 'noise', 'grid', 'scanlines', 'dots', 'custom']
  var MAX_DATA_URL = 400000, MAX_HTTPS_URL = 500
  function introHex (v, d) {
    if (typeof v !== 'string') return d
    var m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(v.trim())
    if (!m) return d
    var h = m[1].toLowerCase()
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    return '#' + h
  }
  function intro01 (v, d) {
    var n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
    return isFinite(n) ? Math.min(1, Math.max(0, n)) : d
  }
  function introUrl (v) {   // a data: image (png/jpeg/webp/gif, base64, capped) or an https URL without quotes / parentheses / spaces
    if (typeof v !== 'string' || !v) return ''
    if (v.length <= MAX_DATA_URL && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/]+=*$/.test(v)) return v
    if (v.length <= MAX_HTTPS_URL && /^https:\/\/[A-Za-z0-9._~:\/?#\[\]@!$&*+,;=%-]+$/.test(v)) return v
    return ''
  }
  function sanitizeIntro (raw) {
    var d = INTRO_DEFAULTS, o = {}
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {}
    o.bg = introHex(raw.bg, d.bg)
    o.texture = INTRO_TEXTURES.indexOf(raw.texture) >= 0 ? raw.texture : d.texture
    o.textureOpacity = intro01(raw.textureOpacity, d.textureOpacity)
    o.customUrl = introUrl(raw.customUrl)
    if (o.texture === 'custom' && !o.customUrl) o.texture = 'none'
    o.starColor = introHex(raw.starColor, d.starColor)
    o.starOpacity = intro01(raw.starOpacity, d.starOpacity)
    o.fieldOpacity = intro01(raw.fieldOpacity, d.fieldOpacity)
    o.shootColor = introHex(raw.shootColor, d.shootColor)
    return o
  }
  function readIntro () {
    try {
      if (/(^|[?&])bootintro=off(&|$)/.test(window.location.search)) return sanitizeIntro(null)
      var txt = window.localStorage.getItem(INTRO_KEY)
      if (!txt || txt.length > 600000) return sanitizeIntro(null)
      return sanitizeIntro(JSON.parse(txt))
    } catch (e) { return sanitizeIntro(null) }
  }
  function rgbOf (hex) { return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) }
  var INTRO = readIntro()
  var STAR_RGB = rgbOf(INTRO.starColor), SHOOT_RGB = rgbOf(INTRO.shootColor)
  ;(function applyIntroStyle () {
    var brand = boot.querySelector('.boot-brand')
    if (brand) brand.style.setProperty('--boot-star', CONFIG.STAR_EM + 'em')
    if (INTRO.bg !== INTRO_DEFAULTS.bg) boot.style.background = INTRO.bg
    boot.style.setProperty('--boot-star-alpha', String(INTRO.starOpacity))
    if (INTRO.starColor !== INTRO_DEFAULTS.starColor) {
      boot.style.setProperty('--boot-star-color', INTRO.starColor)
      boot.style.setProperty('--boot-star-rgb', STAR_RGB)
      boot.style.setProperty('--boot-comet-mid', STAR_RGB)
    }
  })()
  var MARK = CONFIG.FINAL_MARK
  try {
    var qm = new URLSearchParams(window.location.search).get('bootmark')
    if (qm === 'urchin' || qm === 'star12') MARK = qm
  } catch (e) {}
  if (MARK !== 'urchin' && MARK !== 'star12') MARK = 'urchin'

  // Resample a star to M polar samples (a ray per sample, radius from the
  // polygon). The morph is a per-sample radius lerp, and the pure shapes stay
  // exact as long as M divides every tip and valley angle.
  var M = MARK === 'urchin' ? CONFIG.SAMPLES_URCHIN : CONFIG.SAMPLES_STAR12
  var OUTER = 50, BOX = 60
  function profile (n, ratio) {
    var pts = starPoints(n, OUTER, OUTER * ratio, 0), out = new Array(M)
    for (var k = 0; k < M; k++) out[k] = radiusAt(pts, -Math.PI / 2 + k * 2 * Math.PI / M)
    return out
  }

  // The urchin: a round core plus N tapered triangular spikes. Built once as
  // (a) a polar radius profile (for the morph, a single <path>) and (b) the
  // layered form (core <circle> + spikes <g>, so the spikes can breathe on
  // their own compositor animation). Both describe the SAME outline: every spike
  // tip and base corner sits exactly on a polar sample, so the swap is seamless.
  function buildUrchin () {
    var n = CONFIG.SPIKES, per = M / n, step = 2 * Math.PI / M
    var coreU = CONFIG.CORE_R * BOX
    var sc = OUTER * CONFIG.FIT / (coreU * 2 * CONFIG.TIP_LONG)
    var coreR = coreU * sc
    var baseW = Math.max(CONFIG.BASE_W * coreR, CONFIG.MIN_BASE_UNITS)
    var hs = Math.max(1, Math.round(Math.asin(Math.min(1, baseW / 2 / coreR)) / step))
    hs = Math.min(hs, Math.floor(per / 2) - 1)
    var phi = hs * step, cs = Math.cos(phi) * coreR, sn = Math.sin(phi) * coreR
    var J = CONFIG.JITTER
    var tips = []
    for (var k = 0; k < n; k++) tips.push(coreR * 2 * ((k % 2 === 0) ? CONFIG.TIP_LONG : CONFIG.TIP_SHORT) * (1 + J[Math.min(k, n - k) % J.length]))
    var prof = new Array(M)
    for (var j = 0; j < M; j++) {
      var k0 = Math.round(j / per), d = j - k0 * per, kk = ((k0 % n) + n) % n
      var r = coreR
      if (Math.abs(d) <= hs) {
        r = radiusAt([[tips[kk], 0], [cs, sn], [cs, -sn]], d * step)
        if (r < coreR) r = coreR
      }
      prof[j] = r
    }
    var LAM = 1.3, dd = ''
    for (k = 0; k < n; k++) {      // spike polygon: tip, base corners, and the edges continued inside the core
      var ang = -Math.PI / 2 + k * per * step, ca = Math.cos(ang), sa = Math.sin(ang), T = tips[k]
      var loc = [[T, 0], [cs, sn], [T + LAM * (cs - T), LAM * sn], [T + LAM * (cs - T), -LAM * sn], [cs, -sn]]
      for (var q = 0; q < 5; q++) {
        dd += (q ? 'L' : 'M') + (loc[q][0] * ca - loc[q][1] * sa).toFixed(2) + ' ' + (loc[q][0] * sa + loc[q][1] * ca).toFixed(2)
      }
      dd += 'Z'
    }
    return { profile: prof, coreR: coreR, spikesD: dd, tips: tips, hs: hs }
  }
  var URCHIN = MARK === 'urchin' ? buildUrchin() : null

  var P4 = profile(4, 0.38), P5 = profile(5, 0.45)
  var PF = URCHIN ? URCHIN.profile : profile(12, 0.72)      // final shape profile
  var COS = new Array(M), SIN = new Array(M)
  for (var k = 0; k < M; k++) { var th = -Math.PI / 2 + k * 2 * Math.PI / M; COS[k] = Math.cos(th); SIN[k] = Math.sin(th) }
  function pathFor (a, b) { // a: 4->5 amount, b: 5->final amount (both 0..1)
    var d = '', e1 = 0, e2 = 0
    if (URCHIN) { e1 = easeInOut(clamp01(b / 0.6)); e2 = easeInOut(clamp01((b - 0.35) / 0.65)) }
    for (var k = 0; k < M; k++) {
      var r = P4[k] + (P5[k] - P4[k]) * a
      if (URCHIN) r = r + (URCHIN.coreR - r) * e1 + (PF[k] - URCHIN.coreR) * e2   // star -> round core, then spikes sprout
      else r = r + (PF[k] - r) * b
      d += (k ? 'L' : 'M') + (COS[k] * r).toFixed(2) + ' ' + (SIN[k] * r).toFixed(2)
    }
    return d + 'Z'
  }

  // Layered final form (urchin only): core circle + spikes group.
  var coreEl = null, spikesEl = null, finalShown = false, breathAnim = null
  if (URCHIN) {
    var NS = 'http://www.w3.org/2000/svg', svgEl = pathEl.ownerSVGElement || pathEl.parentNode
    coreEl = document.createElementNS(NS, 'circle')
    coreEl.setAttribute('class', 'boot-core'); coreEl.setAttribute('r', URCHIN.coreR.toFixed(3)); coreEl.setAttribute('display', 'none')
    spikesEl = document.createElementNS(NS, 'g')
    spikesEl.setAttribute('class', 'boot-spikes'); spikesEl.setAttribute('display', 'none')
    spikesEl.style.transformOrigin = '0px 0px'
    var sp = document.createElementNS(NS, 'path')
    sp.setAttribute('d', URCHIN.spikesD)
    spikesEl.appendChild(sp)
    svgEl.appendChild(coreEl); svgEl.appendChild(spikesEl)
  }
  function showFinal (breathe) {       // same frame: hide the morph path, show the layers
    if (!URCHIN || finalShown) return
    finalShown = true
    pathEl.setAttribute('display', 'none')
    coreEl.removeAttribute('display'); spikesEl.removeAttribute('display')
    if (breathe) {                     // starts at scale 1 = the morph's final geometry, so no pop
      var A = CONFIG.BREATH_AMP, outE = 'cubic-bezier(0.61, 1, 0.88, 1)', inE = 'cubic-bezier(0.12, 0, 0.39, 0)'
      breathAnim = spikesEl.animate([
        { transform: 'scale(1)', easing: outE, offset: 0 },
        { transform: 'scale(' + (1 + A) + ')', easing: inE, offset: 0.25 },
        { transform: 'scale(1)', easing: outE, offset: 0.5 },
        { transform: 'scale(' + (1 - A) + ')', easing: inE, offset: 0.75 },
        { transform: 'scale(1)', offset: 1 }
      ], { duration: CONFIG.BREATH_MS, iterations: Infinity })
    }
  }

  // ── Timeline (ms of virtual time) ─────────────────────────
  var FLY_START = 150, FLY_DUR = 1500, FLY_END = FLY_START + FLY_DUR   // shooting-star flight (same window as the V185 roll)
  var M5_START = 1500, M5_DUR = 250
  var SPIN_START = 1900, M12_DUR = 700
  var FIELD_START = SPIN_START, FIELD_FADE = 1400
  var OMEGA = 2 * Math.PI / 10000          // rad/ms: one revolution per 10 s
  var BURST = 6                            // spin-up overshoot during the 12-morph
  var CONVERGE_MS = 500
  var FLY_SPIN = -720                      // degrees the 4-star spins during the flight (ends tip-up = 0)
  var STAR_ALPHA = INTRO.starOpacity       // final star opacity behind the glyph (default 0.7 = CSS --boot-star-alpha default; V190: dev intro setting)
  var FLY_STEPS = 48                       // keyframes sampled along the curve (linear between; time is the eased parameter)

  var reduced = false
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}

  function clamp01 (x) { return x < 0 ? 0 : x > 1 ? 1 : x }
  function easeOutCubic (u) { return 1 - Math.pow(1 - u, 3) }
  function easeInOut (u) { return u * u * (3 - 2 * u) }

  // ── Layout measurement (re-run on resize / font load; never per frame) ─
  // slotX/slotY: the centre of the rendered ⟐ ink in viewport px. The inline box of the ⟐ span is measured
  // (transform-free), then corrected to the ink centre with canvas text metrics for the font actually used
  // (the ⟐ may come from a fallback font). The star's CSS centres it on the span box; --mx / --my carry the correction.
  var geo = { slotX: 0, slotY: 0, R: 20, half: 30, mx: 0, my: 0, tail: 200, ink: 0 }
  var mctx = document.createElement('canvas').getContext('2d')
  function measure () {
    var r = markEl.getBoundingClientRect()
    var cs = getComputedStyle(glyphEl)
    var mx = -(parseFloat(cs.letterSpacing) || 0) / 2, my = 0, ink = r.height   // fallback: box centre minus half the trailing letter-spacing
    try {
      mctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
      var m = mctx.measureText(glyphEl.textContent)
      if (m.actualBoundingBoxAscent != null && m.fontBoundingBoxAscent != null && isFinite(m.actualBoundingBoxAscent)) {
        // inline box content area = [baseline - fontAscent, baseline + fontDescent]; ink = [baseline - actAsc, baseline + actDesc]
        var boxMid = (m.fontBoundingBoxDescent - m.fontBoundingBoxAscent) / 2        // box centre relative to baseline (down +)
        var inkMid = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2
        my = inkMid - boxMid
        mx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - r.width / 2   // r.width includes the trailing letter-spacing, the ink does not
        ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
        if (Math.abs(my) > r.height || Math.abs(mx) > r.width) { mx = -(parseFloat(cs.letterSpacing) || 0) / 2; my = 0 }    // implausible metrics: keep the box centre
      }
    } catch (e) {}
    markEl.style.setProperty('--mx', mx.toFixed(2) + 'px'); markEl.style.setProperty('--my', my.toFixed(2) + 'px')
    geo.mx = mx; geo.my = my; geo.ink = ink
    geo.slotX = r.left + r.width / 2 + mx
    geo.slotY = r.top + r.height / 2 + my
    geo.half = starEl.offsetWidth / 2
    geo.R = starEl.offsetWidth * (OUTER / 120)    // svg viewBox is 120 wide, nominal star radius 50
  }

  // ── Star field ────────────────────────────────────────────
  var canvas = document.createElement('canvas')
  canvas.id = 'boot-starfield'
  canvas.setAttribute('aria-hidden', 'true')
  boot.insertBefore(canvas, boot.firstChild)
  // V190: optional background texture (dev intro setting) — a layer UNDER the star canvas, generated procedurally (no assets)
  function makeTextureTile (kind) {
    var n = kind === 'noise' ? 96 : kind === 'grid' ? 40 : kind === 'scanlines' ? 4 : 16
    var c = document.createElement('canvas'); c.width = c.height = n
    var g = c.getContext('2d'), i
    if (kind === 'noise') {
      var im = g.createImageData(n, n)
      for (i = 0; i < n * n; i++) { var v = (Math.random() * 255) | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255 }
      g.putImageData(im, 0, 0)
    } else if (kind === 'grid') {
      g.fillStyle = '#fff'; g.fillRect(0, 0, n, 1); g.fillRect(0, 0, 1, n)
    } else if (kind === 'scanlines') {
      g.fillStyle = '#fff'; g.fillRect(0, 0, n, 1)
    } else {   // dots
      g.fillStyle = '#fff'; g.beginPath(); g.arc(n / 2, n / 2, 1.6, 0, 6.2832); g.fill()
    }
    return c.toDataURL('image/png')
  }
  if (INTRO.texture !== 'none') {
    try {
      var tex = document.createElement('div')
      tex.id = 'boot-texture'; tex.setAttribute('aria-hidden', 'true')
      tex.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;opacity:' + INTRO.textureOpacity
      if (INTRO.texture === 'custom') tex.style.cssText += ';background:url("' + INTRO.customUrl + '") center / cover no-repeat'
      else tex.style.cssText += ';background:url("' + makeTextureTile(INTRO.texture) + '") 0 0 / auto repeat'
      boot.insertBefore(tex, canvas)
    } catch (e) {}
  }
  var ctx = canvas.getContext('2d')
  var dpr = 1, vw = 0, vh = 0
  var stars = [], links = []
  var halo = null

  function makeHalo () {
    var c = document.createElement('canvas'); c.width = c.height = 32
    var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    gr.addColorStop(0, 'rgba(' + STAR_RGB + ',0.55)'); gr.addColorStop(1, 'rgba(' + STAR_RGB + ',0)')
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32)
    return c
  }
  function resizeField () {
    vw = window.innerWidth; vh = window.innerHeight
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr)
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px'
  }
  function seedStars () {
    var n = vw < 700 ? 40 : 80
    stars = []
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5   // px/s
      stars.push({
        x: Math.random(), y: Math.random(),            // normalised 0..1
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        size: 0.6 + Math.random() * 1.2,
        a: 0.35 + Math.random() * 0.55,
        tw: 0.4 + Math.random() * 0.9, ph: Math.random() * 6.28,
        delay: Math.random() * 900,                    // staggered fade-in (ms)
        k: 0.6 + Math.random() * 0.4,                  // individual pull strength
        pull: 0
      })
    }
  }

  // ── Attract state ─────────────────────────────────────────
  var over = false           // pointer / touch / focus on the Enter button
  var moveLevel = 0, lastMove = 0
  var clickedAt = -1         // virtual time of the Enter click
  function cleanup () {   // V190: the loop is over (boot removed): drop the window listeners so a preview replay does not pile them up
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('resize', onResize)
  }
  function onMove (e) {
    var onBtn = !!(enterBtn && e.target && e.target.closest && e.target.closest('#boot-enter-btn'))
    moveLevel = onBtn ? 0.5 : 0.15
    lastMove = T
  }
  if (!reduced) {
    window.addEventListener('pointermove', onMove, { passive: true })
    if (enterBtn) {
      enterBtn.addEventListener('pointerenter', function () { over = true }, { passive: true })
      enterBtn.addEventListener('pointerleave', function () { over = false }, { passive: true })
      enterBtn.addEventListener('touchstart', function () { over = true }, { passive: true })
      enterBtn.addEventListener('focus', function () { over = true })
      enterBtn.addEventListener('blur', function () { over = false })
      // Registered before main.js's own handler; does no layout / no waiting,
      // so main.js's requestFullscreen() still runs synchronously in the click.
      enterBtn.addEventListener('click', function () { if (clickedAt < 0) clickedAt = T }, { once: true })
    }
  }

  // ── Frame loop ────────────────────────────────────────────
  var T = 0, lastTs = 0, lastKey = '', st = null, flyAnim = null, cometAnim = null, animsOn = false
  var stats = { script: [], interval: [] }
  var raf = 0, ended = false

  function drawField (dt, alphaAll) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, vw, vh)
    if (alphaAll <= 0.001) return
    var cx = geo.slotX, cy = geo.slotY
    var idle = T - lastMove
    if (idle > 600) moveLevel *= Math.exp(-dt / 700)
    var att = Math.max(over ? 0.5 : 0, moveLevel)
    var converging = clickedAt >= 0
    var conv = converging ? clamp01((T - clickedAt) / CONVERGE_MS) : 0
    var rate = 1 - Math.exp(-dt / (converging ? 140 : 550))
    var fieldT = T - FIELD_START
    var i, s, px, py
    for (i = 0; i < stars.length; i++) {
      s = stars[i]
      s.x += s.vx * dt / 1000 / vw; s.y += s.vy * dt / 1000 / vh
      if (s.x < -0.02) s.x += 1.04; else if (s.x > 1.02) s.x -= 1.04
      if (s.y < -0.02) s.y += 1.04; else if (s.y > 1.02) s.y -= 1.04
      var target = converging ? 0.96 : att * 0.8 * s.k
      s.pull += (target - s.pull) * rate
      var bx = s.x * vw, by = s.y * vh
      s.px = bx + (cx - bx) * s.pull; s.py = by + (cy - by) * s.pull
    }
    var fade = converging ? 1 - easeInOut(conv) : 1
    // constellation lines (optional, faint, capped, motion-only)
    if (!reduced) {
      var cap = vw < 700 ? 4 : 8, maxD = vw < 700 ? 110 : 150
      if (!converging && links.length < cap && fieldT > 1500 && Math.random() < dt / 700) {
        var a = stars[(Math.random() * stars.length) | 0], bestD = maxD * maxD, b = null
        for (i = 0; i < stars.length; i++) {
          s = stars[i]; if (s === a) continue
          var ddx = s.px - a.px, ddy = s.py - a.py, d2 = ddx * ddx + ddy * ddy
          if (d2 < bestD && d2 > 400) { bestD = d2; b = s }
        }
        if (b) links.push({ a: a, b: b, life: 0, span: 6000 + Math.random() * 4000 })
      }
      ctx.lineWidth = 0.6
      for (i = links.length - 1; i >= 0; i--) {
        var L = links[i]; L.life += dt
        if (L.life >= L.span) { links.splice(i, 1); continue }
        var dx = L.b.px - L.a.px, dy = L.b.py - L.a.py, dd = Math.sqrt(dx * dx + dy * dy)
        var la = Math.sin(Math.PI * L.life / L.span) * 0.16 * clamp01(1.6 - dd / maxD) * alphaAll * fade * INTRO.fieldOpacity
        if (la <= 0.003) continue
        ctx.strokeStyle = 'rgba(' + STAR_RGB + ',' + la.toFixed(3) + ')'
        ctx.beginPath(); ctx.moveTo(L.a.px, L.a.py); ctx.lineTo(L.b.px, L.b.py); ctx.stroke()
      }
    }
    ctx.fillStyle = INTRO.starColor
    var secs = T / 1000
    for (i = 0; i < stars.length; i++) {
      s = stars[i]
      var appear = clamp01((fieldT - s.delay) / FIELD_FADE)
      if (appear <= 0) continue
      var al = s.a * appear * alphaAll * fade * INTRO.fieldOpacity * (0.78 + 0.22 * Math.sin(secs * s.tw + s.ph))
      if (al <= 0.01) continue
      ctx.globalAlpha = al
      if (s.size > 1.3) ctx.drawImage(halo, s.px - 8, s.py - 8, 16, 16)
      ctx.beginPath(); ctx.arc(s.px, s.py, s.size * 0.7, 0, 6.2832); ctx.fill()
    }
    ctx.globalAlpha = 1
    if (!reduced) drawShooters(dt, alphaAll * fade, converging)
  }

  // ── V190: light shooting stars (after the landing) ─────────
  // Thin fading streaks on the boot canvas: one spawn event every SHOOT_GAP ms (1 or 2 streaks), angle biased down-left, short life,
  // low opacity. At most SHOOT_MAX_LIVE alive; cost is a couple of gradient strokes per frame. Nothing is spawned once the Enter click
  // starts the convergence, once the boot fades out, or under prefers-reduced-motion (that path never runs the frame loop at all).
  var shooters = [], nextShoot = -1
  function rnd (r) { return r[0] + Math.random() * (r[1] - r[0]) }
  function spawnShooter () {
    var tl = Math.random() < CONFIG.SHOOT_TL_SHARE      // V195: most streaks come from the top-left corner region toward 5 o'clock
    var a = (tl ? CONFIG.SHOOT_TL_ANGLE + (Math.random() + Math.random() - 1) * CONFIG.SHOOT_TL_SPREAD
              : CONFIG.SHOOT_ANGLE + (Math.random() + Math.random() - 1) * CONFIG.SHOOT_SPREAD) * Math.PI / 180
    shooters.push({
      x: tl ? vw * (-0.05 + Math.random() * 0.45) : vw * (0.25 + Math.random() * 0.8), y: tl ? vh * (-0.05 + Math.random() * 0.35) : vh * (-0.05 + Math.random() * 0.6),
      dx: Math.cos(a), dy: Math.sin(a), sp: rnd(CONFIG.SHOOT_SPEED) / 1000, len: rnd(CONFIG.SHOOT_LEN), life: rnd(CONFIG.SHOOT_LIFE), age: 0
    })
  }
  function drawShooters (dt, alphaAll, converging) {
    var i, sh
    if (!converging && T >= CONFIG.SHOOT_START && !boot.classList.contains('fade-out')) {
      if (nextShoot < 0) nextShoot = T + 300 + Math.random() * 500
      if (T >= nextShoot) {
        var n = Math.random() < CONFIG.SHOOT_DOUBLE ? 2 : 1
        while (n-- > 0 && shooters.length < CONFIG.SHOOT_MAX_LIVE) spawnShooter()
        nextShoot = T + rnd(CONFIG.SHOOT_GAP)
      }
    }
    if (!shooters.length) return
    ctx.lineWidth = 1.2; ctx.lineCap = 'round'
    for (i = shooters.length - 1; i >= 0; i--) {
      sh = shooters[i]; sh.age += dt
      if (sh.age >= sh.life) { shooters.splice(i, 1); continue }
      var u = sh.age / sh.life, env = Math.sin(Math.PI * u)            // fades in and out over its life
      var al = CONFIG.SHOOT_ALPHA * env * alphaAll
      if (al <= 0.004) continue
      var hx = sh.x + sh.dx * sh.sp * sh.age, hy = sh.y + sh.dy * sh.sp * sh.age, tl = sh.len * (0.5 + 0.5 * env)
      var gr = ctx.createLinearGradient(hx - sh.dx * tl, hy - sh.dy * tl, hx, hy)
      gr.addColorStop(0, 'rgba(' + SHOOT_RGB + ',0)'); gr.addColorStop(1, 'rgba(' + SHOOT_RGB + ',' + al.toFixed(3) + ')')
      ctx.strokeStyle = gr
      ctx.beginPath(); ctx.moveTo(hx - sh.dx * tl, hy - sh.dy * tl); ctx.lineTo(hx, hy); ctx.stroke()
    }
  }

  // Compositor animations (created on the first frame so they start with the first paint).
  var EASE_OUT_CUBIC = 'cubic-bezier(0.215, 0.61, 0.355, 1)'
  var comet = null
  // Flight path in px relative to the landing slot: a quadratic Bezier from off-screen top right to (0,0). The parameter
  // is eased (ease-out cubic), so the star decelerates into the glyph; keyframes sample it at equal times (linear between).
  function flightSamples () {
    var pad = geo.half * 2.2
    var p0x = (window.innerWidth - geo.slotX) + pad, p0y = -geo.slotY - pad       // fully off-screen, top right
    var cx = p0x * 0.42, cy = p0y * 0.62                                           // control point: bows the path (starts steeper, sweeps in leftwards)
    var out = [], prev = null
    for (var i = 0; i <= FLY_STEPS; i++) {
      var u = i / FLY_STEPS, e = easeOutCubic(u), q = 1 - e
      var x = q * q * p0x + 2 * q * e * cx, y = q * q * p0y + 2 * q * e * cy
      out.push({ u: u, x: x, y: y })
    }
    var vmax = 0
    for (i = 0; i <= FLY_STEPS; i++) {            // velocity (px per ms) by central differences, angle of travel
      var a0 = out[Math.max(0, i - 1)], a1 = out[Math.min(FLY_STEPS, i + 1)]
      var dtm = (a1.u - a0.u) * FLY_DUR
      out[i].sp = Math.hypot(a1.x - a0.x, a1.y - a0.y) / dtm
      out[i].ang = Math.atan2(a1.y - a0.y, a1.x - a0.x) * 180 / Math.PI
      if (out[i].sp > vmax) vmax = out[i].sp
    }
    for (i = 0; i <= FLY_STEPS; i++) out[i].k = vmax > 0 ? out[i].sp / vmax : 0
    geo.tail = Math.max(200, Math.min(900, vmax * 1000 * 0.38))     // tail length at full speed (px), ~380 ms of travel
    return out
  }
  function flyKeyframes (smp) {
    return smp.map(function (p) {
      return { translate: p.x.toFixed(1) + 'px ' + p.y.toFixed(1) + 'px', rotate: (FLY_SPIN * (1 - easeOutCubic(p.u))).toFixed(2) + 'deg', offset: p.u }
    })
  }
  function tailKeyframes (smp) {         // head at the star centre; scale-x = speed (tail length), opacity fades as it slows
    return smp.map(function (p) {
      var o = clamp01(p.k * 1.6) * 0.95
      return { translate: p.x.toFixed(1) + 'px ' + p.y.toFixed(1) + 'px', rotate: p.ang.toFixed(2) + 'deg', scale: (p.k).toFixed(3) + ' 1', opacity: o.toFixed(3), offset: p.u }
    })
  }
  function sizeComet () {
    comet.style.width = geo.tail.toFixed(0) + 'px'
    comet.style.marginLeft = (-geo.tail + geo.mx).toFixed(1) + 'px'
    comet.style.marginTop = 'calc(var(--boot-star) * -0.21 + ' + geo.my.toFixed(1) + 'px)'
  }
  function startAnimations (now) {
    st = now
    starEl.style.opacity = '1'
    var smp = flightSamples()
    sizeComet()
    var opts = function (o) { o.fill = o.fill || 'both'; return o }
    flyAnim = starEl.animate(flyKeyframes(smp), opts({ delay: FLY_START, duration: FLY_DUR, easing: 'linear' }))
    cometAnim = comet.animate(tailKeyframes(smp), opts({ delay: FLY_START, duration: FLY_DUR, easing: 'linear' }))
    cometAnim.onfinish = function () { if (comet.parentNode) comet.parentNode.removeChild(comet) }
    // the star is full white in flight and settles to its dimmer final alpha (CSS --boot-star-alpha) so the ⟐ stays readable
    var dimAnim = starEl.firstElementChild.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.78 }, { opacity: STAR_ALPHA, offset: 1 }],
      { delay: FLY_START, duration: FLY_DUR + 450, easing: 'ease-in-out', fill: 'both' })
    var popAnim = starEl.animate([{ scale: '1' }, { scale: '1.16' }, { scale: '1' }], { delay: M5_START, duration: M5_DUR, easing: 'ease-in-out', fill: 'none' })
    // spin-up: angle = integral of omega(u) over the 12-morph, sampled into keyframes
    var kf = [], ang = 0, N = 24, i
    for (i = 0; i <= N; i++) {
      var u = i / N
      kf.push({ rotate: (ang * 180 / Math.PI).toFixed(3) + 'deg', offset: u })
      var um = (i + 0.5) / N
      ang += OMEGA * (easeInOut(um) + BURST * Math.sin(Math.PI * um)) * (M12_DUR / N)
    }
    var spinUp = starEl.animate(kf, { delay: SPIN_START, duration: M12_DUR, easing: 'linear', fill: 'forwards' })
    var endDeg = ang * 180 / Math.PI
    var steady = starEl.animate([{ rotate: endDeg.toFixed(3) + 'deg' }, { rotate: (endDeg + 360).toFixed(3) + 'deg' }],
      { delay: SPIN_START + M12_DUR, duration: 10000, iterations: Infinity, easing: 'linear', fill: 'none' })
    ;[cometAnim, dimAnim, popAnim, spinUp, steady, flyAnim].forEach(function (an) { an.startTime = now })
    animsOn = true
  }

  function frame (ts) {
    if (!document.getElementById('omni-boot')) { ended = true; cleanup(); return }   // boot removed: stop
    raf = requestAnimationFrame(frame)
    var t0 = performance.now()
    if (!animsOn) startAnimations(ts)
    var dt = lastTs ? Math.min(ts - lastTs, 100) : 16     // drift step is clamped; the timeline itself is wall-clock
    if (lastTs) { stats.interval.push(ts - lastTs); if (stats.interval.length > 900) stats.interval.shift() }
    lastTs = ts
    T = ts - st

    var a = clamp01((T - M5_START) / M5_DUR)
    var b = clamp01((T - SPIN_START) / M12_DUR)
    var ea = easeInOut(a), eb = easeInOut(b)
    var key = ea.toFixed(3) + '|' + eb.toFixed(3)
    if (key !== lastKey) { lastKey = key; pathEl.setAttribute('d', pathFor(ea, eb)) }
    if (b >= 1 && URCHIN && !finalShown) showFinal(true)

    drawField(dt, 1)
    if (clickedAt >= 0 && T - clickedAt > CONVERGE_MS + 50) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height) }
    var cost = performance.now() - t0
    stats.script.push(cost); if (stats.script.length > 900) stats.script.shift()
  }

  // ── Init ──────────────────────────────────────────────────
  halo = makeHalo()
  resizeField()
  seedStars()

  function onResize () {
    resizeField(); measure()
    if (reduced) { drawStatic(); return }
    if (animsOn && T < FLY_END && flyAnim) {       // still flying: re-aim at the new slot
      var smp = flightSamples()
      flyAnim.effect.setKeyframes(flyKeyframes(smp))
      if (comet && comet.parentNode) { sizeComet(); cometAnim.effect.setKeyframes(tailKeyframes(smp)) }
    }
  }
  window.addEventListener('resize', onResize)       // also covers orientation changes
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (document.getElementById('omni-boot')) onResize() })

  function drawStatic () {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh)
    ctx.fillStyle = INTRO.starColor
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i]; ctx.globalAlpha = s.a * 0.7 * INTRO.fieldOpacity
      ctx.beginPath(); ctx.arc(s.x * vw, s.y * vh, s.size * 0.7, 0, 6.2832); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  measure()
  window.__omniStarBoot = {
    stats: stats, reduced: reduced, mark: MARK, config: CONFIG, urchin: URCHIN && { coreR: URCHIN.coreR, tips: URCHIN.tips, hs: URCHIN.hs },
    breathing: function () { return !!breathAnim }, pathFor: pathFor, easeInOut: easeInOut, // pathFor/easeInOut: test hooks
    intro: INTRO, sanitizeIntro: sanitizeIntro, shooters: function () { return shooters.length },   // V190: test hooks

    state: function () { return { T: T, ended: ended, links: links.length, over: over, moveLevel: moveLevel, clickedAt: clickedAt, animsOn: animsOn, geo: geo } }
  }
  // V190: replay the intro without a reload (the dev panel calls this after saving). Only possible once the real boot is gone.
  // The untouched markup is re-created and this very script is run again (it re-reads the saved intro settings).
  if (!window.__omniBootPreview) {
    window.__omniBootPreview = function () {
      if (!SELF_SRC || document.getElementById('omni-boot')) return false
      var wrap = document.createElement('div')
      wrap.innerHTML = TEMPLATE
      var el = wrap.firstElementChild
      if (!el) return false
      var btn = el.querySelector('#boot-enter-btn'), bar = el.querySelector('#boot-progress-bar')
      if (bar) { bar.classList.add('is-complete'); bar.style.width = '100%' }
      if (btn) { btn.classList.add('is-ready'); btn.textContent = 'Close preview' }
      var closed = false
      function close () {
        if (closed) return; closed = true
        window.removeEventListener('keydown', onKey)
        el.classList.add('fade-out')
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el) }, 1300)
      }
      function onKey (e) { if (e.key === 'Escape') close() }
      if (btn) btn.addEventListener('click', close)
      window.addEventListener('keydown', onKey)
      document.body.appendChild(el)
      var sc = document.createElement('script')
      sc.src = SELF_SRC.split('?')[0] + '?preview=' + Date.now()
      document.head.appendChild(sc)
      return true
    }
  }
  if (reduced) {
    pathEl.setAttribute('d', pathFor(1, 1))
    showFinal(false)
    starEl.style.opacity = '1'
    stars.length = Math.min(stars.length, 40)
    drawStatic()
  } else {
    pathEl.setAttribute('d', pathFor(0, 0))
    comet = document.createElement('span')      // tapered tail behind the flying star (compositor-animated)
    comet.className = 'boot-comet'
    comet.setAttribute('aria-hidden', 'true')
    markEl.insertBefore(comet, starEl)
    raf = requestAnimationFrame(frame)
  }
})()
