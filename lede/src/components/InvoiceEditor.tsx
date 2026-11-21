import { useState } from 'react';
import { Trash2, Star } from 'lucide-react';
import { Field, Modal, confirmDelete } from './ui';
import { addDays, today } from '../lib/dates';
import { uid } from '../lib/format';
import { useVault } from '../lib/store';
import type { Invoice } from '../lib/types';

export function newInvoice(v: ReturnType<typeof useVault>['vault'], clientId = ''): Invoice {
  const t = today();
  return {
    id: uid(), number: `${v.settings.invoicePrefix}${String(v.settings.nextInvoiceNumber).padStart(3, '0')}`, clientId,
    description: '', issueDate: t, dueDate: addDays(t, v.settings.paymentTermsDays), amount: 0, profile: 3,
  };
}

export default function InvoiceEditor({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { vault, upsert, remove, update } = useVault();
  const isNew = !vault.invoices.some((i) => i.id === invoice.id);
  const [d, setD] = useState<Invoice>(invoice);
  const [newClient, setNewClient] = useState('');
  const set = <K extends keyof Invoice>(k: K, val: Invoice[K]) => setD((x) => ({ ...x, [k]: val }));

  const save = () => {
    let clientId = d.clientId;
    if (clientId === '__new') {
      if (!newClient.trim()) return alert('Enter the new client’s name');
      clientId = uid();
      upsert('clients', { id: clientId, name: newClient.trim(), sector: 'Charity / NFP', createdAt: today() });
    }
    if (!clientId) return alert('Choose a client');
    upsert('invoices', { ...d, clientId, amount: Number(d.amount) || 0 });
    if (isNew && d.number === invoice.number)
      update((v) => ({ ...v, settings: { ...v.settings, nextInvoiceNumber: v.settings.nextInvoiceNumber + 1 } }));
    onClose();
  };

  return (
    <Modal title={isNew ? 'New invoice' : `Invoice ${d.number}`} onClose={onClose}
      footer={<>
        {!isNew && <button className="btn ghost danger left" onClick={() => { if (confirmDelete('this invoice')) { remove('invoices', d.id); onClose(); } }}><Trash2 size={15} />Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save invoice</button>
      </>}>
      <div className="form-grid">
        <Field label="Client">
          <select className="input" value={d.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Choose…</option>
            {[...vault.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new">+ New client…</option>
          </select>
        </Field>
        {d.clientId === '__new'
          ? <Field label="New client name"><input className="input" autoFocus value={newClient} onChange={(e) => setNewClient(e.target.value)} /></Field>
          : <Field label="Invoice number"><input className="input" value={d.number} onChange={(e) => set('number', e.target.value)} /></Field>}
        <Field label="Description of work" full><input className="input" value={d.description} placeholder="e.g. Campaign messaging framework & launch copy" onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Amount (£)"><input className="input num" type="number" inputMode="decimal" min={0} step="0.01" value={d.amount || ''} onChange={(e) => set('amount', e.target.valueAsNumber || 0)} /></Field>
        <Field label="Issue date"><input className="input" type="date" value={d.issueDate} onChange={(e) => setD((x) => ({ ...x, issueDate: e.target.value, dueDate: addDays(e.target.value, vault.settings.paymentTermsDays) }))} /></Field>
        <Field label="Due date"><input className="input" type="date" value={d.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
        <Field label="Paid on" hint="Leave blank while unpaid">
          <div className="row"><input className="input" type="date" value={d.paidDate ?? ''} onChange={(e) => set('paidDate', e.target.value || undefined)} />
            {!d.paidDate && <button className="btn sm" onClick={() => set('paidDate', today())}>Today</button>}</div>
        </Field>
      </div>
      <div className="note stack" style={{ gap: 10 }}>
        <div className="row between wrap">
          <label className="check"><input type="checkbox" checked={!!d.showcase} onChange={(e) => set('showcase', e.target.checked)} /><b>Showcase in pitch materials</b></label>
          <div className="row" style={{ gap: 2 }} title="How high-profile or exciting was this work?">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="btn ghost icon" style={{ padding: 3 }} onClick={() => set('profile', n)} aria-label={`${n} stars`}>
                <Star size={18} fill={(d.profile ?? 0) >= n ? '#e8b04b' : 'none'} color={(d.profile ?? 0) >= n ? '#e8b04b' : '#cbbfcf'} />
              </button>
            ))}
          </div>
        </div>
        <input className="input" value={d.highlight ?? ''} placeholder="One-line highlight for CVs, e.g. ‘Campaign reached 2m people; covered by the Guardian’" onChange={(e) => set('highlight', e.target.value)} />
      </div>
    </Modal>
  );
}
