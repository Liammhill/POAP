import { useState } from 'react';
import { HardDrive, Download, KeyRound, ShieldCheck, Trash2, CloudUpload } from 'lucide-react';
import { Badge, Card, CardHead, Field, PageHead } from '../components/ui';
import { connectDrive, disconnectDrive, driveConnected, pullVault } from '../lib/drive';
import { DEFAULT_TAX } from '../lib/tax';
import { emptyVault } from '../lib/defaults';
import { today } from '../lib/dates';
import { useVault } from '../lib/store';
import type { Settings as S, TaxParams } from '../lib/types';

export default function Settings() {
  const { vault, update, changePassword, exportBackup, syncNow, sync, syncError } = useVault();
  const s = vault.settings;
  const set = (patch: Partial<S>) => update((v) => ({ ...v, settings: { ...v.settings, ...patch } }));
  const setTax = (k: keyof TaxParams, val: number) => set({ tax: { ...s.tax, [k]: val } });
  const [connected, setConnected] = useState(driveConnected());
  const [msg, setMsg] = useState('');
  const [pw, setPw] = useState({ a: '', b: '' });

  const txt = (k: keyof S, label: string, hint?: string, type = 'text') => (
    <Field label={label} hint={hint}><input className="input" type={type} value={String(s[k] ?? '')} onChange={(e) => set({ [k]: type === 'number' ? e.target.valueAsNumber || 0 : e.target.value } as Partial<S>)} /></Field>
  );

  const connect = async () => {
    setMsg('');
    try {
      localStorage.setItem('lede-gcid', s.googleClientId);
      await connectDrive(s.googleClientId);
      setConnected(true);
      const remote = await pullVault();
      if (remote && remote.updatedAt > vault.updatedAt) setMsg(`A newer copy exists on Drive (saved ${new Date(remote.updatedAt).toLocaleString('en-GB')}). Lock and use “Already use Lede on another device?” → reset this device to load it, or press “Sync now” to overwrite it with this one.`);
      else setMsg('Connected to Google Drive.');
    } catch (e: any) { setMsg(e.message); }
  };

  const backup = async () => {
    const sealed = await exportBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(sealed)], { type: 'application/json' }));
    a.download = `lede-backup-${today()}.lede`; a.click();
  };

  return (
    <>
      <PageHead eyebrow="Settings" title="Studio settings" />
      <div className="grid g2">
        <Card>
          <CardHead title="Business details" sub="Shown on invoices and your CV" />
          <div className="form-grid">
            {txt('ownerName', 'Your name')}{txt('businessName', 'Trading name')}
            {txt('email', 'Email', undefined, 'email')}{txt('phone', 'Phone', undefined, 'tel')}
            {txt('website', 'Website')}
            <Field label="Address"><textarea className="input" rows={2} value={s.address} onChange={(e) => set({ address: e.target.value })} /></Field>
            <Field label="Bank details for invoices" full><textarea className="input" rows={2} value={s.bankDetails} onChange={(e) => set({ bankDetails: e.target.value })} /></Field>
            {txt('invoicePrefix', 'Invoice prefix')}{txt('nextInvoiceNumber', 'Next invoice number', undefined, 'number')}
            {txt('paymentTermsDays', 'Payment terms (days)', undefined, 'number')}
            {txt('staleDays', 'Pipeline: “cooling” after (days)', 'Stale at double this', 'number')}
          </div>
        </Card>

        <Card tint="lav">
          <CardHead title={<span className="row"><HardDrive size={18} />Google Drive</span>} sub="Read historic records from Drive, and sync your encrypted data between phone and laptop" />
          <div className="stack" style={{ gap: 12 }}>
            <Field label="OAuth client ID" hint={<>One-time setup — see <b>Connecting Google Drive</b> in the README.</>}>
              <input className="input" value={s.googleClientId} placeholder="xxxx.apps.googleusercontent.com" onChange={(e) => set({ googleClientId: e.target.value.trim() })} />
            </Field>
            <div className="row wrap">
              {connected ? <Badge tone="sage">Connected this session</Badge> : <Badge tone="grey">Not connected</Badge>}
              <button className="btn primary sm" disabled={!s.googleClientId} onClick={connect}>{connected ? 'Reconnect' : 'Connect'}</button>
              {connected && <button className="btn sm" onClick={() => { disconnectDrive(); setConnected(false); }}>Disconnect</button>}
            </div>
            <label className="check"><input type="checkbox" checked={s.driveSync} onChange={(e) => set({ driveSync: e.target.checked })} />Back up &amp; sync my encrypted data to Drive</label>
            {s.driveSync && <div className="row"><button className="btn sm" disabled={!connected} onClick={() => syncNow().then(() => setMsg('Synced.'))}><CloudUpload size={14} />Sync now</button><span className="small muted">{sync === 'error' ? syncError : sync === 'saving' ? 'Saving…' : 'Saves automatically after changes.'}</span></div>}
            {msg && <div className="note">{msg}</div>}
            <div className="tiny muted">Drive only ever receives the encrypted file, stored in a hidden app folder. Google can’t read it, and neither can anyone without your password.</div>
          </div>
        </Card>

        <Card>
          <CardHead title="Tax" sub="Defaults are 2026/27 rates for England, Wales & NI" />
          <label className="check" style={{ marginBottom: 14 }}><input type="checkbox" checked={s.bankManaged} onChange={(e) => set({ bankManaged: e.target.checked })} />Invoicing and tax filing are done in Starling</label>
          <div className="form-grid">
            <Field label="Accounting basis"><select className="input" value={s.basis} onChange={(e) => set({ basis: e.target.value as S['basis'] })}><option value="cash">Cash basis (default for sole traders)</option><option value="accruals">Accruals</option></select></Field>
            {txt('otherIncome', 'Other taxable income (£/yr)', 'Salary, pension etc. — affects your band', 'number')}
            {([['personalAllowance', 'Personal allowance'], ['basicBand', 'Basic-rate band'], ['additionalThreshold', 'Additional-rate threshold'], ['niLower', 'Class 4 lower limit'], ['niUpper', 'Class 4 upper limit'], ['vatThreshold', 'VAT threshold']] as [keyof TaxParams, string][]).map(([k, l]) => (
              <Field key={k} label={l}><input className="input num" type="number" value={s.tax[k]} onChange={(e) => setTax(k, e.target.valueAsNumber || 0)} /></Field>
            ))}
            {([['basicRate', 'Basic rate'], ['higherRate', 'Higher rate'], ['niMainRate', 'Class 4 main rate'], ['niUpperRate', 'Class 4 upper rate']] as [keyof TaxParams, string][]).map(([k, l]) => (
              <Field key={k} label={`${l} (%)`}><input className="input num" type="number" step="0.5" value={+(s.tax[k] * 100).toFixed(2)} onChange={(e) => setTax(k, (e.target.valueAsNumber || 0) / 100)} /></Field>
            ))}
          </div>
          <button className="btn sm" style={{ marginTop: 12 }} onClick={() => set({ tax: { ...DEFAULT_TAX } })}>Reset to 2026/27 defaults</button>
        </Card>

        <Card>
          <CardHead title="Opportunity scout" sub="Opportunities are scored against these words (comma separated)" />
          <textarea className="input" rows={6} value={s.keywords} onChange={(e) => set({ keywords: e.target.value })} />
        </Card>

        <Card tint="sage">
          <CardHead title={<span className="row"><ShieldCheck size={18} />Privacy & security</span>} />
          <div className="stack" style={{ gap: 12 }}>
            <div className="small">Everything is encrypted on this device with AES-256 using a key derived from your password. Nothing is sent anywhere except the encrypted Drive backup (if you turn it on).</div>
            {txt('autoLockMinutes', 'Auto-lock after (minutes idle)', '0 to never auto-lock', 'number')}
            <div className="form-grid">
              <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
              <Field label="Confirm"><input className="input" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
            </div>
            <button className="btn sm" disabled={pw.a.length < 10 || pw.a !== pw.b} onClick={async () => { await changePassword(pw.a); setPw({ a: '', b: '' }); alert('Password changed. Use the new one on your other devices too after they sync.'); }}><KeyRound size={14} />Change password</button>
          </div>
        </Card>

        <Card>
          <CardHead title="Your data" />
          <div className="stack" style={{ gap: 10 }}>
            <button className="btn" onClick={backup}><Download size={16} />Download encrypted backup</button>
            {Object.keys(s.bankRules).length > 0 && <button className="btn" onClick={() => set({ bankRules: {} })}>Forget {Object.keys(s.bankRules).length} saved Starling payee choices</button>}
            <div className="tiny muted">A .lede file — restore it on any device with your password.</div>
            <button className="btn danger" onClick={() => {
              if (!confirm('Remove ALL clients, invoices, expenses, pipeline and documents? Settings are kept.')) return;
              if (prompt('Type DELETE to confirm') !== 'DELETE') return;
              update((v) => ({ ...emptyVault(), settings: v.settings, profile: v.profile }));
            }}><Trash2 size={16} />Clear all business data</button>
          </div>
        </Card>
      </div>
    </>
  );
}
