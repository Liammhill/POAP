import { useMemo, useState } from 'react';
import { Landmark, Upload, CheckCircle2 } from 'lucide-react';
import { Badge, Modal } from './ui';
import { applyStarling, defaultRule, groupTxns, parseStarling, ruleKey, sampleStarlingCsv, titleCase, type Group, type ImportResult, type Txn } from '../lib/starling';
import { fmtDate } from '../lib/dates';
import { gbp, sum } from '../lib/format';
import { useVault } from '../lib/store';
import type { BankRule, ExpenseCategory } from '../lib/types';

const CATS: ExpenseCategory[] = ['Travel', 'Mileage', 'Software & subscriptions', 'Phone & internet', 'Office & equipment', 'Training & CPD', 'Professional fees', 'Marketing', 'Use of home', 'Other'];
type Choice = BankRule | { kind: 'new' };
const enc = (c: Choice) => (c.kind === 'client' ? `client:${c.clientId}` : c.kind === 'expense' ? `expense:${c.category}` : c.kind);
const dec = (s: string): Choice => {
  const [k, v] = s.split(':');
  return k === 'client' ? { kind: 'client', clientId: v } : k === 'expense' ? { kind: 'expense', category: v as ExpenseCategory } : { kind: k as 'new' | 'ignore' };
};

export default function StarlingImport({ onClose }: { onClose: () => void }) {
  const { vault, update } = useVault();
  const [txns, setTxns] = useState<Txn[]>();
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Omit<ImportResult, 'vault'>>();
  const groups = useMemo(() => (txns ? groupTxns(txns) : []), [txns]);
  const isDemo = import.meta.env.VITE_DEMO === '1';

  const load = async (buf: ArrayBuffer | string) => {
    setErr('');
    try {
      const XLSX = await import('xlsx');
      const wb = typeof buf === 'string' ? XLSX.read(buf, { type: 'string', raw: true }) : XLSX.read(buf, { type: 'array', raw: true });
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }) as unknown[][];
      const t = parseStarling(grid);
      if (!t.length) throw new Error('No transactions found in that file.');
      const gs = groupTxns(t);
      setChoice(Object.fromEntries(gs.map((g) => [ruleKey(g.dir, g.name), defaultRule(g, vault)])));
      setTxns(t);
    } catch (e: any) { setErr(e.message); }
  };

  const run = () => {
    const r = applyStarling(vault, groups, choice);
    update(() => r.vault);
    const { vault: _, ...counts } = r;
    setDone(counts);
  };

  const row = (g: Group) => {
    const k = ruleKey(g.dir, g.name);
    const c = choice[k];
    if (!c) return null;
    const off = c.kind === 'ignore';
    return (
      <div key={k} className="item" style={{ opacity: off ? 0.55 : 1, padding: '9px 0', flexWrap: 'wrap' }}>
        <div className="grow" style={{ minWidth: 150 }}>
          <div className="ellipsis"><b>{g.name}</b></div>
          <div className="tiny muted">{g.count} × · {g.hint || '—'}</div>
        </div>
        <b className="num small" style={{ width: 80, textAlign: 'right' }}>{gbp(g.total)}</b>
        <select className="input" style={{ width: 210, maxWidth: '100%', minHeight: 34, padding: '5px 8px', fontSize: 13 }} value={enc(c)} onChange={(e) => setChoice({ ...choice, [k]: dec(e.target.value) })}>
          <option value="ignore">{g.dir === 'in' ? 'Not client income' : 'Not a business cost'}</option>
          {g.dir === 'in' ? <>
            <option value="new">New client: {titleCase(g.name)}</option>
            {[...vault.clients].sort((a, b) => a.name.localeCompare(b.name)).map((cl) => <option key={cl.id} value={`client:${cl.id}`}>{cl.name}</option>)}
          </> : CATS.map((cat) => <option key={cat} value={`expense:${cat}`}>{cat}</option>)}
        </select>
      </div>
    );
  };

  const dates = txns?.map((t) => t.date).sort() ?? [];
  const ins = groups.filter((g) => g.dir === 'in');
  const outs = groups.filter((g) => g.dir === 'out');
  const counted = (gs: Group[]) => sum(gs.filter((g) => choice[ruleKey(g.dir, g.name)]?.kind !== 'ignore'), (g) => g.total);

  return (
    <Modal wide title={<span className="row"><Landmark size={20} />Import from Starling</span>} onClose={onClose}
      footer={done ? <button className="btn primary" onClick={onClose}>Done</button> : txns && <>
        <span className="small muted left">Lede remembers these choices for next time.</span>
        <button className="btn" onClick={() => setTxns(undefined)}>Back</button>
        <button className="btn primary" onClick={run}>Import</button>
      </>}>
      {done && (
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={40} color="var(--sage-ink)" />
          <h2>Statement imported</h2>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <Badge tone="sage">{done.income} payment{done.income === 1 ? '' : 's'} added</Badge>
            {done.reconciled > 0 && <Badge tone="lav">{done.reconciled} invoice{done.reconciled === 1 ? '' : 's'} marked paid</Badge>}
            <Badge tone="peach">{done.expenses} expense{done.expenses === 1 ? '' : 's'}</Badge>
            {done.newClients > 0 && <Badge tone="sky">{done.newClients} new client{done.newClients === 1 ? '' : 's'}</Badge>}
            <Badge tone="grey">{done.skipped} skipped</Badge>
          </div>
          <div className="small muted">Transactions already in Lede are skipped, so overlapping statements are fine. New clients default to the Charity / NFP sector; you can change that in Clients.</div>
        </div>
      )}

      {!done && !txns && <>
        <div className="note">
          <b>Export from Starling</b> (the app or the website): open your business account’s <b>Statements</b> or transaction export, choose a date range and pick <b>CSV</b>. Then bring the file here. Monthly is ideal, and any overlap is skipped.
        </div>
        <label className="note" style={{ textAlign: 'center', padding: 30, cursor: 'pointer', borderStyle: 'solid' }}>
          <Upload size={28} className="muted" /><div><b>Choose Starling CSV</b></div><div className="small muted">Stays on this device; nothing is uploaded</div>
          <input type="file" hidden accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.arrayBuffer()); }} />
        </label>
        {isDemo && <button className="btn" onClick={() => load(sampleStarlingCsv())}>Try with a sample statement</button>}
        {err && <div className="err">{err}</div>}
      </>}

      {!done && txns && <>
        <div className="note" style={{ borderStyle: 'solid' }}>
          <b>{txns.length}</b> transactions · {fmtDate(dates[0])} → {fmtDate(dates.at(-1))} · counting <b>{gbp(counted(ins))}</b> income and <b>{gbp(counted(outs))}</b> costs
        </div>
        <div>
          <h3>Money in</h3>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Match each payer to a client. Payments matching an unpaid invoice of the same amount mark it paid.</div>
          <div className="list">{ins.map(row)}</div>
        </div>
        <div>
          <h3>Money out</h3>
          <div className="tiny muted" style={{ marginBottom: 4 }}>Tax payments and transfers to yourself are left out of business costs.</div>
          <div className="list">{outs.map(row)}</div>
        </div>
      </>}
    </Modal>
  );
}
