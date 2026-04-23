(function () {
  const canvas = document.getElementById('hex3d');
  if (!canvas || typeof THREE === 'undefined') return;

  /* ── Cena ───────────────────────────────────────────── */
  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.z = 4.2;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias : true,
    alpha     : true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;
  renderer.outputColorSpace    = THREE.SRGBColorSpace;

  /* ── Responsivo ─────────────────────────────────────── */
  function resize() {
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const cont = canvas.parentElement;
    let s;
    if (vw <= 768) {
      s = Math.min(vw - 24, Math.round(vh * 0.52));
    } else {
      s = Math.min(480, cont ? cont.clientWidth : vw, Math.round(vh * 0.72));
    }
    s = Math.max(240, s);
    renderer.setSize(s, s, false);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ── Geometria — vórtice espiral ────────────────────── */
  const knotGeo = new THREE.TorusKnotGeometry(1.05, 0.38, 280, 32, 2, 3);

  /* Material metálico dourado */
  const knotMat = new THREE.MeshStandardMaterial({
    color            : new THREE.Color(0xC9A030),
    metalness        : 0.92,
    roughness        : 0.12,
    emissive         : new THREE.Color(0x5C3A00),
    emissiveIntensity: 0.55,
  });

  const knot = new THREE.Mesh(knotGeo, knotMat);
  scene.add(knot);

  /* Anel externo — halo sutil */
  const ringGeo = new THREE.TorusGeometry(1.72, 0.012, 8, 160);
  const ringMat = new THREE.MeshStandardMaterial({
    color    : new THREE.Color(0xE8C97A),
    metalness: 0.8,
    roughness: 0.2,
    emissive : new THREE.Color(0xC9A84C),
    emissiveIntensity: 0.6,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  /* Segundo anel inclinado */
  const ring2 = ring.clone();
  ring2.rotation.set(Math.PI / 3, Math.PI / 6, 0);
  scene.add(ring2);

  /* ── Iluminação dinâmica ────────────────────────────── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const keyLight = new THREE.DirectionalLight(0xfff8e7, 3.5);
  keyLight.position.set(4, 4, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffd080, 1.2);
  fillLight.position.set(-3, 1, 2);
  scene.add(fillLight);

  /* Luz pontual que orbita — cria reflexo dinâmico */
  const orbitLight = new THREE.PointLight(0xffe0a0, 6, 12);
  scene.add(orbitLight);

  /* Luz de contorno azul-dourada para contraste */
  const rimLight = new THREE.PointLight(0x88aaff, 2.5, 10);
  rimLight.position.set(-3, -2, -1);
  scene.add(rimLight);

  /* ── Partículas ao redor ────────────────────────────── */
  const PARTS  = 280;
  const pPositions = new Float32Array(PARTS * 3);
  for (let i = 0; i < PARTS; i++) {
    const r   = 2.1 + Math.random() * 1.4;
    const phi = Math.acos(2 * Math.random() - 1);
    const th  = Math.random() * Math.PI * 2;
    pPositions[i * 3]     = r * Math.sin(phi) * Math.cos(th);
    pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(th);
    pPositions[i * 3 + 2] = r * Math.cos(phi);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({
    color      : 0xE8C97A,
    size       : 0.028,
    transparent: true,
    opacity    : 0.55,
    sizeAttenuation: true,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  /* ── Loop ───────────────────────────────────────────── */
  let animId = null;
  let t      = 0;

  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.012;

    knot.rotation.x += 0.004;
    knot.rotation.y += 0.007;

    ring.rotation.z  += 0.003;
    ring2.rotation.z -= 0.002;

    /* Luz orbita ao redor do objeto */
    orbitLight.position.set(
      Math.cos(t * 0.6) * 3.2,
      Math.sin(t * 0.4) * 2.0,
      Math.sin(t * 0.5) * 2.5
    );

    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(animId);
      animId = null;
    } else {
      if (!animId) animate();
    }
  });

  animate();
})();
