// Client-side encryption: PBKDF2-SHA256 (600k iterations) → AES-256-GCM.
// Nothing is ever stored or synced unencrypted.

export interface Sealed {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
  updatedAt: string;
}

const ITER = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function newSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function seal(key: CryptoKey, salt: Uint8Array, data: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct), updatedAt: new Date().toISOString() };
}

/** Throws if the password is wrong (GCM auth failure). */
export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.ct));
  return JSON.parse(dec.decode(pt)) as T;
}
