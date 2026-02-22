import * as THREE from "three";

// ---------------------------------------------------------------------------
// Cities — list of main world cities (lat, lon)
// Any two distinct cities from this list will be randomly paired for arcs
// ---------------------------------------------------------------------------
const CITIES = [
  [40.71, -74.01],    // New York
  [51.51, -0.13],     // London
  [35.68, 139.69],    // Tokyo
  [-33.87, 151.21],   // Sydney
  [48.85, 2.35],      // Paris
  [1.35, 103.82],     // Singapore
  [25.20, 55.27],     // Dubai
  [34.05, -118.24],   // Los Angeles
  [-23.55, -46.63],   // São Paulo
  [55.75, 37.62],     // Moscow
  [22.32, 114.17],    // Hong Kong
  [19.08, 72.88],     // Mumbai
  [6.52, 3.38],       // Lagos
  [-34.60, -58.38],   // Buenos Aires
  [52.52, 13.40],     // Berlin
  [31.23, 121.47],    // Shanghai
  [37.77, -122.42],   // San Francisco
  [43.65, -79.38],    // Toronto
  [30.05, 31.23],     // Cairo
  [-26.20, 28.04],    // Johannesburg
  [37.57, 126.98],    // Seoul
  [41.01, 28.97],     // Istanbul
  [19.43, -99.13],    // Mexico City
  [40.42, -3.70],     // Madrid
  [41.90, 12.49],     // Rome
  [-6.20, 106.82],    // Jakarta
  [13.75, 100.50],    // Bangkok
  [49.28, -123.12],   // Vancouver
  [-37.81, 144.96],   // Melbourne
  [-12.04, -77.03],   // Lima
  [4.71, -74.07],     // Bogotá
  [-33.45, -70.66],   // Santiago
  [47.37, 8.54],      // Zurich
  [52.37, 4.90],      // Amsterdam
  [50.85, 4.35],      // Brussels
  [53.35, -6.26],     // Dublin
  [48.20, 16.37],     // Vienna
  [38.72, -9.14],     // Lisbon
  [50.08, 14.43],     // Prague
  [52.23, 21.01],     // Warsaw
  [60.17, 24.94],     // Helsinki
  [59.91, 10.75],     // Oslo
  [59.33, 18.07],     // Stockholm
  [55.68, 12.57],     // Copenhagen
  [32.08, 34.78],     // Tel Aviv
  [24.71, 46.67],     // Riyadh
  [28.61, 77.20],     // Delhi
  [10.82, 106.63],    // Ho Chi Minh City
];

// All cities for the dot layer (use direct list)
const ALL_CITIES = CITIES;

const SPHERE_RADIUS   = 10;
const ARC_POINTS      = 80;          // curve resolution
const ARC_LIFT        = 1.35;        // control point height multiplier
const GROW_SPEED      = 0.45;        // fraction/s — ~2.2s to fully draw
const HOLD_DURATION   = 1.5;         // seconds arc stays fully drawn
const FADE_SPEED      = 1.2;         // opacity units/s — ~0.67s fade
const SPAWN_INTERVAL  = 0.8;         // seconds between new arc spawns
const POOL_SIZE       = 24;         // max simultaneous arcs (pre-allocated) — adjust as needed
const ARC_COLOR       = 0x00d4ff;
const DOT_COLOR = 0xffff00;
// city marker visual: we'll render small spheres half-buried in the globe
const MARKER_RADIUS   = 0.05;
// legacy point size used by arc start/end pulse markers
const DOT_SIZE        = 0.8;

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------
function latLonToVec3(lat, lon, r = SPHERE_RADIUS) {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function buildArcPoints(from, to) {
  const start = latLonToVec3(...from);
  const end   = latLonToVec3(...to);
  // Control point: midpoint pushed outward above the surface
  const mid   = start.clone().add(end).normalize().multiplyScalar(SPHERE_RADIUS * ARC_LIFT);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(ARC_POINTS); // ARC_POINTS+1 vertices
}

// ---------------------------------------------------------------------------
// Arc pool slot
// ---------------------------------------------------------------------------
class ArcSlot {
  constructor() {
    // Geometry pre-allocated with max points
    const dummyPoints = Array.from({ length: ARC_POINTS + 1 }, () => new THREE.Vector3());
    this.geometry = new THREE.BufferGeometry().setFromPoints(dummyPoints);
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.LineBasicMaterial({
      color:       ARC_COLOR,
      transparent: true,
      opacity:     0.0,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    });

    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;

    // --- per-arc start/end marker (single-point) ---
    const dotGeom = new THREE.BufferGeometry();
    dotGeom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));

    const dotMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time:  { value: 0.0 },
        color: { value: new THREE.Color(DOT_COLOR) },
        size:  { value: DOT_SIZE * 3.0 },
        active:{ value: 0.0 },
      },
      vertexShader: `
        uniform float size;
        uniform float time;
        varying float vPulse;
        void main() {
          vPulse = 0.5 + 0.5 * sin(time * 8.0);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z) * (0.6 + 0.9 * vPulse);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 color;
        uniform float active;
        varying float vPulse;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float r = length(c);
          if (r > 0.5) discard;
          float edge = smoothstep(0.45, 0.5, r);
          float alpha = (1.0 - edge) * (0.7 + 0.6 * vPulse) * active;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    this.startDot = new THREE.Points(dotGeom.clone(), dotMaterial.clone());
    this.endDot   = new THREE.Points(dotGeom.clone(), dotMaterial.clone());
    this.startDot.frustumCulled = false;
    this.endDot.frustumCulled   = false;
    this.startDot.visible = false;
    this.endDot.visible   = false;

    this._reset();
  }

  _reset() {
    this.phase        = 'idle';   // idle | growing | full | fading
    this.drawProgress = 0;
    this.age          = 0;
    this.material.opacity = 0;
    this.geometry.setDrawRange(0, 0);
    if (this.startDot && this.endDot) {
      this.startDot.visible = false;
      this.endDot.visible = false;
      if (this.startDot.material && this.startDot.material.uniforms) this.startDot.material.uniforms.active.value = 0;
      if (this.endDot.material && this.endDot.material.uniforms) this.endDot.material.uniforms.active.value = 0;
    }
  }

  assign(pair) {
    const points = buildArcPoints(pair.from, pair.to);
    // Write new positions into existing buffer — zero alloc
    const posAttr = this.geometry.getAttribute('position');
    points.forEach((p, i) => posAttr.setXYZ(i, p.x, p.y, p.z));
    posAttr.needsUpdate = true;

    this.drawProgress   = 0;
    this.age            = 0;
    this.phase          = 'growing';
    this.material.opacity = 0.9;
    this.geometry.setDrawRange(0, 0);
    // set start/end dot positions (slightly above surface)
    const startPos = latLonToVec3(...pair.from, SPHERE_RADIUS + 0.06);
    const endPos   = latLonToVec3(...pair.to,   SPHERE_RADIUS + 0.06);

    const sAttr = this.startDot.geometry.getAttribute('position');
    sAttr.setXYZ(0, startPos.x, startPos.y, startPos.z);
    sAttr.needsUpdate = true;
    const eAttr = this.endDot.geometry.getAttribute('position');
    eAttr.setXYZ(0, endPos.x, endPos.y, endPos.z);
    eAttr.needsUpdate = true;

    this.startDot.visible = true;
    this.endDot.visible = false;
    if (this.startDot.material.uniforms) this.startDot.material.uniforms.active.value = 1.0;
    if (this.endDot.material.uniforms) this.endDot.material.uniforms.active.value = 0.0;
  }

  update(dt) {
    if (this.phase === 'idle') return;
    this.age += dt;

    if (this.phase === 'growing') {
      this.drawProgress = Math.min(1, this.drawProgress + GROW_SPEED * dt);
      this.geometry.setDrawRange(0, Math.ceil(this.drawProgress * (ARC_POINTS + 1)));
      if (this.drawProgress >= 1) { this.phase = 'full'; this.age = 0; }

    } else if (this.phase === 'full') {
      if (this.age >= HOLD_DURATION) { this.phase = 'fading'; this.age = 0; }

      // when full, pulse arrival dot
      if (this.endDot && this.endDot.material && this.endDot.material.uniforms) {
        this.endDot.visible = true;
        this.endDot.material.uniforms.active.value = 1.0;
      }
    } else if (this.phase === 'fading') {
      this.material.opacity = Math.max(0, 0.9 - FADE_SPEED * this.age);
      if (this.material.opacity <= 0) this._reset();
    }

    // advance marker time uniforms
    if (this.startDot && this.startDot.material && this.startDot.material.uniforms) {
      this.startDot.material.uniforms.time.value += dt;
      // during growing keep start pulsing, otherwise turn it off
      if (this.phase !== 'growing') this.startDot.material.uniforms.active.value = 0.0;
    }
    if (this.endDot && this.endDot.material && this.endDot.material.uniforms) {
      this.endDot.material.uniforms.time.value += dt;
      // end pulses only in 'full' phase
      if (this.phase !== 'full') this.endDot.material.uniforms.active.value = 0.0;
    }
  }

  get idle() { return this.phase === 'idle'; }
}

// ---------------------------------------------------------------------------
// City dot layer — single Points draw call
// ---------------------------------------------------------------------------
function buildCityDots() {
  // Build a small reusable sphere geometry and material, then instance meshes
  const geom = new THREE.SphereGeometry(MARKER_RADIUS, 12, 12);
  const mat  = new THREE.MeshBasicMaterial({
    color: new THREE.Color(DOT_COLOR),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const group = new THREE.Group();
  ALL_CITIES.forEach(([lat, lon]) => {
    // place center so the sphere is half-buried in the globe surface
    const centerRadius = SPHERE_RADIUS - (MARKER_RADIUS * 0.5);
    const v = latLonToVec3(lat, lon, centerRadius);
    const m = new THREE.Mesh(geom, mat);
    m.position.set(v.x, v.y, v.z);
    m.lookAt(new THREE.Vector3(0, 0, 0));
    m.frustumCulled = false;
    group.add(m);
  });

  return group;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function createArcPool(parentObject) {
  const pool        = Array.from({ length: POOL_SIZE }, () => new ArcSlot());
  const cityDots    = buildCityDots();
  let   timeSinceSpawn = SPAWN_INTERVAL; // spawn immediately on first frame

  pool.forEach(slot => parentObject.add(slot.line));
  parentObject.add(cityDots);

  return { pool, cityDots, cities: ALL_CITIES, timeSinceSpawn };
}

export function updateArcs(state, dt) {
  state.timeSinceSpawn += dt;

  if (state.timeSinceSpawn >= SPAWN_INTERVAL) {
    const freeSlot = state.pool.find(s => s.idle);
    if (freeSlot) {
      const cities = state.cities || ALL_CITIES;
      const len = cities.length;
      if (len >= 2) {
        let a = Math.floor(Math.random() * len);
        let b = Math.floor(Math.random() * len);
        while (b === a) b = Math.floor(Math.random() * len);
        freeSlot.assign({ from: cities[a], to: cities[b] });
      }
      state.timeSinceSpawn = 0;
    }
  }

  state.pool.forEach(slot => slot.update(dt));
}
