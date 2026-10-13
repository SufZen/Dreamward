/** When this device last finished a weekly review (ms), or null. */
const KEY = 'dw-last-review';

export function lastReviewAt(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function markReviewed() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode: the nudge just shows again */
  }
}

/** Review is due on Friday/Saturday/Sunday when the last one is ≥ 6 days old (or never). */
export function reviewDue(): boolean {
  const day = new Date().getDay(); // 0 Sun … 6 Sat
  const weekend = day === 5 || day === 6 || day === 0;
  const last = lastReviewAt();
  return weekend && (last === null || Date.now() - last >= 6 * 86_400_000);
}
