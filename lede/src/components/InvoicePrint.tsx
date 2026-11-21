import { Printer } from 'lucide-react';
import { Modal } from './ui';
import { fmtDate } from '../lib/dates';
import { gbp } from '../lib/format';
import { useVault } from '../lib/store';
import type { Invoice } from '../lib/types';

export default function InvoicePrint({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { vault } = useVault();
  const s = vault.settings;
  const c = vault.clients.find((x) => x.id === invoice.clientId);
  return (
    <Modal wide title={`Invoice ${invoice.number}`} onClose={onClose}
      footer={<><span className="small muted left">Use “Save as PDF” in the print dialog to email it.</span><button className="btn primary" onClick={() => window.print()}><Printer size={16} />Print / PDF</button></>}>
      <div className="doc-page printable">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1 className="serif">{s.businessName}</h1>
            <div className="doc-rule" />
            <div style={{ whiteSpace: 'pre-line', color: '#555' }}>{[s.address, s.email, s.phone, s.website].filter(Boolean).join('\n')}</div>
          </div>
          <div className="right">
            <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: '#888' }}>Invoice</div>
            <div className="serif" style={{ fontSize: 22 }}>{invoice.number}</div>
            <div style={{ marginTop: 8, color: '#555' }}>Issued {fmtDate(invoice.issueDate)}<br />Due {fmtDate(invoice.dueDate)}</div>
          </div>
        </div>
        <h2>Billed to</h2>
        <div><b>{c?.name}</b>{c?.contactName && <><br />FAO {c.contactName}</>}{c?.email && <><br />{c.email}</>}</div>
        <table style={{ marginTop: 26 }}>
          <thead><tr><th>Description</th><th className="right">Amount</th></tr></thead>
          <tbody>
            <tr><td>{invoice.description}</td><td className="right num">{gbp(invoice.amount, 2)}</td></tr>
            <tr><td className="right"><b>Total due</b></td><td className="right num"><b style={{ fontSize: 17 }}>{gbp(invoice.amount, 2)}</b></td></tr>
          </tbody>
        </table>
        <h2>Payment</h2>
        <div style={{ whiteSpace: 'pre-line' }}>{s.bankDetails || 'Add your bank details in Settings.'}</div>
        <div style={{ marginTop: 6, color: '#666' }}>Please quote {invoice.number} as the reference. Payment terms: {s.paymentTermsDays} days.</div>
        <div style={{ marginTop: 28, color: '#888', fontSize: 12 }}>{s.ownerName} is not registered for VAT. Thank you for your business.</div>
      </div>
    </Modal>
  );
}
