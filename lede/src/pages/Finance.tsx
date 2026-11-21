import { useMemo, useState } from 'react';
import { Plus, Upload, Download, Printer, Mail, Check, Trash2, Receipt, Info } from 'lucide-react';
import { Badge, Bars, Card, CardHead, Empty, Field, Meter, Modal, PageHead, SearchBox, Seg, Stat, confirmDelete } from '../components/ui';
import InvoiceEditor, { newInvoice } from '../components/InvoiceEditor';
import InvoicePrint from '../components/InvoicePrint';
import Importer from '../components/Importer';
import { clientName, deadlines, financeSummary, invStatus, taxYearsWithData } from '../lib/analytics';
import { daysBetween, fmtDate, fmtShort, taxYearOf, today } from '../lib/dates';
import { gbp, pct, sum, uid } from '../lib/format';
import { useVault } from '../lib/store';
import type { Expense, ExpenseCategory, Invoice, Vault } from '../lib/types';

type Tab = 'overview' | 'invoices' | 'expenses' | 'tax';
const CATS: ExpenseCategory[] = ['Travel', 'Mileage', 'Software & subscriptions', 'Phone & internet', 'Office & equipment', 'Training & CPD', 'Professional fees', 'Marketing', 'Use of home', 'Other'];

export default function Finance() {
  const { vault } = useVault();
  const years = useMemo(() => taxYearsWithData(vault), [vault]);
  const [yearIdx, setYearIdx] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');
  const [importing, setImporting] = useState(false);
  const ty = years[yearIdx] ?? taxYearOf(today());
  const f = useMemo(() => financeSummary(vault, ty), [vault, ty]);

  return (
    <>
      <PageHead eyebrow="Money & tax" title={<>Tax year <em>{ty.label}</em></>} actions={<>
        <select className="input" style={{ width: 'auto' }} value={yearIdx} onChange={(e) => setYearIdx(Number(e.target.value))}>
          {years.map((y, i) => <option key={y.label} value={i}>{y.label}{i === 0 ? ' (current)' : ''}</option>)}
        </select>
        <button className="btn" onClick={() => setImporting(true)}><Upload size={16} />Import</button>
      </>} />
      <div style={{ marginBottom: 18 }}>
        <Seg value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'invoices', label: 'Invoices' }, { value: 'expenses', label: 'Expenses' }, { value: 'tax', label: 'Tax planner' }]} />
      </div>
      {tab === 'overview' && <Overview f={f} vault={vault} />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'expenses' && <Expenses f={f} />}
      {tab === 'tax' && <Tax f={f} />}
      {importing && <Importer onClose={() => setImporting(false)} />}
    </>
  );
}

type F = ReturnType<typeof financeSummary>;

function Overview({ f, vault }: { f: F; vault: Vault }) {
  const byClient = Object.entries(f.issued.reduce<Record<string, number>>((a, i) => ({ ...a, [i.clientId]: (a[i.clientId] ?? 0) + i.amount }), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  const paidShare = f.invoiced ? sum(f.issued.filter((i) => i.paidDate), (i) => i.amount) / f.invoiced : 0;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g4">
        <Stat label="Invoiced" value={gbp(f.invoiced)} sub={`${f.issued.length} invoices raised`} tint="lav" />
        <Stat label="Received" value={gbp(f.receivedTotal)} sub={`${f.received.length} payments in`} tint="sage" />
        <Stat label="Unpaid (all years)" value={gbp(f.outstandingTotal)} sub={f.overdue.length ? <span style={{ color: 'var(--blush-ink)' }}>{f.overdue.length} overdue · {gbp(f.overdueTotal)}</span> : 'None overdue'} tint="butter" />
        <Stat label="Profit (taxable)" value={gbp(f.profitYTD)} sub={`after ${gbp(f.deduction)} ${f.deduction > f.expenseTotal ? 'trading allowance' : 'expenses'}`} tint="blush" />
      </div>
      <div className="grid g3">
        <Card className="span2">
          <CardHead title="Invoiced by month" sub="By invoice date, split by whether it has been paid" />
          <Bars data={f.months.map((m) => ({ label: m.label, paid: m.paid, unpaid: m.unpaid }))}
            series={[{ key: 'paid', color: '#bcd9b6', label: 'Paid' }, { key: 'unpaid', color: '#f3c0b6', label: 'Unpaid' }]} />
        </Card>
        <Card>
          <CardHead title="Paid vs unpaid" sub={`Invoices raised in ${f.ty.label}`} />
          <div className="value serif" style={{ fontSize: 34 }}>{pct(paidShare)}</div>
          <div className="small muted" style={{ marginBottom: 10 }}>of this year’s invoicing has been paid</div>
          <Meter value={paidShare} color="#8fbf88" />
          <div className="list" style={{ marginTop: 14 }}>
            {byClient.map(([id, amt]) => (
              <div key={id} className="item" style={{ padding: '8px 0' }}>
                <div className="grow ellipsis small">{clientName(vault, id)}</div><b className="small num">{gbp(amt)}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <CardHead title="By quarter" sub="Making Tax Digital quarters (6th to 5th). Income column follows your accounting basis." />
        <div className="table-wrap"><table>
          <thead><tr><th>Quarter</th><th className="right">Invoiced</th><th className="right">Paid</th><th className="right">Unpaid</th><th className="right">Income ({vault.settings.basis})</th><th className="right">Expenses</th><th>MTD update due</th></tr></thead>
          <tbody>{f.quarters.map((q) => (
            <tr key={q.label}><td><b>{q.label}</b> <span className="muted small">{q.name}</span></td>
              <td className="right num">{gbp(q.invoiced)}</td><td className="right num">{gbp(q.paid)}</td>
              <td className="right num" style={{ color: q.unpaid ? 'var(--blush-ink)' : undefined }}>{gbp(q.unpaid)}</td>
              <td className="right num"><b>{gbp(q.income)}</b></td><td className="right num">{gbp(q.expenses)}</td><td className="small muted">{fmtDate(q.deadline)}</td></tr>
          ))}
            <tr><td><b>Year</b></td><td className="right num"><b>{gbp(f.invoiced)}</b></td><td className="right num">{gbp(sum(f.quarters, (q) => q.paid))}</td><td className="right num">{gbp(sum(f.quarters, (q) => q.unpaid))}</td><td className="right num"><b>{gbp(f.incomeTotal)}</b></td><td className="right num">{gbp(f.expenseTotal)}</td><td /></tr>
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}

function chaseLink(v: Vault, i: Invoice) {
  const c = v.clients.find((x) => x.id === i.clientId);
  const body = `Hi ${c?.contactName?.split(' ')[0] ?? 'there'},\n\nI hope you’re well. A quick reminder that invoice ${i.number} for ${gbp(i.amount, 2)} (${i.description}) was due on ${fmtDate(i.dueDate)}. Could you let me know when payment is likely to be made?\n\nBank details: ${v.settings.bankDetails}\n\nMany thanks,\n${v.settings.ownerName}`;
  return `mailto:${c?.email ?? ''}?subject=${encodeURIComponent(`Invoice ${i.number} — payment reminder`)}&body=${encodeURIComponent(body)}`;
}

function Invoices() {
  const { vault, upsert } = useVault();
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Invoice>();
  const [print, setPrint] = useState<Invoice>();
  const now = today();
  const list = vault.invoices
    .filter((i) => filter === 'all' || (filter === 'unpaid' ? !i.paidDate : invStatus(i) === filter))
    .filter((i) => !q || `${i.number} ${i.description} ${clientName(vault, i.clientId)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const exportCsv = () => {
    const rows = [['Number', 'Client', 'Description', 'Issued', 'Due', 'Amount', 'Paid on'], ...vault.invoices.map((i) => [i.number, clientName(vault, i.clientId), i.description, i.issueDate, i.dueDate, i.amount.toFixed(2), i.paidDate ?? ''])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `invoices-${now}.csv`; a.click();
  };

  return (
    <Card>
      <div className="row wrap between" style={{ marginBottom: 14 }}>
        <Seg value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unpaid', label: 'Unpaid' }, { value: 'overdue', label: 'Overdue' }, { value: 'paid', label: 'Paid' }]} />
        <div className="row wrap">
          <SearchBox value={q} onChange={setQ} />
          <button className="btn" onClick={exportCsv} title="CSV for your accountant"><Download size={16} />CSV</button>
          <button className="btn primary" onClick={() => setEdit(newInvoice(vault))}><Plus size={16} />New invoice</button>
        </div>
      </div>
      {!list.length ? <Empty icon={<Receipt size={30} />} title="No invoices here">Create one, or import your history from Drive or a spreadsheet.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Invoice</th><th>Client</th><th>Issued</th><th className="right">Amount</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((i) => {
            const s = invStatus(i);
            return (
              <tr key={i.id} className="clickable" onClick={() => setEdit(i)}>
                <td><b>{i.number}</b><div className="tiny muted ellipsis" style={{ maxWidth: 260 }}>{i.description}</div></td>
                <td className="small">{clientName(vault, i.clientId)}</td>
                <td className="small muted">{fmtShort(i.issueDate)} {i.issueDate.slice(2, 4)}</td>
                <td className="right num"><b>{gbp(i.amount, 2)}</b></td>
                <td>{s === 'paid' ? <Badge tone="sage">Paid {fmtShort(i.paidDate)}</Badge> : s === 'overdue' ? <Badge tone="blush">{daysBetween(i.dueDate, now)}d overdue</Badge> : <Badge tone="butter">Due {fmtShort(i.dueDate)}</Badge>}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                    {!i.paidDate && <button className="btn ghost icon" title="Mark paid today" onClick={() => upsert('invoices', { ...i, paidDate: now })}><Check size={16} /></button>}
                    {s === 'overdue' && <a className="btn ghost icon" title="Email a reminder" href={chaseLink(vault, i)}><Mail size={16} /></a>}
                    <button className="btn ghost icon" title="Print / PDF" onClick={() => setPrint(i)}><Printer size={16} /></button>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      {edit && <InvoiceEditor invoice={edit} onClose={() => setEdit(undefined)} />}
      {print && <InvoicePrint invoice={print} onClose={() => setPrint(undefined)} />}
    </Card>
  );
}

function Expenses({ f }: { f: F }) {
  const { upsert, remove } = useVault();
  const [edit, setEdit] = useState<Expense>();
  const [miles, setMiles] = useState('');
  const byCat = CATS.map((c) => ({ c, t: sum(f.expenses.filter((e) => e.category === c), (e) => e.amount) })).filter((x) => x.t).sort((a, b) => b.t - a.t);
  const max = Math.max(1, ...byCat.map((x) => x.t));
  return (
    <div className="grid g3">
      <Card className="span2">
        <CardHead title={`Expenses · ${f.ty.label}`} sub={`${gbp(f.expenseTotal)} claimed${f.expenseTotal < 1000 ? ' — the £1,000 trading allowance currently beats your actual costs' : ''}`}
          action={<button className="btn primary" onClick={() => setEdit({ id: uid(), date: today(), description: '', category: 'Software & subscriptions', amount: 0 })}><Plus size={16} />Add</button>} />
        {!f.expenses.length ? <Empty icon={<Receipt size={30} />} title="No expenses this year">Software, travel, training, a share of phone & internet — it all reduces your tax.</Empty> : (
          <div className="list">{[...f.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
            <div key={e.id} className="item clickable" onClick={() => setEdit(e)}>
              <div className="grow"><div className="ellipsis"><b>{e.description}</b></div><div className="tiny muted">{fmtDate(e.date)} · {e.category}</div></div>
              <b className="num">{gbp(e.amount, 2)}</b>
            </div>))}
          </div>
        )}
      </Card>
      <div className="stack">
        <Card>
          <CardHead title="By category" />
          {byCat.map(({ c, t }) => <div key={c} style={{ marginBottom: 10 }}><div className="row between small"><span>{c}</span><b className="num">{gbp(t)}</b></div><Meter value={t / max} color="#c9b6e4" /></div>)}
          {!byCat.length && <div className="muted small">Nothing yet.</div>}
        </Card>
        <Card tint="sky">
          <CardHead title="Mileage helper" sub="HMRC rate: 45p/mile for the first 10,000 business miles" />
          <div className="row"><input className="input" type="number" placeholder="Miles" value={miles} onChange={(e) => setMiles(e.target.value)} />
            <button className="btn" disabled={!Number(miles)} onClick={() => { upsert('expenses', { id: uid(), date: today(), category: 'Mileage', description: `${miles} business miles @ 45p`, amount: Number(miles) * 0.45 }); setMiles(''); }}>Add {Number(miles) ? gbp(Number(miles) * 0.45, 2) : ''}</button></div>
        </Card>
      </div>
      {edit && (
        <Modal title="Expense" onClose={() => setEdit(undefined)} footer={<>
          <button className="btn ghost danger left" onClick={() => { if (confirmDelete('this expense')) { remove('expenses', edit.id); setEdit(undefined); } }}><Trash2 size={15} /></button>
          <button className="btn primary" onClick={() => { upsert('expenses', edit); setEdit(undefined); }}>Save</button></>}>
          <div className="form-grid">
            <Field label="Description" full><input className="input" autoFocus value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Amount (£)"><input className="input" type="number" step="0.01" value={edit.amount || ''} onChange={(e) => setEdit({ ...edit, amount: e.target.valueAsNumber || 0 })} /></Field>
            <Field label="Date"><input className="input" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
            <Field label="Category" full><select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as ExpenseCategory })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Tax({ f }: { f: F }) {
  const { vault, update } = useVault();
  const s = vault.settings;
  const p = s.tax;
  const est = f.isCurrent ? f.taxProjected : f.taxYTD;
  const total = est.profit + s.otherIncome;
  const scaleMax = Math.max(total * 1.15, p.personalAllowance + p.basicBand + 15000);
  // Band edges on total income, clipped to the visible scale.
  const edges = [
    { to: p.personalAllowance, c: '#dcebd8', l: '0%' },
    { to: p.personalAllowance + p.basicBand, c: '#d8e7f3', l: '20%' },
    { to: p.taperThreshold, c: '#e5ddf3', l: '40%' },
    { to: p.additionalThreshold, c: '#f6dcd6', l: '60%' },
    { to: Infinity, c: '#f3c0b6', l: '45%' },
  ];
  const bands = edges.map((e, i) => {
    const from = Math.min(i ? edges[i - 1].to : 0, scaleMax);
    return { ...e, w: Math.max(0, Math.min(e.to, scaleMax) - from) };
  });
  const setS = (patch: Partial<typeof s>) => update((v) => ({ ...v, settings: { ...v.settings, ...patch } }));
  const vatShare = f.vat12 / p.vatThreshold;
  const onTrack = f.onTrackGap >= 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid g4">
        <Stat label={f.isCurrent ? 'Projected profit' : 'Profit'} value={gbp(est.profit)} sub={f.isCurrent ? `${gbp(f.profitYTD)} so far · ${pct(f.elapsed)} through the year` : 'Full year'} tint="lav" />
        <Stat label="Estimated tax + NI" value={gbp(est.total)} sub={`Income tax ${gbp(est.incomeTax)} · Class 4 NI ${gbp(est.ni)}`} tint="blush" />
        <Stat label="Set aside each month" value={gbp(f.monthlySetAside)} sub={`≈ ${pct(est.effectiveRate)} of every payment received`} tint="sage" />
        <Stat label="Your tax band" value={<span style={{ fontSize: 22 }}>{est.band.label}</span>} sub={est.band.nextAt ? `${gbp(Math.max(0, est.band.nextAt - total))} until ${est.band.nextLabel}` : 'Top band'} tint="butter" />
      </div>

      <Card>
        <CardHead title="Where you sit" sub={`Total taxable income ${gbp(total)}${s.otherIncome ? ` (incl. ${gbp(s.otherIncome)} other income)` : ''}. Each extra £100 of profit costs about ${gbp(est.band.marginal * 100)} in tax & NI.`} />
        <div style={{ position: 'relative', padding: '8px 0 4px' }}>
          <div className="bandscale">{bands.map((b, i) => <div key={i} style={{ width: `${(b.w / scaleMax) * 100}%`, background: b.c }} />)}</div>
          <div className="bandmarker" style={{ left: `calc(${Math.min(99, (total / scaleMax) * 100)}% - 1px)`, top: 3 }} />
        </div>
        <div className="row tiny muted" style={{ gap: 0 }}>{bands.map((b, i) => <div key={i} style={{ width: `${(b.w / scaleMax) * 100}%`, overflow: 'hidden' }}>{b.w / scaleMax > 0.06 ? b.l : ''}</div>)}</div>
      </Card>

      <div className="grid g2">
        {f.isCurrent && (
          <Card tint={onTrack ? 'sage' : 'blush'}>
            <CardHead title={onTrack ? 'You’re on track' : 'A little behind'} sub="Compare what’s in your tax pot with where you should be by now" />
            <div className="form-grid">
              <Field label="Already set aside (£)"><input className="input num" type="number" value={s.taxPot || ''} onChange={(e) => setS({ taxPot: e.target.valueAsNumber || 0 })} /></Field>
              <div className="field"><span>Should have by now</span><div className="serif" style={{ fontSize: 24 }}>{gbp(f.shouldHaveSaved)}</div></div>
            </div>
            <p className="small" style={{ marginBottom: 0 }}>
              {onTrack ? <>You’re {gbp(f.onTrackGap)} ahead. Keep putting away <b>{gbp(f.monthlySetAside)}</b> a month.</>
                : <>To catch up, put away <b>{gbp(f.catchUpMonthly)}</b> a month until April ({gbp(f.stillToSave)} still to save).</>}
            </p>
          </Card>
        )}
        <Card>
          <CardHead title="How it’s worked out" />
          <div className="list small">
            {[
              ['Basis', <Seg value={s.basis} onChange={(b) => setS({ basis: b })} options={[{ value: 'cash', label: 'Cash (default)' }, { value: 'accruals', label: 'Accruals' }]} />],
              ['Projection', f.isCurrent ? <Seg value={s.projection} onChange={(b) => setS({ projection: b })} options={[{ value: 'runrate', label: 'Run-rate' }, { value: 'pipeline', label: '+ Unpaid & pipeline' }]} /> : 'Actuals'],
              ['Income counted', gbp(f.isCurrent ? f.projectedIncome : f.incomeTotal)],
              ['Other income (salary etc.)', <input className="input num" style={{ width: 120 }} type="number" value={s.otherIncome || ''} placeholder="0" onChange={(e) => setS({ otherIncome: e.target.valueAsNumber || 0 })} />],
              ['Income tax', gbp(est.incomeTax)], ['Class 4 National Insurance', gbp(est.ni)],
            ].map(([k, v], i) => <div key={i} className="item" style={{ padding: '8px 0' }}><div className="grow">{k}</div>{v}</div>)}
          </div>
          <div className="tiny muted" style={{ marginTop: 8 }}><Info size={12} /> 2026/27 rates for England, Wales &amp; NI. Class 2 NI is no longer compulsory. An estimate — not tax advice; check with your accountant.</div>
        </Card>
        <Card>
          <CardHead title="VAT threshold watch" sub="Rolling 12-month turnover vs the £90,000 registration threshold" />
          <div className="serif" style={{ fontSize: 26 }}>{gbp(f.vat12)} <span className="small muted">/ {gbp(p.vatThreshold)}</span></div>
          <div style={{ margin: '10px 0' }}><Meter value={vatShare} color={vatShare > 0.85 ? '#d9786f' : vatShare > 0.7 ? '#e6b450' : '#8fbf88'} /></div>
          <div className="small muted">{vatShare > 0.85 ? 'Close to the threshold — talk to your accountant about registering.' : `${gbp(p.vatThreshold - f.vat12)} headroom before you’d need to register.`}</div>
        </Card>
        <Card>
          <CardHead title="Making Tax Digital" />
          <Badge tone={f.mtd.required ? 'butter' : 'sage'}>{f.mtd.required ? `In scope from ${f.mtd.from}` : 'Not in scope yet'}</Badge>
          <p className="small">{f.mtd.text}</p>
          <div className="tiny muted">Payments on account: if last year’s bill was over £1,000, HMRC asks for half of it in advance on 31 Jan and 31 Jul.</div>
          <div className="list" style={{ marginTop: 8 }}>{deadlines().slice(0, 3).map((d) => <div key={d.date + d.title} className="item small" style={{ padding: '7px 0' }}><b style={{ width: 64 }}>{fmtShort(d.date)}</b><span className="grow">{d.title}</span></div>)}</div>
        </Card>
      </div>
    </div>
  );
}
