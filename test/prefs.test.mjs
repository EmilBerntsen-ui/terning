import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCount, saveCount } from '../src/prefs.js';

const mem = (data = {}) => ({ getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } });

test('defaults to 1', () => assert.equal(loadCount(mem()), 1));

test('round-trips and clamps', () => {
  const s = mem(); saveCount(4, s); assert.equal(loadCount(s), 4);
  assert.equal(loadCount(mem({ 'terning-count': '42' })), 6);
  assert.equal(loadCount(mem({ 'terning-count': '0' })), 1);
  assert.equal(loadCount(mem({ 'terning-count': 'abc' })), 1);
});

test('throwing storage never throws', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadCount(bad), 1); assert.doesNotThrow(() => saveCount(3, bad));
});

test('missing localStorage falls back to 1', () => assert.equal(loadCount(), 1));
