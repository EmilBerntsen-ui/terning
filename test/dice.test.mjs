import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Object3D, Vector3 } from '../src/vendor/three.module.min.js';
import {
  randomInt, sixesFor, planRoll, orientation, nextAngle, FACES, rotate, facing, frame, turn, settle, hop, pose, shutter, blur,
  GHOSTS, GHOST_STEP,
} from '../src/dice.js';

const bytes = list => { let i = 0; return () => list[i++]; };

test('randomInt maps bytes and redraws the biased tail', () => {
  assert.equal(randomInt(6, bytes([0])), 0);
  assert.equal(randomInt(6, bytes([251])), 5);
  assert.equal(randomInt(6, bytes([252, 255, 7])), 1);
  assert.equal(randomInt(2, bytes([255])), 1);
});

test('sixesFor: 1 finger none, 2 fingers one, 3+ fingers all', () => {
  assert.equal(sixesFor(1, 3), 0);
  assert.equal(sixesFor(2, 1), 1);
  assert.equal(sixesFor(2, 4), 1);
  assert.equal(sixesFor(3, 4), 4);
  assert.equal(sixesFor(5, 2), 2);
});

test('fair roll takes every face from the source', () => {
  const r = planRoll(3, {}, () => 3);
  assert.deepEqual(r.final, [4, 4, 4]);
  assert.equal(r.spins.length, 3);
});

test('one forced six lands where rand puts it, the rest stay fair', () => {
  const r = planRoll(4, { sixes: 1 }, n => (n === 6 ? 0 : 2));
  assert.deepEqual(r.final, [1, 1, 6, 1]);
});

test('all sixes; the spins are the same as a fair roll', () => {
  const r = planRoll(3, { sixes: 3 }, () => 0);
  assert.deepEqual(r.final, [6, 6, 6]);
  assert.deepEqual(r.spins, planRoll(3, {}, () => 0).spins);
  assert.deepEqual(planRoll(2, { sixes: 5 }, () => 0).final, [6, 6]);
});

test('every die spins at least two whole turns on both axes', () => {
  for (const { x, y } of planRoll(6).spins) {
    assert.ok(Number.isInteger(x) && Math.abs(x) >= 2 && Math.abs(x) <= 3, `x ${x}`);
    assert.ok(Number.isInteger(y) && Math.abs(y) >= 2 && Math.abs(y) <= 3, `y ${y}`);
  }
});

const round = v => v.map(x => Math.round(x * 1e9) / 1e9 + 0);
const faces = [1, 2, 3, 4, 5, 6];

test('opposite faces sum to 7: their normals point opposite ways', () => {
  for (const f of faces) assert.deepEqual(FACES[7 - f].map(v => -v + 0), FACES[f], `${f} / ${7 - f}`);
  assert.equal(new Set(faces.map(f => FACES[f].join())).size, 6);
});

test('orientation turns each face toward the camera (+z), upright', () => {
  for (const f of faces) {
    const o = orientation(f);
    assert.ok([o.x, o.y].every(a => a % 90 === 0), `${f}: square-on`);
    assert.deepEqual(round(rotate(FACES[f], o)), [0, 0, 1], `face ${f}`);
    assert.equal(facing(o), f);
    const { right, up, normal } = frame(f);
    assert.deepEqual(normal, FACES[f]);
    assert.deepEqual(round(rotate(right, o)), [1, 0, 0], `face ${f} right`);
    assert.deepEqual(round(rotate(up, o)), [0, 1, 0], `face ${f} up`);
  }
});

test('three.js rotates the die the same way (Euler XYZ), so the drawn face is the one in data-faces', () => {
  for (const f of faces) {
    const { x, y } = orientation(f), die = new Object3D();
    die.rotation.set((x * Math.PI) / 180, (y * Math.PI) / 180, 0);
    die.updateMatrixWorld();
    const toCamera = new Vector3(...FACES[f]).applyMatrix4(die.matrixWorld).toArray();
    assert.deepEqual(round(toCamera), [0, 0, 1], `face ${f}`);
    assert.deepEqual(round(new Vector3(...frame(f).up).applyMatrix4(die.matrixWorld).toArray()), [0, 1, 0], `face ${f} upright`);
  }
});

test('face frames are right-handed, so no face is drawn mirrored', () => {
  for (const f of faces) {
    const { right: [a, b, c], up: [d, e, g], normal } = frame(f);
    assert.deepEqual([b * g - c * e, c * d - a * g, a * e - b * d].map(v => v + 0), normal, `face ${f}`);
  }
});

test('turn spins the whole turns and lands square-on with the face toward the camera', () => {
  let from = { x: 0, y: 0 };
  for (const face of [6, 1, 3, 3, 5, 2, 4, 6]) {
    for (const spin of [{ x: 2, y: -3 }, { x: -2, y: 3 }]) {
      const to = turn(from, face, spin);
      assert.equal(facing(to), face, `${JSON.stringify(from)} → ${face}`);
      assert.ok(Math.sign(to.x - from.x) === Math.sign(spin.x) && Math.abs(to.x - from.x) >= 360 * Math.abs(spin.x));
      assert.ok(Math.sign(to.y - from.y) === Math.sign(spin.y) && Math.abs(to.y - from.y) >= 360 * Math.abs(spin.y));
      assert.ok(Math.abs(to.x - from.x) < 360 * (Math.abs(spin.x) + 1) && Math.abs(to.y - from.y) < 360 * (Math.abs(spin.y) + 1));
      from = to;
    }
  }
});

test('the roll starts and ends at rest: eased spin, hop on the ground at both ends', () => {
  assert.equal(settle(0), 0);
  assert.equal(settle(1), 1);
  for (let t = 0; t < 1; t += 0.01) assert.ok(settle(t + 0.01) > settle(t), `settle rises at ${t}`);
  assert.ok(settle(0.86) > 0.99, 'all but settled when the bounce ends');
  assert.equal(hop(0), 0);
  assert.equal(hop(1), 0);
  assert.equal(hop(0.28), 1);
  assert.ok(Math.abs(hop(0.58)) < 1e-12 && hop(0.72) > 0.2 && hop(0.72) < 0.25);
  const from = { x: 90, y: -360 }, to = turn(from, 4, { x: -3, y: 2 });
  assert.deepEqual(pose(from, to, 0), { ...from, lift: 0 });
  assert.deepEqual(pose(from, to, 1), { ...to, lift: 0 });
});

test('motion blur follows only the motion, never jumps in visible steps, and is gone in the last quarter', () => {
  const paths = [{ from: { x: 0, y: 0 }, to: turn({ x: 0, y: 0 }, 6, { x: 3, y: -3 }) }, { from: { x: 0, y: 90 }, to: turn({ x: 0, y: 90 }, 2, { x: -2, y: 2 }) }];
  for (let t = 0.75; t <= 1; t += 0.05) assert.deepEqual(blur(paths, t), [], `crisp at ${t}`);
  assert.deepEqual(blur(paths, 0), []);
  assert.equal(shutter(0.75), 0);
  for (const t of [0.05, 0.2, 0.4]) {
    const ghosts = blur(paths, t);
    assert.ok(ghosts.length > 0 && ghosts.length <= GHOSTS, `${t}: ${ghosts.length}`);
    for (const [i, g] of ghosts.entries()) {
      assert.ok(g.t < t && g.t >= 0);
      const prev = i ? ghosts[i - 1].t : t;
      for (const { from, to } of paths) {
        const a = pose(from, to, prev), b = pose(from, to, g.t);
        // Evenly spaced in time; the spin slows down, so the earliest steps are a touch longer.
        assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= GHOST_STEP * 1.1, `${t}: step ${i}`);
      }
    }
    // Each ghost is blended over the previous ones; the newest image weighs most, the oldest least, and it all adds up to 1.
    const weights = ghosts.reduce((w, { alpha }) => [...w.map(v => v * (1 - alpha)), alpha], [1]);
    assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    for (let i = 1; i < weights.length; i++) assert.ok(weights[i] < weights[i - 1], `${t}: weight ${i}`);
  }
});

test('a forced six moves exactly like a fair six: same spins, same path, same blur', () => {
  const forced = planRoll(1, { sixes: 1 }, n => (n === 6 ? 2 : n - 1)); // rand(6) = 2 → 3, then forced to 6
  const fair = planRoll(1, {}, n => (n === 6 ? 5 : n - 1)); // rand(6) = 5 → 6
  assert.deepEqual(forced, fair);
  const from = { x: 0, y: 90 };
  const path = r => ({ from, to: turn(from, r.final[0], r.spins[0]) });
  for (const t of [0.1, 0.3, 0.6, 1]) {
    assert.deepEqual(pose(path(forced).from, path(forced).to, t), pose(path(fair).from, path(fair).to, t));
    assert.deepEqual(blur([path(forced)], t), blur([path(fair)], t));
  }
});

test('nextAngle spins whole turns in the given direction and lands on the base angle', () => {
  assert.equal(nextAngle(0, 0, 2), 720);
  assert.equal(nextAngle(0, 90, -2), -990);
  assert.equal(nextAngle(720, -90, 3), 720 + 1080 + 270);
  assert.equal(nextAngle(-990, 180, 2), -990 + 720 + 90);
  assert.equal(nextAngle(450, 90, 0), 450);
  for (const [cur, base, turns] of [[0, 90, 2], [-990, 180, -3], [37, -90, 2]]) {
    const a = nextAngle(cur, base, turns);
    assert.equal((((a - base) % 360) + 360) % 360, 0);
    assert.ok(turns > 0 ? a - cur >= 360 * turns : cur - a >= 360 * -turns);
  }
});

test('count is clamped to 1..6', () => {
  assert.equal(planRoll(0, {}, () => 0).final.length, 1);
  assert.equal(planRoll(9, {}, () => 0).final.length, 6);
});

test('default source is roughly uniform', () => {
  const n = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6000; i++) n[randomInt(6)]++;
  for (let f = 0; f < 6; f++) assert.ok(n[f] > 800 && n[f] < 1200, `face ${f + 1}: ${n[f]}`);
});
