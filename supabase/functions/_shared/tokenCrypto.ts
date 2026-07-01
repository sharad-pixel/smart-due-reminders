// Shared AES-GCM token encryption helpers for OAuth credentials.
// Uses the ENCRYPTION_KEY project secret. First 32 bytes of the key material
// are used as the AES-256 key. Ciphertext is base64(iv || ciphertext).

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getKey(usage: KeyUsage[]): Promise<CryptoKey> {
  const secret = Deno.env.get("ENCRYPTION_KEY");
  if (!secret) throw new Error("ENCRYPTION_KEY not configured");
  const material = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    material.slice(0, 32),
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
}

export async function encryptToken(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const key = await getKey(["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value),
  );
  const out = new Uint8Array(iv.length + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptToken(encrypted: string | null | undefined): Promise<string | null> {
  if (!encrypted) return null;
  const key = await getKey(["decrypt"]);
  const bytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return decoder.decode(plain);
}

/**
 * Read helper for a token column that may be stored encrypted (preferred)
 * or in the legacy plaintext column. Returns the plaintext token value.
 */
export async function readToken(
  encrypted: string | null | undefined,
  plaintextFallback: string | null | undefined,
): Promise<string | null> {
  if (encrypted) {
    try {
      return await decryptToken(encrypted);
    } catch (err) {
      console.error("Failed to decrypt token, falling back to plaintext:", err);
    }
  }
  return plaintextFallback ?? null;
}
