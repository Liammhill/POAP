import { useState } from 'react';
import { Plus, Trash2, ExternalLink, Flame, Snowflake, Clock, ChevronRight, Trophy } from 'lucide-react';
import { Badge, Card, Field, Modal, PageHead, Seg, Stat, confirmDelete } from '../components/ui';
import { clientName, dealHeat, STAGE_PROB, STAGES } from '../lib/analytics';
import { fmtShort, today } from '../lib/dates';
import { gbp, pct, sum, uid } from '../lib/format';
import { useVault } from '../lib/store';
import type { Deal, Stage } from '../lib/types';

const OPEN: Stage[] = ['Lead', 'In conversation', 'Proposal sent', 'Negotiating'];
export const blankDeal = (patch: Partial<Deal> = {}): Deal => ({
  id: uid(), title: '', value: 0, probability: 10, stage: 'Lead', lastActivity: today(), createdAt: today(), ...patch,
});

export default function Pipeline() {
  const { vault, upsert } = useVault();
  const [edit, setEdit] = useState<Deal>();
  const [view, setView] = useState<'board' | 'closed'>('board');
  const open = vault.deals.filter((d) => OPEN.includes(d.stage));
  const won = vault.deals.filter((d) => d.stage === 'Won');
  const lost = vault.deals.filter((d) => d.stage === 'Lost');
  const stale = open.filter((d) => dealHeat(d, vault.settings.staleDays).heat === 'stale');
  const winRate = won.length + lost.length ? won.length / (won.length + lost.length) : 0;

  const advance = (d: Deal) => {
    const next = OPEN[OPEN.indexOf(d.stage) + 1] ?? 'Won';
    upsert('deals', { ...d, stage: next, probability: STAGE_PROB[next], lastActivity: today() });
  };

  return (
    <>
      <PageHead eyebrow="Pipeline" title="Work on the horizon" actions={<button className="btn primary" onClick={() => setEdit(blankDeal())}><Plus size={16} />Add opportunity</button>} />
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="Open value" value={gbp(sum(open, (d) => d.value))} sub={`${open.length} opportunities`} tint="lav" />
        <Stat label="Weighted value" value={gbp(sum(open, (d) => (d.value * d.probability) / 100))} sub="value × likelihood" tint="sage" />
        <Stat label="Gone stale" value={stale.length} sub={`no activity for ${vault.settings.staleDays * 2}+ days, or start date passed`} tint="blush" />
        <Stat label="Win rate" value={pct(winRate)} sub={`${won.length} won · ${lost.length} lost`} tint="butter" />
      </div>
      <div style={{ marginBottom: 14 }}><Seg value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'closed', label: `Won & lost (${won.length + lost.length})` }]} /></div>

      {view === 'board' ? (
        <div className="kanban">
          {OPEN.map((stage) => {
            const ds = open.filter((d) => d.stage === stage).sort((a, b) => b.value - a.value);
            return (
              <div key={stage} className="kcol">
                <div className="kcol-head"><b>{stage}</b><span className="small muted num">{gbp(sum(ds, (d) => d.value))}</span></div>
                {ds.map((d) => {
                  const h = dealHeat(d, vault.settings.staleDays);
                  return (
                    <div key={d.id} className={`deal ${h.heat}`} onClick={() => setEdit(d)}>
                      <div className="row between" style={{ alignItems: 'flex-start' }}>
                        <b style={{ lineHeight: 1.3 }}>{d.title}</b>
                        {h.heat === 'warm' ? <Flame size={15} color="#d98c5f" /> : <Snowflake size={15} color={h.heat === 'stale' ? 'var(--blush-ink)' : '#c79a35'} />}
                      </div>
                      <div className="small muted ellipsis">{clientName(vault, d.clientId, d.clientName)}</div>
                      <div className="row between" style={{ marginTop: 8 }}>
                        <span className="num"><b>{gbp(d.value)}</b> <span className="tiny muted">· {d.probability}%</span></span>
                        <button className="btn ghost sm" style={{ padding: '2px 6px' }} title="Move to next stage" onClick={(e) => { e.stopPropagation(); advance(d); }}><ChevronRight size={15} /></button>
                      </div>
                      {h.heat !== 'warm' && <div className="tiny" style={{ color: h.heat === 'stale' ? 'var(--blush-ink)' : '#9a7420', marginTop: 4 }}><Clock size={11} /> {h.reason}</div>}
                      {d.nextAction && h.heat === 'warm' && <div className="tiny muted" style={{ marginTop: 4 }}>→ {d.nextAction}</div>}
                    </div>
                  );
                })}
                {!ds.length && <div className="tiny muted" style={{ padding: 8 }}>Nothing here.</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="list">{[...won, ...lost].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)).map((d) => (
            <div key={d.id} className="item clickable" onClick={() => setEdit(d)}>
              <div className={`avatar ${d.stage === 'Won' ? 't-sage' : 't-grey'}`}>{d.stage === 'Won' ? <Trophy size={16} /> : '×'}</div>
              <div className="grow"><b>{d.title}</b><div className="small muted">{clientName(vault, d.clientId, d.clientName)} · {fmtShort(d.lastActivity)}</div></div>
              <b className="num">{gbp(d.value)}</b>
            </div>))}
            {!won.length && !lost.length && <div className="muted small">Closed opportunities will appear here.</div>}
          </div>
        </Card>
      )}
      {edit && <DealEditor deal={edit} onClose={() => setEdit(undefined)} />}
    </>
  );
}

export function DealEditor({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const { vault, upsert, remove } = useVault();
  const [d, setD] = useState(deal);
  const isNew = !vault.deals.some((x) => x.id === deal.id);
  const set = <K extends keyof Deal>(k: K, v: Deal[K]) => setD((x) => ({ ...x, [k]: v }));
  const h = dealHeat(d, vault.settings.staleDays);

  const save = (patch: Partial<Deal> = {}) => {
    const next = { ...d, ...patch };
    if (!next.title.trim()) return alert('Give it a title');
    if (next.stage === 'Won' && !next.clientId && next.clientName?.trim()) {
      const id = uid();
      upsert('clients', { id, name: next.clientName.trim(), sector: 'Charity / NFP', createdAt: today() });
      next.clientId = id;
    }
    upsert('deals', next);
    onClose();
  };

  return (
    <Modal title={isNew ? 'New opportunity' : d.title} onClose={onClose} footer={<>
      {!isNew && <button className="btn ghost danger left" onClick={() => { if (confirmDelete('this opportunity')) { remove('deals', d.id); onClose(); } }}><Trash2 size={15} /></button>}
      {!isNew && <button className="btn" onClick={() => save({ lastActivity: today() })}>Log contact today</button>}
      <button className="btn primary" onClick={() => save()}>Save</button>
    </>}>
      {!isNew && h.heat !== 'warm' && <Badge tone={h.heat === 'stale' ? 'blush' : 'butter'}>{h.heat === 'stale' ? 'Stale — unlikely to land without a nudge' : 'Cooling'} · {h.reason}</Badge>}
      <div className="form-grid">
        <Field label="What’s the work?" full><input className="input" autoFocus={isNew} value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Annual report copy & design brief" /></Field>
        <Field label="Client">
          <select className="input" value={d.clientId ?? ''} onChange={(e) => set('clientId', e.target.value || undefined)}>
            <option value="">New prospect (type below)</option>
            {vault.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {!d.clientId ? <Field label="Prospect name"><input className="input" value={d.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} /></Field> : <div />}
        <Field label="Contract value (£)"><input className="input num" type="number" value={d.value || ''} onChange={(e) => set('value', e.target.valueAsNumber || 0)} /></Field>
        <Field label="Stage">
          <select className="input" value={d.stage} onChange={(e) => { const s = e.target.value as Stage; setD((x) => ({ ...x, stage: s, probability: STAGE_PROB[s] })); }}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label={`Likelihood · ${d.probability}%`} hint={`Weighted: ${gbp((d.value * d.probability) / 100)}`}><input type="range" min={0} max={100} step={5} value={d.probability} onChange={(e) => set('probability', Number(e.target.value))} style={{ accentColor: 'var(--plum)' }} /></Field>
        <Field label="Expected start"><input className="input" type="date" value={d.expectedStart ?? ''} onChange={(e) => set('expectedStart', e.target.value || undefined)} /></Field>
        <Field label="Last contact"><input className="input" type="date" value={d.lastActivity} onChange={(e) => set('lastActivity', e.target.value)} /></Field>
        <Field label="Source"><input className="input" value={d.source ?? ''} onChange={(e) => set('source', e.target.value)} placeholder="Referral, CharityJob, Contracts Finder…" /></Field>
        <Field label="Link" full><div className="row"><input className="input" value={d.link ?? ''} onChange={(e) => set('link', e.target.value)} placeholder="https://" />{d.link && <a className="btn icon" href={d.link} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}</div></Field>
        <Field label="Next action" full><input className="input" value={d.nextAction ?? ''} onChange={(e) => set('nextAction', e.target.value)} placeholder="e.g. Send credentials deck by Friday" /></Field>
        <Field label="Notes" full><textarea className="input" value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
