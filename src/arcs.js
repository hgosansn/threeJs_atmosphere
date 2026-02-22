import * as THREE from "three";

// ---------------------------------------------------------------------------
// City pairs — (lat, lon) source → destination
// ---------------------------------------------------------------------------
const CITY_PAIRS = [
  { from: [40.71, -74.01],  to: [51.51, -0.13]   }, // NYC → London
  { from: [35.68, 139.69],  to: [-33.87, 151.21]  }, // Tokyo → Sydney
  { from: [48.85, 2.35],    to: [40.71, -74.01]   }, // Paris → NYC
  { from: [1.35, 103.82],   to: [25.20, 55.27]    }, // Singapore → Dubai
  { from: [34.05, -118.24], to: [-23.55, -46.63]  }, // LA → São Paulo
  { from: [55.75, 37.62],   to: [22.32, 114.17]   }, // Moscow → Hong Kong
  { from: [19.08, 72.88],   to: [6.52, 3.38]      }, // Mumbai → Lagos
  { from: [-34.60, -58.38], to: [52.52, 13.40]    }, // Buenos Aires → Berlin
  { from: [51.51, -0.13],   to: [31.23, 121.47]   }, // London → Shanghai
  { from: [37.77, -122.42], to: [35.68, 139.69]   }, // San Francisco → Tokyo
];

// All unique cities for the dot layer
const ALL_CITIES = [
  ...new Map(
    CITY_PAIRS.flatMap(({ from, to }) => [
      [from.toString(), from],
      [to.toString(), to],
    ])
  ).values(),
];

const SPHERE_RADIUS   = 10;
const ARC_POINTS      = 80;          // curve resolution
const ARC_LIFT        = 1.35;        // control point height multiplier
const GROW_SPEED      = 0.45;        // fraction/s — ~2.2s to fully draw
const HOLD_DURATION   = 1.5;         // seconds arc stays fully drawn
const FADE_SPEED      = 1.2;         // opacity units/s — ~0.67s fade
const SPAWN_INTERVAL  = 2.8;         // seconds between new arc spawns
const POOL_SIZE       = 6;
const ARC_COLOR       = 0x00d4ff;
const DOT_COLOR       = 0xffd30f;
const DOT_SIZE        = 0.18;

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

    this._reset();
  }

  _reset() {
    this.phase        = 'idle';   // idle | growing | full | fading
    this.drawProgress = 0;
    this.age          = 0;
    this.material.opacity = 0;
    this.geometry.setDrawRange(0, 0);
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

    } else if (this.phase === 'fading') {
      this.material.opacity = Math.max(0, 0.9 - FADE_SPEED * this.age);
      if (this.material.opacity <= 0) this._reset();
    }
  }

  get idle() { return this.phase === 'idle'; }
}

// ---------------------------------------------------------------------------
// City dot layer — single Points draw call
// ---------------------------------------------------------------------------
function buildCityDots() {
  const positions = [];
  ALL_CITIES.forEach(([lat, lon]) => {
    const v = latLonToVec3(lat, lon, SPHERE_RADIUS + 0.05); // just above surface
    positions.push(v.x, v.y, v.z);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color:      DOT_COLOR,
    size:       DOT_SIZE,
    sizeAttenuation: true,
    blending:   THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity:    0.9,
  });

  return new THREE.Points(geometry, material);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function createArcPool(parentObject) {
  const pool        = Array.from({ length: POOL_SIZE }, () => new ArcSlot());
  const cityDots    = buildCityDots();
  let   pairIndex   = 0;
  let   timeSinceSpawn = SPAWN_INTERVAL; // spawn immediately on first frame

  pool.forEach(slot => parentObject.add(slot.line));
  parentObject.add(cityDots);

  return { pool, cityDots, pairIndex, timeSinceSpawn };
}

export function updateArcs(state, dt) {
  state.timeSinceSpawn += dt;

  if (state.timeSinceSpawn >= SPAWN_INTERVAL) {
    const freeSlot = state.pool.find(s => s.idle);
    if (freeSlot) {
      freeSlot.assign(CITY_PAIRS[state.pairIndex % CITY_PAIRS.length]);
      state.pairIndex++;
      state.timeSinceSpawn = 0;
    }
  }

  state.pool.forEach(slot => slot.update(dt));
}
