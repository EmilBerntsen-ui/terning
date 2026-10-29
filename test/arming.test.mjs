import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArming, ARM_MS } from '../src/arming.js';
import { sixesFor } from '../src/dice.js';

test('nothing armed → a fair one-finger roll', () => assert.equal(createArming().take(0), 1));

test('one tap → one six, two taps → all sixes, more taps stay at all', () => {
  const a = createArming();
  a.tap(0); assert.equal(a.take(100), 2);
  a.tap(0); a.tap(300); assert.equal(a.take(400), 3);
  a.tap(0); a.tap(1); a.tap(2); assert.equal(a.take(3), 3);
  assert.equal(sixesFor(2, 4), 1);
  assert.equal(sixesFor(3, 4), 4);
});

test('it only counts for the next roll', () => {
  const a = createArming();
  a.tap(0); a.take(10);
  assert.equal(a.take(20), 1);
});

test('it is forgotten after ARM_MS, and a late second tap starts over at one six', () => {
  const a = createArming();
  a.tap(0); assert.equal(a.take(ARM_MS + 1), 1);
  a.tap(0); a.tap(ARM_MS + 1); assert.equal(a.take(ARM_MS + 2), 2);
  a.tap(0); a.tap(ARM_MS); assert.equal(a.take(2 * ARM_MS), 3);
});

test('reset forgets it (app in the background)', () => {
  const a = createArming();
  a.tap(0); a.tap(1); a.reset();
  assert.equal(a.take(2), 1);
});
