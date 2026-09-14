// ==================================================================
// 3D BATTLE SCENES — art direction, ship building, and effects.
// Two independent boards (own + enemy), each a full scene/camera/renderer,
// following the same construction validated in the standalone 3D preview.
// Depends on: THREE (loaded via CDN before this file), and GRID_SIZE (defined
// in the main game script, which must load before this file).
// ==================================================================

function createToonGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 4; canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ["#20242e", "#4a5568", "#8a97a6", "#d8dde3"].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i, 0, 1, 1); });
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
const toonGradient3D = createToonGradient();

function createSkyTexture(topColor, horizonColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, horizonColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  return new THREE.CanvasTexture(canvas);
}

function createGlowSprite(color, size) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

function createHullTexture(baseColor, stripeColor, waterlineFraction) {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = stripeColor;
  ctx.fillRect(0, 64 * (1 - waterlineFraction), 64, 64 * waterlineFraction);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  for (let y = 6; y < 64; y += 9) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

const SHIP_STYLES_3D = {
  Carrier:    { hullColor: "#5a6570", stripeColor: "#1c2128", deckColor: "#8a7355", turrets: 0, hasDeck: true,  sitLow: false },
  Battleship: { hullColor: "#48525e", stripeColor: "#c94b3f", deckColor: "#6b7078", turrets: 2, hasDeck: false, sitLow: false },
  Cruiser:    { hullColor: "#5e6b78", stripeColor: "#2e5c8a", deckColor: "#767c84", turrets: 1, hasDeck: false, sitLow: false },
  Submarine:  { hullColor: "#242a30", stripeColor: "#111417", deckColor: "#242a30", turrets: 0, hasDeck: false, sitLow: true  },
  Destroyer:  { hullColor: "#3f5468", stripeColor: "#e0954f", deckColor: "#5c6672", turrets: 1, hasDeck: false, sitLow: false }
};

const CELL3D = 2; // world units per grid cell, matches the standalone preview

function gridToWorld3D(row, col) {
  return {
    x: (col - (GRID_SIZE - 1) / 2) * CELL3D,
    z: (row - (GRID_SIZE - 1) / 2) * CELL3D
  };
}

function buildTower3D(group, x, baseY, tierCount, baseW, baseD, tierH, towerMat, mastMat) {
  let y = baseY;
  let w = baseW, d = baseD;
  for (let i = 0; i < tierCount; i++) {
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w, tierH, d), towerMat);
    tier.position.set(x, y + tierH / 2, 0);
    group.add(tier);
    y += tierH;
    w *= 0.7; d *= 0.72;
  }
  const mastH = tierH * 2.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, mastH, 5), mastMat);
  pole.position.set(x, y + mastH / 2, 0);
  group.add(pole);
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, baseD * 1.3), mastMat);
  crossbar.position.set(x, y + mastH * 0.68, 0);
  group.add(crossbar);
  return y;
}

function buildTurret3D(group, x, y, hullWidth, hullHeight, turretMat) {
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(hullWidth * 0.22, hullWidth * 0.26, hullHeight * 0.9, 6), turretMat);
  turret.position.set(x, y, 0);
  group.add(turret);
  const barrelLen = hullWidth * 0.9;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, barrelLen, 6), turretMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(x + barrelLen / 2, y, 0);
  group.add(barrel);
}

function buildShip3D(def) {
  const style = SHIP_STYLES_3D[def.name] || SHIP_STYLES_3D.Cruiser;
  const group = new THREE.Group();
  const hullLen = def.len * CELL3D * 0.82;
  const hullWidth = CELL3D * (style.sitLow ? 0.4 : 0.55);
  const hullHeight = style.sitLow ? 0.32 : 0.5;

  const hullTex = createHullTexture(style.hullColor, style.stripeColor, style.sitLow ? 0.55 : 0.3);
  const hullMat = new THREE.MeshToonMaterial({ map: hullTex, gradientMap: toonGradient3D });
  const towerMat = new THREE.MeshToonMaterial({ color: style.deckColor, gradientMap: toonGradient3D });
  const accentMat = new THREE.MeshToonMaterial({ color: style.stripeColor, gradientMap: toonGradient3D });
  const mastMat = new THREE.MeshToonMaterial({ color: "#2a2e33", gradientMap: toonGradient3D });

  let hull;
  if (style.sitLow) {
    hull = new THREE.Mesh(new THREE.CylinderGeometry(hullWidth / 2, hullWidth / 2, hullLen, 10), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.position.y = hullHeight / 2;
  } else {
    hull = new THREE.Mesh(new THREE.BoxGeometry(hullLen, hullHeight, hullWidth), hullMat);
    hull.position.y = hullHeight / 2;
  }
  group.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(hullWidth / 2, hullLen * 0.2, style.sitLow ? 10 : 4), hullMat);
  bow.rotation.z = -Math.PI / 2;
  if (!style.sitLow) bow.rotation.y = Math.PI / 4;
  bow.position.set(hullLen / 2 + hullLen * 0.07, hullHeight / 2, 0);
  group.add(bow);

  if (style.hasDeck) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(hullLen * 0.96, hullHeight * 0.3, hullWidth * 1.7), towerMat);
    deck.position.y = hullHeight + hullHeight * 0.15;
    group.add(deck);
    const deckTopY = hullHeight + hullHeight * 0.3;
    buildTower3D(group, -hullLen * 0.32, deckTopY, 3, hullLen * 0.1, hullWidth * 0.55, hullHeight * 0.55, accentMat, mastMat);
    const planeMat = new THREE.MeshToonMaterial({ color: "#dfe3e8", gradientMap: toonGradient3D });
    [[-0.05, 0.35], [0.08, 0.35], [0.2, -0.3], [-0.1, -0.32], [0.32, 0.15]].forEach(([fx, fz]) => {
      const plane = new THREE.Mesh(new THREE.ConeGeometry(hullWidth * 0.06, hullLen * 0.09, 4), planeMat);
      plane.rotation.z = -Math.PI / 2;
      plane.position.set(hullLen * fx, deckTopY + 0.02, hullWidth * fz);
      group.add(plane);
    });
  } else if (style.sitLow) {
    const sail = new THREE.Mesh(new THREE.BoxGeometry(hullLen * 0.16, hullHeight * 2.2, hullWidth * 0.5), accentMat);
    sail.position.set(0, hullHeight * 1.3, 0);
    group.add(sail);
    const sailTopY = hullHeight * 1.3 + hullHeight * 1.1;
    [0.08, -0.08].forEach(fz => {
      const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, hullHeight * 1.3, 5), mastMat);
      periscope.position.set(hullLen * 0.01, sailTopY + hullHeight * 0.65, hullWidth * fz);
      group.add(periscope);
    });
  } else {
    const tierCount = def.name === "Battleship" ? 4 : def.name === "Destroyer" ? 2 : 3;
    const baseW = hullLen * (def.name === "Battleship" ? 0.16 : def.name === "Destroyer" ? 0.11 : 0.14);
    buildTower3D(group, -hullLen * 0.08, hullHeight, tierCount, baseW, hullWidth * 0.65, hullHeight * 0.65, towerMat, mastMat);
  }

  for (let i = 0; i < style.turrets; i++) {
    const xPos = style.turrets === 2 ? (i === 0 ? hullLen * 0.28 : -hullLen * 0.32) : hullLen * 0.18;
    buildTurret3D(group, xPos, hullHeight * 1.15, hullWidth, hullHeight, accentMat);
  }

  group.userData.sitLow = style.sitLow;
  return group;
}

// ---------- BOARD FACTORY ----------
function createBoard3D(canvas) {
  const scene = new THREE.Scene();
  const SKY_TOP = "#233a66", SKY_HORIZON = "#e79a5c";
  scene.background = createSkyTexture(SKY_TOP, SKY_HORIZON);
  scene.fog = new THREE.Fog(0x9a6a4a, 20, 62);

  const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 200);
  camera.position.set(-9, 8, 13);
  camera.lookAt(2, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const sunSprite = createGlowSprite("rgba(255,208,140,1)", 16);
  sunSprite.position.set(-22, 9, -32);
  scene.add(sunSprite);

  scene.add(new THREE.AmbientLight(0x5f7aa8, 0.5));
  const sunLight = new THREE.DirectionalLight(0xffb877, 1.3);
  sunLight.position.set(-10, 16, 8);
  scene.add(sunLight);
  const rim = new THREE.DirectionalLight(0x4fc3f7, 0.3);
  rim.position.set(8, 6, -10);
  scene.add(rim);

  const boardSize = GRID_SIZE * CELL3D;
  const waterGeo = new THREE.PlaneGeometry(boardSize + 24, boardSize + 24, 48, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshToonMaterial({ color: 0x0d3a4a, gradientMap: toonGradient3D, transparent: true, opacity: 0.97 }));
  scene.add(water);

  const gridHelper = new THREE.GridHelper(boardSize, GRID_SIZE, 0x4fc3f7, 0x1c4f6e);
  gridHelper.position.y = 0.05;
  scene.add(gridHelper);

  return {
    scene, camera, renderer, canvas, waterGeo, waterPos: waterGeo.attributes.position,
    ships: [], shipsByCellKey: {},
    activeParticleSystems: [], activeRipples: [], activeFires: [], activeMissiles: [], activeFlashes: []
  };
}

function resizeBoard(board) {
  const rect = board.canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  board.camera.aspect = rect.width / rect.height;
  board.camera.updateProjectionMatrix();
  board.renderer.setSize(rect.width, rect.height, false);
}

// ---------- EFFECTS (board-parameterized so both scenes work independently) ----------
function spawnBurst(board, position, color, count, speed, spread, gravity, lifespan, size) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x; positions[i * 3 + 1] = position.y; positions[i * 3 + 2] = position.z;
    const theta = Math.random() * Math.PI * 2, phi = Math.random() * Math.PI * 0.5;
    const s = speed * (0.5 + Math.random() * 0.5);
    velocities.push({ x: Math.cos(theta) * Math.sin(phi) * s * spread, y: Math.cos(phi) * s, z: Math.sin(theta) * Math.sin(phi) * s * spread });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: size || 0.12, transparent: true, opacity: 1 });
  const points = new THREE.Points(geo, mat);
  board.scene.add(points);
  board.activeParticleSystems.push({ points, velocities, birth: performance.now(), lifespan, gravity, mat });
}
function updateParticles(board, deltaSec) {
  for (let i = board.activeParticleSystems.length - 1; i >= 0; i--) {
    const sys = board.activeParticleSystems[i];
    const age = (performance.now() - sys.birth) / 1000;
    if (age > sys.lifespan) {
      board.scene.remove(sys.points); sys.points.geometry.dispose(); sys.points.material.dispose();
      board.activeParticleSystems.splice(i, 1);
      continue;
    }
    const positions = sys.points.geometry.attributes.position.array;
    sys.velocities.forEach((v, j) => {
      v.y -= sys.gravity * deltaSec;
      positions[j * 3] += v.x * deltaSec; positions[j * 3 + 1] += v.y * deltaSec; positions[j * 3 + 2] += v.z * deltaSec;
    });
    sys.points.geometry.attributes.position.needsUpdate = true;
    sys.mat.opacity = 1 - age / sys.lifespan;
  }
}

function spawnExplosionFlash(board, position, baseScale) {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(baseScale || 0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 1 }));
  flash.position.copy(position);
  board.scene.add(flash);
  board.activeFlashes.push({ flash, birth: performance.now(), duration: 380 });
}
function updateFlashes(board) {
  for (let i = board.activeFlashes.length - 1; i >= 0; i--) {
    const f = board.activeFlashes[i];
    const t = (performance.now() - f.birth) / f.duration;
    if (t >= 1) { board.scene.remove(f.flash); f.flash.geometry.dispose(); f.flash.material.dispose(); board.activeFlashes.splice(i, 1); continue; }
    const scale = 1 + t * 6;
    f.flash.scale.set(scale, scale, scale);
    f.flash.material.opacity = 1 - t;
  }
}

function spawnRipple(board, x, z) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.15, 24), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.06, z);
  board.scene.add(ring);
  board.activeRipples.push({ ring, birth: performance.now(), duration: 900 });
}
function updateRipples(board) {
  for (let i = board.activeRipples.length - 1; i >= 0; i--) {
    const r = board.activeRipples[i];
    const t = (performance.now() - r.birth) / r.duration;
    if (t >= 1) { board.scene.remove(r.ring); r.ring.geometry.dispose(); r.ring.material.dispose(); board.activeRipples.splice(i, 1); continue; }
    const scale = 1 + t * 10;
    r.ring.scale.set(scale, scale, 1);
    r.ring.material.opacity = 0.6 * (1 - t);
  }
}

function spawnFire(board, x, y, z, parent) {
  const sprite = createGlowSprite("rgba(255,150,50,1)", 1.8);
  if (parent) {
    const localPos = new THREE.Vector3(x, y, z);
    parent.worldToLocal(localPos);
    sprite.position.copy(localPos);
    parent.add(sprite);
  } else {
    sprite.position.set(x, y, z);
    board.scene.add(sprite);
  }
  board.activeFires.push({ sprite, born: performance.now(), baseScale: 1.8 });
}
function updateFires(board) {
  board.activeFires.forEach(f => {
    const age = (performance.now() - f.born) / 1000;
    const flick = 0.85 + Math.sin(age * 14 + f.born) * 0.15;
    f.sprite.scale.set(f.baseScale * flick, f.baseScale * 1.15 * flick, 1);
  });
}

function launchMissileTo(board, target, onImpact) {
  const start = new THREE.Vector3(target.x + (Math.random() - 0.5) * 4, 14, target.z + (Math.random() - 0.5) * 4);
  const missile = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffdca0 }));
  missile.position.copy(start);
  board.scene.add(missile);
  const trailGeo = new THREE.BufferGeometry().setFromPoints([start.clone(), start.clone()]);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffb877, transparent: true, opacity: 0.7 }));
  board.scene.add(trail);
  board.activeMissiles.push({ missile, trail, start: start.clone(), end: new THREE.Vector3(target.x, target.y, target.z), birth: performance.now(), duration: 700, onImpact, done: false });
}
function updateMissiles(board) {
  for (let i = board.activeMissiles.length - 1; i >= 0; i--) {
    const m = board.activeMissiles[i];
    const t = Math.min(1, (performance.now() - m.birth) / m.duration);
    const pos = m.start.clone().lerp(m.end, t);
    m.missile.position.copy(pos);
    const tp = m.trail.geometry.attributes.position;
    tp.setXYZ(0, m.start.x, m.start.y, m.start.z);
    tp.setXYZ(1, pos.x, pos.y, pos.z);
    tp.needsUpdate = true;
    if (t >= 1 && !m.done) {
      m.done = true;
      board.scene.remove(m.missile); board.scene.remove(m.trail);
      m.onImpact();
      board.activeMissiles.splice(i, 1);
    }
  }
}

function playMiss(board, target) {
  launchMissileTo(board, target, () => {
    spawnBurst(board, new THREE.Vector3(target.x, 0.1, target.z), 0x9fd8ff, 22, 3.5, 0.9, 6, 0.8);
    spawnRipple(board, target.x, target.z);
  });
}
function playHit(board, target, attachShip, then) {
  launchMissileTo(board, target, () => {
    spawnExplosionFlash(board, new THREE.Vector3(target.x, 0.5, target.z), 0.45);
    spawnBurst(board, new THREE.Vector3(target.x, 0.4, target.z), 0xffb84b, 55, 6.5, 1.5, 9, 0.9, 0.22);
    spawnFire(board, target.x, 0.75, target.z, attachShip);
    if (then) then();
  });
}
function playSink(board, shipGroup) {
  const box = new THREE.Box3().setFromObject(shipGroup);
  const len = box.max.x - box.min.x;
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const localX = box.min.x + Math.random() * len;
      spawnExplosionFlash(board, new THREE.Vector3(localX, 0.5, shipGroup.position.z), 0.4);
      spawnBurst(board, new THREE.Vector3(localX, 0.5, shipGroup.position.z), 0xffb84b, 48, 5.5, 1.3, 9, 0.9, 0.22);
    }, i * 260);
  }
  setTimeout(() => {
    const startY = shipGroup.position.y, startRotZ = shipGroup.rotation.z, startTime = performance.now(), duration = 5200;
    function sinkStep() {
      const t = Math.min(1, (performance.now() - startTime) / duration);
      const eased = t * t;
      shipGroup.position.y = startY - eased * 1.6;
      shipGroup.rotation.z = startRotZ + eased * 0.55;
      shipGroup.rotation.x = eased * 0.18;
      if (t < 1) requestAnimationFrame(sinkStep);
      else board.scene.remove(shipGroup);
    }
    requestAnimationFrame(sinkStep);
  }, 1400);
}

// ---------- BOARD INSTANCES + SHARED RENDER LOOP ----------
const ownBoard = createBoard3D(document.getElementById("ownCanvas"));
const enemyBoard = createBoard3D(document.getElementById("enemyCanvas"));
let lastFrameTime3D = performance.now();

function animateBoards(time) {
  requestAnimationFrame(animateBoards);
  const t = time * 0.001;
  const deltaSec = Math.min(0.05, (performance.now() - lastFrameTime3D) / 1000);
  lastFrameTime3D = performance.now();

  [ownBoard, enemyBoard].forEach(board => {
    for (let i = 0; i < board.waterPos.count; i++) {
      const x = board.waterPos.getX(i), z = board.waterPos.getZ(i);
      board.waterPos.setY(i, Math.sin(x * 0.4 + t * 1.2) * 0.06 + Math.cos(z * 0.5 + t * 0.9) * 0.05);
    }
    board.waterPos.needsUpdate = true;
    board.waterGeo.computeVertexNormals();

    board.ships.forEach(ship => {
      ship.position.y = ship.userData.baseY + Math.sin(t * 1.3 + ship.userData.bobOffset) * 0.08;
      ship.rotation.z = Math.sin(t * 1.1 + ship.userData.bobOffset) * 0.02;
    });

    updateMissiles(board);
    updateParticles(board, deltaSec);
    updateRipples(board);
    updateFires(board);
    updateFlashes(board);

    board.renderer.render(board.scene, board.camera);
  });
}
requestAnimationFrame(animateBoards);
window.addEventListener("resize", () => { resizeBoard(ownBoard); resizeBoard(enemyBoard); });
