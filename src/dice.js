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

// Siderne i terningens egne akser (x højre, y op, z ud mod beskueren). Modstående sider giver 7.
export const FACES = { 1: [0, 0, 1], 2: [0, 1, 0], 3: [1, 0, 0], 4: [-1, 0, 0], 5: [0, -1, 0], 6: [0, 0, -1] };

// Drejningen (grader om x og y), der vender `face` lige mod beskueren med prikkerne ret op.
const ORIENTATION = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
export function orientation(face) {
  const [x, y] = ORIENTATION[face];
  return { x, y };
}

// Drejer vektoren v med rotateX(x)·rotateY(y), grader: først om y, så om x. Samme rækkefølge som three.js' Euler 'XYZ'.
export function rotate([vx, vy, vz], { x, y }) {
  const a = (x * Math.PI) / 180, b = (y * Math.PI) / 180;
  const x1 = vx * Math.cos(b) + vz * Math.sin(b), z1 = vz * Math.cos(b) - vx * Math.sin(b);
  return [x1, vy * Math.cos(a) - z1 * Math.sin(a), vy * Math.sin(a) + z1 * Math.cos(a)];
}

// Siden der vender mest mod beskueren ved drejningen {x, y}.
export function facing(angles) {
  let best = 1;
  for (const face of [2, 3, 4, 5, 6]) if (rotate(FACES[face], angles)[2] > rotate(FACES[best], angles)[2]) best = face;
  return best;
}

// Sidens akser på terningen: de retninger der ender som højre, op og ud mod beskueren, når siden vender frem. Prikkerne lægges ud i dem.
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export function frame(face) {
  const o = orientation(face);
  const find = target => AXES.find(axis => rotate(axis, o).every((v, i) => Math.abs(v - target[i]) < 1e-9));
  return { right: find([1, 0, 0]), up: find([0, 1, 0]), normal: find([0, 0, 1]) };
}

// Næste vinkel fra `current`: `turns` hele omgange (fortegn = retning) og videre i samme retning til en vinkel ≡ `base` (mod 360).
export function nextAngle(current, base, turns) {
  const d = (((base - current) % 360) + 360) % 360;
  return turns >= 0 ? current + 360 * turns + d : current + 360 * turns - ((360 - d) % 360);
}

// Slutvinklerne for et slag fra `from`: spin.x og spin.y hele omgange og så videre, til `face` vender frem.
export function turn(from, face, spin) {
  const base = orientation(face);
  return { x: nextAngle(from.x, base.x, spin.x), y: nextAngle(from.y, base.y, spin.y) };
}

// Bevægelsen i et slag, som funktion af t = 0..1 (andel af ROLL_MS). Den er den samme for alle slag; kun spins og slutsiden indgår.
// Drejningen: hurtig start og blød opbremsning til stilstand, som en terning der løber ud.
export const settle = t => 1 - (1 - t) ** 3;

// Hoppets højde (0..1): op til 28 %, ned ved 58 %, et lille genhop ved 72 %, stille fra 86 %. Parabler, som ved tyngde.
export const BOUNCE = 0.23;
export function hop(t) {
  const arc = (a, top, b) => (t < top ? 1 - ((top - t) / (top - a)) ** 2 : 1 - ((t - top) / (b - top)) ** 2);
  if (t <= 0 || t >= 0.86) return 0;
  return t < 0.58 ? arc(0, 0.28, 0.58) : BOUNCE * arc(0.58, 0.72, 0.86);
}

// Stillingen ved tiden t på vej fra `from` til `to` (vinkler i grader) og hoppets højde.
export function pose(from, to, t) {
  const k = settle(t);
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, lift: hop(t) };
}

// Bevægelsessløret: hvor langt tilbage (andel af ROLL_MS) de svage ekstra billeder af terningen højst rækker. Fuldt i starten,
// aftagende og helt væk fra 75 %, så resultatet står skarpt.
export const SHUTTER = 0.011;
export function shutter(t) {
  const k = Math.min(1, Math.max(0, (0.75 - t) / 0.35));
  return SHUTTER * k * k * (3 - 2 * k);
}

// De ekstra billeder ved tiden t for terningerne `paths` ({ from, to }): op til GHOSTS øjeblikke før t, omkring GHOST_STEP grader
// fra hinanden for den terning der drejer mest (ellers ses de som trin). Kun bevægelsen indgår.
// Hvert billede lægges oven på de forrige med `alpha`, så det nyeste vejer mest og det ældste mindst: sløret toner ud uden en hård kant.
export const GHOSTS = 10, GHOST_STEP = 2;
export function blur(paths, t) {
  const span = Math.min(t, shutter(t));
  const sweep = Math.max(0, ...paths.map(({ from, to }) => {
    const a = pose(from, to, t), b = pose(from, to, t - span);
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }));
  const n = Math.min(GHOSTS, Math.ceil(sweep / GHOST_STEP));
  const reach = span * Math.min(1, (GHOSTS * GHOST_STEP) / sweep);
  let total = n + 1; // vægten af det skarpe billede; billede k (1..n) vejer n + 1 - k
  return Array.from({ length: n }, (_, i) => {
    const weight = n - i;
    total += weight;
    return { t: t - (reach * (i + 1)) / n, alpha: weight / total };
  });
}
