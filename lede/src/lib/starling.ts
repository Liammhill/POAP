// Starling Bank statement import: turns a CSV export into income and expenses,
// remembering how each counterparty should be treated so monthly re-imports are one click.
import { addDays, today, toISO } from './dates';
import { uid } from './format';
import type { BankRule, Client, ExpenseCategory, Vault } from './types';

export interface Txn { date: string; counterparty: string; reference: string; type: string; amount: number; category: string; key: string }
export interface Group { name: string; dir: 'in' | 'out'; total: number; count: number; txns: Txn[]; hint: string }

const COLS = {
  date: /^date$/i,
  counterparty: /counter ?party|payee|name/i,
  reference: /reference|description/i,
  type: /^type$/i,
  amount: /^amount/i,
  category: /spending category|category/i,
};

export function looksLikeStarling(headers: unknown[]) {
  const h = headers.map(String);
  return h.some((x) => /counter ?party/i.test(x)) && h.some((x) => /^amount/i.test(x));
}

function date(v: unknown): string | undefined {
  if (v instanceof Date && !isNaN(+v)) return toISO(v);
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  return iso?.[0];
}

export function parseStarling(grid: unknown[][]): Txn[] {
  const hr = grid.findIndex((r) => looksLikeStarling(r));
  if (hr < 0) throw new Error('This doesn’t look like a Starling statement — expected “Counter Party” and “Amount (GBP)” columns.');
  const headers = grid[hr].map(String);
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, re]) => [k, headers.findIndex((h) => re.test(h))])) as Record<keyof typeof COLS, number>;
  const get = (r: unknown[], k: keyof typeof COLS) => (idx[k] >= 0 ? r[idx[k]] : '');
  return grid.slice(hr + 1).flatMap((r) => {
    const d = date(get(r, 'date'));
    const amount = Number(String(get(r, 'amount')).replace(/[£,\s]/g, ''));
    if (!d || !amount || isNaN(amount)) return [];
    const counterparty = String(get(r, 'counterparty')).trim() || 'Unknown';
    const reference = String(get(r, 'reference')).trim();
    return [{ date: d, counterparty, reference, type: String(get(r, 'type')).trim(), amount, category: String(get(r, 'category')).trim(),
      key: `starling|${d}|${amount.toFixed(2)}|${counterparty}|${reference}` }];
  });
}

export const ruleKey = (dir: 'in' | 'out', name: string) => `${dir}:${name.toLowerCase().replace(/\s+/g, ' ').trim()}`;

export function groupTxns(txns: Txn[]): Group[] {
  const map = new Map<string, Group>();
  for (const t of txns) {
    const dir = t.amount > 0 ? 'in' : 'out';
    const k = ruleKey(dir, t.counterparty);
    const g = map.get(k) ?? { name: t.counterparty, dir, total: 0, count: 0, txns: [], hint: '' };
    g.total += Math.abs(t.amount); g.count++; g.txns.push(t);
    g.hint = [t.type, t.category].filter(Boolean).join(' · ').replace(/_/g, ' ').toLowerCase();
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => (a.dir === b.dir ? b.total - a.total : a.dir === 'in' ? -1 : 1));
}

export const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Nhs|Cic|Ltd|Uk|Llp|Plc)\b/g, (w) => w.toUpperCase());

const NOT_INCOME = /hmrc|interest|starling|refund|cashback|transfer|savings|\bpot\b|loan|director/i;
const NOT_EXPENSE = /hmrc|tax|transfer|savings|\bpot\b|personal|salary|drawings/i;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function guessCategory(t: Txn): ExpenseCategory {
  const s = `${t.category} ${t.counterparty} ${t.reference}`.toLowerCase();
  if (/travel|transport|trainline|rail|tfl|uber|fuel|parking/.test(s)) return 'Travel';
  if (/phone|mobile|broadband|internet|vodafone|\bee\b|o2|bt |sky/.test(s)) return 'Phone & internet';
  if (/software|subscription|adobe|canva|microsoft|google|zoom|notion|dropbox|apple\.com/.test(s)) return 'Software & subscriptions';
  if (/training|course|cipr|education|conference/.test(s)) return 'Training & CPD';
  if (/account|legal|insurance|professional|membership/.test(s)) return 'Professional fees';
  if (/marketing|advert|linkedin|print/.test(s)) return 'Marketing';
  if (/equipment|office|stationery|amazon|currys|apple store/.test(s)) return 'Office & equipment';
  return 'Other';
}

/** Saved rule, else a sensible guess. */
export function defaultRule(g: Group, v: Vault): BankRule | { kind: 'new' } {
  const saved = v.settings.bankRules[ruleKey(g.dir, g.name)];
  if (saved && (saved.kind !== 'client' || v.clients.some((c) => c.id === saved.clientId))) return saved;
  const owner = v.settings.ownerName.split(' ').filter((w) => w.length > 2).map((w) => w.toLowerCase());
  const isOwner = owner.some((w) => g.name.toLowerCase().includes(w));
  if (g.dir === 'in') {
    if (isOwner || NOT_INCOME.test(`${g.name} ${g.hint}`)) return { kind: 'ignore' };
    const n = norm(g.name);
    const match = v.clients.find((c) => { const cn = norm(c.name); return cn === n || (n.length >= 6 && (cn.startsWith(n) || n.startsWith(cn))); });
    return match ? { kind: 'client', clientId: match.id } : { kind: 'new' };
  }
  if (isOwner || NOT_EXPENSE.test(`${g.name} ${g.hint}`)) return { kind: 'ignore' };
  return { kind: 'expense', category: guessCategory(g.txns[0]) };
}

export interface ImportResult { vault: Vault; income: number; reconciled: number; expenses: number; skipped: number; newClients: number }

export function applyStarling(v: Vault, groups: Group[], choice: Record<string, BankRule | { kind: 'new' }>): ImportResult {
  const known = new Set([...v.invoices.map((i) => i.bankRef), ...v.expenses.map((e) => e.bankRef)].filter(Boolean));
  const clients: Client[] = [...v.clients];
  const invoices = [...v.invoices];
  const expenses = [...v.expenses];
  const rules = { ...v.settings.bankRules };
  const r = { income: 0, reconciled: 0, expenses: 0, skipped: 0, newClients: 0 };

  for (const g of groups) {
    const k = ruleKey(g.dir, g.name);
    let rule = choice[k];
    if (rule.kind === 'new') {
      const c: Client = { id: uid(), name: titleCase(g.name), sector: 'Charity / NFP', createdAt: today() };
      clients.push(c); r.newClients++;
      rule = { kind: 'client', clientId: c.id };
    }
    rules[k] = rule;
    for (const t of g.txns) {
      if (known.has(t.key) || rule.kind === 'ignore') { r.skipped++; continue; }
      if (rule.kind === 'expense') {
        expenses.push({ id: uid(), date: t.date, description: [titleCase(t.counterparty), t.reference].filter(Boolean).join(' — '), category: rule.category, amount: Math.abs(t.amount), bankRef: t.key });
        r.expenses++;
        continue;
      }
      const clientId = rule.clientId;
      // Match an expected (unpaid) invoice for this client of the same amount, raised before the payment.
      const open = invoices.findIndex((i) => i.clientId === clientId && !i.paidDate && Math.abs(i.amount - t.amount) < 0.01 && i.issueDate <= t.date);
      if (open >= 0) {
        invoices[open] = { ...invoices[open], paidDate: t.date, bankRef: t.key };
        r.reconciled++;
      } else {
        invoices.push({ id: uid(), number: t.reference || `Payment ${t.date}`, clientId, description: t.reference || 'Payment received', issueDate: t.date, dueDate: t.date, paidDate: t.date, amount: t.amount, profile: 3, bankRef: t.key });
        r.income++;
      }
    }
  }
  return { ...r, vault: { ...v, clients, invoices, expenses, settings: { ...v.settings, bankRules: rules } } };
}

/** A fictional Starling-style statement, for the demo. */
export function sampleStarlingCsv(): string {
  const rows: (string | number)[][] = [['Date', 'Counter Party', 'Reference', 'Type', 'Amount (GBP)', 'Balance (GBP)', 'Spending Category', 'Notes']];
  const fmt = (iso: string) => iso.split('-').reverse().join('/');
  let bal = 8200;
  const add = (daysAgo: number, cp: string, ref: string, type: string, amt: number, cat: string) => { bal += amt; rows.push([fmt(addDays(today(), -daysAgo)), cp, ref, type, amt.toFixed(2), bal.toFixed(2), cat, '']); };
  add(58, 'RIVERSIDE HOUSING TRUS', 'INV EH-031', 'FASTER_PAYMENT', 2600, 'INCOME');
  add(55, 'ADOBE SYSTEMS', 'Creative Cloud', 'CARD', -54.99, 'SUBSCRIPTIONS');
  add(50, 'TRAINLINE', 'London return', 'ONLINE_PAYMENT', -86.4, 'TRAVEL');
  add(44, 'BRIGHTPATH LEARNING LTD', 'EH-032', 'FASTER_PAYMENT', 2400, 'INCOME');
  add(40, 'E HERZOG', 'To personal', 'FASTER_PAYMENT', -2500, 'TRANSFERS');
  add(35, 'HMRC SELF ASSESSMENT', 'UTR payment', 'FASTER_PAYMENT', -1800, 'TAX');
  add(30, 'VODAFONE', 'Mobile', 'DIRECT_DEBIT', -32, 'BILLS_AND_SERVICES');
  add(26, 'GREENWAY FOUNDATION', 'Workshop fee', 'FASTER_PAYMENT', 1500, 'INCOME');
  add(21, 'CIPR', 'Membership', 'CARD', -255, 'GENERAL');
  add(14, 'KINDRED HOSPICE CARE', 'Legacy campaign', 'FASTER_PAYMENT', 1600, 'INCOME');
  add(9, 'STARLING BANK', 'Interest', 'INTEREST', 3.12, 'INCOME');
  add(3, 'ADOBE SYSTEMS', 'Creative Cloud', 'CARD', -54.99, 'SUBSCRIPTIONS');
  return rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
}
