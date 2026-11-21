import { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { Card, CardHead, Seg, Stat } from '../components/ui';
import { Heatmap, LineChart, type Series } from '../components/charts';
import { trends, type Measure } from '../lib/trends';
import { fmtShort } from '../lib/dates';
import { gbp, gbpK } from '../lib/format';
import { useVault } from '../lib/store';

// Fixed by recency (validated for colour-blind separation): this year, last year, 2 years ago, 3 years ago.
const YEAR_COLORS = ['#6b3fa0', '#d9822b', '#2a7fb8', '#b8467a'];
const kfmt = (n: number) => (n >= 1000 ? `£${+(n / 1000).toFixed(1)}k` : `£${Math.round(n)}`);

export function Delta({ v, label }: { v: number | null; label?: string }) {
  if (v === null) return <span className="muted">{label ? `${label}: ` : ''}not enough history yet</span>;
  const flat = Math.abs(v) < 0.03;
  const Icon = flat ? ArrowRight : v > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={flat ? 'muted' : v > 0 ? 'delta-up' : 'delta-down'} style={{ fontWeight: 600 }}>
      <Icon size={13} style={{ verticalAlign: -2 }} /> {flat ? 'Level' : `${v > 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`}
      {label && <span className="muted" style={{ fontWeight: 400 }}> {label}</span>}
    </span>
  );
}

export default function YearOnYear() {
  const { vault } = useVault();
  const [measure, setMeasure] = useState<Measure>('received');
  const t = useMemo(() => trends(vault, measure), [vault, measure]);
  const recent = t.rows.slice(-4).reverse(); // newest first → colour index
  const series = (pick: (r: (typeof t.rows)[number]) => (number | null)[]): Series[] =>
    recent.map((r, i) => ({ name: r.ty.label, color: YEAR_COLORS[i], values: pick(r), width: i === 0 ? 2.75 : i === 1 ? 2 : 1.5, opacity: i < 2 ? 1 : 0.5 })).reverse();
  const word = measure === 'received' ? 'received' : 'invoiced';
  const momentum = t.q3.vsPrev;
  const busiest = [...t.share].filter((s) => s.share !== null).sort((a, b) => b.share! - a.share!)[0];
  const t12Change = t.t12.change;

  if (!vault.invoices.length) return <Card><div className="empty">Year-on-year views appear once you have invoices from more than one year. Import your history from Starling or a spreadsheet.</div></Card>;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row wrap between">
        <Seg value={measure} onChange={setMeasure} options={[{ value: 'received', label: 'Money received' }, { value: 'invoiced', label: 'Work invoiced' }]} />
        <span className="small muted">{measure === 'received' ? 'When payments landed — what your bank sees.' : 'When work was billed — closer to when you were busy.'}</span>
      </div>

      <div className="grid g4">
        <Stat label={`${t.rows.at(-1)!.ty.label} so far`} value={gbp(t.ytd.value)} tint="lav"
          sub={<><Delta v={t.ytd.change} label="vs same point last year" /><div className="tiny muted">Last year by {fmtShort(t.ytd.through)}: {gbp(t.ytd.prev)}</div></>} />
        <Stat label="Run rate · last 12 months" value={gbp(t.t12.value)} tint="sage" sub={<Delta v={t12Change} label="vs the 12 months before" />} />
        <Stat label={`Last 3 months · to ${t.q3.endLabel}`} value={gbp(t.q3.value)} tint="butter" sub={<Delta v={t.q3.change} label="vs same months last year" />} />
        <Stat label="Momentum" tint="blush"
          value={<span style={{ fontSize: 24 }}>{momentum === null ? '—' : momentum > 0.1 ? 'Picking up' : momentum < -0.1 ? 'Slowing' : 'Steady'}</span>}
          sub={<Delta v={momentum} label="last 3 months vs the 3 before" />} />
      </div>

      <Card>
        <CardHead title="Month by month, year on year" sub={`Money ${word} each month, one line per tax year (April to March). Hover or tap to compare.`} />
        <LineChart labels={t.monthLabels} series={series((r) => r.months)} fmt={(n) => gbp(n)} axisFmt={kfmt} />
      </Card>

      <div className="grid g2">
        <Card>
          <CardHead title="Pace through the year" sub="Running total from 6 April. Above last year’s line means you’re ahead." />
          <LineChart labels={t.monthLabels} series={series((r) => r.cumulative)} fmt={(n) => gbp(n)} axisFmt={kfmt} />
        </Card>
        <Card>
          <CardHead title="Run rate" sub={`Rolling 12-month total. ${t12Change === null ? '' : t12Change > 0.03 ? 'Rising — the business is growing.' : t12Change < -0.03 ? 'Falling — worth a look at the pipeline.' : 'Holding steady.'}`} />
          <LineChart labels={t.rolling.map((r) => r.label)} series={[{ name: 'Last 12 months', color: YEAR_COLORS[0], values: t.rolling.map((r) => r.value), area: true }]} fmt={(n) => gbp(n)} axisFmt={kfmt} showEndLabels={false} />
        </Card>
      </div>

      <Card>
        <CardHead title="Seasonality" sub={`Money ${word} by month. Darker means busier.`} />
        <Heatmap cols={t.monthLabels} rows={t.rows.slice().reverse().map((r) => ({ label: r.ty.label, values: r.months }))} fmt={(n) => gbp(n)} cellFmt={(n) => (n ? gbpK(n).replace('.0k', 'k') : '·')} />
        <p className="small" style={{ marginBottom: 0 }}>
          {t.completeYears < 2 ? 'Patterns become reliable after two full tax years of records.' : <>
            Across {t.completeYears} full years,{' '}
            {t.quiet.length ? <>the quiet months are <b>{t.quiet.join(', ')}</b></> : 'no month is consistently quiet'}
            {busiest?.share ? <>, and <b>{busiest.label}</b> is usually busiest ({Math.round(busiest.share * 100)}% of a year’s income)</> : null}.
            {t.quiet.length > 0 && ' Worth lining up pitches a month or two before the lulls.'}
          </>}
        </p>
      </Card>

      <Card>
        <CardHead title="Year by year" sub={`Income is money ${word}. Profit is that, less expenses.`} />
        <div className="table-wrap"><table>
          <thead><tr><th>Tax year</th><th className="right">Income</th><th className="right">Change</th><th className="right">Invoices</th><th className="right">Avg invoice</th><th className="right">Clients</th><th className="right">New</th><th className="right">Expenses</th><th className="right">Profit</th></tr></thead>
          <tbody>{t.rows.slice().reverse().map((r, i, arr) => {
            const prev = arr[i + 1];
            const comparable = prev && !prev.partialStart && !r.isCurrent;
            return (
              <tr key={r.ty.label}>
                <td><b>{r.ty.label}</b>{r.isCurrent && <span className="tiny muted"> · so far</span>}{r.partialStart && <span className="tiny muted"> · partial records</span>}</td>
                <td className="right num"><b>{gbp(r.total)}</b></td>
                <td className="right small">{r.isCurrent ? <Delta v={t.ytd.change} label="to date" /> : comparable ? <Delta v={prev.total ? r.total / prev.total - 1 : null} /> : '—'}</td>
                <td className="right num">{r.invoices}</td>
                <td className="right num">{gbp(r.avgInvoice)}</td>
                <td className="right num">{r.clients}</td>
                <td className="right num">{r.newClients}</td>
                <td className="right num">{gbp(r.expenses)}</td>
                <td className="right num">{gbp(r.profit)}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
