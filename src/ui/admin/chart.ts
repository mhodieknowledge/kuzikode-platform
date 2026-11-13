/** Pure helpers for the admin bar chart (R6.2): a "nice" axis maximum and its quarter ticks. */

/** 1, 2, 2.5 or 5 × 10^n at or above the data maximum (1 when there is no positive value). */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= v) return f * p;
  return 10 * p;
}

export function chartScale(values: number[]): { top: number; ticks: number[]; allZero: boolean } {
  const max = Math.max(0, ...values.filter((v) => Number.isFinite(v)));
  const top = niceMax(max);
  return { top, ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => f * top), allZero: max === 0 };
}
