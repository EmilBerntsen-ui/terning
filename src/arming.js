// Forvalg til næste slag: tryk på antallet over bordet (#count) én gang giver én sekser, to gange alle sekser.
// Intet ses på skærmen. Det gælder kun det næste slag og glemmes efter ARM_MS. Ren logik uden DOM; app.js giver tidspunkterne.
export const ARM_MS = 15000;

export function createArming() {
  let taps = 0, last = -Infinity;
  return {
    tap(t) {
      taps = t - last <= ARM_MS ? Math.min(2, taps + 1) : 1;
      last = t;
    },
    // Forvalget som antal fingre (2 = én sekser, 3 = alle; 1 = intet), og så er det brugt.
    take(t) {
      const fingers = t - last <= ARM_MS ? taps + 1 : 1;
      this.reset();
      return fingers;
    },
    reset() {
      taps = 0;
      last = -Infinity;
    },
  };
}
