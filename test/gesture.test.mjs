import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTapTracker, TOGETHER_MS } from '../src/gesture.js';

test('one finger → fingers 1', () => { const t = createTapTracker(); t.down(1); assert.deepEqual(t.up(1), { fingers: 1 }); });

test('two overlapping fingers → fingers 2, reported when the last lifts', () => {
  const t = createTapTracker(); t.down(1); t.down(2);
  assert.equal(t.up(1), null); assert.deepEqual(t.up(2), { fingers: 2 });
});

test('fingers in sequence are two one-finger taps', () => {
  const t = createTapTracker(); t.down(1); assert.deepEqual(t.up(1), { fingers: 1 });
  t.down(2); assert.deepEqual(t.up(2), { fingers: 1 });
});

test('a cancel aborts the gesture, the next one works', () => {
  const t = createTapTracker(); t.down(1); t.down(2); t.cancel(1);
  assert.equal(t.up(2), null); t.down(3); assert.deepEqual(t.up(3), { fingers: 1 });
});

test('cancelling the only finger resets the tracker', () => {
  const t = createTapTracker(); t.down(1); t.cancel(1);
  t.down(2); assert.deepEqual(t.up(2), { fingers: 1 });
});

test('unknown id is ignored', () => assert.equal(createTapTracker().up(99), null));

test('reset clears a pointer whose up was never delivered', () => {
  const t = createTapTracker(); t.down(1); // up for 1 is lost
  t.reset(); t.down(2); assert.deepEqual(t.up(2), { fingers: 1 });
});

test('a finger landing after TOGETHER_MS starts a new tap; the resting one is ignored', () => {
  const t = createTapTracker(); t.down(1, 0); t.down(2, TOGETHER_MS + 1);
  assert.deepEqual(t.up(2), { fingers: 1 });
  assert.equal(t.up(1), null);
});

test('fingers landing within TOGETHER_MS count together', () => {
  const t = createTapTracker(); t.down(1, 0); t.down(2, TOGETHER_MS);
  assert.equal(t.up(1), null); assert.deepEqual(t.up(2), { fingers: 2 });
});
