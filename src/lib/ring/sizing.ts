/** US ring sizes from 3 to 13 in quarter steps. */
export const US_SIZES: number[] = Array.from({ length: 41 }, (_, i) => 3 + i * 0.25);

/** Inner diameter in millimetres for a US ring size (US 7 ≈ 17.3 mm). */
export function innerDiameterMm(sizeUs: number): number {
  return 11.63 + 0.8128 * sizeUs;
}

/** EU (ISO 8653) size = inner circumference in millimetres, rounded. */
export function euSize(sizeUs: number): number {
  return Math.round(innerDiameterMm(sizeUs) * Math.PI);
}

/** Approximate girdle diameter of a round stone from its carat weight (1 ct ≈ 6.5 mm). */
export function stoneDiameterMm(carat: number): number {
  return 6.5 * Math.cbrt(carat);
}

export function formatUsSize(sizeUs: number): string {
  const whole = Math.floor(sizeUs);
  const frac = sizeUs - whole;
  const fracLabel = frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "";
  return `${whole}${fracLabel}`;
}
