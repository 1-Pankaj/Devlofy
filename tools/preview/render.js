/**
 * The kit's offline renderer and invariant check — no GPU, no browser.
 *
 * This machine cannot give a browser a WebGL context (the GPU process dies in
 * the sandbox), so "look at the models" has to mean something else: this tool
 * builds every model with the real `three` code paths, asserts the things a
 * screenshot would have told us (it stands on the ground, it is the size it
 * claims, no NaN vertices, the triangle budget holds, it is deterministic, every
 * model is actually wired into the garden), and then **software-rasterises** a
 * contact sheet to a PNG so the shapes can be reviewed in-repo.
 *
 * It is a development tool: it is never imported by the app, and it emits to
 * /tmp. Same three shading lights as the Garden scene, same linear→sRGB
 * conversion, so what the sheet shows is what the scene draws.
 *
 *   npx tsc src/lib/three/kit/index.ts --ignoreConfig --outDir /tmp/kit \
 *     --module commonjs --target es2020 --moduleResolution node --skipLibCheck
 *   node tools/preview/render.js /tmp/kit/three/kit/index.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const THREE = require('three');

const DEFAULT_BUILD = '/tmp/kit/three/kit/index.js';
const KIT_BUILD_PATH = process.argv[2] ?? DEFAULT_BUILD;
const OUT_PATH = process.argv[3] ?? '/tmp/shots/kit-sheet.png';
const CHECK_ONLY = process.argv.includes('--check');

const kit = require(path.resolve(KIT_BUILD_PATH));

// ── the sheet ────────────────────────────────────────────────────────────────

const TILE = 380;
const TILE_H = 360;
const COLUMNS = 3;
const BG_TOP = [0.965, 0.955, 0.99];
const BG_BOTTOM = [0.9, 0.89, 0.94];

// The Garden scene's own lights, so the sheet is not a flattering second look.
const AMBIENT = [0.45 * 0.937, 0.45 * 0.89, 0.45 * 0.839];
const KEY_DIR = normalize([5, 7, 4]);
const KEY_COLOR = [1.35, 1.35 * 0.953, 1.35 * 0.875];
const FILL_DIR = normalize([-4, 2.5, -3]);
const FILL_COLOR = [0.4 * 0.486, 0.4 * 0.769, 0.4];

// ── small vector helpers ─────────────────────────────────────────────────────

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// ── PNG ──────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── triangles out of a scene graph ───────────────────────────────────────────

/** Every triangle in an object, in world space, with its flat colour. */
function collectTriangles(root) {
  root.updateMatrixWorld(true);
  const triangles = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  root.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const emissive = material.emissive
      ? [material.emissive.r * (material.emissiveIntensity ?? 1),
         material.emissive.g * (material.emissiveIntensity ?? 1),
         material.emissive.b * (material.emissiveIntensity ?? 1)]
      : [0, 0, 0];

    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, i + 1).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, i + 2).applyMatrix4(object.matrixWorld);
      triangles.push({
        a: [a.x, a.y, a.z],
        b: [b.x, b.y, b.z],
        c: [c.x, c.y, c.z],
        color: color
          ? [color.getX(i), color.getY(i), color.getZ(i)]
          : [material.color.r, material.color.g, material.color.b],
        emissive,
      });
    }
  });

  return triangles;
}

// ── software rasteriser ──────────────────────────────────────────────────────

function linearToSrgb(value) {
  const v = Math.max(0, Math.min(1, value));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/**
 * Orthographic-ish perspective camera aimed at a box. Draws flat-shaded,
 * z-buffered triangles into an RGBA buffer at (originX, originY).
 */
function draw(target, originX, originY, width, height, triangles, eye, target3, fovDegrees) {
  const f = 1 / Math.tan((fovDegrees * Math.PI) / 360);
  const aspect = width / height;
  const zAxis = normalize([eye[0] - target3[0], eye[1] - target3[1], eye[2] - target3[2]]);
  const xAxis = normalize(cross([0, 1, 0], zAxis));
  const yAxis = cross(zAxis, xAxis);
  const depth = new Float32Array(width * height).fill(Infinity);

  const project = (point) => {
    const dx = point[0] - eye[0];
    const dy = point[1] - eye[1];
    const dz = point[2] - eye[2];
    const viewX = dot(xAxis, [dx, dy, dz]);
    const viewY = dot(yAxis, [dx, dy, dz]);
    const viewZ = dot(zAxis, [dx, dy, dz]);
    if (viewZ > -0.05) return null; // behind the near plane
    const w = -viewZ;
    return {
      x: ((viewX * f) / aspect / w) * 0.5 * width + width / 2,
      y: height / 2 - ((viewY * f) / w) * 0.5 * height,
      z: w,
    };
  };

  for (const triangle of triangles) {
    const pa = project(triangle.a);
    const pb = project(triangle.b);
    const pc = project(triangle.c);
    if (!pa || !pb || !pc) continue;

    // Flat shading: one normal per face, lit by the scene's three lights.
    const normal = normalize(cross(
      [triangle.b[0] - triangle.a[0], triangle.b[1] - triangle.a[1], triangle.b[2] - triangle.a[2]],
      [triangle.c[0] - triangle.a[0], triangle.c[1] - triangle.a[1], triangle.c[2] - triangle.a[2]],
    ));
    const key = Math.max(0, dot(normal, KEY_DIR));
    const fill = Math.max(0, dot(normal, FILL_DIR));
    const shade = [0, 1, 2].map((channel) =>
      AMBIENT[channel] +
      KEY_COLOR[channel] * key * 0.55 +
      FILL_COLOR[channel] * fill * 0.9,
    );
    const rgb = [0, 1, 2].map((channel) =>
      linearToSrgb(
        triangle.color[channel] * shade[channel] + triangle.emissive[channel] * 0.9,
      ),
    );

    const minX = Math.max(0, Math.floor(Math.min(pa.x, pb.x, pc.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(pa.x, pb.x, pc.x)));
    const minY = Math.max(0, Math.floor(Math.min(pa.y, pb.y, pc.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(pa.y, pb.y, pc.y)));

    const area = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
    if (Math.abs(area) < 1e-9) continue;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((pb.x - pa.x) * (py - pa.y) - (pb.y - pa.y) * (px - pa.x)) / area;
        const w1 = ((px - pa.x) * (pc.y - pa.y) - (py - pa.y) * (pc.x - pa.x)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        const z = pa.z * w2 + pb.z * w0 + pc.z * w1;
        const index = y * width + x;
        if (z >= depth[index]) continue;
        depth[index] = z;

        const offset = ((originY + y) * target.width + (originX + x)) * 4;
        target.buffer[offset] = Math.round(rgb[0] * 255);
        target.buffer[offset + 1] = Math.round(rgb[1] * 255);
        target.buffer[offset + 2] = Math.round(rgb[2] * 255);
        target.buffer[offset + 3] = 255;
      }
    }
  }
}

function fillBackground(target, originX, originY, width, height) {
  for (let y = 0; y < height; y += 1) {
    const t = y / Math.max(1, height - 1);
    const color = [0, 1, 2].map((channel) =>
      Math.round(255 * (BG_TOP[channel] * (1 - t) + BG_BOTTOM[channel] * t)),
    );
    for (let x = 0; x < width; x += 1) {
      const offset = ((originY + y) * target.width + (originX + x)) * 4;
      target.buffer[offset] = color[0];
      target.buffer[offset + 1] = color[1];
      target.buffer[offset + 2] = color[2];
      target.buffer[offset + 3] = 255;
    }
  }
}

// ── the tree's fallback, so the sheet shows it too ───────────────────────────

function proceduralTree() {
  const { makeTree } = require(path.join(path.dirname(path.resolve(KIT_BUILD_PATH)), '../../garden/model.js'));
  const group = new THREE.Group();
  const tree = makeTree(7, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const bark = new THREE.Color('#3A2A1F');
  const leaf = new THREE.Color('#0CBE46');

  for (const branch of tree.branches) {
    const start = new THREE.Vector3(...branch.start);
    const end = new THREE.Vector3(...branch.end);
    const direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(branch.radius * 0.72, branch.radius, direction.length(), 6),
      new THREE.MeshStandardMaterial({ color: bark }),
    );
    mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
    group.add(mesh);
  }

  for (const item of tree.leaves) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(item.scale, 0),
      new THREE.MeshStandardMaterial({ color: leaf }),
    );
    mesh.position.set(...item.position);
    group.add(mesh);
  }

  return group;
}

// ── checks ───────────────────────────────────────────────────────────────────

function boundsOf(object) {
  const box = new THREE.Box3().setFromObject(object);
  return { min: box.min, max: box.max, size: box.getSize(new THREE.Vector3()) };
}

function finite(object) {
  let ok = true;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const position = child.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 1) {
      if (!Number.isFinite(position.getX(i)) || !Number.isFinite(position.getY(i)) || !Number.isFinite(position.getZ(i))) {
        ok = false;
      }
    }
  });
  return ok;
}

function signature(object) {
  let top = 0;
  let sum = 0;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const position = child.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i += 1) {
      const value = position.getX(i) * 3 + position.getY(i) * 5 + position.getZ(i) * 7;
      top = Math.max(top, Math.abs(value)) % 1e6;
      sum = (sum + Math.abs(value)) % 1e9;
    }
  });
  return `${top.toFixed(6)}:${sum.toFixed(6)}`;
}

const TRI_BUDGET = 700;
const VARIANTS = [
  { id: 'bench', options: {} },
  { id: 'signpost', options: { notches: 0 } },
  { id: 'signpost', options: { notches: 2 } },
  { id: 'signpost', options: { notches: 5 } },
  { id: 'rock', options: { stones: 1 } },
  { id: 'rock', options: { stones: 3 } },
  { id: 'grass', options: {} },
  { id: 'fern', options: {} },
  { id: 'log', options: {} },
  { id: 'stump', options: {} },
  { id: 'lantern', options: {} },
];

function checkVariants() {
  const failures = [];
  const rows = [];
  for (const variant of VARIANTS) {
    const object = kit.kitObject(variant.id, variant.options);
    const box = boundsOf(object);
    const tris = kit.kitTriCount(variant.id, variant.options);
    const label = `${variant.id}${variant.options.notches !== undefined ? `(${variant.options.notches})` : ''}${variant.options.stones !== undefined ? `(${variant.options.stones})` : ''}`;
    const notes = [];

    if (!finite(object)) { notes.push('NON-FINITE VERTEX'); failures.push(`${label}: non-finite vertex`); }
    if (tris > TRI_BUDGET) { notes.push(`over budget (${tris})`); failures.push(`${label}: ${tris} tris > ${TRI_BUDGET}`); }
    // Base on the ground: props sit at y = 0, with a little sink allowed for the
    // stones, which are placed slightly below the soil on purpose.
    if (box.min.y < -0.09 || box.min.y > 0.03) { notes.push(`base at ${box.min.y.toFixed(3)}`); failures.push(`${label}: base y=${box.min.y.toFixed(3)}`); }
    if (box.size.y < 0.08 || box.size.y > 2.1) { notes.push(`height ${box.size.y.toFixed(2)}`); failures.push(`${label}: height ${box.size.y.toFixed(2)}`); }
    if (box.size.x > 2.2 || box.size.z > 2.2) { notes.push('wider than the disc'); failures.push(`${label}: footprint ${box.size.x.toFixed(2)}×${box.size.z.toFixed(2)}`); }

    const again = kit.kitObject(variant.id, variant.options);
    if (signature(object) !== signature(again)) { notes.push('NOT DETERMINISTIC'); failures.push(`${label}: deterministic check`); }

    const glowCount = [];
    object.traverse((child) => { if (child.isMesh && child.material?.name === kit.GLOW_MATERIAL) glowCount.push(1); });
    if (variant.id === 'lantern' && glowCount.length !== 1) failures.push(`${label}: lantern needs exactly one glow mesh`);

    rows.push({
      label,
      tris,
      size: `${box.size.x.toFixed(2)} × ${box.size.y.toFixed(2)} × ${box.size.z.toFixed(2)}`,
      notes,
    });
  }
  return { failures, rows };
}

/**
 * Every model in the kit must have a consumer in the garden layer. The check is
 * deliberately blunt — it looks for the literal `id: '<model>'` the kit mapping
 * writes, not the bare name, so a model that only shares a name with an authored
 * prop cannot pass by accident. (The other direction — a *prop* with no answer —
 * is caught at compile time by the coverage guard in `props.ts`.)
 */
function checkKitCoverage() {
  const propsPath = path.join(__dirname, '../../src/lib/garden/props.ts');
  const source = fs.readFileSync(propsPath, 'utf8');
  return kit.KIT.filter((entry) => !source.includes(`id: '${entry.id}'`)).map((entry) => entry.id);
}

// ── render the sheet ─────────────────────────────────────────────────────────

function main() {
  const { failures, rows } = checkVariants();
  const unused = checkKitCoverage();

  const nameWidth = Math.max(...rows.map((row) => row.label.length));
  console.log('\n── kit variants ──');
  for (const row of rows) {
    console.log(
      `  ${row.label.padEnd(nameWidth)}  ${String(row.tris).padStart(4)} tris  ${row.size.padEnd(20)}  ${row.notes.join('; ')}`,
    );
  }

  const total = rows.reduce((sum, row) => sum + row.tris, 0);
  console.log(`\n  total across all variants: ${total} tris`);
  console.log(`  every model wired into the garden: ${unused.length === 0 ? 'yes' : `NO — ${unused.join(', ')}`}`);

  if (unused.length > 0) failures.push(`kit models not referenced by props.ts: ${unused.join(', ')}`);

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} failed`);
    for (const failure of failures) console.error(`   ${failure}`);
  } else {
    console.log('  ✓ all invariants hold');
  }

  if (CHECK_ONLY) process.exit(failures.length === 0 ? 0 : 1);

  // The ninth tile is the procedural tree, which is what the garden falls back
  // to when *no* GLB arrives — the one 3D thing in this app that had never been
  // looked at, since a browser on this machine has no WebGL.
  const sheetTiles = [
    { object: kit.kitObject('bench'), title: 'bench' },
    { object: kit.kitObject('signpost', { notches: 0 }), title: 'signpost (0 projects)' },
    { object: kit.kitObject('signpost', { notches: 3 }), title: 'signpost (3 projects)' },
    { object: kit.kitObject('rock', { stones: 3 }), title: 'rock (cluster)' },
    { object: kit.kitObject('grass'), title: 'grass tuft' },
    { object: kit.kitObject('fern'), title: 'fern' },
    { object: kit.kitObject('log'), title: 'fallen log' },
    { object: kit.kitObject('stump'), title: 'stump' },
    { object: kit.kitObject('lantern'), title: 'focus lantern' },
    { object: proceduralTree(), title: 'procedural tree (fallback)' },
  ];

  const rowsCount = Math.ceil(sheetTiles.length / COLUMNS);
  const width = COLUMNS * TILE;
  const height = rowsCount * TILE_H;
  const target = { width, height, buffer: Buffer.alloc(width * height * 4) };

  sheetTiles.forEach((tile, index) => {
    const x = (index % COLUMNS) * TILE;
    const y = Math.floor(index / COLUMNS) * TILE_H;
    fillBackground(target, x, y, TILE, TILE_H);

    const box = boundsOf(tile.object);
    const centre = new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      (box.min.y + box.max.y) / 2,
      (box.min.z + box.max.z) / 2,
    );
    const maxSize = Math.max(box.size.x, box.size.y, box.size.z);
    const eye = [
      centre.x + maxSize * 1.7,
      centre.y + maxSize * 1.0,
      centre.z + maxSize * 2.0,
    ];
    draw(
      target,
      x,
      y,
      TILE,
      TILE_H,
      collectTriangles(tile.object),
      eye,
      [centre.x, centre.y, centre.z],
      32,
    );
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, encodePng(width, height, target.buffer));
  console.log(`\n  sheet → ${OUT_PATH}  (${width}×${height})`);
  console.log(`  tile order: ${sheetTiles.map((tile) => tile.title).join(' | ')}\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
