/*
 * Terminal-airspace anomaly monitor + PRECURSOR detection (Research page, ATM).
 * Real dark basemap of the LGA terminal area (CARTO/OSM). The approach corridor
 * is georeferenced to the actual RWY 31 final (302 deg true). A single arrival is
 * checked against learned human-interpretable bounds (lateral corridor + altitude
 * band). Two stages, matching the two contributions of the research:
 *   1) ANOMALY detection  — a bound is breached (red).
 *   2) PRECURSOR detection — a learned leading indicator crosses threshold a few
 *      seconds BEFORE the breach (amber), giving the controller a look-ahead.
 * Theme-aware, reduced-motion aware, pauses offscreen.
 */
(function () {
  var canvas = document.getElementById('atc-canvas');
  if (!canvas) { return; }
  var ctx = canvas.getContext('2d');
  var verdictEl = document.getElementById('atc-verdict');
  var scrubEl = document.getElementById('atc-scrub');
  var scrubHold = 0;   // frames to pause auto-advance after a manual scrub
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DANGER = '#ef5350', AMBER = '#e0a23a';
  var accent = '#c75d48';
  function readAccent() { var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); if (v) { accent = v; } }

  /* georeference (fractions of the basemap; from the bake step) */
  var LGA = { x: 0.4203, y: 0.4226 };   /* LaGuardia RWY 13/31 */
  var FAR = { x: 0.8558, y: 0.9127 };   /* ~7 nm out on the RWY 31 final (SE) */

  var bm = new Image(); var bmReady = false;
  bm.onload = function () { bmReady = true; };
  bm.src = (canvas.getAttribute('data-basemap') || '/images/lga-approach.png');

  var W = 0, H = 0, dpr = 1;
  function resize() { var r = canvas.getBoundingClientRect(); if (!r.width) { return; } dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function mode() { var r = document.querySelector('input[name="atc"]:checked'); return r ? parseInt(r.value, 10) : 0; }

  function frame() {
    var far = { x: FAR.x * W, y: FAR.y * H }, lga = { x: LGA.x * W, y: LGA.y * H };
    var dx = lga.x - far.x, dy = lga.y - far.y, len = Math.hypot(dx, dy);
    var a = { x: dx / len, y: dy / len }, p = { x: -a.y, y: a.x };
    return { far: far, lga: lga, len: len, a: a, p: p };
  }
  function hw(f, t) { return lerp(0.095, 0.014, t) * f.len; }   /* corridor half-width (narrower) */
  var TOL = 0.11;
  var GA_T = 0.45;   /* go-around: missed-approach point, then climb + teardrop loop */

  /* lateral offset (px) + altitude (0..1, 1 = high) */
  function offOf(f, t) {
    switch (mode()) {
      case 2: return smooth(0.30, 0.82, t) * 0.16 * f.len;                                    /* lateral drift */
      default: return Math.sin(t * 1.8 + 0.6) * 0.010 * f.len;                                /* gentle, low sway */
    }
  }
  function altOf(t) {
    switch (mode()) {
      case 1: return clamp(1 - 1.35 * t, 0, 1);                                               /* early descent */
      case 3: return 1 - 0.52 * t;                                                            /* high & fast */
      case 4: return t < GA_T ? 1 - (t / GA_T) * 0.82 : 0.18 + smooth(GA_T, 1, t) * 0.78;     /* descend, then climb */
      default: return (1 - t) + Math.sin(t * 4) * 0.005;
    }
  }
  /* go-around: descend on final, climb out on the heading, a 180-deg turn, then an outbound
     leg parallel to the runway in the opposite direction (teardrop / hairpin) + organic sway */
  function goAroundPos(f, t) {
    var wob = (Math.sin(t * 7.5 + 0.4) + 0.4 * Math.sin(t * 17.0)) * 0.016 * f.len;
    function w(x, y) { return { x: x + wob * f.p.x, y: y + wob * f.p.y }; }
    if (t < GA_T) { var k = t / GA_T; return w(f.far.x + f.a.x * f.len * k, f.far.y + f.a.y * f.len * k); }
    var u = (t - GA_T) / (1 - GA_T);
    var Lc = 0.14 * f.len, Ra = 0.17 * f.len, Rp = 0.15 * f.len, Lout = 0.50 * f.len;
    var Sx = f.lga.x + f.a.x * Lc, Sy = f.lga.y + f.a.y * Lc;            /* climb-out stem end */
    var Cx = Sx + f.p.x * Rp, Cy = Sy + f.p.y * Rp;                      /* turn centre */
    var Tx = Sx + f.p.x * 2 * Rp, Ty = Sy + f.p.y * 2 * Rp;             /* turn exit */
    var x, y;
    if (u < 0.22) { var s = u / 0.22; x = f.lga.x + f.a.x * Lc * s; y = f.lga.y + f.a.y * Lc * s; }
    else if (u < 0.66) { var a2 = ((u - 0.22) / 0.44) * Math.PI;        /* 180-deg elliptical turn */
      x = Cx - Math.cos(a2) * f.p.x * Rp + Math.sin(a2) * f.a.x * Ra;
      y = Cy - Math.cos(a2) * f.p.y * Rp + Math.sin(a2) * f.a.y * Ra; }
    else { var o = (u - 0.66) / 0.34; x = Tx - f.a.x * Lout * o; y = Ty - f.a.y * Lout * o; }  /* outbound parallel leg */
    return w(x, y);
  }
  function pos(f, t) { if (mode() === 4) { return goAroundPos(f, t); } return { x: f.far.x + f.a.x * f.len * t + offOf(f, t) * f.p.x, y: f.far.y + f.a.y * f.len * t + offOf(f, t) * f.p.y }; }
  /* preceding traffic stays ahead of us, gap closing, then lands — advances monotonically (never backward) */
  function leadPos(t) { var g = lerp(0.30, 0.06, smooth(0, 0.40, t)); return Math.min(t / GA_T + g, 1.0); }

  /* precursor / anomaly schedule per scenario */
  var SEC = 7;   /* approx seconds for a full approach (th 0->1) */
  var PRE = {
    1: { pre: 0.22, anom: 0.40, feat: 'SPER — descent rate', viol: 'low' },
    2: { pre: 0.42, anom: 0.62, feat: 'H — cross-track', viol: 'lateral' },
    3: { pre: 0.20, anom: 0.68, feat: 'SKE — kinetic energy', viol: 'high' },
    4: { pre: 0.18, anom: 0.46, feat: 'dH — preceding sep.', viol: 'goaround' }
  };
  function feat(t) { var m = mode(); if (!PRE[m]) { return 0.32; } return clamp(0.22 + 0.78 * (t / PRE[m].pre), 0, 1.25); }
  var REASONS = {
    goaround: 'Climbing turn away from the runway (H, V) — a go-around / missed approach, not a nominal arrival.',
    lateral: 'Track left the approach corridor (H) — lateral deviation beyond the learned bound.',
    low: 'Below the altitude band (V) — too low for the distance to the runway (low STE).',
    high: 'Above the altitude band (V) near the runway — high, unstabilized approach (high STE).'
  };
  var PRECURSOR_TXT = {
    1: 'Excessive descent rate — Specific Potential Energy Rate (SPER, ḣ) beyond the learned bound; a low-altitude breach is likely',
    2: 'Growing horizontal deviation (H) from the corridor centreline; a corridor exit is likely',
    3: 'Elevated Specific Kinetic Energy (SKE, v²⁄2g); a high / unstable approach is likely',
    4: 'Closing on preceding traffic — horizontal separation (dH) below the learned bound; a go-around is likely'
  };

  var th = 0, hold = 0, anom = null, precFired = false;
  function reset() { th = 0; hold = 0; anom = null; precFired = false; }

  function edge(f, sgn) { var a = []; for (var t = 0; t <= 1.0001; t += 0.05) { a.push({ x: f.far.x + f.a.x * f.len * t + sgn * hw(f, t) * f.p.x, y: f.far.y + f.a.y * f.len * t + sgn * hw(f, t) * f.p.y }); } return a; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (bmReady) { ctx.drawImage(bm, 0, 0, W, H); } else { ctx.fillStyle = '#0c1019'; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = 'rgba(8,11,18,0.26)'; ctx.fillRect(0, 0, W, H);
    var f = frame();

    /* corridor envelope */
    var le = edge(f, -1), re = edge(f, 1);
    ctx.beginPath(); le.forEach(function (q, i) { i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    for (var i = re.length - 1; i >= 0; i--) { ctx.lineTo(re[i].x, re[i].y); }
    ctx.closePath(); ctx.globalAlpha = 0.15; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.25;
    [le, re].forEach(function (e) { ctx.beginPath(); e.forEach(function (q, k) { k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); }); ctx.globalAlpha = 1;

    /* nominal track bundle (the learned-from data — kept prominent) */
    ctx.strokeStyle = 'rgba(228,234,246,0.34)'; ctx.lineWidth = 1.15;
    for (var b = 0; b < 9; b++) { var am = (0.20 + 0.16 * ((b * 37) % 10) / 10), ph = b * 1.0; ctx.beginPath(); for (var t = 0; t <= 1.0001; t += 0.05) { var o = Math.sin(t * 2.0 + ph) * hw(f, t) * am; var q = { x: f.far.x + f.a.x * f.len * t + o * f.p.x, y: f.far.y + f.a.y * f.len * t + o * f.p.y }; t ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke(); }

    /* runway + label */
    ctx.save(); ctx.translate(f.lga.x, f.lga.y); ctx.rotate(Math.atan2(f.a.y, f.a.x));
    ctx.fillStyle = 'rgba(235,240,250,0.95)'; ctx.fillRect(-8, -2.5, 18, 5); ctx.restore();
    ctx.fillStyle = 'rgba(235,240,250,0.92)'; ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('LGA', f.lga.x + 11, f.lga.y - 7);

    /* preceding aircraft (go-around proximity precursor) */
    if (mode() === 4) {
      var tl = leadPos(th), lp = { x: f.far.x + f.a.x * f.len * tl, y: f.far.y + f.a.y * f.len * tl };
      if (th < GA_T + 0.05) {   /* separation shown only while we are closing on the final */
        var hp0 = pos(f, th);
        ctx.strokeStyle = (feat(th) >= 1 ? AMBER : 'rgba(180,188,202,0.4)'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hp0.x, hp0.y); ctx.lineTo(lp.x, lp.y); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.save(); ctx.translate(lp.x, lp.y); ctx.rotate(Math.atan2(f.a.y, f.a.x));
      ctx.fillStyle = 'rgba(160,170,185,0.85)'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, 3.5); ctx.lineTo(-4, -3.5); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    /* aircraft track */
    drawTrack(f, function (s) { return pos(f, s); }, function (s) { return mode() === 4 ? s > GA_T : Math.abs(offOf(f, s)) > hw(f, s); });

    altInset(f); precGauge();

    ctx.fillStyle = 'rgba(190,198,212,0.5)'; ctx.font = '500 8px Inter, system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('© OpenStreetMap · © CARTO', W - 6, H - 6); ctx.textAlign = 'left';

    /* state machine: precursor (amber) -> anomaly (red), both latched */
    var m = mode(), sp = PRE[m];
    if (sp) {
      if (!precFired && th >= sp.pre) { precFired = true; }
      if (!anom && th >= sp.anom) { anom = sp.viol; }
    }
    updateVerdict();
  }

  function drawTrack(f, posFn, isViol) {
    var head = Math.max(th, 0.001), prev = null, steps = 70;
    for (var i = 0; i <= steps; i++) { var s = head * (i / steps), p = posFn(s); if (prev) { ctx.strokeStyle = isViol(s) ? DANGER : 'rgba(236,240,250,0.95)'; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); } prev = p; }
    var hp = posFn(head), hp2 = posFn(Math.max(head - 0.012, 0)), ang = Math.atan2(hp.y - hp2.y, hp.x - hp2.x);
    ctx.save(); ctx.translate(hp.x, hp.y); ctx.rotate(ang); ctx.fillStyle = anom ? DANGER : (precFired ? AMBER : '#fff');
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4); ctx.lineTo(-2, 0); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function altInset(f) {
    var w = Math.max(150, W * 0.30), h = 70, x0 = 10, y0 = H - h - 10, pad = 8;
    ctx.fillStyle = 'rgba(10,13,20,0.76)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; rrect(x0, y0, w, h, 7); ctx.fill(); ctx.stroke();
    var pl = x0 + pad, pr = x0 + w - pad, pt = y0 + 17, pb = y0 + h - pad;
    ctx.fillStyle = 'rgba(210,216,228,0.75)'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.textBaseline = 'alphabetic'; ctx.fillText('altitude band', pl, y0 + 12);
    function X(t) { return lerp(pl, pr, t); } function Y(a) { return lerp(pb, pt, clamp(a, 0, 1)); }
    ctx.beginPath(); var t; for (t = 0; t <= 1.0001; t += 0.06) { var yh = Y((1 - t) + TOL); t ? ctx.lineTo(X(t), yh) : ctx.moveTo(X(t), yh); }
    for (t = 1; t >= -0.0001; t -= 0.06) { ctx.lineTo(X(t), Y((1 - t) - TOL)); } ctx.closePath(); ctx.globalAlpha = 0.18; ctx.fillStyle = accent; ctx.fill(); ctx.globalAlpha = 1;
    var prev = null, head = Math.max(th, 0.001), steps = 50;
    for (var i = 0; i <= steps; i++) { var s = head * (i / steps), a = altOf(s), c = 1 - s, out = a < c - TOL || a > c + TOL, q = { x: X(s), y: Y(a) }; if (prev) { ctx.strokeStyle = out ? DANGER : 'rgba(236,240,250,0.9)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } prev = q; }
  }

  /* precursor look-ahead gauge (top-right) */
  function precGauge() {
    var m = mode(), sp = PRE[m]; if (!sp) { return; }
    var w = Math.max(150, W * 0.30), h = 40, x0 = W - w - 10, y0 = 10, pad = 8;
    ctx.fillStyle = 'rgba(10,13,20,0.76)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; rrect(x0, y0, w, h, 7); ctx.fill(); ctx.stroke();
    var fv = feat(th), over = fv >= 1;
    ctx.fillStyle = 'rgba(210,216,228,0.8)'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('precursor · ' + sp.feat, x0 + pad, y0 + 14);
    var bx = x0 + pad, by = y0 + 22, bw = w - pad * 2, bh = 7;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = over ? AMBER : 'rgba(180,188,202,0.6)'; ctx.fillRect(bx, by, clamp(fv, 0, 1) * bw, bh);
    /* learned threshold tick */
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + bw, by - 2); ctx.lineTo(bx + bw, by + bh + 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  var lastV = '';
  function updateVerdict() {
    if (!verdictEl) { return; }
    var m = mode(), sp = PRE[m], html;
    if (anom) {
      html = '<span class="atc-badge atc-badge--bad">ANOMALY</span> ' + REASONS[anom];
    } else if (precFired && sp) {
      var secs = Math.max(0, (sp.anom - th) * SEC);
      html = '<span class="atc-badge atc-badge--pre">PRECURSOR</span> ' + PRECURSOR_TXT[m] + ' — look-ahead ~' + secs.toFixed(0) + ' s.';
    } else if (th >= 0.999 && !sp) {
      html = '<span class="atc-badge atc-badge--ok">NOMINAL</span> Within the learned approach bounds — a normal arrival.';
    } else {
      html = '<span class="atc-badge atc-badge--mon">MONITORING</span> Tracking the arrival against the learned bounds…';
    }
    if (html !== lastV) { verdictEl.innerHTML = html; lastV = html; }
  }

  var running = false, visible = true, last = 0;
  function loop(now) {
    if (!running) { return; }
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now;
    if (visible) {
      if (scrubHold > 0) { scrubHold--; }
      else { if (th < 1) { th = Math.min(th + dt / SEC, 1); } else { hold += dt; if (hold > 1.8) { reset(); } } if (scrubEl) { scrubEl.value = Math.round(th * 1000); } }
      draw();
    }
    requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; last = 0; requestAnimationFrame(loop); } }
  function stop() { running = false; }

  readAccent(); resize();
  if (reduce) { th = 0.7; var iv = setInterval(function () { if (bmReady) { draw(); clearInterval(iv); } }, 120); }
  else if ('IntersectionObserver' in window) { new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) { start(); } else { stop(); } }, { threshold: 0.01 }).observe(canvas); }
  else { start(); }

  Array.prototype.forEach.call(document.querySelectorAll('input[name="atc"]'), function (r) { r.addEventListener('change', function () { reset(); if (scrubEl) { scrubEl.value = 0; } }); });
  if (scrubEl) {
    scrubEl.addEventListener('input', function () {
      scrubHold = 80; hold = 0;
      th = clamp(parseFloat(scrubEl.value) / 1000, 0, 1);
      var sp = PRE[mode()];
      precFired = !!(sp && th >= sp.pre);
      anom = (sp && th >= sp.anom) ? sp.viol : null;
      draw();
    });
  }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(); }, 150); });
  new MutationObserver(readAccent).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
