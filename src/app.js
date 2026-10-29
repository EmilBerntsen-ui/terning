// Siden: forbinder terningelogikken (dice.js), fingertælleren (gesture.js) og det gemte antal (prefs.js) med DOM'en.
import { planRoll, sixesFor, randomInt, MIN_DICE, MAX_DICE, TUMBLE_FRAMES, FRAME_MS } from './dice.js';
import { createTapTracker } from './gesture.js';
import { loadCount, saveCount } from './prefs.js';

const $ = id => document.getElementById(id);
const table = $('table'), diceEl = $('dice'), sumEl = $('sum'), countEl = $('count');
const tracker = createTapTracker();
let count = loadCount();
let rolling = false;

diceEl.style.setProperty('--roll-ms', `${TUMBLE_FRAMES * FRAME_MS}ms`);

function makeDie() {
  const die = document.createElement('div');
  die.className = 'die';
  for (let i = 0; i < 9; i++) die.append(document.createElement('span'));
  return die;
}

function show(faces) {
  [...diceEl.children].forEach((die, i) => { die.dataset.face = faces[i]; });
}

function showSum(faces) {
  sumEl.textContent = faces.length > 1 ? `Sum ${faces.reduce((a, b) => a + b, 0)}` : '';
}

function layout() {
  diceEl.replaceChildren(...Array.from({ length: count }, makeDie));
  diceEl.dataset.count = count;
  countEl.textContent = count === 1 ? '1 terning' : `${count} terninger`;
  $('less').disabled = count <= MIN_DICE;
  $('more').disabled = count >= MAX_DICE;
  const { final } = planRoll(count);
  show(final);
  showSum(final);
}

// Samme animation og tid for alle slag; kun de endelige værdier afhænger af antal fingre.
function roll(fingers) {
  rolling = true;
  const { frames, final } = planRoll(count, { sixes: sixesFor(fingers, count) });
  sumEl.classList.add('pending');
  for (const die of diceEl.children) {
    die.style.setProperty('--spin', randomInt(2) ? '1' : '-1');
    die.classList.remove('rolling');
    void die.offsetWidth; // genstart animationen
    die.classList.add('rolling');
  }
  frames.forEach((faces, i) => setTimeout(() => show(faces), i * FRAME_MS));
  setTimeout(() => {
    show(final);
    showSum(final);
    sumEl.classList.remove('pending');
    for (const die of diceEl.children) die.classList.remove('rolling');
    rolling = false;
  }, frames.length * FRAME_MS);
}

function setCount(n) {
  if (rolling) return;
  count = Math.min(MAX_DICE, Math.max(MIN_DICE, n));
  saveCount(count);
  layout();
}

table.addEventListener('pointerdown', e => {
  e.preventDefault();
  try { table.setPointerCapture(e.pointerId); } catch {}
  tracker.down(e.pointerId);
});
table.addEventListener('pointerup', e => {
  e.preventDefault();
  const tap = tracker.up(e.pointerId);
  if (tap && !rolling) roll(tap.fingers);
});
table.addEventListener('pointercancel', e => tracker.cancel(e.pointerId));
table.addEventListener('contextmenu', e => e.preventDefault());
// iOS: ingen knibezoom, rulning eller systemmenuer fra tryk på bordet.
table.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, e => e.preventDefault());

$('less').addEventListener('click', () => setCount(count - 1));
$('more').addEventListener('click', () => setCount(count + 1));

layout();

if (isSecureContext && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
