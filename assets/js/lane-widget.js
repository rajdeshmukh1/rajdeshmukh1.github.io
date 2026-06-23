/*
 * Perception widget — Work page. ONE shared world (ego frame) rendered in TWO
 * geometrically-consistent panels: a forward pinhole-camera view and a metric
 * bird's-eye (BEV). Two modes:
 *   LANE (Plus): noisy per-frame lane-marking detections (dashed gaps + occlusion)
 *     drive a Kalman filter on the clothoid state [c0,c1,c2,c3] with the exact
 *     ego-motion polynomial-shift propagation; the tracked lane coasts through gaps.
 *   OBJECT (Aptiv): radar (good range, poor lateral) + camera (good lateral, poor
 *     range) detections are fused per object by a Kalman tracker — the fused
 *     estimate is tighter than either sensor; either can be dropped.
 * Theme-aware, reduced-motion aware, pauses offscreen.
 */
(function () {
  var canvas = document.getElementById('lane-canvas');
  if (!canvas) { return; }
  var ctx = canvas.getContext('2d');
  var noiseEl = document.getElementById('lane-noise');
  var btnWrap = document.getElementById('lane-btns');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var accent = '#c75d48';
  function readAccent() { var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); if (v) { accent = v; } }
  function noiseMult() { return noiseEl ? parseFloat(noiseEl.value) : 1; }

  /* ---------- small linear algebra ---------- */
  function mmul(A, B) { var m = A.length, n = B.length, p = B[0].length, C = [], i, j, k, s; for (i = 0; i < m; i++) { C[i] = []; for (j = 0; j < p; j++) { s = 0; for (k = 0; k < n; k++) { s += A[i][k] * B[k][j]; } C[i][j] = s; } } return C; }
  function mvec(A, v) { var m = A.length, n = v.length, r = [], i, k, s; for (i = 0; i < m; i++) { s = 0; for (k = 0; k < n; k++) { s += A[i][k] * v[k]; } r[i] = s; } return r; }
  function mT(A) { var m = A.length, n = A[0].length, C = [], i, j; for (j = 0; j < n; j++) { C[j] = []; for (i = 0; i < m; i++) { C[j][i] = A[i][j]; } } return C; }
  function madd(A, B) { return A.map(function (r, i) { return r.map(function (x, j) { return x + B[i][j]; }); }); }
  function msub(A, B) { return A.map(function (r, i) { return r.map(function (x, j) { return x - B[i][j]; }); }); }
  function mscale(A, s) { return A.map(function (r) { return r.map(function (x) { return x * s; }); }); }
  function eye(n, s) { var C = [], i, j; for (i = 0; i < n; i++) { C[i] = []; for (j = 0; j < n; j++) { C[i][j] = i === j ? s : 0; } } return C; }
  function vadd(a, b) { return a.map(function (x, i) { return x + b[i]; }); }
  function inv2(M) { var d = M[0][0] * M[1][1] - M[0][1] * M[1][0]; if (Math.abs(d) < 1e-9) { d = d < 0 ? -1e-9 : 1e-9; } return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]]; }
  function gauss() { var u = 0, v = 0; while (!u) { u = Math.random(); } while (!v) { v = Math.random(); } return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ---------- shared world (ego frame): X forward (m), Y lateral (+left, m) ---------- */
  var DT = 0.075, VEGO = 22, LANEW = 3.6, XMAX = 66, XNEAR = 5;
  var mode = 'lane';
  /* lane truth clothoid center: lat(X) = c0 + c1 X + c2/2 X^2 + c3/6 X^3 */
  var cT = [0, 0, 0.0008, 0];
  /* lane KF */
  var ck = [0, 0, 0, 0], Pk = eye(4, 4);
  var occl = 0;                       // occlusion countdown (frames)
  var detsL = [];                     // current lane detections [{X,y,side}]
  /* objects */
  var objs = [], dropRadar = false, dropCam = false;
  var XS = [];  (function () { var x; for (x = 6; x <= XMAX; x += 4) { XS.push(x); } })();

  function latC(c, X) { return c[0] + c[1] * X + c[2] / 2 * X * X + c[3] / 6 * X * X * X; }
  function Hrow(X) { return [1, X, X * X / 2, X * X * X / 6]; }
  function Fshift(d) { return [[1, d, d * d / 2, d * d * d / 6], [0, 1, d, d * d / 2], [0, 0, 1, d], [0, 0, 0, 1]]; }

  function makeObjs() {
    objs = [];
    var lanes = [LANEW, 0, -LANEW];           // left, ego, right lane OFFSETS from road center
    var spec = [{ X: 34, lane: 0, dv: -1.5 }, { X: 22, lane: 1, dv: 0.2 }, { X: 48, lane: 2, dv: -3 }];
    spec.forEach(function (s) {
      var off = lanes[s.lane], Y0 = latC(cT, s.X) + off;
      objs.push({ X: s.X, laneOff: off, Vx: s.dv, cutin: false, tx: s.X, ty: Y0,
        kx: [s.X, s.dv, Y0, 0], P: [[6, 0, 0, 0], [0, 4, 0, 0], [0, 0, 6, 0], [0, 0, 0, 4]] });
    });
  }

  /* ---------- simulation ---------- */
  /* road truth evolution (shared by both modes so the scene never freezes on a mode switch):
     flows toward ego (polynomial shift) + gentle curvature random-walk + ego re-centers/aligns */
  function evolveRoad() {
    var d = VEGO * DT;
    cT = mvec(Fshift(d), cT);
    cT[0] *= 0.86; cT[1] *= 0.86;
    cT[3] += gauss() * 0.00006 - 0.04 * cT[3];
    cT[2] += cT[3] * d - 0.02 * cT[2];
    if (cT[2] > 0.004) { cT[2] = 0.004; } if (cT[2] < -0.004) { cT[2] = -0.004; }
  }
  function stepLane() {
    evolveRoad();
    var d = VEGO * DT;
    /* detections: noisy boundary points, dashed gaps, occlusion window */
    detsL = [];
    var sig = 0.22 * noiseMult();
    if (occl > 0) { occl--; }
    var k, side;
    for (k = 0; k < XS.length; k++) {
      var X = XS[k];
      if (occl > 0 && X > 16 && X < 38) { continue; }       // a truck ahead hides markings
      for (side = -1; side <= 1; side += 2) {
        if (((k + (side > 0 ? 0 : 1)) % 2) === 0 && X > 10) { continue; }   // dashed: skip alternating stations
        var yt = latC(cT, X) + side * LANEW / 2 + gauss() * sig;
        detsL.push({ X: X, y: yt, side: side });
        if (Math.random() < 0.03) { detsL[detsL.length - 1].y += (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random()); }  // outlier flier
      }
    }
    /* KF predict (exact ego-motion shift) */
    var F = Fshift(d);
    ck = mvec(F, ck);
    var Ql = [[0.02, 0, 0, 0], [0, 0.01, 0, 0], [0, 0, 2e-6, 0], [0, 0, 0, 2e-7]];
    Pk = madd(mmul(mmul(F, Pk), mT(F)), Ql);
    /* KF update: sequential scalar updates per surviving point (robust: clamp residual) */
    var R = sig * sig + 0.01;
    detsL.forEach(function (p) {
      var Hh = Hrow(p.X), pred = Hh[0] * ck[0] + Hh[1] * ck[1] + Hh[2] * ck[2] + Hh[3] * ck[3];
      var resid = (p.y - p.side * LANEW / 2) - pred;
      if (Math.abs(resid) > 5 * Math.sqrt(R)) { return; }     // gate outliers
      var PH = mvec(Pk, Hh);                                   // P H^T (4)
      var S = Hh[0] * PH[0] + Hh[1] * PH[1] + Hh[2] * PH[2] + Hh[3] * PH[3] + R;
      var Kk = [PH[0] / S, PH[1] / S, PH[2] / S, PH[3] / S];
      ck = [ck[0] + Kk[0] * resid, ck[1] + Kk[1] * resid, ck[2] + Kk[2] * resid, ck[3] + Kk[3] * resid];
      var i, j, KH = []; for (i = 0; i < 4; i++) { KH[i] = []; for (j = 0; j < 4; j++) { KH[i][j] = (i === j ? 1 : 0) - Kk[i] * Hh[j]; } }
      Pk = mmul(KH, Pk);
    });
  }

  function stepObject() {
    evolveRoad();
    var i;
    var Fo = [[1, DT, 0, 0], [0, 1, 0, 0], [0, 0, 1, DT], [0, 0, 0, 1]];
    var Qo = mscale([[0.25 * DT, 0.5 * DT, 0, 0], [0.5 * DT, DT, 0, 0], [0, 0, 0.25 * DT, 0.5 * DT], [0, 0, 0, DT]], 2.2);
    var sig = noiseMult();
    var Rr = [[0.6 * 0.6 * sig * sig, 0], [0, 3.2 * 3.2 * sig * sig]];   // radar: good X, poor Y
    var Rc = [[4.5 * 4.5 * sig * sig, 0], [0, 0.45 * 0.45 * sig * sig]]; // camera: poor X, good Y
    for (i = 0; i < objs.length; i++) {
      var o = objs[i];
      o.X += o.Vx * DT; if (o.X < 10) { o.X = 10 + Math.random() * 4; o.Vx = -(0.5 + Math.random() * 2.5); }
      if (o.X > XMAX) { o.X = XMAX; o.Vx = -(0.5 + Math.random() * 2.5); }
      if (o.cutin) { o.laneOff += (0 - o.laneOff) * 0.05; if (Math.abs(o.laneOff) < 0.06) { o.laneOff = 0; o.cutin = false; } }
      o.tx = o.X; o.ty = latC(cT, o.X) + o.laneOff;        // true position follows its lane on the curved road
      /* predict */
      o.kx = mvec(Fo, o.kx); o.P = madd(mmul(mmul(Fo, o.P), mT(Fo)), Qo);
      /* radar + camera detections (anisotropic noise), sequential fusion updates */
      o.zr = null; o.zc = null;
      if (!dropRadar) { var zr = [o.tx + gauss() * Math.sqrt(Rr[0][0]), o.ty + gauss() * Math.sqrt(Rr[1][1])]; o.zr = zr; kfUpdate(o, zr, Rr); }
      if (!dropCam && o.tx < 58) { var zc = [o.tx + gauss() * Math.sqrt(Rc[0][0]), o.ty + gauss() * Math.sqrt(Rc[1][1])]; o.zc = zc; kfUpdate(o, zc, Rc); }
    }
  }
  function kfUpdate(o, z, R) {
    var Hx = [o.kx[0], o.kx[2]];                       // measure (X, Y)
    var y = [z[0] - Hx[0], z[1] - Hx[1]];
    var P = o.P;
    var S = [[P[0][0] + R[0][0], P[0][2]], [P[2][0], P[2][2] + R[1][1]]];
    var Si = inv2(S);
    /* K = P H^T S^-1  (H picks rows 0,2) -> 4x2 */
    var PHt = [[P[0][0], P[0][2]], [P[1][0], P[1][2]], [P[2][0], P[2][2]], [P[3][0], P[3][2]]];
    var K = mmul(PHt, Si);
    o.kx = vadd(o.kx, mvec(K, y));
    /* P = (I - K H) P */
    var i, j, KH = eye(4, 0);
    for (i = 0; i < 4; i++) { KH[i][0] = K[i][0]; KH[i][2] = K[i][1]; }   // K H places cols at 0,2
    o.P = mmul(msub(eye(4, 1), KH), P);
  }

  /* ---------- projections ---------- */
  var W = 0, Hh = 0, dpr = 1;
  function resize() { var rc = canvas.getBoundingClientRect(); if (!rc.width) { return; } dpr = Math.min(window.devicePixelRatio || 1, 2); W = rc.width; Hh = rc.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function split() { return Math.round(W * 0.5); }
  /* forward pinhole camera (left panel) — camera height HCAM, focal f, looking +X */
  var HCAM = 2.4;
  function camGeom() { var SP = split(), pw = SP, f = pw * 1.05, cx = pw * 0.5, cy = Hh * 0.40; return { pw: pw, f: f, cx: cx, cy: cy }; }
  function cam(X, Y, Z) { if (X <= XNEAR * 0.5) { return null; } var g = camGeom(); return { x: g.cx - g.f * (Y / X), y: g.cy + g.f * ((HCAM - (Z || 0)) / X) }; }
  /* metric bird's-eye (right panel) */
  function bevGeom() { var SP = split(), pw = W - SP, s = (Hh - 28) / XMAX, cx = SP + pw * 0.5, ey = Hh - 16; return { left: SP, pw: pw, s: s, cx: cx, ey: ey }; }
  function bev(X, Y) { var g = bevGeom(); return { x: g.cx - Y * g.s, y: g.ey - X * g.s }; }

  /* ---------- drawing helpers ---------- */
  function polyCam(yOf, style, lw, alpha, dash) {
    ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.globalAlpha = alpha; if (dash) { ctx.setLineDash(dash); }
    ctx.beginPath(); var started = false, X;
    for (X = XNEAR; X <= XMAX; X += 1.5) { var p = cam(X, yOf(X), 0); if (!p) { continue; } if (!started) { ctx.moveTo(p.x, p.y); started = true; } else { ctx.lineTo(p.x, p.y); } }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  function polyBev(yOf, style, lw, alpha, dash) {
    ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.globalAlpha = alpha; if (dash) { ctx.setLineDash(dash); }
    ctx.beginPath(); var X;
    for (X = 0; X <= XMAX; X += 1.5) { var p = bev(X, yOf(X)); if (X === 0) { ctx.moveTo(p.x, p.y); } else { ctx.lineTo(p.x, p.y); } }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  function lat(c, off) { return function (X) { return latC(c, X) + off; }; }

  function draw() {
    var muted = (getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()) || '#9aa4b2';
    var SP = split(), cg = camGeom(), bg = bevGeom();
    var g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#0a0d15'); g.addColorStop(1, '#0f131c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);

    /* ===== FORWARD CAMERA PANEL (left) ===== */
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, SP, Hh); ctx.clip();
    /* sky / ground split at horizon */
    ctx.fillStyle = 'rgba(120,150,200,0.05)'; ctx.fillRect(0, 0, SP, cg.cy);
    ctx.fillStyle = 'rgba(255,255,255,0.018)'; ctx.fillRect(0, cg.cy, SP, Hh - cg.cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, cg.cy); ctx.lineTo(SP, cg.cy); ctx.stroke();
    /* road surface fill between true boundaries */
    (function () {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.beginPath(); var X, started = false;
      for (X = XNEAR; X <= XMAX; X += 2) { var p = cam(X, latC(cT, X) + LANEW / 2, 0); if (!p) { continue; } if (!started) { ctx.moveTo(p.x, p.y); started = true; } else { ctx.lineTo(p.x, p.y); } }
      for (X = XMAX; X >= XNEAR; X -= 2) { var q = cam(X, latC(cT, X) - LANEW / 2, 0); if (q) { ctx.lineTo(q.x, q.y); } }
      ctx.closePath(); ctx.fill();
    })();
    drawScene('cam', muted, cg, bg);
    ctx.restore();

    /* ===== BIRD'S-EYE PANEL (right) ===== */
    ctx.save(); ctx.beginPath(); ctx.rect(SP, 0, W - SP, Hh); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SP + 0.5, 0); ctx.lineTo(SP + 0.5, Hh); ctx.stroke();
    /* BEV range rings */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; var rr; for (rr = 20; rr <= 60; rr += 20) { var yy = bev(rr, 0).y; ctx.beginPath(); ctx.moveTo(SP + 6, yy); ctx.lineTo(W - 6, yy); ctx.stroke(); ctx.fillStyle = 'rgba(210,216,228,0.3)'; ctx.font = '600 8px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(rr + 'm', SP + 8, yy - 3); }
    drawScene('bev', muted, cg, bg);
    /* ego truck glyph */
    var e = bev(0, 0); ctx.fillStyle = 'rgba(235,240,250,0.95)'; ctx.fillRect(e.x - 5, e.y - 8, 10, 12);
    ctx.restore();

    /* labels + HUD */
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(210,216,228,0.6)'; ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('forward camera', 12, Hh - 12);
    ctx.textAlign = 'right'; ctx.fillText("bird's-eye", W - 12, Hh - 12);
    ctx.textAlign = 'left';
    drawHUD();
  }

  function drawScene(viewName, muted, cg, bg) {
    var isCam = viewName === 'cam', i;
    function P(X, Y, Z) { return isCam ? cam(X, Y, Z) : bev(X, Y); }

    if (mode === 'lane') {
      /* true boundaries (near-white, faint) */
      polyDual(isCam, lat(cT, LANEW / 2), 'rgba(228,233,243,0.5)', 1.2, 0.6);
      polyDual(isCam, lat(cT, -LANEW / 2), 'rgba(228,233,243,0.5)', 1.2, 0.6);
      /* raw detections (grey dots) */
      ctx.fillStyle = muted; ctx.globalAlpha = 0.6;
      for (i = 0; i < detsL.length; i++) { var p = P(detsL[i].X, detsL[i].y, 0); if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, isCam ? 1.6 : 1.8, 0, 6.2832); ctx.fill(); } }
      ctx.globalAlpha = 1;
      /* occluding vehicle hides the markings during an occlusion event (drawn under the
         estimate, so the mahogany lane visibly coasts through it) */
      if (occl > 0) {
        var ox = 26, oy = latC(cT, ox);
        if (isCam) {
          var bl = cam(ox, oy + 1.4, 0), br = cam(ox, oy - 1.4, 0), tl = cam(ox, oy + 1.4, 3.4), tr = cam(ox, oy - 1.4, 3.4);
          if (bl && br && tl && tr) { ctx.fillStyle = 'rgba(16,20,28,0.97)'; ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(180,188,202,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
        } else {
          var sB = bevGeom().s, ab = bev(ox + 3.5, oy + 1.4); ctx.fillStyle = 'rgba(16,20,28,0.97)'; ctx.fillRect(ab.x, ab.y, 2.8 * sB, 7 * sB); ctx.strokeStyle = 'rgba(180,188,202,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(ab.x, ab.y, 2.8 * sB, 7 * sB);
        }
      }
      /* 1-sigma lateral ribbon from KF cov */
      drawRibbon(isCam);
      /* tracked lane (mahogany, from KF) */
      polyDual(isCam, lat(ck, LANEW / 2), accent, 2.2, 0.95);
      polyDual(isCam, lat(ck, -LANEW / 2), accent, 2.2, 0.95);
    } else {
      /* 3-lane backdrop (quiet) drawn from the true road geometry */
      [1.5, 0.5, -0.5, -1.5].forEach(function (m) { polyDual(isCam, lat(cT, m * LANEW), 'rgba(170,178,194,0.22)', 1, 0.85); });
      for (i = 0; i < objs.length; i++) {
        var o = objs[i];
        /* raw detections */
        if (o.zr) { drawDet(isCam, o.zr[0], o.zr[1], 'radar', muted); }
        if (o.zc) { drawDet(isCam, o.zc[0], o.zc[1], 'cam', muted); }
        /* true vehicle box (near-white) — follows its lane on the curve */
        drawBox(isCam, o.tx, o.ty, 'rgba(228,233,243,0.5)', 1, false);
        /* fused track box + ellipse + velocity (mahogany) */
        drawBox(isCam, o.kx[0], o.kx[2], accent, 1.8, true);
        if (!isCam) {
          drawTrackEllipse(o);
          /* over-the-ground velocity vector: directed ALONG the lane (tangent to the road
             geometry) at ground speed, plus a cross component only while cutting in */
          var TLA = 0.4, X = o.kx[0];
          var slope = cT[1] + cT[2] * X + cT[3] / 2 * X * X;          // dlat/dX = lane tangent at the track
          var vgx = o.kx[1] + VEGO;                                    // over-ground forward speed
          var vgy = vgx * slope + (o.cutin ? (0 - o.laneOff) * 0.05 / DT : 0);
          var a = bev(o.kx[0], o.kx[2]), b = bev(o.kx[0] + vgx * TLA, o.kx[2] + vgy * TLA);
          ctx.strokeStyle = accent; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          var ang = Math.atan2(b.y - a.y, b.x - a.x);
          ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 5 * Math.cos(ang - 0.42), b.y - 5 * Math.sin(ang - 0.42)); ctx.lineTo(b.x - 5 * Math.cos(ang + 0.42), b.y - 5 * Math.sin(ang + 0.42)); ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  function polyDual(isCam, yOf, style, lw, alpha) { if (isCam) { polyCam(yOf, style, lw, alpha); } else { polyBev(yOf, style, lw, alpha); } }

  function drawRibbon(isCam) {
    /* lateral 1-sigma at each X from H P H^T, drawn as a translucent band around the lane center */
    ctx.fillStyle = accent; ctx.globalAlpha = 0.12; ctx.beginPath();
    var X, pts = [], first = true;
    for (X = XNEAR; X <= XMAX; X += 2) { var Hh2 = Hrow(X), PH = mvec(Pk, Hh2), s = Math.sqrt(Math.max(Hh2[0] * PH[0] + Hh2[1] * PH[1] + Hh2[2] * PH[2] + Hh2[3] * PH[3], 0)); var yc = latC(ck, X); var p = isCam ? cam(X, yc + s, 0) : bev(X, yc + s); if (p) { pts.push(p); if (first) { ctx.moveTo(p.x, p.y); first = false; } else { ctx.lineTo(p.x, p.y); } } }
    for (X = XMAX; X >= XNEAR; X -= 2) { var Hh3 = Hrow(X), PH2 = mvec(Pk, Hh3), s2 = Math.sqrt(Math.max(Hh3[0] * PH2[0] + Hh3[1] * PH2[1] + Hh3[2] * PH2[2] + Hh3[3] * PH2[3], 0)); var yc2 = latC(ck, X); var q = isCam ? cam(X, yc2 - s2, 0) : bev(X, yc2 - s2); if (q) { ctx.lineTo(q.x, q.y); } }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }

  function drawDet(isCam, X, Y, kind, muted) {
    var p = isCam ? cam(X, Y, 0.6) : bev(X, Y); if (!p) { return; }
    ctx.globalAlpha = 0.7;
    if (kind === 'radar') { ctx.fillStyle = 'rgba(120,170,210,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.2832); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(210,200,120,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(p.x - 2.6, p.y); ctx.lineTo(p.x + 2.6, p.y); ctx.moveTo(p.x, p.y - 2.6); ctx.lineTo(p.x, p.y + 2.6); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawBox(isCam, X, Y, style, lw, fill) {
    var hw = 0.9, ln = 2.2, ht = 1.5;
    if (isCam) {
      var bl = cam(X, Y + hw, 0), br = cam(X, Y - hw, 0), tl = cam(X, Y + hw, ht), tr = cam(X, Y - hw, ht);
      if (!bl || !br || !tl || !tr) { return; }
      ctx.strokeStyle = style; ctx.lineWidth = lw; if (fill) { ctx.fillStyle = style; ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y); ctx.closePath(); ctx.stroke();
    } else {
      var a = bev(X + ln / 2, Y + hw), s = bevGeom().s;
      ctx.strokeStyle = style; ctx.lineWidth = lw; if (fill) { ctx.fillStyle = style; ctx.globalAlpha = 0.14; ctx.fillRect(a.x, a.y, hw * 2 * s, ln * s); ctx.globalAlpha = 1; }
      ctx.strokeRect(a.x, a.y, hw * 2 * s, ln * s);
    }
  }
  function drawTrackEllipse(o) {
    /* map the [X=range, Y=lateral] state covariance into BEV SCREEN axes:
       horizontal(u) = lateral (Y), vertical(v) = range (X, sign-flipped by bev's y). */
    var s = bevGeom().s;
    var Suu = o.P[2][2] * s * s;        // lateral  -> horizontal
    var Svv = o.P[0][0] * s * s;        // range    -> vertical
    var Suv = o.P[0][2] * s * s;        // cross-term: both u(-Y) and v(-X) flip, so signs cancel
    var tr = Suu + Svv, dt = Suu * Svv - Suv * Suv, disc = Math.sqrt(Math.max(tr * tr / 4 - dt, 0));
    var l1 = Math.max(tr / 2 + disc, 0), l2 = Math.max(tr / 2 - disc, 0), ang = 0.5 * Math.atan2(2 * Suv, Suu - Svv);
    var ctr = bev(o.kx[0], o.kx[2]);
    ctx.save(); ctx.translate(ctr.x, ctr.y); ctx.rotate(ang); ctx.strokeStyle = accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, Math.sqrt(l1), Math.sqrt(l2), 0, 0, 6.2832); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
  }

  /* HUD: stat readouts only (no redundant title line) */
  function drawHUD() {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = '600 9px Inter, system-ui, sans-serif';
    var bx = 12, y = 16;
    if (mode === 'lane') {
      ctx.fillStyle = 'rgba(210,216,228,0.7)';
      ctx.fillText('offset ' + ck[0].toFixed(2) + ' m   heading ' + (ck[1] * 57.3).toFixed(1) + '°', bx, y);
      ctx.fillText('curvature ' + ck[2].toFixed(4) + ' /m', bx, y + 14);
    } else {
      ctx.fillStyle = 'rgba(120,170,210,0.9)'; ctx.fillText(dropRadar ? 'radar: OFF' : 'radar ●', bx, y);
      ctx.fillStyle = 'rgba(210,200,120,0.95)'; ctx.fillText(dropCam ? 'camera: OFF' : 'camera ✛', bx, y + 14);
      ctx.fillStyle = accent; ctx.fillText('fused track ▭', bx, y + 28);
    }
  }

  /* ---------- controls ---------- */
  function setButtons() {
    if (!btnWrap) { return; }
    btnWrap.innerHTML = '';
    function mk(label, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'lane-btn'; b.textContent = label; b.addEventListener('click', fn); btnWrap.appendChild(b); return b; }
    if (mode === 'lane') {
      mk('occlusion', function () { occl = 42; });
    } else {
      mk('cut-in', function () { var o = objs[2]; if (o) { o.Y = -LANEW; o.cutin = true; } });
      var br = mk('drop radar', function () { dropRadar = !dropRadar; br.classList.toggle('lane-btn--off', dropRadar); });
      var bc = mk('drop camera', function () { dropCam = !dropCam; bc.classList.toggle('lane-btn--off', dropCam); });
    }
  }

  /* ---------- loop ---------- */
  var running = false, visible = true, acc = 0, last = 0;
  function step() { if (mode === 'lane') { stepLane(); } else { stepObject(); } }
  function loop(now) { if (!running) { return; } var d = last ? (now - last) : 16; last = now; acc += d; while (acc > 75) { if (visible) { step(); } acc -= 75; } if (visible) { draw(); } requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; last = 0; requestAnimationFrame(loop); } }
  function stop() { running = false; }

  function init() { cT = [0, 0, 0.001, 0]; ck = [0, 0, 0, 0]; Pk = eye(4, 4); laneOffset = 0; laneTarget = 0; makeObjs(); var i; for (i = 0; i < 30; i++) { step(); } }

  readAccent(); resize(); init(); setButtons(); draw();

  var radios = document.querySelectorAll('input[name="lane-mode"]');
  Array.prototype.forEach.call(radios, function (r) { r.addEventListener('change', function () { if (r.checked) { mode = r.value; if (mode === 'lane') { ck = cT.slice(); Pk = eye(4, 4); } else { makeObjs(); } setButtons(); } }); });

  if (reduce) { /* static frame */ }
  else if ('IntersectionObserver' in window) { new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) { start(); } else { stop(); } }, { threshold: 0.01 }).observe(canvas); }
  else { start(); }

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(); }, 150); });
  new MutationObserver(function () { readAccent(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
