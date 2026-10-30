import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Ashen Hill — a foggy survival-horror game for mobile browsers.
// Everything (textures, sounds, models) is generated procedurally at runtime.
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// Seeded RNG so the town layout is the same every run.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1999);

// ---------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const FOG_COLOR = 0x8d8c86;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.085);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 70);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xbdbcb4, 0x2b2722, 1.1));

const flashlight = new THREE.SpotLight(0xfff0cf, 9, 26, Math.PI / 6.5, 0.55, 1);
flashlight.position.set(0.25, -0.15, 0.1);
flashlight.target.position.set(0, -0.1, -1);
camera.add(flashlight, flashlight.target);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// Procedural textures
// ---------------------------------------------------------------------------
function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function noise(g, s, base, spread, count) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < count; i++) {
    const v = (rand() - 0.5) * spread;
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`;
    g.fillRect(rand() * s, rand() * s, 1 + rand() * 3, 1 + rand() * 3);
  }
}
function stains(g, s, n, color) {
  for (let i = 0; i < n; i++) {
    const x = rand() * s, y = rand() * s, r = 10 + rand() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const asphaltTex = canvasTexture(512, (g, s) => {
  noise(g, s, '#3d3c39', 0.25, 9000);
  stains(g, s, 14, 'rgba(20,16,12,.35)');
  g.strokeStyle = 'rgba(15,14,12,.7)'; g.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    let x = rand() * s, y = rand() * s; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (rand() - 0.5) * 50; y += (rand() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
}, 40);

const sidewalkTex = canvasTexture(256, (g, s) => {
  noise(g, s, '#6b6862', 0.2, 3000);
  g.strokeStyle = 'rgba(30,28,25,.6)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * s / 4, 0); g.lineTo(i * s / 4, s); g.stroke();
    g.beginPath(); g.moveTo(0, i * s / 4); g.lineTo(s, i * s / 4); g.stroke(); }
  stains(g, s, 6, 'rgba(40,30,20,.35)');
});

function wallTexture(base, windowStyle) {
  return canvasTexture(256, (g, s) => {
    noise(g, s, base, 0.18, 4000);
    stains(g, s, 5, 'rgba(30,22,16,.35)');
    // windows
    const wx = 64, wy = 70, ww = 128, wh = 110;
    g.fillStyle = '#2a2a2a'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
    if (windowStyle === 'boarded') {
      g.fillStyle = '#4e3a28'; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#6a5038';
      for (let i = 0; i < 4; i++) { g.save(); g.translate(s / 2, wy + 15 + i * 26); g.rotate((rand() - 0.5) * 0.25);
        g.fillRect(-ww / 2 - 8, -9, ww + 16, 18); g.restore(); }
    } else {
      const grd = g.createLinearGradient(0, wy, 0, wy + wh);
      grd.addColorStop(0, '#16181a'); grd.addColorStop(1, '#0b0c0d');
      g.fillStyle = grd; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#2a2a2a'; g.fillRect(s / 2 - 3, wy, 6, wh); g.fillRect(wx, wy + wh / 2 - 3, ww, 6);
      if (windowStyle === 'broken') {
        g.strokeStyle = 'rgba(200,200,200,.25)'; g.lineWidth = 1;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(wx + 30, wy + 30);
          g.lineTo(wx + rand() * ww, wy + rand() * wh); g.stroke(); }
      }
    }
    // rust drips under the window
    g.fillStyle = 'rgba(90,40,20,.35)';
    for (let i = 0; i < 6; i++) g.fillRect(wx + rand() * ww, wy + wh + 6, 2 + rand() * 3, 20 + rand() * 60);
  });
}
const wallTexes = [
  wallTexture('#7b766c', 'dark'),
  wallTexture('#6e6359', 'boarded'),
  wallTexture('#857f74', 'broken'),
  wallTexture('#5d5a55', 'dark'),
];

const fenceTex = canvasTexture(128, (g, s) => {
  g.clearRect(0, 0, s, s);
  g.strokeStyle = 'rgba(70,68,62,1)'; g.lineWidth = 3;
  for (let i = -s; i < s * 2; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke();
    g.beginPath(); g.moveTo(i + s, 0); g.lineTo(i, s); g.stroke();
  }
});

// Grain overlay (CSS) from a noise canvas.
{
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'); const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  $('grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

// Box geometry whose UVs are scaled in world units (1 texture tile = `tile` meters).
function boxUV(w, h, d, tile = 4) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return geo;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
const colliders = []; // axis-aligned boxes {x0,x1,z0,z1}
const addCollider = (cx, cz, w, d) => colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
const BOUND = 61.5;
const CELL = 24;

const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...o });

const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat({ map: asphaltTex }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Road markings (dashed center lines)
{
  const lineMat = mat({ color: 0xa89f7e });
  const dash = new THREE.PlaneGeometry(0.15, 1.6);
  const roads = [-60, -36, -12, 12, 36];
  for (const r of roads.slice(1)) for (let t = -58; t < 58; t += 4) {
    const a = new THREE.Mesh(dash, lineMat); a.rotation.x = -Math.PI / 2; a.position.set(r, 0.01, t); scene.add(a);
    const b = new THREE.Mesh(dash, lineMat); b.rotation.x = -Math.PI / 2; b.rotation.z = Math.PI / 2; b.position.set(t, 0.01, r); scene.add(b);
  }
}

const sidewalkMat = mat({ map: sidewalkTex });
const wallMats = wallTexes.map((t) => mat({ map: t }));
const roofMat = mat({ color: 0x2f2d2a });

// Cell types: building by default; some special open cells.
const special = {
  '0,0': 'plaza',
  '-2,1': 'parking',
  '2,2': 'lot',
  '-1,-2': 'lot',
  '1,-1': 'park',
};

function addBuilding(cx, cz) {
  const w = 13 + rand() * 3, d = 13 + rand() * 3, h = 6 + Math.floor(rand() * 4) * 4;
  const m = new THREE.Mesh(boxUV(w, h, d), [wallMats[(rand() * 4) | 0], wallMats[(rand() * 4) | 0], roofMat, roofMat, wallMats[(rand() * 4) | 0], wallMats[(rand() * 4) | 0]]);
  m.position.set(cx, h / 2, cz); scene.add(m);
  addCollider(cx, cz, w, d);
  // rooftop clutter
  if (rand() > 0.4) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 8), mat({ color: 0x3a3632 }));
    tank.position.set(cx + (rand() - 0.5) * w * 0.6, h + 1.1, cz + (rand() - 0.5) * d * 0.6); scene.add(tank);
  }
  // door
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), mat({ color: 0x2a1d16 }));
  const side = (rand() * 4) | 0;
  const off = [[0, d / 2 + 0.01, 0], [0, -d / 2 - 0.01, Math.PI], [w / 2 + 0.01, 0, Math.PI / 2], [-w / 2 - 0.01, 0, -Math.PI / 2]][side];
  door.position.set(cx + off[0], 1.2, cz + off[1]); door.rotation.y = off[2]; scene.add(door);
}

function addDeadTree(x, z) {
  const barkMat = mat({ color: 0x2b241e });
  const g = new THREE.Group();
  const h = 3 + rand() * 2.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, h, 5), barkMat);
  trunk.position.y = h / 2; g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const l = 1 + rand() * 1.5;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, l, 4), barkMat);
    b.position.y = h * (0.55 + rand() * 0.4);
    b.rotation.z = (rand() - 0.5) * 2.2; b.rotation.y = rand() * 6;
    b.translateY(l / 2); g.add(b);
  }
  g.position.set(x, 0, z); scene.add(g);
  addCollider(x, z, 0.5, 0.5);
}

function addCar(x, z, rotY) {
  const colors = [0x3b2a26, 0x2c3236, 0x4a4438, 0x27302a, 0x5a2a22];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 4.2), mat({ color: colors[(rand() * colors.length) | 0], roughness: 0.8 }));
  body.position.y = 0.6; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), mat({ color: 0x141618, roughness: 0.4 }));
  cab.position.set(0, 1.3, -0.2); g.add(cab);
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 10); const wMat = mat({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
    const w = new THREE.Mesh(wheelGeo, wMat); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.35, wz); g.add(w);
  }
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  const sideways = Math.abs(Math.sin(rotY)) > 0.5;
  addCollider(x, z, sideways ? 4.2 : 1.9, sideways ? 1.9 : 4.2);
}

function addBench(x, z, rotY) {
  const g = new THREE.Group(); const m = mat({ color: 0x3a2c20 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.5), m); seat.position.y = 0.5; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.08), m); back.position.set(0, 0.8, -0.22); g.add(back);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
}

for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
  const cx = i * CELL, cz = j * CELL;
  const type = special[`${i},${j}`];
  const slab = new THREE.Mesh(boxUV(16.5, 0.15, 16.5, 4), sidewalkMat);
  slab.position.set(cx, 0.075, cz); scene.add(slab);
  if (!type) { addBuilding(cx, cz); continue; }
  if (type === 'plaza') {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 20), mat({ color: 0x6f6b63 }));
    basin.position.set(cx, 0.35, cz); scene.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), mat({ color: 0x1d1a14, roughness: 0.2 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.6, cz); scene.add(water);
    const statue = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.6, 8), mat({ color: 0x55524b }));
    statue.position.set(cx, 1.3, cz); scene.add(statue);
    addCollider(cx, cz, 5.4, 5.4);
    addBench(cx - 5, cz, Math.PI / 2); addBench(cx + 5, cz, -Math.PI / 2);
    addDeadTree(cx - 6, cz - 6); addDeadTree(cx + 6, cz + 6); addDeadTree(cx + 6, cz - 6);
  } else if (type === 'parking') {
    for (let k = 0; k < 5; k++) if (rand() > 0.25) addCar(cx - 6 + k * 3, cz - 4, 0);
    for (let k = 0; k < 4; k++) if (rand() > 0.4) addCar(cx - 5 + k * 3.2, cz + 4.5, Math.PI);
  } else if (type === 'lot') {
    for (let k = 0; k < 5; k++) addDeadTree(cx + (rand() - 0.5) * 13, cz + (rand() - 0.5) * 13);
  } else if (type === 'park') {
    for (let k = 0; k < 8; k++) addDeadTree(cx + (rand() - 0.5) * 14, cz + (rand() - 0.5) * 14);
    addBench(cx, cz + 3, 0);
  }
}

// Abandoned cars on the streets
addCar(-33, 50, 0.2); addCar(14, 20, Math.PI + 0.1); addCar(-10, -30, 0.05);
addCar(30, -12, Math.PI / 2 + 0.2); addCar(-20, 12, Math.PI / 2 - 0.15); addCar(39, 30, 0.1);

// Street lamps (emissive heads only — no real lights, for mobile performance)
const lampHeads = [];
{
  const poleMat = mat({ color: 0x23211e });
  const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
  for (const r of [-36, -12, 12, 36]) for (let t = -54; t <= 54; t += 18) {
    for (const [x, z] of [[r + 3.8, t], [t, r - 3.8]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.5, 6), poleMat);
      pole.position.set(x, 2.25, z); scene.add(pole);
      const hm = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
      const head = new THREE.Mesh(headGeo, hm); head.position.set(x, 4.5, z); scene.add(head);
      lampHeads.push({ m: hm, phase: rand() * 100, dead: rand() < 0.35 });
    }
  }
}

// Perimeter chain-link fence
{
  const fm = new THREE.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 });
  fenceTex.repeat.set(30, 1);
  const L = BOUND * 2 + 1;
  for (const [x, z, ry] of [[0, -BOUND - 0.4, 0], [0, BOUND + 0.4, 0], [-BOUND - 0.4, 0, Math.PI / 2], [BOUND + 0.4, 0, Math.PI / 2]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(L, 3), fm); f.position.set(x, 1.5, z); f.rotation.y = ry; scene.add(f);
  }
}

// North gate — the exit
const GATE = new THREE.Vector3(36, 0, -60.5);
const gate = new THREE.Group();
{
  const barMat = mat({ color: 0x3a1f18, metalness: 0.4, roughness: 0.7 });
  for (let k = -3.5; k <= 3.5; k += 0.5) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 4), barMat); bar.position.set(k, 2, 0); gate.add(bar);
  }
  for (const y of [0.3, 2, 3.8]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.12, 0.12), barMat); rail.position.y = y; gate.add(rail); }
  for (const x of [-4, 4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), mat({ color: 0x4a4740 })); p.position.set(x, 2.5, 0); gate.add(p); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.9), new THREE.MeshBasicMaterial({
    map: canvasTexture(256, (g, s) => {
      g.fillStyle = '#2b1410'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#d6c9a8'; g.font = 'bold 44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('EXIT', s / 2, s / 2);
    }), fog: true,
  }));
  sign.scale.y = 1; sign.position.set(0, 4.6, 0.3); gate.add(sign);
  gate.position.copy(GATE); scene.add(gate);
  addCollider(GATE.x, GATE.z, 8, 0.8);
}

// Falling ash
const ashCount = isTouch ? 500 : 900;
const ashGeo = new THREE.BufferGeometry();
const ashPos = new Float32Array(ashCount * 3);
for (let i = 0; i < ashCount; i++) { ashPos[i * 3] = (Math.random() - 0.5) * 30; ashPos[i * 3 + 1] = Math.random() * 12; ashPos[i * 3 + 2] = (Math.random() - 0.5) * 30; }
ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: 0xdedad0, size: 0.06, transparent: true, opacity: 0.8 }));
ash.frustumCulled = false;
scene.add(ash);

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
const pickups = [];
function makeKey() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xc9a24a, emissive: 0x6a4a10, metalness: 0.8, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 14), m); ring.position.y = 0.2; g.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), m); g.add(shaft);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), m); tooth.position.set(0.05, -0.12, 0); g.add(tooth);
  const glow = new THREE.PointLight(0xffc860, 2.5, 5, 1); g.add(glow);
  return g;
}
function makeHealth() {
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 10), mat({ color: 0xd8d2c4, emissive: 0x220000 }));
  g.add(can);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.08, 10), mat({ color: 0xa3241c, emissive: 0x300000 }));
  g.add(band);
  return g;
}
const KEY_SPOTS = [
  { pos: [3.8, 0, 0], note: 'وجدتَ مفتاحًا صدئًا بجانب النافورة… منقوش عليه "١".' },
  { pos: [-50.5, 0, 24], note: 'مفتاح عالق تحت مساحة زجاج سيارة مهجورة. "٢".' },
  { pos: [46, 0, 50], note: 'مفتاح مدفون في الرماد بين الأشجار الميتة. "٣".' },
];
const HEALTH_SPOTS = [[-36, 20], [12, 44], [-12, -40], [36, 4], [-24, -12], [24, -36], [-48, -36], [0, 26]];

function resetPickups() {
  for (const p of pickups) scene.remove(p.obj);
  pickups.length = 0;
  KEY_SPOTS.forEach((k) => {
    const o = makeKey(); o.position.set(k.pos[0], 0.9, k.pos[2]); scene.add(o);
    pickups.push({ type: 'key', obj: o, note: k.note, taken: false });
  });
  HEALTH_SPOTS.forEach(([x, z]) => {
    const o = makeHealth(); o.position.set(x, 0.3, z); scene.add(o);
    pickups.push({ type: 'health', obj: o, taken: false });
  });
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------
const fleshMat = mat({ color: 0x5b3c35 });
const darkMat = mat({ color: 0x2a1c19 });
function makeMonster() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), fleshMat); torso.position.y = 1.25; g.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.3), darkMat); hips.position.y = 0.75; g.add(hips);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), fleshMat); head.scale.set(0.8, 1.35, 0.9); head.position.y = 1.9; g.add(head);
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };
  const limb = (parent, w, l, m) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, l, w), m); mesh.position.y = -l / 2; parent.add(mesh); return mesh; };
  const armL = pivot(-0.36, 1.65), armR = pivot(0.36, 1.65);
  limb(armL, 0.12, 1.05, fleshMat); limb(armR, 0.12, 1.05, fleshMat);
  const legL = pivot(-0.14, 0.7), legR = pivot(0.14, 0.7);
  limb(legL, 0.16, 0.7, darkMat); limb(legR, 0.16, 0.7, darkMat);
  armL.rotation.x = armR.rotation.x = -0.25;
  scene.add(g);
  return { g, head, armL, armR, legL, legR, torso };
}

const monsters = [];
function spawnMonster(far = true) {
  for (let tries = 0; tries < 40; tries++) {
    const roads = [-60, -36, -12, 12, 36, 59];
    const onX = rand() > 0.5;
    const r = roads[(rand() * roads.length) | 0];
    const t = (rand() - 0.5) * 110;
    const x = onX ? r : t, z = onX ? t : r;
    if (Math.abs(x) > BOUND || Math.abs(z) > BOUND) continue;
    if (far && Math.hypot(x - player.pos.x, z - player.pos.z) < 22) continue;
    const parts = makeMonster();
    parts.g.position.set(x, 0, z);
    monsters.push({ ...parts, pos: parts.g.position, hp: 3, state: 'wander', dir: rand() * Math.PI * 2, turnT: 0, cd: 0,
      flash: 0, walk: rand() * 10, deadT: 0, growled: false, twitch: 0 });
    return;
  }
}

// ---------------------------------------------------------------------------
// Player + weapon
// ---------------------------------------------------------------------------
const START = new THREE.Vector3(-36, 0, 57);
const player = { pos: START.clone(), yaw: 0, pitch: 0, hp: 100, keys: 0, atkCd: 0, swing: 0, bob: 0, shake: 0,
  kills: 0, time: 0, light: true, running: false };

const pipe = new THREE.Group();
{
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 6), mat({ color: 0x55504a, metalness: 0.7, roughness: 0.5 }));
  p.position.y = 0.42; pipe.add(p);
  const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 6), mat({ color: 0x3e3a35, metalness: 0.7 }));
  elbow.position.y = 0.88; elbow.rotation.z = Math.PI / 2; pipe.add(elbow);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), mat({ color: 0x8a6a55 }));
  hand.position.y = 0.02; pipe.add(hand);
}
pipe.position.set(0.38, -0.42, -0.55);
camera.add(pipe);

// ---------------------------------------------------------------------------
// Audio (Web Audio, fully synthesized)
// ---------------------------------------------------------------------------
let ac = null, staticGain = null, droneGain = null, master = null;
function initAudio() {
  if (ac) { ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
  // radio static
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() > 0.97 ? 1 : 0.5);
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.6;
  staticGain = ac.createGain(); staticGain.gain.value = 0;
  src.connect(bp).connect(staticGain).connect(master); src.start();
  // low ambient drone
  droneGain = ac.createGain(); droneGain.gain.value = 0.07;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
  for (const f of [43.6, 44.1, 65.4]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.07; const lfoG = ac.createGain(); lfoG.gain.value = 60;
  lfo.connect(lfoG).connect(lp.frequency); lfo.start();
  lp.connect(droneGain).connect(master);
}
function noiseBurst(dur, freq, vol) {
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(master); s.start();
}
function tone(type, f0, f1, dur, vol) {
  if (!ac) return;
  const o = ac.createOscillator(); o.type = type; const g = ac.createGain(); const t = ac.currentTime;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  swing: () => noiseBurst(0.18, 1800, 0.25),
  hit: () => { noiseBurst(0.12, 600, 0.9); tone('square', 120, 50, 0.15, 0.25); },
  hurt: () => { noiseBurst(0.25, 400, 1); tone('sawtooth', 90, 40, 0.4, 0.3); },
  growl: (vol = 0.25) => { tone('sawtooth', 70 + Math.random() * 30, 35, 1.1, vol); tone('square', 55, 30, 1.2, vol * 0.5); },
  key: () => { tone('sine', 880, 1320, 0.6, 0.25); setTimeout(() => tone('sine', 660, 990, 0.9, 0.2), 180); },
  heal: () => tone('triangle', 400, 800, 0.4, 0.2),
  step: () => noiseBurst(0.06, 300 + Math.random() * 200, 0.12),
  locked: () => { noiseBurst(0.2, 900, 0.6); tone('square', 200, 180, 0.2, 0.15); },
  die: () => { tone('sawtooth', 200, 30, 2.5, 0.4); noiseBurst(1.5, 300, 0.8); },
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const input = { f: 0, s: 0, run: false, keys: {} };
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, x: 0, y: 0 };
const LOOK_SENS = 0.0055;

const joyBase = $('joyBase'), joyKnob = $('joyKnob');
$('touch').addEventListener('pointerdown', (e) => {
  if (e.target.tagName === 'BUTTON') return;
  e.preventDefault();
  if (e.clientX < innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
    joyBase.style.left = `${e.clientX - 60}px`; joyBase.style.top = `${e.clientY - 60}px`; joyBase.style.bottom = 'auto';
    joyBase.style.opacity = 1;
  } else if (look.id === null) {
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
  }
});
addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), max = 55;
    if (l > max) { dx *= max / l; dy *= max / l; }
    joy.x = dx / max; joy.y = dy / max;
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (e.pointerId === look.id) {
    player.yaw -= (e.clientX - look.x) * LOOK_SENS;
    player.pitch -= (e.clientY - look.y) * LOOK_SENS;
    look.x = e.clientX; look.y = e.clientY;
  }
}, { passive: false });
const endPointer = (e) => {
  if (e.pointerId === joy.id) {
    joy.id = null; joy.x = joy.y = 0; joyKnob.style.transform = '';
    joyBase.style.left = '40px'; joyBase.style.top = 'auto'; joyBase.style.bottom = '40px'; joyBase.style.opacity = '';
  }
  if (e.pointerId === look.id) look.id = null;
};
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);

const holdBtn = (el, down, up) => {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('active'); down(); });
  const off = () => { el.classList.remove('active'); up && up(); };
  el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
};
holdBtn($('attackBtn'), () => attack());
holdBtn($('lightBtn'), () => toggleLight());
holdBtn($('runBtn'), () => { input.run = true; }, () => { input.run = false; });

// Desktop: keyboard + pointer lock mouse
addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyF') toggleLight();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pauseGame(); }
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
const canvas = $('game');
canvas.addEventListener('mousedown', () => {
  if (state !== 'play' || isTouch) return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  else attack();
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && state === 'play') {
    player.yaw -= e.movementX * 0.0025; player.pitch -= e.movementY * 0.0025;
  }
});

// ---------------------------------------------------------------------------
// Game logic
// ---------------------------------------------------------------------------
let state = 'menu';
const forward = new THREE.Vector3();

function toggleLight() {
  if (state !== 'play') return;
  player.light = !player.light;
  $('lightBtn').setAttribute('aria-pressed', String(player.light));
  tone('square', 1500, 1400, 0.03, 0.1);
}

function attack() {
  if (state !== 'play' || player.atkCd > 0) return;
  player.atkCd = 0.55; player.swing = 1; sfx.swing();
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  setTimeout(() => {
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const dx = m.pos.x - player.pos.x, dz = m.pos.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.5) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.55) continue;
      m.hp -= 1; m.flash = 0.2; m.state = 'chase'; m.stun = 0.5;
      m.pos.x += (dx / d) * 0.9; m.pos.z += (dz / d) * 0.9;
      sfx.hit(); player.shake = 0.15;
      if (m.hp <= 0) { m.deadT = 0; player.kills++; sfx.growl(0.35); }
      break;
    }
  }, 140);
}

function collide(p, r) {
  for (const b of colliders) {
    const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
      else { // inside the box: push out along the shortest axis
        const opts = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]];
        opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
        p.x += opts[0][0]; p.z += opts[0][1];
      }
    }
  }
  p.x = Math.max(-BOUND, Math.min(BOUND, p.x)); p.z = Math.max(-BOUND, Math.min(BOUND, p.z));
}

let msgTimer = null;
function showMsg(text, dur = 3500) {
  const el = $('message'); el.textContent = text; el.classList.add('show');
  clearTimeout(msgTimer); msgTimer = setTimeout(() => el.classList.remove('show'), dur);
}
function updateHUD() {
  $('healthFill').style.width = `${Math.max(0, player.hp)}%`;
  $('keyCount').textContent = player.keys;
  $('objective').textContent = player.keys < 3
    ? `ابحث عن المفاتيح الثلاثة (${player.keys}/3)`
    : 'لديك كل المفاتيح — اذهب إلى البوابة الشمالية';
}
function hurt(amount) {
  player.hp -= amount; player.shake = 0.35; sfx.hurt();
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = 1;
  requestAnimationFrame(() => { h.style.transition = 'opacity .8s'; h.style.opacity = player.hp < 35 ? 0.45 : 0; });
  updateHUD();
  if (player.hp <= 0) endGame(false);
}

function currentTarget() {
  if (player.keys >= 3) return GATE;
  let best = null, bd = Infinity;
  for (const p of pickups) if (p.type === 'key' && !p.taken) {
    const d = p.obj.position.distanceTo(player.pos); if (d < bd) { bd = d; best = p.obj.position; }
  }
  return best;
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function endGame(won) {
  state = won ? 'win' : 'dead';
  document.exitPointerLock?.();
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
  if (won) {
    $('winStats').textContent = `هربتَ من تلّ الرماد في ${fmtTime(player.time)} وهزمتَ ${player.kills} من المخلوقات. لكن الضباب لا ينسى…`;
    $('win').classList.remove('hidden');
    tone('sine', 440, 660, 2, 0.2);
  } else {
    $('deadStats').textContent = `صمدتَ ${fmtTime(player.time)} · المفاتيح: ${player.keys}/3 · المخلوقات: ${player.kills}`;
    $('dead').classList.remove('hidden');
    sfx.die();
  }
  if (staticGain) staticGain.gain.value = 0;
}

function resetGame() {
  for (const m of monsters) scene.remove(m.g);
  monsters.length = 0;
  Object.assign(player, { hp: 100, keys: 0, yaw: 0, pitch: 0, atkCd: 0, swing: 0, shake: 0, kills: 0, time: 0, light: true });
  $('lightBtn').setAttribute('aria-pressed', 'true');
  player.pos.copy(START);
  resetPickups();
  for (let i = 0; i < 7; i++) spawnMonster(true);
  updateHUD();
}

function startGame() {
  initAudio();
  if (isTouch) {
    document.documentElement.requestFullscreen?.().catch(() => {});
    screen.orientation?.lock?.('landscape').catch(() => {});
  }
  ['menu', 'dead', 'win', 'pause'].forEach((id) => $(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');
  if (isTouch) $('touch').classList.remove('hidden');
  state = 'play';
  setTimeout(() => showMsg('الضباب كثيف… الراديو يلتقط تشويشًا عندما يقترب شيء.', 5000), 600);
}
function pauseGame() {
  state = 'paused'; document.exitPointerLock?.();
  $('pause').classList.remove('hidden');
  if (staticGain) staticGain.gain.value = 0;
  ac?.suspend();
}

$('startBtn').onclick = () => { resetGame(); startGame(); };
$('resumeBtn').onclick = () => { ac?.resume(); startGame(); };
['restartBtn1', 'restartBtn2', 'restartBtn3'].forEach((id) => { $(id).onclick = () => { ac?.resume(); resetGame(); startGame(); }; });
$('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); if (state === 'play') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); });

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let stepAcc = 0, respawnT = 0, gateMsgCd = 0, t = 0;

function update(dt) {
  t += dt;
  player.time += dt;
  player.atkCd = Math.max(0, player.atkCd - dt);
  gateMsgCd = Math.max(0, gateMsgCd - dt);

  // --- movement input
  let f = -joy.y, s = joy.x;
  const k = input.keys;
  if (k.KeyW || k.ArrowUp) f = 1; if (k.KeyS || k.ArrowDown) f = -1;
  if (k.KeyA || k.ArrowLeft) s = -1; if (k.KeyD || k.ArrowRight) s = 1;
  const running = input.run || k.ShiftLeft || k.ShiftRight;
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const speed = running ? 5.2 : 3.0;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  player.pos.x += (-sy * f + cy * s) * speed * dt;
  player.pos.z += (-cy * f - sy * s) * speed * dt;
  collide(player.pos, 0.35);

  const moving = Math.hypot(f, s) > 0.1;
  if (moving) {
    player.bob += dt * (running ? 12 : 8);
    stepAcc += dt * (running ? 2.6 : 1.8);
    if (stepAcc > 1) { stepAcc = 0; sfx.step(); }
  }

  player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
  player.shake = Math.max(0, player.shake - dt);
  const sh = player.shake * 0.25;
  camera.position.set(player.pos.x + (Math.random() - 0.5) * sh, 1.62 + Math.sin(player.bob) * 0.045 + (Math.random() - 0.5) * sh, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  camera.rotation.z = 0;

  // --- weapon swing animation
  player.swing = Math.max(0, player.swing - dt * 3.2);
  const sw = Math.sin(player.swing * Math.PI);
  pipe.rotation.set(-0.35 - sw * 1.6, 0.2, -0.35 + sw * 0.9);
  pipe.position.set(0.38 - sw * 0.25, -0.42 + Math.sin(player.bob) * 0.02, -0.55);

  // --- flashlight with occasional flicker
  const flick = Math.random() < 0.012 ? 0.15 : 1;
  flashlight.intensity = player.light ? 9 * flick : 0;
  scene.fog.density = player.light ? 0.085 : 0.11;

  // --- lamp flicker
  for (const l of lampHeads) {
    const on = !l.dead && Math.sin(t * 7 + l.phase) + Math.sin(t * 13.3 + l.phase * 2) > -1.6;
    l.m.color.setHex(on ? 0xffe6a8 : 0x3a3326);
  }

  // --- ash
  const a = ashGeo.attributes.position.array;
  for (let i = 0; i < ashCount; i++) {
    a[i * 3 + 1] -= dt * (0.4 + (i % 7) * 0.05);
    a[i * 3] += Math.sin(t + i) * dt * 0.15;
    if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 12;
  }
  ashGeo.attributes.position.needsUpdate = true;
  // keep the ash box centred on the player by wrapping particles
  for (let i = 0; i < ashCount; i++) {
    const wx = a[i * 3] - player.pos.x, wz = a[i * 3 + 2] - player.pos.z;
    if (wx > 15) a[i * 3] -= 30; else if (wx < -15) a[i * 3] += 30;
    if (wz > 15) a[i * 3 + 2] -= 30; else if (wz < -15) a[i * 3 + 2] += 30;
  }

  // --- pickups
  for (const p of pickups) {
    if (p.taken) continue;
    p.obj.rotation.y += dt * 1.5;
    if (p.type === 'key') p.obj.position.y = 0.9 + Math.sin(t * 2) * 0.08;
    const d = Math.hypot(p.obj.position.x - player.pos.x, p.obj.position.z - player.pos.z);
    if (d < 1.2) {
      if (p.type === 'health' && player.hp >= 100) continue;
      p.taken = true; scene.remove(p.obj);
      if (p.type === 'key') {
        player.keys++; sfx.key(); showMsg(p.note, 4500);
        // the town reacts: more monsters wake up
        for (let i = 0; i < 2; i++) spawnMonster(true);
        if (player.keys === 3) setTimeout(() => showMsg('سمعتَ صوت قفل يُفتح بعيدًا… نحو الشمال.', 4000), 4600);
      } else {
        player.hp = Math.min(100, player.hp + 35); sfx.heal(); showMsg('شربتَ مشروبًا صحيًا. +35');
        $('hurt').style.opacity = player.hp < 35 ? 0.45 : 0;
      }
      updateHUD();
    }
  }

  // --- gate
  const gd = Math.hypot(GATE.x - player.pos.x, GATE.z - player.pos.z);
  if (gd < 3.2) {
    if (player.keys >= 3) { endGame(true); return; }
    if (gateMsgCd === 0) { sfx.locked(); showMsg(`البوابة مقفلة بثلاثة أقفال… تحتاج ${3 - player.keys} مفتاح/مفاتيح أخرى.`); gateMsgCd = 4; }
  }

  // --- monsters
  let nearest = Infinity;
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (m.hp <= 0) {
      m.deadT += dt;
      m.g.rotation.x = Math.max(-Math.PI / 2, -m.deadT * 4);
      m.g.position.y = m.deadT > 2 ? -(m.deadT - 2) * 0.4 : 0;
      if (m.deadT > 5) { scene.remove(m.g); monsters.splice(i, 1); }
      continue;
    }
    const dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z, d = Math.hypot(dx, dz);
    nearest = Math.min(nearest, d);
    m.cd = Math.max(0, m.cd - dt);
    m.stun = Math.max(0, (m.stun || 0) - dt);

    const senseRange = player.light ? 15 : 8;
    if (d < senseRange || (m.state === 'chase' && d < 26)) {
      if (m.state !== 'chase' && !m.growled) { sfx.growl(Math.max(0.05, 0.3 - d * 0.015)); m.growled = true; }
      m.state = 'chase';
    } else if (m.state === 'chase') { m.state = 'wander'; m.growled = false; }

    let vx = 0, vz = 0, spd = 0;
    if (m.stun > 0) spd = 0;
    else if (m.state === 'chase') {
      vx = dx / d; vz = dz / d; spd = d < 1.3 ? 0 : 2.35 + player.keys * 0.25;
      if (d < 1.5 && m.cd === 0) { m.cd = 1.3; hurt(14 + player.keys * 2); if (state !== 'play') return; }
    } else {
      m.turnT -= dt;
      if (m.turnT <= 0) { m.dir = Math.random() * Math.PI * 2; m.turnT = 2 + Math.random() * 4; }
      vx = Math.sin(m.dir); vz = Math.cos(m.dir); spd = 0.7;
    }
    // separation
    for (const o of monsters) if (o !== m && o.hp > 0) {
      const ox = m.pos.x - o.pos.x, oz = m.pos.z - o.pos.z, od = Math.hypot(ox, oz);
      if (od < 0.9 && od > 0.01) { m.pos.x += (ox / od) * dt; m.pos.z += (oz / od) * dt; }
    }
    const px = m.pos.x, pz = m.pos.z;
    m.pos.x += vx * spd * dt; m.pos.z += vz * spd * dt;
    collide(m.pos, 0.4);
    if (m.state === 'wander' && Math.hypot(m.pos.x - px, m.pos.z - pz) < spd * dt * 0.3) m.turnT = 0; // bumped a wall

    // animation: shambling walk, twitchy head
    const face = m.state === 'chase' ? Math.atan2(dx, dz) : Math.atan2(vx, vz);
    m.g.rotation.y += Math.atan2(Math.sin(face - m.g.rotation.y), Math.cos(face - m.g.rotation.y)) * Math.min(1, dt * 6);
    m.walk += dt * spd * 3.2;
    const sway = Math.sin(m.walk);
    m.legL.rotation.x = sway * 0.6; m.legR.rotation.x = -sway * 0.6;
    const reach = m.state === 'chase' ? -1.2 : -0.25;
    m.armL.rotation.x = reach + Math.sin(m.walk * 0.5) * 0.3;
    m.armR.rotation.x = reach - Math.sin(m.walk * 0.5 + 1) * 0.3;
    m.torso.rotation.z = Math.sin(m.walk * 0.5) * 0.12;
    m.twitch -= dt;
    if (m.twitch < 0) { m.head.rotation.set((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.4); m.twitch = 0.05 + Math.random() * (m.state === 'chase' ? 0.3 : 1.2); }
    m.flash = Math.max(0, m.flash - dt);
    m.torso.material = m.flash > 0 ? hitMat : fleshMat;
  }

  // keep the town populated
  const alive = monsters.filter((m) => m.hp > 0).length;
  respawnT += dt;
  if (alive < 6 + player.keys * 2 && respawnT > 12) { respawnT = 0; spawnMonster(true); }

  // --- radio static by proximity
  const intensity = nearest < 24 ? Math.pow(1 - nearest / 24, 1.6) : 0;
  if (staticGain) staticGain.gain.setTargetAtTime(intensity * 0.45 * (0.6 + Math.random() * 0.4), ac.currentTime, 0.05);
  $('radio').classList.toggle('on', intensity > 0.05);
  $('grain').style.opacity = 0.13 + intensity * 0.35;

  // --- compass
  const target = currentTarget();
  if (target) {
    const ang = Math.atan2(-(target.x - player.pos.x), -(target.z - player.pos.z));
    const rel = ang - player.yaw;
    $('arrow').style.transform = `rotate(${-rel}rad)`;
  }
}
const hitMat = new THREE.MeshBasicMaterial({ color: 0xff4433 });

// Menu backdrop: slowly orbit the plaza in the fog.
function menuCamera(dt) {
  t += dt;
  const px = Math.sin(t * 0.05) * 14, pz = Math.cos(t * 0.05) * 14;
  camera.position.set(px, 2.2, pz);
  camera.rotation.set(-0.04, Math.atan2(px, pz), 0);
  flashlight.intensity = 0;
}

resetPickups();
for (let i = 0; i < 7; i++) spawnMonster(false);

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state === 'play') update(dt);
  else if (state === 'menu') menuCamera(dt);
  renderer.render(scene, camera);
}
loop();
