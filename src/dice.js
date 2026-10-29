// Terningernes logik. Ren logik uden DOM, bruges i browseren og testes i Node.
export const MIN_DICE = 1, MAX_DICE = 6, ROLL_MS = 1000;

const cryptoByte = () => crypto.getRandomValues(new Uint8Array(1))[0];

// 0..n-1 uden skævhed: bytes i den sidste ufuldstændige blok trækkes om.
export function randomInt(n, randomByte = cryptoByte) {
  const limit = 256 - (256 % n);
  for (;;) {
    const b = randomByte();
    if (b < limit) return b % n;
  }
}

// Antal terninger, der skal lande på 6: to fingre giver én, tre eller flere giver alle.
export function sixesFor(fingers, count) {
  if (fingers < 2) return 0;
  return fingers === 2 ? 1 : count;
}

// Rotationen er den samme for alle slag: hele omgange om begge akser, 2–3 i en tilfældig retning.
// Kun de endelige værdier afhænger af `sixes`.
export function planRoll(count, { sixes = 0 } = {}, rand = randomInt) {
  const n = Math.min(MAX_DICE, Math.max(MIN_DICE, count));
  const turns = () => (2 + rand(2)) * (rand(2) ? 1 : -1);
  const spins = Array.from({ length: n }, () => ({ x: turns(), y: turns() }));
  const final = Array.from({ length: n }, () => rand(6) + 1);
  const positions = [...final.keys()];
  for (let i = 0; i < Math.min(sixes, n); i++) {
    const j = i + rand(n - i);
    [positions[i], positions[j]] = [positions[j], positions[i]];
    final[positions[i]] = 6;
  }
  return { spins, final };
}

// Terningens rotation (rotateX, rotateY i grader), der vender `face` mod beskueren. Modstående sider giver 7.
const ORIENTATION = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
export function orientation(face) {
  const [x, y] = ORIENTATION[face];
  return { x, y };
}

// Næste vinkel fra `current`: `turns` hele omgange (fortegn = retning) og videre i samme retning til en vinkel ≡ `base` (mod 360).
export function nextAngle(current, base, turns) {
  const d = (((base - current) % 360) + 360) % 360;
  return turns >= 0 ? current + 360 * turns + d : current + 360 * turns - ((360 - d) % 360);
}
