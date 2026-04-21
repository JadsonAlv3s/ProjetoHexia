(function () {
  const canvas = document.getElementById('hex3d');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ── Constantes fixas ───────────────────────────────── */
  const PHI       = 1.6180339887;
  const GOLD      = [201, 168, 76];
  const TILT_X    = 0.36;
  const ROT_SPD   = 0.007;
  const T_BUILD   = 3200;
  const T_HOLD    = 1400;
  const T_DISSOLVE= 2400;
  const T_TOTAL   = T_BUILD + T_HOLD + T_DISSOLVE;

  /* ── Tamanho responsivo ─────────────────────────────── */
  let SIZE, SCALE, H, R_OUT, R_MID, R_IN, FOV, CAM_Z;

  function calcSize() {
    const container = canvas.parentElement;
    const maxW = container ? container.clientWidth : window.innerWidth;
    SIZE  = Math.min(480, maxW, window.innerHeight * 0.7);
    SIZE  = Math.max(220, SIZE);              // mínimo 220px
    SCALE = SIZE / 480;
    H     = Math.round(130 * SCALE);
    R_OUT = Math.round(155 * SCALE);
    R_MID = Math.round(100 * SCALE);
    R_IN  = Math.round(46  * SCALE);
    FOV   = 320 * SCALE;
    CAM_Z = 480 * SCALE;
    canvas.width  = SIZE;
    canvas.height = SIZE;
  }

  calcSize();

  let rotY      = 0;
  let startTime = null;
  let paused    = false;

  /* Pausa quando aba está inativa */
  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
    if (!paused) { startTime = null; requestAnimationFrame(draw); }
  });

  /* Redimensiona ao girar / redimensionar tela */
  window.addEventListener('resize', function () {
    calcSize();
    startTime = null;
  });

  /* ── Motor 3D ───────────────────────────────────────── */
  const cos = Math.cos, sin = Math.sin, PI = Math.PI;

  function tr(p) {
    let x  =  p.x * cos(rotY) + p.z * sin(rotY);
    let z0 = -p.x * sin(rotY) + p.z * cos(rotY);
    let y  =  p.y * cos(TILT_X) - z0 * sin(TILT_X);
    let z  =  p.y * sin(TILT_X) + z0 * cos(TILT_X);
    const s = FOV / (CAM_Z + z);
    return { x: SIZE / 2 + x * s, y: SIZE / 2 + y * s };
  }

  function hexRing(r, y, phase) {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (PI / 3) * i + (phase || 0);
      return { x: cos(a) * r, y, z: sin(a) * r };
    });
  }

  /* ── Thresholds Fibonacci ───────────────────────────── */
  const ELEM = {
    center:    0.00, innerRing: 0.10, innerVert: 0.20,
    midRing:   0.32, midVert:   0.44, radii:     0.54,
    connIM:    0.64, outerRing: 0.74, outerVert: 0.84, connOI: 0.92,
  };

  function easeIn(t)  { return t * t; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  function alpha(thresh, prog) {
    const buildEnd      = T_BUILD / T_TOTAL;
    const dissolveStart = (T_BUILD + T_HOLD) / T_TOTAL;
    if (prog <= buildEnd) {
      const t = prog / buildEnd;
      if (t < thresh) return 0;
      return easeOut(Math.min(1, (t - thresh) / 0.08));
    }
    if (prog <= dissolveStart) return 1;
    const t = (prog - dissolveStart) / (1 - dissolveStart);
    const rev = 1 - thresh;
    if (t < rev) return 1;
    return easeIn(Math.max(0, 1 - (t - rev) / 0.08));
  }

  /* ── Primitivas de desenho ──────────────────────────── */
  function rgba(a)       { return `rgba(${GOLD},${a})`; }
  const GLOW_COLOR = `rgba(${GOLD},0.5)`;

  function line(a, b, baseAlpha, width, prog, thresh, glow) {
    const al = baseAlpha * alpha(thresh, prog);
    if (al < 0.01) return;
    const pa = tr(a), pb = tr(b);
    ctx.shadowBlur  = glow ? 12 * SCALE : 0;
    ctx.shadowColor = GLOW_COLOR;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = rgba(al);
    ctx.lineWidth   = width * SCALE;
    ctx.stroke();
  }

  function dot(p, baseAlpha, r, prog, thresh) {
    const al = baseAlpha * alpha(thresh, prog);
    if (al < 0.01) return;
    const pp = tr(p);
    ctx.shadowBlur  = 22 * SCALE;
    ctx.shadowColor = `rgba(${GOLD},0.6)`;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, r * SCALE, 0, PI * 2);
    ctx.fillStyle = rgba(al);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ── Teia de aranha ────────────────────────────────── */
  function drawWeb(prog) {
    const SPOKES = 12;
    const RINGS  = 9;
    const maxR   = SIZE * 0.49;
    const cx     = SIZE / 2;
    const cy     = SIZE / 2;
    const webRot = rotY * 0.4; /* gira mais devagar que o hexágono central */

    ctx.shadowBlur  = 5 * SCALE;
    ctx.shadowColor = GLOW_COLOR;

    /* Raios — aparecem primeiro */
    const spokeAl = 0.14 * alpha(0.0, prog);
    if (spokeAl > 0.01) {
      ctx.strokeStyle = rgba(spokeAl);
      ctx.lineWidth   = 0.55 * SCALE;
      for (let i = 0; i < SPOKES; i++) {
        const angle = (PI * 2 / SPOKES) * i + webRot;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + cos(angle) * maxR, cy + sin(angle) * maxR * 0.72);
        ctx.stroke();
      }
    }

    /* Anéis — expandem do centro para fora, um a um */
    for (let r = 0; r < RINGS; r++) {
      const thresh  = 0.08 + (r / RINGS) * 0.84;
      const outerAl = r === RINGS - 1 ? 0.22 : 0.13;
      const al      = outerAl * alpha(thresh, prog);
      if (al < 0.01) continue;

      const radius = ((r + 1) / RINGS) * maxR;
      ctx.strokeStyle = rgba(al);
      ctx.lineWidth   = (r === RINGS - 1 ? 0.75 : 0.5) * SCALE;
      ctx.beginPath();
      for (let i = 0; i <= SPOKES; i++) {
        const angle = (PI * 2 / SPOKES) * i + webRot;
        const px = cx + cos(angle) * radius;
        const py = cy + sin(angle) * radius * 0.72;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      /* Nós nos vértices do anel externo */
      if (r === RINGS - 1) {
        const nodeAl = 0.5 * alpha(thresh, prog);
        ctx.fillStyle   = rgba(nodeAl);
        ctx.shadowBlur  = 8 * SCALE;
        for (let i = 0; i < SPOKES; i++) {
          const angle = (PI * 2 / SPOKES) * i + webRot;
          ctx.beginPath();
          ctx.arc(
            cx + cos(angle) * radius,
            cy + sin(angle) * radius * 0.72,
            1.4 * SCALE, 0, PI * 2
          );
          ctx.fill();
        }
      }
    }

    ctx.shadowBlur = 0;
  }

  /* ── Loop principal ─────────────────────────────────── */
  function draw(ts) {
    if (paused) return;
    if (!startTime) startTime = ts;
    const prog = ((ts - startTime) % T_TOTAL) / T_TOTAL;

    ctx.clearRect(0, 0, SIZE, SIZE);

    const toOut = hexRing(R_OUT, -H/2);
    const boOut = hexRing(R_OUT,  H/2);
    const toMid = hexRing(R_MID, -H/2, PI/6);
    const boMid = hexRing(R_MID,  H/2, PI/6);
    const toIn  = hexRing(R_IN,  -H/2);
    const boIn  = hexRing(R_IN,   H/2);
    const cT    = {x:0, y:-H/2, z:0};
    const cB    = {x:0, y: H/2, z:0};

    drawWeb(prog);

    for (let i = 0; i < 6; i++) {
      const n = (i+1)%6;
      line(toOut[i], toOut[n], 0.55, 0.85, prog, ELEM.outerRing);
      line(boOut[i], boOut[n], 0.55, 0.85, prog, ELEM.outerRing);
      line(toOut[i], boOut[i], 0.28, 0.70, prog, ELEM.outerVert);
    }
    for (let i = 0; i < 6; i++) {
      const n = (i+1)%6;
      line(toMid[i], toMid[n], 0.95, 1.2, prog, ELEM.midRing, true);
      line(boMid[i], boMid[n], 0.95, 1.2, prog, ELEM.midRing, true);
      line(toMid[i], boMid[i], 0.42, 0.7, prog, ELEM.midVert);
    }
    for (let i = 0; i < 6; i++) {
      const n = (i+1)%6;
      line(toIn[i], toIn[n], 0.70, 1.0, prog, ELEM.innerRing, true);
      line(boIn[i], boIn[n], 0.70, 1.0, prog, ELEM.innerRing, true);
      line(toIn[i], boIn[i], 0.30, 0.65,prog, ELEM.innerVert);
    }
    for (let i = 0; i < 6; i++) {
      line(toOut[i], toMid[i], 0.28, 0.55, prog, ELEM.connOI);
      line(boOut[i], boMid[i], 0.28, 0.55, prog, ELEM.connOI);
    }
    for (let i = 0; i < 6; i++) {
      line(toMid[i], toIn[i], 0.32, 0.6, prog, ELEM.connIM);
      line(boMid[i], boIn[i], 0.32, 0.6, prog, ELEM.connIM);
    }
    line(cT, cB, 0.5, 0.75, prog, ELEM.center, true);
    for (let i = 0; i < 6; i++) {
      line(cT, toIn[i], 0.25, 0.5, prog, ELEM.radii);
      line(cB, boIn[i], 0.25, 0.5, prog, ELEM.radii);
    }
    for (let i = 0; i < 6; i++) {
      dot(toMid[i], 1, 2.2, prog, ELEM.midRing);
      dot(boMid[i], 1, 2.2, prog, ELEM.midRing);
    }
    dot(cT, 1, 3, prog, ELEM.center);
    dot(cB, 1, 3, prog, ELEM.center);

    rotY += ROT_SPD;
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
