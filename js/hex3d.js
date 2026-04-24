(function () {
  const canvas = document.getElementById('hex3d');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const GOLD      = [201, 168, 76];
  const ROT_SPD   = 0.006;
  const T_BUILD   = 3400;
  const T_HOLD    = 1600;
  const T_DISSOLVE= 2600;
  const T_TOTAL   = T_BUILD + T_HOLD + T_DISSOLVE;

  let SIZE, SCALE, FOV, CAM_Z;

  function calcSize() {
    const container = canvas.parentElement;
    const maxW = container ? container.clientWidth : window.innerWidth;
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    /* No mobile usa a largura total da tela */
    const base = vw <= 768 ? Math.min(vw - 32, vh * 0.65) : Math.min(700, maxW * 0.75, vh * 0.85);
    SIZE  = Math.max(240, base);
    SCALE = SIZE / 480;
    FOV   = 340 * SCALE;
    CAM_Z = 500 * SCALE;
    canvas.width = canvas.height = SIZE;
  }

  calcSize();

  /* Carrega logo da pasta de imagens */
  const img = new Image();
  img.src = 'assets/images/hexiatecnologia-removebg-preview.png';

  let rotY      = 0;
  let startTime = null;
  let paused    = false;

  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
    if (!paused) { startTime = null; requestAnimationFrame(draw); }
  });

  window.addEventListener('resize', function () {
    calcSize();
    startTime = null;
  });

  const cos = Math.cos, sin = Math.sin, PI = Math.PI;

  function easeIn(t)  { return t * t; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  function rgba(a) { return `rgba(${GOLD},${a})`; }
  const GLOW_COLOR = `rgba(${GOLD},0.5)`;

  function globalAlpha(prog) {
    const buildEnd      = T_BUILD / T_TOTAL;
    const dissolveStart = (T_BUILD + T_HOLD) / T_TOTAL;
    if (prog <= buildEnd)      return easeOut(Math.min(1, prog / buildEnd * 1.6));
    if (prog <= dissolveStart) return 1;
    return easeIn(1 - (prog - dissolveStart) / (1 - dissolveStart));
  }

  function elemAlpha(thresh, prog) {
    const buildEnd      = T_BUILD / T_TOTAL;
    const dissolveStart = (T_BUILD + T_HOLD) / T_TOTAL;
    if (prog <= buildEnd) {
      const t = prog / buildEnd;
      if (t < thresh) return 0;
      return easeOut(Math.min(1, (t - thresh) / 0.08));
    }
    if (prog <= dissolveStart) return 1;
    const t   = (prog - dissolveStart) / (1 - dissolveStart);
    const rev = 1 - thresh;
    if (t < rev) return 1;
    return easeIn(Math.max(0, 1 - (t - rev) / 0.08));
  }

  /* ── Espiral de Fibonacci ──────────────────────────────── */
  const PHI = 1.6180339887;

  function drawSpiral(prog) {
    const buildEnd = T_BUILD / T_TOTAL;
    if (prog > buildEnd + 0.05) return;
    const t     = Math.min(1, prog / buildEnd);
    const steps = 320;
    const drawn = Math.floor(steps * t);

    /* Espiral interna */
    const turns1 = 3.8;
    const maxR1  = 458 * SCALE;
    ctx.shadowBlur  = 10 * SCALE;
    ctx.shadowColor = GLOW_COLOR;
    ctx.beginPath();
    for (let i = 0; i <= drawn; i++) {
      const u     = i / steps;
      const angle = u * turns1 * PI * 2 + rotY;
      const r     = (Math.pow(PHI, u * 4) - 1) / (Math.pow(PHI, 4) - 1) * maxR1;
      const px    = SIZE / 2 + cos(angle) * r;
      const py    = SIZE / 2 + sin(angle) * r * 0.62;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    const sa1 = t < 0.85 ? 0.55 : 0.55 * easeIn(1 - (t - 0.85) / 0.15);
    ctx.strokeStyle = rgba(sa1);
    ctx.lineWidth   = 0.9 * SCALE;
    ctx.stroke();

    /* Espiral externa — maior raio, fase defasada */
    const turns2 = 4.4;
    const maxR2  = SIZE * 0.90;
    const delay  = 0.16;
    const t2     = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
    const drawn2 = Math.floor(steps * t2);
    if (drawn2 > 0) {
      ctx.shadowBlur = 7 * SCALE;
      ctx.beginPath();
      for (let i = 0; i <= drawn2; i++) {
        const u     = i / steps;
        const angle = u * turns2 * PI * 2 + rotY + PI * 0.72;
        const r     = (Math.pow(PHI, u * 4) - 1) / (Math.pow(PHI, 4) - 1) * maxR2;
        const px    = SIZE / 2 + cos(angle) * r;
        const py    = SIZE / 2 + sin(angle) * r * 0.62;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      const sa2 = t2 < 0.85 ? 0.28 : 0.28 * easeIn(1 - (t2 - 0.85) / 0.15);
      ctx.strokeStyle = rgba(sa2);
      ctx.lineWidth   = 0.65 * SCALE;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  /* ── Logo 3D em hélice espiral ─────────────────────────── */
  function drawLogoSpiral(prog) {
    if (!img.complete || !img.naturalWidth) return;

    const N       = 10;           /* número de cópias na hélice */
    const TURNS   = 1.5;         /* voltas da hélice */
    const R       = 95 * SCALE;  /* raio da hélice */
    const H_HEL   = 150 * SCALE; /* altura total da hélice */
    const s0      = FOV / CAM_Z; /* escala perspectiva em z=0 */
    const aspect  = img.naturalHeight / img.naturalWidth;
    const gA      = globalAlpha(prog);
    if (gA < 0.01) return;

    const copies = [];

    for (let i = 0; i < N; i++) {
      const u     = i / (N - 1);              /* 0 → 1 ao longo da hélice */
      const angle = u * TURNS * PI * 2 + rotY;
      const x3d   = cos(angle) * R;
      const z3d   = sin(angle) * R;
      const y3d   = (u - 0.5) * H_HEL;

      const s  = FOV / (CAM_Z + z3d);
      const sx = SIZE / 2 + x3d * s;
      const sy = SIZE / 2 + y3d * s;

      const isCentral = i === Math.floor(N / 2);

      /* Largura base: central = 180px, demais = 52-80px */
      const natW = isCentral ? 180 * SCALE : (52 + u * 28) * SCALE;
      const imgW = natW * (s / s0);
      const imgH = imgW * aspect;

      /* Opacidade: central intensa, outras por profundidade */
      const depthFade  = Math.max(0, 1 - Math.abs(z3d / R) * 0.55);
      const baseOpacity = isCentral ? 0.94 : 0.22 + depthFade * 0.28;
      const opacity     = baseOpacity * gA;

      /* Brilho dourado suave ao redor de cada cópia */
      const glowR = isCentral ? 0.40 : 0.18 * depthFade;

      copies.push({ sx, sy, imgW, imgH, z3d, opacity, glowR, isCentral });
    }

    /* Ordena de trás para frente (painter's algorithm) */
    copies.sort((a, b) => b.z3d - a.z3d);

    copies.forEach(function (c) {
      ctx.save();

      /* Glow dourado ao redor da imagem */
      if (c.glowR > 0.01) {
        ctx.shadowBlur  = (c.isCentral ? 28 : 14) * SCALE;
        ctx.shadowColor = `rgba(${GOLD},${c.glowR})`;
      }

      ctx.globalAlpha = Math.max(0, Math.min(1, c.opacity));
      ctx.drawImage(img, c.sx - c.imgW / 2, c.sy - c.imgH / 2, c.imgW, c.imgH);

      ctx.restore();
    });
  }

  /* ── Loop principal ─────────────────────────────────────── */
  function draw(ts) {
    if (paused) return;
    if (!startTime) startTime = ts;
    const prog = ((ts - startTime) % T_TOTAL) / T_TOTAL;

    ctx.clearRect(0, 0, SIZE, SIZE);

    drawSpiral(prog);
    drawLogoSpiral(prog);

    rotY += ROT_SPD;
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
