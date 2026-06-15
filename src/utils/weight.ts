export type WeightUnit = 'kg' | 'lbs' | 'st';

export function toKg(primary: number, unit: WeightUnit, lbsPart = 0): number {
  if (unit === 'kg')  return primary;
  if (unit === 'lbs') return primary / 2.20462;
  // stones: primary = whole stones, lbsPart = remaining lbs
  return ((primary * 14) + lbsPart) / 2.20462;
}

export function fromKg(kg: number, unit: WeightUnit): { primary: number; secondary?: number } {
  if (unit === 'kg')  return { primary: Math.round(kg * 10) / 10 };
  if (unit === 'lbs') return { primary: Math.round(kg * 2.20462 * 10) / 10 };
  const totalLbs = kg * 2.20462;
  const stones   = Math.floor(totalLbs / 14);
  const lbs      = Math.round((totalLbs % 14) * 10) / 10;
  return { primary: stones, secondary: lbs };
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  const { primary, secondary } = fromKg(kg, unit);
  if (unit === 'kg')  return `${primary} kg`;
  if (unit === 'lbs') return `${primary} lbs`;
  return `${primary} st ${secondary} lbs`;
}

// For graph y-axis: stones profiles plot in lbs for a clean number line
export function toGraphValue(kg: number, unit: WeightUnit): number {
  if (unit === 'kg')  return Math.round(kg * 10) / 10;
  if (unit === 'lbs') return Math.round(kg * 2.20462 * 10) / 10;
  return Math.round(kg * 2.20462 * 10) / 10; // stones → use lbs on axis
}

export function graphAxisLabel(unit: WeightUnit): string {
  return unit === 'kg' ? 'kg' : 'lbs';
}
