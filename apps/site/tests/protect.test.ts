import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  authConfig,
  deriveKey,
  encrypt,
  injectAuthConfig,
  shell,
  validateCredentials,
  type Encrypted,
} from "../src/integrations/protect";

const subtle = webcrypto.subtle;
const bytes = (value: string) => Uint8Array.from(Buffer.from(value, "base64"));

/** The browser's side (src/lib/session.ts), with WebCrypto. */
async function browserKey(
  username: string,
  password: string,
  config: { salt: string; iterations: number },
) {
  const material = await subtle.importKey(
    "raw",
    new TextEncoder().encode(`${username}\u0000${password}`),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(config.salt), iterations: config.iterations },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"],
  );
}
const decrypt = async (key: webcrypto.CryptoKey, payload: Encrypted) =>
  new TextDecoder().decode(
    await subtle.decrypt({ name: "AES-GCM", iv: bytes(payload.iv) }, key, bytes(payload.ct)),
  );

describe("page encryption", () => {
  const key = deriveKey("team", "a-long-test-password");
  const config = authConfig({ username: "team", key, base: "/intranet/", hours: 12 });

  it("decrypts in the browser with the right credentials only", async () => {
    const page = "<!doctype html><h1>Ways of working</h1>";
    const right = await browserKey("team", "a-long-test-password", config);
    expect(await decrypt(right, config.check)).toBe("team-intranet-ok");
    expect(await decrypt(right, encrypt(page, key))).toBe(page);
    const wrong = await browserKey("team", "wrong-password-123456", config);
    await expect(decrypt(wrong, config.check)).rejects.toThrow();
  }, 20_000);

  it("uses a fresh IV for every page", () => {
    expect(encrypt("same", key).iv).not.toBe(encrypt("same", key).iv);
  });

  it("the shell holds no page text, swaps the page in without document.write and has no <style>", () => {
    const html = shell(encrypt("secret project name", key), "/intranet/");
    expect(html).not.toContain("secret project name");
    expect(html).toContain('"/intranet/login/"');
    expect(html).toContain("DOMParser");
    expect(html).not.toMatch(/document\.write|<style/i);
  });
});

describe("injectAuthConfig", () => {
  const login = '<main></main><script id="auth-config" type="application/json">null</script>';
  const config = authConfig({
    username: "team",
    key: deriveKey("team", "x".repeat(16)),
    base: "</script><script>alert(1)</script>",
    hours: 1,
  });

  it("fills in the placeholder, without a way to close the script tag", () => {
    const html = injectAuthConfig(login, config);
    expect(html).toContain('"iterations":310000');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it("fails loudly when the placeholder is missing", () => {
    expect(() => injectAuthConfig("<main></main>", null)).toThrow(/placeholder/);
  });
});

describe("validateCredentials", () => {
  it("accepts none (unprotected) or a long password, rejects half or weak ones", () => {
    expect(validateCredentials("", "")).toBeNull();
    expect(validateCredentials("team", "x".repeat(16))).toBeNull();
    expect(validateCredentials("team", "")).toMatch(/SITE_PASSWORD/);
    expect(validateCredentials("", "x".repeat(20))).toMatch(/SITE_USERNAME/);
    expect(validateCredentials("team", "short")).toMatch(/16/);
  });
});
