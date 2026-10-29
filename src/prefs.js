// Antal terninger huskes i localStorage. Lagring kan kaste (privat browsing, blokerede data), så alt er i try/catch.
import { MIN_DICE, MAX_DICE } from './dice.js';

const KEY = 'terning-count';

export function loadCount(storage) {
  try {
    const n = parseInt((storage ?? globalThis.localStorage).getItem(KEY), 10);
    return Number.isNaN(n) ? MIN_DICE : Math.min(MAX_DICE, Math.max(MIN_DICE, n));
  } catch {
    return MIN_DICE;
  }
}

export function saveCount(n, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(KEY, String(n));
  } catch {}
}
