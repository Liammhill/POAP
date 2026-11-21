// Year-on-year analysis: seasonality, pace vs previous years, and run-rate direction.
import { addDays, daysBetween, taxYear, taxYearMonths, taxYearOf, today, type TaxYear } from './dates';
import { sum } from './format';
import type { Vault } from './types';

export type Measure = 'received' | 'invoiced';

const monthKey = (d: string) => d.slice(0, 7);
function shiftMonth(key: string, n: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function trends(v: Vault, measure: Measure, now = today()) {
  const dated = v.invoices
    .map((i) => ({ i, d: measure === 'received' ? i.paidDate : i.issueDate }))
    .filter((x): x is { i: (typeof v.invoices)[number]; d: string } => !!x.d && x.d <= now);
  const byMonth = new Map<string, number>();
  dated.forEach(({ i, d }) => byMonth.set(monthKey(d), (byMonth.get(monthKey(d)) ?? 0) + i.amount));
  const m = (k: string) => byMonth.get(k) ?? 0;

  const current = taxYearOf(now);
  const first = dated.length ? taxYearOf(dated.map((x) => x.d).sort()[0]).startYear : current.startYear;
  const years: TaxYear[] = [];
  for (let y = first; y <= current.startYear; y++) years.push(taxYear(y));
  const curMonthIdx = taxYearMonths(current).findIndex((x) => x.key === monthKey(now));
  const dayOffset = daysBetween(current.start, now);

  const firstClientDate = new Map<string, string>();
  [...v.invoices].sort((a, b) => a.issueDate.localeCompare(b.issueDate)).forEach((i) => { if (!firstClientDate.has(i.clientId)) firstClientDate.set(i.clientId, i.issueDate); });

  const rows = years.map((ty) => {
    const isCurrent = ty.startYear === current.startYear;
    const months = taxYearMonths(ty).map((x, idx) => (isCurrent && idx > curMonthIdx ? null : m(x.key)));
    let run = 0;
    const cumulative = months.map((x) => (x === null ? null : (run += x)));
    const inYear = dated.filter((x) => x.d >= ty.start && x.d <= ty.end);
    const issued = v.invoices.filter((i) => i.issueDate >= ty.start && i.issueDate <= ty.end);
    const clients = new Set(issued.map((i) => i.clientId));
    const expenses = sum(v.expenses.filter((e) => e.date >= ty.start && e.date <= ty.end), (e) => e.amount);
    const total = sum(inYear, (x) => x.i.amount);
    // Same point in the year (same number of days since 6 April).
    const cutoff = addDays(ty.start, dayOffset);
    const toDate = sum(inYear.filter((x) => x.d <= cutoff), (x) => x.i.amount);
    const firstData = dated.length ? dated.map((x) => x.d).sort()[0] : ty.start;
    return {
      ty, isCurrent, months, cumulative, total, toDate,
      partialStart: firstData > ty.start, // records start part-way through this year
      invoices: issued.length,
      avgInvoice: issued.length ? sum(issued, (i) => i.amount) / issued.length : 0,
      clients: clients.size,
      newClients: [...clients].filter((c) => (firstClientDate.get(c) ?? '') >= ty.start).length,
      expenses,
      profit: total - expenses,
    };
  });

  // Rolling 12-month total (run rate) for every month with data, up to this month.
  const thisMonth = monthKey(now);
  const firstMonth = dated.length ? monthKey(dated.map((x) => x.d).sort()[0]) : thisMonth;
  const rolling: { key: string; label: string; value: number; complete: boolean }[] = [];
  for (let k = shiftMonth(firstMonth, 11); k <= thisMonth; k = shiftMonth(k, 1)) {
    let t = 0;
    for (let j = 0; j < 12; j++) t += m(shiftMonth(k, -j));
    const [y, mm] = k.split('-').map(Number);
    rolling.push({ key: k, label: new Date(y, mm - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), value: t, complete: k !== thisMonth });
  }

  // Compare completed periods only, so a half-finished month doesn't look like a slump.
  const lastFull = shiftMonth(thisMonth, -1);
  const window = (end: string, n: number) => { let t = 0; for (let j = 0; j < n; j++) t += m(shiftMonth(end, -j)); return t; };
  const t12 = window(lastFull, 12), t12Prev = window(shiftMonth(lastFull, -12), 12);
  const q = window(lastFull, 3), qPrevYear = window(shiftMonth(lastFull, -12), 3), qPrev = window(shiftMonth(lastFull, -3), 3);
  const hasMonths = (end: string, n: number) => firstMonth <= shiftMonth(end, -(n - 1));
  const pctChange = (a: number, b: number, ok: boolean) => (ok && b > 0 ? a / b - 1 : null);

  // Seasonality: each month's share of the year, averaged over complete years.
  const complete = rows.filter((r) => !r.isCurrent && !r.partialStart && r.total > 0);
  const share = taxYearMonths(current).map((x, idx) => ({
    label: x.label,
    share: complete.length ? sum(complete, (r) => (r.months[idx] ?? 0) / r.total) / complete.length : null,
  }));
  const quiet = share.filter((s) => s.share !== null && s.share < (1 / 12) * 0.6).map((s) => s.label);
  const busy = share.filter((s) => s.share !== null && s.share > (1 / 12) * 1.4).map((s) => s.label);

  const cur = rows.at(-1)!;
  const prev = rows.at(-2);
  return {
    rows, rolling, share, quiet, busy, completeYears: complete.length,
    monthLabels: taxYearMonths(current).map((x) => x.label),
    ytd: { value: cur.toDate, prev: prev?.toDate ?? 0, change: prev && !prev.partialStart ? pctChange(cur.toDate, prev.toDate, true) : null, through: now },
    t12: { value: t12, prev: t12Prev, change: pctChange(t12, t12Prev, hasMonths(lastFull, 24)) },
    q3: { value: q, prevYear: qPrevYear, change: pctChange(q, qPrevYear, hasMonths(lastFull, 15)), vsPrev: pctChange(q, qPrev, hasMonths(lastFull, 6)), endLabel: rolling.find((r) => r.key === lastFull)?.label ?? '' },
  };
}
