// Fictional demo data so the app can be explored before real records are imported.
import { addDays, today } from './dates';
import { emptyVault } from './defaults';
import { uid } from './format';
import type { Client, Deal, Expense, Invoice, Sector, Vault } from './types';

export function sampleVault(): Vault {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const now = today();
  const v = emptyVault();
  const mk = (name: string, sector: Sector, contactName: string, lastContacted?: number): Client => ({
    id: uid(), name, sector, contactName, email: `${contactName.split(' ')[0].toLowerCase()}@example.org`, createdAt: addDays(now, -1300),
    lastContacted: lastContacted !== undefined ? addDays(now, -lastContacted) : undefined,
  });
  const clients = [
    mk('Riverside Housing Trust', 'Charity / NFP', 'Priya Shah', 12),
    mk('Open Seas Conservation', 'Charity / NFP', 'Tom Ellery', 70),
    mk('Kindred Hospice Care', 'Health', 'Joanna Black', 20),
    mk('Northern Arts Collective', 'Charity / NFP', 'Sam Okafor', 200),
    mk('Metro Borough Council', 'Public sector', 'Helen Marsh', 45),
    mk('Brightpath Learning', 'Education', 'Daniel Cho', 30),
    mk('Fieldwork Studio', 'Agency', 'Ruth Adair', 100),
  ];
  const work: [number, string, number, string?][] = [
    [0, 'Annual impact report — strategy, copy & editing', 4800, 'Led the narrative for a 40-page impact report covering 2,000 new homes'],
    [0, 'Tenant engagement campaign messaging', 2600],
    [1, 'Ocean plastics campaign launch comms', 6200, 'National campaign launch with coverage in two broadsheets and BBC regional'],
    [1, 'Supporter newsletter copywriting (quarterly)', 900],
    [2, 'Fundraising appeal copy — winter appeal', 1800, 'Winter appeal that beat its target by 31%'],
    [2, 'Internal comms strategy & workshops', 3400],
    [3, 'Arts Council funding bid narrative', 1500],
    [4, 'Public consultation communications plan', 5500, 'Borough-wide consultation reaching 18,000 residents'],
    [4, 'Press release & media handling', 1200],
    [5, 'Website copy rewrite', 2900],
    [6, 'Subcontract: charity brand messaging', 2200],
  ];
  const invoices: Invoice[] = [];
  let n = 1;
  for (let back = 1300; back > 5; back -= 12 + Math.floor(rnd() * 16)) {
    const [ci, desc, base0, hl] = work[Math.floor(rnd() * work.length)];
    if (ci === 3 && back < 400) continue; // Northern Arts has gone dormant
    const issue = addDays(now, -back);
    const month = Number(issue.slice(5, 7));
    // Seasonal pattern: August and late December are quiet; steady growth year on year.
    if ((month === 8 && rnd() < 0.8) || (month === 12 && rnd() < 0.55) || (month === 1 && rnd() < 0.3)) continue;
    const base = base0 * (0.72 + 0.5 * (1 - back / 1300));
    const due = addDays(issue, 30);
    const late = rnd();
    const paid = back > 45 || late > 0.6 ? addDays(issue, 12 + Math.floor(rnd() * 30)) : undefined;
    invoices.push({
      id: uid(), number: `EH-${String(n++).padStart(3, '0')}`, clientId: clients[ci].id, description: desc,
      issueDate: issue, dueDate: due, amount: Math.round((base * (0.8 + rnd() * 0.5)) / 50) * 50,
      paidDate: paid && paid <= now ? paid : undefined,
      showcase: !!hl && rnd() > 0.3, profile: hl ? 4 + Math.round(rnd()) : 2 + Math.round(rnd()), highlight: hl,
    });
  }
  const cats: Expense['category'][] = ['Software & subscriptions', 'Travel', 'Phone & internet', 'Training & CPD', 'Office & equipment', 'Professional fees'];
  const expenses: Expense[] = [];
  for (let back = 1300; back > 0; back -= 20 + Math.floor(rnd() * 20)) {
    const category = cats[Math.floor(rnd() * cats.length)];
    expenses.push({ id: uid(), date: addDays(now, -back), category, description: category === 'Software & subscriptions' ? 'Adobe / Canva / Microsoft 365' : category, amount: Math.round(20 + rnd() * 180) });
  }
  const deal = (title: string, clientName: string, value: number, stage: Deal['stage'], idle: number, startIn?: number, source?: string): Deal => ({
    id: uid(), title, clientName, clientId: clients.find((c) => c.name === clientName)?.id, value, stage,
    probability: { Lead: 10, 'In conversation': 25, 'Proposal sent': 50, Negotiating: 75, Won: 100, Lost: 0 }[stage],
    lastActivity: addDays(now, -idle), expectedStart: startIn !== undefined ? addDays(now, startIn) : undefined,
    createdAt: addDays(now, -idle - 10), source, nextAction: stage === 'Proposal sent' ? 'Follow up on proposal' : undefined,
  });
  v.clients = clients;
  v.invoices = invoices;
  v.expenses = expenses;
  v.deals = [
    deal('2027 strategy refresh & messaging house', 'Riverside Housing Trust', 7500, 'Negotiating', 4, 40),
    deal('Legacy giving campaign copy', 'Kindred Hospice Care', 3200, 'Proposal sent', 16, 25),
    deal('Rebrand launch comms', 'Open Seas Conservation', 5000, 'In conversation', 30, 60),
    deal('Comms capacity — maternity cover (3 days/week)', 'Greenway Foundation', 14000, 'Lead', 50, -5, 'CharityJob'),
    deal('Annual review copywriting', 'Brightpath Learning', 2400, 'Proposal sent', 8, 35),
  ];
  v.settings.nextInvoiceNumber = n;
  v.settings.taxPot = 4000;
  v.settings.email = 'hello@example.com';
  v.settings.bankDetails = 'Eleanor Herzog · Sort code 00-00-00 · Account 00000000';
  v.profile.experience = 'Freelance communications strategist (2019–present) — Strategy, campaigns and copy for charities, public bodies and social enterprises.\n\nHead of Communications, a national charity (2015–2019) — Led a team of six across press, digital and internal comms.\n\nCommunications Officer, a London borough council (2011–2015) — Resident engagement, consultation and media relations.';
  v.profile.education = 'BA (Hons) English Literature\nCIPR Diploma in Public Relations';
  return v;
}
