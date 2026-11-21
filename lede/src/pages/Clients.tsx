import { useMemo, useState } from 'react';
import { Plus, Trash2, Mail, Phone, Users, AlertTriangle } from 'lucide-react';
import { Avatar, Badge, Card, CardHead, Empty, Field, Meter, Modal, PageHead, SearchBox, Seg, Stat, confirmDelete, type Tone } from '../components/ui';
import InvoiceEditor, { newInvoice } from '../components/InvoiceEditor';
import { DealEditor, blankDeal } from './Pipeline';
import { clientStats, type ClientStats, type Tier } from '../lib/analytics';
import { fmtDate, today } from '../lib/dates';
import { gbp, pct, uid } from '../lib/format';
import { useVault } from '../lib/store';
import type { Client, Deal, Invoice, Sector } from '../lib/types';

const SECTORS: Sector[] = ['Charity / NFP', 'Public sector', 'Education', 'Health', 'Private', 'Agency', 'Other'];
export const TIER_TONE: Record<Tier, Tone> = { 'Key client': 'lav', Valued: 'sage', Occasional: 'sky', Dormant: 'grey', New: 'butter' };

export default function Clients() {
  const { vault } = useVault();
  const stats = useMemo(() => clientStats(vault), [vault]);
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<'all' | Tier | 'due'>('all');
  const [open, setOpen] = useState<Client>();
  const top = stats[0];
  const list = stats.filter((s) => (tier === 'all' || (tier === 'due' ? s.contactDue : s.tier === tier)) && (!q || `${s.client.name} ${s.client.contactName}`.toLowerCase().includes(q.toLowerCase())));
  const maxScore = Math.max(1, ...stats.map((s) => s.score));
  const topShare = [...stats].sort((a, b) => b.share - a.share)[0];

  return (
    <>
      <PageHead eyebrow="Client register" title="Your people" actions={<button className="btn primary" onClick={() => setOpen({ id: uid(), name: '', sector: 'Charity / NFP', createdAt: today() })}><Plus size={16} />Add client</button>} />
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="Clients" value={stats.length} sub={`${stats.filter((s) => s.tier === 'Key client').length} key · ${stats.filter((s) => s.tier === 'Dormant').length} dormant`} tint="lav" />
        <Stat label="Most valuable" value={<span style={{ fontSize: 20 }}>{top?.client.name ?? '—'}</span>} sub={top ? `${gbp(top.lifetime)} lifetime` : ''} tint="sage" />
        <Stat label="Due a catch-up" value={stats.filter((s) => s.contactDue && s.tier !== 'New').length} sub="based on value & last contact" tint="butter" />
        <Stat label="Biggest client share" value={pct(topShare?.share ?? 0)} sub={topShare && topShare.share > 0.4 ? <span style={{ color: 'var(--blush-ink)' }}><AlertTriangle size={12} /> high dependency on one client</span> : 'of the last 12 months’ income'} tint="blush" />
      </div>
      <Card>
        <div className="row wrap between" style={{ marginBottom: 10 }}>
          <Seg value={tier} onChange={setTier} options={[{ value: 'all', label: 'All' }, { value: 'due', label: 'Catch-up due' }, { value: 'Key client', label: 'Key' }, { value: 'Valued', label: 'Valued' }, { value: 'Occasional', label: 'Occasional' }, { value: 'Dormant', label: 'Dormant' }]} />
          <SearchBox value={q} onChange={setQ} />
        </div>
        {!list.length && <Empty icon={<Users size={30} />} title="No clients to show">Add clients here, or import invoices and they’ll be created for you.</Empty>}
        <div className="list">{list.map((s) => (
          <div key={s.client.id} className="item clickable" onClick={() => setOpen(s.client)}>
            <Avatar name={s.client.name} />
            <div className="grow">
              <div className="row wrap" style={{ gap: 6 }}><b>{s.client.name}</b><Badge tone={TIER_TONE[s.tier]}>{s.tier}</Badge>{s.contactDue && s.tier !== 'New' && <Badge tone="butter">Catch up</Badge>}</div>
              <div className="small muted ellipsis">{s.client.sector}{s.client.contactName ? ` · ${s.client.contactName}` : ''} · last contact {s.daysSinceContact !== undefined ? `${s.daysSinceContact}d ago` : 'never'}</div>
            </div>
            <div style={{ width: 150 }} className="right">
              <div className="num"><b>{gbp(s.last12)}</b> <span className="tiny muted">12m</span></div>
              <div className="tiny muted num">{gbp(s.lifetime)} lifetime</div>
              <div style={{ marginTop: 4 }}><Meter value={s.score / maxScore} color="#b9a3d6" /></div>
            </div>
          </div>
        ))}</div>
      </Card>
      {open && <ClientModal client={open} stats={stats.find((s) => s.client.id === open.id)} onClose={() => setOpen(undefined)} />}
    </>
  );
}

function ClientModal({ client, stats, onClose }: { client: Client; stats?: ClientStats; onClose: () => void }) {
  const { vault, upsert, remove } = useVault();
  const [c, setC] = useState(client);
  const [inv, setInv] = useState<Invoice>();
  const [deal, setDeal] = useState<Deal>();
  const isNew = !vault.clients.some((x) => x.id === client.id);
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((x) => ({ ...x, [k]: v }));
  const history = vault.invoices.filter((i) => i.clientId === c.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const save = (patch: Partial<Client> = {}) => { if (!c.name.trim()) return alert('Name required'); upsert('clients', { ...c, ...patch }); onClose(); };

  return (
    <Modal wide title={isNew ? 'New client' : c.name} onClose={onClose} footer={<>
      {!isNew && <button className="btn ghost danger left" onClick={() => { if (history.length) return alert('This client has invoices — delete those first.'); if (confirmDelete(c.name)) { remove('clients', c.id); onClose(); } }}><Trash2 size={15} /></button>}
      {!isNew && <button className="btn" onClick={() => save({ lastContacted: today() })}>Log contact today</button>}
      <button className="btn primary" onClick={() => save()}>Save</button>
    </>}>
      {stats && stats.count > 0 && (
        <div className="grid g4">
          {[['Lifetime', gbp(stats.lifetime)], ['Last 12 months', gbp(stats.last12)], ['Invoices', String(stats.count)], ['Avg. days to pay', stats.avgDaysToPay ? Math.round(stats.avgDaysToPay) + ' days' : '—']].map(([k, v]) => (
            <div key={k} className="note" style={{ borderStyle: 'solid' }}><div className="tiny muted">{k}</div><div className="serif" style={{ fontSize: 20 }}>{v}</div></div>
          ))}
        </div>
      )}
      <div className="form-grid">
        <Field label="Organisation"><input className="input" autoFocus={isNew} value={c.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Sector"><select className="input" value={c.sector} onChange={(e) => set('sector', e.target.value as Sector)}>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Main contact"><input className="input" value={c.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} /></Field>
        <Field label="Email"><div className="row"><input className="input" type="email" value={c.email ?? ''} onChange={(e) => set('email', e.target.value)} />{c.email && <a className="btn icon" href={`mailto:${c.email}`}><Mail size={16} /></a>}</div></Field>
        <Field label="Phone"><div className="row"><input className="input" type="tel" value={c.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />{c.phone && <a className="btn icon" href={`tel:${c.phone}`}><Phone size={16} /></a>}</div></Field>
        <Field label="Last contacted"><input className="input" type="date" value={c.lastContacted ?? ''} onChange={(e) => set('lastContacted', e.target.value || undefined)} /></Field>
        <Field label="Follow up on" hint="You’ll be nudged on the Today page"><input className="input" type="date" value={c.nextFollowUp ?? ''} onChange={(e) => set('nextFollowUp', e.target.value || undefined)} /></Field>
        <Field label="Notes" full><textarea className="input" value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Relationship notes, interests, upcoming projects…" /></Field>
      </div>
      {!isNew && <>
        <CardHead title="History" action={<div className="row">
          <button className="btn sm" onClick={() => setDeal(blankDeal({ clientId: c.id }))}>+ Opportunity</button>
          <button className="btn sm" onClick={() => setInv(newInvoice(vault, c.id))}>+ Invoice</button></div>} />
        <div className="list">{history.map((i) => (
          <div key={i.id} className="item clickable" onClick={() => setInv(i)} style={{ padding: '8px 0' }}>
            <div className="grow"><div className="ellipsis">{i.description || i.number}</div><div className="tiny muted">{i.number} · {fmtDate(i.issueDate)}</div></div>
            {i.paidDate ? <Badge tone="sage">Paid</Badge> : <Badge tone="butter">Unpaid</Badge>}<b className="num">{gbp(i.amount)}</b>
          </div>))}
          {!history.length && <div className="small muted">No invoices yet.</div>}
        </div>
      </>}
      {inv && <InvoiceEditor invoice={inv} onClose={() => setInv(undefined)} />}
      {deal && <DealEditor deal={deal} onClose={() => setDeal(undefined)} />}
    </Modal>
  );
}
