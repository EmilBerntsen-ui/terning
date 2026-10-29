// Siden: forbinder terningelogikken (dice.js), fingertælleren (gesture.js) og det gemte antal (prefs.js) med DOM'en.
import { planRoll, sixesFor, MIN_DICE, MAX_DICE, ROLL_MS } from './dice.js';
import { createDice3D } from './dice3d.js';
import { createDice2D } from './dice2d.js';
import { createTapTracker } from './gesture.js';
import { createArming } from './arming.js';
import { loadCount, saveCount } from './prefs.js';

const $ = id => document.getElementById(id);
const table = $('table'), diceEl = $('dice'), sumEl = $('sum'), countEl = $('count');
const tracker = createTapTracker();
const arming = createArming();
let count = loadCount();
let rolling = false;

// Terningerne tegnes i WebGL bag DOM'en; uden WebGL bliver det flade sider i pladsholderne.
const view = createDice3D(table, diceEl) ?? createDice2D(diceEl);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// En pladsholder pr. terning i CSS-layoutet; terningen tegnes oven på den.
function makeDie() {
  const die = document.createElement('div');
  die.className = 'die';
  return die;
}

// Resultatet står også i DOM'en (#dice data-faces="3 6 1"), i layoutets rækkefølge.
function showResult(faces) {
  diceEl.dataset.faces = faces.join(' ');
  sumEl.textContent = faces.length > 1 ? `Sum ${faces.reduce((a, b) => a + b, 0)}` : '';
}

function layout() {
  const { final } = planRoll(count);
  diceEl.replaceChildren(...Array.from({ length: count }, makeDie));
  diceEl.dataset.count = count;
  countEl.textContent = count === 1 ? '1 terning' : `${count} terninger`;
  $('less').disabled = count <= MIN_DICE;
  $('more').disabled = count >= MAX_DICE;
  view.layout(final);
  showResult(final);
}

// Samme animation og tid for alle slag: bevægelsen kommer kun fra spins; kun de endelige værdier afhænger af antal fingre
// eller af forvalget (tryk på antallet, arming.js), som tæller som 2 eller 3 fingre.
function roll(fingers) {
  rolling = true;
  const { spins, final } = planRoll(count, { sixes: sixesFor(Math.max(fingers, arming.take(performance.now())), count) });
  sumEl.classList.add('pending');
  view.roll(final, spins, { instant: reducedMotion.matches });
  setTimeout(() => {
    showResult(final);
    sumEl.classList.remove('pending');
    rolling = false;
  }, ROLL_MS);
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
  if (e.isPrimary) tracker.reset(); // første finger: ingen andre er nede, så tabte pointere ryddes væk
  tracker.down(e.pointerId, e.timeStamp);
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
countEl.addEventListener('pointerup', () => arming.tap(performance.now())); // forvalg; intet ændrer sig på skærmen
$('more').addEventListener('click', () => setCount(count + 1));

layout();

// Opdatering: iOS genoptager appen uden at genindlæse, så der tjekkes, når den kommer frem igen.
// Når en ny version har taget over, genindlæses siden mellem to slag (kun antallet er tilstand, og det er gemt).
if (isSecureContext && 'serviceWorker' in navigator) {
  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller;
  sw.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  sw.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const reload = () => (rolling ? setTimeout(reload, 100) : location.reload());
    reload();
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    tracker.reset();
    arming.reset();
  }
});
