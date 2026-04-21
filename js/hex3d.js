(function () {
  const canvas = document.getElementById('hex3d');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const SIZE  = 480;
  canvas.width = canvas.height = SIZE;

  /* ── Constantes ─────────────────────────────────────── */
  const PHI       = 1.6180339887;   // razão áurea
  const GOLD      = [201, 168, 76];
  const FOV       = 320;
  const CAM_Z     = 480;
  const TILT_X    = 0.36;
  const ROT_SPD   = 0.007;

  /* Duração de cada fase do ciclo (ms) */
  const T_BUILD   = 3200;
  const T_HOLD    = 1400;
  const T_DISSOLVE= 2400;
  const T_TOTAL   = T_BUILD + T_HOLD + T_DISSOLVE;

  let rotY = 0;
  let startTime = null;
  let paused = false;
  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
    if (!paused) { startTime = null; requestAnimationFrame(draw); }
  });

  /* ── Motor 3D mínimo ────────────────────────────────── */
  const cos = Math.cos, sin = Math.sin, PI = Math.PI;

  function tr(p) {
    /* rotação Y → rotação X → projeção perspectiva */
    let x = p.x * cos(rotY) + p.z * sin(rotY);
    let z0 = -p.x * sin(rotY) + p.z * cos(rotY);
    let y = p.y * cos(TILT_X) - z0 * sin(TILT_X);
    let z = p.y * sin(TILT_X) + z0 * cos(TILT_X);
    const s = FOV / (CAM_Z + z);
    return { x: SIZE / 2 + x * s, y: SIZE / 2 + y * s };
  }

  function hexRing(r, y, phase) {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (PI / 3) * i + (phase || 0);
      return { x: cos(a) * r, y, z: sin(a) * r };
    });
  }

  /* ── Geometria do hexágono ──────────────────────────── */
  const H = 130, R_OUT = 155, R_MID = 100, R_IN = 46;

  /* "threshold" de cada elemento: quanto da espiral precisa ter passado
      para aquele elemento começar a aparecer. Segue série Fibonacci:
      0, 1, 1, 2, 3, 5, 8 → normalizado 0..1 */
  const FIB_NORM = [0, 0.05, 0.10, 0.18, 0.30, 0.48, 0.78, 1.0];

  const ELEM = {
    center:    0.00,   // pontos centrais
    innerRing: 0.10,   // anel interno
    innerVert: 0.20,   // arestas verticais internas
    midRing:   0.32,   // anel intermediário
    midVert:   0.44,   // arestas verticais médias
    radii:     0.54,   // raios centro→interno
    connIM:    0.64,   // conexões intermediário→interno
    outerRing: 0.74,   // anel externo
    outerVert: 0.84,   // arestas verticais externas
    connOI:    0.92,   // conexões externo→intermediário
  };

  /* ── Curvas de easing ───────────────────────────────── */
  function easeIn(t)  { return t * t; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  /* Alpha de um elemento dado o progresso do ciclo (0..1) */
  function alpha(thresh, prog) {
    const buildEnd   = T_BUILD   / T_TOTAL;
    const dissolveStart = (T_BUILD + T_HOLD) / T_TOTAL;

    if (prog <= buildEnd) {
      const t = prog / buildEnd;
      if (t < thresh) return 0;
      return easeOut(Math.min(1, (t - thresh) / 0.08));
    }
    if (prog <= dissolveStart) return 1;

    /* dissolução: de fora para dentro (thresh invertido) */
    const t = (prog - dissolveStart) / (1 - dissolveStart);
    const revThresh = 1 - thresh;
    if (t < revThresh) return 1;
    return easeIn(Math.max(0, 1 - (t - revThresh) / 0.08));
  }

  /* ── Primitivas de desenho ──────────────────────────── */
  function rgba(a) { return `rgba(${GOLD},${a})`; }

  function line(a, b, baseAlpha, width, prog, thresh, glow) {
    const al = baseAlpha * alpha(thresh, prog);
    if (al < 0.01) return;
    const pa = tr(a), pb = tr(b);
    ctx.shadowBlur  = glow ? 12 : 0;
    ctx.shadowColor = `rgba(${GOLD},0.5)`;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = rgba(al);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function dot(p, baseAlpha, r, prog, thresh) {
    const al = baseAlpha * alpha(thresh, prog);
    if (al < 0.01) return;
    const pp = tr(p);
    ctx.shadowBlur  = 22;
    ctx.shadowColor = `rgba(${GOLD},0.6)`;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, r, 0, PI * 2);
    ctx.fillStyle = rgba(al);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ── Espiral áurea 2D (overlay) ─────────────────────── */
  function drawSpiral(prog) {
    const buildEnd = T_BUILD / T_TOTAL;
    if (prog > buildEnd + 0.05) return;   /* só durante a construção */

    const t  = Math.min(1, prog / buildEnd);
    const steps = 300;
    const drawn = Math.floor(steps * t);
    const turns = 2.8;
    const maxR  = 158;

    ctx.shadowBlur  = 10;
    ctx.shadowColor = `rgba(${GOLD},0.55)`;
    ctx.beginPath();
    for (let i = 0; i <= drawn; i++) {
      const u = i / steps;
      const angle = u * turns * PI * 2 + rotY;
      /* espiral logarítmica: r = e^(b*θ), b = ln(PHI)/(π/2) */
      const r = (Math.pow(PHI, u * 4) - 1) / (Math.pow(PHI, 4) - 1) * maxR;
      const px = SIZE / 2 + cos(angle) * r;
      const py = SIZE / 2 + sin(angle) * r * 0.62;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    /* fade da espiral conforme ela se completa */
    const spiralAlpha = t < 0.85 ? 0.55 : 0.55 * easeIn(1 - (t - 0.85) / 0.15);
    ctx.strokeStyle = rgba(spiralAlpha);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ── Loop principal ─────────────────────────────────── */
  function draw(ts) {
    if (paused) return;
    if (!startTime) startTime = ts;
    const prog = ((ts - startTime) % T_TOTAL) / T_TOTAL;

    ctx.clearRect(0, 0, SIZE, SIZE);

    /* geometria */
    const toOut = hexRing(R_OUT, -H/2);
    const boOut = hexRing(R_OUT,  H/2);
    const toMid = hexRing(R_MID, -H/2, PI/6);
    const boMid = hexRing(R_MID,  H/2, PI/6);
    const toIn  = hexRing(R_IN,  -H/2);
    const boIn  = hexRing(R_IN,   H/2);
    const cT = {x:0, y:-H/2, z:0};
    const cB = {x:0, y: H/2, z:0};

    /* espiral áurea (aparece durante a construção) */
    drawSpiral(prog);

    /* anel externo */
    for (let i = 0; i < 6; i++) {
      const n = (i+1)%6;
      line(toOut[i], toOut[n], 0.55, 0.85, prog, ELEM.outerRing);
      line(boOut[i], boOut[n], 0.55, 0.85, prog, ELEM.outerRing);
      line(toOut[i], boOut[i], 0.28, 0.7,  prog, ELEM.outerVert);
    }
    /* anel intermediário */
    for (let i = 0; i < 6; i++) {
      const n = (i+1)%6;
      line(toMid[i], toMid[n], 0.95, 1.2, prog, ELEM.midRing, true);
      line(boMid[i], boMid[n], 0.95, 1.2, prog, ELEM.midRing, true);
      line(toMid[i], boMid[i], 0.42, 0.7, prog, ELEM.midVert);
    }
    /* anel interno */
    for (let i = 0; i < 6; i++) {
      const n = (i+1)%6;
      line(toIn[i], toIn[n], 0.7, 1.0, prog, ELEM.innerRing, true);
      line(boIn[i], boIn[n], 0.7, 1.0, prog, ELEM.innerRing, true);
      line(toIn[i], boIn[i], 0.3, 0.65,prog, ELEM.innerVert);
    }
    /* conexões externo→intermediário */
    for (let i = 0; i < 6; i++) {
      line(toOut[i], toMid[i], 0.28, 0.55, prog, ELEM.connOI);
      line(boOut[i], boMid[i], 0.28, 0.55, prog, ELEM.connOI);
    }
    /* conexões intermediário→interno */
    for (let i = 0; i < 6; i++) {
      line(toMid[i], toIn[i], 0.32, 0.6, prog, ELEM.connIM);
      line(boMid[i], boIn[i], 0.32, 0.6, prog, ELEM.connIM);
    }
    /* eixo central */
    line(cT, cB, 0.5, 0.75, prog, ELEM.center, true);
    /* raios centro→interno */
    for (let i = 0; i < 6; i++) {
      line(cT, toIn[i], 0.25, 0.5, prog, ELEM.radii);
      line(cB, boIn[i], 0.25, 0.5, prog, ELEM.radii);
    }
    /* pontos luminosos */
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
