import { useEffect, useState } from 'react';
import { Lock as LockIcon, Eye, EyeOff, CloudDownload, Upload } from 'lucide-react';
import { createVault, loadSealed, unlockSealed, wipeLocal, type Session } from '../lib/store';
import { connectDrive, pullVault } from '../lib/drive';
import { sampleVault } from '../lib/sample';
import type { Sealed } from '../lib/crypto';

type Mode = 'loading' | 'unlock' | 'create' | 'restore';

export default function Lock({ onUnlock }: { onUnlock: (s: Session) => void }) {
  const [mode, setMode] = useState<Mode>('loading');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const DEMO = import.meta.env.VITE_DEMO === '1';
  const [sample, setSample] = useState(DEMO);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sealed, setSealed] = useState<Sealed>();
  const [clientId, setClientId] = useState(localStorage.getItem('lede-gcid') ?? '');

  useEffect(() => { loadSealed().then((s) => { setSealed(s); setMode(s ? 'unlock' : 'create'); }); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e: any) { setErr(e?.message || 'Something went wrong'); } finally { setBusy(false); }
  };

  const unlock = () => run(async () => {
    try { onUnlock(await unlockSealed(pw, sealed!)); }
    catch { throw new Error('That password didn’t work. Try again.'); }
  });

  const create = () => run(async () => {
    if (pw.length < 10) throw new Error('Use at least 10 characters — a short phrase is ideal.');
    if (pw !== pw2) throw new Error('Passwords don’t match.');
    onUnlock(await createVault(pw, sample ? sampleVault() : undefined));
  });

  const restoreFromDrive = () => run(async () => {
    localStorage.setItem('lede-gcid', clientId.trim());
    await connectDrive(clientId.trim());
    const remote = await pullVault();
    if (!remote) throw new Error('No Lede backup found in this Google account yet.');
    try { onUnlock(await unlockSealed(pw, remote, true)); }
    catch { throw new Error('Found your backup, but the password didn’t open it.'); }
  });

  const restoreFromFile = (f?: File) => f && run(async () => {
    const remote = JSON.parse(await f.text()) as Sealed;
    try { onUnlock(await unlockSealed(pw, remote, true)); }
    catch { throw new Error('Enter the password used for this backup first, then choose the file.'); }
  });

  const reset = async () => {
    if (!confirm('Erase everything stored on this device and start again? Only do this if you have a backup or Drive sync.')) return;
    if (prompt('Type ERASE to confirm') !== 'ERASE') return;
    await wipeLocal(); setSealed(undefined); setMode('create'); setPw('');
  };

  const pwInput = (placeholder: string, value: string, set: (s: string) => void, autoFocus = false) => (
    <div style={{ position: 'relative' }}>
      <input className="input" type={show ? 'text' : 'password'} placeholder={placeholder} value={value} autoFocus={autoFocus}
        autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        onChange={(e) => set(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (mode === 'unlock' ? unlock() : mode === 'create' ? create() : null)} />
      <button type="button" className="btn ghost icon" style={{ position: 'absolute', right: 2, top: 2 }} onClick={() => setShow(!show)} aria-label="Show password">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );

  if (mode === 'loading') return <div className="lock" />;

  return (
    <div className="lock">
      <div className="lock-card stack">
        <div>
          <div className="brand-mark">L</div>
          <h1>{mode === 'unlock' ? 'Welcome back, Eleanor' : mode === 'restore' ? 'Restore your studio' : 'Hello, Eleanor'}</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            {mode === 'unlock' && 'Your business, kept private. Enter your password to open Lede.'}
            {mode === 'create' && 'Lede is your private studio for money, pipeline, clients and pitches. Choose a password — everything is encrypted with it on this device.'}
            {mode === 'restore' && 'Bring your encrypted data across from Google Drive or a backup file.'}
          </p>
        </div>

        {mode === 'unlock' && <>
          {pwInput('Password', pw, setPw, true)}
          {err && <div className="err">{err}</div>}
          <button className="btn primary" disabled={busy || !pw} onClick={unlock}><LockIcon size={16} />{busy ? 'Unlocking…' : 'Unlock'}</button>
          <button className="btn ghost sm muted" onClick={reset}>Forgotten password? Reset this device</button>
        </>}

        {mode === 'create' && <>
          {pwInput('Choose a password', pw, setPw, true)}
          {pwInput('Confirm password', pw2, setPw2)}
          <label className="check"><input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} />Start with sample data to explore</label>
          {DEMO && <div className="note" style={{ background: 'var(--lav)', borderStyle: 'solid' }}><b>Demo.</b> All clients and figures are fictional. Make up any password of 10+ characters. Nothing leaves this browser.</div>}
          <div className="note">There’s no password recovery — that’s what keeps it private. Keep it in your password manager, and turn on Drive sync or export backups in Settings.</div>
          {err && <div className="err">{err}</div>}
          <button className="btn primary" disabled={busy} onClick={create}>{busy ? 'Setting up…' : 'Create my studio'}</button>
          <button className="btn ghost sm" onClick={() => { setMode('restore'); setErr(''); }}>Already use Lede on another device?</button>
        </>}

        {mode === 'restore' && <>
          {pwInput('Your Lede password', pw, setPw, true)}
          <label className="field"><span>Google OAuth client ID <span className="hint">(from Settings on your other device)</span></span>
            <input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" /></label>
          {err && <div className="err">{err}</div>}
          <button className="btn primary" disabled={busy || !pw || !clientId} onClick={restoreFromDrive}><CloudDownload size={16} />Restore from Google Drive</button>
          <label className="btn" style={{ opacity: pw ? 1 : .5 }}><Upload size={16} />Restore from backup file
            <input type="file" accept=".lede,application/json" hidden disabled={!pw} onChange={(e) => restoreFromFile(e.target.files?.[0])} /></label>
          <button className="btn ghost sm" onClick={() => { setMode('create'); setErr(''); }}>← Start fresh instead</button>
        </>}
      </div>
    </div>
  );
}
