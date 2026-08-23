import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("field");
const heroEl = document.getElementById("hero");

if (canvas && heroEl && !reduceMotion) {
  init();
}

function init() {
  let width = heroEl.offsetWidth;
  let height = heroEl.offsetHeight;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.z = 9;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  // ---- Point field: a loose volume of drifting points ----
  const COUNT = 900;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const pointsMat = new THREE.PointsMaterial({
    color: 0xf2f0ea,
    size: 0.028,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const pointCloud = new THREE.Points(pointsGeo, pointsMat);
  scene.add(pointCloud);

  // ---- Central wireframe form: an icosahedron, the hero's "object" ----
  const coreGeo = new THREE.IcosahedronGeometry(2.4, 1);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x3a5cff,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  // A second, smaller inner form in the signal-red accent, offset rotation
  const innerGeo = new THREE.OctahedronGeometry(1.1, 0);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xff3b30,
    wireframe: true,
    transparent: true,
    opacity: 0.25,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  scene.add(inner);

  // ---- Mouse-driven parallax ----
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

  const clock = new THREE.Clock();

  function animate() {
    const t = clock.getElapsedTime();

    core.rotation.x = t * 0.06;
    core.rotation.y = t * 0.09;
    inner.rotation.x = -t * 0.1;
    inner.rotation.y = -t * 0.07;
    pointCloud.rotation.y = t * 0.015;

    // Camera parallax toward the cursor, eased
    camera.position.x += (targetX * 1.1 - camera.position.x) * 0.03;
    camera.position.y += (-targetY * 0.7 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}
