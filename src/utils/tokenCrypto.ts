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

const DB_NAME = "gmt_keystore";
const STORE_NAME = "keys";
const KEY_ID = "token_key";

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const getOrCreateKey = async (): Promise<CryptoKey> => {
  const db = await openDB();
  try {
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY_ID);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });
    if (existing) {return existing;}

    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // non-exportable — usable only within this browser profile
      ["encrypt", "decrypt"],
    );

    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(key, KEY_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    return key;
  } finally {
    db.close();
  }
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Thrown by encryptToken when IndexedDB is unavailable (private browsing,
 * enterprise policy, etc.). The fallbackPayload field contains a base64
 * encoding of the plaintext that can still be persisted and later decoded by
 * decryptToken — but with no encryption. Callers must decide whether to store
 * it and must warn the user that storage is unencrypted.
 */
class EncryptionUnavailableError extends Error {
  readonly fallbackPayload: string;
  constructor(fallbackPayload: string) {
    super("IndexedDB unavailable — token cannot be encrypted");
    this.name = "EncryptionUnavailableError";
    this.fallbackPayload = fallbackPayload;
  }
}

const encryptToken = async (plaintext: string): Promise<string> => {
  let key: CryptoKey;
  try {
    key = await getOrCreateKey();
  } catch {
    // IndexedDB unavailable — throw so callers can warn the user rather than
    // silently storing an unencrypted token without their knowledge.
    const fallback = btoa(String.fromCharCode(...encoder.encode(plaintext)));
    throw new EncryptionUnavailableError(fallback);
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  const buf = new Uint8Array(12 + ct.byteLength);
  buf.set(iv);
  buf.set(new Uint8Array(ct), 12);
  // Prefix "e:" so decryptToken can distinguish encrypted from fallback payloads.
  return `e:${btoa(String.fromCharCode(...buf))}`;
};

const decryptToken = async (stored: string): Promise<string> => {
  // Legacy or fallback payload: plain base64, no "e:" prefix.
  if (!stored.startsWith("e:")) {
    try {
      return new TextDecoder().decode(Uint8Array.from(atob(stored), (c) => c.charCodeAt(0)));
    } catch {
      throw new Error("Stored token is not a valid base64 string");
    }
  }
  const payload = stored.slice(2);
  let key: CryptoKey;
  try {
    key = await getOrCreateKey();
  } catch {
    throw new Error("IndexedDB unavailable — cannot decrypt token");
  }
  const buf = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  if (buf.length < 13) {throw new Error("Stored token payload is too short to be valid");}
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12));
  return decoder.decode(pt);
};

export { EncryptionUnavailableError, decryptToken, encryptToken };
