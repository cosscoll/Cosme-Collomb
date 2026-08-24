import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("field");
const heroEl = document.getElementById("hero");

if (canvas && heroEl && !reduceMotion) {
  init();
}

/* ================================================================
   Piece geometry — turned profiles revolved with LatheGeometry.
   No external 3D assets: every piece is built procedurally.
   ================================================================ */
function pawnGeometry() {
  const pts = [
    [0.55, 0], [0.55, 0.06], [0.42, 0.14], [0.3, 0.22], [0.34, 0.3],
    [0.2, 0.42], [0.16, 0.6], [0.16, 1.05], [0.24, 1.15], [0.3, 1.22],
    [0.2, 1.3], [0.3, 1.42], [0.34, 1.55], [0.3, 1.68], [0.14, 1.8], [0, 1.86],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 28);
}

function kingGroup() {
  const pts = [
    [0.62, 0], [0.62, 0.07], [0.46, 0.16], [0.34, 0.26], [0.4, 0.36],
    [0.22, 0.5], [0.18, 0.75], [0.18, 1.6], [0.26, 1.72], [0.34, 1.8],
    [0.22, 1.9], [0.34, 2.05], [0.42, 2.22], [0.46, 2.38], [0.4, 2.52],
    [0.3, 2.62], [0.42, 2.72], [0.34, 2.82], [0.1, 2.9], [0, 2.95],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(pts, 32);

  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(body);
  bodyMesh.name = "kingBody";
  group.add(bodyMesh);

  const crossV = new THREE.BoxGeometry(0.07, 0.34, 0.07);
  const crossH = new THREE.BoxGeometry(0.24, 0.07, 0.07);
  const crossVMesh = new THREE.Mesh(crossV);
  crossVMesh.position.y = 3.12;
  const crossHMesh = new THREE.Mesh(crossH);
  crossHMesh.position.y = 3.14;
  crossVMesh.name = "kingCross";
  crossHMesh.name = "kingCross";
  group.add(crossVMesh, crossHMesh);

  return group;
}

function init() {
  let width = heroEl.offsetWidth;
  let height = heroEl.offsetHeight;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 2.6, 10.5);
  camera.lookAt(0, 1.1, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /* ---- Lighting: cobalt key light + signal-red rim, dim ambient ---- */
  const ambient = new THREE.AmbientLight(0x1c1c2a, 0.9);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xaebbff, 2.2);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.002;
  scene.add(key);

  const rim = new THREE.PointLight(0xff3b30, 18, 20);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const fill = new THREE.PointLight(0x3a5cff, 10, 18);
  fill.position.set(3, 1.5, 4);
  scene.add(fill);

  /* ---- Floor: catches soft shadows beneath the pieces ---- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.85, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---- Materials ---- */
  const pawnMat = new THREE.MeshStandardMaterial({
    color: 0x131318,
    roughness: 0.32,
    metalness: 0.65,
  });
  const kingMat = new THREE.MeshStandardMaterial({
    color: 0xe9e6dd,
    roughness: 0.28,
    metalness: 0.4,
  });

  /* ---- Build the set: 8 pawns in a row, the king centered behind ---- */
  const pieces = [];
  const pawnGeo = pawnGeometry();

  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(pawnGeo, pawnMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.x = (i - 3.5) * 1.05;
    mesh.position.y = 0;
    mesh.userData.baseY = 0;
    mesh.userData.phase = Math.random() * Math.PI * 2;
    mesh.userData.isPiece = true;
    pieces.push(mesh);
  }

  const king = kingGroup();
  king.traverse((child) => {
    if (child.isMesh) {
      child.material = kingMat;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  king.position.set(0, 0, -1.6);
  king.userData.baseY = 0;
  king.userData.phase = 0;
  king.userData.isPiece = true;
  king.userData.isKing = true;
  pieces.push(king);

  const group = new THREE.Group();
  pieces.forEach((p) => group.add(p));
  scene.add(group);

  /* ---- Interaction: hover highlight + click "hop" via raycasting ---- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  let hovered = null;
  const hopState = new Map();

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  window.addEventListener("mousemove", setPointerFromEvent);
  window.addEventListener("mouseleave", () => {
    pointer.x = -10;
    pointer.y = -10;
  });
  window.addEventListener("click", () => {
    if (!hovered) return;
    hopState.set(hovered, { t: 0 });
  });

  /* ---- Mouse-driven camera parallax ---- */
  let targetX = 0;
  let targetY = 0;
  window.addEventListener("mousemove", (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize() {
    width = heroEl.offsetWidth;
    height = heroEl.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", resize);

  function findRoot(obj) {
    let cur = obj;
    while (cur) {
      if (pieces.includes(cur)) return cur;
      cur = cur.parent;
    }
    return null;
  }

  const clock = new THREE.Clock();

  function animate() {
    const t = clock.getElapsedTime();

    // Slow "display case" turntable, always alive even without input
    group.rotation.y = Math.sin(t * 0.08) * 0.18;

    raycaster.setFromCamera(pointer, camera);
    const targets = pieces.flatMap((p) => (p.isMesh ? [p] : p.children.filter((c) => c.isMesh)));
    const hits = raycaster.intersectObjects(targets, false);
    hovered = hits.length ? findRoot(hits[0].object) : null;

    pieces.forEach((piece) => {
      const bob = Math.sin(t * 1.4 + piece.userData.phase) * 0.04;
      let hop = 0;
      const state = hopState.get(piece);
      if (state) {
        state.t += 0.045;
        hop = Math.sin(Math.min(state.t, 1) * Math.PI) * 0.55;
        if (state.t >= 1) hopState.delete(piece);
      }
      piece.position.y = piece.userData.baseY + bob + hop;

      const targetScale = piece === hovered ? 1.12 : 1;
      const s = piece.scale.x + (targetScale - piece.scale.x) * 0.15;
      piece.scale.set(s, s, s);

      piece.rotation.y += piece.userData.isKing ? 0.002 : 0.004;
    });

    camera.position.x += (targetX * 1.6 - camera.position.x) * 0.03;
    camera.position.y += (2.6 - targetY * 0.8 - camera.position.y) * 0.03;
    camera.lookAt(0, 1.1, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}
