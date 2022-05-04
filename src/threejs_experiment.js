import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Shader1 } from "./fragment1.js";
import { GlowShader } from "./glowShader.js";

// used for resource imports
var projectBaseUrl = "threeJs_atmosphere/";
// Html ref
var canvasId = "background";

// Sphere starting rotation, and position
var rotationMap = { x: 85, y: -163, z: 20 };
const distanceFromCamera = 20;

// WebGl utlity function
function resizeCanvasToDisplaySize(renderer, camera) {
  // Custom bit
  const canvas = renderer.domElement;
  // look up the size the canvas is being displayed
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // adjust displayBuffer size to match
  if (canvas.width !== width || canvas.height !== height) {
    // you must pass false here or three.js sadly fights the browser
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // update any render target sizes here
  }
}

export const loadAnimation = () => {
  document.body.scrollTop = 0;
  const scene = new THREE.Scene();

  var el = document.getElementById(canvasId);
  if (!el) {
    console.error("Exit 0 - getElementById - #" + canvasId);
    return;
  }

  // CAMERA
  var camera = new THREE.PerspectiveCamera(75, 2, 0.1, 1000);

  // RENDERER
  var renderer = new THREE.WebGLRenderer({
    canvas: el,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(el.innerWidth, el.innerHeight);

  // Controls
  const controls = new OrbitControls(camera, el);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;

  // DEBUG GRID
  const gridHelper = new THREE.GridHelper(100, 10);
  scene.add(gridHelper);
  gridHelper.position.set(0, -5, 0);

  var texture = new THREE.TextureLoader().load(projectBaseUrl + "assets/blackearth.jpg");
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(10, 50, 50),
    new THREE.ShaderMaterial({
      uniforms: {
        globeTexture: {
          value: texture,
          scale: { type: "f", value: 1.2 },
        },
      },
      vertexShader: Shader1.vertexShader,
      fragmentShader: Shader1.fragmentShader,
    })
  );

  const glowyShaderMaterial = new THREE.ShaderMaterial({
    vertexShader: GlowShader.vertexShader,
    fragmentShader: GlowShader.fragmentShader,
    uniforms: {
      [GlowShader.params.intensity]: {
        value: 0.8
      }
    },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });

  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(10, 50, 50),
    glowyShaderMaterial
  );
  atmos.scale.set(1.1, 1.1, 1.1);

  scene.add(sphere);
  scene.add(atmos);

  Object.keys(rotationMap).forEach(
    (key) => (sphere.rotation[key] = rotationMap[key] / 90)
  );
  camera.position.z = distanceFromCamera;
  var start = new Date().getTime();
  start *= 0.001;
  var then = 0;
  var introPlayed = false;

  // Main animate loop
  const animate = function (now) {
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;
    // const canvas = document.getElementById("background");
    // if (now > 5 || !canvas) {
    //   introPlayed = true;
    // }

    // Change glow with camera distance on render loop
    const distanceFromCamera = atmos.position.distanceTo(camera.position);
    glowyShaderMaterial.uniforms[GlowShader.params.intensity].value = Math.min( 0.8, Math.abs(
      1 - distanceFromCamera / 40
    ));

    //atmos.uniforms[uniformParams.intensity] = 

    resizeCanvasToDisplaySize(renderer, camera);

    // Rotating intro
    // {
      // if (!introPlayed) {
      //   // 3 units
      //   const target = new THREE.Vector3(0, 0, -distanceFromCamera);
      //   target.applyMatrix4(camera.matrixWorld);

      //   const moveSpeed = 10; // units per second
      //   const distance = sphere.position.distanceTo(target);
      //   if (distance > 0) {
      //     const amount = Math.min(moveSpeed * deltaTime, distance) / distance;
      //     sphere.position.lerp(target, amount);
      //     atmos.position.lerp(target, amount);
      //   } else {
      //     introPlayed = true;
      //   }
      //   sphere.rotation.y += (1 / 360) * 28;
      // }
    // }

    renderer.render(scene, camera);

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
};

// FOnt

// const loader = new FontLoader();
// loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function ( font ) {

//   const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
//   const geometry = new TextGeometry( 'Hello three.js!', {
//     font: font,
//     size: 80,
//     height: 5,
//     curveSegments: 12,
//     bevelEnabled: true,
//     bevelThickness: 10,
//     bevelSize: 8,
//     bevelOffset: 0,
//     bevelSegments: 5
//   });
//   const text = new THREE.Mesh(geometry, material);
//   scene.add(text);
// });
