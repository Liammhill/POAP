// Google Drive access entirely from the browser (no server).
// Scopes: read-only access to her files (to interrogate historic records) and the hidden
// app-data folder (to sync the encrypted vault between phone and laptop).
import type { Sealed } from './crypto';

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.appdata';
const VAULT_NAME = 'lede-vault.json';

declare global {
  interface Window { google?: any }
}

let token: { value: string; expires: number } | null = null;
let gisLoading: Promise<void> | null = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error('Could not load Google sign-in. Are you online?')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

export const driveConnected = () => !!token && token.expires > Date.now();

/** Must be called from a click handler (opens Google's consent popup). */
export async function connectDrive(clientId: string): Promise<void> {
  if (!clientId) throw new Error('Add your Google OAuth client ID in Settings first.');
  await loadGis();
  await new Promise<void>((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (r: any) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        token = { value: r.access_token, expires: Date.now() + (Number(r.expires_in) - 60) * 1000 };
        resolve();
      },
      error_callback: (e: any) => reject(new Error(e?.message || 'Google sign-in was cancelled.')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function disconnectDrive() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
}

async function api(url: string, init: RequestInit = {}) {
  if (!driveConnected()) throw new Error('Google Drive session expired — reconnect in Settings.');
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token!.value}` } });
  if (!res.ok) throw new Error(`Google Drive error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

export interface DriveFile { id: string; name: string; mimeType: string; modifiedTime: string; size?: string }

const TABULAR = [
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

export async function searchSpreadsheets(term: string): Promise<DriveFile[]> {
  const mimes = TABULAR.map((m) => `mimeType='${m}'`).join(' or ');
  let q = `(${mimes}) and trashed=false`;
  if (term.trim()) q += ` and (name contains '${term.replace(/['\\]/g, '\\$&')}' or fullText contains '${term.replace(/['\\]/g, '\\$&')}')`;
  const params = new URLSearchParams({ q, pageSize: '50', orderBy: 'modifiedTime desc', fields: 'files(id,name,mimeType,modifiedTime,size)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
  if (term.trim()) params.delete('orderBy'); // fullText queries can't be ordered
  const r = await api(`https://www.googleapis.com/drive/v3/files?${params}`);
  return (await r.json()).files ?? [];
}

/** Returns raw bytes; Google Sheets are exported as .xlsx so every tab comes through. */
export async function downloadSpreadsheet(f: DriveFile): Promise<ArrayBuffer> {
  const url = f.mimeType === 'application/vnd.google-apps.spreadsheet'
    ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent(TABULAR[1])}`
    : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`;
  return (await api(url)).arrayBuffer();
}

async function findVaultFile(): Promise<string | null> {
  const params = new URLSearchParams({ spaces: 'appDataFolder', q: `name='${VAULT_NAME}'`, fields: 'files(id)' });
  const r = await api(`https://www.googleapis.com/drive/v3/files?${params}`);
  return (await r.json()).files?.[0]?.id ?? null;
}

export async function pullVault(): Promise<Sealed | null> {
  const id = await findVaultFile();
  if (!id) return null;
  return (await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json();
}

export async function pushVault(sealed: Sealed): Promise<void> {
  const id = await findVaultFile();
  const meta = id ? {} : { name: VAULT_NAME, parents: ['appDataFolder'] };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  body.append('file', new Blob([JSON.stringify(sealed)], { type: 'application/json' }));
  const url = id
    ? `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  await api(url, { method: id ? 'PATCH' : 'POST', body });
}
