import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dieGeometry } from '../src/dice3d.js';
import { FACES } from '../src/dice.js';

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
