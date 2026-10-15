// Calendar-based age helpers. Dates are epoch-ms.

/** Whole months between dob and `at` (never negative). */
export function ageInMonths(dob: number, at: number): number {
  const a = new Date(dob);
  const b = new Date(at);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return Math.max(0, months);
}

/** "12 years, 3 months", "1 year", "5 months", "Newborn". */
export function formatAge(dob: number, at: number): string {
  const total = ageInMonths(dob, at);
  const years = Math.floor(total / 12);
  const months = total % 12;
  const y = `${years} year${years === 1 ? '' : 's'}`;
  const m = `${months} month${months === 1 ? '' : 's'}`;
  if (years === 0) return total === 0 ? 'Newborn' : m;
  return months === 0 ? y : `${y}, ${m}`;
}

/** The moment a person born at `dob` reaches `ageYears` (supports halves, e.g. 1.5). */
export function dateAtAge(dob: number, ageYears: number): number {
  const d = new Date(dob);
  d.setMonth(d.getMonth() + Math.round(ageYears * 12));
  return d.getTime();
}

/** "6 mo", "1 yr", "1.5 yrs", "10 yrs". */
export function formatAgeLabel(ageYears: number): string {
  if (ageYears < 1) return `${Math.round(ageYears * 12)} mo`;
  return `${ageYears} ${ageYears === 1 ? 'yr' : 'yrs'}`;
}
