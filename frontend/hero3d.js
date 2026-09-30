import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMemory, buildFirmware, buildNAS } from './hardware-models.js';

// An original, procedural hardware study. No downloaded model or tracking CDN.
function randomFactory(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}

function canvasTexture(size, paint, color = true) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function boardTexture() {
  return canvasTexture(2048, (ctx, n) => {
    const random = randomFactory(727);
    ctx.fillStyle = '#123f36'; ctx.fillRect(0, 0, n, n);
    const image = ctx.getImageData(0, 0, n, n);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = (random() - .5) * 7;
      image.data[i] += v; image.data[i + 1] += v; image.data[i + 2] += v;
    }
    ctx.putImageData(image, 0, 0);
    // Fine copper tracks fan out from the central package; all bends are 45°.
    for (let side = 0; side < 4; side++) {
      ctx.save(); ctx.translate(n / 2, n / 2); ctx.rotate(side * Math.PI / 2);
      for (let i = 0; i < 31; i++) {
        const x = (i - 15) * 22, bend = 460 + (i % 7) * 35;
        const end = 800 + random() * 145, shift = Math.sign(x || 1) * (60 + (i % 6) * 17);
        ctx.strokeStyle = i % 5 === 0 ? '#5d8061' : '#2b6450';
        ctx.lineWidth = i % 5 === 0 ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(x, 320); ctx.lineTo(x, bend);
        ctx.lineTo(x + shift, bend + Math.abs(shift)); ctx.lineTo(x + shift, end); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + shift, end, 6, 0, Math.PI * 2); ctx.fillStyle = '#b3a978'; ctx.fill();
        ctx.beginPath(); ctx.arc(x + shift, end, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#103329'; ctx.fill();
      }
      ctx.restore();
    }
    // Solder mask borders, silk-screen component outlines and fabrication marks.
    ctx.strokeStyle = '#799787'; ctx.lineWidth = 2; ctx.strokeRect(54, 54, n - 108, n - 108);
    ctx.font = '22px monospace'; ctx.fillStyle = '#b6c9ba';
    ctx.fillText('WHRDS / RESEARCH BOARD', 115, 128);
    ctx.fillText('REV 02 · 2026', 115, 170);
    ctx.save(); ctx.translate(n - 104, n - 120); ctx.rotate(Math.PI);
    ctx.fillText('ZZoMb1E  /  FIELD NOTES', 0, 0); ctx.restore();
    ctx.font = '17px monospace';
    for (let i = 0; i < 6; i++) {
      ctx.strokeRect(140 + i * 266, 220, 150, 50);
      ctx.fillText('C' + (101 + i), 140 + i * 266, 208);
      ctx.strokeRect(140 + i * 266, n - 310, 150, 50);
      ctx.fillText('R' + (201 + i), 140 + i * 266, n - 324);
    }
    // Copper test pads along one board edge.
    for (let i = 0; i < 25; i++) {
      ctx.fillStyle = '#b49a55'; ctx.fillRect(630 + i * 31, n - 115, 18, 60);
    }
  });
}

function brushedTexture() {
  return canvasTexture(1024, (ctx, n) => {
    const random = randomFactory(340);
    ctx.fillStyle = '#ababab'; ctx.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) {
      const v = Math.floor(120 + random() * 100);
      ctx.strokeStyle = `rgb(${v},${v},${v})`; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(n, y + (random() - .5) * 2); ctx.stroke();
    }
  }, false);
}

function metalLabel() {
  return canvasTexture(1024, (ctx, n) => {
    ctx.fillStyle = '#bec4c1'; ctx.fillRect(0, 0, n, n);
    const random = randomFactory(23);
    for (let i = 0; i < 3400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${random() * .06})`;
      ctx.fillRect(0, random() * n, n, .5);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#3c4540';
    ctx.font = '600 112px monospace'; ctx.fillText('ZZoMb1E', n / 2, 422);
    ctx.font = '24px monospace'; ctx.fillText('SECURITY RESEARCH', n / 2, 488);
    ctx.fillStyle = '#58615c'; ctx.font = '20px monospace'; ctx.fillText('WHRDS  /  FIELD UNIT 001', n / 2, 788);
    // Laser-etched serial marks, rather than oversized glowing lettering.
    for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
      if (random() > .48) ctx.fillRect(117 + x * 6, 722 + y * 6, 5, 5);
    }
    ctx.strokeStyle = '#65726b'; ctx.lineWidth = 3; ctx.strokeRect(110, 110, 70, 70);
    ctx.font = '40px monospace'; ctx.fillText('W_', 148, 159);
  });
}

function buildHardware(renderer) {
  const assembly = new THREE.Group();
  const board = new THREE.Group(); assembly.add(board);
  const texture = boardTexture(), brushed = brushedTexture(), label = metalLabel();
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  label.anisotropy = texture.anisotropy;
  const pcb = new THREE.MeshPhysicalMaterial({ color: '#184b3e', metalness: .18, roughness: .43, clearcoat: .45, clearcoatRoughness: .3 });
  const nickel = new THREE.MeshStandardMaterial({ color: '#b5bdb7', metalness: 1, roughness: .29 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a76a', metalness: .92, roughness: .3 });
  const black = new THREE.MeshStandardMaterial({ color: '#171d1b', metalness: .15, roughness: .58 });
  const ceramic = new THREE.MeshStandardMaterial({ color: '#a49b81', metalness: .12, roughness: .48 });
  const smallBox = new THREE.BoxGeometry(1, 1, 1);
  const add = (geometry, material, xyz, parent = board) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...xyz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const box = (size, material, xyz, radius = .015, parent = board) => add(new RoundedBoxGeometry(...size, 2, radius), material, xyz, parent);
  box([4.6, .12, 4.6], pcb, [0, 0, 0], .09);
  const boardFace = add(new THREE.PlaneGeometry(4.51, 4.51), new THREE.MeshPhysicalMaterial({ map: texture, roughness: .54, metalness: .28, clearcoat: .25, clearcoatRoughness: .32 }), [0, .061, 0]);
  boardFace.rotation.x = -Math.PI / 2;
  // Visible FR-4 layers along the edge.
  for (const y of [-.044, -.018, .011]) {
    const layer = box([4.603, .006, 4.603], new THREE.MeshStandardMaterial({ color: '#576245', roughness: .65 }), [0, y, 0], .09);
    layer.castShadow = false;
  }
  // Mounting rings and countersunk steel screws.
  for (const x of [-2.02, 2.02]) for (const z of [-2.02, 2.02]) {
    const ring = add(new THREE.RingGeometry(.112, .174, 40), gold, [x, .064, z]); ring.rotation.x = -Math.PI / 2;
    add(new THREE.CylinderGeometry(.096, .1, .032, 32), nickel, [x, .075, z]);
    box([.115, .003, .02], black, [x, .093, z], .001);
    box([.02, .003, .115], black, [x, .093, z], .001);
    add(new THREE.CylinderGeometry(.105, .105, .15, 24), nickel, [x, -.135, z]);
  }
  // Repeated solder joints and SMD components share geometry via instancing.
  const solderItems = [], ceramicItems = [], resistorItems = [];
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 14; i++) {
      const angle = side * Math.PI / 2, edge = 1.46 + (i % 2) * .24, u = (i - 6.5) * .225;
      const x = u * Math.cos(angle) + edge * Math.sin(angle), z = edge * Math.cos(angle) - u * Math.sin(angle);
      const size = [.11, .065, .05], item = { x, y: .115, z, angle, size };
      (i % 3 === 0 ? resistorItems : ceramicItems).push(item);
      for (const sign of [-1, 1]) solderItems.push({ x: x + sign * .068 * Math.cos(angle), y: .105, z: z - sign * .068 * Math.sin(angle), angle, size: [.042, .061, .069] });
    }
  }
  function instances(items, material) {
    const mesh = new THREE.InstancedMesh(smallBox, material, items.length);
    const dummy = new THREE.Object3D();
    items.forEach((item, i) => {
      dummy.position.set(item.x, item.y, item.z); dummy.rotation.y = item.angle;
      dummy.scale.set(...item.size); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true; mesh.receiveShadow = true; board.add(mesh);
  }
  instances(solderItems, nickel); instances(ceramicItems, ceramic); instances(resistorItems, black);
  // Peripheral ICs, gold leads and silver oscillator cans.
  for (const sign of [-1, 1]) {
    box([.49, .15, .62], black, [sign * 1.72, .15, 0], .024);
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
      box([.105, .032, .036], nickel, [sign * 1.72 + side * .28, .1, (i - 3) * .08], .008);
    }
    box([.36, .11, .25], nickel, [sign * 1.64, .13, -1.15], .03);
  }
  // Gold contact fingers at the front edge.
  for (let i = 0; i < 25; i++) box([.039, .006, .136], gold, [(i - 12) * .069, .066, 2.12], .002);
  const socket = box([2.42, .18, 2.42], black, [0, .17, 0], .075);
  box([2.24, .032, 2.24], nickel, [0, .275, 0], .07);
  const packageGroup = new THREE.Group(); assembly.add(packageGroup); packageGroup.position.y = .31;
  box([2.09, .10, 2.09], new THREE.MeshStandardMaterial({ color: '#235146', roughness: .65 }), [0, .02, 0], .035, packageGroup);
  // BGA contact array exposed in the exploded view.
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(.024, 8, 6), gold, 121);
  const matrix = new THREE.Matrix4(); let ballIndex = 0;
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) { matrix.makeTranslation(x * .168, -.052, z * .168); balls.setMatrixAt(ballIndex++, matrix); }
  packageGroup.add(balls);
  const dieMaterial = new THREE.MeshPhysicalMaterial({ color: '#242f40', metalness: .85, roughness: .19, iridescence: .6, iridescenceIOR: 1.6, clearcoat: 1 });
  box([.84, .065, .93], dieMaterial, [0, .10, 0], .018, packageGroup);
  const dieLines = new THREE.GridHelper(.78, 16, '#bdad81', '#5f777f'); dieLines.position.y = .134; packageGroup.add(dieLines);
  const lidGroup = new THREE.Group(); assembly.add(lidGroup); lidGroup.position.y = .42;
  const lidMaterial = new THREE.MeshPhysicalMaterial({ color: '#cbd0cc', metalness: 1, roughness: .34, roughnessMap: brushed, bumpMap: brushed, bumpScale: .007, anisotropy: .65, clearcoat: .15 });
  box([1.94, .195, 1.94], lidMaterial, [0, 0, 0], .078, lidGroup);
  const topLabel = add(new THREE.PlaneGeometry(1.78, 1.78), new THREE.MeshPhysicalMaterial({ map: label, metalness: .93, roughness: .37, bumpMap: brushed, bumpScale: .006, anisotropy: .55 }), [0, .098, 0], lidGroup);
  topLabel.rotation.x = -Math.PI / 2;
  // An understated status LED with a physical lens.
  const led = new THREE.MeshPhysicalMaterial({ color: '#78dba6', emissive: '#45c688', emissiveIntensity: .85, roughness: .22, clearcoat: 1 });
  box([.085, .07, .07], led, [1.96, .10, 1.27], .018);
  box([.075, .055, .064], ceramic, [1.96, .093, 1.45], .012);
  // Plated-through vias, a shrouded debug header, inductors and a shielded port.
  const vias = new THREE.InstancedMesh(new THREE.RingGeometry(.014, .027, 10), gold, 72);
  const viaPose = new THREE.Object3D(); viaPose.rotation.x = -Math.PI / 2;
  let viaIndex = 0;
  for (const sign of [-1, 1]) for (let i = 0; i < 18; i++) {
    for (const swapped of [false, true]) {
      const u = (i - 8.5) * .205;
      viaPose.position.set(swapped ? sign * 1.90 : u, .067, swapped ? u : sign * 1.90);
      viaPose.updateMatrix(); vias.setMatrixAt(viaIndex++, viaPose.matrix);
    }
  }
  board.add(vias);
  box([1.00, .11, .28], black, [.65, .12, -2.12], .02);
  const headerPins = [];
  for (let i = 0; i < 8; i++) for (const row of [-1, 1]) headerPins.push({ x: .26 + i * .11, y: .245, z: -2.12 + row * .072, angle: 0, size: [.029, .19, .029] });
  instances(headerPins, gold);
  const port = new THREE.Group(); board.add(port); port.position.set(-.92, .21, -2.16);
  box([.82, .30, .54], nickel, [0, 0, 0], .055, port);
  box([.69, .20, .014], black, [0, 0, -.274], .025, port);
  box([.50, .045, .019], black, [0, -.025, -.285], .008, port);
  for (let i = 0; i < 8; i++) box([.025, .008, .014], gold, [(i - 3.5) * .051, -.005, -.297], .001, port);
  for (const x of [-1.24, 1.24]) {
    box([.27, .15, .28], black, [x, .15, 1.24], .025);
    const coil = new THREE.TorusGeometry(.081, .014, 7, 24);
    for (let i = 0; i < 4; i++) {
      const winding = add(coil, new THREE.MeshStandardMaterial({ color: '#b57a4e', metalness: .93, roughness: .31 }), [x, .239 + i * .009, 1.24]);
      winding.rotation.x = -Math.PI / 2;
    }
  }
  return { assembly, update: t => { packageGroup.position.y = .31 + t * .40; lidGroup.position.y = .42 + t * 1.18; } };
}

const studies = {
  board: { build: buildHardware, number: '001', title: 'UNDER THE SURFACE.', ko: '기판', en: 'Board', detailKo: '적층 기판 · 도금 비아 · 디버그 헤더', detailEn: 'Layered PCB · plated vias · debug header', camera: [5.4, 7.3, 6.6], target: [0, .22, 0], floor: -.28 },
  memory: { build: buildMemory, number: '002', title: 'EVERY BIT MATTERS.', ko: '메모리', en: 'Memory', detailKo: '메모리 IC · 금도금 접점 · 분리형 방열판', detailEn: 'Memory ICs · gold contacts · heat spreader', camera: [3.0, 6.4, 6.7], target: [0, .40, 0], floor: -.28 },
  firmware: { build: buildFirmware, number: '003', title: 'SMALL CHIP. DEEP SECRETS.', ko: '펌웨어', en: 'Firmware', detailKo: 'SPI 플래시 · 실리콘 다이 · 골드 본딩 와이어', detailEn: 'SPI flash · silicon die · gold bond wires', camera: [4.6, 6.1, 5.8], target: [0, .40, 0], floor: -.28 },
  nas: { build: buildNAS, number: '004', title: 'BEYOND THE ENCLOSURE.', ko: 'NAS', en: 'NAS', detailKo: '4베이 NAS · 드라이브 캐디 · 알루미늄 섀시', detailEn: '4-bay NAS · drive caddies · aluminium chassis', camera: [6.8, 5.0, 8.3], target: [0, 1.12, .24], floor: -.27 },
};

export async function mountHardware(host) {
  const stage = host.querySelector('[data-three-stage]');
  const controlsElement = host.querySelector('[data-three-controls]');
  const explodeButton = host.querySelector('[data-explode]');
  const motionButton = host.querySelector('[data-motion]');
  const resetButton = host.querySelector('[data-reset]');
  const status = host.querySelector('[data-three-status]');
  const modelPicker = host.querySelector('[data-model-picker]');
  const modelButtons = [...host.querySelectorAll('[data-model]')];
  const modelTitle = host.querySelector('[data-model-title]');
  const modelDetail = host.querySelector('[data-model-detail]');
  const modelNumber = host.querySelector('[data-model-number]');
  const ko = document.documentElement.lang === 'ko';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 700px)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true }); }
  catch (error) { throw new Error('WebGL is unavailable', { cause: error }); }
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.3 : 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 40);
  camera.position.set(5.4, 7.3, 6.6);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, .045);
  scene.environment = environmentTarget.texture; scene.environmentIntensity = .5;
  environment.dispose(); pmrem.dispose();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .22, 0); controls.enableZoom = false; controls.enablePan = false;
  controls.enableDamping = false; controls.minPolarAngle = .30; controls.maxPolarAngle = 1.29;
  controls.rotateSpeed = .48; controls.update(); controls.saveState();
  // Let vertical touch gestures scroll the blog; touch rotation is not required.
  renderer.domElement.style.touchAction = 'pan-y';
  let model = buildHardware(renderer), selected = 'board', switching = false;
  const models = new Map([['board', model]]); scene.add(model.assembly);
  host.dataset.model = selected;
  const key = new THREE.DirectionalLight('#fff0d9', 3.3); key.position.set(-3, 6, 3);
  key.castShadow = true; key.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 16 });
  key.shadow.normalBias = .025; key.shadow.bias = -.0002; key.shadow.radius = 3; scene.add(key);
  const rim = new THREE.DirectionalLight('#a3e6d0', 2.4); rim.position.set(3, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight('#d0dfff', .8); fill.position.set(-5, 2, -2); scene.add(fill);
  const faceLight = new THREE.DirectionalLight('#dde7e0', 0); faceLight.position.set(4, 3, 6); scene.add(faceLight);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ color: '#000000', opacity: .33 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.28; floor.receiveShadow = true; scene.add(floor);
  let exploded = false, explosion = 0, motion = !reduced.matches && !compact;
  let visible = true, destroyed = false, contextLost = false, frame = 0, lastFrame = 0, dirty = true, phase = 0, lastTime = 0, renderedFrames = 0;
  const setMotion = (value) => { motion = value; motionButton.setAttribute('aria-pressed', String(value)); };
  setMotion(motion);
  function invalidate() { dirty = true; if (!frame && visible && !document.hidden && !destroyed && !contextLost) frame = requestAnimationFrame(tick); }
  function tick(now) {
    frame = 0;
    if (destroyed || contextLost || !visible || document.hidden) return;
    const target = exploded ? 1 : 0;
    const transitioning = Math.abs(target - explosion) > .001;
    const dt = Math.min((now - (lastTime || now)) / 1000, .05); lastTime = now;
    if (now - lastFrame < 1000 / 30 && !dirty) { frame = requestAnimationFrame(tick); return; }
    lastFrame = now;
    explosion = reduced.matches ? target : THREE.MathUtils.damp(explosion, target, 9, Math.max(dt, 1 / 30));
    model.update(explosion);
    if (motion) { phase += dt; model.assembly.rotation.y = Math.sin(phase * .32) * .12; }
    renderer.render(scene, camera); dirty = false;
    // DOM-only diagnostics used by the smoke test, not a background timer.
    host.dataset.renderCalls = String(renderer.info.render.calls);
    host.dataset.triangles = String(renderer.info.render.triangles);
    host.dataset.frames = String(++renderedFrames);
    host.dataset.geometries = String(renderer.info.memory.geometries);
    host.dataset.textures = String(renderer.info.memory.textures);
    if (motion || transitioning) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.updateProjectionMatrix(); invalidate();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); resize();
  try { await renderer.compileAsync(scene, camera); }
  catch (error) {
    destroyed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); controls.dispose();
    scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach((material) => { Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); }); material.dispose(); });
    });
    environmentTarget.dispose(); renderer.dispose(); renderer.domElement.remove(); throw error;
  }
  renderer.render(scene, camera); host.dataset.state = 'ready'; controlsElement.hidden = false; modelPicker.hidden = false;
  host.querySelector('[data-load-three]').hidden = true;
  status.textContent = ko ? '3D 모델 준비 완료. 아래 버튼으로 구조와 회전을 조절할 수 있습니다.' : '3D model ready. Use the buttons to inspect its structure and rotation.';
  const onExplode = () => { exploded = !exploded; explodeButton.setAttribute('aria-pressed', String(exploded)); status.textContent = ko ? (exploded ? '모델 구조를 펼쳤습니다.' : '모델을 조립했습니다.') : (exploded ? 'Exploded view.' : 'Assembled view.'); invalidate(); };
  const onMotion = () => { setMotion(!motion); invalidate(); };
  const onReset = () => { controls.reset(); exploded = false; explodeButton.setAttribute('aria-pressed', 'false'); model.assembly.rotation.y = 0; phase = 0; setMotion(false); invalidate(); };
  const onStart = () => { setMotion(false); };
  async function onSelect(event) {
    const button = event.target.closest('[data-model]'), next = button?.dataset.model;
    if (!next || next === selected || switching || !studies[next]) return;
    switching = true; modelPicker.setAttribute('aria-busy', 'true');
    const previous = model, previousKey = selected;
    const spec = studies[next];
    try {
      if (!models.has(next)) models.set(next, spec.build(renderer));
      model = models.get(next); scene.remove(previous.assembly); scene.add(model.assembly);
      selected = next; exploded = false; explosion = 0; phase = 0; setMotion(false);
      model.assembly.rotation.y = 0; model.update(0);
      camera.position.set(...spec.camera); controls.target.set(...spec.target); controls.update(); controls.saveState();
      floor.position.y = spec.floor;
      faceLight.intensity = next === 'nas' ? 1.7 : 0;
      await renderer.compileAsync(scene, camera);
      if (destroyed) return;
      modelButtons.forEach(el => el.setAttribute('aria-pressed', String(el.dataset.model === next)));
      explodeButton.setAttribute('aria-pressed', 'false');
      modelTitle.textContent = spec.title; modelDetail.textContent = ko ? spec.detailKo : spec.detailEn;
      modelNumber.textContent = 'FIELD OBJECT / ' + spec.number;
      host.dataset.model = next;
      status.textContent = ko ? `${spec.ko} 모델을 선택했습니다.` : `${spec.en} model selected.`;
      invalidate();
    } catch (error) {
      scene.remove(model.assembly); scene.add(previous.assembly); model = previous; selected = previousKey;
      const oldSpec = studies[previousKey]; camera.position.set(...oldSpec.camera); controls.target.set(...oldSpec.target); controls.update(); controls.saveState();
      floor.position.y = oldSpec.floor; model.update(0); explodeButton.setAttribute('aria-pressed', 'false');
      faceLight.intensity = previousKey === 'nas' ? 1.7 : 0;
      status.textContent = ko ? '모델을 불러오지 못했습니다. 다시 선택해 주세요.' : 'Could not load this model. Please try again.';
      invalidate();
    } finally { switching = false; modelPicker.removeAttribute('aria-busy'); }
  }
  const onPickerKey = (event) => {
    const i = modelButtons.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? modelButtons.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + modelButtons.length) % modelButtons.length;
    modelButtons[next].focus();
  };
  modelPicker.addEventListener('click', onSelect); modelPicker.addEventListener('keydown', onPickerKey);
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { lastTime = 0; invalidate(); } };
  const onReduced = () => { if (reduced.matches) setMotion(false); invalidate(); };
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) { cancelAnimationFrame(frame); frame = 0; } else { lastTime = 0; invalidate(); } });
  intersection.observe(host);
  // Avoid OrbitControls capturing touch scroll. Desktop dragging remains enabled.
  const preventTouch = (event) => { if (event.pointerType === 'touch') event.stopImmediatePropagation(); };
  renderer.domElement.addEventListener('pointerdown', preventTouch, true);
  controls.addEventListener('start', onStart); controls.addEventListener('change', invalidate);
  explodeButton.addEventListener('click', onExplode); motionButton.addEventListener('click', onMotion); resetButton.addEventListener('click', onReset);
  document.addEventListener('visibilitychange', onVisibility); reduced.addEventListener('change', onReduced);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); contextLost = true; setMotion(false); host.dataset.state = 'fallback'; controlsElement.hidden = true; modelPicker.hidden = true;
    status.textContent = ko ? '그래픽 연결이 중단되어 미리보기를 표시합니다.' : 'Graphics context lost; showing a preview.';
    cancelAnimationFrame(frame); frame = 0;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { contextLost = false; host.dataset.state = 'ready'; controlsElement.hidden = false; modelPicker.hidden = false; invalidate(); });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    destroyed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); intersection.disconnect(); controls.dispose();
    document.removeEventListener('visibilitychange', onVisibility); reduced.removeEventListener('change', onReduced);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    // Include cached inactive studies in disposal; only one is rendered at a time.
    models.forEach(({ assembly }) => { if (!assembly.parent) scene.add(assembly); });
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const mat of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) materials.add(mat);
    });
    materials.forEach((mat) => { Object.values(mat).forEach((value) => { if (value?.isTexture) textures.add(value); }); mat.dispose(); });
    geometries.forEach((geometry) => geometry.dispose()); textures.forEach((texture) => texture.dispose());
    environmentTarget.dispose(); renderer.dispose();
  }, { once: true });
  invalidate();
}
