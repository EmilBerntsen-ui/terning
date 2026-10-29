// Reserve uden WebGL: flade terningesider i pladsholderne, et 3×3-gitter af prikker. Et lille hop, og resultatet står der.
import { ROLL_MS } from './dice.js';

// Prikkerne i gitteret, nummereret 1–9 række for række (som de 3D-sider: 2 og 3 skråt fra øverst til højre, 6 i to søjler).
const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const HOP = [
  { transform: 'none' },
  { transform: 'translateY(-22%) scale(1.08)', offset: 0.28 },
  { transform: 'none', offset: 0.58 },
  { transform: 'translateY(-5%)', offset: 0.72 },
  { transform: 'none' },
];

export function createDice2D(diceEl) {
  const show = (die, face) => {
    die.dataset.face = face;
    [...die.children].forEach((pip, i) => pip.classList.toggle('on', PIPS[face].includes(i + 1)));
  };
  return {
    layout(faces) {
      [...diceEl.children].forEach((die, i) => {
        die.classList.add('flat');
        die.replaceChildren(...Array.from({ length: 9 }, () => document.createElement('span')));
        show(die, faces[i]);
      });
    },
    roll(faces, spins, { instant = false } = {}) {
      [...diceEl.children].forEach((die, i) => {
        show(die, faces[i]);
        if (!instant) die.animate(HOP, { duration: ROLL_MS, easing: 'cubic-bezier(.3, .6, .4, 1)' });
      });
    },
  };
}
