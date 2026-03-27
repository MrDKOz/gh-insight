import { decryptToken, encryptToken } from "../tokenCrypto";

// These tests run against the real Web Crypto API (available in jsdom) and a
// real IndexedDB (also available in jsdom via the structured-clone implementation).

describe("encryptToken / decryptToken — happy path (IndexedDB available)", () => {
  it("round-trips a token correctly", async () => {
    const token = "ghp_testtoken1234";
    const encrypted = await encryptToken(token);
    const decrypted = await decryptToken(encrypted);

    expect(decrypted).toBe(token);
  });

  it("produces a non-empty string", async () => {
    const encrypted = await encryptToken("ghp_abc");

    expect(typeof encrypted).toBe("string");
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it("different tokens produce different stored values", async () => {
    const ct1 = await encryptToken("ghp_tokenA");
    const ct2 = await encryptToken("ghp_tokenB");

    expect(ct1).not.toBe(ct2);
  });

  it("round-trips a token with special characters", async () => {
    const token = "special!@#$%^&*()_+= token";
    const encrypted = await encryptToken(token);
    const decrypted = await decryptToken(encrypted);

    expect(decrypted).toBe(token);
  });
});

describe("decryptToken — legacy / fallback payloads", () => {
  it("decodes a plain base64 token (no 'e:' prefix) as a legacy payload", async () => {
    // Simulate a token stored before the 'e:' prefix was added
    const legacyStored = btoa(encodeURIComponent("ghp_legacy_token").replace(/%([0-9A-F]{2})/gi, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
    const result = await decryptToken(legacyStored);

    expect(result).toBe("ghp_legacy_token");
  });

  it("throws for a payload that is not valid base64", async () => {
    await expect(decryptToken("not-valid-base64!!!")).rejects.toThrow();
  });

  it("throws for a truncated 'e:' prefixed payload (too short for IV + ciphertext)", async () => {
    // Fewer than 13 bytes once decoded (IV=12 + at least 1 byte ciphertext)
    const tooShort = `e:${btoa("short")}`;

    await expect(decryptToken(tooShort)).rejects.toThrow();
  });
});

describe("encryptToken / decryptToken — IndexedDB unavailable (fallback)", () => {
  const originalIndexedDB = globalThis.indexedDB;

  beforeEach(() => {
    // Simulate IndexedDB being blocked (private browsing, enterprise policy, etc.)
    Object.defineProperty(globalThis, "indexedDB", {
      value: {
        open: () => {
          const req = {} as IDBOpenDBRequest;
          setTimeout(() => req.onerror?.call(req, new Event("error")), 0);
          return req;
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: originalIndexedDB,
      writable: true,
      configurable: true,
    });
  });

  it("encryptToken falls back to base64 (no 'e:' prefix)", async () => {
    const token = "ghp_fallback";
    const stored = await encryptToken(token);

    expect(stored.startsWith("e:")).toBe(false);

    // The stored value should be valid base64 containing the original token
    const roundTrip = decodeURIComponent(atob(stored).split("").map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));

    expect(roundTrip).toBe(token);
  });

  it("decryptToken handles the fallback base64 payload without IndexedDB", async () => {
    const token = "ghp_fallback";
    const stored = await encryptToken(token);
    // Decrypting a non-'e:' prefixed payload does not need IndexedDB
    const result = await decryptToken(stored);

    expect(result).toBe(token);
  });
});
