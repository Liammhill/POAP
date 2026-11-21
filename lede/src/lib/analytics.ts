import { addDays, daysBetween, inRange, taxQuarters, taxYear, taxYearMonths, taxYearOf, today, yearElapsed, type TaxYear } from './dates';
import { sum } from './format';
import { estimate, mtdStatus } from './tax';
import type { Client, Deal, Invoice, ISODate, Vault } from './types';

export type InvStatus = 'paid' | 'overdue' | 'due';
export const invStatus = (i: Invoice, now = today()): InvStatus => (i.paidDate ? 'paid' : i.dueDate < now ? 'overdue' : 'due');

/** Which date counts an invoice into a period: received date (cash basis) or issue date (accruals). */
export const incomeDate = (i: Invoice, basis: 'cash' | 'accruals') => (basis === 'cash' ? i.paidDate : i.issueDate);

export function taxYearsWithData(v: Vault): TaxYear[] {
  const ys = new Set<number>([taxYearOf(today()).startYear]);
  v.invoices.forEach((i) => { ys.add(taxYearOf(i.issueDate).startYear); if (i.paidDate) ys.add(taxYearOf(i.paidDate).startYear); });
  v.expenses.forEach((e) => ys.add(taxYearOf(e.date).startYear));
  return [...ys].sort((a, b) => b - a).map(taxYear);
}

export function financeSummary(v: Vault, ty: TaxYear) {
  const s = v.settings;
  const now = today();
  const issued = v.invoices.filter((i) => inRange(i.issueDate, ty.start, ty.end));
  const received = v.invoices.filter((i) => inRange(i.paidDate, ty.start, ty.end));
  const income = v.invoices.filter((i) => inRange(incomeDate(i, s.basis), ty.start, ty.end));
  const expenses = v.expenses.filter((e) => inRange(e.date, ty.start, ty.end));
  const outstanding = v.invoices.filter((i) => !i.paidDate);
  const overdue = outstanding.filter((i) => i.dueDate < now);

  const months = taxYearMonths(ty).map((m) => ({
    ...m,
    paid: sum(issued.filter((i) => i.issueDate.startsWith(m.key) && i.paidDate), (i) => i.amount),
    unpaid: sum(issued.filter((i) => i.issueDate.startsWith(m.key) && !i.paidDate), (i) => i.amount),
    received: sum(received.filter((i) => i.paidDate!.startsWith(m.key)), (i) => i.amount),
  }));

  const quarters = taxQuarters(ty).map((q) => {
    const qi = v.invoices.filter((i) => inRange(i.issueDate, q.start, q.end));
    const qe = v.expenses.filter((e) => inRange(e.date, q.start, q.end));
    return {
      ...q,
      invoiced: sum(qi, (i) => i.amount),
      paid: sum(qi.filter((i) => i.paidDate), (i) => i.amount),
      unpaid: sum(qi.filter((i) => !i.paidDate), (i) => i.amount),
      income: sum(v.invoices.filter((i) => inRange(incomeDate(i, s.basis), q.start, q.end)), (i) => i.amount),
      expenses: sum(qe, (e) => e.amount),
      count: qi.length,
    };
  });

  const incomeTotal = sum(income, (i) => i.amount);
  const expenseTotal = sum(expenses, (e) => e.amount);
  // Trading allowance: £1,000 instead of actual expenses if that's better.
  const deduction = Math.max(expenseTotal, Math.min(1000, incomeTotal));
  const profitYTD = Math.max(0, incomeTotal - deduction);

  // Projection for the full year.
  const isCurrent = inRange(now, ty.start, ty.end);
  const elapsed = isCurrent ? yearElapsed(ty, now) : 1;
  let projectedIncome = incomeTotal;
  if (isCurrent) {
    if (s.projection === 'runrate') projectedIncome = elapsed > 0.05 ? incomeTotal / elapsed : incomeTotal;
    else {
      const unpaid = s.basis === 'cash' ? sum(outstanding, (i) => i.amount) : 0;
      const pipe = sum(v.deals.filter((d) => d.stage !== 'Lost' && d.stage !== 'Won'), (d) => (d.value * d.probability) / 100);
      projectedIncome = incomeTotal + unpaid + pipe;
    }
  }
  const projectedExpenses = isCurrent && elapsed > 0.05 ? expenseTotal / elapsed : expenseTotal;
  const projectedProfit = Math.max(0, projectedIncome - Math.max(projectedExpenses, Math.min(1000, projectedIncome)));

  const taxYTD = estimate(profitYTD, s.otherIncome, s.tax);
  const taxProjected = estimate(projectedProfit, s.otherIncome, s.tax);
  const shouldHaveSaved = taxProjected.total * elapsed;
  const monthsLeft = isCurrent ? Math.max(1, Math.ceil((1 - elapsed) * 12)) : 1;
  const stillToSave = Math.max(0, taxProjected.total - s.taxPot);

  // VAT: rolling 12-month taxable turnover (by invoice date).
  const vat12 = sum(v.invoices.filter((i) => i.issueDate > addDays(now, -365) && i.issueDate <= now), (i) => i.amount);

  // MTD qualifying income uses gross self-employment income.
  const mtd = mtdStatus(Math.max(incomeTotal, isCurrent ? projectedIncome : 0));

  return {
    ty, issued, received, income, expenses, outstanding, overdue, months, quarters, isCurrent, elapsed,
    invoiced: sum(issued, (i) => i.amount),
    receivedTotal: sum(received, (i) => i.amount),
    outstandingTotal: sum(outstanding, (i) => i.amount),
    overdueTotal: sum(overdue, (i) => i.amount),
    incomeTotal, expenseTotal, deduction, profitYTD, projectedIncome, projectedProfit,
    taxYTD, taxProjected, shouldHaveSaved, stillToSave,
    monthlySetAside: taxProjected.total / 12,
    catchUpMonthly: stillToSave / monthsLeft,
    onTrackGap: s.taxPot - shouldHaveSaved,
    vat12, mtd,
  };
}

/** Key UK sole-trader deadlines in the next ~6 months. */
export function deadlines(now: ISODate = today()) {
  const ty = taxYearOf(now);
  const y = ty.startYear;
  const list: { date: ISODate; title: string; detail: string }[] = [];
  for (const yr of [y - 1, y]) {
    list.push({ date: `${yr + 1}-01-31`, title: 'Self Assessment & tax bill', detail: `File ${yr - 1}/${String(yr % 100).padStart(2, '0')} return, pay balancing payment + 1st payment on account for ${yr}/${String((yr + 1) % 100).padStart(2, '0')}` });
    list.push({ date: `${yr + 1}-07-31`, title: '2nd payment on account', detail: `For the ${yr}/${String((yr + 1) % 100).padStart(2, '0')} tax year` });
    list.push({ date: `${yr + 1}-10-05`, title: 'Register for Self Assessment', detail: 'Only if newly self-employed last tax year' });
    taxQuarters(taxYear(yr)).forEach((q) => list.push({ date: q.deadline, title: `MTD quarterly update · ${q.label}`, detail: `If in scope: update for ${q.name} (period to ${q.end.slice(8)}/${q.end.slice(5, 7)})` }));
    list.push({ date: `${yr}-04-05`, title: 'Tax year ends', detail: 'Last day to count income & expenses in this year' });
  }
  const horizon = addDays(now, 190);
  return list.filter((d) => d.date >= now && d.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Clients ----------
export type Tier = 'Key client' | 'Valued' | 'Occasional' | 'Dormant' | 'New';
export interface ClientStats {
  client: Client;
  lifetime: number;
  last12: number;
  count: number;
  lastInvoice?: ISODate;
  firstInvoice?: ISODate;
  outstanding: number;
  share: number; // of last-12m income
  score: number; // 0–100
  tier: Tier;
  daysSinceContact?: number;
  contactDue: boolean;
  avgDaysToPay?: number;
}

export function clientStats(v: Vault): ClientStats[] {
  const now = today();
  const yearAgo = addDays(now, -365);
  const total12 = sum(v.invoices.filter((i) => i.issueDate > yearAgo), (i) => i.amount) || 1;
  const raw = v.clients.map((c) => {
    const inv = v.invoices.filter((i) => i.clientId === c.id).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
    const last12 = sum(inv.filter((i) => i.issueDate > yearAgo), (i) => i.amount);
    const paid = inv.filter((i) => i.paidDate);
    const lastContact = [c.lastContacted, inv.at(-1)?.issueDate].filter(Boolean).sort().at(-1) as ISODate | undefined;
    return {
      client: c,
      lifetime: sum(inv, (i) => i.amount),
      last12,
      count: inv.length,
      firstInvoice: inv[0]?.issueDate,
      lastInvoice: inv.at(-1)?.issueDate,
      outstanding: sum(inv.filter((i) => !i.paidDate), (i) => i.amount),
      share: last12 / total12,
      daysSinceContact: lastContact ? daysBetween(lastContact, now) : undefined,
      avgDaysToPay: paid.length ? sum(paid, (i) => daysBetween(i.issueDate, i.paidDate!)) / paid.length : undefined,
    };
  });
  const maxLife = Math.max(1, ...raw.map((r) => r.lifetime));
  const max12 = Math.max(1, ...raw.map((r) => r.last12));
  return raw.map((r) => {
    const recency = r.lastInvoice ? Math.max(0, 1 - daysBetween(r.lastInvoice, now) / 730) : 0;
    const frequency = Math.min(1, r.count / 6);
    const score = Math.round(100 * (0.4 * (r.last12 / max12) + 0.25 * (r.lifetime / maxLife) + 0.2 * recency + 0.15 * frequency));
    let tier: Tier;
    if (!r.count) tier = 'New';
    else if (r.lastInvoice && daysBetween(r.lastInvoice, now) > 450) tier = 'Dormant';
    else if (score >= 60) tier = 'Key client';
    else if (score >= 30) tier = 'Valued';
    else tier = 'Occasional';
    // Keep in touch more often with more valuable clients.
    const cadence = tier === 'Key client' ? 30 : tier === 'Valued' ? 60 : tier === 'Dormant' ? 120 : 90;
    const followUpDue = !!r.client.nextFollowUp && r.client.nextFollowUp <= now;
    const contactDue = followUpDue || (r.daysSinceContact !== undefined && r.daysSinceContact > cadence);
    return { ...r, score, tier, contactDue };
  }).sort((a, b) => b.score - a.score || b.lifetime - a.lifetime);
}

// ---------- Pipeline ----------
export type Heat = 'warm' | 'cooling' | 'stale';
export function dealHeat(d: Deal, staleDays: number, now = today()): { heat: Heat; idle: number; reason?: string } {
  const idle = daysBetween(d.lastActivity, now);
  if (d.expectedStart && d.expectedStart < now && d.stage !== 'Won')
    return { heat: 'stale', idle, reason: 'Expected start has passed' };
  if (idle > staleDays * 2) return { heat: 'stale', idle, reason: `No activity for ${idle} days` };
  if (idle > staleDays) return { heat: 'cooling', idle, reason: `Quiet for ${idle} days` };
  return { heat: 'warm', idle };
}
export const STAGES = ['Lead', 'In conversation', 'Proposal sent', 'Negotiating', 'Won', 'Lost'] as const;
export const STAGE_PROB: Record<string, number> = { Lead: 10, 'In conversation': 25, 'Proposal sent': 50, Negotiating: 75, Won: 100, Lost: 0 };

export const clientName = (v: Vault, id?: string, fallback?: string) => v.clients.find((c) => c.id === id)?.name ?? fallback ?? '—';
