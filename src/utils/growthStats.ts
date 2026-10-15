// Pure growth maths for the "All" page. Everything is in cm / epoch-ms.

export type HeightPoint = { t: number; cm: number };

export type SeriesStats = {
  id: string;
  name: string;
  points: HeightPoint[]; // sorted oldest → newest
};

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.4375;

export const OVERDUE_DAYS = 30;

export function daysSince(ts: number, now: number): number {
  return Math.floor((now - ts) / DAY_MS);
}

/** Change in height across the last `days` days, or null if there isn't enough data. */
export function growthOverWindow(
  points: HeightPoint[],
  days: number,
  now: number,
  minSpanDays = 14,
): { deltaCm: number; perMonthCm: number } | null {
  const from = now - days * DAY_MS;
  const inWindow = points.filter((p) => p.t >= from && p.t <= now);
  if (inWindow.length < 2) return null;

  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const spanDays = (last.t - first.t) / DAY_MS;
  if (spanDays < minSpanDays) return null;

  const deltaCm = last.cm - first.cm;
  return { deltaCm, perMonthCm: (deltaCm / spanDays) * MONTH_DAYS };
}

export type CatchUp = { shorter: SeriesStats; taller: SeriesStats; months: number };

const RATE_WINDOW_DAYS = 180;
const MAX_STALE_DAYS = 120;
const MAX_PREDICT_MONTHS = 24;
const MAX_RESULTS = 3;

/**
 * For each profile, compare against the next-taller profile and estimate when
 * the shorter one would pass it at current growth speeds. Only returns
 * realistic crossovers (see limits above).
 */
export function catchUps(series: SeriesStats[], now: number): CatchUp[] {
  const usable = series
    .filter((s) => s.points.length > 0)
    .filter((s) => daysSince(s.points[s.points.length - 1].t, now) <= MAX_STALE_DAYS)
    .map((s) => ({
      s,
      latest: s.points[s.points.length - 1].cm,
      rate: growthOverWindow(s.points, RATE_WINDOW_DAYS, now, 30)?.perMonthCm ?? null,
    }))
    .sort((a, b) => a.latest - b.latest); // shortest → tallest

  const out: CatchUp[] = [];
  for (let i = 0; i < usable.length - 1; i++) {
    const shorter = usable[i];
    const taller = usable[i + 1];
    if (shorter.rate == null || taller.rate == null) continue;

    const gap = taller.latest - shorter.latest;
    const closing = shorter.rate - taller.rate;
    if (gap <= 0 || closing <= 0) continue;

    const months = gap / closing;
    if (months > 0 && months <= MAX_PREDICT_MONTHS) {
      out.push({ shorter: shorter.s, taller: taller.s, months });
    }
  }
  return out.sort((a, b) => a.months - b.months).slice(0, MAX_RESULTS);
}

export type HeightAtAge = {
  cm: number;
  /** True when interpolated between measurements rather than read from one taken close to that age. */
  estimated: boolean;
  /** Date the age was reached. */
  at: number;
};

const SNAP_DAYS = 21;
const ESTIMATE_DAYS = 30;

/**
 * Height of someone at a given date (their birthday of that age), using the
 * measurement taken closest to it or a straight-line estimate between the two
 * surrounding measurements. Never extrapolates beyond the first/last measurement.
 */
export function heightAtDate(points: HeightPoint[], at: number): HeightAtAge | null {
  if (points.length === 0) return null;

  let nearest = points[0];
  for (const p of points) {
    if (Math.abs(p.t - at) < Math.abs(nearest.t - at)) nearest = p;
  }
  const nearestDays = Math.abs(nearest.t - at) / DAY_MS;
  if (nearestDays <= SNAP_DAYS) {
    return { cm: nearest.cm, estimated: false, at };
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (at < first.t || at > last.t) return null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (at >= a.t && at <= b.t) {
      const frac = b.t === a.t ? 0 : (at - a.t) / (b.t - a.t);
      return { cm: a.cm + (b.cm - a.cm) * frac, estimated: nearestDays > ESTIMATE_DAYS, at };
    }
  }
  return null;
}
