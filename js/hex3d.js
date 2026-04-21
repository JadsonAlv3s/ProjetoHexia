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
    SIZE  = Math.min(480, maxW, window.innerHeight * 0.7);
    SIZE  = Math.max(220, SIZE);
    SCALE = SIZE / 480;
    FOV   = 340 * SCALE;
    CAM_Z = 500 * SCALE;
    canvas.width = canvas.height = SIZE;
  }

  calcSize();

  /* Carrega logo da pasta de imagens */
  const img = new Image();
  img.src = 'assets/images/logoHexia-removebg-preview.png';

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

  /* ── Teia de aranha (fundo) ────────────────────────────── */
  function drawWeb(prog) {
    const SPOKES = 12;
    const RINGS  = 9;
    const maxR   = SIZE * 0.49;
    const cx     = SIZE / 2;
    const cy     = SIZE / 2;
    const webRot = rotY * 0.4;

    ctx.shadowBlur  = 4 * SCALE;
    ctx.shadowColor = GLOW_COLOR;

    const spokeAl = 0.10 * elemAlpha(0.0, prog);
    if (spokeAl > 0.01) {
      ctx.strokeStyle = rgba(spokeAl);
      ctx.lineWidth   = 0.5 * SCALE;
      for (let i = 0; i < SPOKES; i++) {
        const angle = (PI * 2 / SPOKES) * i + webRot;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + cos(angle) * maxR, cy + sin(angle) * maxR * 0.72);
        ctx.stroke();
      }
    }

    for (let r = 0; r < RINGS; r++) {
      const thresh  = 0.08 + (r / RINGS) * 0.84;
      const outerAl = r === RINGS - 1 ? 0.18 : 0.10;
      const al      = outerAl * elemAlpha(thresh, prog);
      if (al < 0.01) continue;

      const radius = ((r + 1) / RINGS) * maxR;
      ctx.strokeStyle = rgba(al);
      ctx.lineWidth   = (r === RINGS - 1 ? 0.7 : 0.45) * SCALE;
      ctx.beginPath();
      for (let i = 0; i <= SPOKES; i++) {
        const angle = (PI * 2 / SPOKES) * i + webRot;
        const px = cx + cos(angle) * radius;
        const py = cy + sin(angle) * radius * 0.72;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      if (r === RINGS - 1) {
        const nodeAl = 0.45 * elemAlpha(thresh, prog);
        ctx.fillStyle  = rgba(nodeAl);
        ctx.shadowBlur = 7 * SCALE;
        for (let i = 0; i < SPOKES; i++) {
          const angle = (PI * 2 / SPOKES) * i + webRot;
          ctx.beginPath();
          ctx.arc(
            cx + cos(angle) * radius,
            cy + sin(angle) * radius * 0.72,
            1.3 * SCALE, 0, PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.shadowBlur = 0;
  }

  /* ── Logo 3D em hélice espiral ─────────────────────────── */
  function drawLogoSpiral(prog) {
    if (!img.complete || !img.naturalWidth) return;

    const N       = 9;           /* número de cópias na hélice */
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

    drawWeb(prog);
    drawLogoSpiral(prog);

    rotY += ROT_SPD;
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
