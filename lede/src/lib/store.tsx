import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { get, set, del } from 'idb-keyval';
import { deriveKey, newSalt, open, seal, unb64, type Sealed } from './crypto';
import { emptyVault, migrate } from './defaults';
import { driveConnected, pushVault } from './drive';
import type { Vault } from './types';

const KEY = 'lede-vault';
export const DEMO = import.meta.env.VITE_DEMO === '1';

export const loadSealed = () => get<Sealed>(KEY);
export const wipeLocal = () => del(KEY);

type Collection = 'clients' | 'invoices' | 'expenses' | 'deals' | 'docs';
type SyncState = 'off' | 'idle' | 'saving' | 'error';

interface Ctx {
  vault: Vault;
  update: (fn: (v: Vault) => Vault) => void;
  upsert: <K extends Collection>(c: K, item: Vault[K][number]) => void;
  remove: (c: Collection, id: string) => void;
  lock: () => void;
  changePassword: (pw: string) => Promise<void>;
  exportBackup: () => Promise<Sealed>;
  sync: SyncState;
  syncError?: string;
  syncNow: () => Promise<void>;
}

const VaultCtx = createContext<Ctx | null>(null);
export const useVault = () => {
  const c = useContext(VaultCtx);
  if (!c) throw new Error('useVault outside provider');
  return c;
};

export interface Session { key: CryptoKey; salt: Uint8Array<ArrayBuffer>; vault: Vault }

export async function createVault(password: string, initial?: Vault): Promise<Session> {
  const salt = newSalt();
  const key = await deriveKey(password, salt);
  const vault = initial ?? emptyVault();
  await set(KEY, await seal(key, salt, vault));
  return { key, salt, vault };
}

/** Open a sealed vault (local, Drive or backup file). Throws on wrong password. */
export async function unlockSealed(password: string, sealed: Sealed, persist = false): Promise<Session> {
  const salt = unb64(sealed.salt);
  const key = await deriveKey(password, salt);
  const vault = migrate(await open<Vault>(key, sealed));
  if (persist) await set(KEY, sealed);
  return { key, salt, vault };
}

export function VaultProvider({ session, onLock, children }: { session: Session; onLock: () => void; children: ReactNode }) {
  const [vault, setVault] = useState(session.vault);
  const sess = useRef(session);
  const [sync, setSync] = useState<SyncState>(vault.settings.driveSync ? 'idle' : 'off');
  const [syncError, setSyncError] = useState<string>();
  const saveTimer = useRef<number>();
  const pushTimer = useRef<number>();
  const latest = useRef(vault);
  latest.current = vault;

  const pushToDrive = useCallback(async (sealed: Sealed) => {
    if (!latest.current.settings.driveSync) return setSync('off');
    if (!driveConnected()) { setSync('error'); setSyncError('Drive not connected — tap to reconnect in Settings.'); return; }
    try { setSync('saving'); await pushVault(sealed); setSync('idle'); setSyncError(undefined); }
    catch (e: any) { setSync('error'); setSyncError(e.message); }
  }, []);

  const persist = useCallback(async (v: Vault) => {
    const sealed = await seal(sess.current.key, sess.current.salt, v);
    if (DEMO) return sealed; // demo keeps everything in memory; a reload starts fresh
    await set(KEY, sealed);
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => pushToDrive(sealed), 3000);
    return sealed;
  }, [pushToDrive]);

  const update = useCallback((fn: (v: Vault) => Vault) => {
    setVault((prev) => {
      const next = { ...fn(prev), updatedAt: new Date().toISOString() };
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => persist(next), 400);
      return next;
    });
  }, [persist]);

  const upsert = useCallback(<K extends Collection>(c: K, item: Vault[K][number]) => {
    update((v) => {
      const list = v[c] as { id: string }[];
      const i = list.findIndex((x) => x.id === (item as any).id);
      const next = i >= 0 ? list.map((x, j) => (j === i ? item : x)) : [...list, item];
      return { ...v, [c]: next };
    });
  }, [update]);

  const remove = useCallback((c: Collection, id: string) => {
    update((v) => ({ ...v, [c]: (v[c] as { id: string }[]).filter((x) => x.id !== id) }));
  }, [update]);

  const flushAndLock = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    await persist(latest.current);
    onLock();
  }, [persist, onLock]);

  // Auto-lock after inactivity.
  useEffect(() => {
    const mins = vault.settings.autoLockMinutes;
    if (!mins) return;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const evts = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = window.setInterval(() => { if (Date.now() - last > mins * 60_000) flushAndLock(); }, 15_000);
    return () => { evts.forEach((e) => window.removeEventListener(e, bump)); window.clearInterval(t); };
  }, [vault.settings.autoLockMinutes, flushAndLock]);

  // Save before the tab closes.
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'hidden') { window.clearTimeout(saveTimer.current); persist(latest.current); } };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [persist]);

  useEffect(() => { setSync(vault.settings.driveSync ? (driveConnected() ? 'idle' : 'error') : 'off'); }, [vault.settings.driveSync]);

  const changePassword = async (pw: string) => {
    const salt = newSalt();
    sess.current = { ...sess.current, salt, key: await deriveKey(pw, salt) };
    await persist(latest.current);
  };
  const exportBackup = () => seal(sess.current.key, sess.current.salt, latest.current);
  const syncNow = async () => { const s = await persist(latest.current); window.clearTimeout(pushTimer.current); await pushToDrive(s); };

  return (
    <VaultCtx.Provider value={{ vault, update, upsert, remove, lock: flushAndLock, changePassword, exportBackup, sync, syncError, syncNow }}>
      {children}
    </VaultCtx.Provider>
  );
}
