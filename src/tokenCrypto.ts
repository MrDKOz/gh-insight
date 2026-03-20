/**
 * AES-GCM token encryption using the Web Crypto API.
 *
 * A 256-bit key is generated once per browser profile and stored as a
 * CryptoKey object in IndexedDB — the structured-clone algorithm persists
 * CryptoKey objects even when non-exportable. The IV is prepended to the
 * ciphertext and the whole thing base64-encoded before writing to localStorage.
 *
 * Threat model: protects against casual localStorage inspection and copying the
 * entry in isolation — an attacker needs both localStorage and IndexedDB from
 * the same browser profile. Not a substitute for a proper secrets manager.
 */

const DB_NAME    = 'gmt_keystore';
const STORE_NAME = 'keys';
const KEY_ID     = 'token_key';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess       = () => resolve(req.result);
    req.onerror         = () => reject(req.error);
  });
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await openDB();

  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror   = () => reject(req.error);
  });
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,              // non-exportable — usable only within this browser profile
    ['encrypt', 'decrypt'],
  );

  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(key, KEY_ID);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });

  return key;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Encrypt a string and return base64(IV ‖ ciphertext). */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  const buf = new Uint8Array(12 + ct.byteLength);
  buf.set(iv);
  buf.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...buf));
}

/**
 * Decrypt a base64 string produced by encryptToken.
 * Throws if the IndexedDB key is unavailable or the data is corrupt.
 */
export async function decryptToken(stored: string): Promise<string> {
  const key = await getOrCreateKey();
  const buf = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
  const pt  = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.slice(0, 12) },
    key,
    buf.slice(12),
  );
  return decoder.decode(pt);
}
