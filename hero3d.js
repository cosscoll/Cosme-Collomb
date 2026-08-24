import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/BokehPass.js";
import { FilmPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/FilmPass.js";
import { OutputPass } from "https://unpkg.com/three@0.160.0/examples/jsm/postprocessing/OutputPass.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(pointer: coarse)").matches;
const canvas = document.getElementById("field");
const heroEl = document.getElementById("hero");

// Full scene is desktop-only: orbit-drag + piece drag-and-drop need a
// precise pointer, and the post-processing chain is too costly for
// most mobile GPUs. Touch/reduced-motion visitors get a static hero
// with no canvas, which the CSS already accounts for.
if (canvas && heroEl && !reduceMotion && !isTouch) {
  init();
}

const TILE = 1.05;
const BOARD_HALF = TILE * 4;

/* ================================================================
   Piece geometry — every piece is procedural (Lathe profiles for
   turned bodies + primitives for ornaments). No external 3D assets.
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
  g.userData.topY = 1.7;
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
  const merlonCount = 6;
  for (let i = 0; i < merlonCount; i++) {
    const a = (i / merlonCount) * Math.PI * 2;
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.1));
    merlon.position.set(Math.cos(a) * 0.3, topY + 0.11, Math.sin(a) * 0.3);
    merlon.rotation.y = -a;
    g.add(merlon);
  }
  g.userData.topY = topY + 0.22;
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
  g.userData.topY = 2.28;
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
  const spikeCount = 7;
  for (let i = 0; i < spikeCount; i++) {
    const a = (i / spikeCount) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 8));
    spike.position.set(Math.cos(a) * 0.24, topY + 0.13, Math.sin(a) * 0.24);
    g.add(spike);
  }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12));
  orb.position.y = topY + 0.32;
  g.add(orb);
  g.userData.topY = topY + 0.42;
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
  g.userData.topY = 3.3;
  return g;
}

function knightGroup() {
  // Not rotationally symmetric — built from primitives as an abstract,
  // angular silhouette rather than a literal horse head, consistent
  // with the site's procedural/geometric visual language elsewhere.
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

  g.userData.topY = 1.9;
  return g;
}

const BUILDERS = { pawn: pawnGroup, rook: rookGroup, knight: knightGroup, bishop: bishopGroup, queen: queenGroup, king: kingGroup };

/* ================================================================
   Procedural checker board texture — two dark tones + faint cobalt
   grid, kept moody rather than a literal bright chessboard.
   ================================================================ */
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

function init() {
  let width = heroEl.offsetWidth;
  let height = heroEl.offsetHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0b0e, 9, 21);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0.5, 3.1, 9.5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  /* ---- Lighting ---- */
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

  /* ---- Board floor ---- */
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

  /* ---- Materials ---- */
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x131318, roughness: 0.32, metalness: 0.65 });
  const brightMat = new THREE.MeshStandardMaterial({ color: 0xe9e6dd, roughness: 0.26, metalness: 0.4 });

  /* ---- Assemble the set: 8 pawns + back rank, king & queen highlighted ---- */
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

  /* ---- Cheap ground reflection: mirrored, dimmed duplicates ---- */
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

  /* ---- OrbitControls: drag to orbit, scroll to zoom, gentle autorotate ---- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, -0.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 6.5;
  controls.maxDistance = 15;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.update();

  /* ---- Post-processing: bloom, subtle DOF, film grain ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.4, 0.5, 0.78);
  composer.addPass(bloomPass);

  const bokehPass = new BokehPass(scene, camera, {
    focus: 9.5,
    aperture: 0.00028,
    maxblur: 0.006,
  });
  composer.addPass(bokehPass);

  const filmPass = new FilmPass(0.22, false);
  composer.addPass(filmPass);

  composer.addPass(new OutputPass());

  /* ---- Piece interaction: hover + click-drag with grid snapping ---- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let hovered = null;
  let dragging = null;
  const hopState = new Map();
  const cursorRing = document.querySelector(".cursor-ring");
  const cursorLabel = document.querySelector(".cursor-label");

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

  renderer.domElement.addEventListener("pointermove", (e) => {
    updatePointer(e);
    if (dragging) {
      raycaster.setFromCamera(pointer, camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        dragging.position.x = THREE.MathUtils.clamp(hit.x, -BOARD_HALF + 0.3, BOARD_HALF - 0.3);
        dragging.position.z = THREE.MathUtils.clamp(hit.z, -BOARD_HALF + 0.3, BOARD_HALF - 0.3);
      }
    }
  });

  renderer.domElement.addEventListener("pointerdown", (e) => {
    updatePointer(e);
    const hit = pieceAtPointer();
    if (hit) {
      dragging = hit;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      if (cursorRing) cursorRing.classList.add("is-active");
      if (cursorLabel) cursorLabel.textContent = "DÉPLACER";
    }
  });

  function endDrag(e) {
    if (!dragging) return;
    const col = THREE.MathUtils.clamp(Math.round(dragging.position.x / TILE + 3.5), 0, 7);
    const row = THREE.MathUtils.clamp(Math.round(dragging.position.z / TILE + 3.5), 0, 7);
    dragging.userData.baseX = (col - 3.5) * TILE;
    dragging.userData.baseZ = (row - 3.5) * TILE;
    hopState.set(dragging, { t: 0.6, isLand: true });
    dragging = null;
    controls.enabled = true;
    if (cursorRing) cursorRing.classList.remove("is-active");
    if (cursorLabel) cursorLabel.textContent = "";
    try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  renderer.domElement.addEventListener("pointerup", endDrag);
  renderer.domElement.addEventListener("pointerleave", (e) => { if (dragging) endDrag(e); });

  renderer.domElement.addEventListener("click", () => {
    if (dragging) return;
    const hit = pieceAtPointer();
    if (hit) hopState.set(hit, { t: 0, isLand: false });
  });

  function resize() {
    width = heroEl.offsetWidth;
    height = heroEl.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
    bloomPass.setSize(width, height);
  }
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();

  function animate() {
    const t = clock.getElapsedTime();

    pieces.forEach((piece, i) => {
      const isDragged = piece === dragging;
      const bob = isDragged ? 0 : Math.sin(t * 1.3 + piece.userData.phase) * 0.035;

      let hop = 0;
      const state = hopState.get(piece);
      if (state) {
        state.t += 0.045;
        const p = Math.min(state.t, 1);
        hop = Math.sin(p * Math.PI) * (state.isLand ? 0.4 : 0.5);
        if (!isDragged && (state.isLand || true)) {
          // Ease x/z back toward the snapped base position while landing
          piece.position.x += (piece.userData.baseX - piece.position.x) * 0.18;
          piece.position.z += (piece.userData.baseZ - piece.position.z) * 0.18;
        }
        if (state.t >= 1) hopState.delete(piece);
      }

      if (!isDragged) {
        piece.position.y = piece.userData.baseY + bob + hop;
      } else {
        piece.position.y = 0.35;
      }

      if (!isDragged) piece.rotation.y += piece.userData.type === "king" ? 0.0015 : 0.003;

      // Sync the mirrored reflection beneath the floor
      const refl = reflections[i];
      refl.position.set(piece.position.x, -piece.position.y - 0.01, piece.position.z);
      refl.rotation.y = piece.rotation.y;
    });

    controls.update();
    composer.render();
    requestAnimationFrame(animate);
  }
  animate();
}
