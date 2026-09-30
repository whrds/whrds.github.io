import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Original illustrative hardware, with instanced fasteners and physical finishes.
// Dimensions and markings are visual studies, not specifications of real products.
function texture(width, height, draw, color = true) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function brushedMap() {
  return texture(512, 512, (c, w, h) => {
    c.fillStyle = '#a1a1a1'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = 105 + (y * 43 % 110); c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(0, y, w, .55);
    }
  }, false);
}

function marking(lines, { background = '#171c1b', ink = '#b7bfb7', width = 1024, height = 512 } = {}) {
  return texture(width, height, (c, w, h) => {
    c.fillStyle = background; c.fillRect(0, 0, w, h);
    c.fillStyle = ink; c.textAlign = 'left';
    lines.forEach((line, i) => { c.font = `${i === 0 ? '600 ' : ''}${i === 0 ? 78 : 35}px monospace`; c.fillText(line, w * .09, h * (.32 + i * .19)); });
    for (let i = 0; i < 54; i++) { const bar = 1 + (i * 17 % 4); c.fillRect(w * .09 + i * 7, h * .85, bar, h * .055); }
  });
}

function kit(renderer) {
  const assembly = new THREE.Group(), brushed = brushedMap();
  const material = (color, metalness = .1, roughness = .5, options = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...options });
  const m = {
    metal: material('#b9c0bd', 1, .31, { roughnessMap: brushed, bumpMap: brushed, bumpScale: .004 }),
    darkMetal: material('#303736', .92, .37, { roughnessMap: brushed, bumpMap: brushed, bumpScale: .003 }),
    black: material('#141a18', .08, .58), gold: material('#cba460', .94, .28),
    pcb: material('#17493c', .25, .48), solder: material('#adb7b4', .95, .3),
    ceramic: material('#a39a7f', .12, .55), copper: material('#b7794b', .92, .32),
    led: material('#8cd6b2', .05, .22, { emissive: '#51cc92', emissiveIntensity: .75 }),
    silicon: new THREE.MeshPhysicalMaterial({ color: '#344750', metalness: .86, roughness: .19, iridescence: .75, clearcoat: 1 }),
  };
  const group = (parent = assembly) => { const g = new THREE.Group(); parent.add(g); return g; };
  function add(geometry, mat, p, parent = assembly, rotation) {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...p);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const box = (size, mat, p, parent = assembly, radius = .015) => add(new RoundedBoxGeometry(...size, 1, Math.min(radius, ...size.map(v => v / 3))), mat, p, parent);
  const cylinder = (radius, depth, mat, p, parent = assembly, rotation, segments = 40) => add(new THREE.CylinderGeometry(radius, radius, depth, segments), mat, p, parent, rotation);
  const plane = (size, map, p, parent = assembly, rotation = [-Math.PI / 2, 0, 0], metalness = .15) => {
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return add(new THREE.PlaneGeometry(...size), material('#ffffff', metalness, .46, { map }), p, parent, rotation);
  };
  function batch(items, mat, parent = assembly, geometry = new THREE.BoxGeometry(1, 1, 1)) {
    const mesh = new THREE.InstancedMesh(geometry, mat, items.length), dummy = new THREE.Object3D();
    items.forEach((item, i) => {
      dummy.position.set(...item.p); dummy.scale.set(...(item.s || [1, 1, 1])); dummy.rotation.set(...(item.r || [0, 0, 0]));
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  return { assembly, m, group, add, box, cylinder, plane, batch };
}

function memoryBoardMap() {
  return texture(2048, 640, (c, w, h) => {
    c.fillStyle = '#194b3d'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 96; i++) {
      const x = 25 + i * 21, y = 90 + i % 7 * 45;
      c.strokeStyle = i % 3 ? '#38644c' : '#668265'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, h - 70); c.lineTo(x, y + 30); c.lineTo(x + 30, y); c.lineTo(x + 70, y); c.stroke();
      c.fillStyle = '#b9a879'; c.beginPath(); c.arc(x + 70, y, 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#b6cbb8'; c.font = '22px monospace'; c.fillText('ZZoMb1E / MEMORY STUDY', 80, 50);
    c.fillText('REV 02', w - 210, 50); c.fillText('U01     U02     U03     U04     U05     U06     U07     U08', 130, 580);
  });
}

export function buildMemory(renderer) {
  const k = kit(renderer), { assembly, m, group, box, plane, batch, cylinder } = k;
  const module = group(); module.rotation.z = -.055;
  // Long DIMM profile, a keyed edge connector and eight individually labelled ICs.
  const outline = new THREE.Shape();
  outline.moveTo(-2.675, -.76); outline.lineTo(-.65, -.76); outline.lineTo(-.65, -.53);
  outline.lineTo(-.47, -.53); outline.lineTo(-.47, -.76); outline.lineTo(2.675, -.76);
  outline.lineTo(2.675, .76); outline.lineTo(-2.675, .76); outline.closePath();
  k.add(new THREE.ExtrudeGeometry(outline, { depth: .09, bevelEnabled: false, steps: 1 }), m.pcb, [0, .175, 0], module, [-Math.PI / 2, 0, 0]);
  const face = new THREE.ShapeGeometry(outline), vertices = face.attributes.position, uv = face.attributes.uv;
  for (let i = 0; i < vertices.count; i++) uv.setXY(i, vertices.getX(i) / 5.35 + .5, vertices.getY(i) / 1.52 + .5);
  const boardMap = memoryBoardMap(); boardMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  k.add(face, new THREE.MeshStandardMaterial({ map: boardMap, roughness: .48, metalness: .25 }), [0, .267, 0], module, [-Math.PI / 2, 0, 0]);
  const contacts = [], solder = [], passives = [];
  for (let i = 0; i < 64; i++) {
    const x = -2.52 + i * .08; if (i === 24 || i === 25) continue;
    contacts.push({ p: [x, .272, .648], s: [.046, .015, .19] });
  }
  batch(contacts, m.gold, module);
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * .635;
    box([.51, .095, .70], m.black, [x, .321, -.065], module, .025);
    plane([.47, .64], marking(['ZR8', 'MEMORY', `B${String(i + 1).padStart(2, '0')}`], { width: 512, height: 512 }), [x, .37, -.065], module);
    for (const z of [-.56, .44]) for (const d of [-.19, -.065, .065, .19]) {
      passives.push({ p: [x + d, .305, z], s: [.065, .047, .034] });
      for (const sign of [-1, 1]) solder.push({ p: [x + d + sign * .039, .294, z], s: [.023, .032, .043] });
    }
  }
  batch(passives, m.ceramic, module); batch(solder, m.solder, module);
  for (const x of [-2.59, 2.59]) {
    box([.10, .094, .16], m.black, [x, .222, -.08], module);
    cylinder(.025, .008, m.gold, [x, .277, -.51], module);
  }
  const spreader = group(module), back = group(module);
  box([5.30, .085, 1.13], m.darkMetal, [0, .45, -.13], spreader, .045);
  // Machined grooves catch the key light, while the connector remains exposed.
  const fins = [];
  for (let i = 0; i < 30; i++) fins.push({ p: [(i - 14.5) * .173, .508, -.20], s: [.031, .045, .89] });
  batch(fins, m.darkMetal, spreader);
  box([2.58, .04, .70], m.metal, [0, .534, -.11], spreader, .025);
  plane([2.40, .62], marking(['ZZoMb1E', 'MEMORY / FIELD 002'], { background: '#b9c1ba', ink: '#353f39', height: 384 }), [0, .555, -.11], spreader, undefined, .9);
  box([5.28, .06, 1.12], m.darkMetal, [0, .13, -.13], back, .045);
  for (const x of [-2.28, 2.28]) {
    cylinder(.057, .025, m.metal, [x, .518, -.13], spreader);
    box([.055, .004, .012], m.black, [x, .532, -.13], spreader, .001);
  }
  return { assembly, update: t => { spreader.position.y = t * 1.12; back.position.y = -t * .23; } };
}

function firmwareBoardMap() {
  return texture(1024, 1024, (c, w, h) => {
    c.fillStyle = '#153e35'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#698169'; c.lineWidth = 3;
    for (const sign of [-1, 1]) for (let i = 0; i < 4; i++) {
      const z = 260 + i * 160;
      c.beginPath(); c.moveTo(512 + sign * 205, z); c.lineTo(512 + sign * (280 + i * 14), z);
      c.lineTo(512 + sign * (325 + i * 14), z + 45); c.lineTo(512 + sign * (325 + i * 14), 885 - i * 22); c.stroke();
      c.fillStyle = '#b9a069'; c.beginPath(); c.arc(512 + sign * (325 + i * 14), 885 - i * 22, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#b7c8b3'; c.font = '22px monospace'; c.fillText(String(sign === -1 ? i + 1 : 8 - i), 512 + sign * 267, z - 25);
    }
    c.strokeRect(56, 56, w - 112, h - 112);
    c.fillStyle = '#c2d0bd'; c.font = '29px monospace'; c.fillText('SPI FLASH / FIELD 003', 105, 120);
    c.font = '22px monospace'; c.fillText('ZZoMb1E  ·  FIRMWARE STUDY', 105, 937);
  });
}

export function buildFirmware(renderer) {
  const k = kit(renderer), { assembly, m, group, box, plane, batch, cylinder, add } = k;
  box([3.75, .11, 3.70], m.pcb, [0, 0, 0], assembly, .08);
  plane([3.62, 3.57], firmwareBoardMap(), [0, .056, 0]);
  for (const x of [-1.60, 1.60]) for (const z of [-1.57, 1.57]) {
    cylinder(.095, .01, m.gold, [x, .065, z]); cylinder(.051, .013, m.black, [x, .069, z]);
  }
  const chip = group(), cap = group(), die = group();
  box([1.62, .13, 2.16], m.black, [0, .20, 0], chip, .055);
  box([1.43, .027, 1.95], m.copper, [0, .28, 0], chip, .015);
  // Eight gull-wing leads have a sloping shoulder and a flat soldered foot.
  for (const sign of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = (i - 1.5) * .53;
    box([.39, .075, .19], m.solder, [sign * 1.04, .099, z]);
    const shoulder = box([.40, .052, .14], m.metal, [sign * .91, .213, z], chip, .022);
    shoulder.rotation.z = -sign * .47;
    box([.24, .046, .16], m.metal, [sign * 1.15, .116, z], chip, .017);
  }
  box([.72, .055, .91], m.silicon, [0, .328, 0], die, .008);
  const diePattern = texture(512, 640, (c, w, h) => {
    c.fillStyle = '#4a605e'; c.fillRect(0, 0, w, h);
    for (let x = 20; x < w - 20; x += 26) for (let y = 20; y < h - 20; y += 38) {
      c.fillStyle = (x + y) % 3 ? '#8e9981' : '#3d566a'; c.fillRect(x, y, 20, 30);
      c.fillStyle = '#c0b88e'; c.fillRect(x + 3, y + 3, 1, 23);
    }
  });
  plane([.68, .87], diePattern, [0, .358, 0], die, undefined, .88);
  // Curved gold bond wires are visible when the package opens.
  for (const sign of [-1, 1]) for (let i = 0; i < 12; i++) {
    const z = (i - 5.5) * .065;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(sign * .31, .37, z), new THREE.Vector3(sign * .48, .62, z * 1.8), new THREE.Vector3(sign * .68, .297, z * 2));
    add(new THREE.TubeGeometry(curve, 12, .008, 5, false), m.gold, [0, 0, 0], die);
  }
  box([1.64, .20, 2.18], m.black, [0, .438, 0], cap, .063);
  plane([1.44, 1.98], marking(['ZZoMb1E', 'SPI NOR FLASH', 'FIELD 003 / REV A'], { width: 768, height: 1024 }), [0, .539, 0], cap);
  cylinder(.074, .006, m.darkMetal, [-.56, .543, .75], cap);
  const passives = [], solder = [];
  for (let i = 0; i < 10; i++) {
    const x = (i - 4.5) * .22;
    passives.push({ p: [x, .10, 1.40], s: [.10, .06, .056] });
    for (const s of [-1, 1]) solder.push({ p: [x + s * .06, .09, 1.40], s: [.033, .047, .074] });
  }
  batch(passives, m.ceramic); batch(solder, m.solder);
  return { assembly, update: t => { cap.position.y = t * 1.34; die.position.y = t * .25; } };
}

export function buildNAS(renderer) {
  const k = kit(renderer), { assembly, m, group, box, plane, batch, cylinder, add } = k;
  const top = group(), left = group(), right = group(), drives = [];
  // Four-bay brushed aluminium chassis: open framework and removable panels.
  box([4.12, .13, 3.68], m.darkMetal, [0, -.07, 0], assembly, .055);
  box([4.12, .12, 3.68], m.darkMetal, [0, 2.62, 0], top, .07);
  box([.115, 2.61, 3.62], m.darkMetal, [-2, 1.25, 0], left, .06);
  box([.115, 2.61, 3.62], m.darkMetal, [2, 1.25, 0], right, .06);
  plane([2.02, .74], marking(['ZZoMb1E', 'STORAGE LAB / 004'], { background: '#303736', ink: '#87968d' }), [0, 2.682, -.20], top, undefined, .9);
  box([3.92, 2.50, .09], m.darkMetal, [0, 1.23, -1.77], assembly, .025);
  const beams = [];
  for (const x of [-1.87, 1.87]) for (const z of [-1.63, 1.63]) beams.push({ p: [x, 1.25, z], s: [.09, 2.52, .09] });
  for (const y of [.10, 2.46]) beams.push({ p: [0, y, 1.62], s: [3.82, .10, .11] });
  batch(beams, m.metal);
  for (const x of [-1.55, 1.55]) for (const z of [-1.31, 1.31]) cylinder(.16, .12, m.black, [x, -.19, z]);
  // Side vents and stamped rail details are instanced instead of individual meshes.
  const vents = [];
  for (let y = 0; y < 6; y++) for (let z = 0; z < 15; z++) vents.push({ p: [2.061, .42 + y * .13, -.94 + z * .14], s: [.006, .048, .087] });
  batch(vents, m.black, right);
  const screws = [], slots = [];
  for (const x of [-1.82, 1.82]) for (const z of [-1.57, 1.57]) {
    screws.push({ p: [x, 2.687, z], s: [.039, .012, .039] });
    slots.push({ p: [x, 2.695, z], s: [.039, .003, .008] });
  }
  batch(screws, m.metal, top, new THREE.CylinderGeometry(1, 1, 1, 16)); batch(slots, m.black, top);
  // Four independent drive caddies, mechanically distinct from the shell.
  const diskGrain = texture(512, 512, (c, w, h) => {
    c.fillStyle = '#aaaaaa'; c.fillRect(0, 0, w, h);
    for (let r = 20; r < 256; r += 1.2) {
      const v = Math.round(125 + Math.sin(r * 2.1) * 18);
      c.strokeStyle = `rgb(${v},${v},${v})`; c.lineWidth = .45;
      c.beginPath(); c.arc(w / 2, h / 2, r, 0, Math.PI * 2); c.stroke();
    }
  }, false);
  const diskMaterial = new THREE.MeshStandardMaterial({ color: '#c8cdd0', metalness: 1, roughness: .36, roughnessMap: diskGrain });
  for (let i = 0; i < 4; i++) {
    const drive = group(); drive.position.x = (i - 1.5) * .92; drives.push(drive);
    box([.80, 2.10, .15], m.black, [0, 1.25, 1.72], drive, .065);
    box([.59, 1.79, 2.74], m.darkMetal, [0, 1.23, .13], drive, .05);
    box([.043, 1.73, 2.65], m.metal, [.315, 1.23, .13], drive, .025);
    box([.63, .095, .105], m.metal, [0, .39, 1.822], drive, .027);
    box([.10, 1.10, .07], m.darkMetal, [-.23, 1.24, 1.824], drive, .019);
    box([.068, .032, .027], m.led, [.22, 2.05, 1.811], drive, .009);
    plane([.48, .21], marking([`0${i + 1}`], { width: 512, height: 256, ink: '#acb6ae' }), [0, .65, 1.798], drive, [0, 0, 0]);
    const grille = [];
    for (let row = 0; row < 12; row++) grille.push({ p: [.055, .84 + row * .083, 1.800], s: [.31, .022, .012] });
    batch(grille, m.darkMetal, drive);
    // The outer caddy exposes a disk platter and actuator when pulled out.
    if (i === 3) {
      cylinder(.68, .032, diskMaterial, [.345, 1.32, .12], drive, [0, 0, Math.PI / 2], 80);
      cylinder(.16, .053, m.metal, [.369, 1.32, .12], drive, [0, 0, Math.PI / 2]);
      cylinder(.062, .057, m.black, [.40, 1.32, .12], drive, [0, 0, Math.PI / 2]);
      const arm = box([.038, .095, .73], m.metal, [.385, .89, .55], drive, .023); arm.rotation.x = -.60;
      cylinder(.14, .053, m.copper, [.382, .67, .79], drive, [0, 0, Math.PI / 2]);
      add(new THREE.TorusGeometry(.62, .003, 5, 80), m.metal, [.363, 1.32, .12], drive, [0, Math.PI / 2, 0]);
    } else {
      plane([1.10, 1.18], marking(['FIELD DRIVE', `STORAGE 0${i + 1}`, 'ZZoMb1E'], { background: '#b9c0ba', ink: '#3f4943', width: 640, height: 640 }), [.338, 1.25, .1], drive, [0, Math.PI / 2, 0], .7);
    }
  }
  // Controller board, heatsink and rear cooling fan become visible on opening.
  box([3.59, .056, 2.80], m.pcb, [0, .055, -.15], assembly, .035);
  box([.65, .13, .64], m.black, [-1.12, .15, -1.13]);
  const fins = [];
  for (let i = 0; i < 12; i++) fins.push({ p: [-1.39 + i * .049, .31, -1.13], s: [.022, .23, .62] });
  batch(fins, m.metal);
  for (const x of [-1.19, 1.19]) {
    cylinder(.52, .05, m.black, [x, 1.47, -1.707], assembly, [Math.PI / 2, 0, 0]);
    const blades = [];
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; blades.push({ p: [x + Math.cos(a) * .25, 1.47 + Math.sin(a) * .25, -1.665], s: [.33, .10, .035], r: [0, 0, a + .7] }); }
    batch(blades, m.darkMetal); cylinder(.11, .06, m.metal, [x, 1.47, -1.65], assembly, [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(.49, .022, 8, 48), m.metal, [x, 1.47, -1.625]);
  }
  box([.28, .22, .13], m.metal, [0, .59, -1.835]);
  box([.21, .15, .02], m.black, [0, .59, -1.912]);
  box([.44, .13, .03], m.black, [0, .30, -1.824]);
  plane([1.14, .18], marking(['ZZoMb1E'], { width: 1024, height: 160, background: '#303736', ink: '#a1b2a6' }), [-1.03, 2.47, 1.707], assembly, [0, 0, 0], .7);
  box([.067, .044, .022], m.led, [1.72, 2.47, 1.70], assembly, .012);
  return { assembly, update: t => {
    top.position.y = t * .84; left.position.x = -t * .36; right.position.x = t * .60;
    drives.forEach((drive, i) => { drive.position.z = t * (.50 + i * .30); });
  } };
}
