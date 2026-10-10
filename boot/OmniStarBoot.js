/* OmniStarBoot.js — V185. Classic (non-module) script: runs as soon as the
 * boot markup is parsed, with no dependency on main.js's ES import graph.
 * See docs/architecture/OMNISTAR_BOOT_DESIGN.md for the timeline and rules.
 *
 *  1. A 4-pointed star rolls in from the left and lands after "OmniStar".
 *  2. It snaps to 5 points, then morphs to 12 points while spinning up,
 *     then keeps a slow constant spin.
 *  3. A small 2D-canvas star field fades in; stars lean toward the logo when
 *     the pointer moves / hovers the Enter button, and converge + fade on click.
 *
 * Roll, landing pop and spin are Web Animations on transform-type properties
 * (translate / rotate / scale), so they run on the compositor and keep playing
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
  var enterBtn = document.getElementById('boot-enter-btn')
  if (!boot || !starEl || !pathEl || !wordEl) return

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
  // Resample a star to M polar samples. M=120 (3 deg) so every tip and valley
  // of the 4-, 5- and 12-point stars lands exactly on a sample; the morph is a
  // per-sample radius lerp, and the pure shapes stay exact.
  var M = 120, OUTER = 50
  function profile (n, ratio) {
    var pts = starPoints(n, OUTER, OUTER * ratio, 0), out = new Array(M)
    for (var k = 0; k < M; k++) out[k] = radiusAt(pts, -Math.PI / 2 + k * 2 * Math.PI / M)
    return out
  }
  var P4 = profile(4, 0.38), P5 = profile(5, 0.45), P12 = profile(12, 0.72)
  var COS = new Array(M), SIN = new Array(M)
  for (var k = 0; k < M; k++) { var th = -Math.PI / 2 + k * 2 * Math.PI / M; COS[k] = Math.cos(th); SIN[k] = Math.sin(th) }
  function pathFor (a, b) { // a: 4->5 amount, b: 5->12 amount (both 0..1)
    var d = ''
    for (var k = 0; k < M; k++) {
      var r = P4[k] + (P5[k] - P4[k]) * a
      r = r + (P12[k] - r) * b
      d += (k ? 'L' : 'M') + (COS[k] * r).toFixed(2) + ' ' + (SIN[k] * r).toFixed(2)
    }
    return d + 'Z'
  }

  // ── Timeline (ms of virtual time) ─────────────────────────
  var ROLL_START = 150, ROLL_DUR = 1500, ROLL_END = ROLL_START + ROLL_DUR
  var M5_START = 1500, M5_DUR = 250
  var SPIN_START = 1900, M12_DUR = 700
  var FIELD_START = SPIN_START, FIELD_FADE = 1400
  var OMEGA = 2 * Math.PI / 10000          // rad/ms: one revolution per 10 s
  var BURST = 6                            // spin-up overshoot during the 12-morph
  var CONVERGE_MS = 500

  var reduced = false
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) {}

  function clamp01 (x) { return x < 0 ? 0 : x > 1 ? 1 : x }
  function easeOutCubic (u) { return 1 - Math.pow(1 - u, 3) }
  function easeInOut (u) { return u * u * (3 - 2 * u) }

  // ── Layout measurement (re-run on resize; never per frame) ─
  var geo = { slotX: 0, slotY: 0, R: 20, D: 0, k: 1, wLeft: 0, wRight: 0, wW: 0 }
  function measure () {
    // offset* ignores transforms (the roll animation), so this is the star's landing slot.
    var row = starEl.offsetParent || wordEl.parentNode
    var rr = row.getBoundingClientRect()
    var w = wordEl.getBoundingClientRect()
    var r = { width: starEl.offsetWidth }
    geo.slotX = rr.left + starEl.offsetLeft + starEl.offsetWidth / 2
    geo.slotY = rr.top + starEl.offsetTop + starEl.offsetHeight / 2
    geo.R = r.width * (OUTER / 120)          // svg viewBox is 120 wide, star radius 50
    geo.D = geo.slotX + geo.R * 2            // start fully off-screen to the left
    // distance / radius = rolled angle; nudge to a whole number of turns so
    // the star lands tip-up (reads as a clean 5-point star when it snaps).
    var turns = geo.D / geo.R / (2 * Math.PI)
    geo.k = Math.max(1, Math.round(turns)) / turns
    geo.wLeft = w.left; geo.wRight = w.right; geo.wW = w.width
  }

  // ── Star field ────────────────────────────────────────────
  var canvas = document.createElement('canvas')
  canvas.id = 'boot-starfield'
  canvas.setAttribute('aria-hidden', 'true')
  boot.insertBefore(canvas, boot.firstChild)
  var ctx = canvas.getContext('2d')
  var dpr = 1, vw = 0, vh = 0
  var stars = [], links = []
  var halo = null

  function makeHalo () {
    var c = document.createElement('canvas'); c.width = c.height = 32
    var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
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
  var T = 0, lastTs = 0, lastKey = '', st = null, rollAnim = null, cover = null, animsOn = false
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
        var la = Math.sin(Math.PI * L.life / L.span) * 0.16 * clamp01(1.6 - dd / maxD) * alphaAll * fade
        if (la <= 0.003) continue
        ctx.strokeStyle = 'rgba(255,255,255,' + la.toFixed(3) + ')'
        ctx.beginPath(); ctx.moveTo(L.a.px, L.a.py); ctx.lineTo(L.b.px, L.b.py); ctx.stroke()
      }
    }
    ctx.fillStyle = '#fff'
    var secs = T / 1000
    for (i = 0; i < stars.length; i++) {
      s = stars[i]
      var appear = clamp01((fieldT - s.delay) / FIELD_FADE)
      if (appear <= 0) continue
      var al = s.a * appear * alphaAll * fade * (0.78 + 0.22 * Math.sin(secs * s.tw + s.ph))
      if (al <= 0.01) continue
      ctx.globalAlpha = al
      if (s.size > 1.3) ctx.drawImage(halo, s.px - 8, s.py - 8, 16, 16)
      ctx.beginPath(); ctx.arc(s.px, s.py, s.size * 0.7, 0, 6.2832); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Compositor animations (created on the first frame so they start with the first paint).
  var EASE_OUT_CUBIC = 'cubic-bezier(0.215, 0.61, 0.355, 1)'
  function rollKeyframes () {
    return [
      { translate: (-geo.D).toFixed(1) + 'px 0px', rotate: (-(geo.D / geo.R) * geo.k * 180 / Math.PI).toFixed(2) + 'deg' },
      { translate: '0px 0px', rotate: '0deg' }
    ]
  }
  function coverKeyframes () {          // black cover over the word, pulled right by the star's trailing edge
    var rowLeft = coverRowLeft, trail0 = geo.slotX - geo.R - geo.D, trail1 = geo.slotX - geo.R
    return [
      { transform: 'translateX(' + (trail0 - rowLeft).toFixed(1) + 'px)', opacity: 1, offset: 0 },
      { transform: 'translateX(' + (trail1 - rowLeft).toFixed(1) + 'px)', opacity: 1, offset: 0.999 },
      { transform: 'translateX(' + (trail1 - rowLeft).toFixed(1) + 'px)', opacity: 0, offset: 1 }
    ]
  }
  var coverRowLeft = 0
  function startAnimations (now) {
    st = now
    var row = wordEl.parentNode
    coverRowLeft = row.getBoundingClientRect().left
    starEl.style.opacity = '1'
    var opts = function (o) { o.fill = o.fill || 'both'; return o }
    rollAnim = starEl.animate(rollKeyframes(), opts({ delay: ROLL_START, duration: ROLL_DUR, easing: EASE_OUT_CUBIC }))
    var coverAnim = cover.animate(coverKeyframes(), opts({ delay: ROLL_START, duration: ROLL_DUR, easing: EASE_OUT_CUBIC }))
    coverAnim.onfinish = function () { if (cover.parentNode) cover.parentNode.removeChild(cover) }
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
    ;[coverAnim, popAnim, spinUp, steady].forEach(function (an) { an.startTime = now })
    rollAnim.startTime = now
    animsOn = true
  }

  function frame (ts) {
    if (!document.getElementById('omni-boot')) { ended = true; return }   // boot removed: stop
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
    if (animsOn && T < ROLL_END) {       // still rolling: re-aim at the new slot
      rollAnim.effect.setKeyframes(rollKeyframes())
      if (cover && cover.parentNode) { coverRowLeft = wordEl.parentNode.getBoundingClientRect().left; cover.getAnimations()[0].effect.setKeyframes(coverKeyframes()) }
    }
  }
  window.addEventListener('resize', onResize)

  function drawStatic () {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh)
    ctx.fillStyle = '#fff'
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i]; ctx.globalAlpha = s.a * 0.7
      ctx.beginPath(); ctx.arc(s.x * vw, s.y * vh, s.size * 0.7, 0, 6.2832); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  measure()
  window.__omniStarBoot = {
    stats: stats, reduced: reduced,
    state: function () { return { T: T, ended: ended, links: links.length, over: over, moveLevel: moveLevel, clickedAt: clickedAt, animsOn: animsOn, geo: geo } }
  }
  if (reduced) {
    pathEl.setAttribute('d', pathFor(1, 1))
    starEl.style.opacity = '1'
    stars.length = Math.min(stars.length, 40)
    drawStatic()
  } else {
    pathEl.setAttribute('d', pathFor(0, 0))
    cover = document.createElement('span')       // hides the word until the star's trailing edge passes it
    cover.className = 'boot-cover'
    cover.setAttribute('aria-hidden', 'true')
    wordEl.parentNode.insertBefore(cover, starEl)
    raf = requestAnimationFrame(frame)
  }
})()
