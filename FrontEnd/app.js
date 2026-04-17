import * as THREE from 'three';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }     from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// tried OrbitControls here but it was blocking click/select events completely
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BOARDS = [
  {
    name: 'Arduino Uno Rev3', price: '$24.99', category: 'Microcontroller',
    path: '../3DModels/arduino_uno_board.glb', wx: -10, scale: 3.2,
    desc: 'The classic starting point. 8-bit AVR, dead-simple tooling, and a huge library of shields.',
    specs: [
      ['MCU', 'ATmega328P'], ['Clock', '16 MHz'], ['Flash', '32 KB'],
      ['SRAM', '2 KB'], ['I/O', '14 digital pins'], ['Voltage', '5V'],
    ],
    hotspots: [
      { label: 'GPIO Pins',  lp: [ 0.00, 0.38,  1.83] },
      { label: 'USB Port',   lp: [-1.83, 0.21, -1.71] },
      { label: 'ATmega328P', lp: [ 0.46, 0.46,  0.10] },
    ],
  },
  {
    name: 'ESP32-WROOM-32', price: '$8.99', category: 'WiFi / BT Module',
    path: '../3DModels/esp32_wroom.glb', wx: 0, scale: 1.6,
    desc: 'Dual-core, 240 MHz, WiFi, and BLE for under $10. The go-to chip for IoT.',
    specs: [
      ['MCU', 'Xtensa LX6 ×2'], ['Clock', '240 MHz'], ['Flash', '4 MB'],
      ['SRAM', '520 KB'], ['WiFi', '802.11 b/g/n'], ['Voltage', '3.3V'],
    ],
    hotspots: [
      { label: 'WiFi Antenna', lp: [ 0.00, 0.45, -2.25] },
      { label: 'GPIO Pins',    lp: [ 2.20, 0.25,  0.00] },
      { label: 'ESP32 SoC',    lp: [ 0.00, 0.55,  0.00] },
    ],
  },
  {
    name: 'Raspberry Pi 3 B', price: '$39.99', category: 'SBC / Linux',
    path: '../3DModels/raspberry_pi_3.glb', wx: 10, scale: 1.8,
    desc: 'Full Linux on a credit card. Quad-core ARM, 1 GB RAM, HDMI out, 4× USB.',
    specs: [
      ['CPU', 'Cortex-A53 ×4'], ['Clock', '1.2 GHz'], ['RAM', '1 GB'],
      ['WiFi', '802.11n'], ['GPIO', '40-pin'], ['Video', 'HDMI'],
    ],
    hotspots: [
      { label: '40-pin GPIO', lp: [ 2.23, 0.42, -1.05] },
      { label: 'USB Ports',   lp: [ 2.23, 0.42,  1.05] },
      { label: 'BCM2837',     lp: [ 0.23, 0.52,  0.12] },
    ],
  },
];

document.getElementById('theme-btn').addEventListener('click', () => {
  const light = document.documentElement.classList.toggle('light');
  localStorage.setItem('bitio-theme', light ? 'light' : 'dark'); // save so it sticks on the other pages
  scene.background = new THREE.Color(light ? 0xf5f2ee : 0x191919);
  document.getElementById('theme-btn').textContent = light ? '🌙' : '☀';
});

let cartCount = 0;
function bumpCart() {
  // little pop on the counter so you know the click registered
  cartCount++;
  const el = document.getElementById('cart-n');
  el.textContent = cartCount;
  el.style.transform = 'scale(1.4)';
  setTimeout(() => el.style.transform = '', 180);
}
document.querySelectorAll('.btn-buy').forEach(btn => btn.addEventListener('click', bumpCart));

// category filters — "all" shows everything, anything else hides the other sections
document.querySelectorAll('.prod-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.prod-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    document.querySelectorAll('.prod-section').forEach(section => {
      section.style.display = (cat === 'all' || section.dataset.cat === cat) ? '' : 'none';
    });
  });
});

const canvas   = document.getElementById('c3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.outputColorSpace    = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
// match the bg to whatever theme is active on load so there's no flash
scene.background = new THREE.Color(document.documentElement.classList.contains('light') ? 0xf5f2ee : 0x191919);

// MeshStandardMaterial needs an env map or everything looks grey, plain lights aren't enough (fixed by Abdulrahman)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2, 16);

const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(6, 12, 7);
scene.add(sun);

const accent = new THREE.PointLight(0x00ff88, 1.2, 20);
accent.position.set(0, 6, 4);
scene.add(accent);

// TODO: add a fill light from below for the detail view so the underside isn't so dark

let mode = 'loading', selected = -1, loaded = 0, animStart = null, lastTime = 0;

// camera lerp targets — these get updated when selecting/deselecting boards
const camTarget = new THREE.Vector3(0, 2, 16);
const lookTarget = new THREE.Vector3(0, 0, 0);
const camLook   = new THREE.Vector3(0, 0, 0);

const boards = BOARDS.map(d => ({
  data: d, group: new THREE.Group(),
  model: null, landed: false,
  opacity: 1, opTarget: 1, hsEls: [],
}));
boards.forEach(b => { b.group.position.set(b.data.wx, 30, 0); scene.add(b.group); });

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

loader.register(parser => ({
  name: 'KHR_materials_pbrSpecularGlossiness',
  getMaterialType() { return THREE.MeshStandardMaterial; },
  extendMaterialParams(idx, params) {
    const ext = parser.json.materials?.[idx]?.extensions?.KHR_materials_pbrSpecularGlossiness;
    if (!ext) return Promise.resolve();
    const tasks = [];
    if (ext.diffuseFactor) params.color = new THREE.Color().fromArray(ext.diffuseFactor);
    if (ext.diffuseTexture != null)
      tasks.push(parser.assignTexture(params, 'map', ext.diffuseTexture, THREE.SRGBColorSpace));
    params.roughness = ext.glossinessFactor != null ? 1 - ext.glossinessFactor : 1;
    params.metalness = 0;
    return Promise.all(tasks);
  },
}));

boards.forEach(b => {
  loader.load(b.data.path, gltf => {
    const m = gltf.scene;
    console.log('loaded:', b.data.name, gltf);

    const box = new THREE.Box3().setFromObject(m);
    m.scale.setScalar((5.0 / box.getSize(new THREE.Vector3()).length()) * b.data.scale);
    m.position.sub(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));

    // hide the flat base plate some GLBs have (threshold is tiny or it eats the PCB too)
    const full = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    m.traverse(n => {
      if (!n.isMesh) return;
      const s = new THREE.Box3().setFromObject(n).getSize(new THREE.Vector3());
      if (s.x > full.x * 0.6 && s.z > full.z * 0.6 && s.y < 0.005 * Math.max(s.x, s.z))
        n.visible = false;
    });

    m.traverse(n => {
      if (!n.isMesh) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      n.material = mats.length === 1
        ? Object.assign(mats[0].clone(), { transparent: true })
        : mats.map(x => Object.assign(x.clone(), { transparent: true }));
    });

    b.group.add(m);
    b.model = m;
    if (++loaded === boards.length) onReady();

  }, undefined, err => {
    console.warn('load failed:', b.data.path, err);
    if (++loaded === boards.length) onReady();
  });
});

function onReady() {
  const layer = document.getElementById('hs-layer');
  boards.forEach(b => {
    b.data.hotspots.forEach(hs => {
      const el = document.createElement('div');
      el.className = 'hs';
      el.innerHTML = `<div class="hs-dot"></div><div class="hs-label">${hs.label}</div>`;
      layer.appendChild(el);
      b.hsEls.push(el);
    });
  });
  mode = 'idle';
  animStart = clock.getElapsedTime();
  setTimeout(() => document.getElementById('overlay').classList.add('show'), 400);
}

function selectBoard(idx) {
  boards.forEach(b => b.hsEls.forEach(el => el.classList.remove('on'))); // clear or they stick
  selected = idx;
  mode = 'detail';
  camTarget.set(BOARDS[idx].wx - 1.5, 2, 8);
  lookTarget.set(BOARDS[idx].wx, 0.2, 0);
  boards.forEach((b, i) => b.opTarget = i === idx ? 1 : 0.1);
  setTimeout(() => boards[idx].hsEls.forEach(el => el.classList.add('on')), 650);

  const d = BOARDS[idx];
  document.getElementById('p-badge').textContent = d.category;
  document.getElementById('p-name').textContent  = d.name;
  document.getElementById('p-price').textContent = d.price;
  document.getElementById('p-desc').textContent  = d.desc;
  document.getElementById('p-specs').innerHTML = d.specs.map(([k, v]) =>
    `<div class="spec-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
  document.getElementById('p-tags').innerHTML = d.hotspots.map(h =>
    `<span class="tag">${h.label}</span>`).join('');

  document.getElementById('panel').classList.add('open');
  document.getElementById('overlay').classList.add('dim');
}

function deselectBoard() {
  boards.forEach(b => b.hsEls.forEach(el => el.classList.remove('on')));
  selected = -1; mode = 'idle';
  camTarget.set(0, 2, 16); lookTarget.set(0, 0, 0);
  boards.forEach(b => b.opTarget = 1);
  document.getElementById('panel').classList.remove('open');
  document.getElementById('overlay').classList.remove('dim');
}

function setOpacity(b, op) {
  if (!b.model) return;
  b.model.traverse(n => {
    if (!n.isMesh) return;
    if (Array.isArray(n.material)) n.material.forEach(m => m.opacity = op);
    else n.material.opacity = op;
  });
}

const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function toNDC(e) {
  const r = canvas.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

// drag rotates the board, small movement = click
let dragBoard = -1, dragX = 0, didDrag = false;

canvas.addEventListener('pointerdown', e => {
  if (mode === 'loading') return;
  toNDC(e); ray.setFromCamera(mouse, camera);
  dragBoard = boards.findIndex(b => b.model && ray.intersectObject(b.group, true).length);
  dragX = e.clientX; didDrag = false;
});

canvas.addEventListener('pointermove', e => {
  if (dragBoard !== -1) {
    const dx = e.clientX - dragX;
    if (Math.abs(dx) > 3) didDrag = true;
    boards[dragBoard].group.rotation.y += dx * 0.012;
    dragX = e.clientX;
  } else {
    if (mode !== 'idle') return;
    toNDC(e); ray.setFromCamera(mouse, camera);
    canvas.className = boards.some(b => b.model && ray.intersectObject(b.group, true).length) ? 'pointer' : '';
  }
});

canvas.addEventListener('pointerup', e => {
  if (!didDrag) {
    toNDC(e); ray.setFromCamera(mouse, camera);
    const hit = boards.findIndex(b => b.model && ray.intersectObject(b.group, true).length);
    if (hit !== -1) selectBoard(hit);
    else if (mode === 'detail') deselectBoard();
  }
  dragBoard = -1; didDrag = false;
});

document.getElementById('panel-close').addEventListener('click', deselectBoard);
document.getElementById('btn-add').addEventListener('click', () => {
  if (selected === -1) return;
  bumpCart();
  const btn = document.getElementById('btn-add'), orig = btn.innerHTML;
  btn.textContent = '✓ Added!';
  setTimeout(() => btn.innerHTML = orig, 1600);
});
window.addEventListener('keydown', e => e.key === 'Escape' && deselectBoard());
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// TODO: keyboard arrow keys to switch between boards would be nice

const _w = new THREE.Vector3(), _s = new THREE.Vector3();
function updateHotspots() {
  if (mode !== 'detail' || selected === -1) return;
  const b = boards[selected], rect = canvas.getBoundingClientRect();
  b.data.hotspots.forEach((hs, j) => {
    _w.set(...hs.lp); b.group.localToWorld(_w); _s.copy(_w).project(camera);
    const el = b.hsEls[j];
    if (_s.z > 1) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    el.style.left = `${(_s.x + 1) / 2 * rect.width}px`;
    el.style.top  = `${(-_s.y + 1) / 2 * rect.height}px`;
  });
}

function easeOutBack(t) {
  return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
}

const clock = new THREE.Clock();

(function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const dt   = time - lastTime; lastTime = time;

  if (mode !== 'loading' && animStart !== null) {
    boards.forEach((b, i) => {
      const elapsed = time - animStart - i * 0.45;

      if (!b.landed && elapsed > 0) {
        const t = Math.min(elapsed / 1.6, 1);
        b.group.position.y = 30 * (1 - easeOutBack(t));
        if (t >= 1) { b.landed = true; b.group.position.y = 0; }
      }

      if (b.landed) {
        b.group.position.y = Math.sin(time * 0.7 + i * 1.3) * 0.07;
        if (mode === 'idle')      b.group.rotation.y += 0.25 * dt;
        else if (i !== selected)  b.group.rotation.y += 0.05 * dt;
        // selected board holds whatever rotation the user dragged it to
      }

      if (Math.abs(b.opacity - b.opTarget) > 0.002) {
        b.opacity += (b.opTarget - b.opacity) * 0.07;
        setOpacity(b, b.opacity);
      }
    });

    camera.position.lerp(camTarget, 0.07);
    camLook.lerp(lookTarget, 0.07);
    camera.lookAt(camLook);

    accent.position.x = Math.sin(time * 0.35) * 4;
    accent.position.z = Math.cos(time * 0.2) * 3 + 4;

    updateHotspots();
  }

  renderer.render(scene, camera);
}());
