import type { ISODate } from './types';

export const today = (): ISODate => toISO(new Date());
export function toISO(d: Date): ISODate {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d);
}
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

/** UK tax year starting 6 April of `startYear`. Label "2026/27". */
export interface TaxYear { start: ISODate; end: ISODate; label: string; startYear: number }
export function taxYear(startYear: number): TaxYear {
  return {
    startYear,
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
    label: `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`,
  };
}
export function taxYearOf(d: ISODate): TaxYear {
  const [y, m, day] = d.split('-').map(Number);
  const startYear = m > 4 || (m === 4 && day >= 6) ? y : y - 1;
  return taxYear(startYear);
}
export const inRange = (d: ISODate | undefined, a: ISODate, b: ISODate) => !!d && d >= a && d <= b;

/** Making Tax Digital standard quarters for a tax year. */
export function taxQuarters(ty: TaxYear) {
  const y = ty.startYear;
  return [
    { label: 'Q1', name: 'Apr–Jul', start: `${y}-04-06`, end: `${y}-07-05`, deadline: `${y}-08-07` },
    { label: 'Q2', name: 'Jul–Oct', start: `${y}-07-06`, end: `${y}-10-05`, deadline: `${y}-11-07` },
    { label: 'Q3', name: 'Oct–Jan', start: `${y}-10-06`, end: `${y + 1}-01-05`, deadline: `${y + 1}-02-07` },
    { label: 'Q4', name: 'Jan–Apr', start: `${y + 1}-01-06`, end: `${y + 1}-04-05`, deadline: `${y + 1}-05-07` },
  ];
}

/** Month buckets for a tax year: Apr..Mar (by calendar month, for charts). */
export function taxYearMonths(ty: TaxYear) {
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(ty.startYear, 3 + i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en-GB', { month: 'short' }) });
  }
  return out;
}

/** Fraction of the tax year elapsed (0–1). */
export function yearElapsed(ty: TaxYear, now: ISODate = today()): number {
  const total = daysBetween(ty.start, ty.end) + 1;
  const done = Math.min(Math.max(daysBetween(ty.start, now) + 1, 0), total);
  return done / total;
}

export const fmtDate = (s?: ISODate) =>
  s ? parseISO(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtShort = (s?: ISODate) =>
  s ? parseISO(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
