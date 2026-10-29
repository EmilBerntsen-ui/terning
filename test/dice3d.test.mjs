import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix4, Quaternion, Vector3 } from '../src/vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../src/vendor/RoundedBoxGeometry.js';
import { dieGeometry } from '../src/dice3d.js';
import { FACES, orientation, planRoll, pose, spot, turn } from '../src/dice.js';

const [body, pips] = dieGeometry();
const key = (p, i) => [p[i], p[i + 1], p[i + 2]].map(v => Math.round(v * 1e5)).join();

test('the die is one closed, consistently wound surface: no seams or gaps to see through', () => {
  const edges = new Set();
  for (const g of [body, pips]) {
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) {
      const k = [key(p, i), key(p, i + 3), key(p, i + 6)];
      assert.equal(new Set(k).size, 3, 'no degenerate triangles');
      for (let j = 0; j < 3; j++) {
        const edge = `${k[j]}>${k[(j + 1) % 3]}`;
        assert.ok(!edges.has(edge), `edge used twice the same way: ${edge}`);
        edges.add(edge);
      }
    }
  }
  for (const edge of edges) {
    const [a, b] = edge.split('>');
    assert.ok(edges.has(`${b}>${a}`), `open edge ${edge}`);
  }
});

test('face n has n pips, each a hole below the surface', () => {
  const p = pips.attributes.position.array, n = pips.attributes.normal.array;
  for (const [face, normal] of Object.entries(FACES)) {
    const bottoms = new Set();
    for (let i = 0; i < p.length; i += 3) {
      if ([0, 1, 2].every(j => Math.abs(n[i + j] - normal[j]) < 1e-6)) bottoms.add(key(p, i));
    }
    assert.equal(bottoms.size, Number(face), `face ${face}`);
    for (const b of bottoms) {
      const depth = b.split(',').map(Number).reduce((s, v, j) => s + (v / 1e5) * normal[j], 0);
      assert.ok(depth < 0.48 && depth > 0.4, `face ${face}: pip bottom at ${depth}`);
    }
  }
});

// Screen outline (convex hull, CSS px) of a die, seen as dice3d.js sees it: from a camera 6 sizes straight above its cell.
const corners = (() => {
  const p = new RoundedBoxGeometry(1, 1, 1, 2, 0.1).attributes.position.array, out = new Map(); // same outside as the die, fewer points
  for (let i = 0; i < p.length; i += 3) out.set(key(p, i), new Vector3(p[i], p[i + 1], p[i + 2]));
  return [...out.values()];
})();
function outline(cell, center, size, many, from, to, t) {
  const { x, y, lift } = pose(from, to, t), at = spot(cell, center, t, many), D = 6 * size;
  const m = new Matrix4().compose(
    new Vector3(at.x, at.y + 0.22 * size * lift, many ? 0 : D * (1 - 1 / 1.08) * lift),
    new Quaternion().setFromEuler(new Euler((x * Math.PI) / 180, (y * Math.PI) / 180, 0)),
    new Vector3(1, 1, 1).multiplyScalar((size / (1 + 0.5 / 6)) * at.scale),
  );
  const pts = corners.map(c => { const v = c.clone().applyMatrix4(m), k = D / (D - v.z); return [cell.x + (v.x - cell.x) * k, cell.y + (v.y - cell.y) * k]; });
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => list.reduce((h, q) => { while (h.length >= 2 && cross(h.at(-2), h.at(-1), q) <= 0) h.pop(); h.push(q); return h; }, []);
  return [...half(pts).slice(0, -1), ...half(pts.reverse()).slice(0, -1)];
}
// How far two convex outlines overlap (separating axes); 0 when they don't touch.
function overlap(a, b) {
  let least = Infinity;
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const [p, q] = [poly[i], poly[(i + 1) % poly.length]], n = [q[1] - p[1], p[0] - q[0]], len = Math.hypot(...n);
    const pa = a.map(v => (v[0] * n[0] + v[1] * n[1]) / len), pb = b.map(v => (v[0] * n[0] + v[1] * n[1]) / len);
    least = Math.min(least, Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)));
    if (least <= 0) return 0;
  }
  return least;
}

test('tumbling dice keep clear of each other (390 px wide phone layouts)', () => {
  let seed = 7;
  const rand = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
  const layouts = { // CSS --size and cell centres (y up) at 390 px
    2: [148, [[-83, 0], [83, 0]]],
    3: [101, [[-119, 0], [0, 0], [119, 0]]],
    4: [130, [[-74, 74], [74, 74], [-74, -74], [74, -74]]],
    6: [101, [[-119, 59.5], [0, 59.5], [119, 59.5], [-119, -59.5], [0, -59.5], [119, -59.5]]],
  };
  for (const [count, [size, centres]] of Object.entries(layouts)) {
    const cells = centres.map(([x, y]) => ({ x, y })), center = { x: 0, y: 0 };
    let angles = cells.map(() => orientation(1)), frames = 0, touching = 0, worst = 0;
    for (let r = 0; r < 25; r++) {
      const { spins, final } = planRoll(+count, {}, rand);
      const paths = angles.map((from, i) => ({ from, to: turn(from, final[i], spins[i]) }));
      angles = paths.map(p => p.to);
      for (let f = 1; f <= 60; f++) {
        const shapes = cells.map((cell, i) => outline(cell, center, size, true, paths[i].from, paths[i].to, f / 60));
        let most = 0;
        for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) most = Math.max(most, overlap(shapes[i], shapes[j]));
        frames++;
        if (most > 1) touching++;
        worst = Math.max(worst, most);
      }
    }
    assert.ok(touching / frames < 0.01, `${count} dice touch in ${touching}/${frames} frames`);
    assert.ok(worst < 12, `${count} dice overlap up to ${worst.toFixed(1)} px`);
  }
});
