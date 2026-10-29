// Siden: forbinder terningelogikken (dice.js), fingertælleren (gesture.js) og det gemte antal (prefs.js) med DOM'en.
import { planRoll, sixesFor, orientation, nextAngle, MIN_DICE, MAX_DICE, ROLL_MS } from './dice.js';
import { createTapTracker } from './gesture.js';
import { loadCount, saveCount } from './prefs.js';

const $ = id => document.getElementById(id);
const table = $('table'), diceEl = $('dice'), sumEl = $('sum'), countEl = $('count');
const tracker = createTapTracker();
let count = loadCount();
let rolling = false;

diceEl.style.setProperty('--roll-ms', `${ROLL_MS}ms`);

// En terning er en 3D-terning: seks sider (hver med et 3×3-gitter af prikker) og en kerne, der lukker hjørnerne.
function makeDie() {
  const die = document.createElement('div');
  die.className = 'die';
  const cube = document.createElement('div');
  cube.className = 'cube';
  for (let face = 1; face <= 6; face++) {
    const side = document.createElement('div');
    side.className = 'face';
    side.dataset.face = face;
    for (let i = 0; i < 9; i++) side.append(document.createElement('span'));
    cube.append(side);
  }
  for (const axis of ['x', 'y', 'z']) {
    const core = document.createElement('div');
    core.className = `core core-${axis}`;
    cube.append(core);
  }
  die.append(cube);
  return die;
}

// Drejer terningen hen på `face`; med spin kører CSS-transitionen de hele omgange.
function turn(die, face, spin = { x: 0, y: 0 }) {
  const base = orientation(face);
  const x = nextAngle(Number(die.dataset.x) || 0, base.x, spin.x);
  const y = nextAngle(Number(die.dataset.y) || 0, base.y, spin.y);
  Object.assign(die.dataset, { x, y, face });
  die.firstChild.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
}

function showSum(faces) {
  sumEl.textContent = faces.length > 1 ? `Sum ${faces.reduce((a, b) => a + b, 0)}` : '';
}

function layout() {
  const { final } = planRoll(count);
  const dice = Array.from({ length: count }, makeDie);
  dice.forEach((die, i) => turn(die, final[i])); // før indsættelse, så den første stilling ikke animeres
  diceEl.replaceChildren(...dice);
  diceEl.dataset.count = count;
  countEl.textContent = count === 1 ? '1 terning' : `${count} terninger`;
  $('less').disabled = count <= MIN_DICE;
  $('more').disabled = count >= MAX_DICE;
  showSum(final);
}

// Samme animation og tid for alle slag; kun de endelige værdier afhænger af antal fingre.
function roll(fingers) {
  rolling = true;
  const { spins, final } = planRoll(count, { sixes: sixesFor(fingers, count) });
  sumEl.classList.add('pending');
  [...diceEl.children].forEach((die, i) => {
    die.classList.remove('rolling');
    void die.offsetWidth; // genstart hop-animationen
    die.classList.add('rolling');
    turn(die, final[i], spins[i]);
  });
  setTimeout(() => {
    showSum(final);
    sumEl.classList.remove('pending');
    for (const die of diceEl.children) die.classList.remove('rolling');
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
  if (document.visibilityState === 'hidden') tracker.reset();
});
