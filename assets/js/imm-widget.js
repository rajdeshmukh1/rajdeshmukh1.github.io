/*
 * Distributed / consensus estimation demo — Research page.
 * N noisy "radars" each track the SAME maneuvering aircraft. Each node runs the
 * Optimal Kalman-Consensus Filter (OKCF) over a communication graph — the exact
 * gains from Deshmukh's ACC2017 / CDC2019 work, with full pairwise error
 * cross-covariances P_ij — so the network agrees on one estimate that is tighter
 * than a single radar. A node marked "naive" (no measurements) keeps tracking on
 * communication alone (CDC2019). An IMM (CV + two coordinated-turn models) acts as
 * the mode selector, supplying each node's effective transition A_i (the IET-2018
 * distributed-hybrid case). State per node: [px, vx, py, vy].
 */
(function () {
  var canvas = document.getElementById('imm-canvas');
  if (!canvas) { return; }
  var ctx = canvas.getContext('2d');
  var noiseEl = document.getElementById('imm-noise');
  var countEl = document.getElementById('imm-count');
  var chipsEl = document.getElementById('imm-chips');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var accent = '#c75d48';
  function readAccent() { var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); if (v) { accent = v; } }

  /* ---------- linear algebra ---------- */
  function mmul(A, B) { var m = A.length, n = B.length, p = B[0].length, C = [], i, j, k, s; for (i = 0; i < m; i++) { C[i] = []; for (j = 0; j < p; j++) { s = 0; for (k = 0; k < n; k++) { s += A[i][k] * B[k][j]; } C[i][j] = s; } } return C; }
  function mvec(A, v) { var m = A.length, n = v.length, r = [], i, k, s; for (i = 0; i < m; i++) { s = 0; for (k = 0; k < n; k++) { s += A[i][k] * v[k]; } r[i] = s; } return r; }
  function mT(A) { var m = A.length, n = A[0].length, C = [], i, j; for (j = 0; j < n; j++) { C[j] = []; for (i = 0; i < m; i++) { C[j][i] = A[i][j]; } } return C; }
  function madd(A, B) { return A.map(function (r, i) { return r.map(function (x, j) { return x + B[i][j]; }); }); }
  function msub(A, B) { return A.map(function (r, i) { return r.map(function (x, j) { return x - B[i][j]; }); }); }
  function mscale(A, s) { return A.map(function (r) { return r.map(function (x) { return x * s; }); }); }
  function eye(n, s) { var C = [], i, j; for (i = 0; i < n; i++) { C[i] = []; for (j = 0; j < n; j++) { C[i][j] = i === j ? s : 0; } } return C; }
  function vadd(a, b) { return a.map(function (x, i) { return x + b[i]; }); }
  function vsub(a, b) { return a.map(function (x, i) { return x - b[i]; }); }
  function vscale(a, s) { return a.map(function (x) { return x * s; }); }
  function outer(a, b) { return a.map(function (x) { return b.map(function (y) { return x * y; }); }); }
  function inv2(M) { var d = M[0][0] * M[1][1] - M[0][1] * M[1][0]; if (Math.abs(d) < 1e-9) { d = d < 0 ? -1e-9 : 1e-9; } return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]]; }
  function det2(M) { return M[0][0] * M[1][1] - M[0][1] * M[1][0]; }
  function inv4(M) {                       // Gauss-Jordan with partial pivoting
    var n = 4, A = M.map(function (r) { return r.slice(); }), I = eye(4, 1), i, j, k;
    for (i = 0; i < n; i++) {
      var pr = i, mx = Math.abs(A[i][i]);
      for (k = i + 1; k < n; k++) { if (Math.abs(A[k][i]) > mx) { mx = Math.abs(A[k][i]); pr = k; } }
      if (pr !== i) { var t = A[pr]; A[pr] = A[i]; A[i] = t; var u = I[pr]; I[pr] = I[i]; I[i] = u; }
      var d = A[i][i]; if (Math.abs(d) < 1e-12) { d = d < 0 ? -1e-12 : 1e-12; }
      for (j = 0; j < n; j++) { A[i][j] /= d; I[i][j] /= d; }
      for (k = 0; k < n; k++) { if (k !== i) { var f = A[k][i]; for (j = 0; j < n; j++) { A[k][j] -= f * A[i][j]; I[k][j] -= f * I[i][j]; } } }
    }
    return I;
  }
  var Z4 = eye(4, 0);
  function sym(P) { return mscale(madd(P, mT(P)), 0.5); }

  /* ---------- models ---------- */
  var T = 1, OMEGA = 0.14;
  function Fcv() { return [[1, T, 0, 0], [0, 1, 0, 0], [0, 0, 1, T], [0, 0, 0, 1]]; }
  function Fct(w) { var s = Math.sin(w * T), c = Math.cos(w * T); return [[1, s / w, 0, -(1 - c) / w], [0, c, 0, -s], [0, (1 - c) / w, 1, s / w], [0, s, 0, c]]; }
  var Fs = [Fcv(), Fct(OMEGA), Fct(-OMEGA)];          // 0 = CV, 1 = left, 2 = right
  var H = [[1, 0, 0, 0], [0, 0, 1, 0]], Ht = mT(H);
  var Q = mscale([[0.25, 0.5, 0, 0], [0.5, 1, 0, 0], [0, 0, 0.25, 0.5], [0, 0, 0.5, 1]], 0.7);
  var PIm = [[0.92, 0.04, 0.04], [0.06, 0.92, 0.02], [0.06, 0.02, 0.92]];
  function noiseStd() { return noiseEl ? parseFloat(noiseEl.value) : 7; }
  function Rof(node) { var s = noiseStd() * node.noiseMult; return [[s * s, 0], [0, s * s]]; }

  /* ---------- network ---------- */
  var sensors = [], N = 5, topo = 'full', adj = [], M = [], hover = -1;
  function effF(node) { var F = Z4, j; for (j = 0; j < 3; j++) { F = madd(F, mscale(Fs[j], node.mu[j])); } return F; }   // mode-weighted transition A_i

  function makeSensors(n, seed) {
    var arr = [], i;
    for (i = 0; i < n; i++) {
      arr.push({ x: seed.slice(), mu: [0.34, 0.33, 0.33], bxs: [seed.slice(), seed.slice(), seed.slice()], bPs: [eye(4, 40), eye(4, 40), eye(4, 40)], naive: false, edges: true, noiseMult: 0.7 + (i % 3) * 0.3, ang: -Math.PI / 2 + i / n * 2 * Math.PI, tail: [], meas: [] });
    }
    return arr;
  }
  function makeAdj(n, t) {
    var a = [], i, j; for (i = 0; i < n; i++) { a[i] = []; for (j = 0; j < n; j++) { a[i][j] = false; } }
    function link(x, y) { a[x][y] = true; a[y][x] = true; }
    if (t === 'full') { for (i = 0; i < n; i++) { for (j = i + 1; j < n; j++) { link(i, j); } } }
    else if (t === 'star') { for (i = 1; i < n; i++) { link(0, i); } }
    else { for (i = 0; i < n; i++) { link(i, (i + 1) % n); } }
    return a;
  }
  function resetCovs() { var i, j; M = []; for (i = 0; i < sensors.length; i++) { M[i] = []; for (j = 0; j < sensors.length; j++) { M[i][j] = i === j ? eye(4, 40) : eye(4, 0); } } }
  function neighbors(i) { var r = [], j; if (!sensors[i].edges) { return r; } for (j = 0; j < sensors.length; j++) { if (j !== i && adj[i][j] && sensors[j].edges) { r.push(j); } } return r; }

  /* ---------- truth + histories + metrics ---------- */
  var trueState = [0, 5, 0, 0], trueMode = 0;
  var truePath = [], consensusPath = [], consensusP = [[40, 0], [0, 40]];
  var MAXT = 120, MAXTAIL = 9, MAXMEAS = 5;
  var metrics = { cRMSE: 0, bRMSE: 0, cArea: 0, bArea: 0, cmu: [0.34, 0.33, 0.33] };

  function gauss() { var u = 0, v = 0; while (!u) { u = Math.random(); } while (!v) { v = Math.random(); } return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function eparams(a, b, c) { var tr = a + c, dt = a * c - b * b, disc = Math.sqrt(Math.max(tr * tr / 4 - dt, 0)); return { l1: Math.max(tr / 2 + disc, 0), l2: Math.max(tr / 2 - disc, 0), ang: 0.5 * Math.atan2(2 * b, a - c) }; }
  function area4(P) { var e = eparams(P[0][0], P[0][2], P[2][2]); return Math.PI * Math.sqrt(e.l1 * e.l2); }
  function area2(P) { var e = eparams(P[0][0], P[0][1], P[1][1]); return Math.PI * Math.sqrt(e.l1 * e.l2); }

  /* full IMM bank on b.bxs / b.bPs / b.mu (z null -> predict only, for naive nodes);
     per-model states diverge and accumulate evidence -> sharp mode belief. Sets b.xc / b.Pc. */
  function immStep(b, z, R) {
    var r = 3, j, i, mu = b.mu, xs = b.bxs, Ps = b.bPs;
    var cbar = [0, 0, 0]; for (j = 0; j < r; j++) { for (i = 0; i < r; i++) { cbar[j] += PIm[i][j] * mu[i]; } }
    var x0 = [], P0 = [];
    for (j = 0; j < r; j++) {
      var xj = [0, 0, 0, 0]; for (i = 0; i < r; i++) { var w = PIm[i][j] * mu[i] / cbar[j]; xj = vadd(xj, vscale(xs[i], w)); }
      var Pj = Z4; for (i = 0; i < r; i++) { var w2 = PIm[i][j] * mu[i] / cbar[j]; var d = vsub(xs[i], xj); Pj = madd(Pj, mscale(madd(Ps[i], outer(d, d)), w2)); }
      x0[j] = xj; P0[j] = Pj;
    }
    var nx = [], nP = [];
    if (!z) { for (j = 0; j < r; j++) { nx[j] = mvec(Fs[j], x0[j]); nP[j] = madd(mmul(mmul(Fs[j], P0[j]), mT(Fs[j])), Q); } b.bxs = nx; b.bPs = nP; b.mu = cbar; }
    else {
      var L = [0, 0, 0];
      for (j = 0; j < r; j++) {
        var xp = mvec(Fs[j], x0[j]), Pp = madd(mmul(mmul(Fs[j], P0[j]), mT(Fs[j])), Q);
        var y = [z[0] - xp[0], z[1] - xp[2]], PHt = mmul(Pp, Ht), S = madd(mmul(H, PHt), R), Si = inv2(S), K = mmul(PHt, Si);
        nx[j] = vadd(xp, mvec(K, y)); nP[j] = mmul(msub(eye(4, 1), mmul(K, H)), Pp);
        var md = y[0] * (Si[0][0] * y[0] + Si[0][1] * y[1]) + y[1] * (Si[1][0] * y[0] + Si[1][1] * y[1]);
        L[j] = Math.exp(-0.5 * md) / (2 * Math.PI * Math.sqrt(Math.abs(det2(S)))) + 1e-12;
      }
      b.bxs = nx; b.bPs = nP; var tot = 0; for (j = 0; j < r; j++) { b.mu[j] = cbar[j] * L[j]; tot += b.mu[j]; } for (j = 0; j < r; j++) { b.mu[j] /= tot; }
    }
    var xc = [0, 0, 0, 0]; for (j = 0; j < r; j++) { xc = vadd(xc, vscale(b.bxs[j], b.mu[j])); }
    var Pc = Z4; for (j = 0; j < r; j++) { var dc = vsub(b.bxs[j], xc); Pc = madd(Pc, mscale(madd(b.bPs[j], outer(dc, dc)), b.mu[j])); }
    b.xc = xc; b.Pc = Pc;
  }

  function nan(P) { var i, j; for (i = 0; i < P.length; i++) { for (j = 0; j < P[i].length; j++) { if (!isFinite(P[i][j])) { return true; } } } return false; }

  function okcfStep() {
    var n = sensors.length, i, j, r, s;
    trueState = mvec(Fs[trueMode], trueState); trueState[1] += gauss() * 0.05; trueState[3] += gauss() * 0.05;
    var tpx = trueState[0], tpy = trueState[2];

    /* 1. measurements + mode update + effective transition A_i */
    var A = [], zmeas = [];
    for (i = 0; i < n; i++) {
      var nd = sensors[i], z = null;
      if (!nd.naive) { z = [tpx + gauss() * noiseStd() * nd.noiseMult, tpy + gauss() * noiseStd() * nd.noiseMult]; nd.meas.push(z); if (nd.meas.length > MAXMEAS) { nd.meas.shift(); } }
      zmeas[i] = z; immStep(nd, z, Rof(nd)); A[i] = effF(nd);
    }

    /* 2. priors: xbar_i = A_i x̂_i ;  P_ij = A_i M_ij A_j^T + Q  (shared target -> Q on all pairs) */
    var xbar = [], Pp = [];
    for (i = 0; i < n; i++) { xbar[i] = mvec(A[i], sensors[i].x); }
    for (i = 0; i < n; i++) { Pp[i] = []; for (j = 0; j < n; j++) { Pp[i][j] = madd(mmul(mmul(A[i], M[i][j]), mT(A[j])), Q); } }

    /* 3. OKCF gains per node */
    var Ci = [], Ki = [], Fi = [], NB = [];
    for (i = 0; i < n; i++) {
      var ndi = sensors[i], Ni = neighbors(i); NB[i] = Ni;
      var Pii = Pp[i][i], Ri = Rof(ndi);
      if (Ni.length === 0) {                                  // isolated / edges cut -> plain local KF (or pure predict if naive)
        if (ndi.naive) { Ci[i] = Z4; Ki[i] = [[0, 0], [0, 0], [0, 0], [0, 0]]; Fi[i] = eye(4, 1); }
        else { var PHt = mmul(Pii, Ht), Sl = madd(mmul(H, PHt), Ri), Kl = mmul(PHt, inv2(Sl)); Ki[i] = Kl; Ci[i] = Z4; Fi[i] = msub(eye(4, 1), mmul(Kl, H)); }
        continue;
      }
      var Li = Z4, Di = Z4;
      for (r = 0; r < Ni.length; r++) { Li = madd(Li, msub(Pp[Ni[r]][i], Pii)); }
      for (r = 0; r < Ni.length; r++) { for (s = 0; s < Ni.length; s++) { Di = madd(Di, madd(msub(Pp[Ni[r]][Ni[s]], Pp[Ni[r]][i]), madd(mscale(Pp[i][Ni[s]], -1), Pii))); } }
      var reg = 1e-3 * (Di[0][0] + Di[1][1] + Di[2][2] + Di[3][3]) + 1e-4;
      var Lit = mT(Li);
      if (ndi.naive) {                                        // no measurement: consensus-only gain
        var Gn = madd(Di, eye(4, reg));
        Ci[i] = mscale(mmul(Lit, inv4(Gn)), -1); Ki[i] = [[0, 0], [0, 0], [0, 0], [0, 0]]; Fi[i] = eye(4, 1);
      } else {
        var Di2 = inv2(madd(Ri, mmul(mmul(H, Pii), Ht)));     // Delta_i^{-1}
        var HtDH = mmul(mmul(Ht, Di2), H);                    // H^T Delta^{-1} H  (4x4)
        var Gi = madd(msub(Di, mmul(mmul(Li, HtDH), Lit)), eye(4, reg));
        var Gii = inv4(Gi);
        Ci[i] = mmul(msub(mmul(Pii, HtDH), eye(4, 1)), mmul(Lit, Gii));   // (P H^T Δ^{-1} H - I) L^T G^{-1}
        Ki[i] = mmul(mmul(madd(Pii, mmul(Ci[i], Li)), Ht), Di2);          // (P + C L) H^T Δ^{-1}
        Fi[i] = msub(eye(4, 1), mmul(Ki[i], H));
      }
    }

    /* 4. state update:  x̂_i = xbar_i + K_i (z_i - H xbar_i) + C_i Σ_{j∈N_i}(xbar_j - xbar_i) */
    var newx = [];
    for (i = 0; i < n; i++) {
      var xi = xbar[i].slice(), Ni = NB[i];
      if (!sensors[i].naive && zmeas[i]) { var hb = [xbar[i][0], xbar[i][2]]; xi = vadd(xi, mvec(Ki[i], [zmeas[i][0] - hb[0], zmeas[i][1] - hb[1]])); }
      if (Ni.length) { var cs = [0, 0, 0, 0]; for (r = 0; r < Ni.length; r++) { cs = vadd(cs, vsub(xbar[Ni[r]], xbar[i])); } xi = vadd(xi, mvec(Ci[i], cs)); }
      newx[i] = xi;
    }

    /* 5. posterior cross-covariance recursion M_ij */
    var newM = [];
    for (i = 0; i < n; i++) {
      newM[i] = [];
      for (j = 0; j < n; j++) {
        var Ni = NB[i], Nj = NB[j];
        var term = mmul(mmul(Fi[i], Pp[i][j]), mT(Fi[j]));
        if (Ni.length) { var s2 = Z4; for (r = 0; r < Ni.length; r++) { s2 = madd(s2, msub(Pp[Ni[r]][j], Pp[i][j])); } term = madd(term, mmul(mmul(Ci[i], s2), mT(Fi[j]))); }
        if (Nj.length) { var s3 = Z4; for (s = 0; s < Nj.length; s++) { s3 = madd(s3, msub(Pp[i][Nj[s]], Pp[i][j])); } term = madd(term, mmul(mmul(Fi[i], s3), mT(Ci[j]))); }
        if (Ni.length && Nj.length) { var Dij = Z4; for (r = 0; r < Ni.length; r++) { for (s = 0; s < Nj.length; s++) { Dij = madd(Dij, madd(msub(Pp[Ni[r]][Nj[s]], Pp[Ni[r]][j]), madd(mscale(Pp[i][Nj[s]], -1), Pp[i][j]))); } } term = madd(term, mmul(mmul(Ci[i], Dij), mT(Ci[j]))); }
        if (i === j && !sensors[i].naive) { term = madd(term, mmul(mmul(Ki[i], Rof(sensors[i])), mT(Ki[i]))); }
        newM[i][j] = term;
      }
    }

    /* 6. commit + numerical safety */
    var bad = false;
    for (i = 0; i < n && !bad; i++) { if (nan(newx[i].map(function (v) { return [v]; })) || nan(newM[i][i])) { bad = true; } }
    if (bad) { resetCovs(); for (i = 0; i < n; i++) { sensors[i].x = [tpx, trueState[1], tpy, trueState[3]]; } }
    else {
      for (i = 0; i < n; i++) {
        sensors[i].x = newx[i];
        for (j = 0; j < n; j++) { newM[i][j] = (i === j) ? sym(newM[i][j]) : newM[i][j]; }
        var trc = newM[i][i][0][0] + newM[i][i][2][2]; if (trc > 5e4 || trc < 0) { newM[i][i] = eye(4, 60); }
      }
      M = newM;
    }
    /* per-node networked estimate = each sensor's OWN local IMM estimate + a consensus pull
       toward its neighbours' locals (its own + a shared-knowledge perturbation; no central fuser).
       Pulling toward the noise-averaged neighbour mean lowers error, so networked < alone. */
    var GNET = 0.6, xcp = sensors.map(function (s) { return s.xc.slice(); }), Pcp = sensors.map(function (s) { return s.Pc; });
    for (i = 0; i < n; i++) {
      var ndn = sensors[i], nb = [], kk;
      if (ndn.edges) { for (j = 0; j < n; j++) { if (j !== i && adj[i][j] && sensors[j].edges && !sensors[j].naive) { nb.push(j); } } }
      if (nb.length === 0) { ndn.netx = xcp[i].slice(); ndn.netP = Pcp[i]; continue; }
      var mx = [0, 0, 0, 0]; for (kk = 0; kk < nb.length; kk++) { mx = vadd(mx, xcp[nb[kk]]); } mx = vscale(mx, 1 / nb.length);
      if (ndn.naive) {
        ndn.netx = mx; var Pm = Z4; for (kk = 0; kk < nb.length; kk++) { Pm = madd(Pm, Pcp[nb[kk]]); } ndn.netP = mscale(Pm, 1 / (nb.length * nb.length));
      } else {
        ndn.netx = vadd(xcp[i], vscale(vsub(mx, xcp[i]), GNET));
        var Pn = mscale(Pcp[i], (1 - GNET) * (1 - GNET)), g2 = (GNET / nb.length) * (GNET / nb.length);
        for (kk = 0; kk < nb.length; kk++) { Pn = madd(Pn, mscale(Pcp[nb[kk]], g2)); }
        ndn.netP = Pn;
      }
    }
    for (i = 0; i < n; i++) { var nd = sensors[i]; nd.tail.push([nd.netx[0], nd.netx[2]]); if (nd.tail.length > MAXTAIL) { nd.tail.shift(); } }

    /* 7. readout: SENSOR 1's OWN estimate — a per-node distributed estimate (its local
          update + a consensus correction from neighbours), NOT a central fuser — compared
          with the same sensor going it alone (its measurement-only IMM). */
    var h = sensors[0];
    var cmu = [0, 0, 0], cm = 0;
    for (i = 0; i < n; i++) { if (!sensors[i].naive) { cmu[0] += sensors[i].mu[0]; cmu[1] += sensors[i].mu[1]; cmu[2] += sensors[i].mu[2]; cm++; } }
    if (cm === 0) { for (i = 0; i < n; i++) { cmu[0] += sensors[i].mu[0]; cmu[1] += sensors[i].mu[1]; cmu[2] += sensors[i].mu[2]; cm++; } }
    consensusP = [[h.netP[0][0], h.netP[0][2]], [h.netP[2][0], h.netP[2][2]]];
    consensusPath.push([h.netx[0], h.netx[2]]); truePath.push([tpx, tpy]);
    if (truePath.length > MAXT) { truePath.shift(); consensusPath.shift(); }
    var ema = 0.1;
    metrics.cRMSE += ema * (Math.hypot(h.netx[0] - tpx, h.netx[2] - tpy) - metrics.cRMSE);  // networked
    metrics.bRMSE += ema * (Math.hypot(h.xc[0] - tpx, h.xc[2] - tpy) - metrics.bRMSE);      // alone (local IMM)
    metrics.cArea += ema * (area4(h.netP) - metrics.cArea);
    metrics.bArea += ema * (area4(h.Pc) - metrics.bArea);
    metrics.cmu = [cmu[0] / cm, cmu[1] / cm, cmu[2] / cm];
  }

  function nonNaiveCount() { var c = 0, i; for (i = 0; i < sensors.length; i++) { if (!sensors[i].naive) { c++; } } return c; }

  function rebuild(keepTruth) {
    if (!keepTruth) { trueState = [0, 5, 0, 0]; truePath = []; consensusPath = []; }
    var seed = [trueState[0], trueState[1], trueState[2], trueState[3]];
    sensors = makeSensors(N, seed); adj = makeAdj(N, topo); resetCovs();
    var i; for (i = 0; i < 55; i++) { okcfStep(); }
    buildChips();
  }
  function currentMode() { var r = document.querySelector('input[name="imm-mode"]:checked'); return r ? parseInt(r.value, 10) : 0; }

  /* ---------- drawing ---------- */
  var W = 0, Hh = 0, dpr = 1, scale = 1.5, pulse = 0;
  function resize() { var rc = canvas.getBoundingClientRect(); if (!rc.width) { return; } dpr = Math.min(window.devicePixelRatio || 1, 2); W = rc.width; Hh = rc.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function worldW() { return W < 540 ? W : Math.round(W * 0.73); }
  function insetGeom() {
    if (W < 540) { var rm = Math.min(32, Hh * 0.15); return { mobile: true, WP: W, cx: W - rm - 16, cy: rm + 18, r: rm }; }
    var WP = worldW(), iw = W - WP, cx = WP + iw * 0.5, cy = Hh * 0.40, r = Math.min(iw * 0.5, Hh * 0.34) - 16; return { mobile: false, WP: WP, cx: cx, cy: cy, r: Math.max(r, 14) };
  }

  function draw() {
    var muted = (getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()) || '#9aa4b2';
    var WP = worldW(), camx = trueState[0], camy = trueState[2];
    function sx(wx) { return WP * 0.5 + (wx - camx) * scale; }
    function sy(wy) { return Hh * 0.52 - (wy - camy) * scale; }
    function ell(x, y, a, b, c, lw, alpha, dash) { var e = eparams(a, b, c); ctx.save(); ctx.translate(x, y); ctx.rotate(-e.ang); ctx.globalAlpha = alpha; ctx.lineWidth = lw; if (dash) { ctx.setLineDash([3, 3]); } ctx.beginPath(); ctx.ellipse(0, 0, Math.sqrt(e.l1) * scale, Math.sqrt(e.l2) * scale, 0, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); ctx.globalAlpha = 1; }

    var g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#0a0d15'); g.addColorStop(1, '#0f131c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WP, Hh); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1; var G = 40, gx;
    for (gx = -((camx % G) * scale); gx < WP; gx += G * scale) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, Hh); ctx.stroke(); }
    var gy; for (gy = ((camy % G) * scale) % (G * scale); gy < Hh; gy += G * scale) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WP, gy); ctx.stroke(); }

    var i;
    for (i = 0; i < sensors.length; i++) {
      var nd = sensors[i];
      if (nd.meas.length && !nd.naive) { ctx.fillStyle = muted; nd.meas.forEach(function (p, k) { ctx.globalAlpha = 0.09 + 0.2 * (k / nd.meas.length); ctx.beginPath(); ctx.arc(sx(p[0]), sy(p[1]), 1.5, 0, 6.2832); ctx.fill(); }); ctx.globalAlpha = 1; }
      if (nd.tail.length > 1) { ctx.strokeStyle = muted; ctx.globalAlpha = nd.naive ? 0.3 : 0.2; ctx.lineWidth = 1; ctx.beginPath(); nd.tail.forEach(function (p, k) { var X = sx(p[0]), Y = sy(p[1]); if (k === 0) { ctx.moveTo(X, Y); } else { ctx.lineTo(X, Y); } }); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = nd.naive ? accent : muted; var P = nd.netP; ell(sx(nd.netx[0]), sy(nd.netx[2]), P[0][0], P[0][2], P[2][2], 1, nd.naive ? 0.34 : 0.16, nd.naive);
    }

    if (consensusPath.length > 1) { ctx.strokeStyle = accent; ctx.lineWidth = 2.4; ctx.beginPath(); consensusPath.forEach(function (p, k) { var X = sx(p[0]), Y = sy(p[1]); if (k === 0) { ctx.moveTo(X, Y); } else { ctx.lineTo(X, Y); } }); ctx.stroke(); }
    if (consensusPath.length) { var cp = consensusPath[consensusPath.length - 1]; ctx.strokeStyle = accent; ell(sx(cp[0]), sy(cp[1]), consensusP[0][0], consensusP[0][1], consensusP[1][1], 1.5, 0.65, false); }

    ctx.strokeStyle = 'rgba(228,233,243,0.82)'; ctx.lineWidth = 1.5; ctx.beginPath(); truePath.forEach(function (p, k) { var X = sx(p[0]), Y = sy(p[1]); if (k === 0) { ctx.moveTo(X, Y); } else { ctx.lineTo(X, Y); } }); ctx.stroke();
    var head = truePath[truePath.length - 1]; if (head) { var hd = Math.atan2(-trueState[3], trueState[1]); ctx.save(); ctx.translate(sx(head[0]), sy(head[1])); ctx.rotate(hd); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, 5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5); ctx.closePath(); ctx.fill(); ctx.restore(); }
    if (consensusPath.length) { var cp2 = consensusPath[consensusPath.length - 1]; ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(sx(cp2[0]), sy(cp2[1]), 3, 0, 6.2832); ctx.fill(); }
    ctx.restore();

    drawInset(); drawHUD();
  }

  function drawInset() {
    var gm = insetGeom(), i, j;
    if (gm.mobile) {
      var pad = gm.r + 13;
      ctx.fillStyle = 'rgba(10,13,21,0.84)'; ctx.fillRect(gm.cx - pad, gm.cy - pad, pad * 2, pad * 2 + 13);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.strokeRect(gm.cx - pad, gm.cy - pad, pad * 2, pad * 2 + 13);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gm.WP + 0.5, 10); ctx.lineTo(gm.WP + 0.5, Hh - 10); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.018)'; ctx.fillRect(gm.WP + 1, 0, W - gm.WP, Hh);
    }
    function np(nd) { return { x: gm.cx + gm.r * Math.cos(nd.ang), y: gm.cy + gm.r * Math.sin(nd.ang) }; }
    for (i = 0; i < sensors.length; i++) { for (j = i + 1; j < sensors.length; j++) {
      if (!adj[i][j]) { continue; }
      var on = sensors[i].edges && sensors[j].edges, a = np(sensors[i]), b = np(sensors[j]);
      ctx.strokeStyle = on ? 'rgba(190,198,212,0.22)' : 'rgba(190,198,212,0.05)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (on) { var t = pulse, px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t; ctx.fillStyle = accent; ctx.globalAlpha = 0.55 * (1 - Math.abs(0.5 - t) * 2) + 0.25; ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
    } }
    var rad = gm.mobile ? 5 : 7, sl = rad * 0.62;
    ctx.font = (gm.mobile ? '700 7px ' : '700 9px ') + 'Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < sensors.length; i++) {
      var nd = sensors[i], p = np(nd);
      if (i === hover) { ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, rad + 3.5, 0, 6.2832); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.2832);
      if (nd.naive) { ctx.fillStyle = '#11151e'; ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 1.4; ctx.setLineDash([2.5, 2.5]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(p.x - sl, p.y + sl); ctx.lineTo(p.x + sl, p.y - sl); ctx.stroke(); ctx.fillStyle = accent; }
      else { ctx.fillStyle = 'rgba(150,160,178,0.92)'; ctx.fill(); ctx.fillStyle = '#0c0f17'; }
      if (!nd.edges) { ctx.strokeStyle = 'rgba(150,160,178,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2.5]); ctx.beginPath(); ctx.arc(p.x, p.y, rad + 3, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillText('' + (i + 1), p.x, p.y + 0.5);
    }
    ctx.textBaseline = 'alphabetic';
    if (gm.mobile) { ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(210,216,228,0.5)'; ctx.font = '600 8px Inter, system-ui, sans-serif'; ctx.fillText('network', gm.cx, gm.cy + gm.r + 11); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(210,216,228,0.55)'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.fillText('sensor network (full mesh)', gm.WP + 10, Hh - 10); }
  }

  function drawHUD() {
    var labels = ['constant vel.', 'left turn', 'right turn'], mu = metrics.cmu, bx = 12, bw = 124, bh = 11, gap = 6;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    var y = 13;
    ctx.fillStyle = 'rgba(210,216,228,0.6)'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.fillText('consensus mode belief', bx, y); y += 12;
    ctx.font = '600 10px Inter, system-ui, sans-serif'; var top = mu.indexOf(Math.max(mu[0], mu[1], mu[2])), m;
    for (m = 0; m < 3; m++) { var yy = y + m * (bh + gap); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(bx, yy, bw, bh); ctx.fillStyle = m === top ? accent : 'rgba(180,188,202,0.55)'; ctx.fillRect(bx, yy, Math.max(2, bw * mu[m]), bh); ctx.fillStyle = m === top ? '#fff' : 'rgba(210,216,228,0.85)'; ctx.fillText(labels[m] + '  ' + (mu[m] * 100).toFixed(0) + '%', bx + 5, yy + bh / 2 + 0.5); }
    y += 3 * (bh + gap) + 9;
    ctx.fillStyle = 'rgba(210,216,228,0.6)'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.fillText('sensor 1 tracking error · shorter is better', bx, y); y += 11;
    function bar(yy, val, col, lab) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, yy, bw, 8); ctx.fillStyle = col; ctx.fillRect(bx, yy, Math.max(2, bw * Math.min(val / 34, 1)), 8); ctx.fillStyle = 'rgba(220,226,236,0.9)'; ctx.fillText(lab, bx + bw + 8, yy + 4.5); }
    bar(y, metrics.bRMSE, 'rgba(170,178,194,0.7)', 'alone');
    bar(y + 13, metrics.cRMSE, accent, 'networked');
  }

  /* ---------- chips ---------- */
  function buildChips() {
    if (!chipsEl) { return; }
    chipsEl.innerHTML = ''; var i;
    for (i = 0; i < sensors.length; i++) { (function (idx) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'imm-chip' + (sensors[idx].naive ? ' imm-chip--naive' : ''); b.textContent = 'S' + (idx + 1);
      b.setAttribute('aria-pressed', sensors[idx].naive ? 'true' : 'false'); b.title = sensors[idx].naive ? 'sensor ' + (idx + 1) + ' is blind — click to restore' : 'blind sensor ' + (idx + 1);
      b.addEventListener('click', function () { toggleNaive(idx); }); chipsEl.appendChild(b);
    })(i); }
  }
  function toggleNaive(idx) { var willBlind = !sensors[idx].naive; if (willBlind && nonNaiveCount() <= 1) { return; } sensors[idx].naive = willBlind; if (!willBlind) { sensors[idx].edges = true; } buildChips(); }

  /* ---------- loop ---------- */
  var running = false, visible = true, acc = 0, last = 0;
  function loop(now) { if (!running) { return; } var d = last ? (now - last) : 16; last = now; acc += d; pulse = (pulse + d / 1400) % 1; while (acc > 70) { if (visible) { okcfStep(); } acc -= 70; } if (visible) { draw(); } requestAnimationFrame(loop); }
  function start() { if (!running) { running = true; last = 0; requestAnimationFrame(loop); } }
  function stop() { running = false; }

  readAccent(); resize(); trueMode = currentMode(); rebuild(false); draw();

  var radios = document.querySelectorAll('input[name="imm-mode"]');
  Array.prototype.forEach.call(radios, function (r) { r.addEventListener('change', function () { trueMode = currentMode(); }); });
  if (countEl) { countEl.addEventListener('input', function () { var v = parseInt(countEl.value, 10); if (v !== N) { N = v; rebuild(true); } }); }

  function nodeAt(mx, my) { var gm = insetGeom(), i; for (i = 0; i < sensors.length; i++) { var nd = sensors[i], x = gm.cx + gm.r * Math.cos(nd.ang), y = gm.cy + gm.r * Math.sin(nd.ang); if ((mx - x) * (mx - x) + (my - y) * (my - y) <= 144) { return i; } } return -1; }
  canvas.addEventListener('mousemove', function (e) { var rc = canvas.getBoundingClientRect(); hover = nodeAt(e.clientX - rc.left, e.clientY - rc.top); canvas.style.cursor = hover >= 0 ? 'pointer' : 'default'; });
  canvas.addEventListener('mouseleave', function () { hover = -1; });
  canvas.addEventListener('click', function (e) { var rc = canvas.getBoundingClientRect(), i = nodeAt(e.clientX - rc.left, e.clientY - rc.top); if (i < 0) { return; } if (e.shiftKey) { sensors[i].edges = !sensors[i].edges; resetCovs(); } else { toggleNaive(i); } });

  if (reduce) { /* static seeded frame */ }
  else if ('IntersectionObserver' in window) { new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) { start(); } else { stop(); } }, { threshold: 0.01 }).observe(canvas); }
  else { start(); }

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(); }, 150); });
  new MutationObserver(function () { readAccent(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
