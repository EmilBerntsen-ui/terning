// Tæller fingre i ét tryk. Fingre der lander inden for TOGETHER_MS af den første, hører til samme tryk;
// en finger der lander senere, starter et nyt tryk, og de gamle (fx en hvilende tommelfinger) ignoreres.
// Trykket rapporteres, når dets sidste finger løftes. Ren logik uden DOM; app.js fodrer den med pointerId'er og tidsstempler.
export const TOGETHER_MS = 150;

export function createTapTracker() {
  let tap = null; // { start, live: Set, size, aborted }
  return {
    // Glemmer alt, også pointere hvis op-hændelse aldrig kom (fx skærmlås midt i et tryk).
    reset() {
      tap = null;
    },
    down(id, t = 0) {
      if (!tap || t - tap.start > TOGETHER_MS) tap = { start: t, live: new Set(), size: 0, aborted: false };
      tap.live.add(id);
      tap.size = Math.max(tap.size, tap.live.size);
    },
    up(id) {
      if (!tap || !tap.live.delete(id) || tap.live.size > 0) return null;
      const result = tap.aborted ? null : { fingers: tap.size };
      tap = null;
      return result;
    },
    cancel(id) {
      if (!tap || !tap.live.delete(id)) return;
      tap.aborted = true;
      if (tap.live.size === 0) tap = null;
    },
  };
}
