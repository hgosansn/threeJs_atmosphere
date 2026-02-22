import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Shader1 } from "./fragment1.js";
import { GlowShader } from "./glowShader.js";
import { createArcPool, updateArcs } from "./arcs.js";
import earthTexture from "./assets/blackearth.jpg";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CANVAS_ID        = "background";
// Start with equator horizontal and center roughly over mid-Atlantic (~lon -30°)
// For longitude L, yaw = -L - 90 (deg). For L = -30 => yaw = -(-30) - 90 = -60
const INITIAL_ROTATION = { x: 0, y: -60, z: 0 }; // degrees
const CAMERA_Z         = 20;
const AUTO_ROTATE_Y    = 0.02;   // rad/s — slow drift
const FPS_CAP          = 60;
const FRAME_MIN_MS     = 1000 / FPS_CAP;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resizeCanvasToDisplaySize(renderer, camera, targetAspect) {
  const canvas = renderer.domElement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Determine canvas size that preserves the target aspect and fits viewport
  let width, height;
  if (vw / vh > targetAspect) {
    // Viewport is wider than target: use full height
    height = vh;
    width = Math.round(height * targetAspect);
  } else {
    // Viewport is narrower or equal: use full width
    width = vw;
    height = Math.round(width / targetAspect);
  }

  if (canvas.width !== width || canvas.height !== height) {
    // Keep the drawing buffer size in sync and set the CSS size so the canvas
    // scales up/down without stretching (preserves aspect ratio).
    renderer.setSize(width, height, false);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function degreesToRadians(deg) {
  return deg * (Math.PI / 180);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export const loadAnimation = () => {
  document.body.scrollTop = 0;

  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    console.error(`Exit 0 — getElementById #${CANVAS_ID}`);
    return;
  }

  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 1000);
  camera.position.z = CAMERA_Z;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Target aspect ratio — preserve the canvas' initial aspect and scale the
  // canvas up/down to fit the viewport without squashing.
  const TARGET_ASPECT = (canvas.clientWidth && canvas.clientHeight)
    ? canvas.clientWidth / canvas.clientHeight
    : window.innerWidth / window.innerHeight;

  // Initial resize to set proper drawing buffer size and CSS size
  resizeCanvasToDisplaySize(renderer, camera, TARGET_ASPECT);

  // Controls — orbit only, no auto-rotate (globe self-rotates)
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;

  // ---------------------------------------------------------------------------
  // Globe
  // ---------------------------------------------------------------------------
  const texture = new THREE.TextureLoader().load(earthTexture);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(10, 50, 50),
    new THREE.ShaderMaterial({
      uniforms: {
        globeTexture: { value: texture },
      },
      vertexShader:   Shader1.vertexShader,
      fragmentShader: Shader1.fragmentShader,
    })
  );

  // Fixed: degrees → radians (was dividing by 90, approximating wrong)
  Object.keys(INITIAL_ROTATION).forEach(
    (axis) => (sphere.rotation[axis] = degreesToRadians(INITIAL_ROTATION[axis]))
  );

  // Atmosphere glow
  const glowyMaterial = new THREE.ShaderMaterial({
    vertexShader:   GlowShader.vertexShader,
    fragmentShader: GlowShader.fragmentShader,
    uniforms: {
      [GlowShader.params.intensity]: { value: 0.8 },
    },
    blending:   THREE.AdditiveBlending,
    side:       THREE.BackSide,
  });

  const atmos = new THREE.Mesh(new THREE.SphereGeometry(10, 50, 50), glowyMaterial);
  atmos.scale.set(1.1, 1.1, 1.1);

  scene.add(sphere);
  scene.add(atmos);

  // ---------------------------------------------------------------------------
  // Arc system — children of sphere, rotate with globe automatically
  // ---------------------------------------------------------------------------
  const arcState = createArcPool(sphere);

  // ---------------------------------------------------------------------------
  // Render loop — capped at 60fps
  // ---------------------------------------------------------------------------
  let lastFrameTime = 0;
  let then          = 0;

  const animate = (timestamp) => {
    requestAnimationFrame(animate);

    // Frame cap
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < FRAME_MIN_MS) return;
    lastFrameTime = timestamp - (elapsed % FRAME_MIN_MS);

    const now = timestamp * 0.001;
    const dt  = Math.min(now - then, 0.1); // clamp dt to avoid spiral of death
    then = now;

    // Auto-rotation — both sphere and atmos keep in sync
    sphere.rotation.y += AUTO_ROTATE_Y * dt;
    atmos.rotation.y   = sphere.rotation.y;

    // Glow intensity — scales with camera proximity
    const dist = atmos.position.distanceTo(camera.position);
    glowyMaterial.uniforms[GlowShader.params.intensity].value =
      Math.min(0.8, Math.abs(1 - dist / 40));

    // Arc lifecycle
    updateArcs(arcState, dt);

    resizeCanvasToDisplaySize(renderer, camera, TARGET_ASPECT);
    controls.update();
    renderer.render(scene, camera);
  };

  requestAnimationFrame(animate);
};
