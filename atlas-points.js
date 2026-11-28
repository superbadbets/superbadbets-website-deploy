export const mix = (from, to, fraction) => from + (to - from) * fraction;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function capacityProfile({ duration, reference, limits }) {
  const interior = limits.flatMap(({ from, until }) => [from, until])
    .filter((time) => 0 < time && time < duration);
  const boundaries = [...new Set([0, ...interior, duration])].sort((a, b) => a - b);

  const segments = boundaries.slice(0, -1).map((from, i) => {
    const until = boundaries[i + 1];
    const active = limits.filter((limit) => limit.from <= from && from < limit.until);
    const rate = Math.min(reference, ...active.map((limit) => limit.rate));
    return { from, until, rate };
  });
  const mean = segments.reduce((total, { from, until, rate }) => total + (until - from) * rate, 0) / duration;
  return { segments, mean };
}
