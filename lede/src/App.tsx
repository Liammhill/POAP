import { useEffect, useMemo, useState } from 'react';
import { Home, Wallet, KanbanSquare, Users, Telescope, FileBadge, Settings as Cog, LogOut, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { DEMO, VaultProvider, useVault, type Session } from './lib/store';
import { deriveKey, newSalt } from './lib/crypto';
import { sampleVault } from './lib/sample';
import { clientStats, dealHeat } from './lib/analytics';
import Lock from './pages/Lock';
import Dashboard from './pages/Dashboard';
import Finance from './pages/Finance';
import Pipeline from './pages/Pipeline';
import Clients from './pages/Clients';
import Scout from './pages/Scout';
import Pitch from './pages/Pitch';
import Settings from './pages/Settings';

export type Page = 'home' | 'money' | 'pipeline' | 'clients' | 'scout' | 'pitch' | 'settings';
const NAV: { id: Page; label: string; short: string; Icon: typeof Home }[] = [
  { id: 'home', label: 'Today', short: 'Today', Icon: Home },
  { id: 'money', label: 'Money & tax', short: 'Money', Icon: Wallet },
  { id: 'pipeline', label: 'Pipeline', short: 'Pipeline', Icon: KanbanSquare },
  { id: 'clients', label: 'Clients', short: 'Clients', Icon: Users },
  { id: 'scout', label: 'Opportunity scout', short: 'Scout', Icon: Telescope },
  { id: 'pitch', label: 'Pitch studio', short: 'Pitch', Icon: FileBadge },
];

const readHash = (): Page => {
  const h = location.hash.slice(1) as Page;
  return [...NAV.map((n) => n.id), 'settings'].includes(h) ? h : 'home';
};

/** Demo: open straight into fictional sample data, no password, nothing stored. */
function useDemoSession(set: (s: Session) => void) {
  useEffect(() => {
    if (!DEMO) return;
    const salt = newSalt();
    deriveKey(crypto.randomUUID(), salt).then((key) => {
      const vault = sampleVault();
      vault.settings.autoLockMinutes = 0;
      set({ key, salt, vault });
    });
  }, [set]);
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  useDemoSession(setSession);
  if (!session) return DEMO ? <div className="lock" /> : <Lock onUnlock={setSession} />;
  return <VaultProvider session={session} onLock={() => setSession(null)}><Shell /></VaultProvider>;
}

function Shell() {
  const { vault, lock, sync, syncNow } = useVault();
  const [page, setPageState] = useState<Page>(readHash);
  useEffect(() => { const h = () => setPageState(readHash()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  const go = (p: Page) => { location.hash = p; setPageState(p); window.scrollTo({ top: 0 }); };

  const counts = useMemo(() => ({
    money: vault.invoices.filter((i) => !i.paidDate && i.dueDate < new Date().toISOString().slice(0, 10)).length,
    pipeline: vault.deals.filter((d) => !['Won', 'Lost'].includes(d.stage) && dealHeat(d, vault.settings.staleDays).heat !== 'warm').length,
    clients: clientStats(vault).filter((c) => c.contactDue && c.tier !== 'New').length,
  } as Partial<Record<Page, number>>), [vault]);

  const SyncIcon = sync === 'saving' ? RefreshCw : sync === 'error' ? CloudOff : Cloud;
  const syncBtn = sync !== 'off' && (
    <button className="btn ghost icon" title={sync === 'error' ? 'Drive sync needs attention' : 'Synced to Google Drive'} onClick={() => (sync === 'error' ? go('settings') : syncNow())}>
      <SyncIcon size={18} color={sync === 'error' ? 'var(--blush-ink)' : 'var(--sage-ink)'} />
    </button>
  );

  const content = {
    home: <Dashboard go={go} />, money: <Finance />, pipeline: <Pipeline />, clients: <Clients />,
    scout: <Scout />, pitch: <Pitch />, settings: <Settings />,
  }[page];

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div><div className="brand-name">Lede</div><div className="brand-sub">{vault.settings.ownerName} · Comms</div></div>
        </div>
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} className={`navlink ${page === id ? 'active' : ''}`} onClick={() => go(id)}>
            <Icon size={18} />{label}{!!counts[id] && <span className="count">{counts[id]}</span>}
          </button>
        ))}
        <div className="spacer" />
        <button className={`navlink ${page === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Cog size={18} />Settings</button>
        <div className="row">
          {!DEMO && <button className="navlink" onClick={lock}><LogOut size={18} />Lock</button>}
          {syncBtn}
        </div>
      </aside>

      <header className="mobile-head no-print">
        <div className="brand"><div className="brand-mark">L</div><div className="brand-name">Lede</div></div>
        <div className="row" style={{ gap: 2 }}>
          {syncBtn}
          <button className="btn ghost icon" onClick={() => go('settings')} aria-label="Settings"><Cog size={19} /></button>
          {!DEMO && <button className="btn ghost icon" onClick={lock} aria-label="Lock"><LogOut size={19} /></button>}
        </div>
      </header>

      <main className="main">
        {DEMO && <div className="note no-print" style={{ marginBottom: 16, background: 'var(--lav)', borderStyle: 'solid' }}><b>Prototype preview.</b> Everything here is fictional sample data, and nothing you enter is saved. The real app opens with a password and keeps Eleanor’s data encrypted on her own devices.</div>}
        {content}
      </main>

      <nav className="bottomnav no-print">
        {NAV.map(({ id, short, Icon }) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)}>
            <Icon size={20} />{short}{!!counts[id] && <span className="dot" />}
          </button>
        ))}
      </nav>
    </div>
  );
}
