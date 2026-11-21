import { useMemo, useState } from 'react';
import { FileSpreadsheet, HardDrive, Upload, Search } from 'lucide-react';
import { Field, Modal, Seg } from './ui';
import { connectDrive, downloadSpreadsheet, driveConnected, searchSpreadsheets, type DriveFile } from '../lib/drive';
import { addDays, fmtDate, toISO } from '../lib/dates';
import { gbp, sum, uid } from '../lib/format';
import { useVault } from '../lib/store';
import type { Client, Expense, Invoice } from '../lib/types';

type Target = 'invoices' | 'expenses';
type Grid = unknown[][];
const FIELDS: Record<Target, { key: string; label: string; re: RegExp; required?: boolean }[]> = {
  invoices: [
    { key: 'number', label: 'Invoice no.', re: /inv.*(no|num|#|ref)|^ref|^invoice$|^number/i },
    { key: 'client', label: 'Client', re: /client|customer|organi[sz]ation|company|billed|^to$/i, required: true },
    { key: 'description', label: 'Description', re: /desc|project|work|service|detail|job/i },
    { key: 'issueDate', label: 'Invoice date', re: /(inv|issue|raised|sent).*date|^date$/i, required: true },
    { key: 'dueDate', label: 'Due date', re: /due/i },
    { key: 'amount', label: 'Amount (£)', re: /amount|total|net|value|fee|£|gbp/i, required: true },
    { key: 'paidDate', label: 'Paid date', re: /paid.*(date|on)|date.*paid|received|payment date/i },
    { key: 'status', label: 'Paid? / status', re: /status|^paid\??$|settled/i },
  ],
  expenses: [
    { key: 'date', label: 'Date', re: /date/i, required: true },
    { key: 'description', label: 'Description', re: /desc|item|detail|supplier|payee|merchant/i },
    { key: 'category', label: 'Category', re: /cat|type/i },
    { key: 'amount', label: 'Amount (£)', re: /amount|total|cost|value|£|gbp/i, required: true },
  ],
};

function toDate(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (v instanceof Date && !isNaN(+v)) return toISO(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) return toISO(new Date(Math.round((v - 25569) * 86400 * 1000) + new Date().getTimezoneOffset() * 60000));
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/); // UK dd/mm/yyyy
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  const d = new Date(s);
  return isNaN(+d) ? undefined : toISO(d);
}
const toNum = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[£,\s]/g, '').replace(/^\((.*)\)$/, '-$1')) || 0);
const truthyPaid = (v: unknown) => /^(y|yes|paid|true|1|settled|received|✓|x)$/i.test(String(v ?? '').trim());

export default function Importer({ onClose }: { onClose: () => void }) {
  const { vault, update } = useVault();
  const [target, setTarget] = useState<Target>('invoices');
  const [src, setSrc] = useState<'file' | 'drive'>('file');
  const [book, setBook] = useState<{ name: string; sheets: Record<string, Grid> }>();
  const [sheet, setSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState<Record<string, number>>({});
  const [files, setFiles] = useState<DriveFile[]>();
  const [q, setQ] = useState('invoice');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const parse = async (name: string, buf: ArrayBuffer) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheets: Record<string, Grid> = {};
    wb.SheetNames.forEach((n) => { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) as Grid; });
    setBook({ name, sheets });
    pickSheet(wb.SheetNames[0], sheets);
  };

  const pickSheet = (n: string, sheets = book!.sheets, t = target) => {
    setSheet(n);
    const g = sheets[n] ?? [];
    const hr = Math.max(0, g.slice(0, 15).findIndex((r) => r.filter((c) => typeof c === 'string' && c.trim()).length >= 3));
    setHeaderRow(hr);
    autoMap(g[hr] ?? [], t);
  };
  const autoMap = (headers: unknown[], t: Target) => {
    const m: Record<string, number> = {};
    const used = new Set<number>();
    FIELDS[t].forEach((f) => {
      const i = headers.findIndex((h, j) => !used.has(j) && f.re.test(String(h)));
      if (i >= 0) { m[f.key] = i; used.add(i); }
    });
    setMap(m);
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setErr('');
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const grid = book?.sheets[sheet] ?? [];
  const headers = (grid[headerRow] ?? []).map((h, i) => String(h || `Column ${i + 1}`));
  const cell = (r: unknown[], k: string) => (map[k] !== undefined ? r[map[k]] : undefined);

  const rows = useMemo(() => {
    const body = grid.slice(headerRow + 1).filter((r) => r.some((c) => c !== ''));
    if (target === 'invoices') {
      return body.map((r) => {
        const issueDate = toDate(cell(r, 'issueDate'));
        const paidDate = toDate(cell(r, 'paidDate')) ?? (truthyPaid(cell(r, 'status')) ? issueDate && addDays(issueDate, 30) : undefined);
        return { client: String(cell(r, 'client') ?? '').trim(), number: String(cell(r, 'number') ?? '').trim(), description: String(cell(r, 'description') ?? '').trim(),
          issueDate, dueDate: toDate(cell(r, 'dueDate')), amount: toNum(cell(r, 'amount')), paidDate };
      }).filter((r) => r.client && r.issueDate && r.amount > 0);
    }
    return body.map((r) => ({ date: toDate(cell(r, 'date')), description: String(cell(r, 'description') ?? '').trim(), category: String(cell(r, 'category') ?? '').trim(), amount: Math.abs(toNum(cell(r, 'amount'))) }))
      .filter((r) => r.date && r.amount > 0);
  }, [grid, headerRow, map, target]); // eslint-disable-line

  const dates = rows.map((r: any) => r.issueDate ?? r.date).sort();

  const doImport = () => {
    update((v) => {
      if (target === 'expenses') {
        const known = new Set(v.expenses.map((e) => `${e.date}|${e.amount}|${e.description}`));
        const add: Expense[] = (rows as any[]).filter((r) => !known.has(`${r.date}|${r.amount}|${r.description}`)).map((r) => ({
          id: uid(), date: r.date, description: r.description || r.category || 'Expense', amount: r.amount,
          category: (['Travel', 'Mileage', 'Software & subscriptions', 'Phone & internet', 'Office & equipment', 'Training & CPD', 'Professional fees', 'Marketing', 'Use of home'] as const).find((c) => c.toLowerCase().includes(r.category.toLowerCase().split(' ')[0] || '~')) ?? 'Other',
        }));
        alert(`Imported ${add.length} expenses${rows.length - add.length ? ` (skipped ${rows.length - add.length} duplicates)` : ''}.`);
        return { ...v, expenses: [...v.expenses, ...add] };
      }
      const clients: Client[] = [...v.clients];
      const findClient = (name: string) => {
        let c = clients.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!c) { c = { id: uid(), name, sector: 'Charity / NFP', createdAt: toISO(new Date()) }; clients.push(c); }
        return c.id;
      };
      const known = new Set(v.invoices.map((i) => `${i.number}|${i.issueDate}|${i.amount}`));
      const add: Invoice[] = [];
      (rows as any[]).forEach((r, idx) => {
        const number = r.number || `IMP-${r.issueDate}-${idx + 1}`;
        if (known.has(`${number}|${r.issueDate}|${r.amount}`)) return;
        add.push({ id: uid(), number, clientId: findClient(r.client), description: r.description, issueDate: r.issueDate,
          dueDate: r.dueDate ?? addDays(r.issueDate, v.settings.paymentTermsDays), amount: r.amount, paidDate: r.paidDate, profile: 3 });
      });
      alert(`Imported ${add.length} invoices and ${clients.length - v.clients.length} new clients${rows.length - add.length ? ` (skipped ${rows.length - add.length} already in Lede)` : ''}.`);
      return { ...v, clients, invoices: [...v.invoices, ...add] };
    });
    onClose();
  };

  const missing = FIELDS[target].filter((f) => f.required && map[f.key] === undefined);

  return (
    <Modal wide title="Import records" onClose={onClose}
      footer={book && <>
        <span className="small muted left">{rows.length} usable rows{missing.length ? ` · map ${missing.map((m) => m.label).join(', ')}` : ''}</span>
        <button className="btn" onClick={() => setBook(undefined)}>Back</button>
        <button className="btn primary" disabled={!rows.length || !!missing.length} onClick={doImport}>Import {rows.length} {target}</button>
      </>}>
      {!book && <>
        <div className="row wrap between">
          <Seg value={target} onChange={setTarget} options={[{ value: 'invoices', label: 'Invoices / income' }, { value: 'expenses', label: 'Expenses' }]} />
          <Seg value={src} onChange={setSrc} options={[{ value: 'file', label: <span className="row" style={{ gap: 6 }}><Upload size={14} />Upload file</span> }, { value: 'drive', label: <span className="row" style={{ gap: 6 }}><HardDrive size={14} />Google Drive</span> }]} />
        </div>
        {src === 'file' && (
          <label className="note" style={{ textAlign: 'center', padding: 30, cursor: 'pointer' }}>
            <FileSpreadsheet size={30} className="muted" /><div><b>Choose a spreadsheet</b></div><div className="small">Excel (.xlsx/.xls) or CSV — e.g. an export of your invoice log or bank statement</div>
            <input type="file" hidden accept=".csv,.xlsx,.xls,.ods" onChange={(e) => { const f = e.target.files?.[0]; if (f) run('Reading…', async () => parse(f.name, await f.arrayBuffer())); }} />
          </label>
        )}
        {src === 'drive' && (!driveConnected()
          ? <div className="note stack" style={{ gap: 10 }}>
              <div>Connect Google Drive to search your Sheets, Excel and CSV files. Lede only reads — it never changes your files.</div>
              <button className="btn primary" onClick={() => run('Connecting…', async () => { await connectDrive(vault.settings.googleClientId); setFiles(await searchSpreadsheets(q)); })}><HardDrive size={16} />Connect Google Drive</button>
              {!vault.settings.googleClientId && <div className="small err">First add a Google OAuth client ID in Settings → Google Drive.</div>}
            </div>
          : <>
              <div className="row"><div className="grow search"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run('Searching…', async () => setFiles(await searchSpreadsheets(q)))} placeholder="Search Drive, e.g. invoices 2024" /></div>
                <button className="btn" onClick={() => run('Searching…', async () => setFiles(await searchSpreadsheets(q)))}>Search</button></div>
              <div className="list">{files?.map((f) => (
                <div key={f.id} className="item clickable" onClick={() => run('Downloading…', async () => parse(f.name, await downloadSpreadsheet(f)))}>
                  <div className="avatar t-sage"><FileSpreadsheet size={16} /></div>
                  <div className="grow"><div className="ellipsis"><b>{f.name}</b></div><div className="tiny muted">Modified {fmtDate(f.modifiedTime.slice(0, 10))}</div></div>
                </div>))}
                {files && !files.length && <div className="muted small">No spreadsheets match.</div>}
              </div>
            </>)}
        {busy && <div className="muted">{busy}</div>}
        {err && <div className="err">{err}</div>}
      </>}

      {book && <>
        <div className="row wrap">
          <div className="grow"><b>{book.name}</b></div>
          {Object.keys(book.sheets).length > 1 && <select className="input" style={{ width: 'auto' }} value={sheet} onChange={(e) => pickSheet(e.target.value)}>{Object.keys(book.sheets).map((n) => <option key={n}>{n}</option>)}</select>}
          <label className="row small">Header row <input className="input" type="number" min={1} style={{ width: 70 }} value={headerRow + 1} onChange={(e) => { const h = Math.max(0, (e.target.valueAsNumber || 1) - 1); setHeaderRow(h); autoMap(grid[h] ?? [], target); }} /></label>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {FIELDS[target].map((f) => (
            <Field key={f.key} label={f.label + (f.required ? ' *' : '')}>
              <select className="input" value={map[f.key] ?? ''} onChange={(e) => setMap((m) => { const n = { ...m }; if (e.target.value === '') delete n[f.key]; else n[f.key] = Number(e.target.value); return n; })}>
                <option value="">— not in sheet —</option>
                {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </select>
            </Field>
          ))}
        </div>
        {rows.length > 0 && <div className="note">
          <b>{rows.length}</b> records · total <b>{gbp(sum(rows as any[], (r) => r.amount))}</b> · {fmtDate(dates[0])} → {fmtDate(dates.at(-1))}
          {target === 'invoices' && <> · {(rows as any[]).filter((r) => r.paidDate).length} marked paid · {new Set((rows as any[]).map((r) => r.client.toLowerCase())).size} clients</>}
        </div>}
        <div className="table-wrap">
          <table>
            <thead><tr>{(target === 'invoices' ? ['Client', 'No.', 'Date', 'Amount', 'Paid'] : ['Date', 'Description', 'Category', 'Amount']).map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{(rows as any[]).slice(0, 8).map((r, i) => target === 'invoices'
              ? <tr key={i}><td>{r.client}</td><td>{r.number}</td><td>{fmtDate(r.issueDate)}</td><td className="num">{gbp(r.amount, 2)}</td><td>{r.paidDate ? fmtDate(r.paidDate) : '—'}</td></tr>
              : <tr key={i}><td>{fmtDate(r.date)}</td><td>{r.description}</td><td>{r.category}</td><td className="num">{gbp(r.amount, 2)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="tiny muted">Rows without a client, date or amount are skipped. Duplicates of records already in Lede are ignored, so re-importing is safe.</div>
      </>}
    </Modal>
  );
}
