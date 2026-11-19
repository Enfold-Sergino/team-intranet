/**
 * Shared login on a static host: every page is encrypted at build time (AES-256-GCM, key =
 * PBKDF2-SHA256 of username + password) and replaced by a small loader. The login page derives the
 * same key in the browser (src/lib/session.ts); without it the files are unreadable.
 */
import { createCipheriv, createHash, pbkdf2Sync, randomBytes } from "node:crypto";

export const ITERATIONS = 310_000;
export const STORAGE_KEY = "team-intranet-session";
export const MIN_PASSWORD_LENGTH = 16;
const CHECK = "team-intranet-ok";

export interface Encrypted {
  iv: string;
  ct: string;
}

/** An error message when the credentials can't be used, else null. None at all = unprotected. */
export function validateCredentials(username: string, password: string): string | null {
  if (password && !username) return "SITE_PASSWORD is set but SITE_USERNAME is not.";
  if (username && !password) return "SITE_USERNAME is set but SITE_PASSWORD is not.";
  if (password && password.length < MIN_PASSWORD_LENGTH)
    return `SITE_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters (the encrypted pages can be attacked offline).`;
  return null;
}

export const saltFor = (username: string) =>
  createHash("sha256").update(`team-intranet:${username}`).digest("base64");

export const deriveKey = (username: string, password: string) =>
  pbkdf2Sync(
    `${username}\u0000${password}`,
    Buffer.from(saltFor(username), "base64"),
    ITERATIONS,
    32,
    "sha256",
  );

/** AES-256-GCM in WebCrypto's layout: ciphertext followed by the 16-byte tag. */
export function encrypt(text: string, key: Buffer): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { iv: iv.toString("base64"), ct: body.toString("base64") };
}

export interface AuthConfig {
  salt: string;
  iterations: number;
  hours: number;
  storageKey: string;
  base: string;
  /** A known text: decrypting it proves the credentials. */
  check: Encrypted;
}

export const authConfig = (opts: {
  username: string;
  key: Buffer;
  base: string;
  hours: number;
}): AuthConfig => ({
  salt: saltFor(opts.username),
  iterations: ITERATIONS,
  hours: opts.hours,
  storageKey: STORAGE_KEY,
  base: opts.base,
  check: encrypt(CHECK, opts.key),
});

const AUTH_CONFIG_TAG = /<script id="auth-config" type="application\/json">[^<]*<\/script>/;

/** Fill in the login page's settings. Throws without the placeholder: visitors would loop forever. */
export function injectAuthConfig(html: string, config: AuthConfig | null): string {
  if (!AUTH_CONFIG_TAG.test(html))
    throw new Error(
      'The login page has no <script id="auth-config" type="application/json"> placeholder',
    );
  const json = JSON.stringify(config).replace(/</g, "\\u003c"); // can't close the <script>
  return html.replace(
    AUTH_CONFIG_TAG,
    () => `<script id="auth-config" type="application/json">${json}</script>`,
  );
}

/** The page that replaces a protected page: decrypts it with the stored key, else goes to /login/. */
export function shell(payload: Encrypted, base: string): string {
  const loader =
    `(async()=>{const K=${JSON.stringify(STORAGE_KEY)},L=${JSON.stringify(`${base}login/`)};` +
    `const go=()=>location.replace(L+"?returnTo="+encodeURIComponent(location.pathname+location.search+location.hash));` +
    `const b=(s)=>Uint8Array.from(atob(s),(c)=>c.charCodeAt(0));` +
    `try{const s=JSON.parse(localStorage.getItem(K)||"null");if(!s||!s.k||s.exp<Date.now())return go();` +
    `const key=await crypto.subtle.importKey("raw",b(s.k),"AES-GCM",false,["decrypt"]);` +
    `const d=JSON.parse(document.getElementById("page").textContent);` +
    `const html=new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:b(d.iv)},key,b(d.ct)));` +
    // Swap in the page's <html> (document.write would freeze favicon changes in Chrome); scripts
    // parsed by DOMParser never run, so each one is re-created in order.
    `const doc=new DOMParser().parseFromString(html,"text/html");` +
    `document.documentElement.replaceWith(document.adoptNode(doc.documentElement));` +
    `for(const old of document.querySelectorAll("script")){const s=document.createElement("script");` +
    `for(const a of old.attributes)s.setAttribute(a.name,a.value);s.async=false;s.text=old.text;old.replaceWith(s);}}` +
    `catch(e){try{localStorage.removeItem(K)}catch{}go();}})();`;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex, nofollow"><title>Intranet</title></head>` +
    `<body><noscript><p style="font:15px system-ui,sans-serif;text-align:center;margin-top:40vh">This intranet needs JavaScript to sign in.</p></noscript>` +
    `<script id="page" type="application/json">${JSON.stringify(payload)}</script><script>${loader}</script></body></html>`
  );
}
