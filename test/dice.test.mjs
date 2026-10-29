import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, sixesFor, planRoll, TUMBLE_FRAMES } from '../src/dice.js';

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
  assert.equal(r.frames.length, TUMBLE_FRAMES);
  assert.deepEqual(r.final, [4, 4, 4]);
});

test('one forced six lands where rand puts it, the rest stay fair', () => {
  const r = planRoll(4, { sixes: 1 }, n => (n === 6 ? 0 : 2));
  assert.deepEqual(r.final, [1, 1, 6, 1]);
});

test('all sixes; the tumble is unaffected', () => {
  const r = planRoll(3, { sixes: 3 }, () => 0);
  assert.deepEqual(r.final, [6, 6, 6]);
  assert.equal(r.frames.length, TUMBLE_FRAMES);
  assert.ok(r.frames.every(f => f.length === 3 && f.every(v => v === 1)));
  assert.deepEqual(planRoll(2, { sixes: 5 }, () => 0).final, [6, 6]);
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
