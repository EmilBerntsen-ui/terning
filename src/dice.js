// Terningernes logik. Ren logik uden DOM, bruges i browseren og testes i Node.
export const MIN_DICE = 1, MAX_DICE = 6, TUMBLE_FRAMES = 8, FRAME_MS = 70;

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

// Animationen er den samme for alle slag. Kun de endelige værdier afhænger af `sixes`.
export function planRoll(count, { sixes = 0 } = {}, rand = randomInt) {
  const n = Math.min(MAX_DICE, Math.max(MIN_DICE, count));
  const face = () => rand(6) + 1;
  const faces = () => Array.from({ length: n }, face);
  const frames = Array.from({ length: TUMBLE_FRAMES }, faces);
  const final = faces();
  const positions = [...final.keys()];
  for (let i = 0; i < Math.min(sixes, n); i++) {
    const j = i + rand(n - i);
    [positions[i], positions[j]] = [positions[j], positions[i]];
    final[positions[i]] = 6;
  }
  return { frames, final };
}
