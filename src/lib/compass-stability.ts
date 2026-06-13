export function circularSpreadDeg(angles: number[]): number {
  if (angles.length < 2) return 0;
  const sorted = [...angles].sort((a, b) => a - b);
  let largestGap = sorted[0] + 360 - sorted[sorted.length - 1];
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > largestGap) largestGap = gap;
  }
  return 360 - largestGap;
}
