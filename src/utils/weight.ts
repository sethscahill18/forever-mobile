export type HeightUnit = 'cm' | 'ft';

export function toCm(primary: number, unit: HeightUnit, inchesPart = 0): number {
  if (unit === 'cm') return primary;
  // ft: primary = whole feet, inchesPart = remaining inches
  return (primary * 30.48) + (inchesPart * 2.54);
}

export function fromCm(cm: number, unit: HeightUnit): { primary: number; secondary?: number } {
  if (unit === 'cm') return { primary: Math.round(cm * 10) / 10 };
  const totalInches = cm / 2.54;
  const feet        = Math.floor(totalInches / 12);
  const inches      = Math.round((totalInches % 12) * 10) / 10;
  return { primary: feet, secondary: inches };
}

export function formatHeight(cm: number, unit: HeightUnit): string {
  const { primary, secondary } = fromCm(cm, unit);
  if (unit === 'cm') return `${primary} cm`;
  return `${primary} ft ${secondary} in`;
}

// For graph y-axis: ft profiles plot in total inches for a clean number line
export function toGraphValue(cm: number, unit: HeightUnit): number {
  if (unit === 'cm') return Math.round(cm * 10) / 10;
  return Math.round((cm / 2.54) * 10) / 10;
}

export function graphAxisLabel(unit: HeightUnit): string {
  return unit === 'cm' ? 'cm' : 'in';
}
