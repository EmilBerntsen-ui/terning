// Tæller fingre i ét tryk: flest samtidige pointere fra første ned til sidste op.
// Ren logik uden DOM; app.js fodrer den med pointerId'er.
export function createTapTracker() {
  const down = new Set();
  let most = 0, aborted = false;
  const reset = () => { most = 0; aborted = false; };
  return {
    down(id) {
      down.add(id);
      most = Math.max(most, down.size);
    },
    up(id) {
      if (!down.delete(id) || down.size > 0) return null;
      const result = aborted ? null : { fingers: most };
      reset();
      return result;
    },
    cancel(id) {
      down.delete(id);
      aborted = true;
      if (down.size === 0) reset();
    },
  };
}
