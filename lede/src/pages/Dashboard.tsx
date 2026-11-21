import { useMemo } from 'react';
import { Wallet, Hourglass, KanbanSquare, PiggyBank, Mail, Snowflake, Phone, CalendarClock, Sparkles, ArrowRight } from 'lucide-react';
import { Badge, Bars, Card, CardHead, Empty, Stat } from '../components/ui';
import { clientName, clientStats, deadlines, dealHeat, financeSummary } from '../lib/analytics';
import { daysBetween, fmtDate, fmtShort, taxYearOf, today } from '../lib/dates';
import { gbp, sum } from '../lib/format';
import { useVault } from '../lib/store';
import type { Page } from '../App';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

export default function Dashboard({ go }: { go: (p: Page) => void }) {
  const { vault } = useVault();
  const now = today();
  const f = useMemo(() => financeSummary(vault, taxYearOf(now)), [vault, now]);
  const cs = useMemo(() => clientStats(vault), [vault]);
  const open = vault.deals.filter((d) => !['Won', 'Lost'].includes(d.stage));
  const weighted = sum(open, (d) => (d.value * d.probability) / 100);
  const cold = open.map((d) => ({ d, h: dealHeat(d, vault.settings.staleDays) })).filter((x) => x.h.heat !== 'warm');
  const reach = cs.filter((c) => c.contactDue && c.tier !== 'New').slice(0, 4);
  const dl = deadlines(now).slice(0, 5);
  const first = vault.settings.ownerName.split(' ')[0];
  const nothing = !f.overdue.length && !cold.length && !reach.length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="topbar" style={{ marginBottom: 4 }}>
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{greeting()}, <em>{first}</em></h1>
        </div>
      </div>

      <div className="grid g4">
        <Stat label={`Received · ${f.ty.label}`} value={gbp(f.receivedTotal)} sub={`${f.received.length} payments this tax year`} icon={<Wallet size={16} />} tone="sage" tint="sage" />
        <Stat label="Awaiting payment" value={gbp(f.outstandingTotal)} sub={f.overdue.length ? <span style={{ color: 'var(--blush-ink)' }}>{gbp(f.overdueTotal)} overdue</span> : 'Nothing overdue'} icon={<Hourglass size={16} />} tone="butter" tint="butter" />
        <Stat label="Weighted pipeline" value={gbp(weighted)} sub={`${open.length} live opportunities`} icon={<KanbanSquare size={16} />} tone="lav" tint="lav" />
        <Stat label="Set aside for tax" value={<>{gbp(f.monthlySetAside)}<span className="small muted"> /mo</span></>} sub={`${f.taxProjected.band.label}`} icon={<PiggyBank size={16} />} tone="blush" tint="blush" />
      </div>

      <div className="grid g2">
        <Card>
          <CardHead title="Worth your attention" sub="Chasers, cooling leads and people to call" />
          {nothing && <Empty icon={<Sparkles size={28} />} title="All calm">No overdue invoices, cooling deals or overdue catch-ups.</Empty>}
          <div className="list">
            {f.overdue.slice(0, 4).map((i) => (
              <div key={i.id} className="item clickable" onClick={() => go('money')}>
                <div className="avatar t-blush"><Mail size={16} /></div>
                <div className="grow"><div className="ellipsis"><b>Chase {i.number}</b> · {clientName(vault, i.clientId)}</div>
                  <div className="small muted">{gbp(i.amount)} · {daysBetween(i.dueDate, now)} days overdue</div></div>
                <Badge tone="blush">Overdue</Badge>
              </div>
            ))}
            {cold.slice(0, 3).map(({ d, h }) => (
              <div key={d.id} className="item clickable" onClick={() => go('pipeline')}>
                <div className="avatar t-sky"><Snowflake size={16} /></div>
                <div className="grow"><div className="ellipsis"><b>{d.title}</b></div>
                  <div className="small muted">{clientName(vault, d.clientId, d.clientName)} · {h.reason}</div></div>
                <Badge tone={h.heat === 'stale' ? 'blush' : 'butter'}>{h.heat === 'stale' ? 'Stale' : 'Cooling'}</Badge>
              </div>
            ))}
            {reach.map((c) => (
              <div key={c.client.id} className="item clickable" onClick={() => go('clients')}>
                <div className="avatar t-sage"><Phone size={16} /></div>
                <div className="grow"><div className="ellipsis"><b>Catch up with {c.client.contactName || c.client.name}</b></div>
                  <div className="small muted">{c.client.name} · {c.tier} · {c.daysSinceContact ?? '—'} days since contact</div></div>
                <Badge tone="sage">{gbp(c.last12)} /yr</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Coming up" sub="Key HMRC dates for sole traders" action={<CalendarClock size={18} className="muted" />} />
          <div className="list">
            {dl.map((d) => (
              <div key={d.date + d.title} className="item">
                <div className="avatar t-lav" style={{ flexDirection: 'column', lineHeight: 1.05, fontSize: 12 }}>
                  <b>{fmtShort(d.date).split(' ')[0]}</b><span>{fmtShort(d.date).split(' ')[1]}</span>
                </div>
                <div className="grow"><div><b>{d.title}</b></div><div className="small muted">{d.detail}</div></div>
                <span className="tiny muted">{daysBetween(now, d.date)}d</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="span2">
          <CardHead title={`Money in · ${f.ty.label}`} sub={`${gbp(f.incomeTotal)} counted so far on a ${vault.settings.basis} basis · projected ${gbp(f.projectedIncome)} for the year`}
            action={<button className="btn sm" onClick={() => go('money')}>Details <ArrowRight size={14} /></button>} />
          <Bars data={f.months.map((m) => ({ label: m.label, received: m.received }))} series={[{ key: 'received', color: '#bcd9b6', label: 'Received' }]} />
        </Card>
      </div>
      {vault.invoices.length === 0 && (
        <Card tint="lav"><CardHead title="Getting started" />
          <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>Add your business details in <a href="#settings">Settings</a> (used on invoices).</li>
            <li>Import a Starling statement in <a href="#money">Money &amp; tax</a> (and older records from Drive if you have them).</li>
            <li>Add clients and live leads, then check the <a href="#scout">Opportunity scout</a>.</li>
          </ol>
          <div className="tiny muted" style={{ marginTop: 10 }}>Last saved {fmtDate(vault.updatedAt.slice(0, 10))}</div>
        </Card>
      )}
    </div>
  );
}
