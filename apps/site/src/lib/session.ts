/**
 * Browser side of the shared login (src/integrations/protect.ts): derive the AES key from the
 * username and password, keep it for the session, decrypt protected files with it.
 */

export const SESSION_KEY = "team-intranet-session";

export interface Encrypted {
  iv: string;
  ct: string;
}

/** What the build puts in the login page's `<script id="auth-config">` (null when unprotected). */
export interface AuthConfig {
  salt: string;
  iterations: number;
  hours: number;
  storageKey: string;
  base: string;
  check: Encrypted;
}

const bytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const toBase64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

export const readAuthConfig = (id = "auth-config") =>
  JSON.parse(document.getElementById(id)?.textContent || "null") as AuthConfig | null;

export async function decrypt(key: CryptoKey, data: Encrypted): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes(data.iv) },
    key,
    bytes(data.ct),
  );
  return new TextDecoder().decode(plain);
}

/**
 * Check the credentials against `config.check` and store the key for `config.hours`. Rejects on a
 * wrong username or password; `stored` is false when the browser blocks storage.
 */
export async function signIn(
  config: AuthConfig,
  username: string,
  password: string,
): Promise<{ stored: boolean }> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${username}\u0000${password}`),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(config.salt), iterations: config.iterations },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"],
  );
  await decrypt(key, config.check);
  try {
    const raw = await crypto.subtle.exportKey("raw", key);
    localStorage.setItem(
      config.storageKey,
      JSON.stringify({ k: toBase64(raw), exp: Date.now() + config.hours * 3_600_000 }),
    );
    return { stored: true };
  } catch {
    return { stored: false };
  }
}

/** The stored key, or null when not signed in or expired. */
export async function storedKey(): Promise<CryptoKey | null> {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!session?.k || !(session.exp > Date.now())) return null;
    return await crypto.subtle.importKey("raw", bytes(session.k), "AES-GCM", false, ["decrypt"]);
  } catch {
    return null;
  }
}

export const hasSession = () => {
  try {
    return Boolean(localStorage.getItem(SESSION_KEY));
  } catch {
    return false;
  }
};

export function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: nothing to clear */
  }
}
