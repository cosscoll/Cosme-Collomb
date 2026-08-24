import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(pointer: coarse)").matches;
const canvas = document.getElementById("field");
const heroEl = document.getElementById("hero");

if (canvas && heroEl && !reduceMotion && !isTouch) {
  init();
}

const TILE = 1.05;
const BOARD_HALF = TILE * 4;

/* ================================================================
   Piece geometry — Lathe profiles for turned bodies + primitives for
   ornaments. Procedural only, no external 3D assets.
   ================================================================ */
function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

function pawnGroup() {
  const body = lathe([
    [0.5, 0], [0.5, 0.06], [0.38, 0.14], [0.27, 0.22], [0.3, 0.3],
    [0.18, 0.42], [0.14, 0.6], [0.14, 0.95], [0.22, 1.04], [0.27, 1.1],
    [0.18, 1.18], [0.27, 1.3], [0.3, 1.42], [0.27, 1.54], [0.12, 1.64], [0, 1.7],
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body));
  return g;
}

function rookGroup() {
  const body = lathe([
    [0.5, 0], [0.5, 0.06], [0.38, 0.14], [0.3, 0.22], [0.34, 0.3],
    [0.22, 0.5], [0.2, 0.95], [0.28, 1.02], [0.34, 1.1], [0.32, 1.16], [0.38, 1.24],
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body));
  const topY = 1.24;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.1));
    merlon.position.set(Math.cos(a) * 0.3, topY + 0.11, Math.sin(a) * 0.3);
    merlon.rotation.y = -a;
    g.add(merlon);
  }
  return g;
}

function bishopGroup() {
  const body = lathe([
    [0.5, 0], [0.5, 0.06], [0.36, 0.14], [0.26, 0.22], [0.3, 0.3],
    [0.16, 0.5], [0.13, 0.85], [0.13, 1.25], [0.2, 1.34], [0.26, 1.4],
    [0.15, 1.5], [0.24, 1.62], [0.28, 1.76], [0.18, 1.92], [0.07, 2.06], [0, 2.14],
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12));
  tip.position.y = 2.2;
  g.add(tip);
  return g;
}

function queenGroup() {
  const body = lathe([
    [0.58, 0], [0.58, 0.07], [0.42, 0.16], [0.32, 0.26], [0.38, 0.36],
    [0.2, 0.5], [0.16, 0.75], [0.16, 1.55], [0.24, 1.66], [0.32, 1.74],
    [0.2, 1.84], [0.32, 1.98], [0.4, 2.14], [0.44, 2.3], [0.36, 2.42], [0.26, 2.5],
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body));
  const topY = 2.5;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 8));
    spike.position.set(Math.cos(a) * 0.24, topY + 0.13, Math.sin(a) * 0.24);
    g.add(spike);
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12));
  orb.position.y = topY + 0.32;
  g.add(orb);
  return g;
}

function kingGroup() {
  const body = lathe([
    [0.62, 0], [0.62, 0.07], [0.46, 0.16], [0.34, 0.26], [0.4, 0.36],
    [0.22, 0.5], [0.18, 0.75], [0.18, 1.6], [0.26, 1.72], [0.34, 1.8],
    [0.22, 1.9], [0.34, 2.05], [0.42, 2.22], [0.46, 2.38], [0.4, 2.52],
    [0.3, 2.62], [0.42, 2.72], [0.34, 2.82], [0.1, 2.9], [0, 2.95],
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body));
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.07));
  crossV.position.y = 3.12;
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.07));
  crossH.position.y = 3.14;
  g.add(crossV, crossH);
  return g;
}

function knightGroup() {
  const stand = lathe([
    [0.5, 0], [0.5, 0.06], [0.38, 0.14], [0.27, 0.22], [0.3, 0.3],
    [0.2, 0.45], [0.18, 0.7],
  ]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(stand));
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.34));
  neck.position.set(0, 1.0, -0.02);
  neck.rotation.x = -0.18;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.62));
  head.position.set(0, 1.42, 0.16);
  head.rotation.x = -0.32;
  g.add(head);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.32));
  muzzle.position.set(0, 1.3, 0.5);
  muzzle.rotation.x = -0.32;
  g.add(muzzle);
  const ear1 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 4));
  ear1.position.set(-0.1, 1.75, -0.05);
  ear1.rotation.z = 0.15;
  const ear2 = ear1.clone();
  ear2.position.x = 0.1;
  ear2.rotation.z = -0.15;
  g.add(ear1, ear2);
  return g;
}

const BUILDERS = { pawn: pawnGroup, rook: rookGroup, knight: knightGroup, bishop: bishopGroup, queen: queenGroup, king: kingGroup };

function makeBoardTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const cell = size / 8;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#141419" : "#0c0c10";
      ctx.fillRect(col * cell, row * cell, cell, cell);
    }
  }
  ctx.strokeStyle = "rgba(58,92,255,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(size, i * cell);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ================================================================
   Minimal hand-rolled post-processing (bloom-lite + film grain) —
   built only from core THREE (render targets + a fullscreen shader
   quad), so it never depends on external addon modules.
   ================================================================ */
function createPostFX(renderer, width, height) {
  const rt = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      uResolution: { value: new THREE.Vector2(width, height) },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uTime;
      varying vec2 vUv;

      float grainNoise(vec2 uv, float t) {
        return fract(sin(dot(uv * t, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 texel = 1.0 / uResolution;
        vec3 base = texture2D(tDiffuse, vUv).rgb;

        // Cheap bloom: average a small ring of samples, keep only the
        // bright part above a threshold, add it back softly.
        vec3 bloom = vec3(0.0);
        const int SAMPLES = 8;
        vec2 offsets[8];
        offsets[0] = vec2(1.0, 0.0);
        offsets[1] = vec2(-1.0, 0.0);
        offsets[2] = vec2(0.0, 1.0);
        offsets[3] = vec2(0.0, -1.0);
        offsets[4] = vec2(1.0, 1.0);
        offsets[5] = vec2(-1.0, 1.0);
        offsets[6] = vec2(1.0, -1.0);
        offsets[7] = vec2(-1.0, -1.0);
        for (int i = 0; i < SAMPLES; i++) {
          vec3 s = texture2D(tDiffuse, vUv + offsets[i] * texel * 3.0).rgb;
          float lum = dot(s, vec3(0.299, 0.587, 0.114));
          bloom += max(s - vec3(0.72), 0.0) * step(0.72, lum);
        }
        bloom /= float(SAMPLES);

        vec3 color = base + bloom * 0.9;

        // Film grain
        float grain = (grainNoise(vUv, uTime * 60.0) - 0.5) * 0.05;
        color += grain;

        // Gentle vignette
        float d = distance(vUv, vec2(0.5));
        color *= smoothstep(0.85, 0.35, d) * 0.25 + 0.75;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quadScene.add(quad);

  return {
    rt,
    render(renderer, scene, camera, t) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      material.uniforms.uTime.value = t;
      renderer.render(quadScene, quadCamera);
    },
    setSize(w, h) {
      rt.setSize(w, h);
      material.uniforms.uResolution.value.set(w, h);
    },
  };
}

function init() {
  let width = heroEl.offsetWidth;
  let height = heroEl.offsetHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0b0e, 9, 21);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene.add(new THREE.AmbientLight(0x1c1c2a, 0.8));

  const key = new THREE.DirectionalLight(0xaebbff, 2.1);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.002;
  scene.add(key);

  const rim = new THREE.PointLight(0xff3b30, 16, 20);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const fill = new THREE.PointLight(0x3a5cff, 9, 18);
  fill.position.set(3, 1.5, 4);
  scene.add(fill);

  const boardTex = makeBoardTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE * 8, TILE * 8),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.55, metalness: 0.25 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 1 })
  );
  backdrop.rotation.x = -Math.PI / 2;
  backdrop.position.y = -0.01;
  backdrop.receiveShadow = true;
  scene.add(backdrop);

  const darkMat = new THREE.MeshStandardMaterial({ color: 0x131318, roughness: 0.32, metalness: 0.65 });
  const brightMat = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.26, metalness: 0.4 });

  const pieces = [];
  const order = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  function place(type, col, row, mat) {
    const g = BUILDERS[type]();
    g.traverse((c) => {
      if (c.isMesh) {
        c.material = mat;
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    g.position.set((col - 3.5) * TILE, 0, (row - 3.5) * TILE);
    g.userData.baseY = 0;
    g.userData.baseX = g.position.x;
    g.userData.baseZ = g.position.z;
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.type = type;
    scene.add(g);
    pieces.push(g);
    return g;
  }

  for (let i = 0; i < 8; i++) place("pawn", i, 2, darkMat);
  order.forEach((type, i) => {
    const mat = type === "king" || type === "queen" ? brightMat : darkMat;
    place(type, i, 1, mat);
  });

  const reflectMat = { dark: darkMat.clone(), bright: brightMat.clone() };
  reflectMat.dark.transparent = true;
  reflectMat.dark.opacity = 0.14;
  reflectMat.bright.transparent = true;
  reflectMat.bright.opacity = 0.16;
  const reflections = pieces.map((piece) => {
    const clone = piece.clone(true);
    clone.traverse((c) => {
      if (c.isMesh) {
        c.material = c.material === brightMat ? reflectMat.bright : reflectMat.dark;
        c.castShadow = false;
        c.receiveShadow = false;
      }
    });
    clone.scale.y = -1;
    scene.add(clone);
    return clone;
  });

  /* ---- Manual orbit camera (no external controls module) ---- */
  const target = new THREE.Vector3(0, 1, -0.5);
  const orbit = { theta: 0.3, phi: 1.0, radius: 10 };
  const orbitTarget = { theta: 0.3, phi: 1.0, radius: 10 };
  const ORBIT_MIN_PHI = 0.35;
  const ORBIT_MAX_PHI = Math.PI / 2 - 0.04;
  const ORBIT_MIN_R = 6.5;
  const ORBIT_MAX_R = 15;

  function applyCamera() {
    camera.position.x = target.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
    camera.position.y = target.y + orbit.radius * Math.cos(orbit.phi);
    camera.position.z = target.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
    camera.lookAt(target);
  }
  applyCamera();

  /* ---- Interaction: orbit-drag on empty space, piece drag on a piece, click to hop ---- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hopState = new Map();
  const cursorRing = document.querySelector(".cursor-ring");
  const cursorLabel = document.querySelector(".cursor-label");

  let mode = null; // 'orbit' | 'piece' | null
  let draggedPiece = null;
  let lastX = 0, lastY = 0, startX = 0, startY = 0;
  let autoRotate = true;

  function updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pieceAtPointer() {
    raycaster.setFromCamera(pointer, camera);
    const targets = pieces.flatMap((p) => p.children.filter((c) => c.isMesh));
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    let cur = hits[0].object;
    while (cur && !pieces.includes(cur)) cur = cur.parent;
    return cur;
  }

  canvas.addEventListener("pointerdown", (e) => {
    updatePointer(e);
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    autoRotate = false;
    const hit = pieceAtPointer();
    if (hit) {
      mode = "piece";
      draggedPiece = hit;
      if (cursorRing) cursorRing.classList.add("is-active");
      if (cursorLabel) cursorLabel.textContent = "DÉPLACER";
    } else {
      mode = "orbit";
    }
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    updatePointer(e);
    if (mode === "piece" && draggedPiece) {
      raycaster.setFromCamera(pointer, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        draggedPiece.position.x = THREE.MathUtils.clamp(hit.x, -BOARD_HALF + 0.3, BOARD_HALF - 0.3);
        draggedPiece.position.z = THREE.MathUtils.clamp(hit.z, -BOARD_HALF + 0.3, BOARD_HALF - 0.3);
      }
    } else if (mode === "orbit") {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      orbitTarget.theta -= dx * 0.006;
      orbitTarget.phi = THREE.MathUtils.clamp(orbitTarget.phi - dy * 0.006, ORBIT_MIN_PHI, ORBIT_MAX_PHI);
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  function endPointer(e) {
    const moved = Math.hypot(e.clientX - startX, e.clientY - startY);

    if (mode === "piece" && draggedPiece) {
      if (moved < 5) {
        hopState.set(draggedPiece, { t: 0, isLand: false });
      } else {
        const col = THREE.MathUtils.clamp(Math.round(draggedPiece.position.x / TILE + 3.5), 0, 7);
        const row = THREE.MathUtils.clamp(Math.round(draggedPiece.position.z / TILE + 3.5), 0, 7);
        draggedPiece.userData.baseX = (col - 3.5) * TILE;
        draggedPiece.userData.baseZ = (row - 3.5) * TILE;
        hopState.set(draggedPiece, { t: 0.6, isLand: true });
      }
      if (cursorRing) cursorRing.classList.remove("is-active");
      if (cursorLabel) cursorLabel.textContent = "";
    }

    mode = null;
    draggedPiece = null;
    autoRotate = true;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointerleave", (e) => { if (mode) endPointer(e); });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      orbitTarget.radius = THREE.MathUtils.clamp(orbitTarget.radius + e.deltaY * 0.01, ORBIT_MIN_R, ORBIT_MAX_R);
    },
    { passive: false }
  );

  const post = createPostFX(renderer, width, height);

  function resize() {
    width = heroEl.offsetWidth;
    height = heroEl.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    post.setSize(width, height);
  }
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();

  function animate() {
    const t = clock.getElapsedTime();

    if (autoRotate) orbitTarget.theta += 0.0022;

    orbit.theta += (orbitTarget.theta - orbit.theta) * 0.08;
    orbit.phi += (orbitTarget.phi - orbit.phi) * 0.08;
    orbit.radius += (orbitTarget.radius - orbit.radius) * 0.08;
    applyCamera();

    pieces.forEach((piece, i) => {
      const isDragged = piece === draggedPiece;
      const bob = isDragged ? 0 : Math.sin(t * 1.3 + piece.userData.phase) * 0.035;

      let hop = 0;
      const state = hopState.get(piece);
      if (state) {
        state.t += 0.045;
        const p = Math.min(state.t, 1);
        hop = Math.sin(p * Math.PI) * (state.isLand ? 0.4 : 0.5);
        if (!isDragged) {
          piece.position.x += (piece.userData.baseX - piece.position.x) * 0.18;
          piece.position.z += (piece.userData.baseZ - piece.position.z) * 0.18;
        }
        if (state.t >= 1) hopState.delete(piece);
      }

      piece.position.y = isDragged ? 0.35 : piece.userData.baseY + bob + hop;
      if (!isDragged) piece.rotation.y += piece.userData.type === "king" ? 0.0015 : 0.003;

      const refl = reflections[i];
      refl.position.set(piece.position.x, -piece.position.y - 0.01, piece.position.z);
      refl.rotation.y = piece.rotation.y;
    });

    post.render(renderer, scene, camera, t);
    requestAnimationFrame(animate);
  }
  animate();
}
