import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, sixesFor, planRoll, orientation, nextAngle } from '../src/dice.js';

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

test('orientation turns each face to the front; opposite faces sum to 7', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(orientation),
    [{ x: 0, y: 0 }, { x: -90, y: 0 }, { x: 0, y: -90 }, { x: 0, y: 90 }, { x: 90, y: 0 }, { x: 0, y: 180 }]);
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
